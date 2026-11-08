# Base Info — culture translations (canonical schema)

## Decision

- `base_info.title` and `base_info.note` are the **canonical** strings (master / `us` fallback).
- Per-culture text lives in **`platformCultureTranslations`**:
  - `base_info.title.{id}`
  - `base_info.note.{id}`
- Materialized paths: table **`base_info_title_path`** (`base_info_id`, `culture_id`, `title_path`), rebuilt on write.

## Upgrade (existing databases)

1. Deploy application + Prisma schema (locale columns removed from model).
2. Run: `npx tsx scripts/migrations/base-info-culture-text/migrate-locale-columns.ts`
3. Optional SQL: drop legacy columns `title_en`, `title_fa`, `title_ar`, `note_*`, `title_path_*` when DBA confirms.

## Packages (three surfaces)

| Surface | Role | Follow-up |
|---------|------|-----------|
| **Core** (`database.ts`, org-geo `seedOrgGeoBaseInfo`) | Platform `100.*` tree | Seeds write canonical `title`; run migration script on existing DBs |
| **CMS** (`scripts/cms-phase*`, package ZIP `culture_keys`) | Vocab under CMS root | Repack: seed base_info + `culture_keys` JSON for `ir`/`iq`; CMS SQL aggregations should use resolved `title` via API enrichment or `title_path` join |
| **Hawiety (HWY)** (`scripts/hwy-phase*`, `hwy_*` SQL) | Member/geo vocab | Update `hwy_base_info_title_path_by_short_name` to read `base_info_title_path`; phase install hooks call migration + path recompute |

Org-geo (organization / geographic divisions) is **core**, not a ZIP package, but shares the same Base Info contract.

## API contract

- List/tree/options: `lang` or `cultureId` query → `label`, `title`, `title_path`, resolved `note`.
- GET one (forms): `title`, `note`, `locales: { ir?: { title, note }, iq?: … }`.
- POST/PUT: same `locales` object; canonical fields on `title` / `note`.

## Invalidation

- `base_info` save → `recomputeBaseInfoTitlePathsForSubtree`.
- Culture translation save touching `base_info.title.*` → subtree recompute (future hook in `PlatformCultureTranslationsService`).

## SQL reporting (no app layer)

Materialized for queries:

| Table | Purpose |
|-------|---------|
| `base_info_culture_text` | Display **title** per `(base_info_id, culture_id)` when it differs from canonical (synced on save + migration rebuild) |
| `base_info_title_path` | Display **title path** per culture (recomputed on write) |

Install provider functions:

```bash
npm run base-info:install-display-sql
```

| Function | Returns |
|----------|---------|
| `zz_base_info_display_title(culture_id, base_info_id)` | Culture-specific title |
| `zz_base_info_display_title_path(culture_id, base_info_id [, depth])` | Culture-specific path; optional `depth` = segments from **node upward** (leaf included); `NULL` / `<= 0` = full path to root |
| `*_by_short_name` variants | Same, keyed by `base_info.short_name` |

Path depth example (`A | B | C` stored for node C): `depth = 1` → `C`; `depth = 2` → `B | C`; default → full string.

`culture_id` accepts pack ids (`us`, `ir`, `iq`) or legacy lang codes (`en`, `fa`, `ar`). Canonical `base_info.title` is the fallback when no culture row exists.

Scripts: `scripts/db/install/base_info_display_sql.sqlserver.sql`, `base_info_display_sql.postgresql.sql`.

## Performance

- Reads: one merged bundle per request culture + batch `base_info_title_path` lookup (`mapBaseInfoRowsForCulture`).
- Writes: subtree path recompute (unchanged cost model vs old `title_path_*` columns).
