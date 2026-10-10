# 1TMT Harness（Windows 桌面版说明）

本仓库在上游 DeepSeek Harness 之上，做了现场要用的三件事：

1. **连若依 MCP**：本机 Agent 调用 RuoYi 的 `/mcp`（金蝶 / 蒲公英能力）
2. **员工登录**：组织 + 员工编码 + WMS 密码，登录后才能建会话；按员工隔离本机会话
3. **Windows 桌面程序**：双击「Harness」打开独立窗口，不弹黑窗、不依赖浏览器

更细的联调说明见 [docs/1tmt-ruoyi-wms-integration.md](docs/1tmt-ruoyi-wms-integration.md)；按提交的改动说明见 [docs/1tmt-pgy-version-notes.md](docs/1tmt-pgy-version-notes.md)。

---

## 业务员怎么用

1. 安装 `Harness-Setup-*-x64.exe`（无需管理员）
2. 双击桌面「Harness」
3. **首次**：在窗口填写若依根地址（可带端口），例如 `http://192.168.0.108:8081`——**不用填 Token**
4. 保存后进入员工登录（组织 / 员工编码 / 密码）→ 使用
5. 之后可在 **设置 → 后端 / 若依** 修改地址；改完会重新申请会话令牌并重连 MCP

IT 仍可在 `%LOCALAPPDATA%\Harness\配置.cmd` 预置 `DSH_1TMT_MCP_URL`（根地址或带 `/mcp`）；页面已保存的地址优先。静态 `DSH_1TMT_MCP_TOKEN` 仅运维/旧工具需要。

用户数据固定在 `%LOCALAPPDATA%\Harness`（升级/卸载不删）：

| 路径 | 用途 |
|------|------|
| `配置.cmd` | IT 预置地址（可选） |
| `data\` | 会话、设置、`1tmt-backend.json`（`DSH_HOME`） |
| `logs\host.log` | 后台日志 |

关程序时 Host 会尽量 `DELETE /mcp/client-sessions` 销毁服务端会话；令牌本身也有 TTL（默认 12 小时）。

---

## 它怎么跑起来的

```text
双击 Harness
  → Electron 窗口（启动页）
  → 后台无窗口启动：内置 Node + dsh web --no-open（只监听 127.0.0.1）
  → 读到就绪地址后，同一窗口打开登录页
  → 页面配地址 → POST /mcp/client-sessions → 动态挂载 MCP
  → 关闭窗口 = SIGTERM（销毁会话）→ 超时再结束整棵后台进程树
```

关键目录：

| 位置 | 作用 |
|------|------|
| `desktop-1tmt/` | Electron 桌面壳 |
| `scripts/pack-desktop-1tmt.ts` | 打 Windows 安装包 |
| `packages/api/pgy-login` | 后端地址、会话令牌、登录 / 退出 / 员工会话目录 |
| `packages/client/ui-pgy-login` | 登录前后端配置、登录层、设置「后端 / 若依」、侧栏退出 |
| `packages/bundle/web-app/cordis.patch.yml` | 挂上登录插件（MCP 由 pgy-login 运行时挂载） |

---

## 开发机

需要：Node.js（仓库要求的版本）、pnpm。

```text
pnpm install
pnpm --dir desktop-1tmt install
pnpm run build
pnpm dsh web
```

浏览器打开本机页面后：未配置地址时先填若依根地址，再走员工登录。

`desktop-1tmt/` **不在** pnpm workspace 里，避免打桌面壳时改动根目录 `pnpm-lock.yaml`；它单独装 Electron。根仓库的依赖以 `master` 为准。

---

## 依赖怎么跟 master 对齐

- **`master` = 依赖与上游源码的基准**；本分支只叠 1TMT 业务改造（登录、MCP、桌面壳、文档）。
- 合并 / 变基 `master` 后：冲突时优先保留 **master 的 `pnpm-lock.yaml`**，再执行一次 `pnpm install`（只为登记本分支新增的 workspace 包，如 `pgy-login`）。
- 不要在本分支随便跑会重算整棵依赖树的升级；`micromark-util-types` 已 pin 为与 master 相同的 `2.0.2`，防止双版本把 typecheck 弄挂。
- 拉上游更新示例：见仓库既有说明。
