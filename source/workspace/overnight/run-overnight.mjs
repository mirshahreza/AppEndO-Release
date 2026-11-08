/**
 * Overnight orchestrator: optimization (parallel) → wait for other exhaustive →
 * exhaustive settings/appearance/routes → smoke queue.
 * Usage: node workspace/overnight/run-overnight.mjs
 */
import { execSync, spawn } from 'node:child_process';
import { existsSync, writeFileSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { appendLog } from '../qa-runners/lib.mjs';
import { runCapturePhase } from './capture-phase.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../..');
const LOG = join(__dirname, 'overnight.log');
const LOCK = join(__dirname, 'overnight.lock');

function log(msg) {
  appendLog(LOG, msg);
  process.stdout.write(`${msg}\n`);
}

function otherExhaustiveRunning() {
  const needle = 'run-exhaustive-pass.mjs';
  try {
    if (process.platform === 'win32') {
      const out = execSync(
        'powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"Name=\'node.exe\'\\" | Select-Object -ExpandProperty CommandLine"',
        { encoding: 'utf8', cwd: ROOT },
      );
      const lines = out.split(/\r?\n/).filter((l) => l.includes(needle));
      return lines.length > 1 || (lines.length === 1 && !process.env.OVERNIGHT_OWNS_EXHAUSTIVE);
    }
    const out = execSync('ps -ax -o command= 2>/dev/null || true', { encoding: 'utf8', cwd: ROOT });
    const matches = out.split('\n').filter((l) => l.includes(needle));
    return matches.length > 1;
  } catch {
    return false;
  }
}

function runNodeScript(relPath, env = {}) {
  log(`exec node ${relPath} ${JSON.stringify(env)}`);
  execSync(`node ${relPath}`, {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, ...env, OVERNIGHT_OWNS_EXHAUSTIVE: '1' },
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  if (existsSync(LOCK)) {
    log('overnight.lock exists — another orchestrator may be running. Exit.');
    process.exit(1);
  }
  writeFileSync(LOCK, `${process.pid}\n${new Date().toISOString()}\n`);

  log('Overnight start');

  const opt = spawn(process.execPath, ['workspace/optimization-pass/run-optimization-pass.mjs'], {
    cwd: ROOT,
    stdio: 'ignore',
    detached: true,
    env: { ...process.env, OPTIMIZATION_AXES: process.env.OPTIMIZATION_AXES ?? 'dead-code,performance,security' },
  });
  opt.unref();
  log(`optimization spawned pid=${opt.pid}`);

  log('Waiting for other run-exhaustive-pass.mjs to finish…');
  let waits = 0;
  while (otherExhaustiveRunning()) {
    waits += 1;
    if (waits % 5 === 0) log(`still waiting (${waits} min)…`);
    await sleep(60_000);
  }
  log('No external exhaustive process — chaining phases');

  for (const phase of ['settings', 'appearance', 'routes']) {
    try {
      runNodeScript('workspace/functional-pass/run-exhaustive-pass.mjs', { EXHAUSTIVE_PHASE: phase });
    } catch (err) {
      log(`exhaustive ${phase} failed: ${err.message}`);
    }
  }

  try {
    runNodeScript('workspace/smoke-pass/run-studio-queue.mjs');
  } catch (err) {
    log(`smoke queue failed: ${err.message}`);
  }

  log('capture phase start');
  runCapturePhase(LOG);

  log('Waiting for optimization child to settle…');
  try {
    execSync(`powershell -NoProfile -Command "Wait-Process -Id ${opt.pid} -ErrorAction SilentlyContinue"`, {
      cwd: ROOT,
      stdio: 'ignore',
    });
  } catch {
    /* already exited or unix — ignore */
  }

  log('Overnight Done.');
}

main()
  .catch((err) => {
    log(`Fatal: ${err.message}`);
    process.exitCode = 1;
  })
  .finally(() => {
    try {
      if (existsSync(LOCK)) unlinkSync(LOCK);
    } catch {
      /* ignore */
    }
  });
