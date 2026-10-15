// @vitest-environment jsdom
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BridgeResult, CustomBridge, LoginBridge } from '../types/index.d.ts'

const libEntry = join(dirname(fileURLToPath(import.meta.url)), '../lib/index.js')
const hasLib = existsSync(libEntry)

afterEach(() => {
  document.body.replaceChildren()
  document.head.querySelectorAll('style[id^="dsh-1tmt-"]').forEach(node => node.remove())
})

describe.skipIf(!hasLib)('1tmt-vue mount helpers', () => {
  it('mounts and unmounts the login island without leaving children', async () => {
    const {
      mountLogin,
      unmountLogin,
    } = await import(pathToFileURL(libEntry).href) as typeof import('@deepseek-ai/dsh-1tmt-vue')
    const el = document.createElement('div')
    document.body.appendChild(el)
    const bridge: LoginBridge = {
      labels: {
        title: 'Staff login',
        subtitle: 'sub',
        org: 'Org',
        orgPlaceholder: 'Select',
        staffNumber: 'Staff',
        staffNumberPlaceholder: 'staff',
        password: 'Password',
        passwordPlaceholder: 'pass',
        submit: 'Sign in',
        loading: 'Loading…',
        backendTitle: 'Backend',
        backendSubtitle: 'url',
        backendUrl: 'URL',
        backendUrlPlaceholder: 'http://',
        backendSubmit: 'Save',
        editBackend: 'Edit',
      },
      status: vi.fn(() => new Promise<BridgeResult<{ readonly loggedIn: boolean }>>(() => {})),
      getBackendConfig: vi.fn(async () => ({
        ok: true as const,
        value: { baseUrl: 'http://127.0.0.1:8080', configured: true },
      })),
      setBackendConfig: vi.fn(async () => ({
        ok: true as const,
        value: { baseUrl: 'http://127.0.0.1:8080', configured: true },
      })),
      listOrganizations: vi.fn(async () => ({
        ok: true as const,
        value: { organizations: [{ id: 1, name: 'A', number: 'A' }] },
      })),
      wmsLogin: vi.fn(async () => ({ ok: true as const, value: {} })),
      refreshSessions: vi.fn(async () => {}),
      onLoggedIn: vi.fn(),
    }
    mountLogin(el, bridge)
    expect(el.childNodes.length).toBeGreaterThan(0)
    unmountLogin(el)
    expect(el.childNodes.length).toBe(0)
  })

  it('mounts and unmounts the custom panel island', async () => {
    const {
      mountCustomPanel,
      unmountCustomPanel,
    } = await import(pathToFileURL(libEntry).href) as typeof import('@deepseek-ai/dsh-1tmt-vue')
    const el = document.createElement('div')
    document.body.appendChild(el)
    const publishSnapshot = vi.fn(async () => ({
      ok: true as const,
      value: { hash: 'abc', updatedAt: 1 },
    }))
    const clearSnapshot = vi.fn(async () => ({ ok: true as const, value: undefined }))
    const bridge: CustomBridge = {
      labels: { title: 'Custom', intro: 'Intro text', republish: 'Republish' },
      publishSnapshot,
      clearSnapshot,
    }
    mountCustomPanel(el, bridge)
    expect(el.querySelector('[data-custom-panel]')).not.toBeNull()
    expect(el.textContent).toContain('Custom')
    await vi.waitFor(() => { expect(publishSnapshot).toHaveBeenCalled() })
    unmountCustomPanel(el)
    expect(clearSnapshot).toHaveBeenCalled()
    expect(el.childNodes.length).toBe(0)
  })
})
