import { isNonEmpty } from '@carlwr/typescript-extra';
import * as globby from 'globby';
import { pkgJson } from '../pkgJson.js';

const VSC_ONIG = 'vscode-oniguruma';

function tryGlobPatterns(patterns: string[]): string[] {
  for (const pattern of patterns) {
    const matches = globby.globbySync(pattern, {
      dot: true,
      followSymbolicLinks: true
    });
    if (matches.length > 0) {
      return matches;
    }
  }
  return [];
}

export function getOnigWasmPath(): string {
  const version = getVscOnigVersion();

  const patterns = [
    `node_modules/**/${VSC_ONIG}@${version}/**/onig.wasm`,
    `node_modules/**/${VSC_ONIG}/**/onig.wasm`,
    `node_modules/**/*${VSC_ONIG}*/**/onig.wasm`
  ];

  const matches = tryGlobPatterns(patterns);
  if (!isNonEmpty(matches)) {
    throw new Error(`could not find onig.wasm for ${VSC_ONIG}@${version}.`);
  }
  return matches[0]
}

function getVscOnigVersion(): string {
  const DEPS = pkgJson.dependencies;
  if (!DEPS) {
    throw new Error('dependencies not found in package.json');
  }

  const version = DEPS[VSC_ONIG];
  if (!version) {
    throw new Error(`${VSC_ONIG} not found as a dependency in package.json`);
  }

  const validRE = /^[0-9.]+$/;
  if (!validRE.test(version)) {
    throw new Error(`The version spec for ${VSC_ONIG} in package.json is '${version}' which does not match the expected format /${validRE.source}/. In order to use the oniguruma wasm binary, the version declared in package.json must be an exact version number, e.g. "2.0.1".`);
  }

  return version;
}
