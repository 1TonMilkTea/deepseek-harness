import { defineConfig } from 'tsdown'

/** Vite owns `lib/index.js`; skip the root Host/Client tsdown workspace entry. */
export default defineConfig({
  entry: '',
})
