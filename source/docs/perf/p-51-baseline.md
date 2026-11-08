# p-51 performance baseline

Record measurements after major perf batches. Generate machine-readable output with:

```bash
npx tsx scripts/benchmark-api.ts http://localhost:3000 --runs 3 --json docs/perf/p-51-baseline-latest.json
```

For authenticated admin endpoints, re-run with a session cookie:

```bash
# Example (adjust cookie name/value for your dev session)
npx tsx scripts/benchmark-api.ts http://localhost:3000 --runs 3 --json docs/perf/p-51-baseline-authed.json
```

## Manual checklist (PERF-0-1)

| Metric | Target | How to measure |
|--------|--------|----------------|
| Dashboard summary TTFB | note ms + bytes | `benchmark-api` row `dashboard-summary` |
| Chat list 10/50/100 | note ms + bytes | rows `chat-history-p10/p50/p100` |
| Profile `/api/profile/me` | note bytes (no avatar body) | row `profile-me` |
| Designer 50-node drag | no visible lag | DevTools Performance on `/studio/client-components` |

## PO exit criteria

- Chat list 100 sessions: response < 50% of first **authenticated** baseline (after PERF-B-1/C-1)
- Designer 50+ nodes: selection/drag without noticeable lag
- AiPanel 50+ messages: smooth scroll (PERF-C-5 pending — HIGH)

## Latest snapshot (unauthenticated · 2026-07-09)

Source: [`p-51-baseline-latest.json`](./p-51-baseline-latest.json) · `runCount=3` · dev server `localhost:3000`

| Endpoint | Status | avg ms | max bytes | Notes |
|----------|--------|--------|-----------|-------|
| health | 200 | 13 | 86 | OK |
| install-status | 200 | 16 | 659 | OK |
| dashboard-summary | 401 | 2 | 49 | needs auth for perf baseline |
| chat-history-p10 | 401 | 2 | 49 | needs auth |
| chat-history-p50 | 401 | 2 | 49 | needs auth |
| chat-history-p100 | 401 | 3 | 49 | needs auth |
| profile-me | 401 | 1 | 49 | needs auth |

**Next:** capture `p-51-baseline-authed.json` after dev login for PO-1 comparison.
