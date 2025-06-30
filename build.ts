#!/usr/bin/env node

import arg from 'arg'
import { build } from 'tsup'
import { getValuesObj } from './src/pkgJson.js'

const spec = {
  '-q': Boolean,
  '--dev': Boolean,
  '--out': String,
}

async function buildProject() {
  const args = arg(spec)
  const isQuiet = args['-q'] ?? false
  const isDev = args['--dev'] ?? false
  const outDir  = args['--out'] ?? 'dist'

  await build({
    entry: {
      'cli': 'src/cli.ts',
      'index': 'src/index.ts'
    },
    format: ['esm'],
    dts: true,
    sourcemap: true,
    clean: true,
    minify: !isDev,
    outDir: outDir,
    silent: isQuiet,
    onSuccess: `echo 'DONE: tsup: built to "${outDir}/".'`,
    define: {
      '__BUNDLED_PKGJSON_VALUES__': JSON.stringify(await getValuesObj()),
    },
  })

}

buildProject().catch(console.error)
