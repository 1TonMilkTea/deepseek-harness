import { Context, type Fiber } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SlotRegistry } from '@deepseek-ai/dsh-client-ui-renderer/client'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { apply, inject } from '../src/client/index.ts'
import { apply as hostApply } from '../src/index.ts'
import { LoginOverlay } from '../src/client/LoginOverlay.tsx'
import { LogoutButton } from '../src/client/LogoutButton.tsx'

const owners = new Set<Fiber>()
afterEach(async () => {
  for (const owner of owners) await owner.dispose()
  owners.clear()
})

async function bench() {
  const root = new Context()
  let ctx: Context | undefined
  const owner = root.plugin((owned: Context) => { ctx = owned })
  owners.add(owner)
  await owner.await()
  if (ctx === undefined) throw new Error('owner did not activate')
  await ctx.plugin(SlotRegistry).await()
  ctx.provide('locale', new LocaleRuntime(ctx))
  const pgyLogin = {
    status: vi.fn(),
    listOrganizations: vi.fn(),
    wmsLogin: vi.fn(),
    logout: vi.fn(),
  }
  ctx.provide('remote', { pgyLogin } as never)
  ctx.provide('remote.pgyLogin', pgyLogin as never)
  ctx.provide('sessions', { refresh: vi.fn(async () => {}) } as never)
  const slots = ctx.get('slots') as SlotRegistry
  slots.register(
    {
      name: 'root',
      children: {
        'shell.overlay': { kind: 'list', scope: 'root' },
        'sidebar.footer.action': { kind: 'list', scope: 'root' },
      },
    } as never,
    () => null,
  )
  return { ctx, slots }
}

describe('ui-pgy-login apply', () => {
  it('keeps the host Loader entry inert', () => {
    expect(hostApply).not.toThrow()
  })

  it('declares the services it binds and registers the overlay and logout action', async () => {
    expect(inject).toEqual(['slots', 'locale', 'remote', 'remote.pgyLogin', 'sessions'])
    const b = await bench()
    await b.ctx.plugin({ inject: [...inject], apply }).await()
    const overlay = b.slots.entries('shell.overlay')[0]
    expect(overlay?.component).toBe(LoginOverlay)
    expect(overlay?.options.id).toBe('pgy-login')
    expect(overlay?.locale).toBe('pgyLogin')
    const logout = b.slots.entries('sidebar.footer.action')[0]
    expect(logout?.component).toBe(LogoutButton)
    expect(logout?.options.id).toBe('pgy-logout')
  })

  it('removes the overlay with the plugin lifetime', async () => {
    const b = await bench()
    const fiber = b.ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    expect(b.slots.entries('shell.overlay')).toHaveLength(1)
    expect(b.slots.entries('sidebar.footer.action')).toHaveLength(1)
    await fiber.dispose()
    expect(b.slots.entries('shell.overlay')).toHaveLength(0)
    expect(b.slots.entries('sidebar.footer.action')).toHaveLength(0)
  })
})
