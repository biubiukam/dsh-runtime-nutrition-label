/** Package-owned invariant companion for dsh-runtime-nutrition-label. */

import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = 'dsh-runtime-nutrition-label'

export const name = 'runtime-nutrition-label-invariant'
export const inject = ['invariants']

/**
 * No runtime invariant: snapshot publication validates all aggregate relations
 * from one private state owner, and event payload validity belongs to the DSH
 * tool and filesystem packages that emit those events.
 */
const install: InvariantInstaller = () => {}

/** Register the package-owned invariant contribution. */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
