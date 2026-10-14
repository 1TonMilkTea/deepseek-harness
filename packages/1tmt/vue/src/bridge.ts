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
}

/** Optional callbacks for the custom panel island (empty in the first cut). */
export interface CustomBridge {
  readonly labels: CustomLabels
}

/** Injection key string used by both mount helpers and Vue `inject`. */
export const BRIDGE_KEY = '1tmtBridge'
