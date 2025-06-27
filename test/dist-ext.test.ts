import { access, mkdir, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { rm_rf } from '@carlwr/typescript-extra'
import { execa, type Result } from 'execa'
import { afterAll, beforeAll, describe, expect, it, type TestContext } from 'vitest'
import { writeJsonFile } from './helpers/testUtils.js'


type RelDir  = string
type AbsDir  = string
type AbsFile = string

const dist    : RelDir  = 'dist'
const distLock: RelDir  = `${dist}.lock`
const grammar : AbsFile = join(process.cwd(),'test','fixtures','grammar.json')
const aux     : AbsDir  = join(process.cwd(),'.aux')


const consumerPkg: ConsumerPkg = getConsumerPkg()
let pack: AbsFile

beforeAll(async () => { pack = await buildPack() })
afterAll(consumerPkg.dispose)

describe.concurrent('@dist simulate use in consuming package', () => {

  it.sequential('installs', async () => {
    await expect(
      consumerPkg.install(pack)
    ).resolves.toMatchObject(
      {exitCode: 0}
    )
    const nodeModules = join(consumerPkg.dir(), 'node_modules')
    await expect(access(nodeModules)).resolves.not.toThrow()
  })

  describe.concurrent('runs the CLI', () => {

    it('with --help', async (ctx) => {
      ctx.skip(!consumerPkg.isInstalled())
      const arg = ['exec', 'textmate-validate', '--help']
      await expectCmdToSucceed('pnpm', arg, consumerPkg.dir(), ctx)
    })

    it('with --version (reads from package.json)', async (ctx) => {
      ctx.skip(!consumerPkg.isInstalled())
      const arg = ['exec', 'textmate-validate', '--version']
      const res = await expectCmdToSucceed('pnpm', arg, consumerPkg.dir(), ctx)
      expect(res.stdout).toMatch(/textmate-validate/)
    })

    it('validates the example grammar', async (ctx) => {
      ctx.skip(!consumerPkg.isInstalled())
      const arg = ['exec', 'textmate-validate', '-vv', grammar]
      const res = await expectCmdToSucceed('pnpm', arg, consumerPkg.dir(), ctx)
      expect(res.exitCode).toBe(0)
      expect(res.stdout).toMatch(/valid/)
    })

  })

})

describe.concurrent('@dist simulate use with npx', () => {
  it('runs the CLI with --version', async () => {

    const args = ['npx','--package', pack, 'textmate-validate','--version']
    const run = execa('pnpm', args).then(res => res.stdout)

    await expect(run).resolves.toMatch(/textmate-validate/)

  })
})

/**
 * interface to the dir of a minimal npm package, supporting only a function for adding a dependency (which supposedly also creates the temp dir and initializes the package) and retrieving the dir
 */
interface ConsumerPkg {
  install: (pack: AbsFile) => Promise<Result>
  dir    : () => AbsDir
  dispose: () => Promise<void>
  isInstalled: () => boolean
}

/**
 * `install`: initialize the minimal package in a temp dir and add the given pack as a dependency
 * `dir`: retrieve the dir of the package
 * `dispose`: remove the temp dir
 *
 * attempting to install more than once will throw, as will attempting to get the installed dir before `install`

 */
function getConsumerPkg() {
  let dir: AbsDir|undefined = undefined
  return {
    install: async (pack: AbsFile) => {
      if (dir) throw new Error('already installed')
      const dir_ = await sysTempdir()
      const ret = await installPack(dir_, pack)
      dir = dir_
      return ret
    },
    dir: () => {
      if (!dir) throw new Error('not installed')
      return dir
    },
    dispose: async () => {
      dir = undefined
      if (dir) await rm_rf(dir)
    },
    isInstalled: () => dir !== undefined
  }
}


/**
 * an expectation that the command runs with exit code 0
 *
 * the command is run with {@link cwd} as the current working directory
 *
 * if the command fails, the execa Result object is logged to stderr
 */
async function expectCmdToSucceed(
  cmd: string,
  arg: string[],
  cwd: AbsDir,
  ctx: TestContext
) {

  const res = await execa(cmd, arg, {cwd: cwd, reject: false})

  if (!ctx.task.fails) {
    ctx.onTestFailed(() => {
      console.error([
        '---',
        `test: "${ctx.task.name}`,
        'execa result object:',
        JSON.stringify(res, null, 2),
        '---'
      ].join('\n'))
    })
  }

  expect(res.exitCode).toBeDefined()
  if (res.exitCode !== undefined) {
    expect(res.exitCode).toBe(0)
  }
  return res
}

async function buildPack(): Promise<AbsFile> {
  const pack = join(await auxTempdir(), 'pack.tgz')
  const lock = await acquireDistDirLock()
  try {
    await execa('pnpm', ['build:dev'])
    await execa('pnpm', ['pack', '--out', pack])
  } finally {
    lock.release()
  }
  return pack
}

async function installPack(
  dir: AbsDir,
  pack: AbsFile
): Promise<Result> {
  const pkgJsonFile: AbsFile = join(dir, 'package.json')
  const pkgJsonData = {
    name   : 'pack-test-pkg',
    type   : 'module',
    private: true
  }
  await writeJsonFile(pkgJsonData, pkgJsonFile)
  return await execa('pnpm', ['install', pack], {cwd: dir})
}

/**
 * rudimentary lock to detect and throw in case of concurrent builds
 *
 * rationale: `pnpm pack` takes files from the configured dist dir; can't be changed with CLI args -> building to dist/ and packing from there is necessary
 *
 * implementation: the mkdir-mutex trick; atomic on most yet not all platforms
 */
async function acquireDistDirLock() {
  await mkdir(distLock) // throws if already exists
  const release = async () => await rm_rf(distLock)
  return { release }
}

async function sysTempdir(): Promise<AbsDir> {
  return await mkdtemp(tmpdir())
}

async function auxTempdir(): Promise<AbsDir> {
  await mkdir(aux, { recursive: true })
  return await mkdtemp(join(aux, 'dist-ext-'))
}
