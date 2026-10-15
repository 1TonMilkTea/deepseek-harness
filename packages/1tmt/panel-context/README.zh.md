---
description: "在 agent/pre-step 把最新 1tmt 自定义半屏快照注入模型请求。"
kind: "package-reference"
---

# @deepseek-ai/dsh-1tmt-panel-context

[English](README.md) | 中文

## 概述

在合格的 `agent/pre-step` 运行中，追加一条 durable、带 source 的 `user/message`，摘要来自 `dsh-1tmt-panel` 的最新自定义半屏快照。禁用或省略本 Host 行可保留 Vue 半屏 UI，同时停止自动模型可见性。

## 目录

- [使用本包](#use-this-package)
- [模型体验](#model-experience)
- [已知限制与延期工作](#known-limitations-and-deferred-work)

-----

<a id="use-this-package"></a>
## 使用本包

在 web-app Host 组合中与 `@deepseek-ai/dsh-1tmt-panel` 一并挂载。仅当已存储非空快照、且其 hash 与 Session 投影中上次注入的 hash 不同时才注入。

```yaml
- id: 1tmt-panel-context
  name: '@deepseek-ai/dsh-1tmt-panel-context'
  config:
    injectFullRows: false
    maxPayloadChars: 4000
```

| Field | Default | Meaning |
|---|---|---|
| `injectFullRows` | `false` | 在容量允许时于摘要下追加 JSON rows/form |
| `maxPayloadChars` | `4000` | `injectFullRows` 为 true 时的最大 JSON 字符数 |

-----

<a id="model-experience"></a>
## 模型体验

### 自定义半屏视图上下文

#### 模型看到什么

当左半屏已发布非空快照、且其 hash 与上次注入不同时，追加一条简短的 user 角色读数，包含 kind、title、条目数与内容 hash。在 `injectFullRows: true` 且 payload 不超过 `maxPayloadChars` 时，同一消息还包含 JSON 正文。

##### 摘要读数

```markdown
Custom panel snapshot (kind=<kind>, title="<title>", items=<n>, hash=<hash>).
Use this structured view when the user refers to the list or form currently shown in the left panel.
```


#### Token 影响

每个变化的快照 hash 追加一条 user 消息（不是每一步）。仅摘要模式通常几百字符；全量行模式受 `maxPayloadChars` 约束。

#### KV 缓存影响

新 hash 追加在可复用请求前缀之后；未变的 hash 跳过注入并保留先前前缀。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

- **尚无专用读取 tool** — 超大 payload 会注明省略；按需全量读取的 Host tool 延期。
- **进程级存储** — Host 存储未按 Session 分桶；每个打开的 Session 看到同一份最新半屏视图。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作上下文——点击展开</summary>

对齐 `time-context` 的 pre-step + 投影调度。Source kind 为 `1tmt-panel-context`。

</details>
