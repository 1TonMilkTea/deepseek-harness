<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { inject } from 'vue'
import { ShoppingCart } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { BRIDGE_KEY, type CustomWorkbenchBridge, type WorkbenchEmployee } from '../../bridge.js'
import {
  buildStkInStockRecordReportInput,
  extractViewBillDoc,
  findEntryIndexForBarcode,
  mapEntityRows,
  pickK3RefId,
  type EntryRow,
  type JsonRecord,
  type ScannedBarcode,
} from './stk-input.js'

const bridge = inject<CustomWorkbenchBridge>(BRIDGE_KEY)
if (bridge === undefined) throw new Error('CustomWorkbenchBridge missing: provide via mountCustomWorkbench')

type Page = 'home' | 'receive'
type ReceiveSegment = 0 | 1 | 2
const page = ref<Page>('home')
const receiveSegment = ref<ReceiveSegment>(0)
const selectedEntryIndex = ref(-1)
const lastBarcodeHint = ref('')
const loading = ref(false)
const billNoQuery = ref('')
const listRows = ref<JsonRecord[]>([])
const employee = ref<WorkbenchEmployee | null>(null)

const billId = ref(0)
const billNo = ref('')
const billDoc = ref<JsonRecord | null>(null)
const entries = ref<EntryRow[]>([])
const barcodeInput = ref('')
const stockInput = ref('')
const stockHint = ref('')
const stockOverride = reactive<{ stockId: number; stockLocId: number }>({ stockId: 0, stockLocId: 0 })
const submitVisible = ref(false)
const submitting = ref(false)
const qtyDialogVisible = ref(false)
const qtyDraft = ref(1)
const pendingBarcode = ref<{ code: string; doc: JsonRecord; rowIndex: number } | null>(null)

const labels = bridge.labels
const segmentOptions = computed(() => [
  { label: labels.segList, value: 0 },
  { label: labels.segEntries, value: 1 },
  { label: labels.segBarcodes, value: 2 },
])
const selectedEntry = computed(() => entries.value[selectedEntryIndex.value] ?? null)
const selectedBarcodeRows = computed(() => {
  const entry = selectedEntry.value
  if (entry === null) return []
  return entry.barcodes.map((bc) => ({
    key: `${entry.EntryId}-${bc.FBarcode}`,
    material: entry.MaterialName || entry.MaterialNumber || '-',
    barcode: bc.FBarcode,
    qty: bc.FQty,
  }))
})
const selectedEntryLabel = computed(() => {
  const entry = selectedEntry.value
  if (entry === null) return ''
  const name = entry.MaterialName || entry.MaterialNumber || String(entry.EntryId)
  return `${labels.selectedPrefix}：${name}`
})
const summaryRows = computed(() => {
  const rows: Array<{ key: string; material: string; barcode: string; qty: number }> = []
  for (const entry of entries.value) {
    for (const bc of entry.barcodes) {
      rows.push({
        key: `${entry.EntryId}-${bc.FBarcode}`,
        material: entry.MaterialName || entry.MaterialNumber || '-',
        barcode: bc.FBarcode,
        qty: bc.FQty,
      })
    }
  }
  return rows
})

async function refreshEmployee(): Promise<void> {
  const result = await bridge.getEmployee()
  employee.value = result.ok ? result.value : null
}

async function publishListSnapshot(): Promise<void> {
  await bridge.publishSnapshot({
    kind: 'list',
    title: labels.menuPurReceive,
    rows: listRows.value.map((row) => ({
      id: Number(row.FId ?? row.Id ?? 0) || 0,
      billNo: String(row.FBillNo ?? row.BillNo ?? ''),
      status: String(row.FDocumentStatus ?? ''),
    })),
  })
}

async function publishDetailSnapshot(): Promise<void> {
  await bridge.publishSnapshot({
    kind: 'form',
    title: `${labels.menuPurReceive} ${billNo.value}`,
    rows: entries.value.map((entry) => ({
      entryId: entry.EntryId,
      material: entry.MaterialNumber,
      qty: entry.FActReceiveQty,
      barcodes: entry.barcodes.length,
    })),
    form: {
      billId: billId.value,
      billNo: billNo.value,
      barcodeCount: summaryRows.value.length,
    },
  })
}

function buildBillNoFilter(billNoText: string): string | undefined {
  const text = billNoText.trim()
  if (text === '') return undefined
  const escaped = text.replace(/'/g, "''")
  return `FBillNo LIKE '%${escaped}%'`
}

async function queryList(): Promise<void> {
  loading.value = true
  try {
    const result = await bridge.listBills({
      filterString: buildBillNoFilter(billNoQuery.value),
      limit: 200,
      startRow: 0,
    })
    if (!result.ok) {
      ElMessage.error(result.error.message)
      return
    }
    const rows = Array.isArray(result.value.rows) ? result.value.rows : []
    listRows.value = rows.filter((row): row is JsonRecord => row !== null && typeof row === 'object' && !Array.isArray(row))
    page.value = 'receive'
    receiveSegment.value = 0
    await publishListSnapshot()
  } finally {
    loading.value = false
  }
}

async function openBill(row: JsonRecord): Promise<void> {
  const id = pickK3RefId(row.FId ?? row.Id)
  if (id <= 0) {
    ElMessage.error('单据内码无效')
    return
  }
  loading.value = true
  try {
    const view = await bridge.viewBill({ formId: 'PUR_ReceiveBill', id })
    if (!view.ok) {
      ElMessage.error(view.error.message)
      return
    }
    const doc = extractViewBillDoc(view.value)
    if (doc === null) {
      ElMessage.error('单据详情为空')
      return
    }
    const orgId = Number(employee.value?.orgId ?? 0) || undefined
    const entity = await bridge.entityOutputs({ orgId, id })
    if (!entity.ok) {
      ElMessage.error(entity.error.message)
      return
    }
    const entityRows = Array.isArray(entity.value.rows) ? entity.value.rows : []
    billId.value = id
    billNo.value = String(doc.BillNo ?? row.FBillNo ?? '')
    billDoc.value = doc
    entries.value = mapEntityRows(entityRows)
    stockHint.value = ''
    stockOverride.stockId = 0
    stockOverride.stockLocId = 0
    barcodeInput.value = ''
    stockInput.value = ''
    selectedEntryIndex.value = -1
    lastBarcodeHint.value = ''
    page.value = 'receive'
    receiveSegment.value = 1
    await publishDetailSnapshot()
  } finally {
    loading.value = false
  }
}

function clearOpenBill(): void {
  billId.value = 0
  billNo.value = ''
  billDoc.value = null
  entries.value = []
  selectedEntryIndex.value = -1
  lastBarcodeHint.value = ''
  barcodeInput.value = ''
  stockInput.value = ''
  stockHint.value = ''
  stockOverride.stockId = 0
  stockOverride.stockLocId = 0
}

function backToList(): void {
  clearOpenBill()
  receiveSegment.value = 0
  page.value = 'receive'
  void publishListSnapshot()
}

async function backToHome(): Promise<void> {
  page.value = 'home'
  receiveSegment.value = 0
  listRows.value = []
  billNoQuery.value = ''
  clearOpenBill()
  await bridge.publishSnapshot({ kind: 'empty', title: labels.title, rows: [] })
}

async function enterPurReceive(): Promise<void> {
  page.value = 'receive'
  receiveSegment.value = 0
  await queryList()
}

function selectEntry(index: number): void {
  if (index < 0 || index >= entries.value.length) return
  selectedEntryIndex.value = index
}

function onSegmentChange(value: string | number | boolean | undefined): void {
  const next = Number(value)
  if (next !== 0 && next !== 1 && next !== 2) return
  if (next > 0 && billId.value <= 0) {
    ElMessage.warning(labels.openBillFirst)
    return
  }
  if (next === 2 && selectedEntryIndex.value < 0) {
    ElMessage.warning(labels.noSelection)
    return
  }
  receiveSegment.value = next
}

function entryRowClassName({ rowIndex }: { rowIndex: number }): string {
  return rowIndex === selectedEntryIndex.value ? 'tmt-row-selected' : ''
}

function onEntryRowClick(row: EntryRow): void {
  const index = entries.value.indexOf(row)
  if (index >= 0) selectEntry(index)
}

async function resolveStock(): Promise<void> {
  const code = stockInput.value.trim()
  if (code === '') {
    ElMessage.warning(labels.stockCodePlaceholder)
    return
  }
  loading.value = true
  try {
    const result = await bridge.getStockInfo({ number: code })
    if (!result.ok) {
      ElMessage.error(result.error.message)
      return
    }
    if (result.value.success === false) {
      ElMessage.error(String(result.value.message || '仓位查询失败'))
      return
    }
    const data = (result.value.data ?? {}) as JsonRecord
    stockOverride.stockId = pickK3RefId(data.StockId ?? data.FStockId)
    stockOverride.stockLocId = pickK3RefId(data.StockLocId ?? data.FStockLocId)
    const stockName = String(data.StockName ?? data.FStockName ?? '').trim()
    const locName = String(data.StockLocName ?? data.FStockLocName ?? '').trim()
    stockHint.value = [stockName, locName].filter(Boolean).join(' / ') || code
    ElMessage.success(stockHint.value)
  } finally {
    loading.value = false
  }
}

async function addBarcode(): Promise<void> {
  const code = barcodeInput.value.trim()
  if (code === '') {
    ElMessage.warning(labels.barcodePlaceholder)
    return
  }
  if (billId.value <= 0) {
    ElMessage.warning('请先打开单据')
    return
  }
  loading.value = true
  try {
    const result = await bridge.getBarcode({ barcode: code })
    if (!result.ok) {
      ElMessage.error(result.error.message)
      return
    }
    const missing = result.value.success === false
      || result.value.doc === null
      || result.value.doc === undefined
    if (missing) {
      if (selectedEntryIndex.value < 0) {
        ElMessage.error(labels.barcodeMissing)
        return
      }
      pendingBarcode.value = { code, doc: {}, rowIndex: selectedEntryIndex.value }
      qtyDraft.value = 1
      qtyDialogVisible.value = true
      return
    }
    const doc = result.value.doc as JsonRecord
    const rowIndex = findEntryIndexForBarcode(billId.value, entries.value, doc)
    if (rowIndex < 0) {
      ElMessage.error(labels.unmatchedEntry)
      return
    }
    selectEntry(rowIndex)
    const defaultQty = Number(doc.Qty ?? doc.FQty ?? 1) || 1
    pendingBarcode.value = { code, doc, rowIndex }
    qtyDraft.value = defaultQty
    qtyDialogVisible.value = true
  } finally {
    loading.value = false
  }
}

function confirmQty(): void {
  const pending = pendingBarcode.value
  if (pending === null) {
    qtyDialogVisible.value = false
    return
  }
  const qty = Number(qtyDraft.value)
  if (!Number.isFinite(qty) || qty <= 0) {
    ElMessage.warning('数量必须大于 0')
    return
  }
  const row = entries.value[pending.rowIndex]
  if (row === undefined) {
    qtyDialogVisible.value = false
    return
  }
  const scanned: number = row.barcodes.reduce((sum, item) => sum + Number(item.FQty || 0), 0)
  const existIdx = row.barcodes.findIndex((item) => item.FBarcode === pending.code)
  const other = existIdx >= 0
    ? scanned - Number(row.barcodes[existIdx]?.FQty || 0)
    : scanned
  if (row.FActReceiveQty > 0 && other + qty > row.FActReceiveQty) {
    ElMessage.error(`累计数量不能超过可收数量 ${row.FActReceiveQty}`)
    return
  }
  const entry: ScannedBarcode = {
    FBarcode: pending.code,
    FQty: qty,
    __raw: pending.doc,
    ...(stockOverride.stockId > 0 ? { InStockId: stockOverride.stockId } : {}),
    ...(stockOverride.stockLocId > 0 ? { InStockLocId: stockOverride.stockLocId } : {}),
  }
  if (existIdx >= 0) {
    row.barcodes.splice(existIdx, 1, entry)
  } else {
    row.barcodes.push(entry)
  }
  barcodeInput.value = ''
  pendingBarcode.value = null
  qtyDialogVisible.value = false
  lastBarcodeHint.value = `${pending.code} × ${qty}`
  selectEntry(pending.rowIndex)
  void publishDetailSnapshot()
  ElMessage.success(`已录入：${pending.code} × ${qty}`)
}

function openSubmitDialog(): void {
  if (summaryRows.value.length === 0) {
    ElMessage.warning('请先录入条码')
    return
  }
  if (billDoc.value === null) {
    ElMessage.warning('缺少单据详情')
    return
  }
  submitVisible.value = true
}

async function confirmSubmit(): Promise<void> {
  if (billDoc.value === null || employee.value === null) {
    ElMessage.error('缺少登录员工或单据')
    return
  }
  const orgId = Number(employee.value.orgId) || 0
  const operatorId = Number(employee.value.empinfoId) || 0
  if (orgId <= 0 || operatorId <= 0) {
    ElMessage.error('员工组织或内码无效')
    return
  }
  const input = buildStkInStockRecordReportInput(billDoc.value, entries.value, { orgId, operatorId })
  if (!Array.isArray(input.BarcodeDataList) || input.BarcodeDataList.length === 0) {
    ElMessage.warning('没有可提交的条码')
    return
  }
  submitting.value = true
  try {
    const result = await bridge.submitReport({ inputJson: JSON.stringify(input) })
    if (!result.ok) {
      ElMessage.error(result.error.message)
      return
    }
    if (result.value.success === false) {
      ElMessage.error(String(result.value.message || '入库失败'))
      return
    }
    ElMessage.success(String(result.value.message || '入库成功'))
    submitVisible.value = false
    for (const entry of entries.value) entry.barcodes = []
    await publishDetailSnapshot()
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  void (async () => {
    await refreshEmployee()
    await bridge.publishSnapshot({ kind: 'empty', title: labels.title, rows: [] })
  })()
})

onUnmounted(() => {
  void bridge.clearSnapshot()
})

function listBillNo(row: JsonRecord): string {
  return String(row.FBillNo ?? row.BillNo ?? '')
}

function listBillId(row: JsonRecord): number {
  return pickK3RefId(row.FId ?? row.Id)
}

function backOneLevel(): void {
  if (receiveSegment.value === 2) {
    receiveSegment.value = 1
    return
  }
  if (receiveSegment.value === 1) void confirmLeaveDetail()
}

async function confirmLeaveDetail(): Promise<void> {
  if (summaryRows.value.length === 0) {
    backToList()
    return
  }
  try {
    await ElMessageBox.confirm('返回列表将保留当前已录条码在本页内存中；确定返回？', labels.title, {
      type: 'warning',
      confirmButtonText: labels.back,
      cancelButtonText: labels.cancel,
    })
    backToList()
  } catch {
    // dismissed
  }
}
</script>

<template>
  <div class="tmt-workbench-root" data-custom-workbench v-loading="loading">
    <div v-if="page === 'home'" class="tmt-workbench-page tmt-workbench-home">
      <header class="tmt-home-header">
        <h1 class="tmt-home-title">{{ labels.title }}</h1>
        <span class="tmt-home-org">{{ employee?.orgName || employee?.orgId || '' }}</span>
      </header>
      <section class="tmt-home-section" data-workbench-section="purchase">
        <h2 class="tmt-home-section-title">{{ labels.menuPurchase }}</h2>
        <div class="tmt-home-grid">
          <button
            type="button"
            class="tmt-home-tile"
            data-workbench-entry="pur-receive"
            @click="enterPurReceive"
          >
            <span class="tmt-home-tile-icon" aria-hidden="true">
              <el-icon><ShoppingCart /></el-icon>
            </span>
            <span class="tmt-home-tile-label">{{ labels.menuPurReceive }}</span>
          </button>
        </div>
      </section>
    </div>

    <div v-else class="tmt-workbench-page">
      <div class="tmt-receive-nav">
        <div class="tmt-receive-nav-row">
          <el-button @click="backToHome">{{ labels.backHome }}</el-button>
          <el-button v-if="receiveSegment > 0" @click="backOneLevel">{{ labels.backStep }}</el-button>
        </div>
        <div class="tmt-receive-nav-row">
          <el-segmented
            class="tmt-receive-segments"
            size="small"
            :model-value="receiveSegment"
            :options="segmentOptions"
            @change="onSegmentChange"
          />
        </div>
        <div v-if="receiveSegment > 0" class="tmt-receive-nav-row">
          <el-button type="success" @click="openSubmitDialog">{{ labels.confirmInbound }}</el-button>
        </div>
      </div>

      <template v-if="receiveSegment === 0">
        <div class="tmt-toolbar">
          <el-input
            v-model="billNoQuery"
            clearable
            :placeholder="labels.billNoPlaceholder"
            class="tmt-bill-input"
            @keyup.enter="queryList"
          >
            <template #prepend>{{ labels.billNo }}</template>
          </el-input>
          <el-button type="primary" :loading="loading" @click="queryList">{{ labels.query }}</el-button>
        </div>
        <el-table :data="listRows" stripe height="100%" empty-text="">
          <el-table-column prop="FBillNo" :label="labels.billNo" min-width="160">
            <template #default="{ row }">{{ listBillNo(row) }}</template>
          </el-table-column>
          <el-table-column prop="FDocumentStatus" label="状态" width="90" />
          <el-table-column prop="FId" label="内码" width="100">
            <template #default="{ row }">{{ listBillId(row) }}</template>
          </el-table-column>
          <el-table-column label="" width="100" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" @click="openBill(row)">{{ labels.open }}</el-button>
            </template>
          </el-table-column>
          <template #empty>
            <span>{{ labels.emptyList }}</span>
          </template>
        </el-table>
      </template>

      <template v-else>
        <el-descriptions :column="3" size="small" border class="tmt-bill-desc">
          <el-descriptions-item :label="labels.billNo">{{ billNo }}</el-descriptions-item>
          <el-descriptions-item label="内码">{{ billId }}</el-descriptions-item>
          <el-descriptions-item label="组织">{{ employee?.orgName || employee?.orgId || '-' }}</el-descriptions-item>
        </el-descriptions>
        <div class="tmt-scan-row">
          <el-input
            v-model="stockInput"
            clearable
            :placeholder="labels.stockCodePlaceholder"
            class="tmt-scan-input"
            @keyup.enter="resolveStock"
          >
            <template #prepend>{{ labels.stockCode }}</template>
          </el-input>
          <el-button @click="resolveStock">{{ labels.resolveStock }}</el-button>
          <el-input
            v-model="barcodeInput"
            clearable
            :placeholder="labels.barcodePlaceholder"
            class="tmt-scan-input"
            @keyup.enter="addBarcode"
          >
            <template #prepend>{{ labels.barcode }}</template>
          </el-input>
          <el-button type="primary" @click="addBarcode">{{ labels.addBarcode }}</el-button>
        </div>
        <p class="tmt-stock-hint">
          <span v-if="stockHint">仓位：{{ stockHint }}</span>
          <span v-if="lastBarcodeHint">{{ labels.lastInput }}：{{ lastBarcodeHint }}</span>
          <span v-if="selectedEntryLabel">{{ selectedEntryLabel }}</span>
          <span v-else>{{ labels.noSelection }}</span>
        </p>

        <el-table
          v-if="receiveSegment === 1"
          :data="entries"
          stripe
          highlight-current-row
          :row-class-name="entryRowClassName"
          empty-text=""
          @row-click="onEntryRowClick"
        >
          <el-table-column prop="MaterialNumber" label="物料编码" min-width="120" />
          <el-table-column prop="MaterialName" label="物料名称" min-width="160" />
          <el-table-column prop="FActReceiveQty" label="可收数量" width="100" />
          <el-table-column prop="StockName" label="仓库" min-width="100" />
          <el-table-column prop="StockLocName" label="仓位" min-width="100" />
          <el-table-column label="已录条码" width="90">
            <template #default="{ row }">{{ row.barcodes.length }}</template>
          </el-table-column>
          <el-table-column label="" width="110" fixed="right">
            <template #default="{ $index }">
              <el-button link type="primary" @click="selectEntry($index); receiveSegment = 2">
                {{ labels.segBarcodes }}
              </el-button>
            </template>
          </el-table-column>
          <template #empty>
            <span>{{ labels.emptyEntries }}</span>
          </template>
        </el-table>

        <el-table v-else :data="selectedBarcodeRows" stripe empty-text="">
          <el-table-column prop="material" label="物料" min-width="160" />
          <el-table-column prop="barcode" :label="labels.barcode" min-width="160" />
          <el-table-column prop="qty" :label="labels.qty" width="100" />
          <template #empty>
            <span>{{ labels.noSelection }}</span>
          </template>
        </el-table>
      </template>
    </div>

    <el-dialog v-model="qtyDialogVisible" :title="labels.qty" width="360px">
      <el-input-number v-model="qtyDraft" :min="0.0001" :step="1" controls-position="right" style="width: 100%" />
      <template #footer>
        <el-button @click="qtyDialogVisible = false">{{ labels.cancel }}</el-button>
        <el-button type="primary" @click="confirmQty">{{ labels.submit }}</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="submitVisible" :title="labels.confirmInbound" width="720px">
      <el-table :data="summaryRows" stripe max-height="360">
        <el-table-column prop="material" label="物料" min-width="160" />
        <el-table-column prop="barcode" :label="labels.barcode" min-width="160" />
        <el-table-column prop="qty" :label="labels.qty" width="100" />
      </el-table>
      <template #footer>
        <el-button @click="submitVisible = false">{{ labels.cancel }}</el-button>
        <el-button type="primary" :loading="submitting" @click="confirmSubmit">{{ labels.submit }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>
