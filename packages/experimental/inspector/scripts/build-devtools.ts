/** Compile the fixed npm DevTools sources locally and publish the complete static frontend. */
import { createHash } from 'node:crypto'
import { cp, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { buildFrontend } from './devtools/vite.ts'
import { DEVTOOLS_NPM_VERSION, DEVTOOLS_SOURCE_REVISION } from './devtools/source.ts'

let pending: Promise<{ files: number; bytes: number }> | undefined

/**
 * Build lib/devtools without network access, retaining relative Worker and asset URLs.
 * @returns Published file count and bytes, excluding the distribution manifest.
 */
export function buildDevtools(): Promise<{ files: number; bytes: number }> {
  pending ??= compile().finally(() => { pending = undefined })
  return pending
}

function isBusyPathError(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && (error.code === 'EPERM' || error.code === 'EACCES' || error.code === 'EBUSY' || error.code === 'ENOTEMPTY')
}

/**
 * Replace `output` with `temporary` directory. Windows often keeps a brief lock on
 * the previous tree after `rm`, so rename retries and then falls back to copy.
 */
async function publishDirectory(temporary: string, output: string): Promise<void> {
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      await rm(output, { recursive: true, force: true })
      await rename(temporary, output)
      return
    } catch (error) {
      if (!isBusyPathError(error) || attempt === 7) break
      await delay(100 * (attempt + 1))
    }
  }
  // Last resort: copy into place (Windows Defender / indexer may hold the dir name).
  await rm(output, { recursive: true, force: true })
  await mkdir(output, { recursive: true })
  await cp(temporary, output, { recursive: true, force: true })
  await rm(temporary, { recursive: true, force: true })
}

async function compile(): Promise<{ files: number; bytes: number }> {
  const lib = fileURLToPath(new URL('../lib/', import.meta.url))
  await mkdir(lib, { recursive: true })
  const temporary = await mkdtemp(join(lib, 'devtools.build-'))
  try {
    await buildFrontend(temporary)
    const files: Array<{ path: string; bytes: number; sha256: string }> = []
    const walk = async (directory: string): Promise<void> => {
      for (const entry of await readdir(join(temporary, directory), { withFileTypes: true })) {
        const path = directory ? `${directory}/${entry.name}` : entry.name
        if (entry.isDirectory()) await walk(path)
        else {
          const bytes = await readFile(join(temporary, path))
          files.push({ path, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') })
        }
      }
    }
    await walk('')
    const bytes = files.reduce((total, file) => total + file.bytes, 0)
    await writeFile(join(temporary, 'resource-manifest.json'), `${JSON.stringify({
      source: 'chrome-devtools-frontend', version: DEVTOOLS_NPM_VERSION, revision: DEVTOOLS_SOURCE_REVISION,
      builder: 'vite',
      files: files.sort((left, right) => left.path.localeCompare(right.path)),
    }, null, 2)}\n`)
    const output = join(lib, 'devtools')
    await publishDirectory(temporary, output)
    console.log(`DevTools npm ${DEVTOOLS_NPM_VERSION}: ${files.length} files, ${bytes} bytes`)
    return { files: files.length, bytes }
  } finally {
    await rm(temporary, { recursive: true, force: true }).catch(() => {})
  }
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await buildDevtools()
