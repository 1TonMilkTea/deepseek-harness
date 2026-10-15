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

/** Localized copy for the custom half-panel placeholder. */
export interface CustomLabels {
  readonly title: string
  readonly intro: string
  readonly republish: string
}

/** JSON-scalar cell used in list rows and form fields. */
export type CustomPanelPrimitive = string | number | boolean | null

/** One flat row or form field map published to the Host snapshot store. */
export type CustomPanelRow = Readonly<Record<string, CustomPanelPrimitive>>

/** Structured view the Vue island publishes for model-visible context. */
export interface CustomPanelSnapshot {
  readonly kind: 'empty' | 'list' | 'form'
  readonly title: string
  readonly rows: readonly CustomPanelRow[]
  readonly form?: CustomPanelRow
}

/** Callbacks the React shell injects; Vue never reaches Cordis. */
export interface CustomBridge {
  readonly labels: CustomLabels
  publishSnapshot(snapshot: CustomPanelSnapshot): Promise<BridgeResult<{ readonly hash: string; readonly updatedAt: number }>>
  clearSnapshot(): Promise<BridgeResult<void>>
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
 * Mount the custom half-panel into `el`.
 * @param el - host element owned by the React main panel
 * @param bridge - localized labels and snapshot publish callbacks
 */
export declare function mountCustomPanel(el: HTMLElement, bridge: CustomBridge): void

/**
 * Tear down a custom-panel island previously mounted on `el`.
 * @param el - host element
 */
export declare function unmountCustomPanel(el: HTMLElement): void
