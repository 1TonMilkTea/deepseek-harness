import { createApp, type App } from 'vue'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import { BRIDGE_KEY, type CustomWorkbenchBridge, type LoginBridge } from './bridge.js'
import LoginApp from './apps/login/App.vue'
import CustomWorkbenchApp from './apps/custom-workbench/App.vue'
import { ensureCustomWorkbenchStyles, ensureLoginStyles } from './styles.js'

const loginApps = new WeakMap<HTMLElement, App>()
const customWorkbenchApps = new WeakMap<HTMLElement, App>()

/**
 * Mount the Element Plus login gate into `el`.
 * @param el - host element owned by the React portal
 * @param bridge - Remote callbacks and localized labels
 */
export function mountLogin(el: HTMLElement, bridge: LoginBridge): void {
  unmountLogin(el)
  ensureLoginStyles()
  const app = createApp(LoginApp)
  app.provide(BRIDGE_KEY, bridge)
  app.use(ElementPlus, { locale: zhCn })
  app.mount(el)
  loginApps.set(el, app)
}

/**
 * Tear down a login island previously mounted on `el`.
 * @param el - host element
 */
export function unmountLogin(el: HTMLElement): void {
  const app = loginApps.get(el)
  if (app === undefined) return
  app.unmount()
  loginApps.delete(el)
  el.replaceChildren()
}

/**
 * Mount the custom workbench into `el`.
 * @param el - host element owned by the React main panel
 * @param bridge - localized labels and snapshot publish callbacks
 */
export function mountCustomWorkbench(el: HTMLElement, bridge: CustomWorkbenchBridge): void {
  unmountCustomWorkbench(el)
  ensureCustomWorkbenchStyles()
  const app = createApp(CustomWorkbenchApp)
  app.provide(BRIDGE_KEY, bridge)
  app.use(ElementPlus, { locale: zhCn })
  app.mount(el)
  customWorkbenchApps.set(el, app)
}

/**
 * Tear down a custom-workbench island previously mounted on `el`.
 * @param el - host element
 */
export function unmountCustomWorkbench(el: HTMLElement): void {
  const app = customWorkbenchApps.get(el)
  if (app === undefined) return
  app.unmount()
  customWorkbenchApps.delete(el)
  el.replaceChildren()
}
