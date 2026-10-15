---
description: "Host Remote store for the 1tmt Custom Workbench snapshot."
kind: "package-reference"
---

# @deepseek-ai/dsh-1tmt-workbench

English | [中文](README.zh.md)

## Summary

Host Remote namespace `tmtWorkbench` that keeps the latest structured snapshot published by the 1tmt Custom Workbench Vue island. Same-process Host plugins (notably `dsh-1tmt-workbench-context`) read the Cordis service; the browser reaches it through `ctx.remote.tmtWorkbench` after `dsh-api-remotes` mounts the generated contribution.

## Table of Contents

- [Use this package](#use-this-package)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)

-----

<a id="use-this-package"></a>
## Use this package

Mount the Host plugin in the web-app composition and keep the matching Client remotes entry. The Vue island publishes through `CustomWorkbenchBridge.publishSnapshot`; this package does not append Session events by itself.

| Remote | Role |
|---|---|
| `publishSnapshot` | Replace the process-local snapshot |
| `getSnapshot` | Read the latest snapshot or `{ present: false }` |
| `clearSnapshot` | Drop the snapshot |

-----

<a id="model-experience"></a>
## Model Experience

None, as this package only stores a process-local snapshot; `dsh-1tmt-workbench-context` turns a changed snapshot into a durable, source-attributed `user/message` on `agent/pre-step`.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **Process-local only** — snapshots do not survive Host restart and are not keyed per Session in this cut.
- **No read tool yet** — full row payloads ride the optional `injectFullRows` path in workbench-context; a dedicated read tool is deferred.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

Product-local 1tmt Host capability. Pair with `packages/1tmt/workbench-context` and the `ui-custom-workbench` bridge; [docs/1tmt](../../../docs/1tmt/README.md#custom-workbench-overview) explains how the Custom Workbench works end to end.

</details>
