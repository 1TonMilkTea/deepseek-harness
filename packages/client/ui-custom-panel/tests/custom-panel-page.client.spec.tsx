// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, waitFor } from '@testing-library/react'
import type { CustomBridge } from '@deepseek-ai/dsh-1tmt-vue'
import { CustomPanelPage } from '../src/client/CustomPanelPage.tsx'
import type { CustomPanelPageProps } from '../src/client/CustomPanelPage.tsx'
import { zh } from '../src/client/locales.ts'

const mountCustomPanel = vi.fn<(el: HTMLElement, bridge: CustomBridge) => void>()
const unmountCustomPanel = vi.fn<(el: HTMLElement) => void>()

vi.mock('@deepseek-ai/dsh-1tmt-vue', () => ({
  mountCustomPanel: (el: HTMLElement, bridge: CustomBridge) => {
    mountCustomPanel(el, bridge)
    el.setAttribute('data-custom-panel', '')
    const title = document.createElement('h1')
    title.textContent = bridge.labels.title
    const intro = document.createElement('p')
    intro.textContent = bridge.labels.intro
    el.replaceChildren(title, intro)
  },
  unmountCustomPanel: (el: HTMLElement) => {
    unmountCustomPanel(el)
    el.replaceChildren()
  },
}))

afterEach(() => {
  cleanup()
  mountCustomPanel.mockReset()
  unmountCustomPanel.mockReset()
})

describe('CustomPanelPage', () => {
  it('mounts the Vue custom panel with labels and snapshot bridge', async () => {
    const publishSnapshot = vi.fn(async () => ({
      ok: true as const,
      value: { hash: 'h1', updatedAt: 1 },
    }))
    const clearSnapshot = vi.fn(async () => ({ ok: true as const, value: undefined }))
    const props = {
      t: (key: keyof typeof zh) => zh[key],
      publishSnapshot,
      clearSnapshot,
    } as CustomPanelPageProps
    const { container, unmount, getByText } = render(<CustomPanelPage {...props} />)
    await waitFor(() => { expect(mountCustomPanel).toHaveBeenCalled() })
    expect(container.querySelector('[data-custom-panel-host]')).not.toBeNull()
    expect(getByText(zh.title)).toBeTruthy()
    expect(getByText(zh.intro)).toBeTruthy()
    const bridge = mountCustomPanel.mock.calls[0]?.[1]
    expect(bridge?.labels).toEqual({
      title: zh.title,
      intro: zh.intro,
      republish: zh.republish,
    })
    expect(typeof bridge?.publishSnapshot).toBe('function')
    expect(typeof bridge?.clearSnapshot).toBe('function')
    unmount()
    expect(unmountCustomPanel).toHaveBeenCalled()
  })
})
