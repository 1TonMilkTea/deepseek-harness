import { describe, expect, it } from 'vitest'
import {
  buildStkInStockRecordReportInput,
  findEntryIndexForBarcode,
  mapEntityRows,
  pickK3RefId,
} from '../src/apps/custom-workbench/stk-input.ts'

describe('stk-input helpers', () => {
  it('pickK3RefId reads nested Id objects', () => {
    expect(pickK3RefId({ Id: '12' })).toBe(12)
    expect(pickK3RefId(0)).toBe(0)
  })

  it('maps entity rows and matches barcodes by bill+entry', () => {
    const entries = mapEntityRows([
      {
        Id: 101,
        Seq: 1,
        MaterialID: { Id: 9, Number: 'M1', Name: '物料1' },
        FActReceiveQty: 10,
        StockID: { Id: 2, Name: '仓A' },
        StockLocId: { Id: 3, Name: '位1' },
        UnitId: 7,
      },
    ])
    expect(entries).toHaveLength(1)
    expect(entries[0]?.MaterialNumber).toBe('M1')
    expect(findEntryIndexForBarcode(55, entries, {
      ReceiveBillId: 55,
      ReceiveBillEntryId: 101,
    })).toBe(0)
    expect(findEntryIndexForBarcode(55, entries, {
      ReceiveBillId: 55,
      ReceiveBillEntryId: 999,
    })).toBe(-1)
  })

  it('builds STK report input with one barcode line', () => {
    const entries = mapEntityRows([{
      Id: 101,
      Seq: 1,
      MaterialID: { Id: 9, Number: 'M1', Name: '物料1' },
      FActReceiveQty: 10,
      StockID: { Id: 2 },
      StockLocId: { Id: 3 },
      UnitId: 7,
      SrcFormId: 'PUR_PurchaseOrder',
      SrcBillNo: 'PO1',
      SrcId: 80,
      SrcEntryId: 81,
      SrcEntrySeq: 1,
    }])
    entries[0]!.barcodes.push({
      FBarcode: 'BC1',
      FQty: 2,
      __raw: { Id: 500, ReceiveBillId: 55, ReceiveBillEntryId: 101 },
    })
    const input = buildStkInStockRecordReportInput(
      { Id: 55, BillNo: 'RCV1', StockOrgId: { Id: 100 } },
      entries,
      { orgId: 100, operatorId: 8 },
    )
    expect(input.OrgId).toBe(100)
    expect(input.OperatorId).toBe(8)
    expect(Array.isArray(input.BarcodeDataList)).toBe(true)
    expect((input.BarcodeDataList as unknown[]).length).toBe(1)
    const line = (input.BarcodeDataList as Array<Record<string, unknown>>)[0]!
    expect(line.BarcodeNumber).toBe('BC1')
    expect(line.Qty).toBe(2)
    expect(line.ReceiveBillEntryId).toBe(101)
  })
})
