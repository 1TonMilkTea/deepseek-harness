import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import TmtWorkbenchStore, { hashCustomWorkbenchSnapshot } from '../src/index.ts'
import type { CustomWorkbenchSnapshot } from '../src/types.ts'

function harness(): TmtWorkbenchStore {
  const ctx = new Context()
  ctx.provide('typert', {
    lookups: { configure: () => () => {} },
    contexts: { configureHost: () => () => {} },
  } as never)
  return new TmtWorkbenchStore(ctx)
}

const sample: CustomWorkbenchSnapshot = {
  kind: 'list',
  title: 'demo',
  rows: [
    { id: 1, name: 'a' },
    { id: 2, name: 'b' },
  ],
}

describe('TmtWorkbenchStore', () => {
  it('starts empty and reports missing over Remote', async () => {
    const store = harness()
    expect(store.getStored()).toBeUndefined()
    await expect(store.getSnapshot()).resolves.toEqual({ present: false })
  })

  it('publishes, reads, and clears a structured snapshot', async () => {
    const store = harness()
    const published = await store.publishSnapshot(sample)
    expect(published.hash).toBe(hashCustomWorkbenchSnapshot(sample))
    expect(published.updatedAt).toBeTypeOf('number')
    expect(store.getStored()?.snapshot).toEqual(sample)
    await expect(store.getSnapshot()).resolves.toEqual({
      present: true,
      snapshot: sample,
      hash: published.hash,
      updatedAt: published.updatedAt,
    })
    await store.clearSnapshot()
    expect(store.getStored()).toBeUndefined()
    await expect(store.getSnapshot()).resolves.toEqual({ present: false })
  })

  it('replaces the previous snapshot on a later publish', async () => {
    const store = harness()
    await store.publishSnapshot(sample)
    const next: CustomWorkbenchSnapshot = {
      kind: 'form',
      title: 'edit',
      rows: [],
      form: { id: 1, name: 'a' },
    }
    const published = await store.publishSnapshot(next)
    expect(store.getStored()?.hash).toBe(published.hash)
    expect(store.getStored()?.snapshot).toEqual(next)
  })
})
