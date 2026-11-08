# SEA-0.3 — Sequelize dialect spike matrix

Date: 2026-07-22

## Summary

Edge Sequelize runtime uses independent pools per `dataSourceId` via `EdgeSequelizeFactory` + `dialectConfig.ts`. POC smoke passed for **SQLite** (`findAll` / `findByPk`). Other dialects are configured and targeted for parity in CI smoke jobs.

## Go / no-go matrix (v1)

| Dialect | Sequelize driver | Pool (`max`) | SEA-0 smoke | v1 status |
|---------|------------------|--------------|-------------|-----------|
| PostgreSQL | `pg` (via sequelize) | 5 | Manual / CI planned | **Go** |
| MySQL | `mysql2` (via sequelize) | 5 | Manual / CI planned | **Go** |
| SQLite | `sqlite3` | 5 | **Pass** (unit smoke) | **Go** |
| SQL Server | `tedious` | 5 | Manual / CI planned | **Go** |
| Oracle | `oracledb` (sequelize dialect) | 5 | Manual / CI planned | **Go** (best-effort) |
| MongoDB | — | — | N/A | **No-go** (out of scope) |
| Redis | — | — | N/A | **No-go** (out of scope) |

## Notes

- SQLite requires the native `sqlite3` package (not `better-sqlite3` dialect module).
- Routine bridge (`operation.kind: routine`) uses dialect-specific `CALL` / `EXEC` / `SELECT function()` SQL in `dataApiExecutor`.
- Composite primary keys are supported via `resolvePrimaryKeyWhere` during get/update/delete.
- Secret columns (`password`, `token`, `hash`, …) are hidden on import via `isSecretColumnName`.

## Follow-up

- Add dockerized dialect smoke in `data-api.executor.test.ts` when CI images are available.
- Revisit Oracle `connectString` formatting per deployment.
