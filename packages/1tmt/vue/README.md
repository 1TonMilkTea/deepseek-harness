---
description: "Vue 3 + Element Plus islands for 1tmt login and custom panel UI."
kind: "package-reference"
---

# @deepseek-ai/dsh-1tmt-vue

## Summary

Self-contained Vue 3 + Element Plus (MIT) UI islands for the 1tmt product pages: fullscreen WMS login and the custom half-panel placeholder. React Cordis hosts call `mountLogin` / `mountCustomPanel` and pass a typed bridge; Vue never imports Cordis. Product work on these screens should change this package only. For day-to-day extension steps (build, bridge, do-not-touch), use the Chinese developer guide [docs/1tmt/README.md](../../../docs/1tmt/README.md).

## Table of Contents

- [Use this package](#use-this-package)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)

-----

<a id="use-this-package"></a>
## Use this package

```sh
pnpm --filter @deepseek-ai/dsh-1tmt-vue build
```

React hosts import the built `lib/index.js` entry:

- `mountLogin(el, bridge)` / `unmountLogin(el)`
- `mountCustomPanel(el, bridge?)` / `unmountCustomPanel(el)`

`LoginBridge` exposes `status`, `getBackendConfig`, `setBackendConfig`, `listOrganizations`, `wmsLogin`, `refreshSessions`, `onLoggedIn`, and `labels`. `CustomBridge` currently carries only `labels`.

Element Plus is MIT-licensed and vendored through npm as a normal dependency of this package.

-----

<a id="model-experience"></a>
## Model Experience

None, as the package contributes browser presentation only; nothing here reaches a model request.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **Settings BackendSection / Logout stay in React** — this package covers fullscreen login and the custom half-panel only.
- **Build before client bundle** — hosts import the Vite `lib/` artifact; run this package's `build` before bundling `ui-pgy-login` / `ui-custom-panel`.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

Path is `packages/1tmt/vue` (workspace glob `packages/*/*`); npm name is `@deepseek-ai/dsh-1tmt-vue`.

</details>
