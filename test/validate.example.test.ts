import { describe, expect, it } from 'vitest'
import * as pkg from '../src/index.js'

// build a simple example grammar
function makeGrammar(re1: string, re2: string): unknown {

  return {
    scopeName: 'source.test',
    name: 'testName',
    patterns: [{
      name: 'keyword.test1',
      match: re1,
      captures: {
        '1': {
          name: 'keyword.test2',
          match: re2,
        },
      },
    }],
  }

}


describe('validateGrammar()', () => {

  it('should validate (string)', async () => {
    const grammar = JSON.stringify(makeGrammar('reStr', '(.*)'))
    const res = await pkg.validateGrammar({ kind: 'str', value: grammar })
    expect(res).toSatisfy(pkg.passed)
  })

  it('should fail (string)', async () => {
    const grammar = JSON.stringify(makeGrammar('reStr', '.*)'))
    const res = await pkg.validateGrammar({ kind: 'str', value: grammar })
    expect(res).toSatisfy(pkg.failed)
  })

})
