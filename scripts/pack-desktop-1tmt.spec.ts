import { spawnSync } from 'node:child_process'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { configTemplate, parseConfigCmd } from '../desktop-1tmt/src/config-cmd.ts'
import { parseReadyUrl, splitLines } from '../desktop-1tmt/src/host-output.ts'
import { NODE_VERSION, requiredProductionPackages } from './pack-desktop-1tmt.ts'

const root = resolve(import.meta.dirname, '..')
const script = resolve(root, 'scripts/pack-desktop-1tmt.ts')
const payload = join(root, 'dist', 'desktop-1tmt', 'payload')

function run(env: NodeJS.ProcessEnv, ...args: string[]) {
  const inherited = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !['npm_execpath', 'pnpm_home'].includes(key.toLowerCase())),
  )
  return spawnSync(process.execPath, ['--import', 'tsx/esm', script, ...args], {
    cwd: root,
    encoding: 'utf8',
    env: { ...inherited, ...env },
  })
}

describe('desktop 配置.cmd', () => {
  it('defaults MCP URL and token to the RuoYi local development pair', () => {
    expect(parseConfigCmd(configTemplate())).toEqual({
      DSH_1TMT_MCP_URL: 'http://127.0.0.1:8081/mcp',
      DSH_1TMT_MCP_TOKEN: 'local-mcp-change-me',
    })
    expect(configTemplate()).toContain('关闭并重新打开 Harness 生效')
  })

  it('reads quoted and bare set lines and ignores comments', () => {
    const text = '\uFEFF@echo off\r\nREM set "A=1"\r\n:: set B=2\r\nset "DEEPSEEK_API_KEY=sk-x"\r\nSET DSH_HOME=D:\\dsh data\r\nset "DSH_1TMT_MCP_URL=http://a/mcp"\r\nset "DSH_1TMT_MCP_URL=http://b/mcp"\r\n'
    expect(parseConfigCmd(text)).toEqual({
      DEEPSEEK_API_KEY: 'sk-x',
      DSH_HOME: 'D:\\dsh data',
      DSH_1TMT_MCP_URL: 'http://b/mcp',
    })
  })
})

describe('desktop dsh web readiness line', () => {
  it('extracts the authenticated URL only from the readiness line', () => {
    expect(parseReadyUrl('dsh web: http://127.0.0.1:5173/?token=abc')).toBe('http://127.0.0.1:5173/?token=abc')
    expect(parseReadyUrl('loading dsh web: http://x')).toBeUndefined()
  })

  it('keeps a partial line until its newline arrives', () => {
    const first = splitLines('', 'a\r\ndsh web: http://127')
    expect(first).toEqual({ lines: ['a'], rest: 'dsh web: http://127' })
    expect(splitLines(first.rest, '.0.0.1/\n')).toEqual({ lines: ['dsh web: http://127.0.0.1/'], rest: '' })
  })
})

describe('desktop installer pack', () => {
  it('treats cosmokit as required production of cordis, not an optional peer', () => {
    expect(requiredProductionPackages({
      dependencies: { '@deepseek-ai/cosmokit': 'workspace:^' },
      peerDependencies: { '@deepseek-ai/cordis-plugin-loader': 'workspace:^' },
      peerDependenciesMeta: { '@deepseek-ai/cordis-plugin-loader': { optional: true } },
    })).toEqual(['@deepseek-ai/cosmokit'])
  })

  it('stages the payload, restores dev dependencies, then builds the NSIS installer', () => {
    const result = run({ npm_execpath: 'C:\\tools\\pnpm.cjs' }, '--', '--skip-build', '--dry-run')

    expect(result.status).toBe(0)
    const out = result.stdout
    expect(out).toContain('skipping pnpm run build (--skip-build)')
    expect(out).toContain('C:\\tools\\pnpm.cjs --filter @deepseek-ai/dsh deploy --legacy --prod --config.node-linker=hoisted')
    expect(out).toContain(`require ${join(payload, 'app', 'lib', 'bin.js')}`)
    expect(out).toContain(`node-v${NODE_VERSION}-win-x64.zip`)
    expect(out).toContain(`copy node.exe -> ${join(payload, 'runtime', 'node.exe')}`)
    const install = out.indexOf('C:\\tools\\pnpm.cjs install')
    const shellInstall = out.indexOf(`--dir ${join(root, 'desktop-1tmt')} install --ignore-workspace`)
    const shell = out.indexOf('run build', shellInstall)
    const installer = out.indexOf('exec electron-builder --win nsis --x64 --publish never')
    expect(install).toBeGreaterThan(0)
    expect(shellInstall).toBeGreaterThan(install)
    expect(shell).toBeGreaterThan(shellInstall)
    expect(installer).toBeGreaterThan(shell)
  })

  it('includes pnpm run build when --skip-build is omitted', () => {
    const result = run({ npm_execpath: 'C:\\tools\\pnpm.cjs' }, '--dry-run')
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('C:\\tools\\pnpm.cjs run build')
  })

  it('rejects a missing JavaScript pnpm entrypoint before any deploy', () => {
    const result = run({}, '--skip-build', '--dry-run')
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('invoke through `pnpm run pack:desktop-1tmt`')
  })
})
