/** React host that mounts the Vue custom-workbench island (left half of the split). */

import { useEffect, useMemo, useRef } from 'react'
import {
  mountCustomWorkbench,
  unmountCustomWorkbench,
  type CustomWorkbenchBridge,
  type CustomWorkbenchSnapshot,
} from '@deepseek-ai/dsh-1tmt-vue'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type {
  CustomWorkbenchPublishResult,
} from '@deepseek-ai/dsh-1tmt-workbench/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import css from './CustomWorkbenchPage.module.css'

/** Callbacks the plugin injects from `ctx.remote.tmtWorkbench`. */
export interface CustomWorkbenchPageInjected {
  readonly publishSnapshot: (snapshot: CustomWorkbenchSnapshot) => Promise<RemoteResult<CustomWorkbenchPublishResult>>
  readonly clearSnapshot: () => Promise<RemoteResult<void>>
}

/** Framework props for the custom workbench main panel. */
export type CustomWorkbenchPageProps =
  & PropsRuntime<'main'>
  & InjectFace<CustomWorkbenchPageInjected>
  & PropsLocale<'customWorkbench'>

/**
 * Mount the Vue Element Plus custom workbench that fills its split pane.
 * @param props - localized copy plus Remote snapshot callbacks.
 * @returns a host element for the Vue island.
 */
export function CustomWorkbenchPage({ t, publishSnapshot, clearSnapshot }: CustomWorkbenchPageProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const bridge = useMemo((): CustomWorkbenchBridge => ({
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
    mountCustomWorkbench(el, bridge)
    return () => { unmountCustomWorkbench(el) }
  }, [bridge])

  return <div ref={hostRef} className={css.root} data-custom-workbench-host />
}
