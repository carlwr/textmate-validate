import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { allUnique, type Primitive } from '@carlwr/typescript-extra'
import { expect } from 'vitest'


export function obj2file(o: unknown, f: string) {
  mkdirSync(dirname(f), { recursive: true })
  writeFileSync(f, JSON.stringify(o, null, 2))
}

export function expectUnique<T extends Primitive>(xs: T[]) {
  expect(xs).toSatisfy(allUnique)
}
