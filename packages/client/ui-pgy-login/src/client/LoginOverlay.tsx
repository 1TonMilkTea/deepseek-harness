import { useEffect, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { Button, Input } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type {
  PgyBackendConfig,
  PgyBackendConfigRequest,
  PgyLoginStatus,
  PgyOrganization,
  PgyOrganizationList,
  PgyWmsLoginRequest,
  PgyWmsLoginValue,
} from '@deepseek-ai/dsh-api-pgy-login/client'
import css from './LoginOverlay.module.css'

/** Callbacks the plugin injects from `ctx.remote.pgyLogin` and sessions. */
export interface LoginOverlayInjected {
  status(): Promise<RemoteResult<PgyLoginStatus>>
  getBackendConfig(): Promise<RemoteResult<PgyBackendConfig>>
  setBackendConfig(request: PgyBackendConfigRequest): Promise<RemoteResult<PgyBackendConfig>>
  listOrganizations(): Promise<RemoteResult<PgyOrganizationList>>
  wmsLogin(request: PgyWmsLoginRequest): Promise<RemoteResult<PgyWmsLoginValue>>
  /** Reload the sidebar Session list after a successful login binds the employee root. */
  refreshSessions(): Promise<void>
}

/** Full composed props for the login overlay. */
export type LoginOverlayProps =
  & PropsRuntime<'shell.overlay'>
  & InjectFace<LoginOverlayInjected>
  & PropsLocale<'pgyLogin'>

type Phase = 'loading' | 'backend' | 'login'

/**
 * Fullscreen gate: RuoYi Base URL (when missing), then WMS login.
 * @param props - locale seat plus Remote callbacks.
 * @returns a body portal while this process is not logged in, otherwise null.
 */
export function LoginOverlay(props: LoginOverlayProps) {
  const {
    t, status, getBackendConfig, setBackendConfig, listOrganizations, wmsLogin, refreshSessions,
  } = props
  const [loggedIn, setLoggedIn] = useState(false)
  const [phase, setPhase] = useState<Phase>('loading')
  const [baseUrlDraft, setBaseUrlDraft] = useState('')
  const [organizations, setOrganizations] = useState<readonly PgyOrganization[]>([])
  const [orgId, setOrgId] = useState('')
  const [staffNumber, setStaffNumber] = useState('')
  const [wmsPassword, setWmsPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const appRoot = document.getElementById('root')
    if (appRoot === null || loggedIn) return
    appRoot.inert = true
    return () => { appRoot.inert = false }
  }, [loggedIn])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const current = await status()
      if (cancelled) return
      if (!current.ok) {
        setError(current.error.message)
        setPhase('backend')
        return
      }
      if (current.value.loggedIn) {
        await refreshSessions()
        if (cancelled) return
        setLoggedIn(true)
        return
      }
      const backend = await getBackendConfig()
      if (cancelled) return
      if (!backend.ok) {
        setError(backend.error.message)
        setPhase('backend')
        return
      }
      setBaseUrlDraft(backend.value.baseUrl)
      if (!backend.value.configured) {
        setPhase('backend')
        return
      }
      const listed = await listOrganizations()
      if (cancelled) return
      if (!listed.ok) {
        setError(listed.error.message)
        setPhase('backend')
        return
      }
      setOrganizations(listed.value.organizations)
      setPhase('login')
    })()
    return () => { cancelled = true }
  }, [status, getBackendConfig, listOrganizations, refreshSessions])

  if (loggedIn) return null
  if (phase === 'loading') {
    return createPortal((
      <div className={css.gate} role="status">{t('loading')}</div>
    ), document.body)
  }

  const onBackendSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    const next = baseUrlDraft.trim()
    if (next === '') return
    setBusy(true)
    setError(null)
    void setBackendConfig({ baseUrl: next }).then(async (saved) => {
      if (!saved.ok) {
        setBusy(false)
        setError(saved.error.message)
        return
      }
      setBaseUrlDraft(saved.value.baseUrl)
      const listed = await listOrganizations()
      setBusy(false)
      if (!listed.ok) {
        setError(listed.error.message)
        return
      }
      setOrganizations(listed.value.organizations)
      setPhase('login')
    })
  }

  const onLoginSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    const id = Number(orgId)
    if (!Number.isFinite(id) || staffNumber.trim() === '' || wmsPassword === '') return
    setBusy(true)
    setError(null)
    void wmsLogin({ orgId: id, staffNumber: staffNumber.trim(), wmsPassword }).then(async (result) => {
      if (!result.ok) {
        setBusy(false)
        setError(result.error.message)
        return
      }
      await refreshSessions()
      setBusy(false)
      setLoggedIn(true)
    })
  }

  if (phase === 'backend') {
    return createPortal((
      <div className={css.gate} role="dialog" aria-labelledby="pgy-backend-title">
        <form className={css.card} onSubmit={onBackendSubmit}>
          <h1 id="pgy-backend-title" className={css.title}>{t('backendTitle')}</h1>
          <p className={css.subtitle}>{t('backendSubtitle')}</p>
          <label className={css.field}>
            {t('backendUrl')}
            <Input
              value={baseUrlDraft}
              disabled={busy}
              autoComplete="url"
              placeholder={t('backendUrlPlaceholder')}
              onChange={(event) => { setBaseUrlDraft(event.target.value) }}
            />
          </label>
          {error === null ? null : <p className={css.error}>{error}</p>}
          <Button type="submit" variant="primary" className={css.submit} disabled={busy}>
            {t('backendSubmit')}
          </Button>
        </form>
      </div>
    ), document.body)
  }

  return createPortal((
    <div className={css.gate} role="dialog" aria-labelledby="pgy-login-title">
      <form className={css.card} onSubmit={onLoginSubmit}>
        <h1 id="pgy-login-title" className={css.title}>{t('title')}</h1>
        <p className={css.subtitle}>{t('subtitle')}</p>
        <label className={css.field}>
          {t('org')}
          <select
            className={css.select}
            value={orgId}
            disabled={busy}
            onChange={(event) => { setOrgId(event.target.value) }}
          >
            <option value="">{t('orgPlaceholder')}</option>
            {organizations.map(organization => (
              <option key={organization.id} value={String(organization.id)}>{organization.name}</option>
            ))}
          </select>
        </label>
        <label className={css.field}>
          {t('staffNumber')}
          <Input
            value={staffNumber}
            disabled={busy}
            autoComplete="username"
            placeholder={t('staffNumberPlaceholder')}
            onChange={(event) => { setStaffNumber(event.target.value) }}
          />
        </label>
        <label className={css.field}>
          {t('password')}
          <Input
            type="password"
            value={wmsPassword}
            disabled={busy}
            autoComplete="current-password"
            placeholder={t('passwordPlaceholder')}
            onChange={(event) => { setWmsPassword(event.target.value) }}
          />
        </label>
        {error === null ? null : <p className={css.error}>{error}</p>}
        <Button type="submit" variant="primary" className={css.submit} disabled={busy}>
          {t('submit')}
        </Button>
        <button
          type="button"
          className={css.linkButton}
          disabled={busy}
          onClick={() => {
            setError(null)
            setPhase('backend')
          }}
        >
          {t('editBackend')}
        </button>
      </form>
    </div>
  ), document.body)
}
