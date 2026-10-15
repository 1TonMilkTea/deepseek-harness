import { clientBundle } from '../../client/tsdown.client.ts'

export default clientBundle(
  '@deepseek-ai/dsh-1tmt-workbench',
  ['lib/types/index.js'],
  { hostPhase: true },
)
