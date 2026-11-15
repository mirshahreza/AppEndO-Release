# Local release cut

Operator invokes **`@appendo-release-cut`** or `npm run release:cut` after normal work on `main`. Menu **انتشار → 1**: run full local cut (patch bump) when `main` has commits since the latest `release/v*` tag, then push private + **AppEndO-Release** + **AppEndO-Vertical**; re-export only when already tagged at `HEAD`.

- Orchestrator: `scripts/release-cut/run-release-cut.ts`
- Plan: `plans/core/todo/p-130-local-release-cut.md`
- **No GitHub Actions** for release (avoid Actions minutes); all heavy steps run locally.
- Public OSS includes **cms** + **remote-hubs** only; **vertical** zips stay in private run artifacts. Staging for the public repo: `.appendo-release-staging/vX.Y.Z/`; git remote **`AppEndO-Release`** (sibling clone `../AppEndO-Release`).

Dry run: `npm run release:cut:dry-run -- --allow-dirty` (or `npx tsx scripts/release-cut/run-release-cut.ts --dry-run --allow-dirty --no-main-guard`).

**Public repo `AppEndO-Release`:** after `npm run build`, `npm run release:export-appendo-release` (or release-cut P8 when `dist/server.cjs` exists). Push with `npm run release:push-appendo-release` or `npm run release:cut -- --push-appendo-release` after cloning `../AppEndO-Release`. Do not use `releases/public/` in the private monorepo.

**Private repo `AppEndO-Vertical`:** `npm run release:export-appendo-vertical` copies **full source** + `dist/` + promotes existing `vertical-*.zip` (no pack on export). Push: `npm run release:push-appendo-vertical` or `npm run release:cut -- --push-appendo-vertical` to sibling `../AppEndO-Vertical` (private GitHub). Tag: `vertical/vX.Y.Z`. Locale: Vertical README/templates **English**; product UI **Arabic (iq)** — **no Persian** in Vertical seeds or repo-facing docs (`package-vertical-locale-policy`).

**RCUT-9 — server deploy (incremental):** config lives in the **publish clone** (not the private monorepo): `../AppEndO-Release/deploy.target.local.json` and `../AppEndO-Vertical/deploy.target.local.json` (copy from `deploy.target.example.json` shipped on export — see `DEPLOY.md`). Push preserves `deploy.target.local.json`. Env fallback: `APPENDO_DEPLOY_ROOT_*` / `APPENDO_DEPLOY_URL_*`. Incremental: staging `dist/` + `packages/` only. `npm run release:deploy -- --target oss|vertical|all`.

P5 tests default to `test:release-cut` and `test:release-cut-packaging` (package pipelines run in P4). Optional: `--with-test-critical`, `--with-repo-lint`.

**P9 — clone database structure (no ETL):** runs after P7, before P8 export/push. Default **on** for full cut (no `--fast`); off with `--fast` or `--skip-clone-schemas`. For each relevant clone profile (`oss` when OSS is in scope; `vertical` when `vertical` is in `--publish-packages`), runs `npm run clone:provision -- --profile …` (control-plane extensions + package SQL install flags only — not legacy ETL). Extend `scripts/release-cut/cloneProfilesForSchemaSync.ts` when a new package line gets its own DB.

## Clone profiles (isolated database per git line)

Each export ships a **clone profile** so AppEndO-Release and AppEndO-Vertical (and future `AppEndO-<Package>` repos) never reuse the private monorepo `AppEnd` database by default.

| Profile | Repo line | Recommended DB | Dev port |
| --- | --- | --- | --- |
| `oss` | AppEndO-Release | `AppEndORelease` | 3100 |
| `vertical` | AppEndO-Vertical | `AppEndOVertical` | 3200 |

**Export behavior:** snapshots exclude operator `settings.json`, `.env`, `settings.json.*.tmp`, `workspace/models/` (local ONNX), appendoo agent runtime state dirs, and `*.onnx` blobs; each `source/` tree includes `settings.recommended.json`, `CLONE_PROFILE.md`, and `CLONE_PROFILE.json`. Push refuses dirty snapshots (`assertReleaseCutSourceSnapshotSanitized`). Clone push resets to `origin/main` before replacing the tree (drops failed local-only commits).

**Registry (extend for new packages):** `scripts/release-cut/releaseCutCloneProfiles.ts` · private deploy lines `releaseCutPackageDeployLines.ts`.

**Bootstrap on a clone:**

```bash
npx tsx scripts/release-cut/bootstrap-clone-profile.ts --profile vertical --inherit-credentials --force
npx tsx scripts/release-cut/provision-clone-database.ts --profile vertical
```

`--inherit-credentials` copies JWT/runtime secrets needed to decrypt `passwordCipher` plus SQL host material from monorepo `settings.json` (separate database name per profile).

**Windows dev (integrated SQL auth):** when `sqlcmd -E` works but Node cannot use `sa` with an empty password, run `npm run clone:install-wizard` — it creates SQL login `appendo_clone_dev` via `sqlcmd -E` (password in `.appendo-clone-work/clone-sql-login.password`, or set `APPENDO_CLONE_SQL_PASSWORD`). Full copy of `AppEnd` via backup needs ~300GB free disk on this machine; prefer wizard + `clone:provision` for schema-only clones.

**Headless flow (monorepo, recommended):** `clone:bootstrap -- --profile … --inherit-credentials --force` → `clone:install-wizard -- --profile …` (runs if install still pending) → `clone:provision -- --profile …`. `clone:provision` swaps clone `settings.json` into the monorepo, runs `schema:install-extensions`, and for `vertical` runs `vertical:install` with `--skip-legacy-parity` (greenfield DB has no ETL parity tables yet) plus `schema:install-extensions:vx`, then restores monorepo `settings.json`.

`npm run clone:bootstrap` · `npm run clone:install-wizard` · `clone:provision` · `clone:db-from-template` (backup/restore; skip when disk is tight). On Windows use `npx tsx scripts/release-cut/... --profile oss|vertical` when npm swallows `--profile`. Manual Vertical install on an empty DB: `npm run vertical:install -- --skip-legacy-parity`.

**Dev beside monorepo:** fixed API ports — monorepo **3000**, Release OSS **3100**, Vertical **3200** (Vite child API+200). Set `APPENDO_SETTINGS_PATH` to the clone `source/settings.json`, then `npm run restart` from monorepo root; default **strict** mode (`APPENDO_DEV_PORT_STRICT=1`) stops only that line’s ports and refuses port hopping.
