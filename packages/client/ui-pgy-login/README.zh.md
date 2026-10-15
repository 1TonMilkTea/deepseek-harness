---
description: "挂载 Vue Element Plus 登录岛屿的 Web WMS 登录遮罩宿主。"
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-pgy-login

[English](README.md) | 中文

## 概述

`dsh web` 的全屏 WMS 登录门。本包是薄 React Cordis 宿主：把 Remote `pgyLogin` 回调注入 `LoginBridge`，并调用 `@deepseek-ai/dsh-1tmt-vue` 的 `mountLogin`。产品表单 UI 在 Vue 包；设置页 BackendSection 与退出登录仍在 React。

## 目录

- [使用本包](#use-this-package)
- [模型体验](#model-experience)
- [已知限制与延期工作](#known-limitations-and-deferred-work)

-----

<a id="use-this-package"></a>
## 使用本包

在 web-app 组合中交付。打包本包前先 build `@deepseek-ai/dsh-1tmt-vue`，以便 client purity 检查能内联该岛屿。

-----

<a id="model-experience"></a>
## 模型体验

无。本包只贡献浏览器呈现；此处没有任何内容进入模型请求。

#### KV 缓存影响

无；本包既不组装也不发送提供商请求。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

- **登录界面由 Vue 拥有** — 改表单请到 `packages/1tmt/vue`；不要为布局工作重写 React 宿主。
- **后端设置 / 退出仍在 React** — 本轮只有全屏门是 Vue 岛屿。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作上下文——点击展开</summary>

无。

</details>
