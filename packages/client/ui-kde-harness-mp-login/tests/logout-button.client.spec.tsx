// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import { RemoteError } from '@deepseek-ai/dsh-typert-protocol'
import type {} from '../src/client/index.ts'
import { LogoutButton, type LogoutButtonProps } from '../src/client/LogoutButton.tsx'
import { zh, type KdeHarnessMpLoginKey } from '../src/client/locales.ts'

afterEach(() => {
  cleanup()
})

const t: TranslateNS<'kdeHarnessMpLogin'> = key => key in zh ? zh[key as KdeHarnessMpLoginKey] : key

describe('LogoutButton', () => {
  it('calls Host logout and reloads when sign-out succeeds', async () => {
    const logout = vi.fn(async () => ({ ok: true as const, value: undefined }))
    const reload = vi.fn()
    vi.stubGlobal('location', { ...window.location, reload })
    render(<LogoutButton {...{
      t,
      wide: true,
      logout,
    } as LogoutButtonProps} />)
    fireEvent.click(screen.getByRole('button', { name: zh.logout }))
    await waitFor(() => {
      expect(logout).toHaveBeenCalled()
      expect(reload).toHaveBeenCalled()
    })
    vi.unstubAllGlobals()
  })

  it('stays enabled after a failed logout', async () => {
    const logout = vi.fn(async () => ({
      ok: false as const,
      error: new RemoteError('kde-harness-mp/login-failed', 'logout failed', { tool: 'kde-harness-mp-login' }),
    }))
    render(<LogoutButton {...{
      t,
      wide: false,
      logout,
    } as LogoutButtonProps} />)
    fireEvent.click(screen.getByRole('button', { name: zh.logout }))
    await waitFor(() => {
      expect(logout).toHaveBeenCalled()
      expect(screen.getByRole('button', { name: zh.logout })).toHaveProperty('disabled', false)
    })
  })
})
