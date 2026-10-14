/** React host that mounts the Vue custom-panel island (left half of the split). */

import { useEffect, useMemo, useRef } from 'react'
import {
  mountCustomPanel,
  unmountCustomPanel,
  type CustomBridge,
} from '@deepseek-ai/dsh-1tmt-vue'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import css from './CustomPanelPage.module.css'

/** Framework props for the custom main panel. */
export type CustomPanelPageProps = PropsRuntime<'main'> & PropsLocale<'customPanel'>

/**
 * Mount the Vue Element Plus custom-work placeholder that fills its split pane.
 * @param props - localized title and intro copy.
 * @returns a host element for the Vue island.
 */
export function CustomPanelPage({ t }: CustomPanelPageProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const bridge = useMemo((): CustomBridge => ({
    labels: {
      title: t('title'),
      intro: t('intro'),
    },
  }), [t])

  useEffect(() => {
    const el = hostRef.current
    if (el === null) return
    mountCustomPanel(el, bridge)
    return () => { unmountCustomPanel(el) }
  }, [bridge])

  return <div ref={hostRef} className={css.root} data-custom-panel-host />
}
