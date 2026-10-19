---
description: "Inject the latest 1tmt custom-workbench snapshot into model requests and expose a read-only snapshot tool."
kind: "package-reference"
---

# @deepseek-ai/dsh-1tmt-workbench-context

English | [中文](README.zh.md)

## Summary

On eligible `agent/pre-step` runs, append a durable, source-attributed `user/message` summarizing the latest custom-workbench snapshot from `dsh-1tmt-workbench`. Also registers `get_custom_workbench_snapshot` so the model can re-read that Host store on demand. Disable or omit this Host row to keep the Vue custom workbench UI while stopping automatic model visibility (the tool goes away with the plugin).

## Contents

- [Use this package](#use-this-package)
- [Model experience](#model-experience)
- [Known limitations and deferred work](#known-limitations-and-deferred-work)

-----

<a id="use-this-package"></a>
## Use this package

Mount beside `@deepseek-ai/dsh-1tmt-workbench` in the web-app Host composition. Injection runs only when a non-empty snapshot is stored and its hash differs from the Session projection `tmtWorkbenchContext` last-injected hash.

```yaml
- id: 1tmt-workbench-context
  name: '@deepseek-ai/dsh-1tmt-workbench-context'
  config:
    injectFullRows: true
    maxPayloadChars: 12000
```

| Field | Default | Meaning |
|---|---|---|
| `injectFullRows` | `false` | Append JSON rows/form/barcodes under the summary when it fits |
| `maxPayloadChars` | `4000` | Maximum JSON characters when `injectFullRows` is true |

-----

<a id="model-experience"></a>
## Model experience

### Custom workbench view context

#### What the model sees

When the custom workbench has published a non-empty snapshot whose hash differs from the last injection, append a short user-role reading with kind, title, item count, barcode count, and content hash. With `injectFullRows: true` and a payload within `maxPayloadChars`, the same message includes the JSON body (`form`, entry `rows`, and scanned `barcodes` for form kind).

##### Summary reading

```markdown
Custom workbench snapshot (kind=<kind>, title="<title>", items=<n>, barcodes=<n>, hash=<hash>).
Use this structured view when the user refers to the list or form currently shown in the custom workbench.
Call get_custom_workbench_snapshot when you need the latest snapshot again or the payload was omitted.
```

#### Token effect

Each changed snapshot hash appends one user message (not every step). Summary-only mode is usually a few hundred characters; full-row mode is bounded by `maxPayloadChars`.

#### KV Cache effect

A new hash appends after the reusable request prefix; an unchanged hash skips injection and keeps the prior prefix.

### get_custom_workbench_snapshot

#### What the model sees

A no-argument read tool that returns `{ present: false }` or `{ present: true, hash, updatedAt, snapshot }` where `snapshot` mirrors the injected payload (list rows, or form fields plus entry rows and scanned barcodes).

#### Token effect

Only when the model calls the tool; the result is one tool turn sized to the current snapshot JSON.

#### KV Cache effect

Tool results append after the reusable prefix for that step; unused tools leave the prefix unchanged.

## Known limitations and deferred work

<a id="known-limitations-and-deferred-work"></a>

- **Process-local store** — the Host store is not Session-bucketed; every open Session sees the same latest workbench view.
- **Oversized payloads** — injection omits JSON above `maxPayloadChars`; the read tool still returns the full in-memory snapshot.

<a id="dev-note"></a>
### Dev note

<details>
<summary>Maintainer working context — click to expand</summary>

Aligned with `time-context` pre-step + projection scheduling. Source kind is `1tmt-workbench-context`. Tool name constant: `GET_CUSTOM_WORKBENCH_SNAPSHOT`.

</details>
