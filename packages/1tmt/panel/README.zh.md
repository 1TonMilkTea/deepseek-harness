---
description: "1tmt 自定义半屏快照的 Host Remote 存储。"
kind: "package-reference"
---

# @deepseek-ai/dsh-1tmt-panel

[English](README.md) | 中文

## 概述

Host Remote 命名空间 `tmtPanel`，保存 1tmt 自定义半屏 Vue 岛屿发布的最新结构化快照。同进程 Host 插件（尤其是 `dsh-1tmt-panel-context`）读取 Cordis 服务；浏览器在 `dsh-api-remotes` 挂载生成贡献后通过 `ctx.remote.tmtPanel` 访问。

## 目录

- [使用本包](#use-this-package)
- [模型体验](#model-experience)
- [已知限制与延期工作](#known-limitations-and-deferred-work)

-----

<a id="use-this-package"></a>
## 使用本包

在 web-app 组合中挂载本 Host 插件，并保持匹配的 Client remotes 条目。Vue 岛屿通过 `CustomBridge.publishSnapshot` 发布；本包自身不追加 Session 事件。

| Remote | Role |
|---|---|
| `publishSnapshot` | 替换进程内快照 |
| `getSnapshot` | 读取最新快照，或 `{ present: false }` |
| `clearSnapshot` | 清除快照 |

-----

<a id="model-experience"></a>
## 模型体验

无。本包只保存进程内快照；`dsh-1tmt-panel-context` 在 `agent/pre-step` 把变更后的快照写成 durable、带 source 的 `user/message`。

#### KV 缓存影响

无；本包既不组装也不发送提供商请求。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

- **仅进程内** — 快照不随 Host 重启保留，本轮也不按 Session 分桶。
- **尚无只读 tool** — 全量行数据走 panel-context 可选的 `injectFullRows`；专用读取 tool 延期。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作上下文——点击展开</summary>

产品本地 1tmt Host 能力。与 `packages/1tmt/panel-context` 及 `ui-custom-panel` Bridge 配对。

</details>
