/**
 * Opt-in custom-panel context. Eligible steps append a durable,
 * source-attributed summary of the latest Vue half-panel snapshot.
 *
 * @module @deepseek-ai/dsh-1tmt-panel-context
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { z as zod } from 'zod'
import type { Agent, PreStepDecision } from '@deepseek-ai/dsh-agent'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { ContextFormed } from '@deepseek-ai/dsh-llm'
import type { StoredCustomPanelSnapshot } from '@deepseek-ai/dsh-1tmt-panel'
import type {} from '@deepseek-ai/dsh-1tmt-panel'
import type {} from '@deepseek-ai/dsh-session-projection'

declare module '@deepseek-ai/dsh-llm' {
  interface MessageSourceMap {
    '1tmt-panel-context': { kind: '1tmt-panel-context' } & ContextFormed
  }
}

declare module '@deepseek-ai/dsh-session-projection/types' {
  interface SessionProjectionStateMap {
    /** Latest injected custom-panel snapshot hash for this Session. */
    tmtPanelContext: TmtPanelContextProjection
  }
}

/** Cordis plugin name used by loader diagnostics and message source kind. */
export const name = '1tmt-panel-context'

/** Same-process snapshot store plus projection fold for injection scheduling. */
export const inject = ['agents', 'sessionProjections', 'tmtPanel']

const stateSchema = zod.object({
  /** Hash of the last injected snapshot, or null before the first injection. */
  lastInjectedHash: zod.string().nullable(),
})

/** Folded panel-context readings. */
type TmtPanelContextProjection = zod.infer<typeof stateSchema>

/** Request-preparation injection policy. Invalid values fail plugin load. */
export interface Config {
  /**
   * When true, append a JSON dump of rows/form under the summary when it fits
   * `maxPayloadChars`. Defaults to false (summary only).
   */
  injectFullRows?: boolean
  /** Maximum characters of JSON payload when `injectFullRows` is true. Defaults to 4000. */
  maxPayloadChars?: number
}

/** Schemastery validation for {@link Config}. */
export const Config: z<Config> = z.object({
  injectFullRows: z.boolean().default(false),
  maxPayloadChars: z.number().default(4000),
})

interface ResolvedConfig {
  readonly injectFullRows: boolean
  readonly maxPayloadChars: number
}

/**
 * Render the model-facing text for one stored snapshot.
 * @param stored - Host store record.
 * @param config - resolved injection policy.
 * @returns durable user-message body.
 */
export function renderPanelContextText(
  stored: StoredCustomPanelSnapshot,
  config: ResolvedConfig,
): string {
  const { snapshot, hash } = stored
  const count = snapshot.kind === 'form'
    ? Object.keys(snapshot.form ?? {}).length
    : snapshot.rows.length
  const lines = [
    `Custom panel snapshot (kind=${snapshot.kind}, title=${JSON.stringify(snapshot.title)}, items=${String(count)}, hash=${hash}).`,
    'Use this structured view when the user refers to the list or form currently shown in the left panel.',
  ]
  if (!config.injectFullRows || snapshot.kind === 'empty') return lines.join('\n')
  const payload = snapshot.kind === 'form'
    ? JSON.stringify(snapshot.form ?? {}, null, 2)
    : JSON.stringify(snapshot.rows, null, 2)
  if (payload.length > config.maxPayloadChars) {
    lines.push(`Full payload omitted (${String(payload.length)} chars > maxPayloadChars ${String(config.maxPayloadChars)}).`)
    return lines.join('\n')
  }
  lines.push('Payload:')
  lines.push(payload)
  return lines.join('\n')
}

/**
 * Register a prepended pre-step listener for the lifetime of `ctx`.
 * @param ctx - plugin context; the listener is disposed with it.
 * @param config - injection policy.
 */
export function apply(ctx: Context, config: Config): void {
  const resolved: ResolvedConfig = {
    injectFullRows: config.injectFullRows ?? false,
    maxPayloadChars: config.maxPayloadChars ?? 4000,
  }
  if (!Number.isSafeInteger(resolved.maxPayloadChars) || resolved.maxPayloadChars < 0) {
    throw new TypeError(
      `1tmt-panel-context: maxPayloadChars must be a non-negative safe integer, got ${String(config.maxPayloadChars)}`,
    )
  }

  ctx.sessionProjections.register({
    key: 'tmtPanelContext',
    stateVersion: 1,
    stateSchema,
    init: () => ({ lastInjectedHash: null }),
    apply: (state, event) => {
      if (event.type !== 'user/message' || event.data.source.kind !== name) return state
      const source = event.data.source
      if (source.form !== 'snapshot') return state
      const section = source.sections[0]?.text
      if (section === undefined) return state
      const match = /\bhash=([0-9a-f]+)\b/.exec(section)
      const hash = match?.[1]
      if (hash === undefined) return state
      return state.lastInjectedHash === hash ? state : { lastInjectedHash: hash }
    },
  })

  ctx.on('agent/pre-step', async (
    { agent, signal }: { agent: Agent; signal: AbortSignal },
    next: () => Promise<PreStepDecision>,
  ): Promise<PreStepDecision> => {
    const decision = await next()
    if (decision.kind === 'reject' || signal.aborted) return decision
    const stored = ctx.tmtPanel.getStored()
    if (stored === undefined || stored.snapshot.kind === 'empty') return decision
    const state = ctx.sessionProjections.stateOf(agent.session, 'tmtPanelContext') as TmtPanelContextProjection
    if (state.lastInjectedHash === stored.hash) return decision
    const text = renderPanelContextText(stored, resolved)
    return {
      ...decision,
      messages: [
        ...decision.messages,
        createUserMessage({
          content: [{ type: 'text', text }],
          source: { kind: name, form: 'snapshot', sections: [{ name, text }] },
        }),
      ],
    }
  }, { prepend: true })
}
