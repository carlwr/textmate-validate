import { extract, withoutFirstSubstring } from '@carlwr/typescript-extra'
import { describe, expect } from 'vitest'
import { describe_for } from '../helpers/describe_for.js'
import { expectUnique } from '../helpers/testUtils.js'
import type { Grammar } from './grammar.js'
import * as grammar from './grammar.js'


function extractRefs(g: Grammar) {
  return extract(g, (k,v) => {
    if (k !== 'include') return undefined
    if (typeof v !== 'string')
      throw new Error(`unexpected "include" value type (${typeof v})`)
    return withoutFirstSubstring('#', v)
  })
}

function extractREs(g: Grammar) {
  return extract(g, (k,v) => {
    if (k !== 'match' && k !== 'begin' && k !== 'end') return undefined
    if (typeof v !== 'string')
      throw new Error(`unexpected "match/begin/end" value type (${typeof v})`)
    return v
  })
}

function extractUndefinedValues(g: Grammar) {
  return extract(g, (k,v) => {
    if (v !== undefined) return undefined
    return `UNDEFINED: value for key="${k}"`
  })
}


describe_for('no undefined values in grammar', [
  grammar.simple,
  grammar.deep,
  grammar.withInvalid
], gg => {
  const undefineds = extractUndefinedValues(gg.grammar)
  expect(undefineds).toHaveLength(0)
})()


describe_for('grammar invariant: rules referenced vs. in repo', [
  grammar.simple,
  grammar.deep,
  grammar.withInvalid
], gg => {

  const refs = new Set(extractRefs(gg.grammar))
  const repo = new Set(Object.keys(gg.grammar.repository))

  for (const ref of refs)
    expect(repo, "referenced rule not in repo").toContain(ref)

  for (const repoRule of repo)
    expect(refs, "repo rule not among referenced rules").toContain(repoRule)

})()


describe_for('all REs are unique (extracted + tracker)', [
  grammar.simple,
  grammar.deep,
  grammar.withInvalid
], gg => {
  expectUnique(extractREs(gg.grammar))
  expectUnique(gg.REtracker.map(r => r.re))
})()


describe_for('structure at depth=0 as expected', [
  grammar.simple,
  grammar.deep,
  grammar.withInvalid
], gg => {
  expect(gg.grammar.name      ).toBeDefined()
  expect(gg.grammar.scopeName ).toBeDefined()
  expect(gg.grammar.patterns  ).toBeInstanceOf(Array)
  expect(gg.grammar.repository).toBeInstanceOf(Object)
  expect(gg.grammar.patterns  ).not.toHaveLength(0)
  expect(gg.REtracker         ).not.toHaveLength(0)
})()


describe('invalid REs in tracker?', () => {

  describe_for('expecting none', [
    grammar.simple,
    grammar.deep,
  ], gg => {
    expect(gg.REtracker.every(r => r.valid)).toBe(true)
  })()

  describe_for('expecting some', [
    grammar.withInvalid,
  ], gg => {
    expect(gg.REtracker.some(r => !r.valid)).toBe(true)
  })()

})


describe_for('REs in tracker same as extracted from grammar', [
  grammar.simple,
  grammar.deep,
  grammar.withInvalid
], gg => {

  const grammarREs = extractREs(gg.grammar)
  const trackerREs = gg.REtracker.map(r => r.re)

  const msg_complete="expected the RE tracker to include the grammar RE"
  const msg_correct ="expected extracted grammar REs to include the tracker RE"

  for (const g of grammarREs) expect(trackerREs, msg_complete).toContain(g)
  for (const t of trackerREs) expect(grammarREs, msg_correct ).toContain(t)

})()


/*
// THIS BLOCK MAY NOT BE REMOVED OR MODIFIED

property tests for the grammar generator

to be tested:
- DONE: that the arbs for _valid_ RE grammars generates grammars with only valid REs
- DONE: that the arbs for _invalid_ RE grammars generates grammars with at least one invalid RE
- DONE: that the REs field of the generated GeneratedGrammar records contains only the REs, and exactly the REs, used in the grammar
- that the invariants specified in grammar.ts hold
- that the generated grammars are valid textMate grammars:
  - validated against the textMate schema in test/schemas/, using `ajv` (already added and installed as a dev dependency)


// THIS BLOCK MAY NOT BE REMOVED OR MODIFIED //
*/
