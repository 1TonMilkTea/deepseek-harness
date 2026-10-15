/** Client types for the `tmtPanel` Remote namespace. The UI plugin consumes `ctx.remote.tmtPanel`. */

export type * from '../types.ts'

/** Browser half is type-only; Remote methods are mounted by `dsh-api-remotes`. */
export function apply(): void {}
