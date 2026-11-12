# Clone profile — Hawiety private deploy (`hawiety`)

Use this **AppEndO-Hawiety** snapshot with a **dedicated control-plane database**, not the private monorepo `AppEnd` database.

| Item | Value |
| --- | --- |
| Recommended database | `{{RECOMMENDED_DATABASE}}` |
| Dev port (beside monorepo) | `{{RECOMMENDED_DEV_PORT}}` |
| Settings starter | `settings.recommended.json` |

## Bootstrap (first run)

1. Create empty SQL Server database `{{RECOMMENDED_DATABASE}}` (or run `ensure-clone-databases.sqlserver.sql` for both clone DB names).
2. From **`source/`**:

```bash
# From AppEndO monorepo (recommended — avoids npm install inside clone):
npx tsx ../AppEndO/scripts/release-cut/bootstrap-clone-profile.ts --profile hawiety --inherit-credentials --force
npx tsx ../AppEndO/scripts/release-cut/provision-clone-database.ts --profile hawiety
```

Or from monorepo root: `npm run clone:bootstrap -- --profile hawiety --inherit-credentials --force` → `npm run clone:install-wizard -- --profile hawiety` → `npm run clone:provision -- --profile hawiety`.

3. On a **fresh** database, finish install once (headless: `clone:install-wizard`, or browser: `http://localhost:{{RECOMMENDED_DEV_PORT}}/install`) **before** `clone:provision`. Hawiety provision skips legacy edge parity on greenfield; run `npm run hwy:etl:legacy-edge-parity` after importing legacy member tables.
4. Install **`hawiety-*.zip`** from `../packages/` via Package Manager (ZIP is promoted at export — no re-pack here).
5. Member data: use **ETL Console** — package install does not seed production members.

## Edge / legacy SQL

Optional read-only legacy SQL (for ETL parity) is configured in Studio **Data Sources** after bootstrap — not copied from the operator monorepo.

## Rules

- **Never commit** `settings.json`, `.env`, or `settings.json.*.tmp` to this private repo.
- Keep this repository **private**.

See root **README.md** for promote policy and security notes.
