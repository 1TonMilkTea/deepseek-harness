/** Browser-safe request and result vocabulary for the `tmtWorkbench` Remote namespace. */

/** Discriminant for what the custom workbench currently shows. */
export type CustomWorkbenchKind = 'empty' | 'list' | 'form'

/** JSON-scalar cell used in list rows and form fields. */
export type CustomWorkbenchPrimitive = string | number | boolean | null

/** One flat row or form field map. */
export type CustomWorkbenchRow = Readonly<Record<string, CustomWorkbenchPrimitive>>

/**
 * Structured view published by the Vue custom workbench.
 * Keep this JSON-serializable and free of HTML / DOM strings.
 */
export interface CustomWorkbenchSnapshot {
  readonly kind: CustomWorkbenchKind
  /** Short human title used in the model-facing summary. */
  readonly title: string
  /** List rows when `kind` is `list`; otherwise empty. */
  readonly rows: readonly CustomWorkbenchRow[]
  /** Open form fields when `kind` is `form`. */
  readonly form?: CustomWorkbenchRow
}

/** Receipt after Host accepts a published snapshot. */
export interface CustomWorkbenchPublishResult {
  readonly hash: string
  readonly updatedAt: number
}

/** Stored snapshot returned by `getSnapshot` when one is present. */
export interface CustomWorkbenchStoredSnapshot {
  readonly present: true
  readonly snapshot: CustomWorkbenchSnapshot
  readonly hash: string
  readonly updatedAt: number
}

/** Empty `getSnapshot` result. */
export interface CustomWorkbenchMissingSnapshot {
  readonly present: false
}

/** Discriminated Host read result for the latest published snapshot. */
export type CustomWorkbenchGetResult = CustomWorkbenchStoredSnapshot | CustomWorkbenchMissingSnapshot
