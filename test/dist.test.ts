import { access  } from 'node:fs/promises'
import { join } from 'node:path'
import { rm_rf } from '@carlwr/typescript-extra'
import { describe, expect, it } from 'vitest'
import { runCmd } from './helpers/runCmd.js'
import { node } from './helpers/testUtils.js'


const GRAMMAR = join('test', 'fixtures', 'grammar.json')
const aux = '.aux'


describe.concurrent('@dist prod-build', it_buildsAndValidates('build'    ))
describe.concurrent('@dist dev-build' , it_buildsAndValidates('build:dev'))


function it_buildsAndValidates(script: string) {
  return async () => {
    const dir = join(aux, `dist_${script}`)
    const cli_js   = join(dir, 'cli.js'  )
    const index_js = join(dir, 'index.js')
    const buildCmd    = ['pnpm', script, '--out', dir]         as const
    const validateCmd = ['node', join(dir, 'cli.js'), GRAMMAR] as const
    await rm_rf(dir)

    it.sequential('builds', async () => {
      const result = await runCmd(buildCmd)
      expect(result.stderr  ).toBe('')
      expect(result.exitCode).toBe(0)
      await expect(access(cli_js  )).resolves.not.toThrow()
      await expect(access(index_js)).resolves.not.toThrow()
    })

    it.concurrent.each(['--help', '--version'])('prints %s', async (arg) => {
      const result = await runCmd([node,cli_js, arg])
      expect(result.stdout).toMatch(/textmate-validate/)
    })

    it.concurrent('validates', async () => {
      const result = await runCmd(validateCmd)
      expect(result.stderr  ).toBe('')
      expect(result.exitCode).toBe(0)
    })
  }
}
