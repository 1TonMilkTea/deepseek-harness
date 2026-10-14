/** Vue SFC module declarations for the Vite library build. */
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}

declare module '*.css?inline' {
  const css: string
  export default css
}
