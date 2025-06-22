import { fc } from '@fast-check/vitest';
import { describe, expect } from 'vitest';
import { describe_for } from './describe_for.js';


describe('describe_for: nested in `describe` block', () => {

  describe_for('verify docstring example ("reverse")', [
    { name: 'ints', arb: fc.array(fc.integer()) },
    { name: 'nats', arb: fc.array(fc.nat    ()) },
  ], (xs) => {
    expect(xs.reverse()).toEqual(xs)
  })()

})

describe_for('describe_for: not nested (dummy tests)', [
  { name: "number type from fc.integer", arb: fc.integer() },
  { name: "number type from fc.nat    ", arb: fc.nat() },
], (x) => {
  expect(x).toBeTypeOf('number')
})()
