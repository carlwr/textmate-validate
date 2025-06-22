import * as fcu from "@carlwr/fastcheck-utils";
import { nonEmptyUniqueArray as fcu_nonEmptyUnique } from "@carlwr/fastcheck-utils";
import { type NonEmpty, drain, flatmapNonEmpty, isEmpty, isNonEmpty, isSingle, mapNonEmpty } from "@carlwr/typescript-extra";
import { fc } from "@fast-check/vitest";

export { deep, simple, withInvalid }
export type { Grammar, Tracked, RE, TaggedRE, ValidRE, InvalidRE }

// grammar definition:

type RuleName      = string & { __brand: 'RuleName'      };
type IncludeString = string & { __brand: 'IncludeString' };
type Scope         = string & { __brand: 'ScopeName'     };
type CaptureId     = string & { __brand: 'CaptureId'     }; // "0","1",..
type RE            = string & { __brand: 'RE'            };

type CapturesMap = Record<CaptureId,CaptureEntry>
type RepoMap     = Record<RuleName,Rule>

type Rule =
| MatchRule
| BeginEndRule
| IncludeRule

interface CaptureEntry {
  readonly name           : Scope
  readonly comment?       : string;
  readonly patterns?      : Rule[]
}

interface MatchRule {
  readonly name           : Scope;
  readonly match          : RE;
  readonly comment?       : string;
  readonly captures?      : CapturesMap;
}

interface BeginEndRule {
  readonly name           : Scope;
  readonly begin          : RE;
  readonly end            : RE;
  readonly comment?       : string;
  readonly beginCaptures? : CapturesMap;
  readonly endCaptures?   : CapturesMap;
  readonly patterns?      : Rule[];
  readonly contentName?   : Scope;
}

interface IncludeRule {
  readonly include        : IncludeString;
  readonly comment?       : string;
}

/**
 * a representation of a textMate grammar
 *
 * in serialized form, it is a valid textMate grammar file/string
 */
type Grammar = {
  readonly name           : string
  readonly scopeName      : string
  readonly patterns       : Rule[]
  readonly repository     : RepoMap
} & {
  __brand: 'Grammar'
}

function toGrammar(obj: {
  name           : string
  scopeName      : string
  patterns       : Rule[]
  repository     : RepoMap
}): Grammar {
  return obj as typeof obj & { __brand: 'Grammar' }
}


// tagged REs for generation:

/**
 * a _tagged_ RE is known to be valid or invalid through the `valid` field
 *
 * crucially, the `valid` field exists at runtime, in order for the valid/invalid knowledge to be propagated from the RE generators into the grammar structure
 */
type TaggedRE =
  | ValidRE
  | InvalidRE

interface ValidRE   { readonly valid: true ; readonly re: RE }
interface InvalidRE { readonly valid: false; readonly re: RE }

function toTaggedRE (re: string, valid: true   ): ValidRE
function toTaggedRE (re: string, valid: false  ): InvalidRE
function toTaggedRE (re: string, valid: boolean): TaggedRE {
  return {valid,re: re as RE}
}

function toValidRE  (s: string) {return toTaggedRE(s, true )}
function toInvalidRE(s: string) {return toTaggedRE(s, false)}

function isValidRE  (t: TaggedRE): t is ValidRE   {return  t.valid}
function isInvalidRE(t: TaggedRE): t is InvalidRE {return !t.valid}

function stripTag   (t: TaggedRE) {return t.re}

function someInvalid(rs: TaggedRE[]) {return rs.some(r=>!r.valid)}

export { toTaggedRE, toValidRE, toInvalidRE, isValidRE, isInvalidRE, stripTag, someInvalid }


// helper for building rules:

function toMatchRule(
  name     : Scope,
  match    : RE,
  comment? : string,
  captures?: CapturesMap,
): MatchRule {
  return {
    name,
    match,
    ...(comment  && { comment  }),
    ...(captures && { captures })
  }
}

function toIncludeRule(r: RuleName) { return {include: toIncludeStr(r)} }
function toIncludeStr (r: RuleName) { return `#${r}` as IncludeString   }
function int2ruleName (i: number  ) { return `r${i}` as RuleName        }
function int2scope    (i: number  ) { return `s${i}` as Scope           }

function toCaptureId  (i: number  ) {
  if ( !(i>=0 && i<=9) )
    throw new Error(`capture id out of range: ${i}`)
  return String(i) as CaptureId
}

function _toCapturesMap(scope: Scope, patterns: Rule[]): CapturesMap {
  return (isEmpty(patterns))
    ? { [toCaptureId(0)]: {name: scope                    } }
    : { [toCaptureId(0)]: {name: scope, patterns: patterns} }
}


// generation of nested rules:

type DepthUrge      =  0|1|2|3
const allDepthUrges = [0,1,2,3] as const


/**
 * create a structure of nested rules
 *
 * invariants guaranteed by the implementation:
 * - each RE is used exactly once
 * - each rule name is referenced at least once
 *
 * the function recurses on the passed {@link rec} parameter
 *
 * the invariants are upheld if the passed {@link rec} is the function itself, or something calling the function itself with the {@link rs} and {@link ns} parameters unmodified
 */
function mkRules(
  rs       : RE[],
  ns       : RuleName[],
  scopes   : Scope[],
  depthUrge: DepthUrge,
  rec      : MkRules,
): Rule[] {

  // temp:
  const scope = isNonEmpty(scopes)
    ? scopes[0]
    : 'sn' as Scope

  // base cases are responsible for mentioning all rule names:

  if (isEmpty (rs))
    return ns.map(toIncludeRule)

  if (isSingle(rs))
    return [
      toMatchRule(scope, rs[0], 'base case (single)'),
      ...ns.map(toIncludeRule)
    ]

  const [r0,r1,...rs_rest] = rs as [RE,RE,...RE[]]

  // make structure dependent on the depthUrge parameter:
  if (depthUrge === 0) {
    return [
      { name   : scope,
        begin  : r0,
        end    : r1,
        comment: `depthUrge=${depthUrge}`,
      },
      ...rec(rs_rest, ns, scopes, depthUrge, rec)
    ]
  }
  if (depthUrge === 1) {
    return [
      { name    : scope,
        match   : r0,
        comment : `depthUrge=${depthUrge}`,
        captures: {
          [toCaptureId(0)]: {
            name    : scope,
            patterns: [toMatchRule(scope, r1)] }},
      },
      ...rec(rs_rest, ns, scopes, depthUrge, rec),
    ]
  }
  if (depthUrge === 2) {
    return [
      { name    : scope,
        begin   : r0,
        end     : r1,
        comment : `depthUrge=${depthUrge}`,
        patterns: rec(rs_rest, ns, scopes, depthUrge, rec)
      },
    ]
  }

  if (depthUrge === 3) {
    return [
      { name    : scope,
        begin   : r0,
        end     : r1,
        comment : `depthUrge=${depthUrge}`,
        beginCaptures: {
          [toCaptureId(1)]: {
            name    : scope,
            patterns: rec(rs_rest, ns, scopes, depthUrge, rec) }},
      },
    ]
  }

  const _exhaustiveCheck: never = depthUrge
  throw new Error('should be unreachable')
}

mkRules satisfies MkRules;

type MkRules = (
  rs       : RE[],
  ns       : RuleName[],
  scopes   : Scope[],
  depthUrge: DepthUrge,
  rec      : MkRules,
) => Rule[]

function mkRepoMap(ns: RuleName[]) {
  const mp: RepoMap = {}
  for (const n of ns) { mp[n] = toIncludeRule(n) }
  return mp
}


/**
 * a generated {@link Grammar} + a tracker providing the REs used in the grammar in tagged form
*/
type Tracked = {
  grammar  : Grammar
  REtracker: TaggedRE[]
  }

type Arb<T> = fc.Arbitrary<T>;

/**
 * create an arbitrary yielding grammars woith tracker
 *
 * generated grammars satisfy the following invariants:
 * - each RE is used exactly once
 * - all referenced ruleNames are declared as named rules in the repository
 * - all rules in the repository are referenced at least once

 * for the invariants to meaningful, the provided ruleNames and regex generators should produce arrays of _unique_ values
 * (TODO: should maybe change type to sets)
*/
function getArbGrammar(
  arbREs       : Arb< TaggedRE[]          >,
  arbRuleNames : Arb< RuleName[]          >,
  arbScope     : Arb< Scope               >,
  arbDepths    : Arb< NonEmpty<DepthUrge> >,
): Arb<Tracked> {
  /*
  implementation strategy:
  - use a suitable proto generator that is the source of randomness
  - a grammar is created deterministically/purely (using the map method) from each proto generation in a way that the invariants are guaranteed to be met
  - the regex and ruleNames array arbs are the core of the generator: from a regex array and a ruleNames array, the grammar is created; this is mainly the responsibility of mkRules
  */

  const arb = fcu.record({
    REs       : arbREs,
    ruleNames : arbRuleNames,
    scopes    : arbScope.map(s=>[s]),
    depths    : arbDepths,
  })

  const arbGenGrammar = arb.map( ({REs, ruleNames, scopes, depths}) => {

    // stateful iterator yielding values from the depths array:
    const depths_next = drain(depths)

    // create a wrapper over mkRules to pass as the function to recurse on, looping back to mkRules but with a depth value yielded by the iterator:
    const mkRules_rec: MkRules = (rs,ns,scopes_,_,__) =>
      mkRules(
        rs,
        ns,
        scopes_,
        depths_next(),
        mkRules_rec
      )

    const patterns = mkRules(
      REs.map(stripTag),
      ruleNames,
      scopes,
      depths_next(),
      mkRules_rec
    )

    const grammar = toGrammar({
      name      : 'l',
      scopeName : 'source.test',
      patterns  : patterns,
      repository: mkRepoMap(ruleNames)
    })

    const tracked: Tracked = {
      grammar  : grammar,
      REtracker: REs,
    }

    return tracked
  })

  return arbGenGrammar
}


// helper generators:

const validREsMaterial = flatmapNonEmpty(
  [ '.',
    '. ',
    '()',
    'test',
    'test()',
    '/test/',
    '(.*)',
    '[a-z]+',
    '\\w+',
    '\"',
    '\\"',
    "\\\"",
    "\"",
    '\\b(true|false)\\b',
    '"[^\"]*"',
  ] as const,
  s => mapNonEmpty([s, `${s}_`, `${s}__`], toValidRE)
)

const invalidREsMaterial = flatmapNonEmpty(
  [ '(',
    '[a-z',
    'test.*)',
    '\\'
  ] as const,
  s => mapNonEmpty([s, `_${s}`, `__${s}`], toInvalidRE)
);

const _includeSpecialsMaterial = [
  '$self',
  '$base',
]; // unused; TODO

const arbValidRE    = fcu.element(validREsMaterial)
const arbInvalidRE  = fcu.element(invalidREsMaterial)

const arbScope      = fc.nat({max:100}).map(int2scope)
const arbValidREs   = fcu_nonEmptyUnique(arbValidRE, {selector: r=>r.re, size: 'medium'})

const arbDepthVec: Arb<NonEmpty<DepthUrge>> = fcu.nonEmptyArray(
  fcu.element(allDepthUrges),
  {maxLength:50, minLength:10, size: 'medium'}
)

const arbRuleNames = fc.uniqueArray(
  fc.nat({max:100})
    .map(int2ruleName)
)

// exported generators:

interface Named {
  name: string
  arb : Arb<Tracked>
}

const deep: Named = {
  name: 'deep',
  arb : getArbGrammar(
    arbValidREs,
    arbRuleNames,
    arbScope,
    arbDepthVec,
)}

const simple: Named = {
  name: 'simple',
  arb : getArbGrammar(
    arbValidREs,
    arbRuleNames,
    arbScope,
    fc.constant([0 as DepthUrge]),
  )
}

const withInvalid: Named = ( () => {
  const arbRE = fc.oneof(
    { weight: 3, arbitrary: arbValidRE   },
    { weight: 1, arbitrary: arbInvalidRE },
  )
  // at least one invalid RE:
  const arbREs = fcu_nonEmptyUnique(arbRE, {selector: r=>r.re})
    .filter(someInvalid)
  return {
    name: 'withInvalid',
    arb: getArbGrammar(
      arbREs,
      arbRuleNames,
      arbScope,
      arbDepthVec,
    )
  }
})()

/*
VS Code textmate grammar structure reference:
  https://github.com/microsoft/vscode-textmate/blob/main/src/rawGrammar.ts
*/
