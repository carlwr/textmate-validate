import type * as vscTM from 'vscode-textmate'

const vscOnigImport = import('vscode-oniguruma')

export { loadVscOnig }

// must import vscode-oniguruma dynamically
// attempt to do this robustly by checking dynamically whether the identifiers are exported directly under the module name or under the "default" property
async function loadVscOnig(wasmData: ArrayBuffer): Promise<vscTM.IOnigLib> {
  const vscOnig = await vscOnigImport as unknown

  const pick: vscOnigModule | undefined =
      isOnig        (vscOnig) ? vscOnig
    : isOnig_default(vscOnig) ? vscOnig.default
    : undefined

  if (!pick) {
    throw new Error('Failed to dynamically import vscode-oniguruma: expected module signature to exist either directly under the module name or under the "default" property of the module')
  }

  const { loadWASM, createOnigScanner, createOnigString } = pick

  await loadWASM(wasmData)

  return {
    createOnigScanner,
    createOnigString
  }
}

interface vscOnigModule {
  loadWASM: (data: ArrayBuffer) => Promise<void>
  createOnigScanner: (patterns: string[]) => any
  createOnigString: (str: string) => any
}

// interface vscOnigModule_default {
//   default: vscOnigModule
// }

function hasProp(obj: unknown, prop: string): obj is Record<string,unknown> {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    prop in obj
  )
}

function isOnig(obj: unknown,): obj is vscOnigModule {
  return (
    hasProp(obj, 'loadWASM') &&
    hasProp(obj, 'createOnigScanner') &&
    hasProp(obj, 'createOnigString')
  )
}

function isOnig_default(obj: unknown): obj is { default: vscOnigModule } {
  return (
    hasProp(obj, 'default') &&
    isOnig(obj.default)
  )
}
