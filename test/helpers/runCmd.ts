import type { ChildProcessWithoutNullStreams as ChildProc, SpawnOptionsWithoutStdio as SpawnOpts} from 'node:child_process'
import { spawn } from 'node:child_process'

export type Cmd = readonly [string, ...string[]]

export interface CmdResult {
  exitCode: number
  stdout: string
  stderr: string
}

export interface CmdResultSuccess {
  stdout: string
  stderr: string
}

/**
 * Run a command. If it fails to spawn, an error is thrown, otherwise the result of running the command is returned.
 *
 * If the spawned process exits due to a signal, the process itself will not have any exit code - in this case, the returned {@link exitCode} will be set to 128.
*/
export function runCmd(
  cmd: Cmd,
  cwd?: string
): Promise<CmdResult> {
  return new Promise((resolve, reject) => {

    const command = cmd[0]
    const args = cmd.slice(1)
    const defaults: SpawnOpts = {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd,
    }

    const proc: ChildProc = spawn(command, args, defaults)

    let stdout = ''
    let stderr = ''
    proc.stdout.setEncoding('utf-8')
    proc.stderr.setEncoding('utf-8')
    proc.stdout.on('data', (b: unknown) => stdout += toStringSafe(b))
    proc.stderr.on('data', (b: unknown) => stderr += toStringSafe(b))

    proc.on('close', (code, signal) => {
      const exitCode = code ?? (signal ? 128 : 0)
      resolve({ exitCode, stdout, stderr })
    })

    proc.on('error', (err) => {
      reject(new Error(`Failed to spawn command "${command}": ${err.message}`))
    })

    // either the 'close' or 'error' event _should_ always be emitted, according to the docs, so the promise _should_ always resolve - note however that our implementation itself does not guarantee this; we rely on the docs for the promise not ever to be left dangling.

  })
}

function toStringSafe(chunk: unknown): string {
  if (typeof chunk === 'string') return chunk
  throw new Error(`Expected string, got ${typeof chunk}`)
}

/**
 * Run a command. If it exits with a non-zero exit code, exits due to a signal or fails to spawn, an error is thrown.
 */
export async function runCmdOrThrow(
  ...params: Parameters<typeof runCmd>
): Promise<CmdResultSuccess> {
  const result = await runCmd(...params)
  if (result.exitCode !== 0) {
    throw new Error([
      'Command failed:',
      `function args: ${JSON.stringify(params)}`,
      `exit code: ${result.exitCode}`,
      `stderr: ${result.stderr}`,
      `stdout: ${result.stdout}`,
    ].join('\n  '))
  }
  return {
    stdout: result.stdout,
    stderr: result.stderr,
  }
}

export function formatCmdResult(result: CmdResult|CmdResultSuccess): string {
  const lines: string[] = []
  if ('exitCode' in result)
    lines.push(`exit code: ${result.exitCode}`)
  lines.push(`stdout: ${result.stdout}`)
  lines.push(`stderr: ${result.stderr}`)
  return lines.join('\n')
}
