# AppEndO Hawiety — v{{PLATFORM_VERSION}} (Hawiety {{HAWIETY_VERSION}})

**Private deployment snapshot** for the **AppEndO-Hawiety** repository — not for public redistribution. Full **source** (with Hawiety paths), **`dist/`**, promoted ZIPs: {{BUNDLED_PACKAGES}}.

| Path | Purpose |
| --- | --- |
| **`dist/`** | Production build — Node 22 |
| **`source/`** | Full platform snapshot |
| **`packages/`** | ZIP copies including **`hawiety-*.zip`** |
| **`MANIFEST.json`** | Versions, SHA-256, `hawietyPromoteMode: reuse-zip` |

## Promote policy (no pack on export)

Export **reuses** `runtime/package-artifacts/hawiety/hawiety-*.zip`. Run `hawiety:pack` only on `release:cut` when the Hawiety version changes.

## Isolated development (separate database)

Do **not** point this clone at the private monorepo `AppEnd` database. Each git line uses its own control-plane database:

| Item | Value |
| --- | --- |
| Recommended database | `AppEndOHawiety` |
| Dev port (run beside monorepo) | `3001` |
| Starter settings | `source/settings.recommended.json` |
| Operator guide | `source/CLONE_PROFILE.md` |

From **`source/`**:

```bash
npm run clone:bootstrap -- --profile hawiety
npm install
npm run schema:install-extensions
npm run schema:install-extensions:hwy
npm run dev
```

Install **`hawiety-*.zip`** from `packages/` in Package Manager. Member data: **ETL Console** (no member seed on package install).

**Never commit** `settings.json`, `.env`, or `settings.json.*.tmp` to this repo.

## Security

Keep this repo **private**. Rotate production secrets on the server.

Platform **{{PLATFORM_VERSION}}** · Hawiety **{{HAWIETY_VERSION}}**.
