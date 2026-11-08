# Hawiety member-list field-by-field filters (toolbar mode 2)

> **Shard:** `package-hawiety-member-list-legacy-filters`  
> **Audience:** operators, AI agents wiring Hawiety **people lists**.

## Operator mirror

Arabic prose for operators lives in Studio **Identity business rules** (`pageKey: hwy-business-rules-reference`), section `member-list-legacy-filters`. Sync contract: [`specs/hwy-business-rules-reference/01-scope-contract.md`](../../specs/hwy-business-rules-reference/01-scope-contract.md).

## When this applies

Member-directory and other Hawiety **people list** pages that use:

- Primary toolbar row: quick search + page actions + `HwyLegacyFieldFilterBarToggle`
- Secondary panel when toggle is **on** (field-by-field mode)

Do **not** use this stack for wizard-embedded pickers (`HwyMemberSimilarMembersFilterBar`, …) — those keep their own compact bars.

## Locked row order (mode 2 panel)

| Row | Purpose | Building blocks |
|-----|---------|-----------------|
| 1 | List / page logic | Page-owned controls in `pageLogicRow` via `HwyMemberListLegacyFieldByFieldPageLogicRow` — **not** part of rows 2–5. **All People:** membership status checkboxes. **Registered members (`AlMontadhemin`):** institute multi-filter. **Image review:** queue / role / document filters. Other lists: empty when they have no extra filters. |
| 2 | Identity | `HwyMemberListLegacyFieldFilterIdentityRow` — **gender** → **membership id** → **phone** → **four name fields** (fixed order). Membership id search mode is per list: `username`, `trackingCode`, or `usernameOrTrackingCode` (placeholder + store binding via `membershipIdentifierSearchMode`). |
| 3 | Personal details | `HwyMemberListLegacyFieldFilterPersonalDetailsRow` — **registration status** select (`hwy.members.legacyFilter.joinTasjilState` · placeholder **حالة التسجيل**; options مسجل / غير مسجل → semantic short names `registered_biometric` / `unregistered`; server maps to Base Info ids on `nakhebin_join_tasjil_state_code` · «مسجل» grid column); store `gridToolbar.filters.nakhebinJoinTasjilStateCode` · API `filter[nakhebinJoinTasjilStateCode][eq]` · fast path `hwyMemberDirectoryListFastPath`) → **national id** → **birth year**. Row 1 checkboxes stay on `gridToolbar.filters.membershipStatusCode`. |
| 4 | Education & work | `HwyMemberListLegacyFieldFilterEducationWorkRow` — **education level** → **education stage** → **job type** (selects only; no free-text workplace/branch/school in this row) |
| 5 | Electoral center | `HwyMemberListLegacyFieldFilterElectoralRow` — cascade selects, one horizontal row (parity with `HwyMemberRashhPickerDialog` / `HwyGeoResponsibilityElectoralCascadeFilters`, `filterKindMode="memberRashh"`) |
| 6+ | Optional | `extraRows` — dates, flags, list-specific fields (phone + membership id live on identity row; All People has no extra row) |

Compose with `HwyMemberListLegacyFieldByFieldStack` inside `HwyMemberDirectoryLegacyFilterBarPanel` (or designer `memberDirectoryLegacyFilterBar` slot).

## Row 2 — membership identifier

Configure **`membershipIdentifierSearchMode`** on `HwyMemberListLegacyFieldFilterIdentityRow`:

| Mode | Placeholder culture key | Legacy store |
|------|-------------------------|--------------|
| `username` | `hwy.members.legacyFilter.username` | `gridToolbar.legacy.username` |
| `trackingCode` | `hwy.members.legacyFilter.trackingCode` | `gridToolbar.legacy.trackingCode` |
| `usernameOrTrackingCode` | `hwy.members.legacyFilter.usernameOrTrackingCode` | same value on **both** keys; list API ORs when values match |

Default from list scope (same rules as avatar caption — `resolveHwyMemberListLegacyFieldFilterMembershipIdentifierSearchMode`). **All People** (`HwyMemberDirectoryAllPeopleLegacyFieldByFieldPanel`) uses `usernameOrTrackingCode`. Server: `buildHwyMemberDirectoryListLegacyFilterWhere`.

## Layout tokens

Filter-row selects use **`HwyMemberListLegacyFieldFilterSelect`** (`UiSelectMenu`, portaled — same chrome as electoral cascade `legacyToolbar`, not `ToolbarFilterSelect` / native combo).

Every row uses **`HWY_MEMBER_LIST_LEGACY_FIELD_FILTER_ROW_GRID_CLASS`** (same tracks as `hwyMemberDirectoryLegacyFilterBarLayout` fields grid; **7 columns at `xl`** so the identity row fits on one line). Default: **one cell = one track**. Montadhemin **institutes** stay on **row 1** (page-logic section) in their own grid with **`HWY_MEMBER_DIRECTORY_LEGACY_FILTER_FIELD_CELL_SPAN_2_CLASS`** (`col-span-2` = gender + membership identifier width; CSS in `hwyMemberDirectoryLegacyFilterBar.css`). All People membership checkboxes may use **`mergePageLogicWithIdentityGrid`** on {@link HwyMemberListLegacyFieldByFieldStack}. Electoral cascade in member lists uses `chrome="legacyToolbar"` (placeholder-only selects, no field labels).

## Toolbar chrome (unchanged)

Mode switch behavior: `hwyMemberListToolbarLegacyFilterChrome.ts`, `HwyMemberListToolbarActionsEnd`, `useHwyLegacyFieldFilterBarMode`.

## Rollout

All Hawiety **member-directory people lists** (`HWY_Members_List_*`) use `HwyMemberDirectoryLegacyFieldByFieldPanel` when the legacy field toggle is on — see `isHwyMemberListStructuredFieldByFieldLegacyScope` (excludes quick-search `AlMontadhemin_SingleView` only).

**Live reference:** `hwy-members-all` (`HWY_Members_List_All`); same panel component for institute, queue, rejection, and image-fix lists with list-specific row 1.

## Code index

- `HwyMemberListLegacyFieldByFieldStack.tsx`
- `HwyMemberListLegacyFieldFilterSelect.tsx`
- `HwyMemberListLegacyFieldFilterIdentityRow.tsx`
- `HwyMemberListLegacyFieldFilterPersonalDetailsRow.tsx`
- `HwyMemberListLegacyFieldFilterEducationWorkRow.tsx`
- `HwyMemberListLegacyFieldFilterElectoralRow.tsx`
- `HwyMemberDirectoryLegacyFieldByFieldPanel.tsx`
- `HwyMemberListLegacyFieldByFieldPageLogicRow.tsx`
- `HwyMontadheminInstituteLegacyFieldFilterRow.tsx`
- `HwyMemberImageFixLegacyFieldFilterRows.tsx`
- `HwyMemberDirectoryAllPeopleLegacyFieldByFieldPanel.tsx` (thin wrapper)
- `hwyMemberListLegacyFieldFilterIdentityModel.ts`
- Tests: `hwyMemberListLegacyFieldFilterIdentityModel.test.ts`
