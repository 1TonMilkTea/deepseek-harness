/** React host that mounts the Vue custom-workbench island (left half of the split). */

import { useEffect, useMemo, useRef } from 'react'
import {
  mountCustomWorkbench,
  unmountCustomWorkbench,
  type CustomWorkbenchBridge,
  type CustomWorkbenchSnapshot,
  type WorkbenchEmployee,
  type WorkbenchMcpObject,
} from '@deepseek-ai/dsh-1tmt-vue'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type {
  CustomWorkbenchPublishResult,
} from '@deepseek-ai/dsh-1tmt-workbench/client'
import type { PgyMcpObject } from '@deepseek-ai/dsh-api-pgy-pur-receive/types'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import css from './CustomWorkbenchPage.module.css'

/** Callbacks the plugin injects from Host Remotes. */
export interface CustomWorkbenchPageInjected {
  readonly publishSnapshot: (snapshot: CustomWorkbenchSnapshot) => Promise<RemoteResult<CustomWorkbenchPublishResult>>
  readonly clearSnapshot: () => Promise<RemoteResult<void>>
  readonly getEmployee: () => Promise<RemoteResult<WorkbenchEmployee | null>>
  readonly listBills: (request: {
    readonly filterString?: string
    readonly limit?: number
    readonly startRow?: number
  }) => Promise<RemoteResult<PgyMcpObject>>
  readonly viewBill: (request: {
    readonly formId: string
    readonly id: number
  }) => Promise<RemoteResult<PgyMcpObject>>
  readonly entityOutputs: (request: {
    readonly orgId?: number
    readonly id?: number
    readonly billNo?: string
  }) => Promise<RemoteResult<PgyMcpObject>>
  readonly getBarcode: (request: {
    readonly orgId?: number
    readonly barcode: string
  }) => Promise<RemoteResult<PgyMcpObject>>
  readonly getStockInfo: (request: {
    readonly orgId?: number
    readonly number: string
  }) => Promise<RemoteResult<PgyMcpObject>>
  readonly submitReport: (request: {
    readonly inputJson: string
  }) => Promise<RemoteResult<PgyMcpObject>>
}

/** Framework props for the custom workbench main panel. */
export type CustomWorkbenchPageProps =
  & PropsRuntime<'main'>
  & InjectFace<CustomWorkbenchPageInjected>
  & PropsLocale<'customWorkbench'>

function toBridgeResult<T>(result: RemoteResult<T>):
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: { readonly message: string } } {
  if (result.ok) return result
  return { ok: false, error: { message: result.error.message } }
}

function asWorkbenchObject(value: PgyMcpObject): WorkbenchMcpObject {
  return value as WorkbenchMcpObject
}

/**
 * Mount the Vue Element Plus custom workbench that fills its split pane.
 * @param props - localized copy plus Remote callbacks.
 * @returns a host element for the Vue island.
 */
export function CustomWorkbenchPage({
  t,
  publishSnapshot,
  clearSnapshot,
  getEmployee,
  listBills,
  viewBill,
  entityOutputs,
  getBarcode,
  getStockInfo,
  submitReport,
}: CustomWorkbenchPageProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const bridge = useMemo((): CustomWorkbenchBridge => ({
    labels: {
      title: t('title'),
      menuPurchase: t('menuPurchase'),
      menuPurReceive: t('menuPurReceive'),
      billNo: t('billNo'),
      billNoPlaceholder: t('billNoPlaceholder'),
      query: t('query'),
      open: t('open'),
      back: t('back'),
      backHome: t('backHome'),
      backStep: t('backStep'),
      barcode: t('barcode'),
      barcodePlaceholder: t('barcodePlaceholder'),
      stockCode: t('stockCode'),
      stockCodePlaceholder: t('stockCodePlaceholder'),
      addBarcode: t('addBarcode'),
      resolveStock: t('resolveStock'),
      confirmInbound: t('confirmInbound'),
      submit: t('submit'),
      cancel: t('cancel'),
      qty: t('qty'),
      loading: t('loading'),
      emptyList: t('emptyList'),
      emptyEntries: t('emptyEntries'),
      segList: t('segList'),
      segEntries: t('segEntries'),
      segBarcodes: t('segBarcodes'),
      openBillFirst: t('openBillFirst'),
      noSelection: t('noSelection'),
      selectedPrefix: t('selectedPrefix'),
      lastInput: t('lastInput'),
      unmatchedEntry: t('unmatchedEntry'),
      barcodeMissing: t('barcodeMissing'),
    },
    publishSnapshot: async snapshot => toBridgeResult(await publishSnapshot(snapshot)),
    clearSnapshot: async () => toBridgeResult(await clearSnapshot()),
    getEmployee: async () => toBridgeResult(await getEmployee()),
    listBills: async (request) => {
      const result = await listBills(request)
      if (!result.ok) return toBridgeResult(result)
      return { ok: true, value: asWorkbenchObject(result.value) }
    },
    viewBill: async (request) => {
      const result = await viewBill(request)
      if (!result.ok) return toBridgeResult(result)
      return { ok: true, value: asWorkbenchObject(result.value) }
    },
    entityOutputs: async (request) => {
      const result = await entityOutputs(request)
      if (!result.ok) return toBridgeResult(result)
      return { ok: true, value: asWorkbenchObject(result.value) }
    },
    getBarcode: async (request) => {
      const result = await getBarcode(request)
      if (!result.ok) return toBridgeResult(result)
      return { ok: true, value: asWorkbenchObject(result.value) }
    },
    getStockInfo: async (request) => {
      const result = await getStockInfo(request)
      if (!result.ok) return toBridgeResult(result)
      return { ok: true, value: asWorkbenchObject(result.value) }
    },
    submitReport: async (request) => {
      const result = await submitReport(request)
      if (!result.ok) return toBridgeResult(result)
      return { ok: true, value: asWorkbenchObject(result.value) }
    },
  }), [
    t, publishSnapshot, clearSnapshot, getEmployee, listBills, viewBill,
    entityOutputs, getBarcode, getStockInfo, submitReport,
  ])

  useEffect(() => {
    const el = hostRef.current
    if (el === null) return
    mountCustomWorkbench(el, bridge)
    return () => { unmountCustomWorkbench(el) }
  }, [bridge])

  return <div ref={hostRef} className={css.root} data-custom-workbench-host />
}
