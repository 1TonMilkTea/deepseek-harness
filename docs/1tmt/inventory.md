---
description: "Inventory of 1tmt plugins, Remotes, model tools, and the RuoYi MCP tools they call."
kind: "reference"
---

# 1tmt self-developed surface

English | [中文](inventory.zh.md)

## Summary

This page lists only the 1tmt additions on this branch: Host plugins, browser plugins, Vue islands, Typert Remotes, the model-facing snapshot tool, and the RuoYi MCP tools those Remotes call. Upstream Harness tools (bash, read, skill, and so on) are not listed. Kingdee HTTP stays inside RuoYi; Harness never opens it.

## Contents

- [How the pieces call each other](#how-the-pieces-call-each-other)
- [Host plugins](#host-plugins)
- [Browser plugins](#browser-plugins)
- [Vue islands](#vue-islands)
- [Remotes](#remotes)
- [Model tool](#model-tool)
- [RuoYi MCP tools](#ruoyi-mcp-tools)

-----

<a id="how-the-pieces-call-each-other"></a>
## How the pieces call each other

The browser Vue island calls a Host Remote. Login and purchase-inbound Remotes then call RuoYi MCP tools named `mcp__1tmt__*`. The workbench snapshot stays in Host memory: Vue publishes it, `1tmt-workbench-context` injects it into the next model request, and the model can also call `get_custom_workbench_snapshot`.

-----

<a id="host-plugins"></a>
## Host plugins

Mounted from `packages/bundle/web-app/cordis.patch.yml`. Each row is one Loader id.

| Loader id | Package | What it does |
|---|---|---|
| `kde-harness-mp-login` | `@deepseek-ai/dsh-api-kde-harness-mp-login` | Saves the harness-platform root URL, issues the MCP session token, mounts the MCP client, lists organizations, completes harness-platform login, isolates sessions under `employees/<org>__<staff>/`, and gates create/fork/prompt/list/search until login succeeds |
| `kde-harness-mp-pur-receive` | `@deepseek-ai/dsh-api-kde-harness-mp-pur-receive` | Purchase-inbound Remote. Each method is `tools.execute` of one RuoYi MCP tool. No Kingdee client |
| `1tmt-workbench` | `@deepseek-ai/dsh-1tmt-workbench` | In-memory store for the latest custom-workbench snapshot (`tmtWorkbench`) |
| `1tmt-workbench-context` | `@deepseek-ai/dsh-1tmt-workbench-context` | On `agent/pre-step`, injects the snapshot when its hash changes. Web config sets `injectFullRows: true` and `maxPayloadChars: 12000`. Also registers the model tool below |

-----

<a id="browser-plugins"></a>
## Browser plugins

| Loader id | Package | What it does |
|---|---|---|
| `ui-kde-harness-mp-login` | `@deepseek-ai/dsh-client-ui-kde-harness-mp-login` | Full-screen harness-platform login. Injects `kdeHarnessMpLogin` into a `LoginBridge` and mounts the Vue login island. Settings “Harness platform” and sidebar sign-out stay in this React shell |
| `ui-custom-workbench` | `@deepseek-ai/dsh-client-ui-custom-workbench` | Sidebar entry “自定义工作台”. Mounts the Vue workbench beside native Conversation and forwards snapshot plus purchase-inbound Remotes through `CustomWorkbenchBridge` |

-----

<a id="vue-islands"></a>
## Vue islands

Package `@deepseek-ai/dsh-1tmt-vue` (`packages/1tmt/vue`). It is not a Loader row; the browser plugins inline it.

| App | Path | What it does |
|---|---|---|
| Login | `src/apps/login` | Organization, staff number, password. Calls `harnessLogin` |
| Custom workbench | `src/apps/custom-workbench` | Home icon grid, then purchase inbound: 主列表 / 单据明细一 / 单据明细二. Publishes snapshots including scanned barcodes |

-----

<a id="remotes"></a>
## Remotes

Browser code calls these. The model does not.

| Namespace | Methods |
|---|---|
| `kdeHarnessMpLogin` | `status`, `getBackendConfig`, `setBackendConfig`, `listOrganizations`, `harnessLogin`, `logout` |
| `kdeHarnessMpPurReceive` | `listBills`, `viewBill`, `entityOutputs`, `getBarcode`, `getStockInfo`, `submitReport` |
| `tmtWorkbench` | `publishSnapshot`, `getSnapshot`, `clearSnapshot` |

-----

<a id="model-tool"></a>
## Model tool

Registered by `1tmt-workbench-context`. This is a Harness tool, not an MCP tool.

| Tool | Reads | Writes |
|---|---|---|
| `get_custom_workbench_snapshot` | Latest Host snapshot: list rows, or form fields, entry rows, and scanned barcodes (单据明细二) | Nothing. Does not call Kingdee or RuoYi |

Automatic injection still runs. The tool is for a later step when the model needs the snapshot again, or when the injected JSON was omitted because it exceeded `maxPayloadChars`.

-----

<a id="ruoyi-mcp-tools"></a>
## RuoYi MCP tools

Implemented in the RuoYi repo module `1tmt-kde-deepseek-harness-mp`, package `com.ruoyi.kde.harness`. The model and the Host Remotes call them as `mcp__1tmt__<name>`. They run only when `third.login.active-edition=enterprise`.

| MCP name | Java class | Role |
|---|---|---|
| `harnessPing` | `KdeMcpTools` | Module connectivity |
| `harnessEcho` | `KdeMcpTools` | Echo for connectivity checks |
| `kdeListOrganizations` | `KdeLoginMcpTools` | Organizations for the login page |
| `harnessLogin` | `KdeLoginMcpTools` | Harness-platform login: org id, staff number, password |
| `kdeEnterpriseOperationRules` | `KdeEnterpriseOperationRulesMcpTools` | Decide the operation: listQuery, billView, save, submit, audit, pushDown |
| `kdeEnterpriseFormRules` | `KdeEnterpriseFormRulesMcpTools` | Form catalog and FieldKeys. Ready form: `PUR_ReceiveBill` |
| `kdeEnterpriseApiRules` | `KdeEnterpriseApiRulesMcpTools` | Compose operation + form + interface rules and return `invoke`. Does not call Kingdee |
| `kdeExecuteBillQuery` | `KdeBillQueryMcpTools` | Generic ExecuteBillQuery for forms without a dedicated list tool |
| `kdeListReceiveBills` | `KdeReceiveBillMcpTools` | Dedicated list for 收料通知单 `PUR_ReceiveBill` |
| `kdeViewBill` | `KdeViewBillMcpTools` | Bill view |
| `kdeGetPurReceiveEntityOutputs` | `KdePurReceiveEntityMcpTools` | Purchase-receive entity rows |
| `kdeGetBarcodeByNumber` | `KdeBarcodeMcpTools` | Barcode archive by number |
| `kdeGetStockInfoByNumber` | `KdeStockInfoMcpTools` | Warehouse or stock-location by number |
| `kdeSubmitStkInStockRecordReport` | `KdeStkInStockReportMcpTools` | Submit the assembled purchase-inbound report |

`kdePing` belongs to `1tmt-kde-admin`, not this module. Paths under `Zd.WMS.PGY.WebApi` are the external Kingdee assembly and stay unchanged.
