---
description: "1tmt 自研插件、Remote、模型 tool，以及它们调用的 RuoYi MCP 清单。"
kind: "reference"
---

# 1tmt 自研清单

[English](inventory.md) | 中文

## 概述

本页只列本分支上的 1tmt 增量：Host 插件、浏览器插件、Vue 岛屿、Typert Remote、给模型用的快照 tool，以及这些 Remote 调用的 RuoYi MCP。上游 Harness 自带工具（bash、read、skill 等）不在此列。金蝶 HTTP 只在 RuoYi 内打开，Harness 不直连。

## 目录

- [调用关系](#how-the-pieces-call-each-other)
- [Host 插件](#host-plugins)
- [浏览器插件](#browser-plugins)
- [Vue 岛屿](#vue-islands)
- [Remote](#remotes)
- [模型 tool](#model-tool)
- [RuoYi MCP](#ruoyi-mcp-tools)

-----

<a id="how-the-pieces-call-each-other"></a>
## 调用关系

浏览器里的 Vue 调用 Host Remote。登录和采购入库的 Remote 再去调名为 `mcp__1tmt__*` 的 RuoYi MCP。工作台快照留在 Host 内存：Vue 发布它，`1tmt-workbench-context` 在下一轮模型请求前注入，模型也可以调用 `get_custom_workbench_snapshot`。

-----

<a id="host-plugins"></a>
## Host 插件

挂在 `packages/bundle/web-app/cordis.patch.yml`。每一行是一个 Loader id。

| Loader id | 包 | 做什么 |
|---|---|---|
| `kde-harness-mp-login` | `@deepseek-ai/dsh-api-kde-harness-mp-login` | 保存 harness 中台根地址、申请 MCP 会话令牌、动态挂载 MCP、拉组织、完成 harness中台登录，把会话隔离到 `employees/<组织>__<员工>/`，未登录时拦住 create/fork/prompt/list/search |
| `kde-harness-mp-pur-receive` | `@deepseek-ai/dsh-api-kde-harness-mp-pur-receive` | 采购入库 Remote。每个方法都是对一个 RuoYi MCP 的 `tools.execute`。没有金蝶客户端 |
| `1tmt-workbench` | `@deepseek-ai/dsh-1tmt-workbench` | 自定义工作台最新快照的内存存储（`tmtWorkbench`） |
| `1tmt-workbench-context` | `@deepseek-ai/dsh-1tmt-workbench-context` | 在 `agent/pre-step` 于快照 hash 变化时注入。Web 配置为 `injectFullRows: true`、`maxPayloadChars: 12000`。并注册下面的模型 tool |

-----

<a id="browser-plugins"></a>
## 浏览器插件

| Loader id | 包 | 做什么 |
|---|---|---|
| `ui-kde-harness-mp-login` | `@deepseek-ai/dsh-client-ui-kde-harness-mp-login` | 全屏 harness中台登录。把 `kdeHarnessMpLogin` 注入 `LoginBridge` 并挂载 Vue 登录页。设置里的「harness 中台」和侧栏退出仍在这个 React 壳 |
| `ui-custom-workbench` | `@deepseek-ai/dsh-client-ui-custom-workbench` | 侧栏「自定义工作台」。把 Vue 工作台挂在原生对话旁边，经 `CustomWorkbenchBridge` 转发快照和采购入库 Remote |

-----

<a id="vue-islands"></a>
## Vue 岛屿

包 `@deepseek-ai/dsh-1tmt-vue`（`packages/1tmt/vue`）。它不是 Loader 行，由浏览器插件内联。

| 应用 | 路径 | 做什么 |
|---|---|---|
| 登录 | `src/apps/login` | 组织、员工编码、密码。调用 `harnessLogin` |
| 自定义工作台 | `src/apps/custom-workbench` | 首页图标，然后采购入库：主列表 / 单据明细一 / 单据明细二。发布含已扫条码的快照 |

-----

<a id="remotes"></a>
## Remote

浏览器代码调用。模型不调用。

| 命名空间 | 方法 |
|---|---|
| `kdeHarnessMpLogin` | `status`、`getBackendConfig`、`setBackendConfig`、`listOrganizations`、`harnessLogin`、`logout` |
| `kdeHarnessMpPurReceive` | `listBills`、`viewBill`、`entityOutputs`、`getBarcode`、`getStockInfo`、`submitReport` |
| `tmtWorkbench` | `publishSnapshot`、`getSnapshot`、`clearSnapshot` |

-----

<a id="model-tool"></a>
## 模型 tool

由 `1tmt-workbench-context` 注册。这是 Harness tool，不是 MCP。

| Tool | 读取 | 写入 |
|---|---|---|
| `get_custom_workbench_snapshot` | Host 上最新快照：列表行，或表头字段、分录行、已扫条码（单据明细二） | 无。不调金蝶，也不调 RuoYi |

自动注入仍然会跑。这个 tool 用在后一步：模型需要再读一次快照，或注入的 JSON 因为超过 `maxPayloadChars` 被省略。

-----

<a id="ruoyi-mcp-tools"></a>
## RuoYi MCP

实现在 RuoYi 仓库模块 `1tmt-kde-deepseek-harness-mp`，包 `com.ruoyi.kde.harness`。模型和 Host Remote 以 `mcp__1tmt__<name>` 调用。仅当 `third.login.active-edition=enterprise` 时生效。

| MCP 名 | Java 类 | 作用 |
|---|---|---|
| `harnessPing` | `KdeMcpTools` | 模块连通性 |
| `harnessEcho` | `KdeMcpTools` | 连通性回声 |
| `kdeListOrganizations` | `KdeLoginMcpTools` | 登录页组织列表 |
| `harnessLogin` | `KdeLoginMcpTools` | harness中台登录：组织 id、员工编码、密码 |
| `kdeEnterpriseOperationRules` | `KdeEnterpriseOperationRulesMcpTools` | 判定操作：listQuery、billView、save、submit、audit、pushDown |
| `kdeEnterpriseFormRules` | `KdeEnterpriseFormRulesMcpTools` | 单据目录与 FieldKeys。已登记：`PUR_ReceiveBill` |
| `kdeEnterpriseApiRules` | `KdeEnterpriseApiRulesMcpTools` | 整合操作、单据、接口规则并返回 `invoke`。不调用金蝶 |
| `kdeExecuteBillQuery` | `KdeBillQueryMcpTools` | 没有专用列表工具的单据走通用 ExecuteBillQuery |
| `kdeListReceiveBills` | `KdeReceiveBillMcpTools` | 收料通知单 `PUR_ReceiveBill` 专用列表 |
| `kdeViewBill` | `KdeViewBillMcpTools` | 单据详情 |
| `kdeGetPurReceiveEntityOutputs` | `KdePurReceiveEntityMcpTools` | 收料明细扩展行 |
| `kdeGetBarcodeByNumber` | `KdeBarcodeMcpTools` | 按编号查条码档案 |
| `kdeGetStockInfoByNumber` | `KdeStockInfoMcpTools` | 按编号查仓库或仓位 |
| `kdeSubmitStkInStockRecordReport` | `KdeStkInStockReportMcpTools` | 提交已拼好的采购入库汇报 |

`kdePing` 属于 `1tmt-kde-admin`，不是本模块。`Zd.WMS.PGY.WebApi` 是金蝶外部程序集路径，保持不动。
