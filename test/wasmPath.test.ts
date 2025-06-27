import { describe, expect, it } from 'vitest'
import * as pkg from '../src/index.js'

describe('getWasmPath()', () => {

  it('should not throw', () => {
    expect(() => pkg.getWasmPath()).not.toThrow()
  })

  it('should return a valid path', () => {
    const path = pkg.getWasmPath()
    expect(path).toMatch(/onig\.wasm$/)
  })

})
