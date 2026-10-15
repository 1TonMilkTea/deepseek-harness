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
    const menu = document.createElement('p')
    menu.textContent = bridge.labels.menuPurReceive
    el.replaceChildren(title, menu)
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
  it('mounts the Vue custom workbench with labels and purchase-inbound bridge', async () => {
    const publishSnapshot = vi.fn(async () => ({
      ok: true as const,
      value: { hash: 'h1', updatedAt: 1 },
    }))
    const clearSnapshot = vi.fn(async () => ({ ok: true as const, value: undefined }))
    const getEmployee = vi.fn(async () => ({ ok: true as const, value: null }))
    const listBills = vi.fn(async () => ({ ok: true as const, value: { status: 'ok', rows: [] } }))
    const viewBill = vi.fn(async () => ({ ok: true as const, value: {} }))
    const entityOutputs = vi.fn(async () => ({ ok: true as const, value: { rows: [] } }))
    const getBarcode = vi.fn(async () => ({ ok: true as const, value: {} }))
    const getStockInfo = vi.fn(async () => ({ ok: true as const, value: {} }))
    const submitReport = vi.fn(async () => ({ ok: true as const, value: {} }))
    const props = {
      t: (key: keyof typeof zh) => zh[key],
      publishSnapshot,
      clearSnapshot,
      getEmployee,
      listBills,
      viewBill,
      entityOutputs,
      getBarcode,
      getStockInfo,
      submitReport,
    } as CustomWorkbenchPageProps
    const { container, unmount, getByText } = render(<CustomWorkbenchPage {...props} />)
    await waitFor(() => { expect(mountCustomWorkbench).toHaveBeenCalled() })
    expect(container.querySelector('[data-custom-workbench-host]')).not.toBeNull()
    expect(getByText(zh.title)).toBeTruthy()
    expect(getByText(zh.menuPurReceive)).toBeTruthy()
    const bridge = mountCustomWorkbench.mock.calls[0]?.[1]
    expect(bridge?.labels.title).toBe(zh.title)
    expect(bridge?.labels.menuPurReceive).toBe(zh.menuPurReceive)
    expect(typeof bridge?.listBills).toBe('function')
    expect(typeof bridge?.submitReport).toBe('function')
    unmount()
    expect(unmountCustomWorkbench).toHaveBeenCalled()
  })
})
