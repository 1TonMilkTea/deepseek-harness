---
description: "1tmt product UI islands: Vue 3 + Element Plus pages mounted by thin React hosts."
kind: "package-group"
---

# 1tmt/ — product Vue islands

English | [中文](README.zh.md)

## Summary

Local product UI and Host context plugins that are not part of the upstream Harness React shell. Pages are Vue 3 + Element Plus (MIT) islands; Cordis React plugins only mount them and pass bridges. Host packages `panel` / `panel-context` store a custom-panel snapshot and inject it on `agent/pre-step` so the conversation can read what the left pane shows. Start with [docs/1tmt/README.md](../../docs/1tmt/README.md) for Harness context rules and the plugin data path. Presentation contracts for the surrounding Web shell live in the [Web Client](../../docs/subsystems/web-client.md) subsystem.

## Table of Contents

- [Packages](#packages)
- [Related documentation](#related-documentation)
- [Dev Note](#dev-note)

-----

<a id="packages"></a>
## Packages

| Package | Role | ctx key |
|---|---|---|
| [`vue/`](vue/README.md) | Login + custom-panel Element Plus apps and mount helpers | — |
| [`panel/`](panel/README.md) | Host Remote store for the custom-panel snapshot | `tmtPanel` |
| [`panel-context/`](panel-context/README.md) | `agent/pre-step` injection of the latest snapshot summary | — |

-----

<a id="related-documentation"></a>
## Related documentation

- [docs/1tmt/README.md](../../docs/1tmt/README.md) — Harness context-reading rules, panel plugins, and UI extension
- [Web Client](../../docs/subsystems/web-client.md) — React Cordis host stack
- [architecture.md](../../docs/architecture.md) — model-visible means logged; `agent/pre-step`

-----

<a id="dev-note"></a>
## Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
