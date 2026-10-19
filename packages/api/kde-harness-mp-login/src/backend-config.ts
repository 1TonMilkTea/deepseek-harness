/**
 * Persist and resolve the RuoYi Base URL for the 1TMT MCP client.
 * Precedence: page-saved file > DSH_1TMT_MCP_URL / env > default loopback.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { dshHomePath } from '@deepseek-ai/dsh-home-paths'

/** File under `$DSH_HOME` that stores only the backend address (and optional clientId). */
export const BACKEND_CONFIG_FILE = '1tmt-backend.json'

/** Development / IT fallback when nothing is configured on the page. */
export const DEFAULT_BACKEND_BASE_URL = 'http://127.0.0.1:8081'

/** Stored shape — address only for the salesman path; clientId is reused across issues. */
export interface StoredBackendConfig {
  readonly baseUrl: string
  readonly clientId?: string
}

/**
 * Strip trailing slashes and an optional `/mcp` suffix so callers can paste
 * either a root URL or a full MCP endpoint.
 * @param input - raw URL from the page, env, or file.
 * @returns normalized base URL without a trailing slash.
 */
export function normalizeBaseUrl(input: string): string {
  let value = input.trim().replace(/\/+$/u, '')
  if (value.toLowerCase().endsWith('/mcp')) {
    value = value.slice(0, -4).replace(/\/+$/u, '')
  }
  return value
}

/**
 * Build the Streamable HTTP MCP endpoint from a base URL.
 * @param baseUrl - normalized RuoYi root.
 * @returns `{base}/mcp`.
 */
export function mcpEndpoint(baseUrl: string): string {
  return `${normalizeBaseUrl(baseUrl)}/mcp`
}

/**
 * Build the client-session API endpoint from a base URL.
 * @param baseUrl - normalized RuoYi root.
 * @returns `{base}/mcp/client-sessions`.
 */
export function clientSessionsEndpoint(baseUrl: string): string {
  return `${normalizeBaseUrl(baseUrl)}/mcp/client-sessions`
}

/**
 * Absolute path of the persisted backend config file.
 * @returns `$DSH_HOME/1tmt-backend.json`.
 */
export function backendConfigPath(): string {
  return dshHomePath(BACKEND_CONFIG_FILE)
}

/**
 * Read the page-saved backend config, if any.
 * @returns stored config, or undefined when missing / invalid.
 */
export async function readStoredBackendConfig(): Promise<StoredBackendConfig | undefined> {
  try {
    const text = await readFile(backendConfigPath(), 'utf8')
    const parsed = JSON.parse(text) as unknown
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return undefined
    const record = parsed as Record<string, unknown>
    if (typeof record.baseUrl !== 'string' || record.baseUrl.trim() === '') return undefined
    const baseUrl = normalizeBaseUrl(record.baseUrl)
    if (baseUrl === '') return undefined
    const clientId = typeof record.clientId === 'string' && record.clientId.trim() !== ''
      ? record.clientId.trim()
      : undefined
    return clientId === undefined ? { baseUrl } : { baseUrl, clientId }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw error
  }
}

/**
 * Persist the page-saved backend address (and optional clientId).
 * @param config - normalized base URL plus optional client id.
 */
export async function writeStoredBackendConfig(config: StoredBackendConfig): Promise<void> {
  const path = backendConfigPath()
  await mkdir(dirname(path), { recursive: true })
  const body: StoredBackendConfig = {
    baseUrl: normalizeBaseUrl(config.baseUrl),
    ...(config.clientId !== undefined && config.clientId !== '' ? { clientId: config.clientId } : {}),
  }
  await writeFile(path, `${JSON.stringify(body, null, 2)}\n`, 'utf8')
}

/**
 * Resolve the effective Base URL.
 *
 * Precedence: page-saved file > `DSH_1TMT_MCP_URL` > default loopback.
 * When `requireConfigured` is true, the default is not applied (UI shows the
 * backend form until the user or IT config provides an address).
 * @param options.requireConfigured - when true, omit the hard-coded default.
 * @param env - environment mapping (tests inject a stub).
 * @returns normalized base URL, or undefined when nothing is configured.
 */
export async function resolveBackendBaseUrl(
  options: { readonly requireConfigured?: boolean } = {},
  env: Record<string, string | undefined> = process.env,
): Promise<string | undefined> {
  const stored = await readStoredBackendConfig()
  if (stored !== undefined) return stored.baseUrl

  const fromEnv = env.DSH_1TMT_MCP_URL?.trim()
  if (fromEnv !== undefined && fromEnv !== '') return normalizeBaseUrl(fromEnv)

  if (options.requireConfigured) return undefined
  return DEFAULT_BACKEND_BASE_URL
}
