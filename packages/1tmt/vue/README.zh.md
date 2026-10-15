---
description: "1tmt 登录与自定义工作台 UI 的 Vue 3 + Element Plus 岛屿。"
kind: "package-reference"
---

# @deepseek-ai/dsh-1tmt-vue

[English](README.md) | 中文

## 概述

自包含的 Vue 3 + Element Plus（MIT）UI 岛屿，覆盖 1tmt 产品页：全屏 WMS 登录与自定义工作台。React Cordis 宿主调用 `mountLogin` / `mountCustomWorkbench` 并传入类型化 Bridge；Vue 从不 import Cordis。这些屏幕的产品改动应只改本包。日常扩展步骤（构建、Bridge、上下文发布）见开发指南 [docs/1tmt/README.md](../../../docs/1tmt/README.zh.md)。

## 目录

- [使用本包](#use-this-package)
- [模型体验](#model-experience)
- [已知限制与延期工作](#known-limitations-and-deferred-work)

-----

<a id="use-this-package"></a>
## 使用本包

```sh
pnpm --filter @deepseek-ai/dsh-1tmt-vue build
```

React 宿主导入构建后的 `lib/index.js` 入口：

- `mountLogin(el, bridge)` / `unmountLogin(el)`
- `mountCustomWorkbench(el, bridge)` / `unmountCustomWorkbench(el)`

`LoginBridge` 暴露 `status`、`getBackendConfig`、`setBackendConfig`、`listOrganizations`、`wmsLogin`、`refreshSessions`、`onLoggedIn` 与 `labels`。`CustomWorkbenchBridge` 包含 `labels`、`publishSnapshot` / `clearSnapshot`，以及采购入库 `getEmployee` / `listBills` / `viewBill` / `entityOutputs` / `getBarcode` / `getStockInfo` / `submitReport`（经 Host Remote → 1tmt MCP，不直连金蝶）。新业务模块只加工作台内左侧菜单，勿再注册侧栏按钮。

Element Plus 为 MIT 许可，作为本包的普通 npm 依赖引入。

-----

<a id="model-experience"></a>
## 模型体验

无。本包只贡献浏览器呈现；此处没有任何内容进入模型请求。

#### KV 缓存影响

无；本包既不组装也不发送提供商请求。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

- **设置页 BackendSection / 退出登录仍在 React** — 本包只覆盖全屏登录与自定义工作台。
- **先 build 再打 client bundle** — 宿主导入 Vite `lib/` 产物；在打包 `ui-pgy-login` / `ui-custom-workbench` 前先跑本包 `build`。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作上下文——点击展开</summary>

路径为 `packages/1tmt/vue`（工作区 glob `packages/*/*`）；npm 名为 `@deepseek-ai/dsh-1tmt-vue`。

</details>
