/**
 * Build the 1TMT Windows desktop installer: an Electron shell
 * (`desktop-1tmt/`) whose `resources\payload` carries a pinned Node.js and a
 * deployed `dsh` CLI. The shell runs `dsh web --no-open` in the background
 * and shows it in its own window, so the customer machine needs no Node,
 * pnpm, browser launch, or console window.
 *
 * Invoke through `pnpm run pack:desktop-1tmt`. Output is the NSIS installer
 * under `dist/desktop-1tmt/installer/`.
 */

import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  existsSync,
  globSync,
  readFileSync,
  readdirSync,
  statSync,
} from 'node:fs'
import {
  chmod,
  cp,
  lstat,
  mkdir,
  readFile,
  readdir,
  realpath,
  rm,
  writeFile,
} from 'node:fs/promises'
import { dirname, extname, join, resolve, sep } from 'node:path'
import { parseArgs } from 'node:util'

/** Same Node release the Desktop runtime pins. */
export const NODE_VERSION = '24.17.0'
/** Workspace package deployed into `payload/app/`. */
const DEPLOY_FILTER = '@deepseek-ai/dsh'
const NODE_DIST_FOLDER = `node-v${NODE_VERSION}-win-x64`
const NODE_ARCHIVE_NAME = `${NODE_DIST_FOLDER}.zip`
const NODE_RELEASE_ROOT = `https://nodejs.org/download/release/v${NODE_VERSION}`

const root = resolve(import.meta.dirname, '..')
const shellRoot = resolve(root, 'desktop-1tmt')
const outputRoot = resolve(root, 'dist', 'desktop-1tmt')
const payloadRoot = join(outputRoot, 'payload')
const appRoot = join(payloadRoot, 'app')
const runtimeRoot = join(payloadRoot, 'runtime')
const cacheRoot = join(outputRoot, 'cache')
const installerRoot = join(outputRoot, 'installer')
const cliBin = join(appRoot, 'lib', 'bin.js')
const cosmokitManifest = join(appRoot, 'node_modules', '@deepseek-ai', 'cosmokit', 'package.json')
const frontendIndex = join(appRoot, 'node_modules', '@deepseek-ai', 'dsh-web-frontend', 'dist', 'index.html')
const cliSourceNodeModules = resolve(root, 'apps', 'cli', 'node_modules')

interface PackCli {
  skipBuild: boolean
  dryRun: boolean
}

function parseCli(argv: string[]): PackCli {
  const { values, positionals } = parseArgs({
    args: argv.filter(part => part !== '--'),
    options: {
      'skip-build': { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
      help: { type: 'boolean', default: false },
    },
    allowPositionals: true,
  })
  if (positionals.length > 0) {
    throw new Error(`unexpected arguments ${positionals.join(' ')}`)
  }
  if (values.help) {
    console.log([
      'Usage: pnpm run pack:desktop-1tmt -- [flags]',
      '',
      '  --skip-build  skip `pnpm run build` (lib/ and web dist must already exist).',
      '  --dry-run     print commands without downloading, deploying, or writing.',
    ].join('\n'))
    process.exit(0)
  }
  return {
    skipBuild: values['skip-build'],
    dryRun: values['dry-run'],
  }
}

function formatCommand(command: string, args: readonly string[]): string {
  return [command, ...args].map(part => (part.includes(' ') ? JSON.stringify(part) : part)).join(' ')
}

/**
 * Resolve pnpm without a shell. A Windows `.cmd` shim is not spawnable here.
 * @param args - arguments after the pnpm executable.
 * @returns a command and argument list for `spawn`.
 */
function resolvePnpm(args: readonly string[]): { command: string; args: string[] } {
  const entrypoint = process.env.npm_execpath?.trim()
  if (entrypoint !== undefined && entrypoint !== '') {
    const extension = extname(entrypoint).toLowerCase()
    if (extension === '.js' || extension === '.cjs' || extension === '.mjs') {
      return { command: process.execPath, args: [entrypoint, ...args] }
    }
    if (extension !== '.cmd') return { command: entrypoint, args: [...args] }
  }
  const home = process.env.PNPM_HOME?.trim()
  if (home !== undefined && home !== '') {
    for (const filename of ['pnpm.mjs', 'pnpm.cjs'] as const) {
      const candidate = resolve(home, '..', 'pnpm', 'bin', filename)
      if (existsSync(candidate)) return { command: process.execPath, args: [candidate, ...args] }
    }
  }
  throw new Error('invoke through `pnpm run pack:desktop-1tmt` so npm_execpath is a JavaScript entrypoint.')
}

function skipNestedNodeModules(packageRoot: string): (path: string) => boolean {
  const nested = join(packageRoot, 'node_modules')
  return path => path !== nested && !path.startsWith(nested + sep)
}

interface PackageManifest {
  name?: string
  os?: string[]
  cpu?: string[]
  dependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  peerDependenciesMeta?: Record<string, { optional?: boolean }>
}

const WORKSPACE_MANIFEST_GLOBS = [
  'apps/*/package.json',
  'packages/*/*/package.json',
  'vendor/*/package.json',
  'native/system/package.json',
  'native/system/packages/*/package.json',
] as const

/**
 * Production package names that must resolve beside a deployed manifest.
 * Optional peers are omitted.
 * @param manifest - one package.json object.
 * @returns sorted required dependency names.
 */
export function requiredProductionPackages(manifest: PackageManifest): string[] {
  const names = new Set(Object.keys(manifest.dependencies ?? {}))
  const meta = manifest.peerDependenciesMeta ?? {}
  for (const peer of Object.keys(manifest.peerDependencies ?? {})) {
    if (meta[peer]?.optional === true) continue
    names.add(peer)
  }
  return [...names].sort()
}

function workspacePackageDirectories(repositoryRoot: string): Map<string, string> {
  const result = new Map<string, string>()
  for (const relative of globSync([...WORKSPACE_MANIFEST_GLOBS], { cwd: repositoryRoot }).sort()) {
    const manifestPath = resolve(repositoryRoot, relative)
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as PackageManifest
    if (typeof manifest.name === 'string' && manifest.name !== '') {
      result.set(manifest.name, dirname(manifestPath))
    }
  }
  return result
}

function packageMatchesPackHost(manifest: PackageManifest): boolean {
  if (manifest.os !== undefined && !manifest.os.includes('win32')) return false
  if (manifest.cpu !== undefined && !manifest.cpu.includes('x64')) return false
  return true
}

class DesktopPack {
  constructor(private readonly cli: PackCli) {}

  async pack(): Promise<void> {
    if (!this.cli.dryRun && (process.platform !== 'win32' || process.arch !== 'x64')) {
      throw new Error('a real pack requires Windows x64; use --dry-run elsewhere.')
    }
    await this.build()
    await this.resetPayloadRoot()
    try {
      await this.deployApp()
      await this.materializeLinks(join(appRoot, 'node_modules'))
      await this.closeDeployedGraph()
      this.assertDeployedApp()
      await this.prepareNode()
      await this.smokeImports()
    } finally {
      // `pnpm deploy` prunes the development install; restore it before the shell build needs Electron.
      await this.runPnpm('restore development dependencies', ['install'])
    }
    await this.runPnpm('build desktop shell', ['--dir', shellRoot, 'run', 'build'])
    await this.buildInstaller()
    this.printResult()
  }

  private async build(): Promise<void> {
    if (this.cli.skipBuild) {
      console.log('pack-desktop-1tmt: skipping pnpm run build (--skip-build)')
      return
    }
    await this.runPnpm('build', ['run', 'build'])
  }

  private async resetPayloadRoot(): Promise<void> {
    if (this.cli.dryRun) {
      console.log(`pack-desktop-1tmt: [dry-run] rm -rf ${payloadRoot}`)
      console.log(`pack-desktop-1tmt: [dry-run] mkdir ${runtimeRoot}`)
      return
    }
    if (payloadRoot === root || root.startsWith(payloadRoot + sep)) {
      throw new Error(`refusing to clear ${payloadRoot}`)
    }
    await rm(payloadRoot, { recursive: true, force: true })
    await mkdir(runtimeRoot, { recursive: true })
    await mkdir(cacheRoot, { recursive: true })
  }

  private async deployApp(): Promise<void> {
    await this.runPnpm('deploy', [
      '--filter',
      DEPLOY_FILTER,
      'deploy',
      '--legacy',
      '--prod',
      '--config.node-linker=hoisted',
      '--config.auto-install-peers=false',
      '--config.link-workspace-packages=true',
      appRoot,
    ])
  }

  private async closeDeployedGraph(): Promise<void> {
    if (this.cli.dryRun) {
      console.log('pack-desktop-1tmt: [dry-run] close production dependency graph (copy workspace packages omitted by deploy)')
      return
    }
    const workspace = workspacePackageDirectories(root)
    const restored: string[] = []
    const queued = [appRoot]
    const visited = new Set<string>()
    while (queued.length > 0) {
      const packageRoot = queued.pop()
      if (packageRoot === undefined) continue
      const manifestPath = join(packageRoot, 'package.json')
      if (!existsSync(manifestPath) || visited.has(manifestPath)) continue
      visited.add(manifestPath)
      const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as PackageManifest
      const optional = new Set(Object.keys(manifest.optionalDependencies ?? {}))
      for (const dependency of [...requiredProductionPackages(manifest), ...optional].sort()) {
        const destination = join(appRoot, 'node_modules', dependency)
        if (existsSync(join(destination, 'package.json'))) {
          queued.push(destination)
          continue
        }
        const source = this.resolvePackageSource(dependency, workspace)
        if (source === undefined) {
          if (optional.has(dependency)) continue
          const owner = manifest.name ?? packageRoot
          throw new Error(`${dependency} required by ${owner} is absent after deploy`)
        }
        const sourceManifest = JSON.parse(await readFile(join(source, 'package.json'), 'utf8')) as PackageManifest
        if (!packageMatchesPackHost(sourceManifest)) continue
        await mkdir(dirname(destination), { recursive: true })
        await cp(source, destination, {
          recursive: true,
          dereference: true,
          filter: skipNestedNodeModules(source),
        })
        restored.push(dependency)
        queued.push(destination)
      }
    }
    if (restored.length > 0) {
      console.log(`pack-desktop-1tmt: restored omitted packages: ${[...new Set(restored)].sort().join(', ')}`)
    }
  }

  private resolvePackageSource(name: string, workspace: ReadonlyMap<string, string>): string | undefined {
    const candidates = [
      join(cliSourceNodeModules, name),
      join(root, 'node_modules', name),
      workspace.get(name),
    ]
    for (const candidate of candidates) {
      if (candidate !== undefined && existsSync(join(candidate, 'package.json'))) return candidate
    }
    return undefined
  }

  private async materializeLinks(directory: string): Promise<void> {
    if (this.cli.dryRun) {
      console.log(`pack-desktop-1tmt: [dry-run] replace package links under ${directory}`)
      return
    }
    if (!existsSync(directory)) return
    const pending = [directory]
    while (pending.length > 0) {
      const current = pending.pop()
      if (current === undefined) continue
      for (const entry of await readdir(current, { withFileTypes: true })) {
        const path = join(current, entry.name)
        if (entry.name === '.bin') {
          await rm(path, { recursive: true, force: true })
          continue
        }
        const metadata = await lstat(path)
        if (metadata.isSymbolicLink()) {
          const source = await realpath(path)
          await rm(path, { recursive: true, force: true })
          await cp(source, path, {
            recursive: true,
            dereference: true,
            filter: skipNestedNodeModules(source),
          })
          continue
        }
        if (metadata.isDirectory()) pending.push(path)
      }
    }
  }

  private assertDeployedApp(): void {
    const required: ReadonlyArray<readonly [string, string]> = [
      [cliBin, 'run without --skip-build or build the CLI first'],
      [cosmokitManifest, 'deploy omitted the cordis workspace link'],
      [frontendIndex, 'the web frontend dist must be built'],
    ]
    for (const [path, hint] of required) {
      if (this.cli.dryRun) {
        console.log(`pack-desktop-1tmt: [dry-run] require ${path}`)
        continue
      }
      if (!existsSync(path)) throw new Error(`${path} missing; ${hint}.`)
    }
  }

  private async prepareNode(): Promise<void> {
    const archive = join(cacheRoot, NODE_ARCHIVE_NAME)
    const sums = join(cacheRoot, `node-v${NODE_VERSION}-SHASUMS256.txt`)
    const extractRoot = join(cacheRoot, 'extract')
    const nodeExe = join(runtimeRoot, 'node.exe')
    if (this.cli.dryRun) {
      console.log(`pack-desktop-1tmt: [dry-run] download ${NODE_RELEASE_ROOT}/${NODE_ARCHIVE_NAME}`)
      console.log(`pack-desktop-1tmt: [dry-run] verify sha256 of ${NODE_ARCHIVE_NAME}`)
      console.log(`pack-desktop-1tmt: [dry-run] copy node.exe -> ${nodeExe}`)
      return
    }
    if (!existsSync(archive)) {
      await this.download(`${NODE_RELEASE_ROOT}/${NODE_ARCHIVE_NAME}`, archive)
    }
    if (!existsSync(sums)) {
      await this.download(`${NODE_RELEASE_ROOT}/SHASUMS256.txt`, sums)
    }
    const expected = (await readFile(sums, 'utf8'))
      .split(/\r?\n/u)
      .find(line => line.endsWith(`  ${NODE_ARCHIVE_NAME}`))
      ?.split(/\s+/u)[0]
    if (expected === undefined) {
      throw new Error(`${NODE_ARCHIVE_NAME} is absent from Node.js SHASUMS256.txt`)
    }
    const actual = createHash('sha256').update(await readFile(archive)).digest('hex')
    if (actual !== expected) {
      throw new Error(`checksum mismatch for ${NODE_ARCHIVE_NAME}`)
    }
    await rm(extractRoot, { recursive: true, force: true })
    await mkdir(extractRoot, { recursive: true })
    await this.runCommand('extract Node.js', 'tar', ['-xf', archive, '-C', extractRoot])
    const source = join(extractRoot, NODE_DIST_FOLDER, 'node.exe')
    if (!existsSync(source)) {
      throw new Error(`extracted ${source} is missing`)
    }
    await cp(source, nodeExe)
    await chmod(nodeExe, 0o755)
    await this.verifyBundledNode(nodeExe)
    await rm(extractRoot, { recursive: true, force: true })
  }

  private async verifyBundledNode(nodeExe: string): Promise<void> {
    await new Promise<void>((resolvePromise, reject) => {
      const child = spawn(nodeExe, ['--version'], { stdio: ['ignore', 'pipe', 'pipe'] })
      let stdout = ''
      child.stdout.on('data', (chunk) => {
        stdout += String(chunk)
      })
      child.once('error', (error) => {
        reject(new Error(`bundled Node failed to start: ${error.message}`))
      })
      child.once('exit', (code, signal) => {
        if (code === 0 && stdout.trim() === `v${NODE_VERSION}`) {
          resolvePromise()
          return
        }
        reject(new Error(`bundled Node version check failed (${String(code ?? signal)}): ${stdout.trim()}`))
      })
    })
  }

  private async smokeImports(): Promise<void> {
    const nodeExe = join(runtimeRoot, 'node.exe')
    const args = [
      '--input-type=module',
      '-e',
      "await import('@deepseek-ai/cosmokit'); await import('@deepseek-ai/cordis')",
    ]
    await this.runCommand('smoke imports', nodeExe, args, appRoot)
  }

  private async buildInstaller(): Promise<void> {
    if (!this.cli.dryRun) await rm(installerRoot, { recursive: true, force: true })
    await this.runPnpm('build installer', [
      '--dir',
      shellRoot,
      'exec',
      'electron-builder',
      '--win',
      'nsis',
      '--x64',
      '--publish',
      'never',
    ])
  }

  private printResult(): void {
    if (this.cli.dryRun) {
      console.log(`pack-desktop-1tmt: [dry-run] would produce an NSIS installer under ${installerRoot}`)
      return
    }
    for (const name of readdirSync(installerRoot)) {
      if (!name.toLowerCase().endsWith('.exe')) continue
      const path = join(installerRoot, name)
      const megabytes = statSync(path).size / (1024 * 1024)
      console.log(`pack-desktop-1tmt: installer ${path} (${megabytes.toFixed(1)} MB)`)
    }
  }

  private async download(url: string, path: string): Promise<void> {
    console.log(`pack-desktop-1tmt: download ${url}`)
    const response = await fetch(url)
    if (!response.ok) throw new Error(`${url} returned HTTP ${String(response.status)}`)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, Buffer.from(await response.arrayBuffer()))
  }

  private async runPnpm(label: string, args: string[]): Promise<void> {
    const invocation = resolvePnpm(args)
    await this.runCommand(label, invocation.command, invocation.args)
  }

  private async runCommand(label: string, command: string, args: readonly string[], cwd: string = root): Promise<void> {
    const printable = formatCommand(command, args)
    if (this.cli.dryRun) {
      console.log(`pack-desktop-1tmt: [dry-run] ${printable}`)
      return
    }
    console.log(`pack-desktop-1tmt: ${label}: ${printable}`)
    await new Promise<void>((resolvePromise, reject) => {
      const child = spawn(command, [...args], {
        cwd,
        stdio: 'inherit',
        env: { ...process.env, CI: 'true', NODE_ENV: 'development' },
      })
      child.once('error', (error) => {
        reject(new Error(`${label} failed to spawn: ${error.message} (${printable})`))
      })
      child.once('exit', (code, signal) => {
        if (code === 0) {
          resolvePromise()
          return
        }
        const cause = code === null ? `signal ${signal ?? 'unknown'}` : `exit code ${code}`
        reject(new Error(`${label} failed (${cause}): ${printable}`))
      })
    })
  }
}

async function main(): Promise<void> {
  const cli = parseCli(process.argv.slice(2))
  await new DesktopPack(cli).pack()
}

if (import.meta.main) {
  try {
    await main()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    process.stderr.write(`pack-desktop-1tmt: ${message}\n`)
    process.exitCode = 1
  }
}
