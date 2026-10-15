---
description: "Host WMS 登录 Remote：通过 MCP 工具列出组织并完成员工登录。"
kind: "package-reference"
---

# @deepseek-ai/dsh-api-pgy-login

[English](README.md) | 中文

## 概述

Host Remote 命名空间 `pgyLogin`，覆盖若依后端 URL 配置、组织列表，以及经 MCP 工具的 WMS 员工登录。Web 遮罩通过类型化 Bridge 消费本 Remote；登录成功前会门禁 Session 创建与提问。

## 目录

- [使用本包](#use-this-package)
- [模型体验](#model-experience)
- [已知限制与延期工作](#known-limitations-and-deferred-work)

-----

<a id="use-this-package"></a>
## 使用本包

在 web-app 组合中挂载本 Host 插件及匹配的 Client remotes 条目。在调用 `listOrganizations` / `wmsLogin` 前，从登录 UI 或环境配置若依 base URL。

-----

<a id="model-experience"></a>
## 模型体验

无。本包门禁 Host 身份与 MCP 就绪状态；不为模型请求贡献 prompt、工具或 Session 事件。

#### KV 缓存影响

无；本包既不组装也不发送提供商请求。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

- **切换员工需重启 Host** — 同一进程内更换员工身份会被拒绝，直到 Host 退出。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作上下文——点击展开</summary>

无。

</details>
