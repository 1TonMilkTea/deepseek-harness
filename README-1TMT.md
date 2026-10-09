# 1TMT Harness（Windows 桌面版说明）

本仓库在上游 DeepSeek Harness 之上，做了现场要用的三件事：

1. **连若依 MCP**：本机 Agent 调用 RuoYi 的 `/mcp`（金蝶 / 蒲公英能力）
2. **员工登录**：组织 + 员工编码 + WMS 密码，登录后才能建会话；按员工隔离本机会话
3. **Windows 桌面程序**：双击「Harness」打开独立窗口，不弹黑窗、不依赖浏览器

更细的联调说明见 [docs/1tmt-ruoyi-wms-integration.md](docs/1tmt-ruoyi-wms-integration.md)；按提交的改动说明见 [docs/1tmt-pgy-version-notes.md](docs/1tmt-pgy-version-notes.md)。

---

## 业务员怎么用

1. 安装 `Harness-Setup-*-x64.exe`（无需管理员）
2. 编辑 `%LOCALAPPDATA%\Harness\配置.cmd`：
   - `DSH_1TMT_MCP_URL`：若依地址 + `/mcp`
     - 本机同机：可保留 `http://127.0.0.1:8081/mcp`
     - 若依在服务器：改成 `http://服务器IP:8081/mcp`
   - `DSH_1TMT_MCP_TOKEN`：与若依 `application.yml` 里 `mcp.auth-token` **完全一致**
3. 双击桌面「Harness」→ 窗口内员工登录 → 使用
4. 改完配置后，关闭并重新打开 Harness 生效

用户数据固定在 `%LOCALAPPDATA%\Harness`（升级/卸载不删）：

| 路径 | 用途 |
|------|------|
| `配置.cmd` | MCP 地址与令牌 |
| `data\` | 会话、设置（`DSH_HOME`） |
| `logs\host.log` | 后台日志 |

---

## 它怎么跑起来的

```text
双击 Harness
  → Electron 窗口（启动页）
  → 后台无窗口启动：内置 Node + dsh web --no-open（只监听 127.0.0.1）
  → 读到就绪地址后，同一窗口打开登录页
  → 关闭窗口 = 结束整棵后台进程树
```

关键目录：

| 位置 | 作用 |
|------|------|
| `desktop-1tmt/` | Electron 桌面壳 |
| `scripts/pack-desktop-1tmt.ts` | 打 Windows 安装包 |
| `packages/api/pgy-login` | 登录 / 退出 / 员工会话目录 |
| `packages/client/ui-pgy-login` | 登录层、侧栏退出 |
| `packages/bundle/web-app/cordis.patch.yml` | 挂上 MCP 与登录插件 |

---

## 开发机

需要：Node.js（仓库要求的版本）、pnpm。

```text
pnpm install
pnpm run build
pnpm dsh web
```

浏览器打开本机页面后，同样走员工登录。

---

## 打 Windows 安装包

在仓库根目录：

```text
pnpm run pack:desktop-1tmt
```

产物：

```text
dist/desktop-1tmt/installer/Harness-Setup-<版本>-x64.exe
```

常用参数：

```text
pnpm run pack:desktop-1tmt -- --skip-build   # 已 build 过，跳过全量构建
pnpm run pack:desktop-1tmt -- --dry-run      # 只打印步骤，不真正打包
```

国内网络慢时，打包前可先设置镜像：

```text
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
set ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/
```

只调试桌面壳时：先成功打一次包生成 `dist/desktop-1tmt/payload`，再：

```text
pnpm --dir desktop-1tmt start
```

不要把 `node_modules/`、`lib/`、`dist/`、真实 Key / Token 提交进 git。

---

## 从旧版绿色包 / 启动.bat 升级

旧 Inno 卸载可能删掉 `%LOCALAPPDATA%\Harness\配置.cmd`：

1. 先备份 `配置.cmd`
2. 卸载旧版
3. 安装新桌面版，把备份放回去

`data\` 一般不受影响。
