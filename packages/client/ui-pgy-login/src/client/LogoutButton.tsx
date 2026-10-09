/** Sidebar foot control that signs out the current WMS employee. */

import { useState } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import css from './LogoutButton.module.css'

/** Callbacks the plugin injects for Host logout. */
export interface LogoutButtonInjected {
  logout(): Promise<RemoteResult<void>>
}

/** Full composed props for the sidebar logout action. */
export type LogoutButtonProps =
  & PropsRuntime<'sidebar.footer.action'>
  & InjectFace<LogoutButtonInjected>
  & PropsLocale<'pgyLogin'>

/**
 * Sign-out control in the sidebar foot. After Host logout succeeds, reloads
 * the page so the login overlay mounts against a cleared employee gate.
 * @param props - column width, locale, and Remote logout.
 * @returns a footer button.
 */
export function LogoutButton(props: LogoutButtonProps) {
  const { t, wide, logout } = props
  const [busy, setBusy] = useState(false)

  const onClick = (): void => {
    if (busy) return
    setBusy(true)
    void logout().then((result) => {
      if (!result.ok) {
        setBusy(false)
        return
      }
      window.location.reload()
    })
  }

  return (
    <Button
      type="button"
      variant="ghost"
      className={wide ? css.wide : css.rail}
      disabled={busy}
      aria-label={t('logout')}
      title={t('logout')}
      onClick={onClick}
    >
      {wide ? t('logout') : t('logoutShort')}
    </Button>
  )
}
