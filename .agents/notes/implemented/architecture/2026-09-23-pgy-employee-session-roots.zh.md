# Agent Note: WMS 登录后按员工隔离本地 Session 根目录

Status: implemented

[English](2026-09-23-pgy-employee-session-roots.md) | 中文

## Problem

1TMT Web 部署把 Session 存在共享的 `$DSH_HOME/sessions` 树下。WMS 登录只设置进程内 `loggedIn`，并只拦截 create/fork/prompt，因此 list/search 仍返回本机全部 Session。共用同一 Windows 用户与同一 Harness 安装的员工会看到彼此的问答记录。

## Decision

`pgyLogin.wmsLogin` 成功后，Host 把 JSONL 持久化绑定到 `$DSH_HOME/sessions/employees/<encode(orgId__staffNumber)>/`。隔离键为 `orgId` 加 `staffNumber`，避免同工号跨组织串目录。只要挂载了 `pgyLogin`，`session.list` 与 `session.search` 也要求登录，与 create/fork/prompt 一致。

在给定 base root 上的**第一次**成功登录时，把共享根下除 `employees/` 外的一级旧项目目录迁入该员工树，并写入 `.pgy-employee-scope.json`。之后登录跳过迁移。同进程不先退出登录就换员工会被拒绝。侧栏**退出登录**调用 Host `logout`（释放 live Agent、把持久化绑回 base root、清空员工门闩）并刷新页面，使登录层重新出现。

`SessionPersistence.getBaseRoot()` 与 `bindRoot()` 负责改写运行时根；有未关闭的 write handle 时拒绝，并清空冷日志 memo。不 bump SessionHeader 格式版本。投影缓存与浏览器草稿仍按 Session id 键控。

登录层在登录成功后调用 `sessions.refresh()`，侧栏加载该员工目录下的列表。

## Alternatives considered

**在 SessionHeader 打 owner 并在 list 过滤。** 对本产品拒绝：共享物理根仍有按 id 误开与清理风险，且会 bump Session 格式版本。

**按员工 remount 整个持久化插件或改 `DSH_HOME`。** 拒绝：登录发生在 boot 之后；`bindRoot` 可在不拆 Host 服务的情况下改写现有后端。

**换员工必须整进程重启 Host。** 在已有退出登录后拒绝：退出会清门闩并绑回 base root，同进程可再登录其他员工。

## Consequences

换员工经「退出登录」再走登录层。升级后首次登录的员工获得迁移前的共享 Session。未挂 `pgyLogin` 的 profile 仍使用未绑定的共享根，且 list 不设门闩。
