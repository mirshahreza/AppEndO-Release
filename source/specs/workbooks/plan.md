# Implementation Plan — workbooks + Data Studio datasheet

## Personal workbooks

- UI: `src/features/workbooks/`
- API: `/api/workbooks` (`requireAuth`, owner-scoped)
- Persistence: Sequelize `base_workbooks` via `controlPlaneSequelize` — **not Prisma**

## Live datasheet (Data Studio)

- UI: `EdgeModelDatasheetPanel` from explorer **Data** and modeler **Data**
- API: `POST /api/data-api/models/:id/datasheet/query`, `POST .../datasheet/row`, `POST .../datasheet/row/delete`
- Runtime: Edge Sequelize (`EdgeModelDatasheetService`) against the table, no published Data API

## Persistence lock

Prisma is locked unless the operator explicitly grants it. See `docs/standards/data-model.md` (`data.prisma.locked`).
