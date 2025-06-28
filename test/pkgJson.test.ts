import { expect, it } from 'vitest'
import * as pkgJson from '../src/pkgJson.js'


it('returns package name', async () => {
  const result = await pkgJson.name()
  expect(typeof result).toBe('string')
  expect(result.length).toBeGreaterThan(0)
})

it('returns package version', async () => {
  const result = await pkgJson.version()
  expect(typeof result).toBe('string')
  expect(result.length).toBeGreaterThan(0)
})

it('returns dependencies as record-like', async () => {
  const result = await pkgJson.dependencies()
  expect(typeof result).toBe('object')
  expect(result).not.toBeNull()
  const deps = Object.entries(result)
  expect(deps.length).toBeGreaterThan(0)
})
