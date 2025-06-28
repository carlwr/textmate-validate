import process from 'node:process'
import { memoized } from '@carlwr/typescript-extra'
import * as readPkg from 'read-pkg'


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


// --- TODO: clean-up + use helpers:

const getPkg = memoized(readPkg.readPackage)

async function field<T>(name: string, validate: (v: unknown) => v is T): Promise<T> {
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
