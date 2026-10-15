/**
 * Registers the custom workbench sidebar entry and its main-panel Vue island.
 * AppFrame dual-mounts the workbench beside Conversation when selected
 * (`SPLIT_WITH_CONVERSATION_PANEL_ID`).
 *
 * Business navigation (采购管理 → 采购入库, …) lives only inside the Vue island.
 * Do not register additional sidebar.panellist entries for 1tmt modules.
 */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-1tmt-workbench/client'
import type {} from '@deepseek-ai/dsh-api-pgy-login/client'
import type {} from '@deepseek-ai/dsh-api-pgy-pur-receive/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import { CustomWorkbenchIcon } from './CustomWorkbenchIcon.tsx'
import { CustomWorkbenchPage, type CustomWorkbenchPageInjected } from './CustomWorkbenchPage.tsx'
import { en, zh, type CustomWorkbenchKey } from './locales.ts'

export type { CustomWorkbenchKey } from './locales.ts'
export type { CustomWorkbenchPageInjected, CustomWorkbenchPageProps } from './CustomWorkbenchPage.tsx'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Custom workbench sidebar entry and purchase-inbound page. */
    customWorkbench: CustomWorkbenchKey
  }
}

/** Dictionary namespace owned by this plugin. */
const NS = 'customWorkbench'

/**
 * Main panel id shared with AppFrame's `SPLIT_WITH_CONVERSATION_PANEL_ID`.
 * Kept as a local literal so the Client bundle does not value-import ui-layout.
 */
export const PANEL_ID = 'custom-workbench' as MainPanelId

/** Services required by the sidebar registration, locale, and Remotes. */
export const inject = [
  'slots',
  'locale',
  'remote',
  'remote.tmtWorkbench',
  'remote.pgyLogin',
  'remote.pgyPurReceive',
]

/**
 * Contribute the custom workbench entry to the sidebar with the Vue page it opens.
 * @param ctx - the browser plugin context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-custom-workbench: dictionaries')
  const t = ctx.locale.bind(NS)

  ctx.slots.inject('main', () => ctx.slots.register({
    name: 'main',
    key: PANEL_ID,
    locale: NS,
    inject: (): CustomWorkbenchPageInjected => ({
      publishSnapshot: snapshot => ctx.remote.tmtWorkbench.publishSnapshot(snapshot),
      clearSnapshot: () => ctx.remote.tmtWorkbench.clearSnapshot(),
      getEmployee: async () => {
        const status = await ctx.remote.pgyLogin.status()
        if (!status.ok) return status
        const employee = status.value.employee
        if (employee === undefined) return { ok: true, value: null }
        return { ok: true, value: employee }
      },
      listBills: request => ctx.remote.pgyPurReceive.listBills(request),
      viewBill: request => ctx.remote.pgyPurReceive.viewBill(request),
      entityOutputs: request => ctx.remote.pgyPurReceive.entityOutputs(request),
      getBarcode: request => ctx.remote.pgyPurReceive.getBarcode(request),
      getStockInfo: request => ctx.remote.pgyPurReceive.getStockInfo(request),
      submitReport: request => ctx.remote.pgyPurReceive.submitReport(request),
    }),
  }, CustomWorkbenchPage))

  ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
    name: 'sidebar.panellist',
    id: PANEL_ID,
    order: 20,
    label: () => t('entry'),
    locale: NS,
  }, CustomWorkbenchIcon))
}
