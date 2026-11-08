import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export type NpmRunResult = {
  ok: boolean;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  combinedLog: string;
};

export function runNpmScript(
  script: string,
  options: {
    cwd: string;
    logPath?: string;
    extraArgs?: string[];
    env?: NodeJS.ProcessEnv;
    nodeOldSpaceMb?: number;
  },
): NpmRunResult {
  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const args = ['run', script];
  if (options.extraArgs?.length) {
    args.push('--', ...options.extraArgs);
  }

  const env = { ...process.env, ...options.env };
  if (options.nodeOldSpaceMb) {
    const flag = `--max-old-space-size=${options.nodeOldSpaceMb}`;
    env.NODE_OPTIONS = env.NODE_OPTIONS ? `${env.NODE_OPTIONS} ${flag}` : flag;
  }

  const child = spawnSync(npmCmd, args, {
    cwd: options.cwd,
    env,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    // Windows needs a shell for npm.cmd when invoked via spawnSync without execPath.
    shell: process.platform === 'win32',
  });

  const combinedLog = `${child.stdout ?? ''}${child.stderr ?? ''}`;
  if (options.logPath) {
    fs.mkdirSync(path.dirname(options.logPath), { recursive: true });
    fs.writeFileSync(options.logPath, combinedLog, 'utf8');
  }

  return {
    ok: child.status === 0,
    exitCode: child.status,
    signal: child.signal,
    combinedLog,
  };
}
