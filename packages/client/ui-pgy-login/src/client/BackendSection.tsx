import { useEffect, useState, type FormEvent } from 'react'
import { Button, Input } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type {
  PgyBackendConfig,
  PgyBackendConfigRequest,
} from '@deepseek-ai/dsh-api-pgy-login/client'
import css from './BackendSection.module.css'

/** Callbacks injected for the settings backend section. */
export interface BackendSectionInjected {
  getBackendConfig(): Promise<RemoteResult<PgyBackendConfig>>
  setBackendConfig(request: PgyBackendConfigRequest): Promise<RemoteResult<PgyBackendConfig>>
}

/** Settings section props for the RuoYi Base URL. */
export type BackendSectionProps =
  & PropsRuntime<'settings.section'>
  & InjectFace<BackendSectionInjected>
  & PropsLocale<'pgyLogin'>

/**
 * Settings page: change the RuoYi Base URL and remount MCP with a new session token.
 */
export function BackendSection(props: BackendSectionProps) {
  const { t, getBackendConfig, setBackendConfig } = props
  const [baseUrl, setBaseUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void getBackendConfig().then((result) => {
      if (cancelled) return
      if (!result.ok) {
        setError(result.error.message)
        setReady(true)
        return
      }
      setBaseUrl(result.value.baseUrl)
      setReady(true)
    })
    return () => { cancelled = true }
  }, [getBackendConfig])

  const onSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    const next = baseUrl.trim()
    if (next === '') return
    setBusy(true)
    setError(null)
    setNotice(null)
    void setBackendConfig({ baseUrl: next }).then((result) => {
      setBusy(false)
      if (!result.ok) {
        setError(result.error.message)
        return
      }
      setBaseUrl(result.value.baseUrl)
      setNotice(t('backendSaved'))
    })
  }

  if (!ready) {
    return <div className={css.section} role="status">{t('loading')}</div>
  }

  return (
    <form className={css.section} onSubmit={onSubmit}>
      <p className={css.subtitle}>{t('backendSubtitle')}</p>
      <label className={css.field}>
        {t('backendUrl')}
        <Input
          value={baseUrl}
          disabled={busy}
          autoComplete="url"
          placeholder={t('backendUrlPlaceholder')}
          onChange={(event) => { setBaseUrl(event.target.value) }}
        />
      </label>
      {error === null ? null : <p className={css.error}>{error}</p>}
      {notice === null ? null : <p className={css.notice}>{notice}</p>}
      <Button type="submit" variant="primary" disabled={busy}>
        {t('backendSave')}
      </Button>
    </form>
  )
}
