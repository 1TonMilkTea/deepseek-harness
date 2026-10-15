/**
 * Registers the Custom sidebar entry and its main-panel Vue island.
 * AppFrame dual-mounts this panel beside Conversation when selected
 * (`SPLIT_WITH_CONVERSATION_PANEL_ID`).
 */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-1tmt-panel/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import { CustomPanelIcon } from './CustomPanelIcon.tsx'
import { CustomPanelPage, type CustomPanelPageInjected } from './CustomPanelPage.tsx'
import { en, zh, type CustomPanelKey } from './locales.ts'

export type { CustomPanelKey } from './locales.ts'
export type { CustomPanelPageInjected, CustomPanelPageProps } from './CustomPanelPage.tsx'

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

/** Services required by the sidebar registration, locale, and panel Remote. */
export const inject = ['slots', 'locale', 'remote', 'remote.tmtPanel']

/**
 * Contribute the Custom entry to the sidebar with the Vue page it opens.
 * @param ctx - the browser plugin context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-custom-panel: dictionaries')
  const t = ctx.locale.bind(NS)

  ctx.slots.inject('main', () => ctx.slots.register({
    name: 'main',
    key: PANEL_ID,
    locale: NS,
    inject: (): CustomPanelPageInjected => ({
      publishSnapshot: snapshot => ctx.remote.tmtPanel.publishSnapshot(snapshot),
      clearSnapshot: () => ctx.remote.tmtPanel.clearSnapshot(),
    }),
  }, CustomPanelPage))

  ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
    name: 'sidebar.panellist',
    id: PANEL_ID,
    order: 20,
    label: () => t('panel'),
    locale: NS,
  }, CustomPanelIcon))
}
