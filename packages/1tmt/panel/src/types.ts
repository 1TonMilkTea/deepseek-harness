/** Browser-safe request and result vocabulary for the `tmtPanel` Remote namespace. */

/** Discriminant for what the custom half-panel currently shows. */
export type CustomPanelKind = 'empty' | 'list' | 'form'

/** JSON-scalar cell used in list rows and form fields. */
export type CustomPanelPrimitive = string | number | boolean | null

/** One flat row or form field map. */
export type CustomPanelRow = Readonly<Record<string, CustomPanelPrimitive>>

/**
 * Structured view published by the Vue custom panel.
 * Keep this JSON-serializable and free of HTML / DOM strings.
 */
export interface CustomPanelSnapshot {
  readonly kind: CustomPanelKind
  /** Short human title used in the model-facing summary. */
  readonly title: string
  /** List rows when `kind` is `list`; otherwise empty. */
  readonly rows: readonly CustomPanelRow[]
  /** Open form fields when `kind` is `form`. */
  readonly form?: CustomPanelRow
}

/** Receipt after Host accepts a published snapshot. */
export interface CustomPanelPublishResult {
  readonly hash: string
  readonly updatedAt: number
}

/** Stored snapshot returned by `getSnapshot` when one is present. */
export interface CustomPanelStoredSnapshot {
  readonly present: true
  readonly snapshot: CustomPanelSnapshot
  readonly hash: string
  readonly updatedAt: number
}

/** Empty `getSnapshot` result. */
export interface CustomPanelMissingSnapshot {
  readonly present: false
}

/** Discriminated Host read result for the latest published snapshot. */
export type CustomPanelGetResult = CustomPanelStoredSnapshot | CustomPanelMissingSnapshot
