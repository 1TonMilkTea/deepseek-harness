/** Registers the WMS login overlay and sidebar sign-out action. */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-api-pgy-login/client'
import type {} from '@deepseek-ai/dsh-api-session-controller/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import { LoginOverlay, type LoginOverlayInjected } from './LoginOverlay.tsx'
import { LogoutButton, type LogoutButtonInjected } from './LogoutButton.tsx'
import { en, zh, type PgyLoginKey } from './locales.ts'

export type { LoginOverlayInjected, LoginOverlayProps } from './LoginOverlay.tsx'
export type { LogoutButtonInjected, LogoutButtonProps } from './LogoutButton.tsx'
export type { PgyLoginKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** WMS login overlay and sign-out copy. */
    pgyLogin: PgyLoginKey
  }
}

const NS = 'pgyLogin'

/** Required Client services. */
export const inject = ['slots', 'locale', 'remote', 'remote.pgyLogin', 'sessions']

/**
 * Register dictionaries, the fullscreen login overlay, and the sidebar logout action.
 * @param ctx - Client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-pgy-login: dictionaries')
  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay',
    id: 'pgy-login',
    locale: NS,
    inject: (): LoginOverlayInjected => ({
      status: () => ctx.remote.pgyLogin.status(),
      listOrganizations: () => ctx.remote.pgyLogin.listOrganizations(),
      wmsLogin: request => ctx.remote.pgyLogin.wmsLogin(request),
      refreshSessions: () => ctx.sessions.refresh(),
    }),
  }, LoginOverlay))
  ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
    name: 'sidebar.footer.action',
    id: 'pgy-logout',
    locale: NS,
    inject: (): LogoutButtonInjected => ({
      logout: () => ctx.remote.pgyLogin.logout(),
    }),
  }, LogoutButton))
}
