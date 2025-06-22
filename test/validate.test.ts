import { join } from 'node:path'
import { fc, it, test } from '@fast-check/vitest'
import { afterAll, describe, expect } from 'vitest'
import * as pkg from '../src/index.js'
import * as gr from './generators/grammar.js'
import type { Grammar, TaggedRE, Tracked } from './generators/grammar.js'
import { obj2file } from './helpers/testUtils.js'



async function validationResult(gg: Tracked) {
  const grammarStr = JSON.stringify(gg.grammar);
  return await pkg.validateGrammar({ kind: 'str', value: grammarStr });
}

async function prop_passing({grammar: gr}: Tracked) {
  const result = await validationResult({grammar: gr, REtracker: []})
  expect(result)    .toSatisfy(pkg.passed)
  expect(result).not.toSatisfy(pkg.failed)
}

async function prop_failing(gg: Tracked) {
  const result = await validationResult(gg);
  expect(result).    toSatisfy(pkg.failed)
  expect(result).not.toSatisfy(pkg.passed)
}

describe('grammar validation', () => {
  it('passes, if only valid REs', () => {
    test.prop([gr.simple.arb])(gr.simple.name, prop_passing)
    test.prop([gr.deep.arb  ])(gr.deep.name  , prop_passing)
  })
  it('fails, if invalid REs', () => {
    test.prop([gr.withInvalid.arb])(gr.withInvalid.name, prop_failing)
  })
})

describe('validation results and tracker agree', () => {
  const arb = gr.withInvalid.arb

  test.prop([arb])('about invalid REs', async (tracked) => {
    const result = await validationResult(tracked)
    const trackd = tracked.REtracker
    const result_invalid = filterResult   (result, pkg.failed   )
    const trackd_invalid = filterTaggedREs(trackd, re=>!re.valid)

    expect(result_invalid.sort()).toEqual(trackd_invalid.sort())
  })

  test.prop([arb])('about valid REs', async (tracked) => {
    const result = await validationResult(tracked)
    const trackd = tracked.REtracker
    const result_valid = filterResult   (result, pkg.passed   )
    const trackd_valid = filterTaggedREs(trackd, re=>re.valid)

    expect(result_valid.sort()).toEqual(trackd_valid.sort())
  })
})



function filterResult(
  result: pkg.LocatedRegexResult[],
  filter: (r: pkg.LocatedRegexResult) => boolean
): string[] {
  return result.filter(filter).map(r=>r.rgx)
}

function filterTaggedREs(
  taggedREs: TaggedRE[],
  filter   : (r: TaggedRE) => boolean
): string[] {
  return taggedREs.filter(filter).map(r=>r.re)
}





// two different ways to force failing tests, for debugging:
const dbgDemoFailingTest = false
const dbgInjectTestfail  = false

// for one of the tests, the last generated grammar can be dumped to a file:
const dbgDump = {
  enable: false,
  path: join('.aux', 'dump.tmLanguage.json'),
}

if (dbgDump.enable || dbgInjectTestfail) {
  describe('(debug dump/fail injection)', () => {
    const cfg = {verbose:fc.VerbosityLevel.VeryVerbose}
    const dumpIt = ( () => obj2file(curGrammar, dbgDump.path) )

    let curGrammar: Grammar | null = null

    afterAll(() => { if (dbgDump.enable) { dumpIt() }});

    test.prop([gr.deep.arb], cfg)('deep', async (gg) => {
      if (dbgDump.enable)    { curGrammar = gg.grammar }
      if (dbgInjectTestfail) { expect(gg.grammar.patterns.length).toBe(0); }
      await prop_passing(gg);
    });
  });
}

if (dbgDemoFailingTest) {
  describe('(debug demo failing)', () => {
    test.prop([gr.deep.arb])('DEMO: shrinking (failing test)', (gg) => {
      expect(gg.grammar.patterns.length).toBe(0);
    });
  });
}
