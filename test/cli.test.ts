import { join } from 'node:path'
import process from 'node:process'
import { it, test } from '@fast-check/vitest'
import { describe, expect } from 'vitest'
import * as gr from './generators/grammar.js'
import { runCmd } from './helpers/runCmd.js'
import { obj2file } from './helpers/testUtils.js'


const EXAMPLE_GRAMMAR = join('test', 'fixtures', 'grammar.json')

const aux = '.aux'
const tempDir = join(aux, 'cli-tests')

// important: total runtime for this test file should be max approx. 1 sec.
// unclear why, but the below tests do not run fully in parallell

describe.concurrent('with the example .json grammar', async() => {
  it.concurrent(
    'validates',
    validates(['pnpm', 'tsx', 'src/cli.ts', EXAMPLE_GRAMMAR])
  )
})

describe.concurrent('property', async() => {

  test.concurrent.prop
    ([gr.simple.arb], {numRuns: 1})
    (gr.simple.name, async ({grammar}) => {

    const file = nextFile('simple')
    obj2file(grammar, file)

    const [r0, r1, r2 ] = await Promise.all([
      run([       file]),
      run(['-v' , file]),
      run(['-vv', file])
    ])

    // the command has exit code 0
    expect(r0.exitCode).toEqual(0)
    expect(r1.exitCode).toEqual(0)
    expect(r2.exitCode).toEqual(0)

    // stdout: empty for verbosity=0
    expect(r0.stdout).toEqual('')

    // stdout: not empty for verbosity=1+2
    expect(r1.stdout).not.toEqual('')
    expect(r2.stdout).not.toEqual('')

    // stderr: empty, regardless of verbosity
    expect(r0.stderr).toEqual('')
    expect(r1.stderr).toEqual('')
    expect(r2.stderr).toEqual('')
  })

})


describe.concurrent('property', async () => {

  test.concurrent.prop
    ([gr.withInvalid.arb], {numRuns: 1})
    (gr.withInvalid.name, async ({grammar,REtracker}) => {

    const file = nextFile('invalid')
    obj2file(grammar, file)

    const invalidREs = REtracker.filter(gr.isInvalidRE).map(gr.stripTag)

    const [r0, r1, r2] = await Promise.all([
      run([       file]),
      run(['-v' , file]),
      run(['-vv', file])
    ])

    // the command has exit code 1
    expect(r0.exitCode).toEqual(1)
    expect(r1.exitCode).toEqual(1)
    expect(r2.exitCode).toEqual(1)

    // stdout, stderr: empty for verbosity=0
    expect(r0.stdout).toEqual('')
    expect(r0.stderr).toEqual('')

    // stderr: not empty for verbosity=1+2
    expect(r1.stderr).not.toEqual('')
    expect(r2.stderr).not.toEqual('')

    // all invalid REs in stderr at verbosity=2:
    for (const re of invalidREs) {
      expect(r2.stderr).toContain(re)
    }
  })
})


function nextFile(prefix: string): string {
  return join(tempDir, `${prefix}-${process.hrtime.bigint()}.json`)
}

function validates(cmd: readonly [string, ...string[]]) {
  return async () => {
    const result = await runCmd(cmd)
    expect(result.stderr).toEqual('')
    expect(result.exitCode).toEqual(0)
  }
}

function run(args: [string, ...string[]]) {
  return runCmd(['pnpm', 'tsx', 'src/cli.ts', ...args])
}
