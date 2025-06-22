/*
implementation note:

  core logic for validating VS Code textmate grammars

  the core of the validation is finding the regexes in a textMate grammar file and exercising the oniguruma regexes.

  principle: use the oniguruma .wasm binary from the vscode-oniguruma package to validate regexes - this is what vscode uses, so for validation to be as accurate as possible, we want to use the same regex engine, as far as possible.

  implementation notes:
  - using the .wasm binary from the vscode-oniguruma package requires a bit of a hack - we use a heuristic to find the compiled .wasm binary that is included with the vscode-oniguruma package.
*/

import { mapAsync, memoized } from '@carlwr/typescript-extra';
import type * as vscTM from 'vscode-textmate';
import { getVscOnigFixed } from './onig/index.js';
import { getOnigWasmPath } from './onig/wasmPath.js';
import { getGrammarRegexes } from './parseTM.js';

export type { GrammarSource, LocatedRegex, LocatedRegexResult, Regex, RegexResult, GrammarResult, Reporter }
export { validateGrammar, validateRegex, getWasmPath, printResult, failed, passed, reportResult, makeConsoleReporter }

const loadOnigWasm = memoized(getVscOnigFixed);


/**
 * The grammar to be validated.
 */
type GrammarSource =
  | string // a path
  | { kind: "path"; value: string|URL        }
  | { kind: "str" ; value: string            }
  | { kind: "raw" ; value: vscTM.IRawGrammar }

/**
 * A single regex, represented by a string.
 */
type Regex = string

/**
 * A single regex, along with its location in the grammar.
 */
interface LocatedRegex {
  rgx: Regex
  loc: string
}

/**
 * The result of validating a single regex.
 *
 * A value of this type can be tested with the {@link passed} and {@link failed} functions. In addition to returning a boolean they will narrow the type of the value.
 */
type RegexResult =
  | { valid: false; err: string }
  | { valid: true }

/**
 * The result of validating a single regex that has a location in a grammar.
 */
type LocatedRegexResult = LocatedRegex & RegexResult

/**
 * The result of validating a grammar.
 */
type GrammarResult = LocatedRegexResult[]

/* implementation notes on RegexResult, GrammarResult:
- in order to keep these exposed types simple, choose not to brand them
- passed() and failed() are polymorphic over these two types; lacking brands, use `isArray` to discriminate between them
*/

/**
 * Validate a single regex. Return a value describing the result of the validation.
 */
async function
validateRegex(re: Regex): Promise<RegexResult> {
  const onigLib = await loadOnigWasm();
  try { onigLib.createOnigScanner([re]) }
  catch (error) {
    const err = error instanceof Error
      ? error.message
      : String(error)
    return { valid: false, err }
  }
  return { valid: true }
}

/**
 * Validate a grammar by extracting its regexes and then validating each. Return a value describing the result of the validation.
 */
async function
validateGrammar(source: GrammarSource): Promise<GrammarResult> {
  const regexes = getGrammarRegexes(source)
  const result = mapAsync(regexes, validateGrammarRegex)
  return result
}

// types to simplify expressing the type-guards in the functions below
type FailedRegxRes   = Extract<RegexResult,{valid:false}>
type PassedRegxRes   = Extract<RegexResult,{valid:true }>
type FailedGramRes = (LocatedRegex & FailedRegxRes)[]
type PassedGramRes = (LocatedRegex & PassedRegxRes)[]

/* implementation note re. failed(), passed():
- choose to use single functions, polymorphic over `GrammarResult|RegexResult`, rather than separate functions for each type -> smaller+simpler API surface
*/

/**
 * Whether a validation result indicates that the validation failed.
*
* In addition to returning a boolean, the function narrows the type of the argument.
*/
function failed(r:RegexResult              ):r is FailedRegxRes
function failed(r:GrammarResult            ):r is FailedGramRes
function failed(r:RegexResult|GrammarResult):boolean {
  if (isGrammarResult(r))
    return r.some(item => !item.valid)
  return !r.valid
}

/**
 * Whether a validation result indicates that the validation passed.
*
* In addition to returning a boolean, the function narrows the type of the argument.
*/
function passed(r: RegexResult              ): r is PassedRegxRes
function passed(r: GrammarResult            ): r is PassedGramRes
function passed(r: RegexResult|GrammarResult): boolean {
  if (isGrammarResult(r))
    return r.every(item => item.valid)
  return r.valid
}

function isGrammarResult(r: GrammarResult|RegexResult): r is GrammarResult {
  return Array.isArray(r)
}

async function validateGrammarRegex(re: LocatedRegex): Promise<LocatedRegexResult> {
  return {
    ...re,
    ...(await validateRegex(re.rgx)),
  }
}

/**
 * The detected path of the `onig.wasm` file. Throws an error if not found.
 */
function getWasmPath(): string {
  return getOnigWasmPath();
}

/**
 * A reporter for validation results.
 *
 * Each field specifies a string sink. `out` is for messages, `err` is for errors; the number indicates the verbosity level.
 */
interface Reporter {
  out1: (s: string) => void
  out2: (s: string) => void
  err1: (s: string) => void
}

/**
 * Make a reporter that prints to the console. Messages up to and including the given verbosity level are printed. Currently, verbosity level 0 will print nothing.
 */
function makeConsoleReporter(
  verbosity: 0|1|2,
  out: (s: string) => void = console.log,
  err: (s: string) => void = console.error,
): Reporter {
  const nil = (_s: string) => {};
  return (
    verbosity===0 ? { out1: nil, out2: nil, err1: nil } :
    verbosity===1 ? { out1: out, out2: nil, err1: err } :
    verbosity===2 ? { out1: out, out2: out, err1: err } :
    ((_: never) => { throw new Error('unhandled') })(verbosity)
  )
}

interface Formatter {
  message: (tag: string, message: string                 ) => string
  group  : (tag: string, subject: string, items: [string, string][]) => string
  // item   : ([k,v]: [string, string]) => string
}

function nonCompactFormatter(): Formatter {
  const fmtItem = ([k,v]: [string, string]) => `  ${k.padEnd(9)} ${v}\n`;
  const fmtItems = (items: [string, string][]) => items.map(fmtItem).join('');
  return {
    message: (tag,message)       => `[${tag}] ${message}\n`,
    group:   (tag,subject,items) => `[${tag}] ${subject}\n${fmtItems(items)}`
  }
}

function compactFormatter(): Formatter {
  const fmtItem = ([k,v]: [string, string]) => `${k} ${v}`;
  const fmtItems = (items: [string, string][]) => `${items.map(fmtItem).join(', ')}`
  return {
    message: (tag,message)       => `[${tag}] ${message}\n`,
    group:   (tag,subject,items) => `[${tag}] ${subject} (${fmtItems(items)})`
  }
}


/**
 * Print the result of validating a grammar. Messages up to and including the given verbosity level are printed. Currently, verbosity level 0 will print nothing.
 */
function printResult(result: GrammarResult, verbosity: 0|1|2, compact: boolean): void {
  const reporter = makeConsoleReporter(verbosity)
  const formatter = compact ? compactFormatter() : nonCompactFormatter()
  reportResult(result, reporter, formatter)
}

/**
 * Report the result of validating a grammar.
 */
function reportResult(result: GrammarResult, rep: Reporter, fmt: Formatter): void {

  const invalid = result.filter(r => !r.valid)
  const valid   = result.filter(r =>  r.valid)

  rep.out1(fmt.group("INFO", "number of regexes:",
    [["total:",   `${result.length}`],
     ["valid:",   `${valid.length}`],
     ["invalid:", `${invalid.length}`]]))

  valid.forEach(e => {
    rep.out2(fmt.group("INFO", "valid regex:",
      [["regex:", `${e.rgx}`],
       ["path:",  `${e.loc}`]]))
  })

  invalid.forEach(e => {
    rep.err1(fmt.group("ERROR", "invalid regex:",
      [["error:", `${e.err}`],
       ["regex:", `${e.rgx}`],
       ["path:",  `${e.loc}`]]))
  });

  (invalid.length > 0)
    ? rep.err1(fmt.message("ERROR", 'validation failed'))
    : rep.out1(fmt.message("INFO" , 'validation passed'))

}
