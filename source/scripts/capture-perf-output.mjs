/**
 * One-shot perf capture: measure-boot, warm benchmark, cold /api/boot (server must be down first).
 */
import { execSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const REPORT_DIR = path.join(ROOT, 'workspace', 'optimization-pass', 'reports');
const READY_RE = /\[AppEndO\] \+(\d+)ms READY/;

fs.mkdirSync(REPORT_DIR, { recursive: true });

function run(cmd, outFile) {
  console.log(`[capture] ${cmd}`);
  try {
    const out = execSync(cmd, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    fs.writeFileSync(path.join(REPORT_DIR, outFile), out);
    return { ok: true, out };
  } catch (err) {
    const text = `${err.stdout ?? ''}${err.stderr ?? ''}${err.message}`;
    fs.writeFileSync(path.join(REPORT_DIR, outFile.replace('.txt', '-fail.txt')), text);
    return { ok: false, out: text };
  }
}

console.log('[capture] measure-boot --dev');
let measureOut = '';
try {
  measureOut = execSync('npx tsx scripts/measure-boot.ts --dev', {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
} catch (err) {
  measureOut = `${err.stdout ?? ''}${err.stderr ?? ''}`;
}
fs.writeFileSync(path.join(REPORT_DIR, 'startup-measure-boot-dev.txt'), measureOut);

const readyWall = measureOut.match(/\[measure-boot\] READY in (\d+) ms/);
const readyMark = measureOut.match(READY_RE);

await new Promise((r) => setTimeout(r, 2000));

console.log('[capture] dev:server + cold /api/boot + benchmark');
const server = spawn(
  process.execPath,
  [
    path.join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
    '--import',
    './scripts/tsx-css-register.mjs',
    'src/server/index.ts',
  ],
  { cwd: ROOT, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] },
);

let serverLog = '';
let sawReady = false;
const bootLines = [];

const onChunk = (chunk) => {
  const text = chunk.toString('utf8');
  serverLog += text;
  process.stdout.write(text);
  for (const line of text.split(/\r?\n/)) {
    if (line.includes('READY')) sawReady = true;
    const m = line.match(/\[AppEndO\] \+(\d+)ms (.+)/);
    if (m) bootLines.push(`+${m[1]}ms ${m[2]}`);
  }
};
server.stdout.on('data', onChunk);
server.stderr.on('data', onChunk);

const deadline = Date.now() + 180_000;
while (!sawReady && Date.now() < deadline && server.exitCode === null) {
  await new Promise((r) => setTimeout(r, 400));
}

const baseUrl = 'http://127.0.0.1:3000';
let coldBoot = { error: 'server not ready' };
if (sawReady) {
  const t0 = performance.now();
  try {
    const res = await fetch(`${baseUrl}/api/boot`);
    const body = await res.text();
    coldBoot = {
      status: res.status,
      elapsedMs: Math.round(performance.now() - t0),
      bytes: Buffer.byteLength(body, 'utf8'),
    };
  } catch (err) {
    coldBoot = { error: String(err) };
  }
}

run(
  'npx tsx scripts/benchmark-api.ts http://127.0.0.1:3000 --runs 3 --json docs/perf/p-56-startup-baseline.json',
  'performance-benchmark-api.txt',
);

try {
  server.kill('SIGTERM');
} catch {
  // ignore
}
await new Promise((r) => setTimeout(r, 800));

const summary = {
  capturedAt: new Date().toISOString(),
  measureBoot: {
    readyWallMs: readyWall ? Number(readyWall[1]) : null,
    readyBootMarkMs: readyMark ? Number(readyMark[1]) : null,
    bootMarks: bootLines.length ? bootLines : measureOut.match(/^\s+\+\d+ms .+/gm) ?? [],
  },
  coldBootFirstHit: coldBoot,
  reportFiles: [
    'startup-measure-boot-dev.txt',
    'performance-benchmark-api.txt',
    'perf-capture-summary.json',
  ],
};

fs.writeFileSync(path.join(REPORT_DIR, 'perf-capture-summary.json'), JSON.stringify(summary, null, 2));
fs.writeFileSync(path.join(REPORT_DIR, 'startup-dev-server-log.txt'), serverLog);
console.log('[capture] summary', JSON.stringify(summary, null, 2));
