---
description: "1tmt 产品 UI 岛屿：由薄 React 壳挂载的 Vue 3 + Element Plus 页面。"
kind: "package-group"
---

# 1tmt/ — 产品 Vue 岛屿

[English](README.md) | 中文

## 概述

本地产品 UI 与 Host 上下文插件，不属于上游 Harness React 壳。页面是 Vue 3 + Element Plus（MIT）岛屿；Cordis React 插件只负责挂载并传入 Bridge。Host 包 `panel` / `panel-context` 保存自定义半屏快照，并在 `agent/pre-step` 注入，使对话能读到左半屏当前展示。请先读 [docs/1tmt/README.md](../../docs/1tmt/README.zh.md) 了解 Harness 上下文规则与插件数据路径。外围 Web 壳的呈现契约见 [Web Client](../../docs/subsystems/web-client.zh.md) 子系统。

## 目录

- [包](#packages)
- [相关文档](#related-documentation)
- [开发备注](#dev-note)

-----

<a id="packages"></a>
## 包

| Package | Role | ctx key |
|---|---|---|
| [`vue/`](vue/README.zh.md) | 登录与自定义半屏 Element Plus 应用及挂载助手 | — |
| [`panel/`](panel/README.zh.md) | 自定义半屏快照的 Host Remote 存储 | `tmtPanel` |
| [`panel-context/`](panel-context/README.zh.md) | 在 `agent/pre-step` 注入最新快照摘要 | — |

-----

<a id="related-documentation"></a>
## 相关文档

- [docs/1tmt/README.md](../../docs/1tmt/README.zh.md) — Harness 上下文读取规则、半屏插件与 UI 扩展
- [Web Client](../../docs/subsystems/web-client.zh.md) — React Cordis Host 栈
- [architecture.md](../../docs/architecture.zh.md) — 模型可见即已落日志；`agent/pre-step`

-----

<a id="dev-note"></a>
## 开发备注

<details>
<summary>维护者工作上下文——点击展开</summary>

无。

</details>
