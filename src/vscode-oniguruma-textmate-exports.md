(The issue described for `vscode-oniguruma` below seemingly holds also for `vscode-textmate`.)

how `vscode-oniguruma` is seen to be exporting members (e.g. `loadWASM`):
- **tsx**: directly (ESM behavior)
- **tsup**: on the `.default` property (CJS-like behavior)

root cause:
- not fully determined, but seemingly `vscode-oniguruma` has some deficiency/inconsistency in its `.d.ts`-declared exports.


## solution/workaround

- detect which export pattern is being used and adapt accordingly
- dynamic detection is an attempt to future-proof the solution

alternative approaches considered and rejected:
- modifying tsup configuration
  - attempted but couldn't resolve the module export issue
- using static imports
  - doesn't work due to WASM loading requirements (?)


## (old code comment)

NOTE about using the 'vscode-textmate' import:
use...
  vscTM.default.<member>    ...for runtime
  vscTM.<Type>              ...for types (for TypeScript/eslint)

details, background:
  - (the below is probably true for both vscode-textmate and vscode-oniguruma)
  - for this/these packages, there is seemingly some deficiency in how the module interface is exported and/or how the .d.ts files are generated - in a way that can cause a runtime TypeError although `tsc --noEmit` and eslint is happy.
