import { access } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { isNonEmpty } from '@carlwr/typescript-extra'
import * as globby from 'globby'
import * as pkgJson from '../pkgJson.js'

const VSC_ONIG = 'vscode-oniguruma'

let overridePath: string | undefined

/** Override (or, with `undefined`, restore) heuristic detection of `onig.wasm`. */
export function setOnigWasmPath(path: string | undefined): void {
  overridePath = path
}

async function tryGlob(pattern: string, cwd: string): Promise<string[]> {
  return await globby.globby(pattern, {
    cwd,
    dot: true,
    followSymbolicLinks: true,
    absolute: true,
  })
}

async function hasNodeModules(dir: string): Promise<boolean> {
  try { await access(join(dir, 'node_modules')); return true }
  catch { return false }
}

// search `node_modules`-containing ancestors of `import.meta.url` plus `process.cwd()`; covers local/global/npx/pnpm-store installs
async function collectSearchDirs(selfUrl: string): Promise<string[]> {
  const dirs: string[] = []
  const seen = new Set<string>()
  const add = (d: string) => { if (!seen.has(d)) { seen.add(d); dirs.push(d) } }

  let dir = dirname(fileURLToPath(selfUrl))
  while (true) {
    if (await hasNodeModules(dir)) add(dir)
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  add(process.cwd())
  return dirs
}

export async function getOnigWasmPath(): Promise<string> {
  if (overridePath !== undefined) {
    try { await access(overridePath) }
    catch {
      throw new Error(`onig.wasm override path not readable: ${overridePath}`)
    }
    return overridePath
  }

  const version = await getVscOnigVersion()

  const patterns = [
    `node_modules/**/${VSC_ONIG}@${version}/**/onig.wasm`,
    `node_modules/**/${VSC_ONIG}/**/onig.wasm`,
    `node_modules/**/*${VSC_ONIG}*/**/onig.wasm`
  ]

  const searchDirs = await collectSearchDirs(import.meta.url)
  for (const pattern of patterns) {
    for (const dir of searchDirs) {
      const matches = await tryGlob(pattern, dir)
      if (isNonEmpty(matches)) return matches[0]
    }
  }
  throw new Error(`could not find onig.wasm for ${VSC_ONIG}@${version}.`)
}

async function getVscOnigVersion(): Promise<string> {
  let deps: Record<string,string> | undefined
  try {
    deps = await pkgJson.dependencies()
  } catch (error) {
    throw new Error(`could not read 'dependencies' from package.json: ${error}`)
  }

  const version = deps[VSC_ONIG]
  if (!version) {
    throw new Error(`${VSC_ONIG} not found as a dependency in package.json`)
  }

  const validRE = /^[0-9.]+$/
  if (!validRE.test(version)) {
    throw new Error(`The version spec for ${VSC_ONIG} in package.json is '${version}' which does not match the expected format /${validRE.source}/. In order to use the oniguruma wasm binary, the version declared in package.json must be an exact version number, e.g. "2.0.1".`)
  }

  return version
}
