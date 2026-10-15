---
description: "Inject the latest 1tmt Custom Workbench snapshot into model requests on agent/pre-step."
kind: "package-reference"
---

# @deepseek-ai/dsh-1tmt-workbench-context

English | [中文](README.zh.md)

## Summary

On eligible `agent/pre-step` runs, appends one durable, source-attributed `user/message` summarizing the latest Custom Workbench snapshot from `dsh-1tmt-workbench`. Disable or omit this Host row to keep the Vue Custom Workbench UI while stopping automatic model visibility.

## Table of Contents

- [Use this package](#use-this-package)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)

-----

<a id="use-this-package"></a>
## Use this package

Mount beside `@deepseek-ai/dsh-1tmt-workbench` in the web-app Host composition. Injection runs only when a non-empty snapshot is stored and its hash differs from the last injected hash in the Session projection `tmtWorkbenchContext`.

```yaml
- id: 1tmt-workbench-context
  name: '@deepseek-ai/dsh-1tmt-workbench-context'
  config:
    injectFullRows: false
    maxPayloadChars: 4000
```

| Field | Default | Meaning |
|---|---|---|
| `injectFullRows` | `false` | Append JSON rows/form under the summary when it fits |
| `maxPayloadChars` | `4000` | Maximum JSON characters when `injectFullRows` is true |

-----

<a id="model-experience"></a>
## Model Experience

### Custom Workbench view context

#### What the model sees

A short user-role reading with kind, title, item count, and content hash when the Custom Workbench has published a non-empty snapshot whose hash differs from the last injection. With `injectFullRows: true` and a payload within `maxPayloadChars`, the same message includes the JSON body.

##### Summary reading

```markdown
Custom workbench snapshot (kind=<kind>, title="<title>", items=<n>, hash=<hash>).
Use this structured view when the user refers to the list or form currently shown in the custom workbench.
```


#### Token effect

One additional user message per changed snapshot hash (not every step). Summary-only mode stays a few hundred characters; full-row mode is bounded by `maxPayloadChars`.

#### KV Cache effect

A new hash appends after the reusable request prefix; unchanged hashes skip injection and preserve the previous prefix.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **No dedicated read tool** — oversized payloads are omitted with a note; a Host tool for on-demand full reads is deferred.
- **Process-wide store** — the Host store is not Session-keyed; every open Session sees the same latest workbench view.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

Mirrors `time-context` pre-step + projection scheduling. Source kind is `1tmt-workbench-context`.

</details>
