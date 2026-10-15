// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, waitFor } from '@testing-library/react'
import type { CustomWorkbenchBridge } from '@deepseek-ai/dsh-1tmt-vue'
import { CustomWorkbenchPage } from '../src/client/CustomWorkbenchPage.tsx'
import type { CustomWorkbenchPageProps } from '../src/client/CustomWorkbenchPage.tsx'
import { zh } from '../src/client/locales.ts'

const mountCustomWorkbench = vi.fn<(el: HTMLElement, bridge: CustomWorkbenchBridge) => void>()
const unmountCustomWorkbench = vi.fn<(el: HTMLElement) => void>()

vi.mock('@deepseek-ai/dsh-1tmt-vue', () => ({
  mountCustomWorkbench: (el: HTMLElement, bridge: CustomWorkbenchBridge) => {
    mountCustomWorkbench(el, bridge)
    el.setAttribute('data-custom-workbench', '')
    const title = document.createElement('h1')
    title.textContent = bridge.labels.title
    const intro = document.createElement('p')
    intro.textContent = bridge.labels.intro
    el.replaceChildren(title, intro)
  },
  unmountCustomWorkbench: (el: HTMLElement) => {
    unmountCustomWorkbench(el)
    el.replaceChildren()
  },
}))

afterEach(() => {
  cleanup()
  mountCustomWorkbench.mockReset()
  unmountCustomWorkbench.mockReset()
})

describe('CustomWorkbenchPage', () => {
  it('mounts the Vue custom workbench with labels and snapshot bridge', async () => {
    const publishSnapshot = vi.fn(async () => ({
      ok: true as const,
      value: { hash: 'h1', updatedAt: 1 },
    }))
    const clearSnapshot = vi.fn(async () => ({ ok: true as const, value: undefined }))
    const props = {
      t: (key: keyof typeof zh) => zh[key],
      publishSnapshot,
      clearSnapshot,
    } as CustomWorkbenchPageProps
    const { container, unmount, getByText } = render(<CustomWorkbenchPage {...props} />)
    await waitFor(() => { expect(mountCustomWorkbench).toHaveBeenCalled() })
    expect(container.querySelector('[data-custom-workbench-host]')).not.toBeNull()
    expect(getByText(zh.title)).toBeTruthy()
    expect(getByText(zh.intro)).toBeTruthy()
    const bridge = mountCustomWorkbench.mock.calls[0]?.[1]
    expect(bridge?.labels).toEqual({
      title: zh.title,
      intro: zh.intro,
      republish: zh.republish,
    })
    expect(typeof bridge?.publishSnapshot).toBe('function')
    expect(typeof bridge?.clearSnapshot).toBe('function')
    unmount()
    expect(unmountCustomWorkbench).toHaveBeenCalled()
  })
})
