---
description: "采购入库 Host Remote：仅经若依 MCP 做列表/详情/条码/仓位/提交。"
kind: "package-reference"
---

# @deepseek-ai/dsh-api-pgy-pur-receive

[English](README.md) | 中文

## 概述

Host Remote 命名空间 `pgyPurReceive`，服务自定义工作台采购入库流程。每个方法都是对若依 MCP 工具的一一薄封装（`tools.execute`）。本包**不**打开金蝶 HTTP 客户端、**不**持有金蝶 Cookie、**不**拼接 kdsvc URL。

## 目录

- [使用本包](#use-this-package)
- [Remote ↔ MCP 对照](#remote-mcp-map)
- [模型体验](#model-experience)
- [已知限制与延期工作](#known-limitations-and-deferred-work)

-----

<a id="use-this-package"></a>
## 使用本包

在 web-app 组合中挂在 `pgy-login` 之后，确保 MCP 已就绪。调用前须完成 WMS 登录；需要 `orgId` 的方法在未传时默认用已登录员工的组织。`submitReport` 的 `inputJson` 由 Vue 岛按 App `buildSTKInStockRecordReportInput` 拼装；本 Remote 只转发。

-----

<a id="remote-mcp-map"></a>
## Remote ↔ MCP 对照

| Remote 方法 | MCP 工具（Config 键） | 规则 category |
|---|---|---|
| `listBills` | `mcp__1tmt__pgyListReceiveBills`（`listBillsTool`） | `listQuery` |
| `viewBill` | `mcp__1tmt__pgyKdeViewBill`（`viewBillTool`） | `billView` |
| `entityOutputs` | `mcp__1tmt__pgyGetPurReceiveEntityOutputs`（`entityOutputsTool`） | `purReceiveEntity` |
| `getBarcode` | `mcp__1tmt__pgyGetBarcodeByNumber`（`getBarcodeTool`） | `barcode` |
| `getStockInfo` | `mcp__1tmt__pgyGetStockInfoByNumber`（`getStockInfoTool`） | `stockInfo` |
| `submitReport` | `mcp__1tmt__pgySubmitStkInStockRecordReport`（`submitReportTool`） | `stkInStockReport` |

每个方法可独立调用，没有把多步绑死的「一键入库」接口。

-----

<a id="model-experience"></a>
## 模型体验

本包本身不贡献。自定义工作台经 `tmtWorkbench` 发布快照；对话上下文由 `dsh-1tmt-workbench-context` 注入。模型对话仍可直接调同一批 `mcp__1tmt__*` 工具。

#### KV 缓存影响

无；本包既不组装也不发送提供商请求。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

- **无 PDA 队列 / 草稿 / 开发者模式** — 提交仅同步；失败留在确认 Dialog 可重试。
- **DTO 拼装在 Vue** — Host 不根据扫码状态重建 `BarcodeDataList`。
- **金蝶只经若依 MCP** — 勿在本包或兄弟包新增金蝶客户端。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作上下文——点击展开</summary>

先决：若依 `1tmt-kde-pgy` 已暴露五个非列表 MCP 与既有 `pgyListReceiveBills`。改 Java 后须重启若依再测本 Remote。

</details>
