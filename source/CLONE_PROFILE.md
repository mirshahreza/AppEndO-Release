# Clone profile — public OSS (`oss`)

Use this **AppEndO-Release** snapshot with a **dedicated control-plane database**, not the private monorepo `AppEnd` database.

| Item | Value |
| --- | --- |
| Recommended database | `AppEndORelease` |
| Dev port (beside monorepo) | `3000` |
| Settings starter | `settings.recommended.json` |

## Bootstrap (first run)

1. Create empty SQL Server database `AppEndORelease` (or run `ensure-clone-databases.sqlserver.sql` in this folder, or let the install wizard create it).
2. From **`source/`**:

```bash
# From AppEndO monorepo (recommended):
npx tsx ../AppEndO/scripts/release-cut/bootstrap-clone-profile.ts --profile oss --inherit-credentials --force
npx tsx ../AppEndO/scripts/release-cut/run-clone-install-wizard.ts --profile oss
npx tsx ../AppEndO/scripts/release-cut/provision-clone-database.ts --profile oss
```

3. On a **fresh** database, finish install once (headless wizard above, or browser: `http://localhost:3000/install`) **before** provision.
4. Install bundled ZIPs from `../packages/` (cms, remote-hubs) via Package Manager.

## Rules

- **Never commit** `settings.json`, `.env`, or `settings.json.*.tmp` to this git repo.
- Copy `settings.example.json` only if you need the full platform template; prefer `settings.recommended.json` for this line.

See root **README.md** for the full public distribution guide.
