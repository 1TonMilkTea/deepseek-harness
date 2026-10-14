// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import { RemoteError, type RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { PgyLoginStatus } from '@deepseek-ai/dsh-api-pgy-login/client'
import type { LoginBridge } from '@deepseek-ai/dsh-1tmt-vue'
import type {} from '../src/client/index.ts'
import { LoginOverlay, type LoginOverlayProps } from '../src/client/LoginOverlay.tsx'
import { zh, type PgyLoginKey } from '../src/client/locales.ts'

const mountLogin = vi.fn<(el: HTMLElement, bridge: LoginBridge) => void>()
const unmountLogin = vi.fn<(el: HTMLElement) => void>()

vi.mock('@deepseek-ai/dsh-1tmt-vue', () => ({
  mountLogin: (el: HTMLElement, bridge: LoginBridge) => { mountLogin(el, bridge) },
  unmountLogin: (el: HTMLElement) => { unmountLogin(el) },
}))

afterEach(() => {
  cleanup()
  document.getElementById('root')?.remove()
  mountLogin.mockReset()
  unmountLogin.mockReset()
})

const t: TranslateNS<'pgyLogin'> = key => key in zh ? zh[key as PgyLoginKey] : key

function failed(message: string) {
  return { ok: false as const, error: new RemoteError('pgy/login-failed', message, { tool: 'pgy-login' }) }
}

/**
 * Drive the Vue island contract from the captured bridge (host tests stay Cordis-free).
 * @param bridge - LoginBridge from mountLogin
 */
async function runLoginIsland(bridge: LoginBridge): Promise<void> {
  const host = document.querySelector('[data-1tmt-login-host]')
  if (!(host instanceof HTMLElement)) throw new Error('login host missing')

  const current = await bridge.status()
  if (!current.ok) {
    host.setAttribute('role', 'dialog')
    host.textContent = current.error.message
    return
  }
  if (current.value.loggedIn) {
    await bridge.refreshSessions()
    bridge.onLoggedIn()
    return
  }
  const backend = await bridge.getBackendConfig()
  if (!backend.ok) {
    host.setAttribute('role', 'dialog')
    host.textContent = backend.error.message
    return
  }
  if (!backend.value.configured) {
    host.setAttribute('role', 'dialog')
    host.textContent = bridge.labels.backendTitle
    return
  }
  const listed = await bridge.listOrganizations()
  if (!listed.ok) {
    host.setAttribute('role', 'dialog')
    host.textContent = listed.error.message
    return
  }
  host.setAttribute('role', 'dialog')
  host.replaceChildren()
  const form = document.createElement('form')
  const org = document.createElement('select')
  org.setAttribute('role', 'combobox')
  for (const organization of listed.value.organizations) {
    const option = document.createElement('option')
    option.value = String(organization.id)
    option.textContent = organization.name
    org.appendChild(option)
  }
  const staff = document.createElement('input')
  staff.placeholder = bridge.labels.staffNumberPlaceholder
  const password = document.createElement('input')
  password.placeholder = bridge.labels.passwordPlaceholder
  const error = document.createElement('p')
  form.append(org, staff, password, error)
  form.addEventListener('submit', (event) => {
    event.preventDefault()
    const id = Number(org.value)
    if (!Number.isFinite(id) || staff.value.trim() === '' || password.value === '') return
    void bridge.wmsLogin({
      orgId: id,
      staffNumber: staff.value.trim(),
      wmsPassword: password.value,
    }).then(async (result) => {
      if (!result.ok) {
        error.textContent = result.error.message
        return
      }
      await bridge.refreshSessions()
      bridge.onLoggedIn()
    })
  })
  host.appendChild(form)
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
  mountLogin.mockImplementation((el, bridge) => {
    el.setAttribute('role', 'status')
    el.textContent = bridge.labels.loading
    void runLoginIsland(bridge)
  })
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
  it('mounts the Vue login island with a bridge', async () => {
    mount(null, {
      status: vi.fn(() => new Promise<RemoteResult<PgyLoginStatus>>(() => {})),
    })
    await waitFor(() => { expect(mountLogin).toHaveBeenCalled() })
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
      expect(document.querySelector('[data-1tmt-login-host]')).toBeNull()
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

  it('unmounts the Vue island when the host unmounts', async () => {
    let resolveStatus: (value: { ok: true; value: { loggedIn: false } }) => void = () => {}
    const status = vi.fn(() => new Promise<{ ok: true; value: { loggedIn: false } }>((resolve) => {
      resolveStatus = resolve
    }))
    const view = mount(null, { status })
    await waitFor(() => { expect(mountLogin).toHaveBeenCalled() })
    view.unmount()
    expect(unmountLogin).toHaveBeenCalled()
    resolveStatus({ ok: true, value: { loggedIn: false } })
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
