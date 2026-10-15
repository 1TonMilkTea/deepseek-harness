import { createApp, type App } from 'vue'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import { BRIDGE_KEY, type CustomBridge, type LoginBridge } from './bridge.js'
import LoginApp from './apps/login/App.vue'
import CustomPanelApp from './apps/custom-panel/App.vue'
import { ensureCustomPanelStyles, ensureLoginStyles } from './styles.js'

const loginApps = new WeakMap<HTMLElement, App>()
const customApps = new WeakMap<HTMLElement, App>()

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
 * Mount the custom half-panel into `el`.
 * @param el - host element owned by the React main panel
 * @param bridge - localized labels and snapshot publish callbacks
 */
export function mountCustomPanel(el: HTMLElement, bridge: CustomBridge): void {
  unmountCustomPanel(el)
  ensureCustomPanelStyles()
  const app = createApp(CustomPanelApp)
  app.provide(BRIDGE_KEY, bridge)
  app.use(ElementPlus, { locale: zhCn })
  app.mount(el)
  customApps.set(el, app)
}

/**
 * Tear down a custom-panel island previously mounted on `el`.
 * @param el - host element
 */
export function unmountCustomPanel(el: HTMLElement): void {
  const app = customApps.get(el)
  if (app === undefined) return
  app.unmount()
  customApps.delete(el)
  el.replaceChildren()
}
