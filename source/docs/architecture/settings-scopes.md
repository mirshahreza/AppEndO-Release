# Settings storage model

AppEndO settings are split by **scope** — not by accident, but by deployment topology.

## Scopes

| Scope | Storage | Applies to |
| --- | --- | --- |
| **Platform-wide** | Control-plane DB (`base_settings_sections`) | Every node connected to the same PostgreSQL |
| **This node** | `settings.json` → `runtime` | Only this server process |
| **Data model** | Control-plane tables (`base_settings_*`) | Structured definitions (attributes, profile fields) |

## Platform-wide sections (DB)

Blob sections (JSON documents):

- `ai` — providers, models, MCP, API keys
- `cache` — driver + Redis connection (shared)
- `platformCultures` — locale packs
- `identity-providers` — OAuth configuration
- `security` — JWT signing secrets (shared)
- `scheduler` — scheduled tasks
- `git` — Git integration settings

Flat app sections (via `appSettingsCache`):

- `server-functions`, `logs`, `auth`, `email`, `pwa`, `logging`

Seeded during **install wizard** and **`npm run setup`** from `settings.example.json` (wizard-only migration — no auto-migrate on boot).

## Node-local (`settings.json`)

- `runtime.port`, `runtime.nodeName`, `runtime.capabilities`, `runtime.logLevel`, HMR flags
- `database`, `dataSources`, `plugins`, `install` state

Env overrides: `APPENDO_NODE_NAME`, `APPENDO_NODE_CAPABILITIES`.

## API

| Endpoint | Purpose |
| --- | --- |
| `POST /api/settings/transfer/export` | Export selected platform sections |
| `POST /api/settings/transfer/import` | Import selected platform sections |
| `GET/PUT /api/settings/node` | Node-local runtime |
| `GET/PUT /api/settings/security` | Platform JWT secrets |
| `GET /api/settings/export/platform` | Export platform blobs |
| `POST /api/settings/import/platform` | Import platform blobs |

## UI

Settings workspace nav is grouped: **Platform-wide** · **This node** · **Data model**, each with scope badges.
