/** Host Remote owner: backend Base URL, MCP session token, and WMS login. */

import { randomUUID } from 'node:crypto'
import { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import * as McpClient from '@deepseek-ai/dsh-mcp-client'
import { ToolCallId } from '@deepseek-ai/dsh-llm'
import type {} from '@deepseek-ai/dsh-session-persistence'
import type {} from '@deepseek-ai/dsh-tools'
import { Remote, RemoteError, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type { JsonValue } from '@deepseek-ai/dsh-util-values'
import {
  mcpEndpoint,
  normalizeBaseUrl,
  readStoredBackendConfig,
  resolveBackendBaseUrl,
  writeStoredBackendConfig,
} from './backend-config.ts'
import {
  employeeScopeKey, employeeSessionRoot, migrateLegacySessionsOnce,
} from './employee-scope.ts'
import { issueClientSession, revokeClientSession } from './session-client.ts'
import type {
  PgyBackendConfig,
  PgyEmployee,
  PgyLoginStatus,
  PgyOrganization,
  PgyOrganizationList,
  PgyBackendConfigRequest,
  PgyWmsLoginRequest,
  PgyWmsLoginValue,
} from './types.ts'

export type * from './types.ts'
export {
  employeeScopeKey, employeeSessionRoot, migrateLegacySessionsOnce,
  PGY_EMPLOYEE_SCOPE_MARKER, PGY_EMPLOYEE_SESSIONS_DIR,
} from './employee-scope.ts'
export {
  BACKEND_CONFIG_FILE,
  DEFAULT_BACKEND_BASE_URL,
  backendConfigPath,
  clientSessionsEndpoint,
  mcpEndpoint,
  normalizeBaseUrl,
  readStoredBackendConfig,
  resolveBackendBaseUrl,
  writeStoredBackendConfig,
} from './backend-config.ts'
export { issueClientSession, revokeClientSession } from './session-client.ts'

/** MCP tool names this controller executes for the Web login page. */
export interface Config {
  /** Public tool name for `pgyListOrganizations` (`mcp__<serverName>__pgyListOrganizations`). */
  listOrganizationsTool: string
  /** Public tool name for `pgyWmsLogin` (`mcp__<serverName>__pgyWmsLogin`). */
  wmsLoginTool: string
  /** Value sent as `clientName` when issuing a session token. */
  clientName?: string
  /** MCP `serverName` namespace for the dynamically mounted client. */
  mcpServerName?: string
}

/** Schemastery configuration for the login Remote. */
export const Config: z<Config> = z.object({
  listOrganizationsTool: z.string(),
  wmsLoginTool: z.string(),
  clientName: z.string().default('harness-desktop'),
  mcpServerName: z.string().default('1tmt'),
})

interface ResolvedConfig {
  readonly listOrganizationsTool: string
  readonly wmsLoginTool: string
  readonly clientName: string
  readonly mcpServerName: string
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Host WMS login Remote namespace owner and Session create/prompt gate. */
    pgyLogin: PgyLoginController
  }
}

type McpFiber = {
  dispose(): Promise<void>
}

/** Host service backing the generated `ctx.remote.pgyLogin` namespace. */
export class PgyLoginController extends TypertRemoteService {
  static inject = ['typert', 'tools', 'sessionPersistence']

  static Config = Config

  private loggedIn = false
  private employee: PgyEmployee | undefined
  private baseUrl: string | undefined
  private clientId: string | undefined
  private sessionToken: string | undefined
  private mcpFiber: McpFiber | undefined
  private readonly boot: Promise<void>
  private tearingDown = false
  private readonly config: ResolvedConfig
  private readonly onProcessSignal = (): void => {
    void this.teardownSession('signal')
  }

  /**
   * @param ctx - Host context carrying tools, persistence, and Typert Gateway.
   * @param config - MCP public tool names for organization listing and WMS login.
   */
  constructor(ctx: Context, config: Config) {
    super(ctx, 'pgyLogin', { namespace: 'pgyLogin' })
    this.config = {
      listOrganizationsTool: config.listOrganizationsTool,
      wmsLoginTool: config.wmsLoginTool,
      clientName: config.clientName ?? 'harness-desktop',
      mcpServerName: config.mcpServerName ?? '1tmt',
    }
    this.boot = this.bootstrap().catch((error) => {
      this.ctx.logger.warn(`pgy-login backend bootstrap: ${String(error)}`)
    })
    // Vitest creates many controller instances in one process; skip process
    // signals there and rely on fiber dispose / explicit revoke instead.
    if (process.env.VITEST === undefined) {
      process.on('SIGINT', this.onProcessSignal)
      process.on('SIGTERM', this.onProcessSignal)
    }
    ctx.effect(() => () => {
      this.detachProcessSignals()
      void this.teardownSession('dispose')
    }, 'pgy-login.backend-lifecycle')
  }

  /**
   * Whether this Host process has completed WMS login since start.
   * @returns true after a successful `wmsLogin` in this process.
   */
  isLoggedIn(): boolean {
    return this.loggedIn
  }

  /**
   * Report whether this Host process has completed WMS login.
   * @returns the process-local gate snapshot.
   */
  @Remote('status')
  status(): PgyLoginStatus {
    return this.employee === undefined
      ? { loggedIn: this.loggedIn }
      : { loggedIn: this.loggedIn, employee: this.employee }
  }

  /**
   * Report the salesman-facing RuoYi Base URL and MCP readiness.
   * @returns config snapshot for the login overlay and settings page.
   */
  @Remote('getBackendConfig')
  async getBackendConfig(): Promise<PgyBackendConfig> {
    await this.boot
    const configured = await resolveBackendBaseUrl({ requireConfigured: true })
    const baseUrl = this.baseUrl ?? configured ?? ''
    return {
      baseUrl,
      configured: configured !== undefined || this.baseUrl !== undefined,
      mcpReady: this.sessionToken !== undefined && this.mcpFiber !== undefined,
    }
  }

  /**
   * Persist a Base URL, issue a session token, and remount the MCP client.
   * @param request - RuoYi root address (token is never collected from the UI).
   * @param signal - caller lifetime.
   * @returns updated backend snapshot after MCP remount.
   */
  @Remote('setBackendConfig')
  async setBackendConfig(
    request: PgyBackendConfigRequest,
    signal: AbortSignal,
  ): Promise<PgyBackendConfig> {
    await this.boot
    const baseUrl = normalizeBaseUrl(request.baseUrl)
    if (baseUrl === '') {
      throw new RemoteError('pgy/backend-required', 'RuoYi Base URL is required', {})
    }
    try {
      new URL(baseUrl)
    } catch {
      throw new RemoteError('pgy/backend-connect-failed', 'Invalid RuoYi Base URL', { reason: 'invalid-url' })
    }
    await writeStoredBackendConfig({
      baseUrl,
      ...(this.clientId === undefined ? {} : { clientId: this.clientId }),
    })
    await this.connectBackend(baseUrl, signal)
    return this.getBackendConfig()
  }

  /**
   * Load organizations for the Web login page through the configured MCP tool.
   * @param signal - caller lifetime; abort stops the MCP call.
   * @returns organization rows without Kingdee cookies.
   */
  @Remote('listOrganizations')
  async listOrganizations(signal: AbortSignal): Promise<PgyOrganizationList> {
    await this.boot
    await this.ensureMcpReady(signal)
    const payload = await this.callTool(this.config.listOrganizationsTool, {}, signal)
    const organizations = readOrganizations(payload)
    return { organizations }
  }

  /**
   * Complete employee WMS login through the configured MCP tool, migrate shared
   * sessions once, and bind persistence to that employee's directory.
   * @param request - organization id, staff number, and WMS password.
   * @param signal - caller lifetime; abort stops the MCP call.
   * @returns the employee identity returned by WMS.
   */
  @Remote('wmsLogin')
  async wmsLogin(request: PgyWmsLoginRequest, signal: AbortSignal): Promise<PgyWmsLoginValue> {
    await this.boot
    if (this.loggedIn && this.employee !== undefined) {
      const requestedKey = `${String(request.orgId)}__${request.staffNumber}`
      const currentKey = employeeScopeKey(this.employee)
      if (requestedKey !== currentKey) {
        throw new RemoteError(
          'pgy/employee-switch-requires-restart',
          'Sign out before signing in as a different employee',
          { currentKey, requestedKey },
        )
      }
      return { employee: this.employee }
    }

    await this.ensureMcpReady(signal)
    const payload = await this.callTool(this.config.wmsLoginTool, {
      orgId: request.orgId,
      staffNumber: request.staffNumber,
      wmsPassword: request.wmsPassword,
    }, signal)
    const employee = readEmployee(payload)
    const key = employeeScopeKey(employee)
    const baseRoot = this.ctx.sessionPersistence.getBaseRoot()
    const scopedRoot = employeeSessionRoot(baseRoot, key)
    await migrateLegacySessionsOnce(baseRoot, scopedRoot, key)
    await this.ctx.sessionPersistence.bindRoot(scopedRoot)
    this.employee = employee
    this.loggedIn = true
    return { employee }
  }

  /**
   * Clear the process-local employee gate and retarget persistence to the base
   * session root so another employee can sign in without restarting the Host.
   * Disposes every live Agent, then awaits write-handle close — Agent teardown
   * starts close asynchronously via `session/disposed`, so logout must wait
   * before `bindRoot`.
   */
  @Remote('logout')
  async logout(): Promise<void> {
    if (!this.loggedIn) return
    await this.disposeLiveAgents()
    await this.ctx.sessionPersistence.closeOpenWriters()
    await this.ctx.sessionPersistence.bindRoot(this.ctx.sessionPersistence.getBaseRoot())
    this.employee = undefined
    this.loggedIn = false
  }

  private async bootstrap(): Promise<void> {
    const stored = await readStoredBackendConfig()
    this.clientId = stored?.clientId
    const baseUrl = await resolveBackendBaseUrl({ requireConfigured: true })
    if (baseUrl === undefined) return
    await this.connectBackend(baseUrl)
  }

  private async ensureMcpReady(signal: AbortSignal): Promise<void> {
    if (this.sessionToken !== undefined && this.mcpFiber !== undefined) return
    const baseUrl = this.baseUrl ?? await resolveBackendBaseUrl({ requireConfigured: true })
    if (baseUrl === undefined) {
      throw new RemoteError('pgy/backend-required', 'Configure the RuoYi Base URL first', {})
    }
    await this.connectBackend(baseUrl, signal)
  }

  private async connectBackend(baseUrl: string, signal?: AbortSignal): Promise<void> {
    const normalized = normalizeBaseUrl(baseUrl)
    await this.revokeAndUnmount()
    this.tearingDown = false
    let issued
    try {
      issued = await issueClientSession({
        baseUrl: normalized,
        clientName: this.config.clientName,
        ...(this.clientId === undefined ? {} : { clientId: this.clientId }),
        ...(signal === undefined ? {} : { signal }),
      })
    } catch (error) {
      throw new RemoteError(
        'pgy/backend-connect-failed',
        'Failed to obtain an MCP session token',
        { reason: error instanceof Error ? error.message : String(error) },
      )
    }
    this.baseUrl = normalized
    this.clientId = issued.clientId
    this.sessionToken = issued.token
    await writeStoredBackendConfig({ baseUrl: normalized, clientId: issued.clientId })
    try {
      await this.mountMcp(normalized, issued.token)
    } catch (error) {
      await this.revokeAndUnmount()
      throw new RemoteError(
        'pgy/backend-connect-failed',
        'Failed to connect MCP after issuing a session token',
        { reason: error instanceof Error ? error.message : String(error) },
      )
    }
  }

  private async mountMcp(baseUrl: string, token: string): Promise<void> {
    await this.unmountMcp()
    const fiber = this.ctx.plugin(McpClient, {
      transport: 'streamable-http',
      serverName: this.config.mcpServerName,
      url: mcpEndpoint(baseUrl),
      headers: { Authorization: `Bearer ${token}` },
      failOnStartupError: false,
    }) as McpFiber & PromiseLike<unknown>
    await fiber
    this.mcpFiber = fiber
  }

  private async unmountMcp(): Promise<void> {
    const fiber = this.mcpFiber
    this.mcpFiber = undefined
    if (fiber === undefined) return
    try {
      await fiber.dispose()
    } catch (error) {
      this.ctx.logger.warn(`pgy-login: disposing mcp-client failed: ${String(error)}`)
    }
  }

  private detachProcessSignals(): void {
    process.removeListener('SIGINT', this.onProcessSignal)
    process.removeListener('SIGTERM', this.onProcessSignal)
  }

  private async revokeAndUnmount(): Promise<void> {
    const token = this.sessionToken
    const baseUrl = this.baseUrl
    this.sessionToken = undefined
    await this.unmountMcp()
    if (token !== undefined && baseUrl !== undefined) {
      await revokeClientSession({ baseUrl, token })
    }
  }

  private async teardownSession(_reason: string): Promise<void> {
    if (this.tearingDown) return
    this.tearingDown = true
    this.detachProcessSignals()
    await this.revokeAndUnmount()
  }

  private async disposeLiveAgents(): Promise<void> {
    const agents = this.ctx.get('agents') as {
      list(): readonly { readonly id: string; readonly ctx: { readonly fiber: { dispose(): Promise<void> } } }[]
      get(id: string): unknown
    } | undefined
    if (agents === undefined) return
    for (const agent of [...agents.list()].reverse()) {
      if (agents.get(agent.id) === undefined) continue
      try {
        await agent.ctx.fiber.dispose()
      } catch (error) {
        this.ctx.logger.warn(`pgy-login logout: disposing agent "${agent.id}" failed: ${String(error)}`)
      }
    }
  }

  private async callTool(
    tool: string,
    args: Record<string, unknown>,
    signal: AbortSignal,
  ): Promise<Record<string, unknown>> {
    const result = await this.ctx.tools.execute({
      callId: ToolCallId(`pgy-login-${randomUUID()}`),
      name: tool,
      arguments: args,
      signal,
    })
    if (result.isError) {
      throw new RemoteError('pgy/login-failed', result.error.message, { tool })
    }
    return unwrapToolPayload(result.value, tool)
  }
}

export default PgyLoginController

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
  return Object.hasOwn(object, 'organizations')
    || Object.hasOwn(object, 'employee')
    || Array.isArray(object.data)
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

function asObject(value: JsonValue, tool: string): Record<string, unknown> {
  const candidate: unknown = typeof value === 'string' ? parseJson(value, tool) : value
  if (candidate !== null && typeof candidate === 'object' && !Array.isArray(candidate)) {
    return candidate as Record<string, unknown>
  }
  throw new RemoteError('pgy/login-failed', 'MCP tool result is not a JSON object', { tool })
}

function parseJson(text: string, tool: string): unknown {
  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new RemoteError('pgy/login-failed', 'MCP tool result is not JSON', { tool })
  }
}

function readOrganizations(payload: Record<string, unknown>): PgyOrganization[] {
  const rows = Array.isArray(payload.organizations) ? payload.organizations : payload.data
  if (!Array.isArray(rows)) {
    throw new RemoteError('pgy/login-failed', 'organization list is missing', { tool: 'listOrganizations' })
  }
  const organizations: PgyOrganization[] = []
  for (const row of rows) {
    if (row === null || typeof row !== 'object' || Array.isArray(row)) continue
    const record = row as Record<string, unknown>
    const id = Number(record.id ?? record.OrgId)
    if (!Number.isFinite(id)) continue
    organizations.push({
      id,
      name: readString(record, 'name', 'OrgName'),
      number: readString(record, 'number', 'OrgNumber'),
    })
  }
  return organizations
}

function readString(record: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string') return value
  }
  return ''
}

function readEmployee(payload: Record<string, unknown>): PgyEmployee {
  const data = payload.employee
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    throw new RemoteError('pgy/login-failed', 'employee login result is missing', { tool: 'wmsLogin' })
  }
  const record = data as Record<string, unknown>
  return {
    empinfoId: asId(record.empinfoId),
    staffNumber: typeof record.staffNumber === 'string' ? record.staffNumber : '',
    name: typeof record.name === 'string' ? record.name : '',
    orgId: asId(record.orgId),
    orgName: typeof record.orgName === 'string' ? record.orgName : '',
    userId: asId(record.userId),
  }
}

function asId(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return ''
}
