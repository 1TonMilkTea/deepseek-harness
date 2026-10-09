/**
 * Customer-editable `配置.cmd`: the template written on first launch and the
 * parser that turns its `set` lines into environment variables for `dsh web`.
 * The file keeps the batch syntax of earlier installs so an existing copy
 * under `%LOCALAPPDATA%\Harness` stays valid; the desktop shell reads it and
 * never executes it.
 */

/** File name of the customer configuration beside `data\`. */
export const CONFIG_FILE_NAME = '配置.cmd'

/**
 * Default configuration text, CRLF so Notepad shows the comments on separate lines.
 * @returns the template body.
 */
export function configTemplate(): string {
  return [
    '@echo off',
    'REM ========== 必改：对接若依 MCP ==========',
    'REM DSH_1TMT_MCP_URL = 跑 RuoYi-Vue 那台机器的地址 + /mcp',
    'REM   - Harness 与若依在同一台电脑：可用下面默认的 127.0.0.1',
    'REM   - Harness 装到业务员别的电脑：必须改成若依服务器局域网 IP 或域名',
    'REM     示例：set "DSH_1TMT_MCP_URL=http://192.168.0.108:8081/mcp"',
    'REM DSH_1TMT_MCP_TOKEN 必须与若依 application.yml 里 mcp.auth-token 完全一致',
    'REM 改完保存后，关闭并重新打开 Harness 生效。升级安装不会覆盖本文件。',
    'set "DSH_1TMT_MCP_URL=http://127.0.0.1:8081/mcp"',
    'set "DSH_1TMT_MCP_TOKEN=local-mcp-change-me"',
    'REM ========== 可选：大模型 Key ==========',
    'REM 也可在页面「设置 → 模型」里填写，不必写在这里。',
    'REM set "DEEPSEEK_API_KEY="',
    '',
  ].join('\r\n')
}

const QUOTED_SET = /^set\s+"([A-Za-z_][A-Za-z0-9_]*)=(.*)"\s*$/i
const BARE_SET = /^set\s+([A-Za-z_][A-Za-z0-9_]*)=(.*)$/i

/**
 * Read `set "NAME=value"` and `set NAME=value` lines. `REM`, `::`, `@echo`,
 * and every other line are ignored; `%VAR%` references stay literal.
 * @param text - file contents, optionally starting with a UTF-8 BOM.
 * @returns variables in file order; a later line overrides an earlier one.
 */
export function parseConfigCmd(text: string): Record<string, string> {
  const variables: Record<string, string> = {}
  for (const rawLine of text.replace(/^\uFEFF/u, '').split(/\r?\n/u)) {
    const line = rawLine.trim()
    const match = QUOTED_SET.exec(line) ?? BARE_SET.exec(line)
    if (match === null) continue
    const [, name, value] = match
    if (name === undefined || value === undefined) continue
    variables[name] = value
  }
  return variables
}
