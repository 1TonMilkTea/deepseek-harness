import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { createUserMessage, ToolCallId } from '@deepseek-ai/dsh-llm'
import type { ContextFormed } from '@deepseek-ai/dsh-llm'
import { Session, SessionId } from '@deepseek-ai/dsh-session'
import AgentRegistry, { agentEvents, type Agent } from '@deepseek-ai/dsh-agent'
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection'
import { unsupportedInbox } from '@deepseek-ai/dsh-agent-loop-testkit'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import TmtWorkbenchStore, { hashCustomWorkbenchSnapshot } from '@deepseek-ai/dsh-1tmt-workbench'
import type { CustomWorkbenchSnapshot } from '@deepseek-ai/dsh-1tmt-workbench'
import * as workbenchContext from '../src/index.ts'
import {
  GET_CUSTOM_WORKBENCH_SNAPSHOT,
  renderWorkbenchContextText,
  snapshotPayload,
} from '../src/index.ts'

declare module '@deepseek-ai/dsh-llm' {
  interface MessageSourceMap {
    '1tmt-workbench-context-test': { kind: '1tmt-workbench-context-test' } & ContextFormed
  }
}

const SIGNAL = new AbortController().signal

const sample: CustomWorkbenchSnapshot = {
  kind: 'list',
  title: '收货单',
  rows: [
    { id: 1, name: 'a' },
    { id: 2, name: 'b' },
  ],
}

const formSample: CustomWorkbenchSnapshot = {
  kind: 'form',
  title: '采购入库 CGSL1',
  rows: [
    { entryId: 10, material: 'M1', materialName: '物料1', qty: 20, barcodeCount: 1 },
  ],
  form: {
    billId: 1,
    billNo: 'CGSL1',
    barcodeCount: 1,
    segment: 2,
    selectedEntryIndex: 0,
    selectedEntryId: 10,
    selectedMaterial: '物料1',
  },
  barcodes: [
    { entryId: 10, material: '物料1', barcode: 'BC-1', qty: 5 },
  ],
}

async function mount(config: workbenchContext.Config = {}) {
  const ctx = new Context()
  ctx.provide('typert', {
    lookups: { configure: () => () => {} },
    contexts: { configureHost: () => () => {} },
  } as never)
  await ctx.plugin(SessionProjectionRegistry)
  await ctx.plugin(AgentRegistry)
  await ctx.plugin(SystemPrompt)
  await ctx.plugin(ToolRuntime)
  const store = new TmtWorkbenchStore(ctx)
  const fiber = await ctx.plugin(workbenchContext, config)
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
    inject: () => { throw new Error('workbench-context must append directly to the open step') },
    cancel() {},
    runMaintenance: task => task(new AbortController().signal),
    whenIdle: () => Promise.resolve(),
  }
}

async function fire(ctx: Context, agent: Agent): Promise<void> {
  const proposed = createUserMessage({
    content: [{ type: 'text', text: 'request proposal' }],
    source: { kind: '1tmt-workbench-context-test' },
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
    if (event.type === 'user/message' && event.data.source.kind === '1tmt-workbench-context') {
      texts.push(event.data.content.find(block => block.type === 'text')?.text ?? '')
    }
  }
  return texts
}

describe('renderWorkbenchContextText', () => {
  it('renders a summary and optional payload', () => {
    const stored = {
      snapshot: sample,
      hash: hashCustomWorkbenchSnapshot(sample),
      updatedAt: 1,
    }
    const summary = renderWorkbenchContextText(stored, { injectFullRows: false, maxPayloadChars: 4000 })
    expect(summary).toContain('kind=list')
    expect(summary).toContain('items=2')
    expect(summary).toContain(GET_CUSTOM_WORKBENCH_SNAPSHOT)
    expect(summary).not.toContain('Payload:')
    const full = renderWorkbenchContextText(stored, { injectFullRows: true, maxPayloadChars: 4000 })
    expect(full).toContain('Payload:')
    expect(full).toContain('"name": "a"')
  })

  it('includes form rows and barcodes when injectFullRows is true', () => {
    const stored = {
      snapshot: formSample,
      hash: hashCustomWorkbenchSnapshot(formSample),
      updatedAt: 1,
    }
    const full = renderWorkbenchContextText(stored, { injectFullRows: true, maxPayloadChars: 8000 })
    expect(full).toContain('barcodes=1')
    expect(full).toContain('"barcode": "BC-1"')
    expect(full).toContain('"segment": 2')
    expect(full).toContain('"materialName": "物料1"')
    expect(snapshotPayload(formSample)).toMatchObject({
      kind: 'form',
      barcodes: [{ barcode: 'BC-1', qty: 5 }],
    })
  })
})

describe('1tmt-workbench-context', () => {
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

  it('registers a read-only snapshot tool over the Host store', async () => {
    const { ctx, store } = await mount()
    const missing = await ctx.tools.execute({
      callId: ToolCallId('call-missing'),
      name: GET_CUSTOM_WORKBENCH_SNAPSHOT,
      arguments: {},
      signal: SIGNAL,
    })
    expect(missing.isError).toBe(false)
    expect(missing.value).toEqual({ present: false })

    await store.publishSnapshot(formSample)
    const hit = await ctx.tools.execute({
      callId: ToolCallId('call-hit'),
      name: GET_CUSTOM_WORKBENCH_SNAPSHOT,
      arguments: {},
      signal: SIGNAL,
    })
    expect(hit.isError).toBe(false)
    expect(hit.value).toMatchObject({
      present: true,
      snapshot: {
        kind: 'form',
        form: { billNo: 'CGSL1', segment: 2 },
        barcodes: [{ barcode: 'BC-1', qty: 5 }],
      },
    })
  })
})
