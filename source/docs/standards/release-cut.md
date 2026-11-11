# Local release cut

Operator invokes **`@appendo-release-cut`** or `npm run release:cut` after normal work on `main`. Menu **انتشار → 1**: run full local cut (patch bump) when `main` has commits since the latest `release/v*` tag, then push private + **AppEndO-Release** + **AppEndO-Hawiety**; re-export only when already tagged at `HEAD`.

- Orchestrator: `scripts/release-cut/run-release-cut.ts`
- Plan: `plans/core/todo/p-130-local-release-cut.md`
- **No GitHub Actions** for release (avoid Actions minutes); all heavy steps run locally.
- Public OSS includes **cms** + **remote-hubs** only; **hawiety** zips stay in private run artifacts. Staging for the public repo: `.appendo-release-staging/vX.Y.Z/`; git remote **`AppEndO-Release`** (sibling clone `../AppEndO-Release`).

Dry run: `npm run release:cut:dry-run -- --allow-dirty` (or `npx tsx scripts/release-cut/run-release-cut.ts --dry-run --allow-dirty --no-main-guard`).

**Public repo `AppEndO-Release`:** after `npm run build`, `npm run release:export-appendo-release` (or release-cut P8 when `dist/server.cjs` exists). Push with `npm run release:push-appendo-release` or `npm run release:cut -- --push-appendo-release` after cloning `../AppEndO-Release`. Do not use `releases/public/` in the private monorepo.

**Private repo `AppEndO-Hawiety`:** `npm run release:export-appendo-hawiety` copies **full source** + `dist/` + promotes existing `hawiety-*.zip` (no pack on export). Push: `npm run release:push-appendo-hawiety` or `npm run release:cut -- --push-appendo-hawiety` to sibling `../AppEndO-Hawiety` (private GitHub). Tag: `hawiety/vX.Y.Z`. Server upload (FTP/rsync) is RCUT-9. Locale: Hawiety README/templates **English**; product UI **Arabic (iq)** — **no Persian** in Hawiety seeds or repo-facing docs (`package-hawiety-locale-policy`).

P5 tests default to `test:release-cut` and `test:release-cut-packaging` (package pipelines run in P4). Optional: `--with-test-critical`, `--with-repo-lint`.

## Clone profiles (isolated database per git line)

Each export ships a **clone profile** so AppEndO-Release and AppEndO-Hawiety (and future `AppEndO-<Package>` repos) never reuse the private monorepo `AppEnd` database by default.

| Profile | Repo line | Recommended DB | Dev port |
| --- | --- | --- | --- |
| `oss` | AppEndO-Release | `AppEndORelease` | 3000 |
| `hawiety` | AppEndO-Hawiety | `AppEndOHawiety` | 3001 |

**Export behavior:** snapshots exclude operator `settings.json`, `.env`, `settings.json.*.tmp`, `workspace/models/` (local ONNX), appendoo agent runtime state dirs, and `*.onnx` blobs; each `source/` tree includes `settings.recommended.json`, `CLONE_PROFILE.md`, and `CLONE_PROFILE.json`. Push refuses dirty snapshots (`assertReleaseCutSourceSnapshotSanitized`). Clone push resets to `origin/main` before replacing the tree (drops failed local-only commits).

**Registry (extend for new packages):** `scripts/release-cut/releaseCutCloneProfiles.ts` · private deploy lines `releaseCutPackageDeployLines.ts`.

**Bootstrap on a clone:**

```bash
cd source
npm run clone:bootstrap -- --profile oss
# or: --profile hawiety [--database CustomName] [--force]
```

Same command works on the private monorepo when testing an isolated DB name before export.
