import { clientBundle } from '../packages/client/tsdown.client.ts'

/** Host and Web faces use the same package metadata; the parent Harness preset supplies the loader wrapper. */
export default clientBundle('dsh-runtime-nutrition-label', [
  'src/index.ts',
  'src/command.ts',
  'src/invariant.ts',
  'src/types.ts',
  'src/report.ts',
])
