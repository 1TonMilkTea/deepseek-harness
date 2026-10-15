/** Client types for the `tmtWorkbench` Remote namespace. The UI plugin consumes `ctx.remote.tmtWorkbench`. */

export type * from '../types.ts'

/** Browser half is type-only; Remote methods are mounted by `dsh-api-remotes`. */
export function apply(): void {}
