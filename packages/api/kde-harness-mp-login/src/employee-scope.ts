/** One-time legacy session-root migration into an employee-scoped directory. */

import { mkdir, readdir, readFile, rename, rmdir, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { encodeSegment } from '@deepseek-ai/dsh-session-persistence-jsonl'
import type { KdeHarnessMpEmployee } from './types.ts'

/** Marker filename written once at the session persistence base root. */
export const KDE_HARNESS_MP_EMPLOYEE_SCOPE_MARKER = '.kde-harness-mp-employee-scope.json'

/** Directory under the base root that holds per-employee session trees. */
export const KDE_HARNESS_MP_EMPLOYEE_SESSIONS_DIR = 'employees'

/** Durable marker left after the first successful employee-scope migration. */
export interface KdeHarnessMpEmployeeScopeMarker {
  readonly version: 1
  readonly firstEmployeeKey: string
  readonly migratedAt: number
}

/**
 * Build the path-safe employee isolation key from org id and staff number.
 * @param employee - authenticated employee identity.
 * @returns `${orgId}__${staffNumber}` before path encoding.
 */
export function employeeScopeKey(employee: KdeHarnessMpEmployee): string {
  return `${employee.orgId}__${employee.staffNumber}`
}

/**
 * Absolute employee session root under the persistence base.
 * @param baseRoot - construction-time sessionPersistence root.
 * @param key - raw {@link employeeScopeKey} value.
 * @returns absolute directory for that employee's sessions.
 */
export function employeeSessionRoot(baseRoot: string, key: string): string {
  return join(baseRoot, KDE_HARNESS_MP_EMPLOYEE_SESSIONS_DIR, encodeSegment(key))
}

/**
 * Move legacy project directories from the shared base root into the first
 * employee's tree, then write the one-time marker. Subsequent logins skip.
 * When the project directory is already present under the employee root,
 * children are moved into it. Windows `rename` onto an existing directory
 * fails with `EPERM`. A directory that stays busy is left in place and the
 * marker is withheld so a later login can finish. The caller closes session
 * writers before invoking this.
 * @param baseRoot - construction-time sessionPersistence root.
 * @param employeeRoot - destination employee directory.
 * @param key - raw employee scope key recorded in the marker.
 */
export async function migrateLegacySessionsOnce(
  baseRoot: string,
  employeeRoot: string,
  key: string,
): Promise<void> {
  const markerPath = join(baseRoot, KDE_HARNESS_MP_EMPLOYEE_SCOPE_MARKER)
  try {
    await readFile(markerPath)
    return
  } catch (error) {
    if (!isENOENT(error)) throw error
  }

  await mkdir(baseRoot, { recursive: true, mode: 0o700 })
  await mkdir(employeeRoot, { recursive: true, mode: 0o700 })

  const entries = await readdir(baseRoot, { withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    if (entry.name === KDE_HARNESS_MP_EMPLOYEE_SESSIONS_DIR) continue
    const from = join(baseRoot, entry.name)
    const to = join(employeeRoot, entry.name)
    const absorbed = await absorbProject(from, to)
    if (!absorbed) return
  }

  const marker: KdeHarnessMpEmployeeScopeMarker = {
    version: 1,
    firstEmployeeKey: key,
    migratedAt: Date.now(),
  }
  await writeFile(markerPath, `${JSON.stringify(marker)}\n`, { encoding: 'utf8', mode: 0o600 })
}

/**
 * Place `from` at `to`. An existing destination directory receives children
 * that are not already there. Returns false when a busy path is left behind.
 * @param from - legacy project directory.
 * @param to - the same project directory under the employee root.
 */
async function absorbProject(from: string, to: string): Promise<boolean> {
  if (!(await exists(to))) {
    try {
      await renameRetryingBusy(from, to)
      return true
    } catch (error) {
      if (!isBusyRename(error)) throw error
      return false
    }
  }
  const entries = await readdir(from, { withFileTypes: true })
  for (const entry of entries) {
    const childFrom = join(from, entry.name)
    const childTo = join(to, entry.name)
    if (await exists(childTo)) continue
    try {
      await renameRetryingBusy(childFrom, childTo)
    } catch (error) {
      if (!isBusyRename(error)) throw error
      return false
    }
  }
  const left = await readdir(from)
  if (left.length > 0) return false
  try {
    await rmdir(from)
  } catch (error) {
    if (isENOENT(error) || isBusyRename(error) || errnoCode(error) === 'ENOTEMPTY') return false
    throw error
  }
  return true
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch (error) {
    if (isENOENT(error)) return false
    throw error
  }
}

const RENAME_RETRY_DELAYS_MS = [20, 50, 100, 200, 400]

/** Retry a directory rename while Windows still reports the source as busy. */
async function renameRetryingBusy(from: string, to: string): Promise<void> {
  let attempt = 0
  for (;;) {
    try {
      await rename(from, to)
      return
    } catch (error) {
      const delay = RENAME_RETRY_DELAYS_MS[attempt]
      if (delay === undefined || !isBusyRename(error)) throw error
      attempt += 1
      await new Promise<void>((resolve) => {
        setTimeout(resolve, delay)
      })
    }
  }
}

function isENOENT(error: unknown): boolean {
  return errnoCode(error) === 'ENOENT'
}

function isBusyRename(error: unknown): boolean {
  const code = errnoCode(error)
  return code === 'EPERM' || code === 'EBUSY'
}

function errnoCode(error: unknown): string | undefined {
  if (!(error instanceof Error) || !('code' in error)) return undefined
  const code = (error as NodeJS.ErrnoException).code
  return typeof code === 'string' ? code : undefined
}
