/** Browser-safe request and result vocabulary for the pgyPurReceive Remote. */

import type { JsonValue } from '@deepseek-ai/dsh-util-values'
import type {} from '@deepseek-ai/dsh-typert-protocol'

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface RemoteErrorDetailsMap {
    /** WMS login is required before purchase-inbound MCP calls. */
    'pgy/pur-receive-login-required': {}
    /** The configured MCP tool failed or returned an unusable payload. */
    'pgy/pur-receive-failed': { readonly tool: string }
    /** A required field was missing or invalid. */
    'pgy/pur-receive-invalid': { readonly field: string }
  }
}

/** Opaque JSON object forwarded from a RuoYi MCP tool. */
export type PgyMcpObject = { readonly [key: string]: JsonValue }

/** List receive bills request (maps to `pgyListReceiveBills`). */
export interface PgyListBillsRequest {
  readonly filterString?: string
  readonly orderString?: string
  readonly limit?: number
  readonly startRow?: number
  readonly topRowCount?: number
  readonly fieldKeys?: string
}

/** View bill request (maps to `pgyKdeViewBill`). */
export interface PgyViewBillRequest {
  readonly formId: string
  readonly id: number
}

/** Entity-output list request (maps to `pgyGetPurReceiveEntityOutputs`). */
export interface PgyEntityOutputsRequest {
  readonly orgId?: number
  readonly id?: number
  readonly billNo?: string
  readonly inStockType?: string
  readonly idList?: string
  readonly entryIdList?: string
  readonly billNoList?: string
}

/** Barcode lookup request (maps to `pgyGetBarcodeByNumber`). */
export interface PgyGetBarcodeRequest {
  /** Organization id; defaults to the logged-in employee's org when omitted. */
  readonly orgId?: number
  readonly barcode: string
}

/** Stock/location lookup request (maps to `pgyGetStockInfoByNumber`). */
export interface PgyGetStockInfoRequest {
  /** Organization id; defaults to the logged-in employee's org when omitted. */
  readonly orgId?: number
  readonly number: string
}

/** Submit STK inbound report (maps to `pgySubmitStkInStockRecordReport`). */
export interface PgySubmitReportRequest {
  /** Complete `STKInStockRecordInput` as a JSON string. */
  readonly inputJson: string
}
