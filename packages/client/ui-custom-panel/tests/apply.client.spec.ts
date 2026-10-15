import { Context, type Fiber } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SlotRegistry } from '@deepseek-ai/dsh-client-ui-renderer/client'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { resolveSlotLabel } from '@deepseek-ai/dsh-client-ui-slots'
import { SPLIT_WITH_CONVERSATION_PANEL_ID } from '@deepseek-ai/dsh-client-ui-layout/client'
import { apply, inject, PANEL_ID } from '../src/client/index.ts'
import { apply as hostApply } from '../src/index.ts'
import { CustomPanelIcon } from '../src/client/CustomPanelIcon.tsx'
import { CustomPanelPage } from '../src/client/CustomPanelPage.tsx'

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
  const tmtPanel = {
    publishSnapshot: vi.fn(async () => ({ ok: true, value: { hash: 'x', updatedAt: 1 } })),
    clearSnapshot: vi.fn(async () => ({ ok: true, value: undefined })),
  }
  ctx.provide('remote', { tmtPanel } as never)
  ctx.provide('remote.tmtPanel', tmtPanel as never)
  const slots = ctx.get('slots') as SlotRegistry
  slots.register(
    {
      name: 'root',
      children: {
        main: { kind: 'keyed', scope: 'root' },
        'sidebar.panellist': { kind: 'list', scope: 'root' },
      },
    } as never,
    () => null,
  )
  return { ctx, slots }
}

describe('ui-custom-panel apply', () => {
  it('keeps the host Loader entry inert', () => {
    expect(hostApply).not.toThrow()
  })

  it('shares the layout split panel id', () => {
    expect(PANEL_ID).toBe(SPLIT_WITH_CONVERSATION_PANEL_ID)
  })

  it('declares services and registers the sidebar entry and main page', async () => {
    expect(inject).toEqual(['slots', 'locale', 'remote', 'remote.tmtPanel'])
    const b = await bench()
    await b.ctx.plugin({ inject: [...inject], apply }).await()
    const main = b.slots.entries('main')[0]
    expect(main?.component).toBe(CustomPanelPage)
    expect(main?.options.key).toBe(PANEL_ID)
    expect(main?.locale).toBe('customPanel')
    const panel = b.slots.entries('sidebar.panellist')[0]
    expect(panel?.component).toBe(CustomPanelIcon)
    expect(panel?.options.id).toBe(PANEL_ID)
    expect(panel?.options.order).toBe(20)
    b.ctx.locale.setLocale('zh')
    expect(resolveSlotLabel(panel?.options.label)).toBe('自定义按钮')
    b.ctx.locale.setLocale('en')
    expect(resolveSlotLabel(panel?.options.label)).toBe('Custom')
  })

  it('removes registrations with the plugin lifetime', async () => {
    const b = await bench()
    const fiber = b.ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    expect(b.slots.entries('main')).toHaveLength(1)
    expect(b.slots.entries('sidebar.panellist')).toHaveLength(1)
    await fiber.dispose()
    expect(b.slots.entries('main')).toHaveLength(0)
    expect(b.slots.entries('sidebar.panellist')).toHaveLength(0)
  })
})
