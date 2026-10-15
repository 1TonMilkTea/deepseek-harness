# 1TMT / Puyuan: Harness version notes (developers)

English | [中文](1tmt-pgy-version-notes.zh.md)

Covers integration commits in this repository after upstream `c288ba2` (Import DeepSeek Harness). For each change: **what changed, how the code runs, and why**. Day-to-day ops: [1tmt-ruoyi-wms-integration.md](./1tmt-ruoyi-wms-integration.md). Counterpart RuoYi commits: RuoYi-Vue repo `docs/1tmt-PGY版本说明.md`.

Current branch tip: latest on `1tmt-deepseek-harness` (includes “client-scoped MCP session tokens”).

---

## Overview: what shipped

| Capability | How it is implemented |
|------|------------|
| Local Web → RuoYi MCP | `pgy-login` mounts `@deepseek-ai/dsh-mcp-client` at runtime (`serverName: 1tmt`); tool names `mcp__1tmt__*` |
| Operators only set the RuoYi URL | Page / Settings Base URL → `POST /mcp/client-sessions` for a session token; `DELETE` on quit |
| Employee WMS login gate | Host `pgyLogin` Remote + fullscreen `ui-pgy-login`; reject create/fork/prompt/list/search when logged out |
| Per-employee local sessions | After login `sessionPersistence.bindRoot(…/employees/<orgId>__<staffNumber>/)`; first login migrates the old shared directory |
| Switch employee | Sidebar “Sign out” → dispose Agents → `closeOpenWriters` → rebind baseRoot → page reload |
| Windows distribution | `pack:desktop-1tmt` builds an Electron NSIS installer; user data fixed under `%LOCALAPPDATA%\Harness` |
| Branding | Truck PNG for favicon / sidebar / empty state; remove BrandWordmark paths that can revive the whale |
| Business MCP convention | Persona requires enterprise rule MCP first, then bill list queries |

---

## Per-commit notes (chronological)

### `258a332` — Wire RuoYi MCP into dsh web and ship a Windows portable zip

**What changed**

- `packages/bundle/web-app/cordis.patch.yml`: mount the MCP client (id/`serverName` was `ruoyi` then).
- `scripts/pack-portable-web.ts`: unpack-and-run zip (bundled Node, start/config scripts); backfill workspace packages missed by `pnpm deploy`.

**How it runs**

`dsh web` Host process MCP client connects to `http://127.0.0.1:8081/mcp` with `Authorization: Bearer …`. Web still opens if RuoYi is down; model-facing tool names are `mcp__ruoyi__` + the RuoYi original name.

**Why**

One PC, one local Agent calling server-side Kingdee capabilities; the portable zip is for field Windows machines without Node.

---

### `1626d69` — Rename the MCP client namespace to 1tmt

**What changed**

- `serverName` / env vars: `DSH_RUOYI_MCP_*` → `DSH_1TMT_MCP_*`.
- Docs renamed to `1tmt-mcp.md`.

**How it runs**

Public tool names become `mcp__1tmt__workbuddyPing`, `kduPing`, `kdePing`, `pgyPing`, and so on.

**Why**

Product name is 1TMT; align with RuoYi’s per-module tool names and drop the temporary `ruoyi` prefix.

---

### `8e24320` — Document which MCP tools dsh web connects to

**What changed**

Docs: label WorkBuddy / Kingdee login / pgy tool ownership.

**Why**

Separate connectivity pings from business MCP during integration and reduce wrong calls.

---

### `ff538cc` — Puyuan WMS login, Inno installer, portable zip keeps dev deps

**What changed**

- New `packages/api/pgy-login`: Host Remote `listOrganizations` / `wmsLogin` / `status`; internally `tools.execute(mcp__1tmt__pgy*)`.
- New `packages/client/ui-pgy-login`: fullscreen login (org + staff number + password).
- `session-controller`: when `pgyLogin` is present, reject create/prompt while logged out.
- `scripts/dsh-portable-web-setup.iss`: Inno per-user install.
- `pack-portable-web`: `pnpm install` after pack so the developer machine is not stripped of deps.

**How it runs**

```
浏览器 LoginOverlay
  → remote.pgyLogin.wmsLogin
  → Host tools.execute(pgyWmsLogin)
  → 1tmt MCP → 金蝶员工校验
  → 进程内 loggedIn=true
  → 此后 create/prompt 才放行
```

Admin accounts stay in server `third.login.enterprise` and never appear on the login page.

**Why**

Operators must pass WMS identity before using the local Agent; installer and portable paths coexist for IT distribution.

---

### `229e198` — Note cross-machine RuoYi MCP URL in 配置.cmd

**What changed**

Comments in portable/install `配置.cmd`: when Harness and RuoYi are on different machines, set `DSH_1TMT_MCP_URL` to `http://<1tmt-IP>:8081/mcp`.

**Why**

Field setups often run Harness on a PC and RuoYi on a server; default `127.0.0.1` connects to the wrong host.

---

### `9297dc4` — Truck brand icons + Kingdee rules-first agent convention

**What changed**

- `apps/web/public`: favicon / brand-mark PNG; remove BrandWordmark fallbacks that revive the whale.
- `cordis.patch.yml` persona: call enterprise rule MCP before business calls.
- Sync receive-bill / rules / generic list tool names in the integration doc.

**How it runs**

The model follows system/persona: `pgyKdeEnterpriseApiRules` first, then `pgyListReceiveBills` or `pgyKdeExecuteBillQuery`.

**Why**

Unified branding; calling FormId/FieldKeys without rules produces bad Kingdee requests.

---

### `b3cc4f2` — Per-employee local sessions + sidebar sign-out

**What changed**

- `pgy-login/employee-scope.ts`: root `employees/<encode(orgId__staffNumber)>/`; first login migrates shared history + `.pgy-employee-scope.json`.
- `session-persistence(-jsonl)`: `getBaseRoot` / `bindRoot`.
- `session-controller`: list/search also require login.
- `LogoutButton` → `pgyLogin.logout` → `location.reload()`.

**How it runs**

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

Isolation key: `orgId + staffNumber` (same staff number across orgs does not collide). Switching employees while logged in is rejected; sign out first.

**Why**

Several people sharing one Windows user and one install directory must not share one session history.

---

### `15b5bb9` — Revert unrelated persistence README + typecheck

**What changed**

- Revert `session-persistence*` README edits unrelated to this login core.
- list/search gate tests add `defaultModelSelection`.

**Why**

Version notes belong in integration docs / Agent Notes; keep public persistence package READMEs free of product-private logic; fix push gates.

---

### `0b37d21` — Fix logout bindRoot vs write-handle race

**What changed**

- `SessionPersistence.closeOpenWriters()` (jsonl: await-close every write handle).
- `logout` order: dispose Agents → **await closeOpenWriters** → bindRoot.

**How it runs**

On Agent teardown, `session/disposed` only **asynchronously** `handle.close()`; an immediate `bindRoot` used to hit `cannot bindRoot while write handles are open`.

**Why**

Otherwise sidebar “Sign out” fails the RPC when a session is open and the page cannot switch employees.

---

### Desktop installer — Electron shell replaces portable zip / 启动.bat / Inno

**What changed**

- New private workspace `desktop-1tmt/` (unpublished, not in the TS aggregate):
  - `src/main.ts`: Electron main. Single instance; show `assets/splash.html` first; background `windowsHide` spawn `payload/runtime/node.exe payload/app/lib/bin.js web --no-open`; on stdout `dsh web: <URL>` call `loadURL` in the same window; external links to the system browser; on close `taskkill /T /F` the whole process tree.
  - `src/config-cmd.ts`: `配置.cmd` template and parse (read `set` lines only; do not execute cmd).
  - `src/host-output.ts`: parse ready lines; split stdout by line.
  - `package.json` `build`: electron-builder NSIS, per-user install, `extraResources` carries `payload`.
- New `scripts/pack-desktop-1tmt.ts` (root script `pack:desktop-1tmt`): reuse the old portable deploy, backfill workspace packages, download/verify Node, smoke steps, write `dist/desktop-1tmt/payload`, restore dev deps, build the shell, invoke electron-builder.
- Delete `scripts/pack-portable-web.ts`, `compile-portable-web-setup.ts`, `dsh-portable-web-setup.iss`, matching specs, and root scripts `pack:portable-web(:setup)`.

**How it runs**

```
双击 Harness
  → 启动页
  → 读 %LOCALAPPDATA%\Harness\配置.cmd（无则生成模板）→ 注入环境变量，DSH_HOME 默认 …\Harness\data
  → spawn node.exe bin.js web --no-open（无黑窗，输出写 logs\host.log）
  → stdout 出现 "dsh web: http://127.0.0.1:…/?token=…" → 窗口加载该地址 → 登录层
  → 后台提前退出 / 180 秒未就绪 → 弹窗（打开配置文件 / 日志目录）后退出
关闭窗口 → taskkill /T /F 结束 dsh web 及其工具子进程
```

Install dir (default `%LOCALAPPDATA%\Programs\Harness`) is separate from user data `%LOCALAPPDATA%\Harness`; upgrade/uninstall leave `配置.cmd` and `data\` alone.

**Why**

Field users want a standalone desktop app like WorkBuddy: no black console, no default browser, stop the service on window close. Upstream `apps/desktop` is a full Electron product (own Host composition and release); a thin private shell only starts and displays, reusing the proven `dsh web` composition and login flow.

---

### Client-scoped MCP session tokens + page-configured RuoYi URL

**What changed**

- `packages/api/pgy-login`
  - `backend-config.ts`: `$DSH_HOME/1tmt-backend.json` stores only the URL; precedence page > `DSH_1TMT_MCP_URL` > developer default.
  - `session-client.ts`: `POST/DELETE {base}/mcp/client-sessions`.
  - `index.ts`: Remote `getBackendConfig` / `setBackendConfig`; issue a token and hot-mount `ctx.plugin(mcp-client)` after start or URL change; destroy the session on dispose / SIGTERM.
- `packages/client/ui-pgy-login`
  - Pre-login “Backend config” form; Settings “Harness platform” block; copy never mentions Token.
- `cordis.patch.yml`: remove hard-coded startup `mcp-1tmt` url/headers; `pgy-login` mounts at runtime.
- `desktop-1tmt`: `before-quit` sends `SIGTERM` first (time for Host `DELETE`), then `taskkill` on timeout; `配置.cmd` becomes an optional IT Base URL preset.
- Docs: `README-1TMT.md`, `docs/1tmt-ruoyi-wms-integration.md`; Host unit tests `backend-config` / `pgy-login`.

**How it runs**

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

**Why**

Operators must not paste a shared MCP Token. The URL is page-configurable; RuoYi issues the token, Redis tracks it, and quit destroys it. Static `mcp.auth-token` / `DSH_1TMT_MCP_TOKEN` remain for the legacy ops path.

---

## Developer verification checklist

1. Host edits (e.g. `pgy-login`): `tsc -b tsconfig.host.json` for that package + `pnpm run bundle` (and typert generation when needed), then restart `pnpm dsh web`.
2. Client plugin edits (e.g. `ui-pgy-login`): `pnpm run bundle` for that package, restart web; or full-repo `pnpm run build`.
3. Shell/branding edits: `pnpm run build:web`, then restart.
4. Unsure what changed: root `pnpm run build`, restart + hard-refresh the browser.
5. Session-token integration: `/mcp` without Bearer → 401; succeed after `POST /mcp/client-sessions`; same token → 401 again after `DELETE`.

---

## Related code map

| Package / file | Role |
|-----------|------|
| `packages/api/pgy-login` | Base URL, session token, dynamic MCP, login Remote, employee root, logout |
| `packages/client/ui-pgy-login` | Pre/post-login backend config, login overlay, Settings “Harness platform”, sign-out |
| `packages/api/session-controller` | Logged-out gate |
| `packages/session/session-persistence*` | `bindRoot` / `closeOpenWriters` |
| `packages/bundle/web-app/cordis.patch.yml` | Login plugin wiring, persona (MCP mounted by pgy-login) |
| `desktop-1tmt/` | Electron desktop shell (splash, background dsh web, graceful quit) |
| `scripts/pack-desktop-1tmt.ts` | payload deploy + NSIS installer |
