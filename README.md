# `textmate-validate`

Validation of VSCode TextMate grammars.

Links:
* github: [`carlwr/textmate-validate`](https://github.com/carlwr/textmate-validate)
* npm: [`@carlwr/textmate-validate`](https://www.npmjs.com/package/@carlwr/textmate-validate)

## Overview

The following examples use an example grammar `grammar.json` that can be created with this shell command:

```bash
cat >grammar.json <<EOF

{ "patterns": [
    { "match": ".*" },       `# <- a valid regex`
    { "match": ".)" }        `# <- INVALID REGEX!`
  ]
}

EOF
```

### CLI

Prerequisites: none; `npx` will fetch the package from npm on-the-fly

Example:
```bash
npx @carlwr/textmate-validate grammar.json || echo "failed!"
  # failed!

npx @carlwr/textmate-validate --verbose --verbose grammar.json
  # [INFO] number of regexes:
  #   total:    2
  #   valid:    1
  #   invalid:  1
  #
  # [INFO] valid regex:
  #   regex:    .*
  #   path:     patterns[0].match
  #
  # [ERROR] invalid regex:
  #   error:    unmatched close parenthesis
  #   regex:    .)
  #   path:     patterns[1].match
  #
  # [ERROR] validation failed

npx @carlwr/textmate-validate --help  # show help

```

<!-- test:
# (first run command above to create grammar.json)
pnpm tsx src/cli.ts --verbose --verbose grammar.json
-->

### Library

Prerequisites: `npm install @carlwr/textmate-validate`

Example:
```typescript
import { validateGrammar, passed, failed, printResult } from '@carlwr/textmate-validate'

const result = await validateGrammar('grammar.json')

passed(result)  // false
failed(result)  // true

const verbosity = 2
printResult(result, verbosity)  // same as the CLI output above

JSON.stringify(result, null, 2)
  // [
  //   {
  //     "rgx": ".*",
  //     "loc": "patterns[0].match",
  //     "valid": true
  //   },
  //   {
  //     "rgx": ".)",
  //     "loc": "patterns[1].match",
  //     "valid": false,
  //     "err": "unmatched close parenthesis"
  //   }
  // ]

```

<!-- test:
# (with the code excl. the import statement in the clipboard):
mkdir -p .aux
>.aux/r.ts cat <<<"import { validateGrammar, passed, failed, printResult } from '../src/index.js'"
>>.aux/r.ts pbpaste && pnpm tsx .aux/r.ts
-->

## What?

For a given TextMate grammar, the regexes in it are extracted and then validated.

Validation is done by exercising each regex with the Oniguruma regex engine, which is what VSCode uses.

## How?

Extracting the regexes:
- a simple but robust custom parser is used
- parsing errors are not reported (since it is beyond the scope of this package to reliably detect them)
- ...the parsing strategy can be summarized as _parse what we can, ignore anything else_

Validating the extracted regexes:
- each regex is exercised with the Oniguruma engine
- if Oniguruma doesn't complain, the regex is considered valid
- if Oniguruma complains, the regex is considered invalid
- the error strings this package reports are those produced by Oniguruma

Oniguruma engine:
- the package uses the Oniguruma WASM binary of [vscode-oniguruma]
- this is a design decision and comes with benefits and drawbacks:
  - benefit: validation accuracy:
    - validation is done with the same library (e.g. compiled with the same compilation flags) that will be used by VSCode when the grammar is used at later points
  - drawback: fragility:
    - this package must use heuristics to dynamically locate the path of the `onig.wasm` file that [vscode-oniguruma] includes
    - the heuristics used are well tested and e.g. symlinked paths will be followed - but could likely fail for less common setups

## Intended use

The package is intended to be used as a validation check for generated or hand-written TextMate grammars for VSCode, typically as part of a build script, CI pipeline, prepublish `package.json` lifecycle hook, etc. It complements the following that are also useful in a similar context:

- schema validation
  - using e.g. the [tmlanguage.json] schema - which VSCode does not officially conform to, but is likely yet useful
  - note that schema validation serves the purpose of checking the _structure_ of the grammar, something this package does not do
- testing
  - [vscode-tmgrammar-test] can be used for testing how a grammar assigns scopes for a set of test cases

[vscode-textmate]: https://github.com/microsoft/vscode-textmate
[vscode-oniguruma]: https://github.com/microsoft/vscode-oniguruma
[tmlanguage.json]: https://json.schemastore.org/tmlanguage.json
[vscode-tmgrammar-test]: https://github.com/PanAeon/vscode-tmgrammar-test
[ajv]: https://github.com/ajv-validator/ajv