import { access, constants, mkdir, realpath, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { allUnique, type Primitive } from '@carlwr/typescript-extra'
import { execa } from 'execa'
import { expect } from 'vitest'

/**
 * the path to the node executable
 *
 * (tests that need to execute .js files do so with `node`, since `pnpm tsx ..` adds some 400ms to the invocation vs. node)
 */
export const node: string = await ( async () => {
  if (process.env.NODE) {
    return await realpath(process.env.NODE)
  }
  throw new Error("an env. var. 'NODE', with the path to a node executable, must be set for the tests to run")
})()

/**
 * resolved (project-local) path of the `tsx` executable
 *
 * (invoking `tsx` directly with a resolved path saves some 200 ms per invocation vs. `pnpm tsx ..`)
 */
export const tsx: string = await ( async () => {
  try {
    const binDir = await execa('pnpm', ['bin'])
    const tsxPath = join(binDir.stdout.split('\n')[0]!, 'tsx')
    await access(tsxPath, constants.X_OK)
    return tsxPath
  } catch (e) {
    throw new Error(`unable to resolve 'tsx' as an executable: ${e}`)
  }
})()

export async function writeJsonFile(o: unknown, f: string) {
  await mkdir(dirname(f), { recursive: true })
  await writeFile(f, JSON.stringify(o, null, 2))
}

export function expectUnique<T extends Primitive>(xs: T[]) {
  expect(xs).toSatisfy(allUnique)
}
