#!/usr/bin/env node
/**
 * Run a command with a minimum V8 old-space heap.
 * npm scripts inherit NODE_OPTIONS, so this works on Windows and Unix
 * without cross-env. A larger heap already set by the caller is kept.
 */
import { spawn } from 'node:child_process';

const args = process.argv.slice(2);
const separator = args.indexOf('--');
const mb = Number(separator === -1 ? args[0] : args[0]);
const command = separator === -1 ? args.slice(1) : args.slice(separator + 1);

if (!Number.isFinite(mb) || mb < 512 || command.length === 0) {
  console.error('Usage: node scripts/with-node-heap.mjs <megabytes> -- <command> [args...]');
  process.exit(1);
}

const mergeHeap = (existing, megabytes) => {
  const flag = `--max-old-space-size=${megabytes}`;
  if (!/--max-old-space-size=\d+/.test(existing)) {
    return `${existing} ${flag}`.trim();
  }
  return existing.replace(/--max-old-space-size=(\d+)/g, (match, value) => (
    Number(value) >= megabytes ? match : flag
  ));
};

const env = {
  ...process.env,
  NODE_OPTIONS: mergeHeap(process.env.NODE_OPTIONS ?? '', mb),
};

const child = spawn(command[0], command.slice(1), {
  env,
  stdio: 'inherit',
  shell: process.platform === 'win32',
  windowsHide: true,
});

child.on('error', (error) => {
  console.error(`[with-node-heap] Failed to start ${command[0]}: ${error.message}`);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
