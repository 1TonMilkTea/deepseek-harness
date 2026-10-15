import { clientBundle } from '../../client/tsdown.client.ts'

export default clientBundle(
  '@deepseek-ai/dsh-api-pgy-pur-receive',
  ['lib/types/index.js'],
  { hostPhase: true },
)
