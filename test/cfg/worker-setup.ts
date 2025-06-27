import { fc } from '@fast-check/vitest'

// this file is configured to run per-worker thread - fc.configureGlobal() must be invoked from this file

fc.configureGlobal({
  seed: 1,
  verbose: fc.VerbosityLevel.None,
})
