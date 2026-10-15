---
description: "1tmt integration: dsh web talks to RuoYi MCP and gates sessions behind Puyuan WMS login."
kind: "reference"
---

# 1TMT: dsh web ↔ RuoYi MCP and Puyuan WMS login

English | [中文](1tmt-ruoyi-wms-integration.zh.md)

This page describes how this repository extends upstream DeepSeek Harness: local `dsh web` calls RuoYi `/mcp`, and employees must sign in with organization + staff number + WMS password before sessions can be created. Do not commit `node_modules/`, `dist/`, or `lib/`; generate them on a developer machine with `pnpm install` and `pnpm run build`.

Per-commit change notes (what / how / why) live in [1tmt-pgy-version-notes.md](./1tmt-pgy-version-notes.md).

## Runtime relationship

```
业务员 PC
  桌面图标 Harness（Electron 窗口）
       → 后台无窗口 resources\payload\runtime\node.exe  app\lib\bin.js web --no-open   （仅 127.0.0.1）
            │  窗口：若依根地址（首次/设置）→ POST /mcp/client-sessions → 会话令牌
            │  窗口内登录：组织 / 员工编码 / 密码
            │  Host：ctx.remote.pgyLogin → 动态挂载 mcp-client → tools.execute(mcp__1tmt__…)
            ▼
       RuoYi-Vue :8081
            POST /mcp/client-sessions（匿名签发）/ DELETE（关程序销毁）
            POST /mcp  Authorization: Bearer <会话令牌>
            （运维旧路径仍可用静态 mcp.auth-token）
            pgyListOrganizations / pgyWmsLogin / …
            管理员账号只在服务器 kde 配置里，不出现在登录页
```

One process per person. Do not bind `dsh web` to `0.0.0.0`. Operators **configure only the base URL, never a Token**; the address is stored in `$DSH_HOME/1tmt-backend.json`, with precedence: page save > `DSH_1TMT_MCP_URL` / `配置.cmd` > developer default `http://127.0.0.1:8081`. After login, local sessions live under `$DSH_HOME/sessions/employees/<orgId>__<staffNumber>/`; the **first** successful login on a machine migrates the old shared session directory into that employee tree once, after which other employees cannot see each other. Sidebar “Sign out” clears the process employee identity, rebinds the session root to the shared root, and reloads the page so another employee can sign in (Host restart not required).

## Source changes (this repository)

| Location | Role |
|---|---|
| `packages/api/pgy-login` | Host Remote: Base URL, session-token issue/destroy, dynamic MCP mount, orgs, WMS login, `logout` |
| `packages/client/ui-pgy-login` | Pre-login backend config, fullscreen login, Settings “Backend / RuoYi”, sidebar sign-out |
| `packages/api/session-controller` | Rejects create / fork / prompt / list / search when logged out (profiles without `pgyLogin` are not gated) |
| `packages/session/session-persistence-jsonl` | `getBaseRoot` / `bindRoot`: switch to the employee directory after login |
| `packages/bundle/web-app/cordis.patch.yml` | Mounts login Remote / UI; MCP is mounted at runtime by `pgy-login`; persona requires rule MCP first |
| `desktop-1tmt/` | Electron desktop shell: reads `配置.cmd`, starts `dsh web` in the background, SIGTERM then force-kill on close |
| `scripts/pack-desktop-1tmt.ts` | Deploys `dsh` + bundled Node into payload, then electron-builder NSIS installer |

Public MCP tool names: `mcp__1tmt__pgyListOrganizations`, `mcp__1tmt__pgyWmsLogin`, `mcp__1tmt__pgyKdeEnterpriseApiRules`, `mcp__1tmt__pgyKdeExecuteBillQuery`, `mcp__1tmt__pgyListReceiveBills`. Installer users mainly set the address in the window; `配置.cmd` is an optional IT preset.

To query receive-bill notifications: call `pgyKdeEnterpriseApiRules(category=listQuery, formId=PUR_ReceiveBill)` first, then `pgyListReceiveBills` (internally a standard ExecuteBillQuery). For other unregistered bills: rules → `pgyKdeExecuteBillQuery`.

RuoYi-side tools and Redis notes live in the RuoYi-Vue repo under `docs/Harness-PGY-WMS集成.md`. MCP token filters: `docs/Harness连接MCP改动说明.md` in that repo.

## Developer machine

```text
pnpm install
pnpm run build
pnpm dsh --profile web
```

Do not use `pnpm install --production` for day-to-day development: it removes `tsx` / `vitest`. The pack script runs a full `pnpm install` again after `deploy --prod`.

## Windows desktop installer

```text
pnpm run pack:desktop-1tmt
```

Output: `dist/desktop-1tmt/installer/Harness-Setup-<version>-x64.exe` (`dist/` is gitignored; do not commit installers, payload, or Node caches). `-- --skip-build` skips the full build; `-- --dry-run` prints steps only. The first pack needs network for Electron and NSIS; on slow networks set `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/` and `ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/`. The pack script runs `pnpm --dir desktop-1tmt install` before building the installer (the desktop shell is outside the root workspace).

To debug the desktop shell in development: `pnpm --dir desktop-1tmt install`, pack once to create `dist/desktop-1tmt/payload`, then `pnpm --dir desktop-1tmt start`.

Install and run:

- Per-user install (default `%LOCALAPPDATA%\Programs\Harness`), no admin, unsigned; choose “Run anyway” if Windows warns about an unknown publisher.
- Double-click desktop “Harness”: splash first, then the same window opens the login page when `dsh web` is ready; no console window, no system browser. Only one instance.
- User data is separate from the install dir, fixed at `%LOCALAPPDATA%\Harness`: `配置.cmd` (optional IT preset), `data\` (sessions, settings, `1tmt-backend.json` = `DSH_HOME`), `logs\host.log`. Upgrade/uninstall leave these alone.
- Operators set the RuoYi root URL in the window (Settings → Backend / RuoYi can change it); on quit the Host tries to `DELETE` the session token.
- Background start failure or timeout shows a dialog that can open the config file or log directory.

Upgrading from the old layout (`启动.bat` / Inno installer): the old uninstaller removes its `配置.cmd`; back up `%LOCALAPPDATA%\Harness\配置.cmd`, uninstall the old build, install the new one, and restore that file; `data\` is untouched.

## Do not commit

- `node_modules/` (`pnpm install`)
- `lib/`, `*.tsbuildinfo` (`pnpm run build`)
- `/dist/` (payload, installer, Node download cache)
- `.env`, real API keys, real `mcp.auth-token`
