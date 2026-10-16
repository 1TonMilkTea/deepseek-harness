---
description: "1tmt 集成：dsh web 对接 1tmt MCP，并以蒲公英 WMS 登录门禁会话。"
kind: "reference"
---

# 1TMT：dsh web 对接 1tmt MCP 与蒲公英 WMS 登录

[English](1tmt-ruoyi-wms-integration.md) | 中文

本文说明本仓库相对上游 DeepSeek Harness 的集成：本机 `dsh web` 调用 RuoYi `/mcp`，员工用组织 + 员工编码 + WMS 密码登录后才能建会话。不要把 `node_modules/`、`dist/`、`lib/` 提交进 git；开发机用 `pnpm install` 与 `pnpm run build` 生成它们。

按提交的改动说明（改了什么 / 逻辑 / 为什么）见 [1tmt-pgy-version-notes.md](./1tmt-pgy-version-notes.zh.md)。

## 运行时关系

```
业务员 PC
  桌面图标 Harness（Electron 窗口）
       → 后台无窗口 resources\payload\runtime\node.exe  app\lib\bin.js web --no-open   （仅 127.0.0.1）
            │  窗口：harness 中台根地址（首次/设置）→ POST /mcp/client-sessions → 会话令牌
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

一人一进程。不要把 `dsh web` 绑到 `0.0.0.0`。业务员**只配地址、不填 Token**；地址存 `$DSH_HOME/1tmt-backend.json`，优先级：页面保存 > `DSH_1TMT_MCP_URL` / `配置.cmd` > 开发默认 `http://127.0.0.1:8081`。登录成功后，本机会话落在 `$DSH_HOME/sessions/employees/<orgId>__<staffNumber>/`；本机**第一次**成功登录会把旧的共享会话目录一次性迁入该员工树，之后其他员工互不可见。侧栏「退出登录」会清掉本进程员工身份、把会话根绑回共享根并刷新页面，随后可换员工登录（不必重启 Host）。

## 源码改动（本仓库）

| 位置 | 作用 |
|---|---|
| `packages/api/pgy-login` | Host Remote：Base URL、会话令牌签发/销毁、动态挂载 MCP、拉组织、WMS 登录、`logout` |
| `packages/api/pgy-pur-receive` | Host Remote：采购入库（列表/View/条码/仓位/提交），仅 `tools.execute` → 1tmt MCP，不直连金蝶 |
| `packages/client/ui-pgy-login` | 登录前「后端配置」、全屏登录、设置「harness 中台」、侧栏退出 |
| `packages/api/session-controller` | 未登录时拒绝 create / fork / prompt / list / search（无 `pgyLogin` 服务的 profile 不拦） |
| `packages/session/session-persistence-jsonl` | `getBaseRoot` / `bindRoot`：登录后切到员工目录 |
| `packages/bundle/web-app/cordis.patch.yml` | 挂登录 Remote / UI；MCP 由 `pgy-login` 运行时挂载；persona 强制先调规则 MCP |
| `desktop-1tmt/` | Electron 桌面壳：读 `配置.cmd`、后台拉起 `dsh web`、关窗时 SIGTERM 再强杀 |
| `scripts/pack-desktop-1tmt.ts` | 部署 `dsh` + 内置 Node 到 payload，再用 electron-builder 打 NSIS 安装包 |

MCP 公开工具名：`mcp__1tmt__pgyListOrganizations`、`mcp__1tmt__pgyWmsLogin`、`mcp__1tmt__pgyKdeEnterpriseApiRules`、`mcp__1tmt__pgyKdeExecuteBillQuery`、`mcp__1tmt__pgyListReceiveBills`、`mcp__1tmt__pgyKdeViewBill`、`mcp__1tmt__pgyGetPurReceiveEntityOutputs`、`mcp__1tmt__pgyGetBarcodeByNumber`、`mcp__1tmt__pgyGetStockInfoByNumber`、`mcp__1tmt__pgySubmitStkInStockRecordReport`。安装包用户主路径在窗口配地址；`配置.cmd` 仅 IT 预置。

查收料通知单：先 `pgyKdeEnterpriseApiRules(category=listQuery, formId=PUR_ReceiveBill)`，再 `pgyListReceiveBills`（内部即标准 ExecuteBillQuery）。其他未登记单据：规则 → `pgyKdeExecuteBillQuery`。采购入库 Web：自定义工作台首页点「采购入库」图标进入列表，经 `pgyPurReceive` Remote 调上述 MCP（Harness 禁止直连金蝶）。

1tmt 侧工具与 Redis 说明见 RuoYi-Vue 仓库 `docs/Harness-PGY-WMS集成.md`。MCP 令牌过滤器见该仓库 `docs/Harness连接MCP改动说明.md`。

## 开发机

```text
pnpm install
pnpm run build
pnpm dsh --profile web
```

不要用 `pnpm install --production` 当日常开发：会卸掉 `tsx` / `vitest`。打包脚本在 `deploy --prod` 之后会再执行一次完整 `pnpm install`。

## Windows 桌面安装包

```text
pnpm run pack:desktop-1tmt
```

产物：`dist/desktop-1tmt/installer/Harness-Setup-<版本>-x64.exe`（`dist/` 已 gitignore，不要提交安装包、payload、Node 缓存）。`-- --skip-build` 跳过全量构建，`-- --dry-run` 只打印步骤。首次打包 electron-builder 需联网下载 Electron 与 NSIS；国内网络慢时可先设 `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/` 与 `ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/`。打包脚本会在打安装包前单独执行 `pnpm --dir desktop-1tmt install`（桌面壳不在根 workspace 里）。

开发时调试桌面壳：先 `pnpm --dir desktop-1tmt install`，打一次包生成 `dist/desktop-1tmt/payload`，再 `pnpm --dir desktop-1tmt start`。

安装与运行：

- 安装包按用户安装（默认 `%LOCALAPPDATA%\Programs\Harness`），无需管理员，未签名，Windows 提示未知发布者时选「仍要运行」。
- 双击桌面「Harness」：先显示启动页，后台 `dsh web` 就绪后在同一窗口打开登录页；不弹黑窗、不开浏览器。只允许运行一个实例。
- 用户数据与安装目录分开，固定在 `%LOCALAPPDATA%\Harness`：`配置.cmd`（IT 可选预置地址）、`data\`（会话、设置、`1tmt-backend.json`，即 `DSH_HOME`）、`logs\host.log`。升级或卸载不会动这三项。
- 业务员主路径在窗口填写 harness 中台根地址（设置 → harness 中台 可改）；关程序时尽量 `DELETE` 销毁会话令牌。
- 后台启动失败或超时会弹窗，可直接打开配置文件或日志目录。

从旧版（`启动.bat` / Inno 安装包）升级：旧卸载程序会删掉它装的 `配置.cmd`，先备份 `%LOCALAPPDATA%\Harness\配置.cmd`，卸载旧版后再装新版并放回该文件；`data\` 不受影响。

## 不要提交

- `node_modules/`（`pnpm install`）
- `lib/`、`*.tsbuildinfo`（`pnpm run build`）
- `/dist/`（payload、安装包、Node 下载缓存）
- `.env`、真实 API Key、真实 `mcp.auth-token`
