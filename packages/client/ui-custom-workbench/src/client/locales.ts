/** Custom workbench sidebar entry and Vue island copy. */

/** Simplified Chinese dictionary and key source of truth. */
export const zh = {
  entry: '自定义工作台',
  title: '自定义工作台',
  menuPurchase: '采购管理',
  menuPurReceive: '采购入库',
  billNo: '单据号',
  billNoPlaceholder: '输入单据号模糊查询',
  query: '查询',
  open: '打开',
  back: '返回列表',
  barcode: '条码',
  barcodePlaceholder: '手工录入条码后回车',
  stockCode: '仓位码',
  stockCodePlaceholder: '手工录入仓库/仓位码',
  addBarcode: '录入条码',
  resolveStock: '解析仓位',
  confirmInbound: '确认入库',
  submit: '提交',
  cancel: '取消',
  qty: '数量',
  loading: '加载中…',
  emptyList: '暂无收料通知单',
  emptyEntries: '暂无明细，请确认单据已审核',
} as const

/** English dictionary, key-identical to the Chinese source of truth. */
export const en: Record<CustomWorkbenchKey, string> = {
  entry: 'Custom Workbench',
  title: 'Custom Workbench',
  menuPurchase: 'Purchase',
  menuPurReceive: 'Purchase inbound',
  billNo: 'Bill no.',
  billNoPlaceholder: 'Filter by bill number',
  query: 'Search',
  open: 'Open',
  back: 'Back to list',
  barcode: 'Barcode',
  barcodePlaceholder: 'Enter barcode and press Enter',
  stockCode: 'Stock code',
  stockCodePlaceholder: 'Enter stock or location code',
  addBarcode: 'Add barcode',
  resolveStock: 'Resolve stock',
  confirmInbound: 'Confirm inbound',
  submit: 'Submit',
  cancel: 'Cancel',
  qty: 'Qty',
  loading: 'Loading…',
  emptyList: 'No receive bills',
  emptyEntries: 'No entries; confirm the bill is approved',
}

/** Locale keys owned by this plugin. */
export type CustomWorkbenchKey = keyof typeof zh
