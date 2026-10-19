import { clientBundle } from '../../client/tsdown.client.ts'

export default clientBundle(
  '@deepseek-ai/dsh-api-kde-harness-mp-login',
  ['lib/types/index.js'],
  { hostPhase: true },
)
