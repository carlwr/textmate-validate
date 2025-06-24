import { readFileSync } from 'node:fs'
import type { Assert, Eq } from '@carlwr/typescript-extra'
import { hasKey, isNonEmpty, isSingle } from '@carlwr/typescript-extra'
import type { GrammarSource, LocatedRegex, Regex } from './tmgrammar-validate.js'

export function getGrammarRegexes(source: GrammarSource): LocatedRegex[] {
  return grammar2regexes(getGrammarString(source)).map(pathed2located)
}

function getGrammarString(source: GrammarSource): unknown {
  const sourceObj = typeof source === 'string'
    ? { kind: 'path', value: source }
    : source

  switch (sourceObj.kind) {
    case "path": return JSON.parse(readFileSync(sourceObj.value, 'utf8'))
    case "str":  return JSON.parse(sourceObj.value.toString())
    case "raw":  return sourceObj.value
    default:     throw new Error(`unexpected source kind: ${sourceObj.kind}`)
  }
}


/*
 extract a flat list of regexes from a user grammar string

 parsing strategy:
 - since this is an object from the wild, make no assumptions on its structure being correct without checking it at runtime while we parse
 - we keep ourselves honest by typing everything as unknown until checks has informed us otherwise
 - make a best-effort at extracting the regexes: for those substructures that match a valid grammar, extract the regexes; for others, do nothing

ref. on expected structure:
  https://github.com/microsoft/vscode-textmate/blob/main/src/rawGrammar.ts

choice of implementation:
- functional-style recursive tree traversal
- use pure, fully curried functions
- why? -> mostly for the sake of experimenting with this particular style in TypeScript
- note: the recursion is not tail-recursive - and it wouldn't make a difference since none of the common runtimes do tail-call optimization; an imperative implementation with mutation would be more efficient; given the limited size of textMate grammars this is likely not of practical concern in this specific case

*/

// the path of a regex within a grammar is tracked

type PathPart  = string|number
type Path      = PathPart[]

interface PathedRgx {
  pth: PathPart[]
  rgx: Regex
}

const addPathPart = (comp: PathPart) => ({pth,rgx}: PathedRgx): PathedRgx =>
  ({ pth: [comp,...pth], rgx })

/**
 * Convert a location array to a string.
 *
 * @example
 * const loc = ['repository','aRule','endCaptures','1','patterns',0,'match']
 * loc2str(loc) // repository.aRule.endCaptures.1.patterns[0].match
 */
function path2str(path: Path): string {
  const part2str = (part: PathPart): string =>
      typeof part === 'number' ? `[${part}]`
    : typeof part === 'string' ? `.${part}`
    : ((_: never) => '')(part)
  if (!isNonEmpty(path)) return ''
  if ( isSingle  (path)) return path.toString()
  const [l0,...rest] = path
  return [
    l0,
    ...rest.map(part2str)
  ].join('')
}

function pathed2located({pth,rgx}: PathedRgx): LocatedRegex {
  return { rgx, loc: path2str(pth) }
}


// parsing:

const patternKeys = ['patterns']
const repoKeys    = ['repository']
const regexKeys   = ['match', 'begin', 'end', 'while']
const captureKeys = ['captures','beginCaptures','endCaptures','whileCaptures']

/**
 * The type of the function that will be called for each substructure we encounter. Such a function is responsible for continuing to invoke functions that descend into substructures until either a leaf node is reached or until no further substructures can be meaningfully parsed.
 */
type Go = (obj: unknown) => PathedRgx[]

/**
 * patch a function so that it additionally takes a path component which is then added to the path of the regexes it returns.
 */
function patchPath(
  fn: Go
): ([pp,o]:[PathPart,unknown]) => PathedRgx[] {
  return ([pp,o]) => fn(o).map(addPathPart(pp))
}

/**
 * if the object has the given key, apply the function to the value of the key
 */
const applyIfKey =
  (obj : unknown) =>
  (fn  : Go) =>
  (key : string):
  PathedRgx[] =>
  hasKey(obj, key)
    ? fn(obj[key]).map(addPathPart(key))
    : []

/**
 * if the object is a plain object, flatmap over its values
 */
const mapValues =
  (fn : Go) =>
  (obj: unknown):
  PathedRgx[] =>
  mapObjectEntries(patchPath(fn))(obj)

/**
 * if the object is an array, flatmap over its elements
 */
const mapElements =
  (fn : Go) =>
  (obj: unknown):
  PathedRgx[] =>
  mapArrayElements(patchPath(fn))(obj)

// entry-point:
const grammar2regexes = (obj: unknown) =>
  [
    ...applyIfKey(obj)(go_repo_captures)('repository'),
    ...applyIfKey(obj)(go_patterns     )('patterns' as const),
  ]

// go_* mutually recursive functions:
const go_rule = (obj: unknown) =>
  [
    ...repoKeys   .flatMap(applyIfKey(obj)(go_repo_captures)),
    ...captureKeys.flatMap(applyIfKey(obj)(go_repo_captures)),
    ...patternKeys.flatMap(applyIfKey(obj)(go_patterns     )),
    ...regexKeys  .flatMap(applyIfKey(obj)(asRegexLeaf     )),
  ]
const go_repo_captures = mapValues  (go_rule)
const go_patterns      = mapElements(go_rule)

// base case:
const asRegexLeaf = (obj: unknown) =>
  typeof obj === 'string'
    ? [ {pth:[],rgx:obj} ]
    : []


go_rule          satisfies Go
go_repo_captures satisfies Go
go_patterns      satisfies Go
asRegexLeaf      satisfies Go


// generic helpers:

/**
 * If the object is a plain object, flatmap over its entries, otherwise return [].
 */
const mapObjectEntries = <U>
  (fn : ([k,v]:[string,unknown]) => U[]) =>
  (obj: unknown)
  : U[] =>
  isObjectLike(obj) ? Object.entries(obj).flatMap(fn) : []

/**
 * If the object is an array, flatmap over its elements, otherwise return [].
 *
 * Allowed generic types: see {@link MaybeArrayOf}; in short: if types are more explicit than `any` or `unknown`, then only types guaranteeing that the mapping function can be safely called are allowed.
 *
 * note: the argument of the mapping function takes a [key,elem]-like tuple, with key = array index, which is different from the mapping functions of the built-in array methods.
 */
const mapArrayElements = <U,E>(
  fn: ([i,e]: [number,E]) => U[]
) => <T>(
  obj: MaybeArrayOf<T,E>
): U[] =>
  Array.isArray(obj)
    ? obj.flatMap((e,i) => fn([i,e]))
    : []

function isObjectLike<T>(obj: T): obj is NonNullable<T> {
  return (
        typeof obj === 'object'
    && obj !== null
    && !Array.isArray(obj)
  )
}

/**
 * A generic that evaluates to `T` or `never` depending on `T` and `E`.
 *
 * Evaluate to `never` if (all of):
 * - T is an array
 * - its elements are not E
 * - E is not `unknown` or `any`
 *
 * In all other cases, evaluate to `T`.
 *
 */
type MaybeArrayOf<T,E> =
  [ IsArrayOf<T,unknown>,
    IsUnknown<E>,
    IsArrayOf<T,E>
  ] extends [true,false,false]
    ? never
    : T

type IsArrayOf<T,E> = T extends readonly E[] ? true : false
type IsUnknown<T>   = unknown extends T      ? true : false
  // note: IsUnknown<any> == true because unknown extends any

type _Tests_MaybeArrayOf = [
  Assert< Eq< MaybeArrayOf<string[] ,string >, string[] > >,
  Assert< Eq< MaybeArrayOf<number[] ,string >, never    > >,
  Assert< Eq< MaybeArrayOf<unknown[],string >, unknown[]> >,
  Assert< Eq< MaybeArrayOf<string   ,number >, string   > >,
  Assert< Eq< MaybeArrayOf<string   ,unknown>, string   > >,
  Assert< Eq< MaybeArrayOf<string[] ,unknown>, string[] > >,
]
