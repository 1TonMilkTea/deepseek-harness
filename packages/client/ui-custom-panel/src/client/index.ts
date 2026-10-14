/**
 * Registers the Custom sidebar entry and its main-panel placeholder.
 * AppFrame dual-mounts this panel beside Conversation when selected
 * (`SPLIT_WITH_CONVERSATION_PANEL_ID`).
 */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import { CustomPanelIcon } from './CustomPanelIcon.tsx'
import { CustomPanelPage } from './CustomPanelPage.tsx'
import { en, zh, type CustomPanelKey } from './locales.ts'

export type { CustomPanelKey } from './locales.ts'
export type { CustomPanelPageProps } from './CustomPanelPage.tsx'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Custom sidebar panel and placeholder page. */
    customPanel: CustomPanelKey
  }
}

/** Dictionary namespace owned by this plugin. */
const NS = 'customPanel'

/**
 * Main panel id shared with AppFrame's `SPLIT_WITH_CONVERSATION_PANEL_ID`.
 * Kept as a local literal so the Client bundle does not value-import ui-layout.
 */
export const PANEL_ID = 'custom' as MainPanelId

/** Services required by the sidebar registration and locale. */
export const inject = ['slots', 'locale']

/**
 * Contribute the Custom entry to the sidebar with the placeholder page it opens.
 * @param ctx - the browser plugin context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-custom-panel: dictionaries')
  const t = ctx.locale.bind(NS)

  ctx.slots.inject('main', () => ctx.slots.register({
    name: 'main',
    key: PANEL_ID,
    locale: NS,
  }, CustomPanelPage))

  ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
    name: 'sidebar.panellist',
    id: PANEL_ID,
    order: 20,
    label: () => t('panel'),
    locale: NS,
  }, CustomPanelIcon))
}
