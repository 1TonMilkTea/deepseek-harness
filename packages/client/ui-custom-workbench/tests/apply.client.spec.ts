import { Context, type Fiber } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SlotRegistry } from '@deepseek-ai/dsh-client-ui-renderer/client'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { resolveSlotLabel } from '@deepseek-ai/dsh-client-ui-slots'
import { SPLIT_WITH_CONVERSATION_PANEL_ID } from '@deepseek-ai/dsh-client-ui-layout/client'
import { apply, inject, PANEL_ID } from '../src/client/index.ts'
import { apply as hostApply } from '../src/index.ts'
import { CustomWorkbenchIcon } from '../src/client/CustomWorkbenchIcon.tsx'
import { CustomWorkbenchPage } from '../src/client/CustomWorkbenchPage.tsx'

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
  const tmtWorkbench = {
    publishSnapshot: vi.fn(async () => ({ ok: true, value: { hash: 'x', updatedAt: 1 } })),
    clearSnapshot: vi.fn(async () => ({ ok: true, value: undefined })),
  }
  ctx.provide('remote', { tmtWorkbench } as never)
  ctx.provide('remote.tmtWorkbench', tmtWorkbench as never)
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

describe('ui-custom-workbench apply', () => {
  it('keeps the host Loader entry inert', () => {
    expect(hostApply).not.toThrow()
  })

  it('shares the layout split panel id', () => {
    expect(PANEL_ID).toBe(SPLIT_WITH_CONVERSATION_PANEL_ID)
  })

  it('declares services and registers the sidebar entry and main page', async () => {
    expect(inject).toEqual(['slots', 'locale', 'remote', 'remote.tmtWorkbench'])
    const b = await bench()
    await b.ctx.plugin({ inject: [...inject], apply }).await()
    const main = b.slots.entries('main')[0]
    expect(main?.component).toBe(CustomWorkbenchPage)
    expect(main?.options.key).toBe(PANEL_ID)
    expect(main?.locale).toBe('customWorkbench')
    const panel = b.slots.entries('sidebar.panellist')[0]
    expect(panel?.component).toBe(CustomWorkbenchIcon)
    expect(panel?.options.id).toBe(PANEL_ID)
    expect(panel?.options.order).toBe(20)
    b.ctx.locale.setLocale('zh')
    expect(resolveSlotLabel(panel?.options.label)).toBe('自定义工作台')
    b.ctx.locale.setLocale('en')
    expect(resolveSlotLabel(panel?.options.label)).toBe('Custom Workbench')
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
