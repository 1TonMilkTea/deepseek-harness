---
description: "Sidebar custom panel with a placeholder page beside the Conversation."
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-custom-panel

## Summary

Adds a sidebar entry **Custom** / **自定义按钮** (`order: 20`, after Plugins and Automation tasks). Selecting it opens a main panel that AppFrame mounts beside the Conversation (≈50/50). The left pane hosts the Vue Element Plus island from `@deepseek-ai/dsh-1tmt-vue`; the right pane is the existing Conversation.

## Table of Contents

- [Use this package](#use-this-package)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)

-----

<a id="use-this-package"></a>
## Use this package

Ship it in the web-app composition (`cordis.patch.yml`). The panel id is the literal `custom`, matching `SPLIT_WITH_CONVERSATION_PANEL_ID` in `@deepseek-ai/dsh-client-ui-layout`.

-----

<a id="model-experience"></a>
## Model Experience

None, as the package contributes browser presentation only; nothing here reaches a model request.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **Left pane is a Vue placeholder** — extend `packages/1tmt/vue` custom-panel App for product UI; this package stays a thin mount host.
- **Fixed split width** — AppFrame uses ≈50/50 panes without a drag handle.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
