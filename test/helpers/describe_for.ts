import { fc } from "@fast-check/vitest";
import * as vitest from "vitest";

/**
 * a named {@link fc.Arbitrary}, for use in {@link describe_for}
 */
interface ArbDef<T> {
  name: string;
  arb : fc.Arbitrary<T>;
}

/**
 * run the property test {@link testFn} for each {@link fc.Arbitrary} in {@link arbDefs}
 *
 * can be nested within a {@link vitest.describe()} block, but, `describe()`, `it` etc. cannot be nested within it
 *
 * @example
 * describe_for('reverse', [
 *   { name: 'ints', arb: fc.array(fc.integer()) },
 *   { name: 'nats', arb: fc.array(fc.nat    ()) },
 * ], (xs) => {
 *   expect(xs.reverse()).toEqual(xs)
 * })()
 * // vitest reports:
 * //
 * //   ✓ reverse (2)
 * //     ✓ 'ints'
 * //     ✓ 'nats'
 * //
 */
export function describe_for<T>(
  desc   : string,
  arbDefs: ArbDef<T>[],
  testFn : (arb: T) => void
): () => void {
  return () => {
    vitest.describe(desc, () => {
      vitest.it.for(arbDefs)('$name', (arbDef) => {
        return fc.assert(fc.property(arbDef.arb, testFn))
      })
    })
  }
}
