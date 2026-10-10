/**
 * HTTP helpers for RuoYi MCP client-session issue and revoke.
 */

import { clientSessionsEndpoint } from './backend-config.ts'

/** Successful `POST /mcp/client-sessions` body. */
export interface IssuedClientSession {
  readonly token: string
  readonly clientId: string
  readonly expiresInSeconds: number
}

export interface IssueSessionOptions {
  readonly baseUrl: string
  readonly clientId?: string
  readonly clientName?: string
  readonly signal?: AbortSignal
  /** Injectable fetch for tests. */
  readonly fetchImpl?: typeof fetch
}

/**
 * Ask RuoYi for a short-lived MCP session token (anonymous).
 * @param options - base URL and optional client identity.
 * @returns token, clientId, and TTL.
 */
export async function issueClientSession(options: IssueSessionOptions): Promise<IssuedClientSession> {
  const fetchImpl = options.fetchImpl ?? fetch
  const body: Record<string, string> = {
    clientName: options.clientName ?? 'harness-desktop',
  }
  if (options.clientId !== undefined && options.clientId !== '') {
    body.clientId = options.clientId
  }
  const init: RequestInit = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  }
  if (options.signal !== undefined) init.signal = options.signal
  const response = await fetchImpl(clientSessionsEndpoint(options.baseUrl), init)
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(
      `POST /mcp/client-sessions failed: HTTP ${String(response.status)}${text === '' ? '' : ` ${text}`}`,
    )
  }
  const payload = await response.json() as Record<string, unknown>
  const token = typeof payload.token === 'string' ? payload.token : ''
  const clientId = typeof payload.clientId === 'string' ? payload.clientId : ''
  const expiresInSeconds = typeof payload.expiresInSeconds === 'number' ? payload.expiresInSeconds : 0
  if (token === '' || clientId === '') {
    throw new Error('POST /mcp/client-sessions returned an incomplete payload')
  }
  return { token, clientId, expiresInSeconds }
}

export interface RevokeSessionOptions {
  readonly baseUrl: string
  readonly token: string
  readonly signal?: AbortSignal
  readonly fetchImpl?: typeof fetch
}

/**
 * Destroy a session token on the server (idempotent).
 * @param options - base URL and Bearer token.
 */
export async function revokeClientSession(options: RevokeSessionOptions): Promise<void> {
  if (options.token === '') return
  const fetchImpl = options.fetchImpl ?? fetch
  try {
    const init: RequestInit = {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${options.token}`,
        Accept: 'application/json',
      },
    }
    if (options.signal !== undefined) init.signal = options.signal
    await fetchImpl(clientSessionsEndpoint(options.baseUrl), init)
  } catch {
    // Best-effort on process exit; ignore network failures.
  }
}
