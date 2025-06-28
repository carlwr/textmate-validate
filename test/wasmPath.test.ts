import { describe, expect, it } from 'vitest'
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
