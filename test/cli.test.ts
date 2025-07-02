import { join } from 'node:path'
import process from 'node:process'
import { it, test } from '@fast-check/vitest'
import { execa } from 'execa'
import { describe, expect } from 'vitest'
import * as gr from './generators/grammar.js'
import { tsx, writeJsonFile } from './helpers/testUtils.js'


const EXAMPLE_GRAMMAR = join('test', 'fixtures', 'grammar.json')

const aux = '.aux'
const tempDir = join(aux, 'cli-tests')

describe.concurrent('CLI', () => {

  it.concurrent('--is-bundled', async () => {
    const {stdout} = await execa(tsx,['src/cli.ts','--is-bundled'], {reject: false})
    expect(stdout).toMatch(/false/)
  })

  it.concurrent('--help', async () => {
    const {stdout} = await run(['--help'])
    expect(stdout).not.toEqual('')
  })

  it.concurrent('--version', async () => {
    const {stdout} = await run(['--version'])
    expect(stdout).toMatch(/textmate-validate/)
  })

  it.concurrent('validation: the example .json grammar', async () => {
    const res = await run([EXAMPLE_GRAMMAR])
    expect(res.exitCode).toBe(0)
    expect(res.stderr  ).toBe('')
  })

  test.concurrent.prop([gr.simple.arb], {numRuns: 1})(
    `validation: property test: ${gr.simple.name}`,
    async ({grammar}) => {

      const file = nextFile('simple')
      await writeJsonFile(grammar, file)

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
    }
  )

  test.concurrent.prop([gr.withInvalid.arb], {numRuns: 1})(
    `validation: property test: ${gr.withInvalid.name}`,
    async ({grammar,REtracker}) => {

      const file = nextFile('invalid')
      await writeJsonFile(grammar, file)

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
    }
  )

})


function nextFile(prefix: string): string {
  return join(tempDir, `${prefix}-${process.hrtime.bigint()}.json`)
}

function run(args: [string, ...string[]]) {
  return execa(tsx, ['src/cli.ts', ...args], {reject: false})
}
