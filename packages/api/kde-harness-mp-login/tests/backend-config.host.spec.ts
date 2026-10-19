import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  DEFAULT_BACKEND_BASE_URL,
  clientSessionsEndpoint,
  mcpEndpoint,
  normalizeBaseUrl,
  readStoredBackendConfig,
  resolveBackendBaseUrl,
  writeStoredBackendConfig,
} from '../src/backend-config.ts'
import { issueClientSession, revokeClientSession } from '../src/session-client.ts'

describe('backend-config', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('normalizes root URLs and /mcp suffixes', () => {
    expect(normalizeBaseUrl(' http://192.168.0.108:8081/ ')).toBe('http://192.168.0.108:8081')
    expect(normalizeBaseUrl('http://192.168.0.108:8081/mcp')).toBe('http://192.168.0.108:8081')
    expect(normalizeBaseUrl('http://192.168.0.108:8081/MCP/')).toBe('http://192.168.0.108:8081')
    expect(mcpEndpoint('http://a:8081/mcp')).toBe('http://a:8081/mcp')
    expect(clientSessionsEndpoint('http://a:8081')).toBe('http://a:8081/mcp/client-sessions')
  })

  it('prefers the page-saved file over env and the default', async () => {
    const home = await mkdtemp(join(tmpdir(), '1tmt-backend-'))
    vi.stubEnv('DSH_HOME', home)
    vi.stubEnv('DSH_1TMT_MCP_URL', 'http://env-host:8081/mcp')
    await writeStoredBackendConfig({ baseUrl: 'http://page-host:8081/' })
    expect(await resolveBackendBaseUrl({ requireConfigured: true })).toBe('http://page-host:8081')
    expect(await readStoredBackendConfig()).toEqual({ baseUrl: 'http://page-host:8081' })
    const text = await readFile(join(home, '1tmt-backend.json'), 'utf8')
    expect(text).toContain('page-host')
  })

  it('uses env when no file is saved, and omits the hard-coded default when required', async () => {
    const home = await mkdtemp(join(tmpdir(), '1tmt-backend-'))
    vi.stubEnv('DSH_HOME', home)
    vi.stubEnv('DSH_1TMT_MCP_URL', 'http://env-host:9/mcp')
    expect(await resolveBackendBaseUrl({ requireConfigured: true })).toBe('http://env-host:9')

    vi.stubEnv('DSH_1TMT_MCP_URL', '')
    expect(await resolveBackendBaseUrl({ requireConfigured: true })).toBeUndefined()
    expect(await resolveBackendBaseUrl()).toBe(DEFAULT_BACKEND_BASE_URL)
  })
})

describe('session-client', () => {
  it('issues and revokes session tokens over HTTP', async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const href = String(url)
      expect(href).toBe('http://ruoyi:8081/mcp/client-sessions')
      if (init?.method === 'POST') {
        expect(JSON.parse(String(init.body))).toEqual({
          clientName: 'harness-desktop',
          clientId: 'cid-1',
        })
        return {
          ok: true,
          json: async () => ({ token: 'tok', clientId: 'cid-1', expiresInSeconds: 12 }),
        }
      }
      expect(init?.method).toBe('DELETE')
      expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer tok')
      return { ok: true, status: 204 }
    })
    const issued = await issueClientSession({
      baseUrl: 'http://ruoyi:8081',
      clientId: 'cid-1',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    expect(issued).toEqual({ token: 'tok', clientId: 'cid-1', expiresInSeconds: 12 })
    await revokeClientSession({
      baseUrl: 'http://ruoyi:8081',
      token: 'tok',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })
})
