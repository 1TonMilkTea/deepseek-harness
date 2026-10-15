import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { RemoteError, remoteErrorOf } from '@deepseek-ai/dsh-typert-protocol'
import PgyPurReceiveController from '../src/index.ts'

const TOOLS = {
  listBillsTool: 'mcp__1tmt__pgyListReceiveBills',
  viewBillTool: 'mcp__1tmt__pgyKdeViewBill',
  entityOutputsTool: 'mcp__1tmt__pgyGetPurReceiveEntityOutputs',
  getBarcodeTool: 'mcp__1tmt__pgyGetBarcodeByNumber',
  getStockInfoTool: 'mcp__1tmt__pgyGetStockInfoByNumber',
  submitReportTool: 'mcp__1tmt__pgySubmitStkInStockRecordReport',
} as const

function harness(options: {
  loggedIn?: boolean
  orgId?: string
  execute?: ReturnType<typeof vi.fn>
}): PgyPurReceiveController {
  const execute = options.execute ?? vi.fn(async () => ({
    isError: false as const,
    value: { status: 'ok', rows: [] },
  }))
  const ctx = new Context()
  ctx.provide('typert', {
    lookups: { configure: () => () => {} },
    contexts: { configureHost: () => () => {} },
  } as never)
  ctx.provide('tools', { execute } as never)
  ctx.provide('pgyLogin', {
    isLoggedIn: () => options.loggedIn !== false,
    status: () => options.loggedIn === false
      ? { loggedIn: false }
      : { loggedIn: true, employee: { orgId: options.orgId ?? '100001', empinfoId: '1', staffNumber: 'E1', name: 'n', orgName: 'o', userId: 'u' } },
  } as never)
  return new PgyPurReceiveController(ctx, { ...TOOLS })
}

describe('PgyPurReceiveController', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('refuses calls before WMS login', async () => {
    const controller = harness({ loggedIn: false })
    const failure = await controller.listBills({}, AbortSignal.timeout(1000)).catch((error: unknown) => error)
    expect(remoteErrorOf(failure)).toMatchObject({ code: 'pgy/pur-receive-login-required' })
  })

  it('listBills forwards filterString to the MCP tool', async () => {
    const execute = vi.fn(async () => ({
      isError: false as const,
      value: { status: 'ok', rows: [{ FBillNo: 'R1' }], count: 1 },
    }))
    const controller = harness({ execute })
    const result = await controller.listBills({ filterString: "FBillNo='R1'" }, AbortSignal.timeout(1000))
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({
      name: TOOLS.listBillsTool,
      arguments: { filterString: "FBillNo='R1'" },
    }))
    expect(result).toMatchObject({ status: 'ok', count: 1 })
  })

  it('getBarcode defaults orgId from the logged-in employee', async () => {
    const execute = vi.fn(async () => ({
      isError: false as const,
      value: { status: 'ok', success: true, barcode: 'BC1', doc: { FNumber: 'BC1' } },
    }))
    const controller = harness({ execute, orgId: '200002' })
    await controller.getBarcode({ barcode: 'BC1' }, AbortSignal.timeout(1000))
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({
      name: TOOLS.getBarcodeTool,
      arguments: { orgId: 200002, barcode: 'BC1' },
    }))
  })

  it('submitReport rejects an empty inputJson', async () => {
    const controller = harness({})
    const failure = await controller.submitReport({ inputJson: '  ' }, AbortSignal.timeout(1000))
      .catch((error: unknown) => error)
    expect(failure).toBeInstanceOf(RemoteError)
    expect(remoteErrorOf(failure)).toMatchObject({
      code: 'pgy/pur-receive-invalid',
      details: { field: 'inputJson' },
    })
  })

  it('surfaces MCP tool errors as pgy/pur-receive-failed', async () => {
    const execute = vi.fn(async () => ({
      isError: true as const,
      error: { message: 'session lost' },
    }))
    const controller = harness({ execute })
    const failure = await controller.viewBill({ formId: 'PUR_ReceiveBill', id: 1 }, AbortSignal.timeout(1000))
      .catch((error: unknown) => error)
    expect(remoteErrorOf(failure)).toMatchObject({
      code: 'pgy/pur-receive-failed',
      details: { tool: TOOLS.viewBillTool },
    })
  })
})
