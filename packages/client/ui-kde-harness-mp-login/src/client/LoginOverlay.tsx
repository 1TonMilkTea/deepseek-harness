import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  mountLogin,
  unmountLogin,
  type LoginBridge,
  type LoginLabels,
} from '@deepseek-ai/dsh-1tmt-vue'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type {
  KdeHarnessMpBackendConfig,
  KdeHarnessMpBackendConfigRequest,
  KdeHarnessMpLoginStatus,
  KdeHarnessMpOrganizationList,
  KdeHarnessMpLoginRequest,
  KdeHarnessMpLoginValue,
} from '@deepseek-ai/dsh-api-kde-harness-mp-login/client'
import css from './LoginOverlay.module.css'

/** Callbacks the plugin injects from `ctx.remote.kdeHarnessMpLogin` and sessions. */
export interface LoginOverlayInjected {
  status(): Promise<RemoteResult<KdeHarnessMpLoginStatus>>
  getBackendConfig(): Promise<RemoteResult<KdeHarnessMpBackendConfig>>
  setBackendConfig(request: KdeHarnessMpBackendConfigRequest): Promise<RemoteResult<KdeHarnessMpBackendConfig>>
  listOrganizations(): Promise<RemoteResult<KdeHarnessMpOrganizationList>>
  harnessLogin(request: KdeHarnessMpLoginRequest): Promise<RemoteResult<KdeHarnessMpLoginValue>>
  /** Reload the sidebar Session list after a successful login binds the employee root. */
  refreshSessions(): Promise<void>
}

/** Full composed props for the login overlay. */
export type LoginOverlayProps =
  & PropsRuntime<'shell.overlay'>
  & InjectFace<LoginOverlayInjected>
  & PropsLocale<'kdeHarnessMpLogin'>

/**
 * Fullscreen gate host: mounts the Vue Element Plus login island.
 * @param props - locale seat plus Remote callbacks.
 * @returns a body portal while this process is not logged in, otherwise null.
 */
export function LoginOverlay(props: LoginOverlayProps) {
  const {
    t, status, getBackendConfig, setBackendConfig, listOrganizations, harnessLogin, refreshSessions,
  } = props
  const hostRef = useRef<HTMLDivElement>(null)
  const [loggedIn, setLoggedIn] = useState(false)

  const labels = useMemo((): LoginLabels => ({
    title: t('title'),
    subtitle: t('subtitle'),
    org: t('org'),
    orgPlaceholder: t('orgPlaceholder'),
    staffNumber: t('staffNumber'),
    staffNumberPlaceholder: t('staffNumberPlaceholder'),
    password: t('password'),
    passwordPlaceholder: t('passwordPlaceholder'),
    submit: t('submit'),
    loading: t('loading'),
    backendTitle: t('backendTitle'),
    backendSubtitle: t('backendSubtitle'),
    backendUrl: t('backendUrl'),
    backendUrlPlaceholder: t('backendUrlPlaceholder'),
    backendSubmit: t('backendSubmit'),
    editBackend: t('editBackend'),
  }), [t])

  useEffect(() => {
    const appRoot = document.getElementById('root')
    if (appRoot === null || loggedIn) return
    appRoot.inert = true
    return () => { appRoot.inert = false }
  }, [loggedIn])

  useEffect(() => {
    const el = hostRef.current
    if (el === null || loggedIn) return

    const bridge: LoginBridge = {
      labels,
      status,
      getBackendConfig,
      setBackendConfig,
      listOrganizations,
      harnessLogin,
      refreshSessions,
      onLoggedIn: () => { setLoggedIn(true) },
    }
    mountLogin(el, bridge)
    return () => { unmountLogin(el) }
  }, [
    loggedIn,
    labels,
    status,
    getBackendConfig,
    setBackendConfig,
    listOrganizations,
    harnessLogin,
    refreshSessions,
  ])

  if (loggedIn) return null
  return createPortal((
    <div ref={hostRef} className={css.host} data-1tmt-login-host />
  ), document.body)
}
