import { readFileSync } from 'node:fs'
import { Ajv } from 'ajv'
import { describe, expect, it } from 'vitest'
import * as pkg from '../src/index.js'

const TM_SCHEMA = 'test/schemas/tmLanguage.schema.json'

function schemaCheck(g: unknown) {
  const ajv = new Ajv()
  const schema = readFileSync(TM_SCHEMA, 'utf8')
  const validate = ajv.compile(JSON.parse(schema))
  if (!validate(g)) {
    throw new Error(ajv.errorsText(validate.errors))
  }
}


const exampleGrammar = {
  scopeName: 'source.example',
  patterns: [
    { name: 'a',
      match: 'a*',
      captures: {
        '2': {
          name: 'a2',
          patterns: [
            { name:  'a2_0',
              match: 'a2_0*',
            }
          ]
        }
      }
    },
    { name: 'b',
      begin: 'b*',
      end: 'b_end*',
      beginCaptures: { '0': { patterns: [{ match: 'b_bc_0*' }] } },
      patterns     : [      { match: 'b_pt_0*'} ]
    },
  ],
  repository: {
    'ruleD': {
      name: 'D',
      match: 'D*',
    },
    'ruleC': {
      name: 'C',
      begin: 'C*',
      end: 'C_end*',
      endCaptures: { '1': { patterns: [{ match: 'C_bc_0*' }] } },
    },
  },
}


const locatedExpected: pkg.LocatedRegex[] = sort([
  {rgx: 'a*'     , loc: 'patterns[0].match'},
  {rgx: 'a2_0*'  , loc: 'patterns[0].captures.2.patterns[0].match'},
  {rgx: 'b*'     , loc: 'patterns[1].begin'},
  {rgx: 'b_end*' , loc: 'patterns[1].end'},
  {rgx: 'b_bc_0*', loc: 'patterns[1].beginCaptures.0.patterns[0].match'},
  {rgx: 'b_pt_0*', loc: 'patterns[1].patterns[0].match'},
  {rgx: 'D*'     , loc: 'repository.ruleD.match'},
  {rgx: 'C*'     , loc: 'repository.ruleC.begin'},
  {rgx: 'C_end*' , loc: 'repository.ruleC.end'},
  {rgx: 'C_bc_0*', loc: 'repository.ruleC.endCaptures.1.patterns[0].match'},
])

function getLocated(result: pkg.LocatedRegexResult[]): pkg.LocatedRegex[] {
  return result.map(r => ({rgx:r.rgx, loc:r.loc}))
}

function sort(xs: pkg.LocatedRegex[]): pkg.LocatedRegex[] {
  const sortBy = (x: pkg.LocatedRegex) => `${x.rgx} ${x.loc}`
  return xs.sort((a, b) => sortBy(a).localeCompare(sortBy(b)))
}

it('example grammar passes schema validation', () => {
  expect(() => schemaCheck(exampleGrammar)).not.toThrow()
})

describe('parsing reports correct path/location', async () => {

  const source = {kind:'str' as const, value:JSON.stringify(exampleGrammar) }
  const result = await pkg.validateGrammar(source)
  const locatedResult = sort(getLocated(result))
  it('passes', () => {
    expect(result).toSatisfy(pkg.passed)
  })
  it('reports the expected paths', () => {
    expect(locatedResult).toEqual(locatedExpected)
  })

})
