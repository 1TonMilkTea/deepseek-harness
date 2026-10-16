import elementPlusCss from 'element-plus/dist/index.css?inline'
import loginCss from './apps/login/app.css?inline'
import customWorkbenchCss from './apps/custom-workbench/app.css?inline'

/**
 * Inject a stylesheet once per document id.
 * @param id - stable style element id
 * @param css - raw CSS text
 */
function ensureStyle(id: string, css: string): void {
  const existing = document.getElementById(id)
  if (existing !== null) {
    if (existing.textContent !== css) existing.textContent = css
    return
  }
  const el = document.createElement('style')
  el.id = id
  el.textContent = css
  document.head.appendChild(el)
}

/** Install Element Plus + login island CSS. */
export function ensureLoginStyles(): void {
  ensureStyle('dsh-1tmt-element-plus', elementPlusCss)
  ensureStyle('dsh-1tmt-login', loginCss)
}

/** Install Element Plus + custom-workbench island CSS. */
export function ensureCustomWorkbenchStyles(): void {
  ensureStyle('dsh-1tmt-element-plus', elementPlusCss)
  ensureStyle('dsh-1tmt-custom-workbench', customWorkbenchCss)
}
