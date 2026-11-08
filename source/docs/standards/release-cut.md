# Local release cut

Operator invokes **`@appendo-release-cut`** or `npm run release:cut` after normal work on `main`.

- Orchestrator: `scripts/release-cut/run-release-cut.ts`
- Plan: `plans/core/todo/p-130-local-release-cut.md`
- **No GitHub Actions** for release (avoid Actions minutes); all heavy steps run locally.
- Public OSS includes **cms** + **remote-hubs** only; **hawiety** zips stay in private run artifacts. Staging for the public repo: `.appendo-release-staging/vX.Y.Z/`; git remote **`AppEndO-Release`** (sibling clone `../AppEndO-Release`).

Dry run: `npm run release:cut:dry-run -- --allow-dirty` (or `npx tsx scripts/release-cut/run-release-cut.ts --dry-run --allow-dirty --no-main-guard`).

**Public repo `AppEndO-Release`:** after `npm run build`, `npm run release:export-appendo-release` (or release-cut P8 when `dist/server.cjs` exists). Push with `npm run release:push-appendo-release` or `npm run release:cut -- --push-appendo-release` after cloning `../AppEndO-Release`. Do not use `releases/public/` in the private monorepo.

P5 tests default to `test:release-cut` and `test:release-cut-packaging` (package pipelines run in P4). Optional: `--with-test-critical`, `--with-repo-lint`.
