/**
 * Process-local store for the 1tmt custom-panel snapshot.
 * Client Vue publishes through Typert Remote; Host consumers (panel-context) read the Cordis service.
 *
 * @module @deepseek-ai/dsh-1tmt-panel
 */

import { createHash } from 'node:crypto'
import type { Context } from '@deepseek-ai/cordis'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
// Typert-generated ./typert and ./remote artifacts import Zod at runtime.
import type {} from 'zod'
import type {
  CustomPanelGetResult,
  CustomPanelPublishResult,
  CustomPanelSnapshot,
  CustomPanelStoredSnapshot,
} from './types.ts'

export type * from './types.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Latest custom-panel snapshot published by the Web Vue island. */
    tmtPanel: TmtPanelStore
  }
}

/** In-memory record retained between Remote publishes. */
export interface StoredCustomPanelSnapshot {
  readonly snapshot: CustomPanelSnapshot
  readonly hash: string
  readonly updatedAt: number
}

/**
 * Hash a snapshot for change detection without retaining a second copy of the payload.
 * @param snapshot - structured panel view.
 * @returns short hex digest of the canonical JSON.
 */
export function hashCustomPanelSnapshot(snapshot: CustomPanelSnapshot): string {
  return createHash('sha256')
    .update(JSON.stringify(snapshot))
    .digest('hex')
    .slice(0, 16)
}

/**
 * Host Remote namespace `tmtPanel`: publish / read / clear the latest custom-panel snapshot.
 * Storage is process-local and not written into the Session log by this package;
 * `dsh-1tmt-panel-context` turns a changed snapshot into a durable pre-step message.
 */
export class TmtPanelStore extends TypertRemoteService {
  static inject = ['typert']

  private stored: StoredCustomPanelSnapshot | undefined

  /**
   * @param ctx - Host context carrying the Typert Gateway.
   */
  constructor(ctx: Context) {
    super(ctx, 'tmtPanel', { namespace: 'tmtPanel' })
  }

  /**
   * Read the latest stored snapshot for same-process Host consumers.
   * @returns the stored record, or `undefined` when none has been published.
   */
  getStored(): StoredCustomPanelSnapshot | undefined {
    return this.stored
  }

  /**
   * Replace the process-local snapshot with the view currently shown in the custom panel.
   * @param snapshot - structured list or form payload from the Vue island.
   * @returns content hash and Host wall-clock acceptance time.
   */
  @Remote('publishSnapshot')
  async publishSnapshot(snapshot: CustomPanelSnapshot): Promise<CustomPanelPublishResult> {
    const hash = hashCustomPanelSnapshot(snapshot)
    const updatedAt = Date.now()
    this.stored = { snapshot, hash, updatedAt }
    return { hash, updatedAt }
  }

  /**
   * Read the latest published snapshot for Remote clients.
   * @returns a present/missing discriminant; never throws for an empty store.
   */
  @Remote('getSnapshot')
  async getSnapshot(): Promise<CustomPanelGetResult> {
    const stored = this.stored
    if (stored === undefined) return { present: false }
    const result: CustomPanelStoredSnapshot = {
      present: true,
      snapshot: stored.snapshot,
      hash: stored.hash,
      updatedAt: stored.updatedAt,
    }
    return result
  }

  /**
   * Drop the process-local snapshot so the next pre-step injects nothing until a new publish.
   */
  @Remote('clearSnapshot')
  async clearSnapshot(): Promise<void> {
    this.stored = undefined
  }
}

export default TmtPanelStore
