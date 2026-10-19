/** Browser-safe request, result, and error vocabulary for the kdeHarnessMpLogin Remote namespace. */

import type {} from '@deepseek-ai/dsh-typert-protocol'

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface RemoteErrorDetailsMap {
    /** The configured MCP tool failed or returned an unusable payload. */
    'kde-harness-mp/login-failed': { readonly tool: string }
    /** A Harness platform login is required before Session create, fork, prompt, list, or search. */
    'kde-harness-mp/login-required': {}
    /** This Host process is already scoped to a different employee; sign out first. */
    'kde-harness-mp/employee-switch-requires-restart': { readonly currentKey: string; readonly requestedKey: string }
    /** No RuoYi Base URL is configured yet; the UI should show the backend form. */
    'kde-harness-mp/backend-required': {}
    /** Issuing a session token or remounting MCP failed. */
    'kde-harness-mp/backend-connect-failed': { readonly reason: string }
  }
}

/** Snapshot of the configured RuoYi Base URL and MCP readiness. */
export interface KdeHarnessMpBackendConfig {
  /** Normalized root URL, or empty when not configured. */
  readonly baseUrl: string
  /** True when a page-saved or env Base URL is present (not the hard-coded default alone). */
  readonly configured: boolean
  /** True after a session token was issued and the MCP client fiber is mounted. */
  readonly mcpReady: boolean
}

/** Request body for saving the RuoYi Base URL from the UI. */
export interface KdeHarnessMpBackendConfigRequest {
  readonly baseUrl: string
}

/** One organization row returned by `kdeListOrganizations`. */
export interface KdeHarnessMpOrganization {
  readonly id: number
  readonly name: string
  readonly number: string
}

/** Organization list shown on the Web login page. */
export interface KdeHarnessMpOrganizationList {
  readonly organizations: readonly KdeHarnessMpOrganization[]
}

/** Employee login credentials collected by the Web login page. */
export interface KdeHarnessMpLoginRequest {
  readonly orgId: number
  readonly staffNumber: string
  readonly password: string
}

/** Employee identity retained after a successful Harness platform login. */
export interface KdeHarnessMpEmployee {
  readonly empinfoId: string
  readonly staffNumber: string
  readonly name: string
  readonly orgId: string
  readonly orgName: string
  readonly userId: string
}

/** Receipt after a successful Harness platform login. */
export interface KdeHarnessMpLoginValue {
  readonly employee: KdeHarnessMpEmployee
}

/** Process-local login gate snapshot. */
export interface KdeHarnessMpLoginStatus {
  readonly loggedIn: boolean
  /** Present after a successful `harnessLogin` in this process. */
  readonly employee?: KdeHarnessMpEmployee
}
