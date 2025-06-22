import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { runCmd } from './helpers/runCmd.js'


const GRAMMAR = join('test', 'fixtures', 'grammar.json')
const aux = '.aux'

describe('@dist', () => {
  describe('prod-build', it_buildsAndValidates('build')    )
  describe(' dev-build', it_buildsAndValidates('build:dev'))
})

function it_buildsAndValidates(script: string) {
  return () => {
    const dir = join(aux, `dist_${script}`)
    const buildCmd    = ['pnpm', script, '--out', dir]         as const
    const validateCmd = ['node', join(dir, 'cli.js'), GRAMMAR] as const

    it('builds', async () => {
      const result = await runCmd(buildCmd)
      expect(result.stderr).toBe('')
      expect(result.exitCode).toBe(0)
      expect(join(dir, 'cli.js'  )).toSatisfy(existsSync)
      expect(join(dir, 'index.js')).toSatisfy(existsSync)
    })

    it('validates', validates(validateCmd))
  }
}

function validates(cmd: readonly [string, ...string[]]) {
  return async () => {
    const result = await runCmd(cmd)
    expect(result.stderr).toBe('')
    expect(result.exitCode).toBe(0)
  }
}
