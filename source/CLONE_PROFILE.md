# Clone profile — source-available public snapshot (`oss`)

Use this **AppEndO-Release** snapshot with a **dedicated control-plane database**, not a shared development database.

| Item | Value |
| --- | --- |
| Recommended database | `AppEndORelease` |
| Dev port (beside another install) | `3100` |
| Settings starter | `settings.recommended.json` |

## Bootstrap (first run)

1. Create empty SQL Server database `AppEndORelease` (or run `ensure-clone-databases.sqlserver.sql` in this folder).
2. From **`source/`**:

```bash
cp settings.recommended.json settings.json   # or merge into your existing settings.json
cp .env.example .env
npm install
npm run dev
```

3. Open [http://localhost:3100/install](http://localhost:3100/install) and complete the wizard on a **fresh** database.
4. Install bundled ZIPs from `../packages/` (cms, remote-hubs) via Package Manager.

## Rules

- **Never commit** `settings.json`, `.env`, or `settings.json.*.tmp` to this git repo.
- Prefer `settings.recommended.json` for this isolated line.

See the release repository **README.md** for the full public snapshot guide.