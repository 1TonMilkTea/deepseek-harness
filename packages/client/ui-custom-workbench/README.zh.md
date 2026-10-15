---
description: "自定义工作台侧栏入口：在 Conversation 旁挂载 Vue 业务区。"
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-custom-workbench

[English](README.md) | 中文

## 概述

增加侧栏入口 **Custom Workbench** / **自定义工作台**（`order: 20`，位于 Plugins 与 Automation tasks 之后）。选中后打开主面板，由 AppFrame 挂在 Conversation 旁（约 50/50）。左侧挂载 `@deepseek-ai/dsh-1tmt-vue` 的 Vue Element Plus 岛屿；右侧仍是现有 Conversation。外壳把 `CustomWorkbenchBridge.publishSnapshot` 接到 Host `ctx.remote.tmtWorkbench`。

## 目录

- [使用本包](#use-this-package)
- [工作原理](#how-it-works)
- [模型体验](#model-experience)
- [已知限制与延期工作](#known-limitations-and-deferred-work)

-----

<a id="use-this-package"></a>
## 使用本包

在 web-app 组合（`cordis.patch.yml`，行 id `ui-custom-workbench`）中交付。面板 id 为字面量 `custom-workbench`，与 `@deepseek-ai/dsh-client-ui-layout` 中的 `SPLIT_WITH_CONVERSATION_PANEL_ID` 一致。文案位于 `customWorkbench` 命名空间。

-----

<a id="how-it-works"></a>
## 工作原理

- 浏览器端 `apply` 以 effect 方式注册两个槽位条目：`sidebar.panellist`（图标与文案）和 key 为 `custom-workbench` 的 `main` 条目（由 `CustomWorkbenchPage` 渲染）。插件卸载时两者一并撤销，侧栏入口随之消失。
- 当 `activePanelId` 等于 `SPLIT_WITH_CONVERSATION_PANEL_ID` 时，AppFrame 并排渲染 `custom-workbench` 与 `conversation` 两个 main 条目；用户切换会话时，`ui-workspace` 导航保留这一分屏。
- `CustomWorkbenchPage` 用 `mountCustomWorkbench(el, bridge)` 挂载 Vue 岛屿，用 `unmountCustomWorkbench(el)` 销毁。Bridge 携带本地化 `labels` 以及 `publishSnapshot` / `clearSnapshot`，后两者调用 `ctx.remote.tmtWorkbench`，并把 Remote 失败折叠为 `{ ok: false, error: { message } }`。

完整的数据路径、生命周期与各行关闭后的效果见 [docs/1tmt](../../../docs/1tmt/README.zh.md#custom-workbench-overview)。

-----

<a id="model-experience"></a>
## 模型体验

间接生效：`@deepseek-ai/dsh-1tmt-workbench-context` 把 Host `tmtWorkbench` 快照写成 durable 的 pre-step 消息。

#### KV 缓存影响

无；本包既不组装也不发送提供商请求。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

- **左侧由 Vue 拥有** — 产品 UI 扩展 `packages/1tmt/vue` 的 custom-workbench App；本包保持薄挂载宿主。
- **固定分栏宽度** — AppFrame 使用约 50/50 分栏，无拖拽手柄。
- **共享的面板 id 字面量** — `ui-layout` 与 `ui-workspace` 保留同一个 `custom-workbench` 字面量来识别分屏；改 id 时三个包需同时修改。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作上下文——点击展开</summary>

无。

</details>
