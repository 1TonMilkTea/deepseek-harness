---
description: "在 agent/pre-step 把最新 1tmt 自定义工作台快照注入模型请求，并提供只读快照 tool。"
kind: "package-reference"
---

# @deepseek-ai/dsh-1tmt-workbench-context

[English](README.md) | 中文

## 概述

在合格的 `agent/pre-step` 运行中，追加一条 durable、带 source 的 `user/message`，摘要来自 `dsh-1tmt-workbench` 的最新自定义工作台快照。同时注册 `get_custom_workbench_snapshot`，供模型按需再读同一 Host 存储。禁用或省略本 Host 行可保留 Vue 自定义工作台 UI，同时停止自动模型可见性（tool 随插件卸掉）。

## 目录

- [使用本包](#use-this-package)
- [模型体验](#model-experience)
- [已知限制与延期工作](#known-limitations-and-deferred-work)

-----

<a id="use-this-package"></a>
## 使用本包

在 web-app Host 组合中与 `@deepseek-ai/dsh-1tmt-workbench` 一并挂载。仅当已存储非空快照、且其 hash 与 Session 投影 `tmtWorkbenchContext` 中上次注入的 hash 不同时才注入。

```yaml
- id: 1tmt-workbench-context
  name: '@deepseek-ai/dsh-1tmt-workbench-context'
  config:
    injectFullRows: true
    maxPayloadChars: 12000
```

| Field | Default | Meaning |
|---|---|---|
| `injectFullRows` | `false` | 在容量允许时于摘要下追加 JSON rows/form/barcodes |
| `maxPayloadChars` | `4000` | `injectFullRows` 为 true 时的最大 JSON 字符数 |

-----

<a id="model-experience"></a>
## 模型体验

### 自定义工作台视图上下文

#### 模型看到什么

当自定义工作台已发布非空快照、且其 hash 与上次注入不同时，追加一条简短的 user 角色读数，包含 kind、title、条目数、条码数与内容 hash。在 `injectFullRows: true` 且 payload 不超过 `maxPayloadChars` 时，同一消息还包含 JSON 正文（form 模式下含 `form`、分录 `rows`、已扫 `barcodes`）。

##### 摘要读数

```markdown
Custom workbench snapshot (kind=<kind>, title="<title>", items=<n>, barcodes=<n>, hash=<hash>).
Use this structured view when the user refers to the list or form currently shown in the custom workbench.
Call get_custom_workbench_snapshot when you need the latest snapshot again or the payload was omitted.
```

#### Token 影响

每个变化的快照 hash 追加一条 user 消息（不是每一步）。仅摘要模式通常几百字符；全量行模式受 `maxPayloadChars` 约束。

#### KV 缓存影响

新 hash 追加在可复用请求前缀之后；未变的 hash 跳过注入并保留先前前缀。

### get_custom_workbench_snapshot

#### 模型看到什么

无参只读 tool，返回 `{ present: false }` 或 `{ present: true, hash, updatedAt, snapshot }`；`snapshot` 与注入 payload 一致（列表行，或表头字段 + 分录行 + 已扫条码）。

#### Token 影响

仅在模型调用时产生一轮 tool 结果，大小为当前快照 JSON。

#### KV 缓存影响

tool 结果追加在该步可复用前缀之后；未调用时不改前缀。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

- **进程级存储** — Host 存储未按 Session 分桶；每个打开的 Session 看到同一份最新工作台视图。
- **超大 payload** — 超过 `maxPayloadChars` 时注入会省略 JSON；只读 tool 仍返回内存中的完整快照。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作上下文——点击展开</summary>

对齐 `time-context` 的 pre-step + 投影调度。Source kind 为 `1tmt-workbench-context`。Tool 名常量：`GET_CUSTOM_WORKBENCH_SNAPSHOT`。

</details>
