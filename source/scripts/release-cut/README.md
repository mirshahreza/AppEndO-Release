# Local release cut

Operator entry: `npm run release:cut` or `@appendo-release-cut`.

- **No GitHub Actions** — all heavy work runs on your machine (no Actions minutes).
- **Not triggered by push** — only when you invoke the skill or npm script.
- Artifacts: `dist/release-cut/<runId>/` (`REPORT.md`, `checkpoint.json`, `public-oss/`, `artifacts/packages/`).

Plan: `plans/core/todo/p-130-local-release-cut.md`.

Public OSS lives in git repo **`AppEndO-Release`** (sibling clone `../AppEndO-Release`), not under `releases/` in the private monorepo. Export → push via `release:export-appendo-release` and `release:push-appendo-release`.
