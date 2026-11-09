# AppEndO — Public release 0.0.4

[![Release](https://img.shields.io/github/v/tag/mirshahreza/AppEndO-Release?label=release)](https://github.com/mirshahreza/AppEndO-Release/releases)

This repository is the **official public OSS snapshot** of **AppEndO**: platform source (scrubbed), a **production build**, and **ecosystem ZIPs** you can install from the studio. It is published from the private development monorepo via the **AppEndO-Release** pipeline—not a casual fork of the full product tree.

| Path | Contents |
| --- | --- |
| **`dist/`** | Production server (`server.cjs`) + Vite client assets — run with Node 22 |
| **`source/`** | Full platform source to rebuild, audit, or contribute (Hawiety private package paths **removed**) |
| **`packages/`** | Copy of bundled package ZIPs |
| **`cms-*.zip`** · **`remote-hubs-*.zip`** | Same ZIPs at repo root for simple download / hosting |
| **`MANIFEST.json`** | Version, SHA-256 checksums, bundled package ids |

**Bundled in this release:** `cms`, `remote-hubs`. **Not included:** Hawiety or other private vertical packages from the commercial monorepo.

Upstream development (private): [mirshahreza/AppEndO](https://github.com/mirshahreza/AppEndO) is not this snapshot; use **this repo** for public distribution of the OSS platform + CMS + Remote Hubs.

---

## What is AppEndO?

**AppEndO** is a self-hosted **enterprise platform** for organizations that run custom business applications—not a blogging CMS or out-of-the-box ERP suite. **Operators and builders** use the back-office studio; **everyday end users** use **front-office** portals and vertical apps on the same stack. Public sites, customer portals, and branded experiences share one **relational control plane** (**SQL Server** default and recommended; PostgreSQL, MySQL, and SQLite supported on the install wizard) with optional **multiple external databases**.

The ecosystem is built around **ready-made packages** (extensions and vertical apps) from the Packages hub, plus **Server Functions**, **Data Studio**, and the **Workflow Engine** for deep customization. **Platform experiences** route traffic by culture, portal, and page. AppEndO is **platform-first**: one stack for **back-office + front-office**.

**Control plane (2026):** **SQL Server** is the default and recommended relational database (`settings.example.json`). New `base_*` tables use **Sequelize**; remaining Prisma usage is legacy and not extended in new work.

### Who it's for

| Audience | Typical user | What they do |
| --- | --- | --- |
| **Builders** | Developers, integrators | Data Studio, Server Functions, Client Components, Workflows, custom packages |
| **Operators** | Admins, IT, business owners | Install packages, configure settings, users, roles, org/geo scope |
| **End users** | Staff, customers, public visitors | Portals, forms, work items, self-service—no studio access |

---

## Built-in platform (core install)

| Area | Included out of the box |
| --- | --- |
| **Identity** | Users · roles · JWT (HttpOnly cookies) · OAuth/OIDC · profiles · Function Access Control · Record Policy |
| **Admin shell** | Studio navigation · Home dashboard · RBAC · PWA · Theme Designer · notifications |
| **Front-office** | Portals · vertical apps · culture-localized routes |
| **Data** | Multi-engine control plane · edge data sources · **Data Studio** · **Workbooks** |
| **Development** | Idea Foundry · **Client Components** · **Base Components** · **Server Functions** · **API Talk** · Packages hub · Git workspace |
| **Workflows** | Native **Workflow Engine** (design, run, human tasks, escalation, webhooks, MCP actions) |
| **Operations** | Cache · logs · jobs · cron · File Manager · Platform Transfer · optional **Remote Hubs** (this release) |
| **AI** | In-app agent · MCP packs · designer AI · optional external MCP |
| **Install** | Browser **install wizard** · CLI `npm run setup` for PostgreSQL-only bootstrap |

LOB modules (CRM, HR, commerce, …) are **ecosystem packages**. **CMS** is a shipped editorial package (bundled here).

---

## Features (summary)

- **Identity & access** — RBAC, OAuth/OIDC, Record Policy, Function Access Control  
- **Data Studio & Data API** — Visual models, REST Data APIs, SQL Console  
- **Workflow Engine** — Durable workflows, work items, assignment strategies, four-eyes  
- **Server Functions** — Sandboxed TS/JS APIs with OpenAPI  
- **Client Components & CRUD Set** — Visual UI from Base Components catalog  
- **Packages** — Install/export ZIPs from Package Manager  
- **AI & MCP** — In-app agent, built-in tool packs, inbound MCP host  
- **Settings** — Central config: auth, email, cultures, AI, PWA, attributes  

Full product narrative and comparison tables: see **`source/README.md`** in this release (mirror of the private monorepo readme).

---

## Quick start (this release artifact)

### Prerequisites

- [Node.js 22](https://nodejs.org/) and npm  
- A control-plane database (SQL Server recommended; PostgreSQL, MySQL, SQLite via wizard)

### Run the pre-built server (fastest)

```bash
cd dist
# Configure settings.json at repo / install root per your layout — see source/docs
node server.cjs
```

For a typical layout, copy `source/settings.example.json` → `settings.json`, run the install wizard at `/install`, or use `npm run setup` from **`source/`** when using PostgreSQL CLI bootstrap.

From **`source/`** (rebuild or dev):

```bash
cd source
cp .env.example .env
npm install
npm run dev
```

Open [http://localhost:3000/install](http://localhost:3000/install) for first-time setup.

### Production from source

```bash
cd source
npm install
npm run build
npm run start
```

Or use the **`dist/`** tree in this repo without rebuilding.

Default **development** seed login (change in production):

| Field | Value |
| --- | --- |
| Email | `admin@append.os` |
| Password | `admin123` |

Health: `GET /api/health` · `GET /api/ready`.

---

## Bundled packages (install in studio)

| Package | ZIP in this repo | Purpose |
| --- | --- | --- |
| **CMS** | `cms-*.zip` | Editorial content, vocabularies, CMS studio nav |
| **Remote Hubs** | `remote-hubs-*.zip` | File Hub (SFTP/FTP) · SSH Hub · RDP Hub |

Install via **Package Manager** in the studio (upload ZIP or use packaged artifacts under `packages/`). Verify checksums against **`MANIFEST.json`**.

After Remote Hubs install: `npm run remote-hubs:install` equivalent is handled via package install; restart the server. RDP requires `guacd` on the host (see **`source/README.md`** — Remote Hubs section).

---

## Studio map (after install + CMS)

| Group | Pages |
| --- | --- |
| **Home** | Dashboard widgets, pinned pages |
| **Development** | Data Studio · Server Functions · Client Components · Workflows · Jobs · Settings · … |
| **Extensions** | Package Manager · Libraries |
| **Records** | Users · Roles · Base Info · Workbooks · Logs |
| **CMS** | (when CMS package installed) |

---

## Secrets at rest

Production requires `APPENDO_CREDENTIAL_MASTER_KEY` (32 bytes, 64 hex chars). Hub and vault secrets use AES-256-GCM. See **`source/README.md`** — *Secrets at rest*.

```bash
openssl rand -hex 32
```

---

## Documentation in `source/`

| Topic | Path |
| --- | --- |
| Why AppEndO | [Put Reins on AI Coding—and Build Beyond the Demo](source/docs/outreach/why-appendo.md) |
| Why AppEndO (فارسی) | [نسخهٔ فارسی مقاله](source/docs/outreach/why-appendo-fa.md) |
| Architecture | `source/src/ARCHITECTURE.md` |
| Feature map | `source/docs/appendo-features.md` |
| Data Studio | `source/docs/standards/data-studio.md` |
| Packages | `source/docs/standards/package-ui.md` |
| AI / MCP | `source/docs/standards/ai-mcp.md` |
| Contributors | `source/AGENTS.md` |

---

## License

AppEndO uses a **custom license** (Apache 2.0 base + **Section A** terms). Read **`source/LICENSE`** in full before redistribution.

This **AppEndO-Release** repository is the designated **public OSS distribution** of the platform snapshot and bundled CMS / Remote Hubs artifacts. **Do not** republish Hawiety or other private packages from the commercial monorepo.

---

## Verify this release

```bash
# Example: confirm CMS zip (see MANIFEST.json for exact filename)
sha256sum cms-*.zip
```

Platform version: **0.0.4** · Manifest created: see **`MANIFEST.json`**.

**Issues & contributions:** use the official upstream project channels; this repo tracks **published releases** (tags `vX.Y.Z`).
