import { readFile as readFilePromise} from 'node:fs/promises'
import type * as vscTM from 'vscode-textmate'
import { loadVscOnig } from './loader.js'
import { getOnigWasmPath } from './wasmPath.js'

export async function getVscOnigFixed(): Promise<vscTM.IOnigLib> {
  const onigPath = await getOnigWasmPath()
  const wasmData = await readFileAsArrayBuffer(onigPath)
  return await loadVscOnig(wasmData)
}

async function readFileAsArrayBuffer(filePath: string): Promise<ArrayBuffer> {
  const fileData = await readFilePromise(filePath)
  return new Blob([new Uint8Array(fileData)]).arrayBuffer()
}
