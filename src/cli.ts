#!/usr/bin/env node

import process from 'node:process'
import arg from 'arg'
import * as pkgJson from './pkgJson.js'
import { failed, printResult, validateGrammar } from './tmgrammar-validate.js'

const spec = {
  '--non-compact': Boolean  ,
  '--compact'    : Boolean  , '-c': '--compact',
  '--verbose'    : arg.COUNT, '-v': '--verbose',
  '--version'    : Boolean  , '-V': '--version',
  '--help'       : Boolean  , '-h': '--help'   ,
  '--is-bundled' : Boolean  , // don't document; for testing
} as const

const helpText = `
Usage:
  textmate-validate [options] <grammar>

Description:
  Validate the regexes of a TextMate grammar.

  Unless -v/--verbose is used, nothing is printed to the terminal.

Exit status:
  0  validation passed (all found regexes are valid)
  1  validation failed (at least one found regex is invalid)

Options:
  --non-compact    force non-compact output (default if stdout is a TTY)
  -c, --compact    force compact output (default if stdout is not a TTY)
  -v, --verbose    verbose (-vv for more verbose)
  -V, --version    show version
  -h, --help       show help
`

async function main() {
  const args = arg(spec)

  if (args['--help']) {
    console.log(helpText)
    process.exit(0)
  }

  if (args['--version']) {
    console.log(`${await pkgJson.nameWithoutScope()} ${await pkgJson.version()}`)
    process.exit(0)
  }

  if (args['--is-bundled']) {
    if (pkgJson.isBundled()) {
      console.log('true')
      process.exit(0)
    } else {
      console.log('false')
      process.exit(1)
    }
  }

  const verbosity = clamp(args['--verbose'] ?? 0, [0,1,2] as const)
  const isCompact = getIsCompact(args)

  const [grammarFile] = args._
  if (!grammarFile) {
    console.error('error: grammar file required')
    process.exit(1)
  }

  const res = await validateGrammar({ kind: 'path', value: grammarFile })
  printResult(res, verbosity, isCompact)
  if (failed(res)) { process.exit(1) }
  process.exit(0)

}

main().catch(console.error)


function getIsCompact(args: arg.Result<typeof spec>): boolean {
  if (args['--compact']      ) return true
  if (args['--non-compact']  ) return false
  if (process.env.NO_COLOR   ) return true
  if (process.env.NOCOLOR    ) return true
  if (process.env.FORCE_COLOR) return false
  return !process.stdout.isTTY
}

function clamp<T extends readonly number[]>(v: number, allowed: T): T[number] {
  const min = Math.min(...allowed)
  const max = Math.max(...allowed)
  return Math.max(min, Math.min(v, max)) as T[number]
}
