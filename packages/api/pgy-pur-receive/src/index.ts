/**
 * Host Remote for purchase inbound. Every method is a thin `tools.execute` of a
 * RuoYi MCP tool; this package never opens a Kingdee HTTP client.
 *
 * @module @deepseek-ai/dsh-api-pgy-pur-receive
 */

import { randomUUID } from 'node:crypto'
import { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { ToolCallId } from '@deepseek-ai/dsh-llm'
import type {} from '@deepseek-ai/dsh-api-pgy-login'
import type {} from '@deepseek-ai/dsh-tools'
import { Remote, RemoteError, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type { JsonValue } from '@deepseek-ai/dsh-util-values'
import type {
  PgyEntityOutputsRequest,
  PgyGetBarcodeRequest,
  PgyGetStockInfoRequest,
  PgyListBillsRequest,
  PgyMcpObject,
  PgySubmitReportRequest,
  PgyViewBillRequest,
} from './types.ts'

export type * from './types.ts'

/** MCP public tool names this controller executes. */
export interface Config {
  /** `mcp__<server>__pgyListReceiveBills`. */
  listBillsTool: string
  /** `mcp__<server>__pgyKdeViewBill`. */
  viewBillTool: string
  /** `mcp__<server>__pgyGetPurReceiveEntityOutputs`. */
  entityOutputsTool: string
  /** `mcp__<server>__pgyGetBarcodeByNumber`. */
  getBarcodeTool: string
  /** `mcp__<server>__pgyGetStockInfoByNumber`. */
  getStockInfoTool: string
  /** `mcp__<server>__pgySubmitStkInStockRecordReport`. */
  submitReportTool: string
}

/** Schemastery configuration for the purchase-inbound Remote. */
export const Config: z<Config> = z.object({
  listBillsTool: z.string(),
  viewBillTool: z.string(),
  entityOutputsTool: z.string(),
  getBarcodeTool: z.string(),
  getStockInfoTool: z.string(),
  submitReportTool: z.string(),
})

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Host purchase-inbound Remote namespace owner. */
    pgyPurReceive: PgyPurReceiveController
  }
}

/** Host service backing the generated `ctx.remote.pgyPurReceive` namespace. */
export class PgyPurReceiveController extends TypertRemoteService {
  static inject = ['typert', 'tools', 'pgyLogin']

  static Config = Config

  private readonly config: Config

  /**
   * @param ctx - Host context carrying tools and the WMS login gate.
   * @param config - MCP public tool names for each purchase-inbound step.
   */
  constructor(ctx: Context, config: Config) {
    super(ctx, 'pgyPurReceive', { namespace: 'pgyPurReceive' })
    this.config = config
  }

  /**
   * List receive bills through `pgyListReceiveBills`.
   * @param request - optional filter / paging overrides.
   * @param signal - caller lifetime.
   * @returns MCP payload (rows, fieldKeys, …).
   */
  @Remote('listBills')
  async listBills(request: PgyListBillsRequest, signal: AbortSignal): Promise<PgyMcpObject> {
    this.requireLogin()
    return this.callTool(this.config.listBillsTool, {
      ...(request.filterString === undefined ? {} : { filterString: request.filterString }),
      ...(request.orderString === undefined ? {} : { orderString: request.orderString }),
      ...(request.limit === undefined ? {} : { limit: request.limit }),
      ...(request.startRow === undefined ? {} : { startRow: request.startRow }),
      ...(request.topRowCount === undefined ? {} : { topRowCount: request.topRowCount }),
      ...(request.fieldKeys === undefined ? {} : { fieldKeys: request.fieldKeys }),
    }, signal)
  }

  /**
   * View a bill through `pgyKdeViewBill`.
   * @param request - formId and bill id.
   * @param signal - caller lifetime.
   * @returns MCP payload including the View response.
   */
  @Remote('viewBill')
  async viewBill(request: PgyViewBillRequest, signal: AbortSignal): Promise<PgyMcpObject> {
    this.requireLogin()
    if (request.formId.trim() === '') {
      throw new RemoteError('pgy/pur-receive-invalid', 'formId is required', { field: 'formId' })
    }
    if (!Number.isFinite(request.id) || request.id <= 0) {
      throw new RemoteError('pgy/pur-receive-invalid', 'id must be a positive number', { field: 'id' })
    }
    return this.callTool(this.config.viewBillTool, {
      formId: request.formId.trim(),
      id: request.id,
    }, signal)
  }

  /**
   * Load receive-bill entity outputs through `pgyGetPurReceiveEntityOutputs`.
   * @param request - org / id / billNo / entry filters.
   * @param signal - caller lifetime.
   * @returns MCP payload with `rows`.
   */
  @Remote('entityOutputs')
  async entityOutputs(request: PgyEntityOutputsRequest, signal: AbortSignal): Promise<PgyMcpObject> {
    this.requireLogin()
    const orgId = request.orgId ?? this.employeeOrgId()
    return this.callTool(this.config.entityOutputsTool, {
      ...(orgId === undefined ? {} : { orgId }),
      ...(request.id === undefined ? {} : { id: request.id }),
      ...(request.billNo === undefined ? {} : { billNo: request.billNo }),
      ...(request.inStockType === undefined ? {} : { inStockType: request.inStockType }),
      ...(request.idList === undefined ? {} : { idList: request.idList }),
      ...(request.entryIdList === undefined ? {} : { entryIdList: request.entryIdList }),
      ...(request.billNoList === undefined ? {} : { billNoList: request.billNoList }),
    }, signal)
  }

  /**
   * Look up one barcode through `pgyGetBarcodeByNumber`.
   * @param request - barcode and optional orgId.
   * @param signal - caller lifetime.
   * @returns MCP payload with `doc`.
   */
  @Remote('getBarcode')
  async getBarcode(request: PgyGetBarcodeRequest, signal: AbortSignal): Promise<PgyMcpObject> {
    this.requireLogin()
    const barcode = request.barcode.trim()
    if (barcode === '') {
      throw new RemoteError('pgy/pur-receive-invalid', 'barcode is required', { field: 'barcode' })
    }
    const orgId = request.orgId ?? this.employeeOrgId()
    if (orgId === undefined) {
      throw new RemoteError('pgy/pur-receive-invalid', 'orgId is required', { field: 'orgId' })
    }
    return this.callTool(this.config.getBarcodeTool, { orgId, barcode }, signal)
  }

  /**
   * Look up stock or stock-location by number through `pgyGetStockInfoByNumber`.
   * @param request - code and optional orgId.
   * @param signal - caller lifetime.
   * @returns MCP payload with stock/location data.
   */
  @Remote('getStockInfo')
  async getStockInfo(request: PgyGetStockInfoRequest, signal: AbortSignal): Promise<PgyMcpObject> {
    this.requireLogin()
    const number = request.number.trim()
    if (number === '') {
      throw new RemoteError('pgy/pur-receive-invalid', 'number is required', { field: 'number' })
    }
    const orgId = request.orgId ?? this.employeeOrgId()
    if (orgId === undefined) {
      throw new RemoteError('pgy/pur-receive-invalid', 'orgId is required', { field: 'orgId' })
    }
    return this.callTool(this.config.getStockInfoTool, { orgId, number }, signal)
  }

  /**
   * Submit a fully assembled STK inbound report through `pgySubmitStkInStockRecordReport`.
   * @param request - complete input JSON string (assembled by the Vue island).
   * @param signal - caller lifetime.
   * @returns MCP payload with success / pkId / message.
   */
  @Remote('submitReport')
  async submitReport(request: PgySubmitReportRequest, signal: AbortSignal): Promise<PgyMcpObject> {
    this.requireLogin()
    const inputJson = request.inputJson.trim()
    if (inputJson === '') {
      throw new RemoteError('pgy/pur-receive-invalid', 'inputJson is required', { field: 'inputJson' })
    }
    return this.callTool(this.config.submitReportTool, { inputJson }, signal)
  }

  private requireLogin(): void {
    if (!this.ctx.pgyLogin.isLoggedIn()) {
      throw new RemoteError('pgy/pur-receive-login-required', 'WMS login is required', {})
    }
  }

  private employeeOrgId(): number | undefined {
    const status = this.ctx.pgyLogin.status()
    const raw = status.employee?.orgId
    if (raw === undefined || raw === '') return undefined
    const orgId = Number(raw)
    return Number.isFinite(orgId) && orgId > 0 ? orgId : undefined
  }

  private async callTool(
    tool: string,
    args: Record<string, unknown>,
    signal: AbortSignal,
  ): Promise<PgyMcpObject> {
    const result = await this.ctx.tools.execute({
      callId: ToolCallId(`pgy-pur-receive-${randomUUID()}`),
      name: tool,
      arguments: args,
      signal,
    })
    if (result.isError) {
      throw new RemoteError('pgy/pur-receive-failed', result.error.message, { tool })
    }
    return asMcpObject(unwrapToolPayload(result.value, tool), tool)
  }
}

export default PgyPurReceiveController

function unwrapToolPayload(value: JsonValue, tool: string): Record<string, unknown> {
  const object = asObject(value, tool)
  if (hasBusinessFields(object)) return object
  if (object.structuredContent !== undefined) {
    const structured = asObject(object.structuredContent as JsonValue, tool)
    if (hasBusinessFields(structured)) return structured
  }
  const text = mcpText(object)
  return text === undefined ? object : asObject(text, tool)
}

function hasBusinessFields(object: Record<string, unknown>): boolean {
  return Object.hasOwn(object, 'status')
    || Object.hasOwn(object, 'rows')
    || Object.hasOwn(object, 'success')
    || Object.hasOwn(object, 'doc')
    || Object.hasOwn(object, 'data')
    || Object.hasOwn(object, 'pkId')
}

function mcpText(object: Record<string, unknown>): string | undefined {
  const content = object.content
  if (!Array.isArray(content)) return undefined
  const parts: string[] = []
  for (const block of content) {
    if (block === null || typeof block !== 'object' || Array.isArray(block)) continue
    const text = (block as Record<string, unknown>).text
    if (typeof text === 'string' && text !== '') parts.push(text)
  }
  return parts.length === 0 ? undefined : parts.join('\n')
}

function asObject(value: JsonValue | string, tool: string): Record<string, unknown> {
  const candidate: unknown = typeof value === 'string' ? parseJson(value, tool) : value
  if (candidate !== null && typeof candidate === 'object' && !Array.isArray(candidate)) {
    return candidate as Record<string, unknown>
  }
  throw new RemoteError('pgy/pur-receive-failed', 'MCP tool result is not a JSON object', { tool })
}

function parseJson(text: string, tool: string): unknown {
  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new RemoteError('pgy/pur-receive-failed', 'MCP tool result is not JSON', { tool })
  }
}

function asMcpObject(payload: Record<string, unknown>, tool: string): PgyMcpObject {
  try {
    return JSON.parse(JSON.stringify(payload)) as PgyMcpObject
  } catch {
    throw new RemoteError('pgy/pur-receive-failed', 'MCP tool result is not JSON-serializable', { tool })
  }
}
