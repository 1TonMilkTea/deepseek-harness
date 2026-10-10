/** Browser-safe request, result, and error vocabulary for the pgyLogin Remote namespace. */

import type {} from '@deepseek-ai/dsh-typert-protocol'

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface RemoteErrorDetailsMap {
    /** The configured MCP tool failed or returned an unusable payload. */
    'pgy/login-failed': { readonly tool: string }
    /** A WMS login is required before Session create, fork, prompt, list, or search. */
    'pgy/login-required': {}
    /** This Host process is already scoped to a different employee; sign out first. */
    'pgy/employee-switch-requires-restart': { readonly currentKey: string; readonly requestedKey: string }
    /** No RuoYi Base URL is configured yet; the UI should show the backend form. */
    'pgy/backend-required': {}
    /** Issuing a session token or remounting MCP failed. */
    'pgy/backend-connect-failed': { readonly reason: string }
  }
}

/** Snapshot of the configured RuoYi Base URL and MCP readiness. */
export interface PgyBackendConfig {
  /** Normalized root URL, or empty when not configured. */
  readonly baseUrl: string
  /** True when a page-saved or env Base URL is present (not the hard-coded default alone). */
  readonly configured: boolean
  /** True after a session token was issued and the MCP client fiber is mounted. */
  readonly mcpReady: boolean
}

/** Request body for saving the RuoYi Base URL from the UI. */
export interface PgyBackendConfigRequest {
  readonly baseUrl: string
}

/** One organization row returned by `pgyListOrganizations`. */
export interface PgyOrganization {
  readonly id: number
  readonly name: string
  readonly number: string
}

/** Organization list shown on the Web login page. */
export interface PgyOrganizationList {
  readonly organizations: readonly PgyOrganization[]
}

/** Employee WMS credentials collected by the Web login page. */
export interface PgyWmsLoginRequest {
  readonly orgId: number
  readonly staffNumber: string
  readonly wmsPassword: string
}

/** Employee identity retained after a successful WMS login. */
export interface PgyEmployee {
  readonly empinfoId: string
  readonly staffNumber: string
  readonly name: string
  readonly orgId: string
  readonly orgName: string
  readonly userId: string
}

/** Receipt after a successful WMS login. */
export interface PgyWmsLoginValue {
  readonly employee: PgyEmployee
}

/** Process-local login gate snapshot. */
export interface PgyLoginStatus {
  readonly loggedIn: boolean
  /** Present after a successful `wmsLogin` in this process. */
  readonly employee?: PgyEmployee
}
