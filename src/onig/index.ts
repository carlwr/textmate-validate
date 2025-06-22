import { readFileSync } from 'node:fs';
import type * as vscTM from 'vscode-textmate';
import { loadVscOnig } from './loader.js';
import { getOnigWasmPath } from './wasmPath.js';

export async function getVscOnigFixed(): Promise<vscTM.IOnigLib> {
  const onigPath = getOnigWasmPath();
  const wasmData = readFileSync(onigPath).buffer;
  return await loadVscOnig(wasmData);
}
