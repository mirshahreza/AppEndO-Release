# Local release cut

Operator entry: `npm run release:cut` or `@appendo-release-cut`.

- **No GitHub Actions** — all heavy work runs on your machine (no Actions minutes).
- **Not triggered by push** — only when you invoke the skill or npm script.
- Artifacts: `dist/release-cut/<runId>/` (`REPORT.md`, `checkpoint.json`, `public-oss/`, `artifacts/packages/`).

Plan: `plans/core/todo/p-130-local-release-cut.md`.

Public OSS lives in git repo **`AppEndO-Release`** (sibling clone `../AppEndO-Release`), not under `releases/` in the private monorepo.

```bash
npm run release:export-appendo-release
npm run release:push-appendo-release
# or: npm run release:cut -- --push-appendo-release
```

**One-time:** create public repo `AppEndO-Release` on GitHub (`gh auth login`, then `gh repo create <owner>/AppEndO-Release --public`), clone to `../AppEndO-Release`, then push. Override clone path with `APPENDO_RELEASE_REPO_PATH`.

Staging (gitignored in private repo): `.appendo-release-staging/vX.Y.Z/`.

**Hawiety (private):** `npm run release:export-appendo-hawiety` · `npm run release:push-appendo-hawiety` → **`AppEndO-Hawiety`**. ZIP **promoted**, not re-packed on export.

**Clone profiles (isolated DB):** exports strip `settings.json` and emit `source/settings.recommended.json` + `CLONE_PROFILE.md`. Registry: `releaseCutCloneProfiles.ts` · package deploy lines: `releaseCutPackageDeployLines.ts`. Bootstrap: `npm run clone:bootstrap -- --profile oss|hawiety`.
