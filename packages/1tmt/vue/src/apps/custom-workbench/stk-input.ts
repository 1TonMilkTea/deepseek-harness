/** Assemble STKInStockRecordReport input from View + entity rows + scanned barcodes (App-aligned). */

export type JsonRecord = Record<string, unknown>

export interface ScannedBarcode {
  readonly FBarcode: string
  readonly FQty: number
  readonly __raw?: JsonRecord
  readonly InStockId?: number
  readonly InStockLocId?: number
}

export interface EntryRow {
  readonly EntryId: number
  readonly Seq: number
  readonly MaterialId: number
  readonly MaterialNumber: string
  readonly MaterialName: string
  readonly FActReceiveQty: number
  readonly StockId: number
  readonly StockName: string
  readonly StockLocId: number
  readonly StockLocName: string
  readonly UnitId: number
  readonly SrcFormId: string
  readonly SrcBillNo: string
  readonly SrcId: number
  readonly SrcEntryId: number
  readonly SrcEntrySeq: number
  readonly __raw: JsonRecord
  barcodes: ScannedBarcode[]
}

/**
 * Pick a numeric Kingdee ref id from a scalar or `{ Id }` object.
 * @param ref - raw field value
 * @returns finite id or 0
 */
export function pickK3RefId(ref: unknown): number {
  if (ref === null || ref === undefined || ref === '') return 0
  if (typeof ref === 'number') return Number.isFinite(ref) ? ref : 0
  if (typeof ref === 'string') {
    const n = Number(ref)
    return Number.isFinite(n) ? n : 0
  }
  if (typeof ref === 'object' && !Array.isArray(ref)) {
    const record = ref as JsonRecord
    return pickK3RefId(record.Id ?? record.id ?? record.FId ?? record.FID)
  }
  return 0
}

/**
 * Normalize entity-output / View entry rows into workbench entry rows.
 * @param rows - MCP entity-output rows
 * @returns mutable entry rows with empty barcode lists
 */
export function mapEntityRows(rows: readonly unknown[]): EntryRow[] {
  const list: EntryRow[] = []
  for (const row of rows) {
    if (row === null || typeof row !== 'object' || Array.isArray(row)) continue
    const raw = row as JsonRecord
    const entryId = pickK3RefId(raw.Id ?? raw.EntryId ?? raw.FEntryId)
    if (entryId <= 0) continue
    const materialRef = (raw.MaterialID ?? raw.MaterialId ?? {}) as JsonRecord
    const stockRef = (raw.StockID ?? raw.StockId ?? raw.FStockId ?? {}) as JsonRecord
    const stockLocRef = (raw.StockLocId ?? raw.FStockLocId ?? {}) as JsonRecord
    list.push({
      EntryId: entryId,
      Seq: Number(raw.Seq ?? 0) || 0,
      MaterialId: pickK3RefId(materialRef) || pickK3RefId(raw.MaterialID_Id),
      MaterialNumber: String(materialRef.Number ?? raw.MaterialNumber ?? '').trim(),
      MaterialName: String(materialRef.Name ?? raw.MaterialName ?? '').trim(),
      FActReceiveQty: Number(raw.FActReceiveQty ?? raw.MustQty ?? raw.FMustQty ?? 0) || 0,
      StockId: pickK3RefId(stockRef) || pickK3RefId(raw.StockID_Id),
      StockName: String(stockRef.Name ?? raw.StockName ?? '').trim(),
      StockLocId: pickK3RefId(stockLocRef) || pickK3RefId(raw.StockLocId_Id),
      StockLocName: String(stockLocRef.Name ?? raw.StockLocName ?? '').trim(),
      UnitId: pickK3RefId(raw.UnitId ?? raw.UnitID ?? raw.BaseUnitId),
      SrcFormId: String(raw.SrcFormId ?? '').trim(),
      SrcBillNo: String(raw.SrcBillNo ?? '').trim(),
      SrcId: pickK3RefId(raw.SrcId),
      SrcEntryId: pickK3RefId(raw.SrcEntryId),
      SrcEntrySeq: Number(raw.SrcEntrySeq ?? 0) || 0,
      __raw: raw,
      barcodes: [],
    })
  }
  return list
}

/**
 * Find the entry index for a barcode doc by ReceiveBillId + ReceiveBillEntryId.
 * @param billId - current receive bill id
 * @param entries - detail rows
 * @param doc - barcode archive document
 * @returns index or -1
 */
export function findEntryIndexForBarcode(
  billId: number,
  entries: readonly EntryRow[],
  doc: JsonRecord,
): number {
  const barcodeBillId = pickK3RefId(doc.ReceiveBillId ?? doc.FReceiveBillId)
  const entryId = pickK3RefId(doc.ReceiveBillEntryId ?? doc.FReceiveBillEntryId)
  if (billId <= 0 || barcodeBillId <= 0 || entryId <= 0) return -1
  if (barcodeBillId !== billId) return -1
  return entries.findIndex(row => row.EntryId === entryId)
}

/**
 * Build the STKInStockRecordReport input object.
 * @param billDoc - View Result.Result document
 * @param entries - detail rows with barcodes
 * @param options - org / operator ids
 * @returns complete input ready for JSON.stringify
 */
export function buildStkInStockRecordReportInput(
  billDoc: JsonRecord,
  entries: readonly EntryRow[],
  options: { readonly orgId: number; readonly operatorId: number; readonly reporterId?: number },
): JsonRecord {
  const orgId = options.orgId
    || pickK3RefId(billDoc.StockOrgId)
    || pickK3RefId(billDoc.StockOrgId_Id)
  const operatorId = options.operatorId
  const reporterId = options.reporterId ?? operatorId
  const sourceBillId = pickK3RefId(billDoc.Id)
  const sourceBillNo = String(billDoc.BillNo ?? '').trim()
  const barcodeDataList: JsonRecord[] = []

  for (const row of entries) {
    const raw = row.__raw
    for (const barcode of row.barcodes) {
      const code = String(barcode.FBarcode || '').trim()
      const qty = Number(barcode.FQty)
      if (!code || !Number.isFinite(qty) || qty <= 0) continue
      const barcodeRaw = barcode.__raw ?? {}
      const materialId = row.MaterialId || pickK3RefId(raw.MaterialID)
      const unitId = row.UnitId || pickK3RefId(raw.UnitId ?? raw.UnitID ?? raw.BaseUnitId)
      const inStockId = barcode.InStockId
        || row.StockId
        || pickK3RefId(raw.StockID)
      const inStockLocId = barcode.InStockLocId
        || row.StockLocId
        || pickK3RefId(raw.StockLocId)
      const sourceEntryId = row.EntryId || pickK3RefId(raw.Id)
      const item: JsonRecord = {
        OrgId: orgId,
        BarcodeId: pickK3RefId(barcodeRaw.Id ?? barcodeRaw.BarcodeId),
        BarcodeNumber: code,
        BarcodeType: '物料码',
        InStockId: inStockId,
        InStockLocId: inStockLocId,
        MaterialId: materialId,
        MaterialNumber: row.MaterialNumber,
        UnitId: unitId,
        LotText: String(raw.Lot_Text ?? raw.LotText ?? '').trim(),
        Qty: qty,
        ReceiveBillId: pickK3RefId(barcodeRaw.ReceiveBillId) || sourceBillId,
        ReceiveBillEntryId: pickK3RefId(barcodeRaw.ReceiveBillEntryId) || sourceEntryId,
        SourceBillId: sourceBillId,
        SourceBillType: 'PUR_ReceiveBill',
        SourceEntryId: sourceEntryId,
        SourceBillNo: sourceBillNo,
        SourceEntrySeq: row.Seq,
        ERPSourceBillType: 'PUR_ReceiveBill',
        ERPSourceBillId: sourceBillId,
        ERPSourceBillNo: sourceBillNo,
        ERPSourceEntryId: sourceEntryId,
        ERPSourceEntrySeq: row.Seq,
        ERPOrderBillType: row.SrcFormId,
        ERPOrderBillNo: row.SrcBillNo,
        ERPOrderBillId: row.SrcId,
        ERPOrderEntryId: row.SrcEntryId,
      }
      if (row.SrcEntrySeq > 0) item.ERPOrderEntrySeq = row.SrcEntrySeq
      barcodeDataList.push(item)
    }
  }

  return {
    OrgId: orgId,
    OperatorId: operatorId,
    ReporterId: reporterId,
    EmployeeIdList: reporterId > 0 ? [reporterId] : [],
    BarcodeDataList: barcodeDataList,
  }
}

/**
 * Extract the View document object from a `pgyKdeViewBill` payload.
 * @param payload - MCP/Remote result
 * @returns bill document or null
 */
export function extractViewBillDoc(payload: WorkbenchLike): JsonRecord | null {
  const data = asRecord(payload.data) ?? asRecord(payload)
  const result = asRecord(data?.Result) ?? data
  const inner = asRecord(result?.Result) ?? result
  if (inner === null) return null
  if (pickK3RefId(inner.Id) > 0 || String(inner.BillNo ?? '').trim() !== '') return inner
  return null
}

type WorkbenchLike = { readonly [key: string]: unknown }

function asRecord(value: unknown): JsonRecord | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null
  return value as JsonRecord
}
