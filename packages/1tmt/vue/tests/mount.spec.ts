// @vitest-environment jsdom
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BridgeResult, CustomWorkbenchBridge, LoginBridge } from '../types/index.d.ts'

const libEntry = join(dirname(fileURLToPath(import.meta.url)), '../lib/index.js')
const hasLib = existsSync(libEntry)

afterEach(() => {
  document.body.replaceChildren()
  document.head.querySelectorAll('style[id^="dsh-1tmt-"]').forEach((node) => { node.remove() })
})

function workbenchLabels(): CustomWorkbenchBridge['labels'] {
  return {
    title: 'Custom',
    menuPurchase: 'Purchase',
    menuPurReceive: 'Inbound',
    billNo: 'Bill',
    billNoPlaceholder: 'bill',
    query: 'Search',
    open: 'Open',
    back: 'Back',
    backHome: 'Home',
    backStep: 'Up',
    barcode: 'Barcode',
    barcodePlaceholder: 'code',
    stockCode: 'Stock',
    stockCodePlaceholder: 'stock',
    addBarcode: 'Add',
    resolveStock: 'Resolve',
    confirmInbound: 'Confirm',
    submit: 'Submit',
    cancel: 'Cancel',
    qty: 'Qty',
    loading: 'Loading',
    emptyList: 'Empty list',
    emptyEntries: 'Empty entries',
    segList: 'List',
    segEntries: 'Lines',
    segBarcodes: 'Barcodes',
    openBillFirst: 'Open a bill',
    noSelection: 'Select a line',
    selectedPrefix: 'Selected',
    lastInput: 'Last',
    unmatchedEntry: 'No match',
    barcodeMissing: 'Missing barcode',
  }
}

describe.skipIf(!hasLib)('1tmt-vue mount helpers', () => {
  it('mounts and unmounts the login island without leaving children', async () => {
    const {
      mountLogin,
      unmountLogin,
    } = await import(pathToFileURL(libEntry).href) as typeof import('@deepseek-ai/dsh-1tmt-vue')
    const el = document.createElement('div')
    document.body.appendChild(el)
    const bridge: LoginBridge = {
      labels: {
        title: 'Staff login',
        subtitle: 'sub',
        org: 'Org',
        orgPlaceholder: 'Select',
        staffNumber: 'Staff',
        staffNumberPlaceholder: 'staff',
        password: 'Password',
        passwordPlaceholder: 'pass',
        submit: 'Sign in',
        loading: 'Loading…',
        backendTitle: 'Backend',
        backendSubtitle: 'url',
        backendUrl: 'URL',
        backendUrlPlaceholder: 'http://',
        backendSubmit: 'Save',
        editBackend: 'Edit',
      },
      status: vi.fn(() => new Promise<BridgeResult<{ readonly loggedIn: boolean }>>(() => {})),
      getBackendConfig: vi.fn(async () => ({
        ok: true as const,
        value: { baseUrl: 'http://127.0.0.1:8080', configured: true },
      })),
      setBackendConfig: vi.fn(async () => ({
        ok: true as const,
        value: { baseUrl: 'http://127.0.0.1:8080', configured: true },
      })),
      listOrganizations: vi.fn(async () => ({
        ok: true as const,
        value: { organizations: [{ id: 1, name: 'A', number: 'A' }] },
      })),
      wmsLogin: vi.fn(async () => ({ ok: true as const, value: {} })),
      refreshSessions: vi.fn(async () => {}),
      onLoggedIn: vi.fn(),
    }
    mountLogin(el, bridge)
    expect(el.childNodes.length).toBeGreaterThan(0)
    unmountLogin(el)
    expect(el.childNodes.length).toBe(0)
  })

  it('mounts and unmounts the custom workbench island', async () => {
    const {
      mountCustomWorkbench,
      unmountCustomWorkbench,
    } = await import(pathToFileURL(libEntry).href) as typeof import('@deepseek-ai/dsh-1tmt-vue')
    const el = document.createElement('div')
    document.body.appendChild(el)
    const publishSnapshot = vi.fn(async () => ({
      ok: true as const,
      value: { hash: 'abc', updatedAt: 1 },
    }))
    const clearSnapshot = vi.fn(async () => ({ ok: true as const, value: undefined }))
    const listBills = vi.fn(async () => ({
      ok: true as const,
      value: { status: 'ok', rows: [] },
    }))
    const bridge: CustomWorkbenchBridge = {
      labels: workbenchLabels(),
      publishSnapshot,
      clearSnapshot,
      getEmployee: vi.fn(async () => ({ ok: true as const, value: null })),
      listBills,
      viewBill: vi.fn(async () => ({ ok: true as const, value: {} })),
      entityOutputs: vi.fn(async () => ({ ok: true as const, value: { rows: [] } })),
      getBarcode: vi.fn(async () => ({ ok: true as const, value: {} })),
      getStockInfo: vi.fn(async () => ({ ok: true as const, value: {} })),
      submitReport: vi.fn(async () => ({ ok: true as const, value: {} })),
    }
    mountCustomWorkbench(el, bridge)
    expect(el.querySelector('[data-custom-workbench]')).not.toBeNull()
    expect(el.textContent).toContain('Custom')
    expect(el.querySelector('[data-workbench-entry="pur-receive"]')).not.toBeNull()
    expect(listBills).not.toHaveBeenCalled()
    const entry = el.querySelector('[data-workbench-entry="pur-receive"]')
    expect(entry).not.toBeNull()
    entry?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await vi.waitFor(() => { expect(listBills).toHaveBeenCalled() })
    unmountCustomWorkbench(el)
    expect(clearSnapshot).toHaveBeenCalled()
    expect(el.childNodes.length).toBe(0)
  })
})
