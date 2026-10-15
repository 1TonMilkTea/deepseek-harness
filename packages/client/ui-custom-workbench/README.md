---
description: "Custom Workbench sidebar entry: a Vue business area mounted beside the Conversation."
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-custom-workbench

English | [中文](README.zh.md)

## Summary

Adds the sidebar entry **Custom Workbench** / **自定义工作台** (`order: 20`, after Plugins and Automation tasks). Selecting it opens a main panel that AppFrame mounts beside the Conversation (≈50/50). The left pane hosts the Vue Element Plus island from `@deepseek-ai/dsh-1tmt-vue`; the right pane is the existing Conversation. The shell wires `CustomWorkbenchBridge.publishSnapshot` to Host `ctx.remote.tmtWorkbench`.

## Table of Contents

- [Use this package](#use-this-package)
- [How it works](#how-it-works)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)

-----

<a id="use-this-package"></a>
## Use this package

Ship it in the web-app composition (`cordis.patch.yml`, row id `ui-custom-workbench`). The panel id is the literal `custom-workbench`, matching `SPLIT_WITH_CONVERSATION_PANEL_ID` in `@deepseek-ai/dsh-client-ui-layout`. Locale copy lives in the `customWorkbench` namespace.

-----

<a id="how-it-works"></a>
## How it works

- The browser `apply` registers two slot entries as effects: `sidebar.panellist` (icon and label) and the keyed `main` entry `custom-workbench` rendered by `CustomWorkbenchPage`. Disposing the plugin removes both, so the sidebar entry disappears.
- When `activePanelId` equals `SPLIT_WITH_CONVERSATION_PANEL_ID`, AppFrame renders the `custom-workbench` and `conversation` main entries side by side; `ui-workspace` navigation keeps that split while the user switches conversations.
- `CustomWorkbenchPage` mounts the Vue island with `mountCustomWorkbench(el, bridge)` and tears it down with `unmountCustomWorkbench(el)`. The Bridge carries localized `labels`, `tmtWorkbench` `publishSnapshot` / `clearSnapshot`, and purchase-inbound methods from `pgyLogin` / `pgyPurReceive`; Remote failures fold into `{ ok: false, error: { message } }`.
- **Sidebar registers only the Custom Workbench entry**; Purchase → Purchase inbound navigation lives inside the Vue workbench. Do not add more `sidebar.panellist` rows for 1tmt modules.

[docs/1tmt](../../../docs/1tmt/README.md#custom-workbench-overview) covers the full data path, lifecycle, and the effect of disabling each row.

-----

<a id="model-experience"></a>
## Model Experience

Indirectly, through `@deepseek-ai/dsh-1tmt-workbench-context`, which turns Host `tmtWorkbench` snapshots into durable pre-step messages.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **Left pane is Vue-owned** — extend the `packages/1tmt/vue` custom-workbench App for product UI (including purchase inbound); this package stays a thin mount host.
- **Kingdee only via RuoYi MCP** — Bridge / Remote must not call Kingdee kdsvc directly.
- **Fixed split width** — AppFrame uses ≈50/50 panes without a drag handle.
- **Shared panel id literal** — `ui-layout` and `ui-workspace` keep the same `custom-workbench` literal to recognize the split; renaming the id updates all three packages together.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
