# Data model conventions

> **Shard:** `data-model` · **Identity profile:** [`identity-profile.md`](./identity-profile.md)

## Core control-plane table naming
- Physical tables owned by AppEndO **core** (control plane) MUST use the `base_` prefix with `snake_case` names (e.g. `base_users`, `base_workflow_definitions`, `base_work_items`).
- **New** control-plane tables: Sequelize models on `controlPlaneSequelize` (`src/server/db/controlPlaneSequelize.ts`), physical names via `tableName` / `field`. Domain repositories in `src/server/domain/<context>/` own CRUD. Do not add Prisma models.
- Edge/user data sources and package runtime SQL use domain naming **without** `base_` unless the entity is explicitly a platform control-plane table.
- When adding a new core feature, ship a Sequelize `base_` table from day one — no unprefixed control-plane tables.

## Prisma is locked

**MUST NOT** use Prisma for new work (new `model` in `prisma/schema.prisma`, new `getPrismaControlPlane()` / `prisma.base*` calls, new Prisma migrations, or “while we are here” Prisma schema growth).

**NEVER** choose Prisma because neighboring tables already use it.

**Allowed only** when the operator **explicitly and clearly** grants Prisma for that specific task (plain language in the current prompt — not implied by old docs, p-45, or existing `Base*` models).

Existing Prisma control-plane code is **legacy**. Do not extend it. Edge/Data API table I/O already uses Sequelize (`EdgeSequelizeFactory` / `DataApiExecutor`).

**IDs:** `data.prisma.locked`

## Audit fields
- Include `created_at`, `created_by`, `updated_at`, `updated_by` where appropriate.
- `_by` fields: nullable FK to `base_users(id)`; set from authenticated actor; `NULL` for system rows.

## Note vs description
- Human remarks: column/property `note`.
- Reserve `description` for product copy, manifest metadata, established domain semantics.

## Natural person vs legal entity (platform identity)
- Anyone who **logs in** is `base_users` + `base_user_profiles` (1:1).
- `person_type_code` (`100.2.1` Individual / `100.2.2` Company) is chosen at **create**, locked after create; conditional profile fields — not separate contact/account tables.
- Package domains (CRM, Commerce, …) extend with optional 1:1 tables on `user_id`; do not duplicate core identity columns.
- Full rules, field matrix, and CRM lessons: [`identity-profile.md`](./identity-profile.md).

## Latin slug identifiers
- Pattern: `/^[a-z0-9._-]+$/` (`LATIN_SLUG_RE` in `src/shared/lib/latinSlug.ts`).
- Use `sanitizeLatinSlugInput` / `validateLatinSlug` at boundaries.
- URL segments: `UrlSegmentSlugInput` with leading `/` outside the field.
- Platform Applications create forms default `enabled: true` (exception to enabled-gated default-off).

## Control-plane database provider

- SQL Server is the **default and recommended** control-plane database. PostgreSQL, MySQL, and SQLite remain supported choices on the install wizard. Coverage as of 2026-09-15: PostgreSQL and SQL Server human-tested; SQLite machine-tested; MySQL not tested.
- The provider is chosen **once** during setup. Boot, restart, `ensureRuntimeSettings`, and `ensureDataSourcesSettings` MUST NOT rewrite `database.provider`, `runtime.databaseProvider`, or the default data source type to a different engine — especially not a silent fallback to PostgreSQL / `pg-pool`.
- Missing `database.engine` is Prisma. `pg-pool` is valid only when the stored provider is already PostgreSQL and the engine is set explicitly.
- Corrupt `settings.json` must fail boot (or reuse the last good in-memory copy). Never treat parse failure as empty settings and stamp PostgreSQL defaults.

**IDs:** `data.control-plane.sqlserver-default`, `data.control-plane.provider-locked-after-setup`

## Reusable DB utilities
- General helpers/procedures: `zz_` prefix.
- Domain objects: standard domain naming.

## Schema ownership (layers)

Non-Prisma database objects have a **single canonical upgrade path** per layer. Server boot may still run idempotent `ensure*` helpers; operators and CI should prefer the commands below.

| Layer | Source of truth | Upgrade command |
|-------|-----------------|-----------------|
| Prisma `base_*` | `prisma/schema.prisma` | `npm run db:sync-schema` |
| Sequelize feature `base_*` (not in Prisma) | `src/server/db/ensureControlPlaneFeatureTables.ts` | `npm run schema:install-extensions` |
| Hawiety core tables | `scripts/hwy-phase1/db/install/hwy_schema.sqlserver.sql` | `npm run schema:install-extensions:hwy` |
| Hawiety satellite DDL | `ensureHwy*Schema.ts` + matching `scripts/hwy-phase1/db/install/*.sql` | same |
| Hawiety procs/views | `ensureHwyDbObjects` / `hwy_db_*.sqlserver.sql` | `npm run hwy:db-objects` (included in `--hwy` install) |
| Edge package tables (`cms_*`, …) | Package / Data Studio deploy | Package install — not Prisma sync |

Machine index: `src/config/controlPlaneSchemaOwnership.ts` · report: `npm run schema:ownership-report` · finance probe: `npm run schema:finance-parity-probe` · Hawiety ownership status (**closed on dev**): [`scripts/schema/schema-ownership-closeout.md`](../../scripts/schema/schema-ownership-closeout.md) · [`scripts/schema/schema-ownership-backlog.md`](../../scripts/schema/schema-ownership-backlog.md).

Default `CONTROL_PLANE_SCHEMA_PROTECTED_TABLES` merge includes `hwy_*`, `vw_hwy_*`, `cms_*`, `zz_*` prefixes plus boot markers (see `controlPlaneSchemaProtectedTables.ts`).

**IDs:** `data.control-plane.schema-ownership`

## Control-plane schema sync (do not drop unknown tables)

- Operator command: `npm run db:sync-schema` (same as `npm run prisma:push`). This is the **only** supported upgrade path for an existing customer/project database.
- Default apply is **additive**: `prisma migrate diff` + execute. Tables (and extra columns) that are **not** in `prisma/schema.prisma` stay in place — domain/package tables (`hwy_*`, ETL maps, and any other non-Prisma objects) are never dropped.
- `prisma db push --accept-data-loss` **is not** the upgrade default. It reconciles by dropping every table missing from the Prisma schema and has caused production data loss. Use it only with explicit consent: `npm run db:sync-schema -- --destructive` or `CONTROL_PLANE_SCHEMA_PUSH_DESTRUCTIVE=1`.
- Greenfield / empty databases still receive the full control-plane schema (diff from empty → all `CREATE` statements).
- Optional lists: `CONTROL_PLANE_SCHEMA_PROTECTED_TABLES` (never drop these names) and `CONTROL_PLANE_SCHEMA_ALLOW_DROP_TABLES` (standalone `DROP TABLE` allowlist only).
- Install-wizard **replace existing schema** remains an explicit wipe (`forceReset` / `resetAppDatabaseSchema`) and is not used for ordinary upgrades.

**IDs:** `data.core-table-prefix`, `data.prisma.locked`, `data.note-field-naming`, `data.audit-*`, `data.db.utility-prefix`, `naming.latin-slug.identifier`, `data.control-plane.sqlserver-default`, `data.control-plane.provider-locked-after-setup`, `data.control-plane.schema-sync.preserve-unknown-tables`, `data.control-plane.schema-ownership`.
