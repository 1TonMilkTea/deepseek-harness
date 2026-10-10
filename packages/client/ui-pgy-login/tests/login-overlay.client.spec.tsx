// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import { RemoteError, type RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { PgyLoginStatus } from '@deepseek-ai/dsh-api-pgy-login/client'
import type {} from '../src/client/index.ts'
import { LoginOverlay, type LoginOverlayProps } from '../src/client/LoginOverlay.tsx'
import { zh, type PgyLoginKey } from '../src/client/locales.ts'

afterEach(() => {
  cleanup()
  document.getElementById('root')?.remove()
})

const t: TranslateNS<'pgyLogin'> = key => key in zh ? zh[key as PgyLoginKey] : key

function failed(message: string) {
  return { ok: false as const, error: new RemoteError('pgy/login-failed', message, { tool: 'pgy-login' }) }
}

function mount(root: HTMLDivElement | null, extra: Partial<Parameters<typeof LoginOverlay>[0]> = {}) {
  if (root !== null) document.body.appendChild(root)
  const status = extra.status ?? vi.fn(async () => ({ ok: true as const, value: { loggedIn: false } }))
  const listOrganizations = extra.listOrganizations ?? vi.fn(async () => ({
    ok: true as const,
    value: { organizations: [{ id: 12, name: 'Org A', number: 'A' }] },
  }))
  const wmsLogin = extra.wmsLogin ?? vi.fn(async () => ({
    ok: true as const,
    value: { employee: { empinfoId: '1', staffNumber: 'E01', name: 'Ada', orgId: '12', orgName: 'Org A', userId: '7' } },
  }))
  const refreshSessions = extra.refreshSessions ?? vi.fn(async () => {})
  const getBackendConfig = extra.getBackendConfig ?? vi.fn(async () => ({
    ok: true as const,
    value: { baseUrl: 'http://127.0.0.1:8080', configured: true },
  }))
  const setBackendConfig = extra.setBackendConfig ?? vi.fn(async () => ({
    ok: true as const,
    value: { baseUrl: 'http://127.0.0.1:8080', configured: true },
  }))
  const props = {
    t,
    status,
    getBackendConfig,
    setBackendConfig,
    listOrganizations,
    wmsLogin,
    refreshSessions,
    ...extra,
  } as LoginOverlayProps
  return {
    status,
    getBackendConfig,
    setBackendConfig,
    listOrganizations,
    wmsLogin,
    refreshSessions,
    ...render(<LoginOverlay {...props} />),
  }
}

describe('LoginOverlay', () => {
  it('shows loading copy until Host status returns', async () => {
    mount(null, {
      status: vi.fn(() => new Promise<RemoteResult<PgyLoginStatus>>(() => {})),
    })
    expect((await screen.findByRole('status')).textContent).toBe(zh.loading)
  })

  it('renders nothing while already logged in', async () => {
    const refreshSessions = vi.fn(async () => {})
    mount(null, {
      status: vi.fn(async () => ({ ok: true as const, value: { loggedIn: true } })),
      refreshSessions,
    })
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(refreshSessions).toHaveBeenCalled()
    })
  })

  it('loads organizations, submits WMS login, and dismisses the gate', async () => {
    const root = document.createElement('div')
    root.id = 'root'
    const view = mount(root)
    await screen.findByRole('dialog')
    expect(root.inert).toBe(true)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '12' } })
    fireEvent.change(screen.getByPlaceholderText(zh.staffNumberPlaceholder), { target: { value: 'E01' } })
    fireEvent.change(screen.getByPlaceholderText(zh.passwordPlaceholder), { target: { value: 'secret' } })
    fireEvent.submit(screen.getByRole('dialog').querySelector('form')!)
    await waitFor(() => {
      expect(view.wmsLogin).toHaveBeenCalledWith({
        orgId: 12,
        staffNumber: 'E01',
        wmsPassword: 'secret',
      })
      expect(view.refreshSessions).toHaveBeenCalled()
      expect(screen.queryByRole('dialog')).toBeNull()
    })
  })

  it('shows Host error text for status, list, and login failures', async () => {
    mount(null, {
      status: vi.fn(async () => failed('status failed')),
    })
    expect(await screen.findByText('status failed')).toBeTruthy()
    cleanup()

    mount(null, {
      listOrganizations: vi.fn(async () => failed('list failed')),
    })
    expect(await screen.findByText('list failed')).toBeTruthy()
    cleanup()

    const view = mount(null, {
      wmsLogin: vi.fn(async () => failed('login failed')),
    })
    await screen.findByRole('dialog')
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '12' } })
    fireEvent.change(screen.getByPlaceholderText(zh.staffNumberPlaceholder), { target: { value: 'E01' } })
    fireEvent.change(screen.getByPlaceholderText(zh.passwordPlaceholder), { target: { value: 'secret' } })
    fireEvent.submit(screen.getByRole('dialog').querySelector('form')!)
    expect(await screen.findByText('login failed')).toBeTruthy()
    expect(view.wmsLogin).toHaveBeenCalled()
  })

  it('abandons in-flight Host reads when unmounted', async () => {
    let resolveStatus: (value: { ok: true; value: { loggedIn: false } }) => void = () => {}
    const status = vi.fn(() => new Promise<{ ok: true; value: { loggedIn: false } }>((resolve) => {
      resolveStatus = resolve
    }))
    const view = mount(null, { status })
    view.unmount()
    resolveStatus({ ok: true, value: { loggedIn: false } })
    await Promise.resolve()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('abandons organization listing after status when unmounted', async () => {
    let resolveList: (value: { ok: true; value: { organizations: [] } }) => void = () => {}
    const listOrganizations = vi.fn(() => new Promise<{ ok: true; value: { organizations: [] } }>((resolve) => {
      resolveList = resolve
    }))
    const view = mount(null, { listOrganizations })
    await waitFor(() => { expect(listOrganizations).toHaveBeenCalled() })
    view.unmount()
    resolveList({ ok: true, value: { organizations: [] } })
    await Promise.resolve()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('ignores submit until organization, staff number, and password are present', async () => {
    const view = mount(null)
    await screen.findByRole('dialog')
    fireEvent.submit(screen.getByRole('dialog').querySelector('form')!)
    expect(view.wmsLogin).not.toHaveBeenCalled()
  })
})
