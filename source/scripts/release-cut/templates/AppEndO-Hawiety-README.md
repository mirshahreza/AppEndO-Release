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

## Security

Keep this repo **private**. Rotate production secrets on the server.

Platform **{{PLATFORM_VERSION}}** · Hawiety **{{HAWIETY_VERSION}}**.
