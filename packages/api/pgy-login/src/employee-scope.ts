/** One-time legacy session-root migration into an employee-scoped directory. */

import { mkdir, readdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { encodeSegment } from '@deepseek-ai/dsh-session-persistence-jsonl'
import type { PgyEmployee } from './types.ts'

/** Marker filename written once at the session persistence base root. */
export const PGY_EMPLOYEE_SCOPE_MARKER = '.pgy-employee-scope.json'

/** Directory under the base root that holds per-employee session trees. */
export const PGY_EMPLOYEE_SESSIONS_DIR = 'employees'

/** Durable marker left after the first successful employee-scope migration. */
export interface PgyEmployeeScopeMarker {
  readonly version: 1
  readonly firstEmployeeKey: string
  readonly migratedAt: number
}

/**
 * Build the path-safe employee isolation key from org id and staff number.
 * @param employee - authenticated WMS employee identity.
 * @returns `${orgId}__${staffNumber}` before path encoding.
 */
export function employeeScopeKey(employee: PgyEmployee): string {
  return `${employee.orgId}__${employee.staffNumber}`
}

/**
 * Absolute employee session root under the persistence base.
 * @param baseRoot - construction-time sessionPersistence root.
 * @param key - raw {@link employeeScopeKey} value.
 * @returns absolute directory for that employee's sessions.
 */
export function employeeSessionRoot(baseRoot: string, key: string): string {
  return join(baseRoot, PGY_EMPLOYEE_SESSIONS_DIR, encodeSegment(key))
}

/**
 * Move legacy project directories from the shared base root into the first
 * employee's tree, then write the one-time marker. Subsequent logins skip.
 * @param baseRoot - construction-time sessionPersistence root.
 * @param employeeRoot - destination employee directory.
 * @param key - raw employee scope key recorded in the marker.
 */
export async function migrateLegacySessionsOnce(
  baseRoot: string,
  employeeRoot: string,
  key: string,
): Promise<void> {
  const markerPath = join(baseRoot, PGY_EMPLOYEE_SCOPE_MARKER)
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
    if (entry.name === PGY_EMPLOYEE_SESSIONS_DIR) continue
    const from = join(baseRoot, entry.name)
    const to = join(employeeRoot, entry.name)
    await rename(from, to)
  }

  const marker: PgyEmployeeScopeMarker = {
    version: 1,
    firstEmployeeKey: key,
    migratedAt: Date.now(),
  }
  await writeFile(markerPath, `${JSON.stringify(marker)}\n`, { encoding: 'utf8', mode: 0o600 })
}

function isENOENT(error: unknown): boolean {
  return error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT'
}
