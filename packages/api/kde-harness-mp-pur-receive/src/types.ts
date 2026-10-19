/** Browser-safe request and result vocabulary for the kdeHarnessMpPurReceive Remote. */

import type { JsonValue } from '@deepseek-ai/dsh-util-values'
import type {} from '@deepseek-ai/dsh-typert-protocol'

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface RemoteErrorDetailsMap {
    /** Harness platform login is required before purchase-inbound MCP calls. */
    'kde-harness-mp/pur-receive-login-required': {}
    /** The configured MCP tool failed or returned an unusable payload. */
    'kde-harness-mp/pur-receive-failed': { readonly tool: string }
    /** A required field was missing or invalid. */
    'kde-harness-mp/pur-receive-invalid': { readonly field: string }
  }
}

/** Opaque JSON object forwarded from a RuoYi MCP tool. */
export type KdeHarnessMpMcpObject = { readonly [key: string]: JsonValue }

/** List receive bills request (maps to `kdeListReceiveBills`). */
export interface KdeHarnessMpListBillsRequest {
  readonly filterString?: string
  readonly orderString?: string
  readonly limit?: number
  readonly startRow?: number
  readonly topRowCount?: number
  readonly fieldKeys?: string
}

/** View bill request (maps to `kdeViewBill`). */
export interface KdeHarnessMpViewBillRequest {
  readonly formId: string
  readonly id: number
}

/** Entity-output list request (maps to `kdeGetPurReceiveEntityOutputs`). */
export interface KdeHarnessMpEntityOutputsRequest {
  readonly orgId?: number
  readonly id?: number
  readonly billNo?: string
  readonly inStockType?: string
  readonly idList?: string
  readonly entryIdList?: string
  readonly billNoList?: string
}

/** Barcode lookup request (maps to `kdeGetBarcodeByNumber`). */
export interface KdeHarnessMpGetBarcodeRequest {
  /** Organization id; defaults to the logged-in employee's org when omitted. */
  readonly orgId?: number
  readonly barcode: string
}

/** Stock/location lookup request (maps to `kdeGetStockInfoByNumber`). */
export interface KdeHarnessMpGetStockInfoRequest {
  /** Organization id; defaults to the logged-in employee's org when omitted. */
  readonly orgId?: number
  readonly number: string
}

/** Submit STK inbound report (maps to `kdeSubmitStkInStockRecordReport`). */
export interface KdeHarnessMpSubmitReportRequest {
  /** Complete `STKInStockRecordInput` as a JSON string. */
  readonly inputJson: string
}
