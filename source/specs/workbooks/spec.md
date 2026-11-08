# Feature Specification

## Metadata

| Field | Value |
| --- | --- |
| **Feature slug** | `workbooks` |
| **Author** | Operator (chat 2026-08-28) |
| **Status** | `Approved` |
| **Created** | 2026-08-28 |
| **Last updated** | 2026-08-28 |
| **Constitution version** | 2.0.0 |

---

## Feature Goal

Two surfaces only:

1. **Personal workbooks** — each signed-in user keeps private `UiSpreadsheet` workbooks under Records → Workbooks. Persistence is Sequelize `base_workbooks` (not Prisma).
2. **Live datasheet** — Data Studio table/view row editor (database-style), without a published application. The sheet is open for editing; leaving a row writes it (or focuses the invalid cell). One editable SELECT sentence (named columns, TOP/LIMIT) loads the rows. Max 200.

### Out of Scope

- Staging Users / Base Info / Geo
- Translation matrix
- Planning templates as a product kind
- Binding a workbook to Users, Sample Mock, or Data API
- Prisma models for this feature
