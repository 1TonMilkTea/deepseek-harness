# Agent Note: Per-employee local Session roots after WMS login

Status: implemented

English | [中文](2026-09-23-pgy-employee-session-roots.zh.md)

## Problem

The 1TMT Web deployment stores Sessions under one shared `$DSH_HOME/sessions` tree. WMS login only set a process-local `loggedIn` flag and gated create/fork/prompt, so list/search still returned every Session on the machine. Employees sharing one Windows user and one Harness install saw each other's chat history.

## Decision

After a successful `pgyLogin.wmsLogin`, the Host binds JSONL persistence to `$DSH_HOME/sessions/employees/<encode(orgId__staffNumber)>/`. Isolation uses `orgId` plus `staffNumber` so the same staff number in different organizations does not collide. `session.list` and `session.search` require login whenever `pgyLogin` is mounted, matching create/fork/prompt.

On the **first** successful login on a given base root, every legacy first-level project directory under the shared root (except `employees/`) is renamed into that employee's tree, and `.pgy-employee-scope.json` records the migration. Later logins skip migration. Signing in as a different employee without signing out first is refused. The sidebar **Sign out** control calls Host `logout` (disposes live Agents, rebinds persistence to the base root, clears the employee gate) and reloads the page so the login overlay returns.

`SessionPersistence.getBaseRoot()` and `bindRoot()` implement the retarget; they refuse while write handles are open and clear cold-log memos. SessionHeader format version is unchanged. Projection cache and browser drafts stay keyed by Session id.

The login overlay calls `sessions.refresh()` after login so the sidebar loads the employee-scoped list.

## Alternatives considered

**Tag SessionHeader with an owner and filter list.** Rejected for this product: shared physical roots still risk cross-employee open-by-id and cleanup mistakes, and would bump Session format version.

**Remount the whole persistence plugin or change `DSH_HOME` per employee.** Rejected: login happens after boot; `bindRoot` retargets the existing backend without disposing live Host services.

**Require a full Host process restart to switch employees.** Rejected once logout exists: signing out clears the gate and rebinds the base root so another employee can sign in in the same process.

## Consequences

Operators switch employees through Sign out, then the login overlay. Pre-migration shared Sessions become owned by whoever first logs in after upgrade. Profiles without `pgyLogin` keep an unbound shared root and ungated list.
