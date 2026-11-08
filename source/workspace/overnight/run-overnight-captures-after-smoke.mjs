/**
 * Companion for an orchestrator started before capture phase existed:
 * waits until core smoke finished, then runs capture phase once.
 * Usage: node workspace/overnight/run-overnight-captures-after-smoke.mjs
 */
import { readFileSync, existsSync, writeFileSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { appendLog } from '../qa-runners/lib.mjs';
import { runCapturePhase } from './capture-phase.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../..');
const LOG = join(__dirname, 'overnight.log');
const SMOKE_LOG = join(ROOT, 'workspace/smoke-pass/run.log');
const MARKER = join(__dirname, 'captures-after-smoke.done');
const POLL_MS = 120_000;
const MAX_POLLS = 360; // 12h

function log(msg) {
  appendLog(LOG, `[captures-wait] ${msg}`);
  process.stdout.write(`${msg}\n`);
}

function smokeDone() {
  const results = join(ROOT, 'workspace/smoke-pass/queue-results.json');
  if (existsSync(results)) {
    try {
      const rows = JSON.parse(readFileSync(results, 'utf8'));
      if (Array.isArray(rows) && rows.length >= 30) return true;
    } catch {
      /* ignore */
    }
  }
  if (!existsSync(SMOKE_LOG)) return false;
  const tail = readFileSync(SMOKE_LOG, 'utf8').slice(-8000);
  return /platform-transfer PASS|Done\.|fails=\d+/.test(tail);
}

function overnightAlreadyHasCapture() {
  if (!existsSync(LOG)) return false;
  return readFileSync(LOG, 'utf8').includes('capture phase complete');
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  if (existsSync(MARKER)) {
    log('captures-after-smoke already ran. Exit.');
    return;
  }
  if (overnightAlreadyHasCapture()) {
    log('overnight.log already has capture phase. Exit.');
    return;
  }

  log('Waiting for smoke-pass run.log to finish…');
  for (let i = 0; i < MAX_POLLS; i += 1) {
    if (smokeDone()) break;
    if (i > 0 && i % 5 === 0) log(`still waiting (${i * 2} min)…`);
    await sleep(POLL_MS);
  }

  if (!smokeDone()) {
    log('Timeout waiting for smoke — running capture phase anyway (resume-safe).');
  }

  if (overnightAlreadyHasCapture() || existsSync(MARKER)) {
    log('Capture phase already recorded — skip companion run.');
    return;
  }

  log('capture phase start (companion)');
  runCapturePhase(LOG);
  writeFileSync(MARKER, `${new Date().toISOString()}\n`);
  log('captures-after-smoke Done.');
}

main().catch((err) => {
  log(`Fatal: ${err.message}`);
  process.exitCode = 1;
});
