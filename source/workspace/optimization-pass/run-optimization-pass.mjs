/**
 * Long-running optimization axes with resume (agent interprets reports).
 * Usage: OPTIMIZATION_AXES=dead-code,performance,security node workspace/optimization-pass/run-optimization-pass.mjs
 */
import { execSync } from 'node:child_process';
import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { appendLog, loadProgress, saveProgress } from '../qa-runners/lib.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../..');
const PROGRESS = join(__dirname, 'progress.json');
const LOG = join(__dirname, 'run.log');
const REPORT = join(__dirname, 'reports');
const AXES = (process.env.OPTIMIZATION_AXES ?? 'dead-code,performance,security').split(',').map((s) => s.trim());

if (!existsSync(REPORT)) mkdirSync(REPORT, { recursive: true });

const STEPS = {
  'dead-code': [
    { id: 'lint', cmd: 'npm run lint' },
    { id: 'knip', cmd: 'npm run hygiene:knip' },
  ],
  performance: [
    { id: 'critical-tests', cmd: 'npm run test:critical' },
    { id: 'benchmark-api', cmd: 'npm run benchmark:api' },
  ],
  security: [
    { id: 'lint', cmd: 'npm run lint' },
  ],
};

const progress = loadProgress(PROGRESS);

for (const axis of AXES) {
  for (const step of STEPS[axis] ?? []) {
    const key = `opt:${axis}:${step.id}`;
    if (progress.done[key]?.status === 'PASS') continue;
    appendLog(LOG, `start ${key}`);
    try {
      const out = execSync(step.cmd, {
        cwd: ROOT,
        encoding: 'utf8',
        stdio: 'pipe',
        maxBuffer: 64 * 1024 * 1024,
      });
      writeFileSync(join(REPORT, `${axis}-${step.id}.txt`), out);
      progress.done[key] = { status: 'PASS', at: new Date().toISOString() };
    } catch (err) {
      const text = err.stdout?.toString?.() ?? err.stderr?.toString?.() ?? String(err.message);
      writeFileSync(join(REPORT, `${axis}-${step.id}-fail.txt`), text);
      progress.done[key] = { status: 'FAIL', error: String(err.message) };
      progress.fails.push({ key, error: String(err.message) });
    }
    saveProgress(PROGRESS, progress);
    appendLog(LOG, `${key} ${progress.done[key].status}`);
  }
}

appendLog(LOG, `Done. fails=${progress.fails.length}`);
