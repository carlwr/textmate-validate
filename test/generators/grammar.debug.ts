import { fc } from '@fast-check/vitest'
import arg from 'arg'
import * as grammar from './grammar.js'

const DEFAULT_SAMPLES = 20
const DEFAULT_SEED    = 1
const ARB             = grammar.deep.arb

const argSpec = {
  '-n': Number,
  '-s': Number,
}
const args = arg(argSpec, { permissive: true })

const samples = args['-n'] || DEFAULT_SAMPLES
const seed    = args['-s'] || DEFAULT_SEED

type Params = fc.Parameters<grammar.Tracked>

if (import.meta.url.endsWith('grammar.debug.ts')) {

  const params: Params = {
    numRuns: samples,
    seed   : seed
  }
  const grammars = fc.sample(ARB, params)
  const json = JSON.stringify(grammars, null, 2)
  console.log(json)

}
