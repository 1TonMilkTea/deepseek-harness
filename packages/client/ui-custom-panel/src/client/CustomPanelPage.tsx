/** React host that mounts the Vue custom-panel island (left half of the split). */

import { useEffect, useMemo, useRef } from 'react'
import {
  mountCustomPanel,
  unmountCustomPanel,
  type CustomBridge,
  type CustomPanelSnapshot,
} from '@deepseek-ai/dsh-1tmt-vue'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type {
  CustomPanelPublishResult,
} from '@deepseek-ai/dsh-1tmt-panel/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import css from './CustomPanelPage.module.css'

/** Callbacks the plugin injects from `ctx.remote.tmtPanel`. */
export interface CustomPanelPageInjected {
  publishSnapshot(snapshot: CustomPanelSnapshot): Promise<RemoteResult<CustomPanelPublishResult>>
  clearSnapshot(): Promise<RemoteResult<void>>
}

/** Framework props for the custom main panel. */
export type CustomPanelPageProps =
  & PropsRuntime<'main'>
  & InjectFace<CustomPanelPageInjected>
  & PropsLocale<'customPanel'>

/**
 * Mount the Vue Element Plus custom-work panel that fills its split pane.
 * @param props - localized copy plus Remote snapshot callbacks.
 * @returns a host element for the Vue island.
 */
export function CustomPanelPage({ t, publishSnapshot, clearSnapshot }: CustomPanelPageProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const bridge = useMemo((): CustomBridge => ({
    labels: {
      title: t('title'),
      intro: t('intro'),
      republish: t('republish'),
    },
    publishSnapshot: async (snapshot) => {
      const result = await publishSnapshot(snapshot)
      if (result.ok) return result
      return { ok: false, error: { message: result.error.message } }
    },
    clearSnapshot: async () => {
      const result = await clearSnapshot()
      if (result.ok) return result
      return { ok: false, error: { message: result.error.message } }
    },
  }), [t, publishSnapshot, clearSnapshot])

  useEffect(() => {
    const el = hostRef.current
    if (el === null) return
    mountCustomPanel(el, bridge)
    return () => { unmountCustomPanel(el) }
  }, [bridge])

  return <div ref={hostRef} className={css.root} data-custom-panel-host />
}
