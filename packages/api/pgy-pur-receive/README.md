---
description: "Host purchase-inbound Remote: list/view/barcode/stock/submit through RuoYi MCP only."
kind: "package-reference"
---

# @deepseek-ai/dsh-api-pgy-pur-receive

English | [中文](README.zh.md)

## Summary

Host Remote namespace `pgyPurReceive` for the custom-workbench purchase-inbound flow. Every method is a one-to-one thin wrapper over a RuoYi MCP tool via `tools.execute`. This package never opens a Kingdee HTTP client, never holds Kingdee cookies, and never concatenates kdsvc URLs.

## Table of Contents

- [Use this package](#use-this-package)
- [Remote ↔ MCP map](#remote-mcp-map)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)

-----

<a id="use-this-package"></a>
## Use this package

Mount after `pgy-login` in the web-app composition so MCP is already ready. Callers must complete WMS login first; methods that need `orgId` default to the logged-in employee's organization when omitted. Assemble the STK report `inputJson` in the Vue island (same fields as App `buildSTKInStockRecordReportInput`); this Remote only forwards it.

-----

<a id="remote-mcp-map"></a>
## Remote ↔ MCP map

| Remote method | MCP tool (Config key) | Rules category |
|---|---|---|
| `listBills` | `mcp__1tmt__pgyListReceiveBills` (`listBillsTool`) | `listQuery` |
| `viewBill` | `mcp__1tmt__pgyKdeViewBill` (`viewBillTool`) | `billView` |
| `entityOutputs` | `mcp__1tmt__pgyGetPurReceiveEntityOutputs` (`entityOutputsTool`) | `purReceiveEntity` |
| `getBarcode` | `mcp__1tmt__pgyGetBarcodeByNumber` (`getBarcodeTool`) | `barcode` |
| `getStockInfo` | `mcp__1tmt__pgyGetStockInfoByNumber` (`getStockInfoTool`) | `stockInfo` |
| `submitReport` | `mcp__1tmt__pgySubmitStkInStockRecordReport` (`submitReportTool`) | `stkInStockReport` |

Each method is independently callable. There is no “one-click inbound” Remote that binds the steps together.

-----

<a id="model-experience"></a>
## Model Experience

None from this package directly. The custom workbench publishes snapshots through `tmtWorkbench`; conversation context comes from `dsh-1tmt-workbench-context`. Model chat can still call the same MCP tools under `mcp__1tmt__*` without this Remote.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **No PDA queue / draft / developer mode** — submit is synchronous only; failures stay on the confirm dialog for retry.
- **DTO assembly stays in Vue** — Host does not rebuild `BarcodeDataList` from scan state.
- **Kingdee only via RuoYi MCP** — do not add a Harness Kingdee client here or in sibling packages.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

Prerequisite: RuoYi `1tmt-kde-pgy` exposes the five non-list MCP tools plus existing `pgyListReceiveBills`. Restart RuoYi after Java changes before exercising this Remote.

</details>
