/** Custom panel sidebar entry and placeholder page copy. */

/** Simplified Chinese dictionary and key source of truth. */
export const zh = {
  panel: '自定义按钮',
  title: '自定义',
  intro: '业务区占位。左侧在此扩展自定义界面，右侧继续对话。',
} as const

/** English dictionary, key-identical to the Chinese source of truth. */
export const en: Record<CustomPanelKey, string> = {
  panel: 'Custom',
  title: 'Custom',
  intro: 'Placeholder for custom work. Extend this pane; keep chatting on the right.',
}

/** Locale keys owned by this plugin. */
export type CustomPanelKey = keyof typeof zh
