import { dirname, join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { memoized } from '@carlwr/typescript-extra'
import * as readPkg from 'read-pkg'

/**
 * bundled values set by the bundler
 *
 * the implementation will pick values from this object if defined, which means a bundled implementation is currently run; otherwise, values are read from the package.json file (cached)
 */
declare const __BUNDLED_PKGJSON_VALUES__: Bundled


// main API - code that needs values from package.json will use these:

export const name         = () => field('name'        , isString      )
export const version      = () => field('version'     , isString      )
export const description  = () => field('description' , isString      )
export const dependencies = () => field('dependencies', isStringRecord)
export const repository   = () => field('repository'  , isRepository  )

export const nameWithoutScope = async () =>
  (await name()).replace(/^@.*?\//, '')

export const repoUrl = async () =>
  (await repository()).url
    .replace(/^git\+/, '')
    .replace(/\.git$/, '')


// implementation:

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const getPkg = memoized(() => readPkg.readPackage({ cwd: pkgRoot }))

interface Value {
  name        : string
  version     : string
  description : string
  dependencies: Record<string, string>
  repository  : { url: string }
}

type Bundled = {
  [K in keyof Value]: Value[K]
} | undefined

async function field<N extends keyof Value>(name: N, validate: (v: unknown) => v is Value[N]): Promise<Value[N]> {

  const maybeBundledValue = tryBundledValue(name, validate)
  if (maybeBundledValue !== undefined) {
    return maybeBundledValue
  }

  const pkg = await getPkg()
  if (!pkg || typeof pkg !== 'object') {
    console.error('package.json invalid')
    process.exit(1)
  }

  const value = (pkg as Record<string, unknown>)[name]
  if (!validate(value)) {
    console.error(`package.json field '${name}' invalid`)
    process.exit(1)
  }

  return value
}

const isString = (v: unknown): v is string => typeof v === 'string'
const isObject = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object'

function isRepository(v: unknown): v is { url: string } {
  return isObject(v) && 'url' in v && isString(v.url)
}

function isStringRecord(v: unknown): v is Record<string,string> {
  return isObject(v) && Object.values(v).every(isString)
}


// bundling-specific:

export function isBundled(): boolean {
  return (typeof __BUNDLED_PKGJSON_VALUES__ !== 'undefined')
}

/**
 * return the bundled value if it is defined, otherwise undefined
 */
function tryBundledValue<N extends keyof Value>(
  name: N,
  validate: (v: unknown) => v is Value[N]
): Value[N]|undefined {
  if (typeof __BUNDLED_PKGJSON_VALUES__ === 'undefined') {
    return undefined
  }
  const bundledValue = __BUNDLED_PKGJSON_VALUES__[name]
  if (!validate(bundledValue)) {
    throw new Error(`bundled value for '${name}' is invalid`)
  }
  return bundledValue
}

/**
 * to be use by the bundler for setting the bundled object
 */
export async function getValuesObj(): Promise<Value> {
  return {
    name        : await name(),
    version     : await version(),
    description : await description(),
    dependencies: await dependencies(),
    repository  : await repository(),
  }
}
