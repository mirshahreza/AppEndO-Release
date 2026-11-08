# WF-2 — Client CRUD UI (vibe shard)

> **Shard key:** `get_project_standards({ shard: "vibe-crud" })`  
> **Workflow:** [`vibe-coding-workflows.md`](./vibe-coding-workflows.md) § WF-2  
> **Playbook:** [`vibe-operator-playbook.md`](./vibe-operator-playbook.md)

---

## When to use

User is on **Client Components** (`pageKey: client-components`) and wants a new grid + form CRUD bound to an API.

**CRUD Set** (one `CrudSet`: list + creates + purpose/content patches + delete, Users-like): load shard `crud-set` and skill `.claude/skills/appendo-build-crud-set`. Ask `CRUD_SET_FIRST_QUESTION`, fill `CrudSetSpec`, then render one `CrudSet`. This vibe shard is the leftover path for a one-off grid/form that is **not** a CRUD Set.

## Execute — do not re-ask

If the user already described the CRUD (entity, columns, API), after retrieve call **`draft_component_layout`** — do not ask them to repeat. For a **multi-page application** (list+detail, portal with several screens), call **`draft_application_scaffold`** instead (orchestrates shell + pages + menu via `draft_component_layout`).

## Tool order

1. `get_feature_graph({ pageKey: "client-components" })`
2. `search_codebase` + `read_file` — similar layout/template
3. **`draft_component_layout`** (single screen) **or** **`draft_application_scaffold`** (multi-page + shell + menu)
4. Proposal → confirm → apply → **Designer handoff**

## UI rules (mandatory)

| Control | Use |
|---------|-----|
| Grids | `AppTableGrid` |
| Booleans | `UiCheckbox` — never native checkbox |
| Buttons | `AppButton` intents from `buttonSemantics.ts` |
| Modals | `CreateEditModalShell` |
| Labels | `ps-[4px]` + 2px gap to control |
| Page guide | Every generated field must have `label` + `hint` (plain-language sentence). Auto-form/CRUD builders emit `hint`; canvas/export wrap the control with `data-page-guide*`. After a manual `designer_insert_palette_item`, set `hint` via `designer_set_prop`. |

## Related shards

- `crud-set` — unified `CrudSet` (`CrudSetSpec` as props); prefer this over this shard
- `crud-pages` — CRUD page patterns
- `ui-grid` — columns, paging, actions
- `ui-core` — forms, shell, typography
- `data-studio` — when the API is generated from a Data Studio model
- **`package-ui`** — operational package Phase 3 gate (lists · main/rail editors · vocab · scaffold); use for CMS/CRM-style packages instead of inventing chrome
- `package-base-info-vocab` — shared Base Info vocab form for package settings
