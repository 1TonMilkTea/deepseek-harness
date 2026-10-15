/** Result vocabulary mirrored from Typert RemoteResult without importing Cordis. */
export type BridgeResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: { readonly message: string } }

/** Localized copy the React host resolves and passes into the login island. */
export interface LoginLabels {
  readonly title: string
  readonly subtitle: string
  readonly org: string
  readonly orgPlaceholder: string
  readonly staffNumber: string
  readonly staffNumberPlaceholder: string
  readonly password: string
  readonly passwordPlaceholder: string
  readonly submit: string
  readonly loading: string
  readonly backendTitle: string
  readonly backendSubtitle: string
  readonly backendUrl: string
  readonly backendUrlPlaceholder: string
  readonly backendSubmit: string
  readonly editBackend: string
}

/** One organization row for the login select. */
export interface LoginOrganization {
  readonly id: number
  readonly name: string
  readonly number: string
}

/** Backend URL snapshot used by the login gate. */
export interface LoginBackendConfig {
  readonly baseUrl: string
  readonly configured: boolean
  readonly mcpReady?: boolean
}

/** Callbacks the React shell injects; Vue never reaches Cordis. */
export interface LoginBridge {
  readonly labels: LoginLabels
  status(): Promise<BridgeResult<{ readonly loggedIn: boolean }>>
  getBackendConfig(): Promise<BridgeResult<LoginBackendConfig>>
  setBackendConfig(request: { readonly baseUrl: string }): Promise<BridgeResult<LoginBackendConfig>>
  listOrganizations(): Promise<BridgeResult<{ readonly organizations: readonly LoginOrganization[] }>>
  wmsLogin(request: {
    readonly orgId: number
    readonly staffNumber: string
    readonly wmsPassword: string
  }): Promise<BridgeResult<unknown>>
  refreshSessions(): Promise<void>
  /** Tell the React host to tear down the fullscreen portal. */
  onLoggedIn(): void
}

/** Localized copy for the custom workbench shell and purchase-inbound pages. */
export interface CustomWorkbenchLabels {
  readonly title: string
  readonly menuPurchase: string
  readonly menuPurReceive: string
  readonly billNo: string
  readonly billNoPlaceholder: string
  readonly query: string
  readonly open: string
  readonly back: string
  readonly barcode: string
  readonly barcodePlaceholder: string
  readonly stockCode: string
  readonly stockCodePlaceholder: string
  readonly addBarcode: string
  readonly resolveStock: string
  readonly confirmInbound: string
  readonly submit: string
  readonly cancel: string
  readonly qty: string
  readonly loading: string
  readonly emptyList: string
  readonly emptyEntries: string
}

/** JSON-scalar cell used in list rows and form fields. */
export type CustomWorkbenchPrimitive = string | number | boolean | null

/** One flat row or form field map published to the Host snapshot store. */
export type CustomWorkbenchRow = Readonly<Record<string, CustomWorkbenchPrimitive>>

/** Structured view the Vue island publishes for model-visible context. */
export interface CustomWorkbenchSnapshot {
  readonly kind: 'empty' | 'list' | 'form'
  readonly title: string
  readonly rows: readonly CustomWorkbenchRow[]
  readonly form?: CustomWorkbenchRow
}

/** Logged-in employee identity needed to assemble STK submit input. */
export interface WorkbenchEmployee {
  readonly empinfoId: string
  readonly staffNumber: string
  readonly name: string
  readonly orgId: string
  readonly orgName: string
  readonly userId: string
}

/** Opaque JSON object from a purchase-inbound MCP/Remote call. */
export type WorkbenchMcpObject = { readonly [key: string]: unknown }

/** Callbacks the React shell injects; Vue never reaches Cordis or Kingdee. */
export interface CustomWorkbenchBridge {
  readonly labels: CustomWorkbenchLabels
  publishSnapshot(snapshot: CustomWorkbenchSnapshot): Promise<BridgeResult<{ readonly hash: string; readonly updatedAt: number }>>
  clearSnapshot(): Promise<BridgeResult<void>>
  getEmployee(): Promise<BridgeResult<WorkbenchEmployee | null>>
  listBills(request: {
    readonly filterString?: string
    readonly limit?: number
    readonly startRow?: number
  }): Promise<BridgeResult<WorkbenchMcpObject>>
  viewBill(request: {
    readonly formId: string
    readonly id: number
  }): Promise<BridgeResult<WorkbenchMcpObject>>
  entityOutputs(request: {
    readonly orgId?: number
    readonly id?: number
    readonly billNo?: string
  }): Promise<BridgeResult<WorkbenchMcpObject>>
  getBarcode(request: {
    readonly orgId?: number
    readonly barcode: string
  }): Promise<BridgeResult<WorkbenchMcpObject>>
  getStockInfo(request: {
    readonly orgId?: number
    readonly number: string
  }): Promise<BridgeResult<WorkbenchMcpObject>>
  submitReport(request: {
    readonly inputJson: string
  }): Promise<BridgeResult<WorkbenchMcpObject>>
}

/** Injection key string used by both mount helpers and Vue `inject`. */
export declare const BRIDGE_KEY: '1tmtBridge'

/**
 * Mount the Element Plus login gate into `el`.
 * @param el - host element owned by the React portal
 * @param bridge - Remote callbacks and localized labels
 */
export declare function mountLogin(el: HTMLElement, bridge: LoginBridge): void

/**
 * Tear down a login island previously mounted on `el`.
 * @param el - host element
 */
export declare function unmountLogin(el: HTMLElement): void

/**
 * Mount the custom workbench into `el`.
 * @param el - host element owned by the React main panel
 * @param bridge - localized labels and purchase-inbound Remote callbacks
 */
export declare function mountCustomWorkbench(el: HTMLElement, bridge: CustomWorkbenchBridge): void

/**
 * Tear down a custom-workbench island previously mounted on `el`.
 * @param el - host element
 */
export declare function unmountCustomWorkbench(el: HTMLElement): void
