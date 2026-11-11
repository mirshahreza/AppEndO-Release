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
npm run clone:bootstrap -- --profile hawiety
npm install
npm run schema:install-extensions
npm run schema:install-extensions:hwy
npm run dev
```

3. Open `http://localhost:{{RECOMMENDED_DEV_PORT}}/install` if install is still pending.
4. Install **`hawiety-*.zip`** from `../packages/` via Package Manager (ZIP is promoted at export — no re-pack here).
5. Member data: use **ETL Console** — package install does not seed production members.

## Edge / legacy SQL

Optional read-only legacy SQL (for ETL parity) is configured in Studio **Data Sources** after bootstrap — not copied from the operator monorepo.

## Rules

- **Never commit** `settings.json`, `.env`, or `settings.json.*.tmp` to this private repo.
- Keep this repository **private**.

See root **README.md** for promote policy and security notes.
