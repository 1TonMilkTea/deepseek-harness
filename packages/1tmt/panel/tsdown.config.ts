import { clientBundle } from '../../client/tsdown.client.ts'

export default clientBundle(
  '@deepseek-ai/dsh-1tmt-panel',
  ['lib/types/index.js'],
  { hostPhase: true },
)
