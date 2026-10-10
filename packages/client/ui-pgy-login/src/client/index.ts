/** Registers the WMS login overlay, backend settings section, and sidebar sign-out. */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-api-pgy-login/client'
import type {} from '@deepseek-ai/dsh-api-session-controller/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { BackendSection, type BackendSectionInjected } from './BackendSection.tsx'
import { LoginOverlay, type LoginOverlayInjected } from './LoginOverlay.tsx'
import { LogoutButton, type LogoutButtonInjected } from './LogoutButton.tsx'
import { en, zh, type PgyLoginKey } from './locales.ts'

export type { BackendSectionInjected, BackendSectionProps } from './BackendSection.tsx'
export type { LoginOverlayInjected, LoginOverlayProps } from './LoginOverlay.tsx'
export type { LogoutButtonInjected, LogoutButtonProps } from './LogoutButton.tsx'
export type { PgyLoginKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** WMS login overlay, backend settings, and sign-out copy. */
    pgyLogin: PgyLoginKey
  }
}

const NS = 'pgyLogin'

/** Required Client services. */
export const inject = ['slots', 'locale', 'remote', 'remote.pgyLogin', 'sessions']

/**
 * Register dictionaries, login overlay, backend settings section, and logout.
 * @param ctx - Client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-pgy-login: dictionaries')
  const t = ctx.locale.bind(NS)

  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay',
    id: 'pgy-login',
    locale: NS,
    inject: (): LoginOverlayInjected => ({
      status: () => ctx.remote.pgyLogin.status(),
      getBackendConfig: () => ctx.remote.pgyLogin.getBackendConfig(),
      setBackendConfig: request => ctx.remote.pgyLogin.setBackendConfig(request),
      listOrganizations: () => ctx.remote.pgyLogin.listOrganizations(),
      wmsLogin: request => ctx.remote.pgyLogin.wmsLogin(request),
      refreshSessions: () => ctx.sessions.refresh(),
    }),
  }, LoginOverlay))

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'pgy-backend',
    order: 5,
    label: () => t('backendNav'),
    locale: NS,
    inject: (): BackendSectionInjected => ({
      getBackendConfig: () => ctx.remote.pgyLogin.getBackendConfig(),
      setBackendConfig: request => ctx.remote.pgyLogin.setBackendConfig(request),
    }),
  }, BackendSection))

  ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
    name: 'sidebar.footer.action',
    id: 'pgy-logout',
    locale: NS,
    inject: (): LogoutButtonInjected => ({
      logout: () => ctx.remote.pgyLogin.logout(),
    }),
  }, LogoutButton))
}
