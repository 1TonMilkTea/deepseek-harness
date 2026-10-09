import { clientBundle } from '../../client/tsdown.client.ts'

export default clientBundle(
  '@deepseek-ai/dsh-api-pgy-login',
  ['lib/types/index.js'],
  { hostPhase: true },
)
