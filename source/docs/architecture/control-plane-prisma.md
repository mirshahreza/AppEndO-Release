# Control plane (Prisma) vs edge (EdgeDbRouter)

> **Prisma is locked.** Do not add Prisma models or calls unless the operator explicitly grants Prisma for that task. Canonical rule: [`docs/standards/data-model.md`](../standards/data-model.md) (`data.prisma.locked`). New `base_*` tables use Sequelize (`controlPlaneSequelize`). This page describes the **legacy** Prisma control-plane path.

AppEndO has **two data layers** with distinct responsibilities (constitution DB-01…DB-05, p-45).

## Control plane — `base_*` tables

| Concern | Implementation |
|---------|----------------|
| Tables | `base_users`, `base_roles`, `base_settings_*`, `base_info`, `base_workflow_*`, `base_work_items`, logs, jobs, AI session metadata, … |
| Access (v1 target) | **Prisma 7** + driver adapter (`@prisma/adapter-pg`, mariadb, better-sqlite3, mssql) |
| **Legacy path** | `pg.Pool` + deprecated `controlPlaneGet/Execute` (no remaining callers) · `initDB()` retained for manual scripts only |
| Settings | `settings.json` → `database.provider` · `database.url` · `database.engine` (`pg-pool` \| `prisma`) |
| Bootstrap | `initPrismaControlPlane()` + `ensureControlPlaneInitialized()` in [`controlPlaneInit.ts`](../../src/server/db/controlPlaneInit.ts) |
| Schema | [`prisma/schema.prisma`](../../prisma/schema.prisma) — physical names `base_*` + `snake_case` via `@@map` / `@map` |

**Providers v1:** PostgreSQL (primary), MySQL, SQLite, SQL Server.

**Install wizard coverage (p-52 closed 2026-09-15):**

| Provider | Wizard E2E |
|----------|------------|
| PostgreSQL | Human-tested (p-49) |
| SQL Server | Human-tested |
| SQLite | Machine-tested (3× `install:reset` → complete) |
| MySQL | Not tested |

**Not in control plane:** Oracle — Prisma does not support it as a control-plane provider.

## Edge / runtime — user data sources

| Concern | Implementation |
|---------|----------------|
| Sources | `settings.json` → `dataSources[]` (created at install / admin UI) |
| Access | [`EdgeDbRouter`](../../src/core/database/EdgeDbRouter.ts) |
| Use cases | CRUD-Gen, edge scripts, package DB resources, designer runtime queries |
| Providers | PostgreSQL, MySQL, SQLite, SQL Server, **Oracle** |

MongoDB and Redis are **not supported** as data source types (decision 2026-09-03). Redis may still be used as a platform **cache** backend (`cache.driver: 'redis'`, unrelated to Data Sources / EdgeDbRouter).

## Rules

1. **Never** route `base_*` through EdgeDbRouter (DB-05).
2. **Greenfield only** for multi-DB control plane — no runtime migration from legacy PG-only installs.
3. PL/pgSQL helpers (`zz_calculate_hid`, `zz_insert_base_info_node`) are **deprecated** — logic lives in [`baseInfoHid.ts`](../../src/server/domain/base-info/baseInfoHid.ts).
4. Prisma bootstrap: set `database.engine` to `prisma` in `settings.json`. Install wizard writes `database.provider` + `database.url` for all four providers (PRM-5). Schema + seed use `ensureControlPlaneInitialized` (PRM-4).

## Schema sync (upgrades)

`prisma db push --accept-data-loss` **drops every table that is not in** `prisma/schema.prisma`. That includes domain/package tables on customer instances. Do not use it as an upgrade command.

```bash
npm run db:sync-schema              # safe default — additive migrate-diff; unknown tables kept
npm run db:sync-schema -- --help
npm run db:sync-schema -- --destructive   # DANGEROUS: old db push (drops unknown tables)
```

`npm run prisma:push` is an alias of the safe sync. Empty / greenfield databases still get the full control-plane schema.

## Smoke / dev commands

```bash
npm run prisma:generate
npm run prisma:smoke -- sqlite
npm run prisma:smoke -- mysql      # requires DATABASE_URL
DATABASE_URL=postgresql://... npm run prisma:smoke -- postgresql
```

See this document (Prisma multi-database control plane — shipped).
