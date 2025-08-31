# `textmate-validate`

[![docs](https://github.com/carlwr/textmate-validate/actions/workflows/docs.yaml/badge.svg)](https://github.com/carlwr/textmate-validate/actions/workflows/docs.yaml)

Validation of VSCode TextMate grammars.

Links:
* API docs: [carlwr.github.io/textmate-validate](https://carlwr.github.io/textmate-validate)
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
  - [vscode-tmgrammar-test] can be used for testing how a grammar assigns scopes for a set of test cases (test file syntax: see [_SublimeText testing syntax documentation_][sublimetext-testing])


## Useful links on TextMate grammars

General:
* [_Building a syntax highlighting extension for VS Code_][borama-blog] (blog, `borama`)
* [_Writing a TextMate Grammar: Some Lessons Learned_][apeth-blog] (blog, `apeth` 2014)
* `*.md` files in [`documentation/`][RedCMD-tm] of `RedCMD/TmLanguage-Syntax-Highlighter`

From Macromates:
* [_12 Language Grammars_][macromates-ch12] (docs)
  * including [_12.4 \[Scope\] Naming Conventions_][macromates-ch12.4]
* [_13. Scope Selectors_][macromates-ch13] (docs)
* [_Introduction to scopes_][macromates-blog] (blog)
* (note: not VS Code-specific)


### Per-topic

TextMate grammar data model and structure:
* [`apeth`s blog][apeth-blog]
* [`rawGrammar.ts`][vsc-tm-rules-src] of `microsoft/vscode-textmate`
  * i.e. from the actual VS Code textMate grammar parsing source code
  * the interface `IRawGrammar` is the entry-point/top-level type
* [`documentation/rules.md`][RedCMD-tm-rules] of `RedCMD/TmLanguage-Syntax-Highlighter`

Scope selectors:
* [_Optimizations in Syntax Highlighting_][vsc-blog], [\[archived\]][vsc-blog-archived] (VS Code official blog, Alexandru Dima 2017)
  * includes details on ranking in case of multiple matching selectors
* [_13. Scope Selectors_][macromates-ch13] (Macromate docs)

Scope naming conventions:
* [_Scope naming_][sublimetext-naming] (SublimeText docs)
* [_12.4 \[Scope\] Naming Conventions_][macromates-ch12.4] (Macromate docs)
* [`apeth`s blog][apeth-blog], section _Standard Scopes_
  * comprehensive, and includes actual use by common themes

References:
* [_More Links_][RedCMD-tm-refs] section of `documentation/README.md` of `RedCMD/TmLanguage-Syntax-Highlighter`


[vscode-textmate]: https://github.com/microsoft/vscode-textmate
[vscode-oniguruma]: https://github.com/microsoft/vscode-oniguruma
[tmlanguage.json]: https://json.schemastore.org/tmlanguage.json
[vscode-tmgrammar-test]: https://github.com/PanAeon/vscode-tmgrammar-test
[ajv]: https://github.com/ajv-validator/ajv

[vsc-tm-rules-src]: https://github.com/microsoft/vscode-textmate/blob/main/src/rawGrammar.ts
[vsc-blog]: https://code.visualstudio.com/blogs/2017/02/08/syntax-highlighting-optimizations
[vsc-blog-archived]: https://web.archive.org/web/20250720095218/https://code.visualstudio.com/blogs/2017/02/08/syntax-highlighting-optimizations

[borama-blog]: https://dev.to/borama/building-a-syntax-highlighting-extension-for-vs-code-594?utm_source=shortruby&ref=shortruby.com
[apeth-blog]: https://www.apeth.com/nonblog/stories/textmatebundle.html

[macromates-ch12]: https://macromates.com/manual/en/language_grammars
[macromates-ch12.4]: https://manual.macromates.com/en/language_grammars#naming_conventions
[macromates-ch13]: https://macromates.com/manual/en/scope_selectors
[macromates-blog]: https://macromates.com/blog/2005/introduction-to-scopes/

[sublimetext-testing]: https://www.sublimetext.com/docs/syntax.html#testing
[sublimetext-naming]: https://www.sublimetext.com/docs/scope_naming.html

[RedCMD-tm]: https://github.com/RedCMD/TmLanguage-Syntax-Highlighter/blob/main/documentation
[RedCMD-tm-rules]: https://github.com/RedCMD/TmLanguage-Syntax-Highlighter/blob/main/documentation/rules.md
[RedCMD-tm-refs]: https://github.com/RedCMD/TmLanguage-Syntax-Highlighter/blob/main/documentation/README.md#more-links
