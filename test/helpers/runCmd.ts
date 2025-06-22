import type { Buffer } from 'node:buffer';
import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process';

interface CmdResult {
  exitCode: number
  stdout: string
  stderr: string
}

// export function runCmd(cmd: string[] = []): Promise<CmdResult> {
export function runCmd(cmd: readonly [string, ...string[]]): Promise<CmdResult> {
  return new Promise((resolve) => {

    const proc: ChildProcessWithoutNullStreams =
      spawn(cmd[0], cmd.slice(1), { stdio: ['pipe', 'pipe', 'pipe'] });

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (b: Buffer) => stdout += b.toString());
    proc.stderr.on('data', (b: Buffer) => stderr += b.toString());

    proc.on('close', (code) => {
      resolve({ exitCode: code ?? 0, stdout, stderr });
    });

  });
}
