---
description: "1tmt 开发指南：自定义工作台原理、Harness 上下文读取规则、工作台快照插件、Vue 岛屿扩展与验收。"
kind: "reference"
---

# 1tmt 开发指南

[English](README.md) | 中文

## Summary

本文面向在 1tmt 产品线上扩展 Harness 的开发者。先说明 **自定义工作台** 是什么、由哪些插件组成、如何与右侧对话并排工作；再说明 **Harness 如何把上下文交给模型**（硬规则与扩展点）和 **工作台快照插件** 的目的与数据路径；最后给出自研 UI（员工登录 / 自定义工作台）的日常改法与验收。1tmt 只自研两块界面：全屏 WMS 员工登录、侧栏「自定义工作台」入口打开的左侧业务区；二者用 Vue 3 + Element Plus 写在 `packages/1tmt/vue`，右侧对话与 DeepSeek 账户登录仍是 Harness 原生 React。

## Table of Contents

- [自定义工作台：原理总览](#custom-workbench-overview)
- [Harness 上下文读取：工作原理](#how-harness-reads-context)
- [工作台快照插件：目的与原理](#workbench-snapshot-plugins-purpose-and-design)
- [边界：改什么 / 不改什么](#boundaries-change--do-not-change)
- [目录速查](#directory-map)
- [日常开发流程](#day-to-day-workflow)
- [改登录页](#edit-the-login-page)
- [改自定义工作台](#edit-the-custom-workbench)
- [给 Vue 增加 Host 能力（Bridge）](#give-vue-host-capabilities-bridge)
- [文案与多语言](#copy-and-locales)
- [验收清单](#acceptance-checklist)
- [相关链接](#related-links)

-----

<a id="custom-workbench-overview"></a>
## 自定义工作台：原理总览

**自定义工作台**是侧栏里的一个入口。点开后，主区域左右分屏：左侧是 1tmt 自研的 Vue 业务界面（列表、单据表单等），右侧是 Harness 原生对话。左侧当前展示的结构化数据会上报给 Host，对话在下一步请求模型前自动带上，所以用户可以直接对右侧说「把左边这个列表整理一下」。

### 组成：四个部件，各管一件事

| 部件 | 包 / Loader 行 id | 运行位置 | 负责什么 |
|---|---|---|---|
| 入口与外壳 | `@deepseek-ai/dsh-client-ui-custom-workbench` / `ui-custom-workbench` | 浏览器 | 注册侧栏入口和主区域页面；把 Vue 岛屿挂进左侧；把 Remote 回调组装成 `CustomWorkbenchBridge` |
| 业务界面 | `@deepseek-ai/dsh-1tmt-vue`（不是 Loader 行，被外壳打包内联） | 浏览器 | Vue 3 + Element Plus 页面；数据变化时调用 `bridge.publishSnapshot` |
| 快照存储 | `@deepseek-ai/dsh-1tmt-workbench` / `1tmt-workbench` | Host | Typert Remote `tmtWorkbench`：在 Host 进程内保存最新一份快照并计算 hash |
| 对话注入 | `@deepseek-ai/dsh-1tmt-workbench-context` / `1tmt-workbench-context` | Host | `agent/pre-step` 监听器：快照变化时向 Session 追加一条带 `source` 的 `user/message` |

前两者决定「看得见」，后两者决定「对话读得到」。它们之间只通过 Bridge 和 Remote 交互，因此可以分别关闭（见下文开关矩阵）。

### 从点击入口到左右分屏

```mermaid
flowchart TB
  entry["Sidebar entry (sidebar.panellist, id custom-workbench)"]
  select["layout.selectPanel('custom-workbench')"]
  frame["AppFrame: activePanelId === SPLIT_WITH_CONVERSATION_PANEL_ID"]
  left["Left pane: main slot entryKey custom-workbench → CustomWorkbenchPage"]
  right["Right pane: main slot entryKey conversation → native Conversation"]
  vue["mountCustomWorkbench(el, bridge) → Vue + Element Plus"]

  entry --> select --> frame
  frame --> left --> vue
  frame --> right
```

1. **注册**：`ui-custom-workbench` 在浏览器端 `apply` 里做两次 `ctx.slots.register`：一次注册到 `sidebar.panellist`（图标与文案「自定义工作台」），一次注册到 `main` 槽位，key 为面板 id `custom-workbench`（页面组件 `CustomWorkbenchPage`）。两次注册都是 effect，插件卸载时自动撤销，入口随之消失。
2. **选中**：点击侧栏入口时，`ui-sidebar` 调用 `ctx.layout.selectPanel('custom-workbench')`，把根布局 store 的 `activePanelId` 设为该 id。
3. **分屏**：`ui-layout` 的 `AppFrame` 发现 `activePanelId` 等于 `SPLIT_WITH_CONVERSATION_PANEL_ID`（值为 `custom-workbench`），于是同时渲染两个 `main` 槽位：左侧 `custom-workbench`，右侧 `conversation`，大约各占一半。其它主面板（插件页、设置类页面）仍是整块替换对话。
4. **切换会话不收起**：`ui-workspace` 的导航在「显示对话」时，若当前已是自定义工作台分屏，就保留分屏，只切换右侧会话；其它整块面板则回到纯对话。
5. **挂载 Vue**：`CustomWorkbenchPage` 渲染一个空的宿主 `div`，在 `useEffect` 中调用 `@deepseek-ai/dsh-1tmt-vue` 的 `mountCustomWorkbench(el, bridge)`。Vue 应用通过 `provide('1tmtBridge', bridge)` 拿到 Bridge，并安装 Element Plus；Element Plus 与工作台样式以 `<style id="dsh-1tmt-element-plus">` / `<style id="dsh-1tmt-custom-workbench">` 注入一次。离开工作台时 React 卸载组件，`unmountCustomWorkbench(el)` 销毁 Vue 应用并清空宿主节点。

Vue 永远不接触 Cordis `ctx`：它能做的事完全由 Bridge 决定（文案 `labels`、`publishSnapshot`、`clearSnapshot`）。外壳在 `inject` 中把 `ctx.remote.tmtWorkbench` 的方法转成 Bridge 回调，Remote 失败时把错误折叠成 `{ ok: false, error: { message } }` 交给 Vue。

### 生命周期

| 时机 | 发生什么 |
|---|---|
| 打开自定义工作台 | Vue 挂载；占位页立即 `publishSnapshot` 一份演示列表，并显示 `published hash=…` |
| 左侧数据变化 | 业务页再次 `publishSnapshot`；Host 覆盖旧快照，hash 随内容变化 |
| 右侧发出下一条消息 | `workbench-context` 在 pre-step 比较 hash：与本 Session 上次注入不同才追加一条 `user/message`，相同则不重复注入 |
| 离开自定义工作台 | Vue 卸载时调用 `clearSnapshot()`，Host 清空快照，后续步骤不再注入 |
| Host 重启 | 快照只在内存里，随进程丢失；已写进 Session 的注入消息保留在日志中 |

### 开关矩阵：关掉哪一行会怎样

在 `packages/bundle/web-app/cordis.patch.yml` 给对应行加 `disabled: true` 并重启 `dsh web`：

| 关闭的行 | 侧栏入口 / 左侧界面 | 对话是否读到工作台数据 |
|---|---|---|
| `ui-custom-workbench` | 消失（槽位注册随插件撤销） | 不会；没有页面再发布快照 |
| `1tmt-workbench-context` | 正常 | 不会；快照仍存在 Host，但没有监听器写入 Session |
| `1tmt-workbench` | 仍显示；浏览器端 `remote.tmtWorkbench` 由生成的描述符挂载，但 Host 没有对应方法，页面显示 `publish failed: …` | 不会；`workbench-context` 也因缺少 `tmtWorkbench` 服务而保持 pending |

只想保留界面、不让模型读取时，关 `1tmt-workbench-context` 即可。

-----

<a id="how-harness-reads-context"></a>
## Harness 上下文读取：工作原理

开发业务 UI 时最容易误判的一点是：**模型看不到浏览器 DOM，也看不到 Vue 组件内存里的 state。** 模型每一轮请求里能用的材料，几乎全部来自 Host 侧已经写入 **Session 日志** 的事件；Agent 循环再从日志投影出发给提供商的消息历史。

### 硬规则：模型可见 ⟺ 已写入 Session 日志

| 说法 | 含义 |
|---|---|
| Model-visible means logged | 每一轮模型请求必须能从 Session 日志重建；新增「要让模型看见」的输入，必须对应 Session 事件 |
| Session 日志是真相源 | `deriveMessages()` 从日志投影模型历史；UI、Remote、工具结果最终都要落到可持久化的事件上 |
| 浏览器不是模型的眼睛 | 自定义工作台里的列表、表单、DOM 文本若不上报 Host、不进日志，右侧对话里的模型永远「不知道」 |

权威表述见 [`docs/architecture.md`](../architecture.zh.md)（Session log / Model-visible means logged）。对照样例：[`packages/context/time-context`](../../packages/context/time-context/README.zh.md) 在 `agent/pre-step` 里追加带 `source` 的 `user/message`。

### 一轮对话里，上下文何时进入模型请求

简化时序（细节以 architecture 为准）：

```text
User submits a prompt in the Web UI
  → Host opens / advances a turn
  → Assemble system prompt, tool schemas, …
  → agent/pre-step (waterfall)
       Listeners may rewrite/append user messages for this step, or reject
  → On enter, durable events such as user/message are appended
  → Derive model history from the log and call the LLM
  → Tool calls / results write back to the log for later steps
```

对「给模型加一段业务上下文」而言，官方扩展点主要是：

1. **`agent/pre-step` 监听器**（推荐用于「每步准备时注入」）：在进入本步前追加或改写 `UserMessage`；返回前必须 `await next()`，否则会掐断 waterfall。
2. **`agent.inject()`**：把上下文排进下一轮被 admit 的请求（见 architecture「Where new behavior goes」）。
3. **工具（tools）**：模型主动调用时再读业务数据；适合大数据、按需拉取，而不是把整页塞进每轮 prompt。

注入的用户侧消息通常带 **`source`**（`MessageSourceMap` 声明的 kind + `form`，例如 `form: 'snapshot'`）。这样 UI、回放、投影都能区分「真人输入」与「插件注入的上下文」。

### 为什么不能「直接读工作台 DOM」

| 做法 | 问题 |
|---|---|
| Playwright / Computer Use 读屏幕 | 慢、脆、非结构化；不是业务真相源 |
| 只改 Vue state，不写 Host | 模型请求组装在 Host；Client 内存对 Agent 不可见 |
| 改 `agent-loop` 或 Conversation 写死工作台 | 破坏扩展点纪律，难卸载、难复用 |
| 把整页 HTML 塞进 system prompt | 噪声大、缓存差、难维护；且仍须有 Session 事件才合规 |

正确方向：**Vue 上报结构化快照 → Host 保存 → 在 pre-step（或 tool）写入 Session → 模型从日志投影读到。**

### 和 Cordis 插件的关系

Harness 几乎所有能力都是 Cordis 插件行（`cordis.yml` / `cordis.patch.yml`）。上下文注入也不例外：做成可挂载/可 `disabled` 的 Host 插件后，卸掉插件行即可关掉「对话读工作台」，而不必改 agent-loop 或拆掉工作台 UI。

-----

<a id="workbench-snapshot-plugins-purpose-and-design"></a>
## 工作台快照插件：目的与原理

### 目的

自定义工作台展示列表或打开单据表单时，用户在右侧对话说「把现在列表整理成 JSON」之类请求，模型应能拿到**当前展示的结构化数据**再回答——而不是猜、也不是读 DOM。

约束：

- **对 Harness 源码侵入尽量小**：不改 agent-loop，不塞进 Conversation；ui-layout / ui-workspace 只共享一个分屏面板 id。
- **独立可卸**：工作台 UI 与「是否注入模型」解耦；卸掉 Host 注入插件后 UI 仍可用。
- **结构化上报**：列表行 / 表单字段，不是 HTML。

### 拆成两行 Host 插件 + 浏览器外壳

| 包 | npm 名 | 职责 | 是否写 Session |
|---|---|---|---|
| `packages/1tmt/workbench` | `@deepseek-ai/dsh-1tmt-workbench` | Host Remote `tmtWorkbench`：进程内保存最新快照 | 否（只存内存） |
| `packages/1tmt/workbench-context` | `@deepseek-ai/dsh-1tmt-workbench-context` | 监听 `agent/pre-step`，在 hash 变化时追加 durable `user/message` | 是 |
| `packages/client/ui-custom-workbench` | `@deepseek-ai/dsh-client-ui-custom-workbench` | React 外壳：把 `ctx.remote.tmtWorkbench` 打成 `CustomWorkbenchBridge` | 否（只转发） |
| `packages/1tmt/vue` | `@deepseek-ai/dsh-1tmt-vue` | 工作台 Vue：在业务数据变化时 `publishSnapshot` | 否（只调用 Bridge） |

`workbench` 与 `workbench-context` 分开，是为了：只想存快照、以后用 tool 拉全量时，可以关掉 context 注入；或反过来只关注入、保留 Remote。对齐 `time-context` 的「独立挂载」习惯。

### 端到端数据路径

```mermaid
flowchart LR
  vue[Vue custom workbench list/form]
  bridge[CustomWorkbenchBridge]
  remote[tmtWorkbench Remote]
  store[Host in-process snapshot + hash]
  prestep[workbench-context pre-step]
  session[Session user/message]
  model[Next model request]

  vue -->|publishSnapshot structured| bridge
  bridge --> remote
  remote --> store
  store --> prestep
  prestep -->|write only when hash changes| session
  session -->|deriveMessages| model
```

逐步说明：

1. **Vue** 在列表/表单变化（或占位页挂载）时调用 `bridge.publishSnapshot({ kind, title, rows, form? })`。
2. **外壳** `CustomWorkbenchPage` 把调用转到 `ctx.remote.tmtWorkbench.publishSnapshot`（Typert Remote，浏览器 → Host）。
3. **`dsh-1tmt-workbench`** 在 Host 进程内替换「当前快照」，并计算 content `hash`（不落盘、不写 Session）。
4. **`dsh-1tmt-workbench-context`** 在 `agent/pre-step` 里读取 `ctx.tmtWorkbench.getStored()`：若快照非空且 `hash` 与本 Session 上次注入不同，则追加一条 `source.kind: '1tmt-workbench-context'`、`form: 'snapshot'` 的 `user/message`。「上次注入的 hash」由 Session 投影 `tmtWorkbenchContext` 从日志折叠得出，所以回放与重启后判断一致。
5. Agent 循环把该消息写入 Session 后，本步及后续投影到模型请求的历史里就会包含这段上下文。

默认只注入**摘要**（kind / title / items / hash），模型看到的文字形如 `Custom workbench snapshot (kind=list, title="…", items=2, hash=…).`。`injectFullRows: true` 时在 `maxPayloadChars` 内附带 JSON；超限则注明省略。大数据按需再走只读 tool（尚未实现）。

### 挂载与卸载

`packages/bundle/web-app/cordis.patch.yml` 已挂：

```yaml
- id: 1tmt-workbench
  name: '@deepseek-ai/dsh-1tmt-workbench'
- id: 1tmt-workbench-context
  name: '@deepseek-ai/dsh-1tmt-workbench-context'
  config:
    injectFullRows: false
    maxPayloadChars: 4000
```

Client 侧：`dsh-api-remotes` 挂载生成的 `tmtWorkbench` remote；`ui-custom-workbench` 已注入 `remote.tmtWorkbench`。

卸掉 `1tmt-workbench-context`（或 `disabled: true`）后：工作台 UI 仍可展示，但**对话不再自动读到快照**——这就是「独立插件」边界。完整开关效果见 [开关矩阵](#custom-workbench-overview)。

### 业务页如何上报（开发契约）

```ts
await bridge.publishSnapshot({
  kind: 'list', // or 'form' | 'empty'
  title: 'Receive bills',
  rows: [
    { id: 1, billNo: 'RCV-001', qty: 10 },
    { id: 2, billNo: 'RCV-002', qty: 20 },
  ],
})

// When opening a bill editor:
await bridge.publishSnapshot({
  kind: 'form',
  title: 'Receive bill detail',
  rows: [],
  form: { id: 1, billNo: 'RCV-001', qty: 10 },
})
```

约定：

- 只传**结构化字段**（字符串 / 数字 / 布尔 / null），不要传 HTML 或 Element 实例。
- 列表或表单**每次用户可见内容变化**后发布；相同内容重复发布会得到相同 hash，pre-step 不会重复注入。
- 离开工作台时外壳/Vue 会 `clearSnapshot()`，避免旧数据残留在进程里。

### 当前限制（读包 README 获取细节）

- 快照是**进程内最新一份**，未按 Session 分桶；Host 重启丢失。
- 尚无只读 tool；超大 payload 依赖摘要或日后 tool。
- 包契约：[`workbench/README.md`](../../packages/1tmt/workbench/README.zh.md)、[`workbench-context/README.md`](../../packages/1tmt/workbench-context/README.zh.md)。

### 不要做（再次强调）

- 用读 DOM / 截图当业务真相
- 只改 Vue state 却期望模型「看见」
- 改 `agent-loop` 或把工作台逻辑写死进 Conversation
- 把整页 HTML 塞进 system prompt

-----

<a id="boundaries-change--do-not-change"></a>
## 边界：改什么 / 不改什么

| 场景 | 改这里 | 不要改 |
|---|---|---|
| 员工登录表单 / 样式 / 交互 | `packages/1tmt/vue/src/apps/login/` | `packages/client/ui-settings-account`（DeepSeek 账户登录） |
| 自定义工作台业务页 | `packages/1tmt/vue/src/apps/custom-workbench/` | Conversation、侧栏框架、设置页主体 |
| 工作台 → 模型上下文 | Vue `publishSnapshot` + 上表两个 Host 插件 | agent-loop、ui-layout、读 DOM |
| 登录调后端 / MCP | Bridge + `packages/api/pgy-login`（Host Remote） | 直接在 Vue 里 `import` Cordis / `ctx` |
| 侧栏「自定义工作台」图标、入口文案 | `packages/client/ui-custom-workbench`（外壳） | 把整站迁到 Vue |

架构关系：

```mermaid
flowchart LR
  subgraph react [Harness React shells]
    pgyHost[ui-pgy-login]
    customHost[ui-custom-workbench]
    conv[Conversation right]
  end
  subgraph vue [packages/1tmt/vue]
    loginApp[login/App.vue]
    customApp[custom-workbench/App.vue]
  end
  subgraph host [Host plugins]
    workbench[tmtWorkbench]
    ctxPlugin[workbench-context]
  end
  pgyHost -->|mountLogin + LoginBridge| loginApp
  customHost -->|mountCustomWorkbench + CustomWorkbenchBridge| customApp
  customApp -->|publishSnapshot| customHost
  customHost -->|Remote| workbench
  workbench --> ctxPlugin
  ctxPlugin -->|pre-step user/message| conv
```

Vue 内通过 `inject('1tmtBridge')` 拿 Bridge；**禁止**在 Vue 工程依赖 Cordis、React 或其它 `dsh-client-*` 插件实现。

-----

<a id="directory-map"></a>
## 目录速查

```
packages/1tmt/vue/                     # Product UI (npm: @deepseek-ai/dsh-1tmt-vue)
  src/bridge.ts                        # LoginBridge / CustomWorkbenchBridge types
  src/mount.ts                         # mountLogin / mountCustomWorkbench
  src/apps/login/App.vue               # Employee login (Element Plus)
  src/apps/custom-workbench/App.vue    # Custom workbench; publishSnapshot on change
  types/index.d.ts                     # Public types for React shells

packages/1tmt/workbench/               # Host Remote: snapshot store (ctx.tmtWorkbench)
packages/1tmt/workbench-context/       # agent/pre-step: inject changed snapshots
packages/client/ui-pgy-login/          # Login shell: Bridge + mount/unmount
packages/client/ui-custom-workbench/   # Workbench shell: sidebar + Bridge → Remote
packages/api/pgy-login/                # Host Remote: orgs, WMS login, backend URL
packages/api/remotes/                  # Client Remote assembly (includes tmtWorkbench)
docs/1tmt/README.md                    # This guide
```

-----

<a id="day-to-day-workflow"></a>
## 日常开发流程

仓库根目录执行：

```sh
# 1. After Vue edits: emit lib/index.js (prepare also runs on install)
pnpm --filter @deepseek-ai/dsh-1tmt-vue build

# 2. Bundle client shells (rebuild even for CSS/copy tweaks to avoid stale lib)
pnpm --filter @deepseek-ai/dsh-client-ui-pgy-login bundle
pnpm --filter @deepseek-ai/dsh-client-ui-custom-workbench bundle

# 3. After workbench Host source edits: tsc, then Host tsdown (emits typert remote)
pnpm exec tsc -b packages/1tmt/workbench/tsconfig.host.json packages/1tmt/workbench-context
pnpm exec tsdown --config-loader native --env.DSH_BUILD_FACE host

# 4. Launch (change port if 3080 is busy)
pnpm dsh web --no-open
# or: pnpm dsh web --port 3091 --no-open
```

只改 Vue 源码、且宿主机已 `bundle` 过时：重复步骤 1→2→刷新浏览器即可。`pnpm run dev:web` 会重建 client 插件；仍须保证 `dsh-1tmt-vue` 的 `lib/` 是新的。

聚焦自测：

```sh
pnpm exec vitest run packages/1tmt/vue/tests/mount.spec.ts
pnpm exec vitest run packages/1tmt/workbench/tests
pnpm exec vitest run packages/1tmt/workbench-context/tests
pnpm exec vitest run packages/client/ui-pgy-login/tests/login-overlay.client.spec.tsx
pnpm exec vitest run packages/client/ui-custom-workbench/tests
```

-----

<a id="edit-the-login-page"></a>
## 改登录页

1. 编辑 `packages/1tmt/vue/src/apps/login/App.vue`（表单）和 `app.css`（样式）。
2. 组件里用 Element Plus；文案用 `bridge.labels.*`，不要写死中文（便于壳层 i18n）。
3. 需要新字段或新接口时，先扩 `LoginBridge`（见下一节），再在 Vue 里调用。
4. `build` → `ui-pgy-login bundle` → `dsh web`，确认全屏门仍是 Element Plus，且 **设置里的 DeepSeek 账户登录未变**。

登录流程由 Vue 驱动：`status` →（可选）后端地址 → `listOrganizations` → `wmsLogin` → `refreshSessions` → `onLoggedIn()`。成功后由 React 壳拆掉 portal。

设置页「harness 中台」与侧栏「退出登录」仍在 `ui-pgy-login` 的 React 组件里；本轮不迁 Vue。

-----

<a id="edit-the-custom-workbench"></a>
## 改自定义工作台

1. 业务 UI 写在 `packages/1tmt/vue/src/apps/custom-workbench/`（`App.vue`、`stk-input.ts`、CSS）。**新业务模块只加工作台内左侧菜单**，不要再注册 `sidebar.panellist`。
2. 侧栏只保留「自定义工作台」一个 1tmt 业务入口；点开后 AppFrame 左右分屏（面板 id = `custom-workbench`，原理见 [原理总览](#custom-workbench-overview)）。采购管理 → 采购入库在工作台内部。
3. 侧栏入口文案/图标：`packages/client/ui-custom-workbench/src/client/locales.ts`、`CustomWorkbenchIcon.tsx`。
4. Host 能力经 Bridge：`publishSnapshot` / `clearSnapshot`（`tmtWorkbench`）以及采购入库 `listBills` / `viewBill` / `entityOutputs` / `getBarcode` / `getStockInfo` / `submitReport`（`pgyPurReceive`，仅 MCP）。
5. 列表或单据变化后调用 `bridge.publishSnapshot(...)`，对话侧才会在下一轮 pre-step 读到（原理见上文「工作台快照插件」）。

采购入库路径：查收料列表 → 打开详情（View + 明细扩展）→ 手工录仓位码/条码 → 确认入库同步提交（无 PDA 队列、无开发者模式）。DTO 在 Vue `stk-input.ts` 拼装。

-----

<a id="give-vue-host-capabilities-bridge"></a>
## 给 Vue 增加 Host 能力（Bridge）

Vue **不能**直接碰 `ctx`。正确路径：

1. 在 `packages/1tmt/vue/src/bridge.ts` 与 `types/index.d.ts` 增加方法/字段（两边保持一致）。
2. 在外壳组装 Bridge：
   - 登录：`packages/client/ui-pgy-login/src/client/LoginOverlay.tsx`（及 `index.ts` 的 `inject`）
   - 工作台：`packages/client/ui-custom-workbench/src/client/CustomWorkbenchPage.tsx`（需要时给插件加 `inject` 依赖）
3. 若能力尚不存在：先在 Host 包实现 Remote（如 `pgy-login`、`1tmt-workbench`），再接到外壳；Client Remote 需在 `dsh-api-remotes` 挂载。
4. Vue 内：`const bridge = inject<YourBridge>('1tmtBridge')`，只调用 Bridge。

`BridgeResult<T>` 与 Typert `RemoteResult` 对齐：`{ ok: true, value }` / `{ ok: false, error: { message } }`。外壳可直接把 Remote 结果传给 Vue。

-----

<a id="copy-and-locales"></a>
## 文案与多语言

| 文案位置 | 文件 |
|---|---|
| 登录 labels（传给 Vue） | `packages/client/ui-pgy-login/src/client/locales.ts` |
| 工作台标题、侧栏「自定义工作台」、采购入库页文案 | `packages/client/ui-custom-workbench/src/client/locales.ts`（命名空间 `customWorkbench`） |

Vue 侧只读 `bridge.labels`，不要在 `.vue` 里硬编码产品文案。

-----

<a id="acceptance-checklist"></a>
## 验收清单

- [ ] `pnpm --filter @deepseek-ai/dsh-1tmt-vue build` 成功
- [ ] `ui-pgy-login` / `ui-custom-workbench` 两个 host `bundle` 成功
- [ ] Host 侧存在 `packages/1tmt/workbench/lib/typert.remote-client.js`（Remote 已生成）
- [ ] `dsh web`：全屏员工登录为 Element Plus（可用 DevTools 看 `.el-card` / `style#dsh-1tmt-element-plus`）
- [ ] 登录后点「自定义工作台」：左 Vue（含采购管理 → 采购入库）、右原生对话；列表查询会 `publishSnapshot`
- [ ] 采购入库：查单 → 打开 → 录条码 → 确认入库（需 1tmt MCP + 金蝶联调环境）
- [ ] 在右侧对话提问「把现在列表整理成 JSON」：模型能引用演示列表（需 `1tmt-workbench-context` 已挂载）
- [ ] 将 `1tmt-workbench-context` 设为 `disabled: true` 后：工作台仍在，但新对话不再自动带上快照摘要
- [ ] 设置 → 内置插件中能看到 `1tmt-workbench`、`1tmt-workbench-context`、`ui-custom-workbench` 三行且为 active
- [ ] 设置 → DeepSeek 账户相关入口仍是 Harness 原样（未变成 Element Plus 员工登录）

-----

<a id="related-links"></a>
## 相关链接

- 架构（模型可见 / pre-step）：[`docs/architecture.md`](../architecture.zh.md)
- 组说明：[`packages/1tmt/README.md`](../../packages/1tmt/README.zh.md)
- Vue 包契约：[`packages/1tmt/vue/README.md`](../../packages/1tmt/vue/README.zh.md)
- 快照 Remote：[`packages/1tmt/workbench/README.md`](../../packages/1tmt/workbench/README.zh.md)
- pre-step 注入：[`packages/1tmt/workbench-context/README.md`](../../packages/1tmt/workbench-context/README.zh.md)
- 浏览器外壳：[`packages/client/ui-custom-workbench/README.md`](../../packages/client/ui-custom-workbench/README.zh.md)
- 对照样例 time-context：[`packages/context/time-context/README.md`](../../packages/context/time-context/README.zh.md)
- Web Client 壳层：[`docs/subsystems/web-client.md`](../subsystems/web-client.zh.md)
- 1tmt MCP / WMS 登录集成：[`docs/1tmt-ruoyi-wms-integration.md`](../1tmt-ruoyi-wms-integration.zh.md)
- 集成提交说明：[`docs/1tmt-pgy-version-notes.md`](../1tmt-pgy-version-notes.zh.md)
- 1tmt MCP 工具在 RuoYi 仓库 `1tmt-kde-pgy`（与本 UI / 上下文文档分离）
