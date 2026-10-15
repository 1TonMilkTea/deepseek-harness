/**
 * Registers the custom workbench sidebar entry and its main-panel Vue island.
 * AppFrame dual-mounts the workbench beside Conversation when selected
 * (`SPLIT_WITH_CONVERSATION_PANEL_ID`).
 */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-1tmt-workbench/client'
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
    /** Custom workbench sidebar entry and placeholder page. */
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

/** Services required by the sidebar registration, locale, and workbench Remote. */
export const inject = ['slots', 'locale', 'remote', 'remote.tmtWorkbench']

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
