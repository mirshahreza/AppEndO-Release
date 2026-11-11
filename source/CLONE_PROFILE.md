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
npm run clone:bootstrap -- --profile oss
npm install
npm run dev
```

3. Open `http://localhost:3000/install` and finish the wizard.
4. Install bundled ZIPs from `../packages/` (cms, remote-hubs) via Package Manager.

## Rules

- **Never commit** `settings.json`, `.env`, or `settings.json.*.tmp` to this git repo.
- Copy `settings.example.json` only if you need the full platform template; prefer `settings.recommended.json` for this line.

See root **README.md** for the full public distribution guide.
