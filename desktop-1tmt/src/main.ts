/**
 * Electron main process of the 1TMT desktop shell. It starts the bundled
 * Node.js running `dsh web --no-open` without a console window, shows a
 * splash page until the readiness line arrives, then loads the authenticated
 * loopback URL in the same window. Closing the window ends the whole `dsh`
 * process tree.
 *
 * Customer state stays under `%LOCALAPPDATA%\Harness` (`配置.cmd`, `data\`,
 * `logs\`), outside the replaceable install directory.
 */

import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { app, BrowserWindow, dialog, Menu, shell } from 'electron'
import { CONFIG_FILE_NAME, configTemplate, parseConfigCmd } from './config-cmd.ts'
import { parseReadyUrl, splitLines } from './host-output.ts'

const READY_TIMEOUT_MS = 180_000
const LOG_TAIL_LINES = 20

const userRoot = join(process.env.LOCALAPPDATA ?? app.getPath('appData'), 'Harness')
const configPath = join(userRoot, CONFIG_FILE_NAME)
const logPath = join(userRoot, 'logs', 'host.log')

let mainWindow: BrowserWindow | undefined
let host: ChildProcess | undefined
let hostOrigin: string | undefined
let quitting = false
let failing = false
const logTail: string[] = []

function assetPath(name: string): string {
  return join(app.getAppPath(), 'assets', name)
}

/**
 * Packaged builds carry `runtime\` and `app\` under `resources\payload`; an
 * unpackaged `pnpm start` uses the staging directory written by the pack script.
 */
function payloadRoot(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'payload')
    : resolve(app.getAppPath(), '..', 'dist', 'desktop-1tmt', 'payload')
}

function readConfig(): Record<string, string> {
  mkdirSync(userRoot, { recursive: true })
  if (!existsSync(configPath)) writeFileSync(configPath, configTemplate())
  return parseConfigCmd(readFileSync(configPath, 'utf8'))
}

function remember(line: string): void {
  if (line.trim() === '') return
  logTail.push(line)
  if (logTail.length > LOG_TAIL_LINES) logTail.shift()
}

function isHostUrl(url: string): boolean {
  if (hostOrigin === undefined) return false
  try {
    return new URL(url).origin === hostOrigin
  } catch {
    // A malformed URL from the page cannot belong to the local host.
    return false
  }
}

function openExternally(url: string): void {
  if (/^https?:/iu.test(url)) void shell.openExternal(url)
}

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    title: 'Harness',
    icon: assetPath('icon.png'),
    show: false,
    backgroundColor: '#ffffff',
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  })
  window.once('ready-to-show', () => { window.show() })
  window.on('page-title-updated', (event) => { event.preventDefault() })
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isHostUrl(url)) return { action: 'allow' }
    openExternally(url)
    return { action: 'deny' }
  })
  window.webContents.on('will-navigate', (event, url) => {
    if (isHostUrl(url) || url.startsWith('file:')) return
    event.preventDefault()
    openExternally(url)
  })
  window.on('closed', () => { mainWindow = undefined })
  void window.loadFile(assetPath('splash.html'))
  return window
}

function fail(message: string): void {
  if (failing || quitting) return
  failing = true
  const detail = [`日志：${logPath}`, `配置：${configPath}`, '', ...logTail].join('\n')
  const options = {
    type: 'error' as const,
    title: 'Harness',
    message,
    detail,
    buttons: ['退出', '打开配置文件', '打开日志所在文件夹'],
    defaultId: 0,
    cancelId: 0,
    noLink: true,
  }
  const shown = mainWindow === undefined
    ? dialog.showMessageBox(options)
    : dialog.showMessageBox(mainWindow, options)
  void shown.then(({ response }) => {
    if (response === 1) void shell.openPath(configPath)
    if (response === 2) shell.showItemInFolder(logPath)
    app.quit()
  })
}

function startHost(config: Record<string, string>): void {
  const root = payloadRoot()
  const nodeExe = join(root, 'runtime', 'node.exe')
  const cliBin = join(root, 'app', 'lib', 'bin.js')
  for (const required of [nodeExe, cliBin]) {
    if (!existsSync(required)) {
      fail(`安装不完整，缺少 ${required}。请重新安装 Harness。`)
      return
    }
  }
  const dshHome = config.DSH_HOME ?? join(userRoot, 'data')
  mkdirSync(dshHome, { recursive: true })
  mkdirSync(join(userRoot, 'logs'), { recursive: true })
  const log = createWriteStream(logPath, { flags: 'w' })

  const child = spawn(nodeExe, [cliBin, 'web', '--no-open'], {
    cwd: userRoot,
    env: { ...process.env, ...config, DSH_HOME: dshHome },
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  host = child
  const timer = setTimeout(() => { fail('Harness 后台服务启动超时。') }, READY_TIMEOUT_MS)

  let pending = ''
  child.stdout.setEncoding('utf8')
  child.stderr.setEncoding('utf8')
  child.stdout.on('data', (chunk: string) => {
    log.write(chunk)
    const split = splitLines(pending, chunk)
    pending = split.rest
    for (const line of split.lines) {
      remember(line)
      const url = parseReadyUrl(line)
      if (url === undefined || hostOrigin !== undefined) continue
      clearTimeout(timer)
      hostOrigin = new URL(url).origin
      void mainWindow?.loadURL(url)
    }
  })
  child.stderr.on('data', (chunk: string) => {
    log.write(chunk)
    for (const line of chunk.split(/\r?\n/u)) remember(line)
  })
  child.once('error', (error) => {
    clearTimeout(timer)
    fail(`无法启动 Harness 后台服务：${error.message}`)
  })
  child.once('exit', (code, signal) => {
    clearTimeout(timer)
    log.end()
    host = undefined
    fail(`Harness 后台服务已退出（${String(code ?? signal)}）。`)
  })
}

/** Terminate `dsh web` and every tool process it spawned. */
function stopHost(): void {
  const child = host
  host = undefined
  if (child?.pid === undefined || child.exitCode !== null) return
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true })
    return
  }
  child.kill()
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow === undefined) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })
  app.on('window-all-closed', () => { app.quit() })
  app.on('before-quit', () => {
    quitting = true
    stopHost()
  })
  void app.whenReady().then(() => {
    Menu.setApplicationMenu(null)
    mainWindow = createWindow()
    let config: Record<string, string>
    try {
      config = readConfig()
    } catch (error) {
      fail(`无法读取配置文件：${error instanceof Error ? error.message : String(error)}`)
      return
    }
    startHost(config)
  })
}
