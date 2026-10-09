/** Client types for the pgyLogin Remote namespace. The UI plugin consumes `ctx.remote.pgyLogin`. */

export type * from '../types.ts'

/** Browser half is type-only; Remote methods are mounted by `dsh-api-remotes`. */
export function apply(): void {}
