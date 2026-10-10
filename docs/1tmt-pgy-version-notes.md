# 1TMT / 蒲公英：Harness 版本说明（开发向）

面向本仓库相对上游 `c288ba2`（Import DeepSeek Harness）之后的集成提交。说明每次**改了什么、代码怎么走、为什么这么改**。联调操作见 [1tmt-ruoyi-wms-integration.md](./1tmt-ruoyi-wms-integration.md)。对端若依提交见 RuoYi-Vue 仓库 `docs/1tmt-PGY版本说明.md`。

当前分支 tip：见 `1tmt-deepseek-harness-windows` 最新提交（含「客户端专属 MCP 会话令牌」）。

---

## 总览：交付了什么

| 能力 | 怎么实现的 |
|------|------------|
| 本机 Web 调若依 MCP | `pgy-login` 运行时动态挂载 `@deepseek-ai/dsh-mcp-client`（`serverName: 1tmt`），工具名 `mcp__1tmt__*` |
| 业务员只配若依地址 | 页面 / 设置填 Base URL → `POST /mcp/client-sessions` 领会话令牌；关程序 `DELETE` |
| 员工 WMS 登录门闩 | Host `pgyLogin` Remote + 全屏 `ui-pgy-login`；未登录拒绝 create/fork/prompt/list/search |
| 按员工隔离本机会话 | 登录后 `sessionPersistence.bindRoot(…/employees/<orgId>__<staffNumber>/)`；首次登录迁旧共享目录 |
| 换人登录 | 侧栏「退出登录」→ dispose Agents → `closeOpenWriters` → 绑回 baseRoot → 页面 reload |
| Windows 分发 | `pack:desktop-1tmt` 打 Electron 桌面安装包（NSIS）；用户数据固定在 `%LOCALAPPDATA%\Harness` |
| 品牌 | favicon / 侧栏 / 空态用货车 PNG，去掉可复活鲸鱼的 BrandWordmark 路径 |
| 业务 MCP 约定 | persona 要求先调企业版规则 MCP，再查单据列表 |

---

## 按提交说明（时间正序）

### `258a332` — 为 dsh web 接入若依 MCP，并提供 Windows 绿色包

**改了什么**

- `packages/bundle/web-app/cordis.patch.yml`：挂 MCP 客户端（当时 id/`serverName` 为 `ruoyi`）。
- `scripts/pack-portable-web.ts`：打解压即用 zip（内嵌 Node、启动/配置脚本）；补 `pnpm deploy` 漏掉的 workspace 包。

**逻辑**

`dsh web` Host 进程内 MCP 客户端连 `http://127.0.0.1:8081/mcp`，请求头 `Authorization: Bearer …`。若依未启动时 Web 仍可打开；模型侧工具名为 `mcp__ruoyi__` + 若依原名。

**为什么**

一人一机本地 Agent 调服务器金蝶能力；绿色包给不会装 Node 的现场 Windows。

---

### `1626d69` — MCP 客户端改为 1tmt 命名空间

**改了什么**

- `serverName` / 环境变量：`DSH_RUOYI_MCP_*` → `DSH_1TMT_MCP_*`。
- 文档改名 `1tmt-mcp.md`。

**逻辑**

公开工具名变为 `mcp__1tmt__workbuddyPing`、`kduPing`、`kdePing`、`pgyPing` 等。

**为什么**

产品命名是 1TMT，与若依侧按模块拆分的工具名对齐，避免长期挂着临时 `ruoyi` 前缀。

---

### `8e24320` — 说明 dsh web 连接的 MCP 工具分属

**改了什么**

文档：标明 WorkBuddy / 金蝶登录 / pgy 三类工具归属。

**为什么**

联调时区分「连通性 ping」和「业务 MCP」，减少误调。

---

### `ff538cc` — 接入蒲公英 WMS 登录、Inno 安装包，绿色包不卸开发依赖

**改了什么**

- 新包 `packages/api/pgy-login`：Host Remote `listOrganizations` / `wmsLogin` / `status`；内部 `tools.execute(mcp__1tmt__pgy*)`。
- 新包 `packages/client/ui-pgy-login`：全屏登录层（组织 + 员工编码 + 密码）。
- `session-controller`：有 `pgyLogin` 时未登录拒绝建会话/提问。
- `scripts/dsh-portable-web-setup.iss`：Inno 人均安装。
- `pack-portable-web`：打包结束后 `pnpm install`，避免开发机依赖被卸掉。

**逻辑**

```
浏览器 LoginOverlay
  → remote.pgyLogin.wmsLogin
  → Host tools.execute(pgyWmsLogin)
  → 若依 MCP → 金蝶员工校验
  → 进程内 loggedIn=true
  → 此后 create/prompt 才放行
```

管理员账号只在服务器 `third.login.enterprise`，不进登录页。

**为什么**

业务员必须先过 WMS 身份，才能用本机 Agent；安装包路径与绿色包并存，适配 IT 分发。

---

### `229e198` — 配置.cmd 补充跨机对接若依 MCP 的中文备注

**改了什么**

绿色包/安装目录里的 `配置.cmd` 注释：写清 `DSH_1TMT_MCP_URL` 在「Harness 与若依不同机」时要改成 `http://若依IP:8081/mcp`。

**为什么**

现场常见「PC 跑 Harness、服务器跑若依」，默认 `127.0.0.1` 会连错。

---

### `9297dc4` — 货车品牌图标 + 金蝶规则智能体先行约定

**改了什么**

- `apps/web/public`：favicon / brand-mark PNG；去掉易复活鲸鱼的 BrandWordmark 回退。
- `cordis.patch.yml` persona：要求业务调用前先调企业版规则 MCP。
- 同步集成文档中的收料 / 规则 / 通用列表工具名。

**逻辑**

模型按 system/persona 先 `pgyKdeEnterpriseApiRules`，再 `pgyListReceiveBills` 或 `pgyKdeExecuteBillQuery`。

**为什么**

品牌统一；未读规则就乱调 FormId/FieldKeys 会打出错误金蝶请求。

---

### `b3cc4f2` — 按员工隔离本机会话 + 侧栏退出登录

**改了什么**

- `pgy-login/employee-scope.ts`：根目录 `employees/<encode(orgId__staffNumber)>/`；首次登录迁共享历史 + `.pgy-employee-scope.json`。
- `session-persistence(-jsonl)`：`getBaseRoot` / `bindRoot`。
- `session-controller`：list/search 同样要求登录。
- `LogoutButton` → `pgyLogin.logout` → `location.reload()`。

**逻辑**

```
wmsLogin 成功
  → migrateLegacySessionsOnce（仅第一次）
  → bindRoot(employeeRoot)
  → 之后 create/list 只看见该员工目录

logout
  → dispose 活着的 Agent
  → bindRoot(baseRoot)
  → 清 loggedIn / employee
  → 前端整页刷新，重新出现登录层
```

隔离键：`orgId + staffNumber`（同工号跨组织不撞车）。已登录状态下换另一个员工会被拒绝，必须先退出。

**为什么**

同一 Windows 用户、同一安装目录下多人轮流用时，不能共用一份会话历史。

---

### `15b5bb9` — 还原无关 persistence README + 类型检查

**改了什么**

- 还原 `session-persistence*` 的 README（与本次登录核心无关的文档改动撤回）。
- list/search 门闩测试补 `defaultModelSelection`。

**为什么**

版本说明应落在集成文档/Agent Note，避免 persistence 公共包 README 被产品私有逻辑带偏；修好推送门禁。

---

### `0b37d21` — 修复退出登录 bindRoot 与写句柄竞态

**改了什么**

- `SessionPersistence.closeOpenWriters()`（jsonl 实现：await 关闭所有 write handle）。
- `logout` 顺序：dispose Agents → **await closeOpenWriters** → bindRoot。

**逻辑**

Agent 拆除时 `session/disposed` 只会**异步** `handle.close()`，原先立刻 `bindRoot` 会撞上 `cannot bindRoot while write handles are open`。

**为什么**

否则侧栏「退出登录」在已有打开会话时 RPC 失败，页面无法换人。

---

### 桌面安装包 — Electron 桌面壳替换绿色 zip / 启动.bat / Inno

**改了什么**

- 新增私有 workspace `desktop-1tmt/`（不发布、不进 TS 聚合）：
  - `src/main.ts`：Electron 主进程。单实例；先显示 `assets/splash.html`；后台 `windowsHide` 拉起 `payload/runtime/node.exe payload/app/lib/bin.js web --no-open`；读到 stdout 的 `dsh web: <URL>` 后在本窗口 `loadURL`；外链交给系统浏览器；关窗 `taskkill /T /F` 结束整棵进程树。
  - `src/config-cmd.ts`：`配置.cmd` 模板与解析（只读 `set` 行，不执行 cmd）。
  - `src/host-output.ts`：解析就绪行、按行切分 stdout。
  - `package.json` 的 `build` 段：electron-builder NSIS，按用户安装，`extraResources` 带 `payload`。
- 新增 `scripts/pack-desktop-1tmt.ts`（根脚本 `pack:desktop-1tmt`）：沿用原绿色包的 deploy、补齐 workspace 包、下载并校验 Node、smoke 步骤，产物写入 `dist/desktop-1tmt/payload`，恢复开发依赖后构建壳并调用 electron-builder。
- 删除 `scripts/pack-portable-web.ts`、`compile-portable-web-setup.ts`、`dsh-portable-web-setup.iss` 及对应 spec、根脚本 `pack:portable-web(:setup)`。

**逻辑**

```
双击 Harness
  → 启动页
  → 读 %LOCALAPPDATA%\Harness\配置.cmd（无则生成模板）→ 注入环境变量，DSH_HOME 默认 …\Harness\data
  → spawn node.exe bin.js web --no-open（无黑窗，输出写 logs\host.log）
  → stdout 出现 "dsh web: http://127.0.0.1:…/?token=…" → 窗口加载该地址 → 登录层
  → 后台提前退出 / 180 秒未就绪 → 弹窗（打开配置文件 / 日志目录）后退出
关闭窗口 → taskkill /T /F 结束 dsh web 及其工具子进程
```

安装目录（默认 `%LOCALAPPDATA%\Programs\Harness`）与用户数据目录 `%LOCALAPPDATA%\Harness` 分离，升级、卸载不碰 `配置.cmd` 与 `data\`。

**为什么**

现场希望像 WorkBuddy 一样是一个独立桌面程序：没有黑色命令行窗口，不依赖默认浏览器，关窗即停服务。上游 `apps/desktop` 是完整的 Electron 产品（自带 Host 组合与发布流程），改造成本高；私有薄壳只负责启动和展示，复用已验证的 `dsh web` 组合与登录流程。

---

### 客户端专属 MCP 会话令牌 + 页面配置若依地址

**改了什么**

- `packages/api/pgy-login`
  - `backend-config.ts`：`$DSH_HOME/1tmt-backend.json` 只存地址；优先级 页面 > `DSH_1TMT_MCP_URL` > 开发默认。
  - `session-client.ts`：`POST/DELETE {base}/mcp/client-sessions`。
  - `index.ts`：Remote `getBackendConfig` / `setBackendConfig`；启动或改地址后签发令牌并 `ctx.plugin(mcp-client)` 热挂载；dispose / SIGTERM 时销毁会话。
- `packages/client/ui-pgy-login`
  - 登录前「后端配置」表单；设置页新增「后端 / 若依」区块；文案不提 Token。
- `cordis.patch.yml`：去掉启动时写死的 `mcp-1tmt` url/headers；由 `pgy-login` 运行时挂载。
- `desktop-1tmt`：`before-quit` 先 `SIGTERM`（给 Host 发 DELETE 的时间），超时再 `taskkill`；`配置.cmd` 改为 IT 可选预置 Base URL。
- 文档：`README-1TMT.md`、`docs/1tmt-ruoyi-wms-integration.md`；Host 单测 `backend-config` / `pgy-login`。

**逻辑**

```
未配置地址 → LoginOverlay 显示「后端配置」
保存 Base URL → setBackendConfig
  → 写 1tmt-backend.json
  → POST /mcp/client-sessions → Bearer 会话令牌
  → dispose 旧 mcp-client → 挂载新实例（url={base}/mcp）
  → 再 listOrganizations → 员工登录表单
设置里改地址 → 同上重连
关程序 → Host DELETE 会话；桌面壳 SIGTERM → 短等待 → 强杀
```

**为什么**

业务员不应手填共享 MCP Token。地址可在页面配置；令牌由若依签发、Redis 记账、关程序销毁。静态 `mcp.auth-token` / `DSH_1TMT_MCP_TOKEN` 仍留给运维旧路径。

---

## 开发机验证清单

1. 改 Host（如 `pgy-login`）：对该包 `tsc -b tsconfig.host.json` + `pnpm run bundle`（必要时再跑 typert 生成），重启 `pnpm dsh web`。
2. 改 Client 插件（如 `ui-pgy-login`）：对该包 `pnpm run bundle`，再重启 web；或整库 `pnpm run build`。
3. 改页面壳/品牌：`pnpm run build:web` 后重启。
4. 不知道改了哪些：根目录 `pnpm run build`，再重启 + 浏览器强制刷新。
5. 会话令牌联调：无 Bearer 调 `/mcp` → 401；`POST /mcp/client-sessions` 后再调应成功；`DELETE` 后同一 token 再 401。

---

## 关键代码地图

| 包 / 文件 | 职责 |
|-----------|------|
| `packages/api/pgy-login` | Base URL、会话令牌、动态 MCP、登录 Remote、员工根、logout |
| `packages/client/ui-pgy-login` | 登录前后端配置、登录层、设置「后端 / 若依」、退出按钮 |
| `packages/api/session-controller` | 未登录门闩 |
| `packages/session/session-persistence*` | `bindRoot` / `closeOpenWriters` |
| `packages/bundle/web-app/cordis.patch.yml` | 登录插件装配、persona（MCP 由 pgy-login 挂载） |
| `desktop-1tmt/` | Electron 桌面壳（启动页、后台 dsh web、优雅退出） |
| `scripts/pack-desktop-1tmt.ts` | payload 部署 + NSIS 安装包 |
