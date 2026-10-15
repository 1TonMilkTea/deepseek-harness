---
description: "侧栏自定义半屏：在 Conversation 旁挂载占位业务页。"
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-custom-panel

[English](README.md) | 中文

## 概述

增加侧栏入口 **Custom** / **自定义按钮**（`order: 20`，位于 Plugins 与 Automation tasks 之后）。选中后打开主面板，由 AppFrame 挂在 Conversation 旁（约 50/50）。左半屏挂载 `@deepseek-ai/dsh-1tmt-vue` 的 Vue Element Plus 岛屿；右半屏仍是现有 Conversation。薄壳把 `CustomBridge.publishSnapshot` 接到 Host `ctx.remote.tmtPanel`。

## 目录

- [使用本包](#use-this-package)
- [模型体验](#model-experience)
- [已知限制与延期工作](#known-limitations-and-deferred-work)

-----

<a id="use-this-package"></a>
## 使用本包

在 web-app 组合（`cordis.patch.yml`）中交付。面板 id 为字面量 `custom`，与 `@deepseek-ai/dsh-client-ui-layout` 中的 `SPLIT_WITH_CONVERSATION_PANEL_ID` 一致。

-----

<a id="model-experience"></a>
## 模型体验

间接生效：`@deepseek-ai/dsh-1tmt-panel-context` 把 Host `tmtPanel` 快照写成 durable 的 pre-step 消息。

#### KV 缓存影响

无；本包既不组装也不发送提供商请求。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

- **左半屏由 Vue 拥有** — 产品 UI 扩展 `packages/1tmt/vue` 的 custom-panel App；本包保持薄挂载宿主。
- **固定分栏宽度** — AppFrame 使用约 50/50 分栏，无拖拽手柄。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作上下文——点击展开</summary>

无。

</details>
