/** `pgyLogin` namespace dictionaries. */

export const zh = {
  title: '员工登录',
  subtitle: '使用组织、员工编码和密码登录后继续使用。',
  org: '组织',
  orgPlaceholder: '请选择组织',
  staffNumber: '员工编码',
  staffNumberPlaceholder: '请输入员工编码',
  password: '密码',
  passwordPlaceholder: '请输入登录密码',
  submit: '登录',
  loading: '正在加载组织…',
  logout: '退出登录',
  logoutShort: '退出',
} satisfies Record<string, string>

export type PgyLoginKey = keyof typeof zh

export const en = {
  title: 'Staff login',
  subtitle: 'Sign in with organization, staff number, and password to continue.',
  org: 'Organization',
  orgPlaceholder: 'Select an organization',
  staffNumber: 'Staff number',
  staffNumberPlaceholder: 'Enter staff number',
  password: 'Password',
  passwordPlaceholder: 'Enter login password',
  submit: 'Sign in',
  loading: 'Loading organizations…',
  logout: 'Sign out',
  logoutShort: 'Out',
} satisfies Record<PgyLoginKey, string>
