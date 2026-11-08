# Overnight QA orchestrator

Runs safe background work while the operator is away. Contract:
[`.claude/skills/BACKGROUND-EXECUTION.md`](../../.claude/skills/BACKGROUND-EXECUTION.md) §Concurrency.

## Prerequisites

- Dev app listening at `APPENDO_URL` (default `http://127.0.0.1:3200`)
- `APPENDO_SMOKE_PASSWORD` set if not using default dev admin password
- `PLAYWRIGHT_CHANNEL=chrome` recommended on Windows

## One command

```bash
node workspace/overnight/run-overnight.mjs
```

**What it does**

1. Starts **optimization** (`lint`, `knip`, tests, …) in parallel — does not block on Playwright.
2. **Polls** until no other `run-exhaustive-pass.mjs` process is running (your in-flight `base` job).
3. Runs exhaustive **`settings` → `appearance` → `routes`** sequentially (resume-safe).
4. Runs **smoke** studio queue (core routes).
5. **Capture phase** (one browser job at a time):
   - smoke package routes (`SMOKE_PACKAGES=1`)
   - `run-visual-studio-queue.mjs` (+ packages)
   - `run-responsive-studio-queue.mjs` (+ packages, 3 viewports per route)
   - Hawiety i18n capture (`iq` / `ir` on `/studio/hwy/*`)
   - appearance automated tests (CLI, no browser)

Logs: `workspace/overnight/overnight.log`

**Do not** start a second orchestrator or second exhaustive `base` while one is already running.

If an orchestrator was started **before** step 5 existed, run the companion (waits for smoke, then capture phase):

```bash
node workspace/overnight/run-overnight-captures-after-smoke.mjs
```

## Monitor without chat

| File | Meaning |
|------|---------|
| `overnight.log` | Orchestrator + capture phase |
| `../functional-pass/exhaustive-run.log` | Exhaustive detail |
| `../optimization-pass/run.log` | Optimization axes |
| `../smoke-pass/run.log` | Smoke queue |
| `../appendo-qa-ui-visual-pass/run.log` | Visual captures |
| `../appendo-qa-ui-responsive-pass/run.log` | Responsive captures |
| `../hawiety-i18n-pass/run.log` | Hawiety i18n captures |
