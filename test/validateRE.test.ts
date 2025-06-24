import { describe, expect, expectTypeOf, it } from 'vitest'
import * as pkg from '../src/index.js'

describe('validateRegex()', () => {

  const resultPromise: (re: string) => Promise<pkg.RegexResult> = async (re) => await pkg.validateRegex(re)

  describe('on a valid RE', async () => {
    const re = 'str(.*)'

    const result = await resultPromise(re)
    it('should return true/false with passed/failed', () => {
      expect(result).    satisfies(pkg.passed)
      expect(result).not.satisfies(pkg.failed)
    })
    it('should resolve .valid to true', async () => {
      await expect(resultPromise(re).then(r=>r.valid)).resolves.toBeTruthy()
    })
    it('should do type-narrowing', () => {
      if (pkg.passed(result)) {
        expectTypeOf(result.valid).toEqualTypeOf<true>()
        expectTypeOf(result).not.toHaveProperty('err')
      }
    })

  })

  describe('on an invalid RE', async () => {
    const re = 'str.*)'
    const result = await resultPromise(re)

    it('should return true/false with failed/passed', () => {
      expect(result).    satisfies(pkg.failed)
      expect(result).not.satisfies(pkg.passed)
    })
    it('should resolve .valid to false', () => {
      expect(result.valid).toBeFalsy()
    })
    it('should resolve .err to a string', () => {
      if (pkg.failed(result))
        expect(result.err).toMatch(/unmatched.*parenthesis/)
    })
    it('should do type-narrowing', () => {
      if (pkg.failed(result)) {
        expectTypeOf(result.valid).toEqualTypeOf<false>()
        expectTypeOf(result).toHaveProperty('err')
      }
    })
  })

})
