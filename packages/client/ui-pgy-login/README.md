---
description: "Web WMS login overlay host that mounts the Vue Element Plus login island."
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-pgy-login

English | [中文](README.zh.md)

## Summary

Fullscreen WMS login gate for `dsh web`. This package is a thin React Cordis host: it injects Remote `pgyLogin` callbacks into a `LoginBridge` and mounts `@deepseek-ai/dsh-1tmt-vue` `mountLogin`. Product form UI lives in the Vue package; settings BackendSection and logout remain React.

## Table of Contents

- [Use this package](#use-this-package)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)

-----

<a id="use-this-package"></a>
## Use this package

Ship it in the web-app composition. Build `@deepseek-ai/dsh-1tmt-vue` before bundling this package so the client purity pass can inline the island.

-----

<a id="model-experience"></a>
## Model Experience

None, as the package contributes browser presentation only; nothing here reaches a model request.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **Login chrome is Vue-owned** — change forms under `packages/1tmt/vue`; do not rebuild the React host for layout work.
- **Backend settings / logout stay React** — only the fullscreen gate is the Vue island in this cut.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
