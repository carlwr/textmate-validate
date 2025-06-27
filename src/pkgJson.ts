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
  try {
    const pkg = readPkg.readPackageSync()
    return schema.parse(pkg)
  } catch (e) {
    console.error(e)
    process.exit(1)
  }
}

export type PackageJson = z.infer<typeof schema>

export const pkgJson = parse()

export const name = pkgJson.name.replace(/^@.*?\//, '')

export const repoUrl = pkgJson.repository.url
  .replace(/^git\+/, '')
  .replace(/\.git$/, '')

export const npmUrl = `https://www.npmjs.com/package/${pkgJson.name}`
