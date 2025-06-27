import process from 'node:process'
import * as readPkg from 'read-pkg'
import { z } from 'zod'

const schema = z.object({
  name: z.string(),
  version: z.string(),
  description: z.string(),
  repository: z.object({
    url: z.string(),
  }),
  dependencies: z.object({
    'vscode-oniguruma': z.string(),
  }),
})

function parse(): PackageJson {

  let pkg: unknown
  try {
    pkg = readPkg.readPackageSync()
  } catch (e) {
    console.error('Could not read package.json:')
    console.error(e)
    process.exit(1)
  }

  const res = schema.safeParse(pkg)
  if (!res.success) {
    console.error('Could not read expected fields from package.json:')
    console.error(res.error.message)
    process.exit(1)
  }
  return res.data
}

type PackageJson = z.infer<typeof schema>

export const pkgJson = parse()

export const name = pkgJson.name.replace(/^@.*?\//, '')

export const repoUrl = pkgJson.repository.url
  .replace(/^git\+/, '')
  .replace(/\.git$/, '')

export const npmUrl = `https://www.npmjs.com/package/${pkgJson.name}`
