/**
 * Lightweight API latency smoke for PERF-0 regression checks.
 *
 * Usage:
 *   npm run benchmark:api
 *   npm run benchmark:api -- http://localhost:3000
 *   npm run benchmark:api -- http://localhost:3000 --runs 3 --json docs/perf/p-51-baseline-latest.json
 */
import fs from 'fs';
import path from 'path';

const args = process.argv.slice(2);
const jsonFlagIndex = args.indexOf('--json');
const jsonOutputPath = jsonFlagIndex >= 0 ? args[jsonFlagIndex + 1] : null;
const runsFlagIndex = args.indexOf('--runs');
const runCount = runsFlagIndex >= 0 ? Math.max(1, Number(args[runsFlagIndex + 1] || 1)) : 1;
const positionalArgs = args.filter((arg, index) => {
  if (arg.startsWith('--')) return false;
  if (index > 0 && args[index - 1] === '--json') return false;
  if (index > 0 && args[index - 1] === '--runs') return false;
  return true;
});

const baseUrl = (positionalArgs[0] || process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');

type BenchmarkTarget = {
  name: string;
  path: string;
};

const TARGETS: BenchmarkTarget[] = [
  { name: 'boot', path: '/api/boot' },
  { name: 'health', path: '/api/health' },
  { name: 'dashboard-summary', path: '/api/dashboard/summary' },
  { name: 'chat-history-p10', path: '/api/admin/chat-history?page=1&pageSize=10' },
  { name: 'chat-history-p50', path: '/api/admin/chat-history?page=1&pageSize=50' },
  { name: 'chat-history-p100', path: '/api/admin/chat-history?page=1&pageSize=100' },
  { name: 'profile-me', path: '/api/profile/me' },
  { name: 'install-status', path: '/api/install/status' },
];

type BenchmarkResult = {
  name: string;
  path: string;
  status: number;
  elapsedMs: number;
  bytes: number;
  run: number;
  error?: string;
};

const measure = async (target: BenchmarkTarget, run: number): Promise<BenchmarkResult> => {
  const url = `${baseUrl}${target.path}`;
  const started = performance.now();
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
  });
  const elapsedMs = Math.round(performance.now() - started);
  const body = await response.text();

  return {
    name: target.name,
    path: target.path,
    status: response.status,
    run,
    elapsedMs,
    bytes: Buffer.byteLength(body, 'utf8'),
  };
};

const summarize = (results: BenchmarkResult[]) => {
  const grouped = new Map<string, BenchmarkResult[]>();
  for (const row of results) {
    const bucket = grouped.get(row.name) ?? [];
    bucket.push(row);
    grouped.set(row.name, bucket);
  }

  return Array.from(grouped.entries()).map(([name, rows]) => {
    const elapsed = rows.map((row) => row.elapsedMs).filter((value) => value >= 0);
    const bytes = rows.map((row) => row.bytes);
    const avgElapsedMs = elapsed.length > 0
      ? Math.round(elapsed.reduce((sum, value) => sum + value, 0) / elapsed.length)
      : -1;
    const maxBytes = bytes.length > 0 ? Math.max(...bytes) : 0;

    return {
      name,
      path: rows[0]?.path ?? '',
      runs: rows.length,
      status: rows[rows.length - 1]?.status ?? 0,
      avgElapsedMs,
      maxBytes,
    };
  });
};

const main = async () => {
  console.log(`[benchmark-api] Base URL: ${baseUrl} · runs=${runCount}`);
  const results: BenchmarkResult[] = [];

  for (let run = 1; run <= runCount; run += 1) {
    for (const target of TARGETS) {
      try {
        results.push(await measure(target, run));
      } catch (error) {
        results.push({
          name: target.name,
          path: target.path,
          status: 0,
          run,
          elapsedMs: -1,
          bytes: 0,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  const summary = summarize(results);
  console.table(summary);

  const payload = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    runCount,
    summary,
    results,
  };

  if (jsonOutputPath) {
    const absolutePath = path.isAbsolute(jsonOutputPath)
      ? jsonOutputPath
      : path.join(process.cwd(), jsonOutputPath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    console.log(`[benchmark-api] Wrote ${absolutePath}`);
  }

  const failures = results.filter((row) => row.status === 0 || row.status >= 500);
  if (failures.length > 0) {
    process.exitCode = 1;
  }
};

main().catch((error) => {
  console.error('[benchmark-api] failed:', error?.message || error);
  process.exit(1);
});
