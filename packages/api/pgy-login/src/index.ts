/** Host Remote owner: list WMS organizations and complete employee login through MCP tools. */

import { randomUUID } from 'node:crypto'
import { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { ToolCallId } from '@deepseek-ai/dsh-llm'
import type {} from '@deepseek-ai/dsh-session-persistence'
import type {} from '@deepseek-ai/dsh-tools'
import { Remote, RemoteError, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type { JsonValue } from '@deepseek-ai/dsh-util-values'
import {
  employeeScopeKey, employeeSessionRoot, migrateLegacySessionsOnce,
} from './employee-scope.ts'
import type {
  PgyEmployee, PgyLoginStatus, PgyOrganization, PgyOrganizationList, PgyWmsLoginRequest, PgyWmsLoginValue,
} from './types.ts'

export type * from './types.ts'
export {
  employeeScopeKey, employeeSessionRoot, migrateLegacySessionsOnce,
  PGY_EMPLOYEE_SCOPE_MARKER, PGY_EMPLOYEE_SESSIONS_DIR,
} from './employee-scope.ts'

/** MCP tool names this controller executes for the Web login page. */
export interface Config {
  /** Public tool name for `pgyListOrganizations` (`mcp__<serverName>__pgyListOrganizations`). */
  listOrganizationsTool: string
  /** Public tool name for `pgyWmsLogin` (`mcp__<serverName>__pgyWmsLogin`). */
  wmsLoginTool: string
}

/** Schemastery configuration for the login Remote. */
export const Config: z<Config> = z.object({
  listOrganizationsTool: z.string(),
  wmsLoginTool: z.string(),
})

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Host WMS login Remote namespace owner and Session create/prompt gate. */
    pgyLogin: PgyLoginController
  }
}

/** Host service backing the generated `ctx.remote.pgyLogin` namespace. */
export class PgyLoginController extends TypertRemoteService {
  static inject = ['typert', 'tools', 'sessionPersistence']

  static Config = Config

  private loggedIn = false
  private employee: PgyEmployee | undefined

  /**
   * @param ctx - Host context carrying tools, persistence, and Typert Gateway.
   * @param config - MCP public tool names for organization listing and WMS login.
   */
  constructor(ctx: Context, private readonly config: Config) {
    super(ctx, 'pgyLogin', { namespace: 'pgyLogin' })
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
   * Load organizations for the Web login page through the configured MCP tool.
   * @param signal - caller lifetime; abort stops the MCP call.
   * @returns organization rows without Kingdee cookies.
   */
  @Remote('listOrganizations')
  async listOrganizations(signal: AbortSignal): Promise<PgyOrganizationList> {
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
