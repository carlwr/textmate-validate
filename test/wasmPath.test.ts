import { afterEach, describe, expect, it } from 'vitest'
import * as pkg from '../src/index.js'

describe('getWasmPath()', () => {

  it.concurrent('should not throw', () => {
    expect(async () => await pkg.getWasmPath()).not.toThrow()
  })

  it.concurrent('should return a valid path', async () => {
    const path = await pkg.getWasmPath()
    expect(typeof path).toBe('string')
    expect(path).toMatch(/onig\.wasm$/)
  })

})

describe('setOnigWasmPath()', () => {
  afterEach(() => { pkg.setOnigWasmPath(undefined) })

  it('returns the override when set to an existing file', async () => {
    const real = await pkg.getWasmPath()
    pkg.setOnigWasmPath(real)
    expect(await pkg.getWasmPath()).toBe(real)
  })

  it('throws when set to a non-existent path', async () => {
    pkg.setOnigWasmPath('/tmp/__no_such_onig_wasm__.wasm')
    await expect(pkg.getWasmPath()).rejects.toThrow(/override path not readable/)
  })

  it('resumes heuristic detection when cleared', async () => {
    const real = await pkg.getWasmPath()
    pkg.setOnigWasmPath('/tmp/__no_such__.wasm')
    pkg.setOnigWasmPath(undefined)
    expect(await pkg.getWasmPath()).toBe(real)
  })
})
