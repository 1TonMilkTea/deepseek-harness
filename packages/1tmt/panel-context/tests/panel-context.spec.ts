import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { ContextFormed } from '@deepseek-ai/dsh-llm'
import { Session, SessionId } from '@deepseek-ai/dsh-session'
import AgentRegistry, { agentEvents, type Agent } from '@deepseek-ai/dsh-agent'
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection'
import { unsupportedInbox } from '@deepseek-ai/dsh-agent-loop-testkit'
import TmtPanelStore, { hashCustomPanelSnapshot } from '@deepseek-ai/dsh-1tmt-panel'
import type { CustomPanelSnapshot } from '@deepseek-ai/dsh-1tmt-panel'
import * as panelContext from '../src/index.ts'
import { renderPanelContextText } from '../src/index.ts'

declare module '@deepseek-ai/dsh-llm' {
  interface MessageSourceMap {
    '1tmt-panel-context-test': { kind: '1tmt-panel-context-test' } & ContextFormed
  }
}

const SIGNAL = new AbortController().signal

const sample: CustomPanelSnapshot = {
  kind: 'list',
  title: '收货单',
  rows: [
    { id: 1, name: 'a' },
    { id: 2, name: 'b' },
  ],
}

async function mount(config: panelContext.Config = {}) {
  const ctx = new Context()
  ctx.provide('typert', {
    lookups: { configure: () => () => {} },
    contexts: { configureHost: () => () => {} },
  } as never)
  await ctx.plugin(SessionProjectionRegistry)
  await ctx.plugin(AgentRegistry)
  const store = new TmtPanelStore(ctx)
  const fiber = await ctx.plugin(panelContext, config)
  return { ctx, fiber, store }
}

function sessionAgent(session: Session): Agent {
  return {
    id: SessionId('agent'),
    options: {},
    session,
    inbox: unsupportedInbox(),
    status: 'running',
    ctx: new Context(),
    send: () => {},
    followup: () => {},
    steer: () => {},
    inject: () => { throw new Error('panel-context must append directly to the open step') },
    cancel() {},
    runMaintenance: task => task(new AbortController().signal),
    whenIdle: () => Promise.resolve(),
  }
}

async function fire(ctx: Context, agent: Agent): Promise<void> {
  const proposed = createUserMessage({
    content: [{ type: 'text', text: 'request proposal' }],
    source: { kind: '1tmt-panel-context-test' },
  })
  const decision = await agentEvents(ctx, agent).waterfall(
    'agent/pre-step',
    { messages: [proposed], turn: 1, step: 1, signal: SIGNAL },
    () => Promise.resolve({ kind: 'enter' as const, messages: [proposed] }),
  )
  if (decision.kind === 'enter') {
    for (const message of decision.messages) {
      if (message === proposed) continue
      agent.session.append('user/message', message, { surfaceOp: 'append' })
    }
  }
}

function injectedTexts(session: Session): string[] {
  const texts: string[] = []
  for (const event of session.snapshotEvents()) {
    if (event.type === 'user/message' && event.data.source.kind === '1tmt-panel-context') {
      texts.push(event.data.content.find(block => block.type === 'text')?.text ?? '')
    }
  }
  return texts
}

describe('renderPanelContextText', () => {
  it('renders a summary and optional payload', () => {
    const stored = {
      snapshot: sample,
      hash: hashCustomPanelSnapshot(sample),
      updatedAt: 1,
    }
    const summary = renderPanelContextText(stored, { injectFullRows: false, maxPayloadChars: 4000 })
    expect(summary).toContain('kind=list')
    expect(summary).toContain('items=2')
    expect(summary).not.toContain('Payload:')
    const full = renderPanelContextText(stored, { injectFullRows: true, maxPayloadChars: 4000 })
    expect(full).toContain('Payload:')
    expect(full).toContain('"name": "a"')
  })
})

describe('1tmt-panel-context', () => {
  it('injects once per changed snapshot hash', async () => {
    const { ctx, store } = await mount()
    const session = Session.create(SessionId('s1'))
    session.append('turn/start', { turn: 1 })
    const agent = sessionAgent(session)

    await fire(ctx, agent)
    expect(injectedTexts(session)).toHaveLength(0)

    await store.publishSnapshot(sample)
    await fire(ctx, agent)
    expect(injectedTexts(session)).toHaveLength(1)
    expect(injectedTexts(session)[0]).toContain('hash=')

    await fire(ctx, agent)
    expect(injectedTexts(session)).toHaveLength(1)

    await store.publishSnapshot({ ...sample, title: 'updated' })
    await fire(ctx, agent)
    expect(injectedTexts(session)).toHaveLength(2)
  })

  it('skips empty snapshots', async () => {
    const { ctx, store } = await mount()
    const session = Session.create(SessionId('s2'))
    session.append('turn/start', { turn: 1 })
    const agent = sessionAgent(session)
    await store.publishSnapshot({ kind: 'empty', title: '', rows: [] })
    await fire(ctx, agent)
    expect(injectedTexts(session)).toHaveLength(0)
  })
})
