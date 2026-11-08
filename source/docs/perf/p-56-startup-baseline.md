# p-56 startup performance baseline

**Skill:** [`.claude/skills/appendo-perf-startup/SKILL.md`](../../.claude/skills/appendo-perf-startup/SKILL.md) (`@appendo-perf-startup`)

Record measurements before and after PERF-S batches. Machine-readable API snapshot:

```bash
npx tsx scripts/benchmark-api.ts http://localhost:3000 --runs 3 --json docs/perf/p-56-startup-baseline.json
```

## Manual checklist (PERF-S-0)

| Metric | How to measure | Baseline (2026-07-10 · dev) |
|--------|----------------|------------------------------|
| Server ready | `npm run dev` → log `[AppEndO] Server running` · or `npx tsx scripts/measure-boot.ts --dev` | **17.35 s** (pre) · **8.22 s** boot mark (post PERF-S) · **15.92 s** wall / **7.68 s** boot mark (2026-09-27 capture; defer `bootstrapFullRuntime` import) |
| Client usable | DevTools Network: `/` → first shell paint (not loading) | manual · TBD |
| Boot API TTFB | curl `/api/boot` (cold, replaces 4 calls) | **~768 ms** first hit after listen (2026-09-27 capture) · **~128 ms** warm avg (3 runs) |
| Runtime-config TTFB | curl `/api/platform/runtime-config` (cold) | **~2200 ms** (legacy path) |
| Cultures TTFB | curl `/api/platform/cultures` (cold) | **~2020 ms** (legacy path) |
| PWA config TTFB | curl `/api/pwa/config` (cold) | **~2020 ms** (legacy path) |
| Install-status TTFB | curl `/api/install/status` | **8 ms** avg (warm API benchmark) |
| Prod server ready | `npm run build && node dist/server.cjs` | **partial** — vitest CJS bundling fixed (`agentPackRuntime.ts`); Prisma `.ts` client load still blocks full prod boot |

## API snapshot (unauthenticated)

Source: [`p-56-startup-baseline.json`](./p-56-startup-baseline.json) · `runCount=3` · dev server `localhost:3000`

| Endpoint | Status | avg ms | max bytes |
|----------|--------|--------|-----------|
| **boot** | 200 | **128** | **79226** |
| health | 200 | 5 | 86 |
| install-status | 200 | 8 | 484 |
| dashboard-summary | 401 | 57 | 49 |
| chat-history-p10 | 401 | 8 | 49 |
| chat-history-p50 | 401 | 8 | 49 |
| chat-history-p100 | 401 | 8 | 49 |
| profile-me | 401 | 10 | 49 |

## Notes

- Cold boot API latency (~2 s) reflects SQL Server control-plane round-trips on first request after boot, not route-discovery cost alone.
- **`GET /api/boot`** returns runtime-config + cultures + install + pwa in one response (~79 KB warm snapshot 2026-09-27); auth bypass confirmed (200 unauthenticated). Cold first hit after boot can still be ~2 s class (SQL Server).
- Prod CJS: `gitWorkflowTemplates` + `packTestHarness`/`vitest` bundling fixed; remaining blocker is Prisma client `.ts` extension in bundled output (pre-existing packaging issue).
- Re-run this doc after each PERF-S batch and log deltas here.

## PO exit targets (p-56)

- Server ready: **≥30%** faster dev after PERF-S-1 — **achieved: ~53%** (17.35 s → 8.22 s)
- Client usable: **≥25%** faster perceived boot — manual verification pending
- `npm run test:critical` green after each batch — **256 passed** (2026-09-27) after VA manifest cache fix + admin shell test harness
