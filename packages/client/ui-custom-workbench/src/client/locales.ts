/** Custom workbench sidebar entry and placeholder page copy. */

/** Simplified Chinese dictionary and key source of truth. */
export const zh = {
  entry: '自定义工作台',
  title: '自定义工作台',
  intro: '业务区占位。左侧在此扩展自定义工作台，右侧继续对话。打开后会把演示列表快照发给 Host，供对话读取。',
  republish: '重新发布演示列表',
} as const

/** English dictionary, key-identical to the Chinese source of truth. */
export const en: Record<CustomWorkbenchKey, string> = {
  entry: 'Custom Workbench',
  title: 'Custom Workbench',
  intro: 'Placeholder for custom work. Extend this workbench; keep chatting on the right. Opening publishes a demo list snapshot for the conversation.',
  republish: 'Republish demo list',
}

/** Locale keys owned by this plugin. */
export type CustomWorkbenchKey = keyof typeof zh
