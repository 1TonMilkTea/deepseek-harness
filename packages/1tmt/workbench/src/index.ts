/**
 * Process-local store for the 1tmt custom workbench snapshot.
 * Client Vue publishes through Typert Remote; Host consumers (workbench-context) read the Cordis service.
 *
 * @module @deepseek-ai/dsh-1tmt-workbench
 */

import { createHash } from 'node:crypto'
import type { Context } from '@deepseek-ai/cordis'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
// Typert-generated ./typert and ./remote artifacts import Zod at runtime.
import type {} from 'zod'
import type {
  CustomWorkbenchGetResult,
  CustomWorkbenchPublishResult,
  CustomWorkbenchSnapshot,
  CustomWorkbenchStoredSnapshot,
} from './types.ts'

export type * from './types.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Latest custom workbench snapshot published by the Web Vue island. */
    tmtWorkbench: TmtWorkbenchStore
  }
}

/** In-memory record retained between Remote publishes. */
export interface StoredCustomWorkbenchSnapshot {
  readonly snapshot: CustomWorkbenchSnapshot
  readonly hash: string
  readonly updatedAt: number
}

/**
 * Hash a snapshot for change detection without retaining a second copy of the payload.
 * @param snapshot - structured workbench view.
 * @returns short hex digest of the canonical JSON.
 */
export function hashCustomWorkbenchSnapshot(snapshot: CustomWorkbenchSnapshot): string {
  return createHash('sha256')
    .update(JSON.stringify(snapshot))
    .digest('hex')
    .slice(0, 16)
}

/**
 * Host Remote namespace `tmtWorkbench`: publish / read / clear the latest custom workbench snapshot.
 * Storage is process-local and not written into the Session log by this package;
 * `dsh-1tmt-workbench-context` turns a changed snapshot into a durable pre-step message.
 */
export class TmtWorkbenchStore extends TypertRemoteService {
  static inject = ['typert']

  private stored: StoredCustomWorkbenchSnapshot | undefined

  /**
   * @param ctx - Host context carrying the Typert Gateway.
   */
  constructor(ctx: Context) {
    super(ctx, 'tmtWorkbench', { namespace: 'tmtWorkbench' })
  }

  /**
   * Read the latest stored snapshot for same-process Host consumers.
   * @returns the stored record, or `undefined` when none has been published.
   */
  getStored(): StoredCustomWorkbenchSnapshot | undefined {
    return this.stored
  }

  /**
   * Replace the process-local snapshot with the view currently shown in the custom workbench.
   * @param snapshot - structured list or form payload from the Vue island.
   * @returns content hash and Host wall-clock acceptance time.
   */
  @Remote('publishSnapshot')
  publishSnapshot(snapshot: CustomWorkbenchSnapshot): Promise<CustomWorkbenchPublishResult> {
    const hash = hashCustomWorkbenchSnapshot(snapshot)
    const updatedAt = Date.now()
    this.stored = { snapshot, hash, updatedAt }
    return Promise.resolve({ hash, updatedAt })
  }

  /**
   * Read the latest published snapshot for Remote clients.
   * @returns a present/missing discriminant; never throws for an empty store.
   */
  @Remote('getSnapshot')
  getSnapshot(): Promise<CustomWorkbenchGetResult> {
    const stored = this.stored
    if (stored === undefined) return Promise.resolve({ present: false })
    const result: CustomWorkbenchStoredSnapshot = {
      present: true,
      snapshot: stored.snapshot,
      hash: stored.hash,
      updatedAt: stored.updatedAt,
    }
    return Promise.resolve(result)
  }

  /**
   * Drop the process-local snapshot so the next pre-step injects nothing until a new publish.
   */
  @Remote('clearSnapshot')
  clearSnapshot(): Promise<void> {
    this.stored = undefined
    return Promise.resolve()
  }
}

export default TmtWorkbenchStore
