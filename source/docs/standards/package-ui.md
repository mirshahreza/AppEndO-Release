# Package UI — Studio domain packages

> **Shard:** `package-ui`  
> **Visual SoT:** Base Components `/studio/base-components`  
> **Related:** [`package-base-info-vocab.md`](./package-base-info-vocab.md) · [`crud-pages.md`](./crud-pages.md) · [`deep-linking.md`](./deep-linking.md) · [`ui-inspector-rail.md`](./ui-inspector-rail.md)

Executable UI contract for operational Studio packages (CMS, CRM, …). Phase 3 names **page-by-page chrome** before Designer scaffold.

**Gold references (copy — do not invent parallel chrome):**

| Surface | Best living sample |
|---------|-------------------|
| Full-height list shell | `src/features/users/components/UsersPageView.tsx` |
| List toolbar | `UserFilterToolbar.tsx` (inline filters + `ListFilterToolbarControl`) · `LogsToolbar.tsx` · `BaseInfoToolbar.tsx` |
| Dense table + footer | `UserTableGrid.tsx` · `userGridColumns.tsx` |
| Sparse catalog cards | Data Studio object cards · CMS vocab (`cardVariant="catalog"`) |
| Modal CRUD | `CreateEditModalShell` · `RoleCreateModal.tsx` · `BaseInfoFormModal.tsx` |
| Shared Base Info vocab form | [`package-base-info-vocab.md`](./package-base-info-vocab.md) · `form.base-info-record` |
| Settings singleton form | `SettingsFormGroup` / CMS settings scaffold |
| Deep editor main + rail | Idea Foundry `IdeaFoundryViewRail.tsx` (inspector) · Data Studio `EdgeModelModelerSidePanel.tsx` (**writable** modeler exception) |
| Designer package scaffold | `scripts/cms-phase3/` (`cmsDesignerScaffold.ts`, `designerRecordsPageBuilder.ts`) |

---

## Hard rules

1. **Developer-built Studio pages** — Client Components + Platform Pages/Nav (`loaderKind: "designer"`). Forbidden: `core:<Package>`, permanent `src/features/<pkg>` as the delivery path, generating list UI from a table wizard, bootstrap seed of package UI. Use **CRUD Set** for list + create/edit/delete pages.
2. **Base Components first (hard — every control)** — see §Base Components contract below. Every interactive and chrome control on a package page must match a living sample on `/studio/base-components`. No raw HTML form controls, no ad-hoc HeroUI, no one-off package widgets when a catalog section exists.
3. **List ≠ editor on one URL** — deep link `{list}/edit/{id}` for complex records; modal CRUD for simple Records-style create/edit. See [`deep-linking.md`](./deep-linking.md).
4. **Field groups from the model** — `columnGroupOrder` drives list column order and form `FormSection`s. If a field has no group, fix the plan/studio-meta first.
5. **Missing Designer bridge → platform work** — if Base Components already has the primitive (e.g. `UiKanbanBoard`) but Designer palette/scaffold cannot emit it, add a **generic** Designer capability that wraps that Base Component — do not invent a parallel control inside the package and do not weaken UX.
6. **English UI copy** only in application source.
7. **Plan correction cycle** — wrong UI → rollback Phase 3 → fix the plan → rebuild. Do not patch a wrong layout into “good enough.”

---

## Base Components contract (hard)

**Source of truth:** `/studio/base-components` (`pageKey: base-components`) · catalog `src/features/base-components/` · `baseComponentCatalog.ts`.  
Always-on: `AGENTS.md` · id `ui.base-components.first` · [`ui-core.md`](./ui-core.md).

### Do / Don't

| Do | Don't |
|----|-------|
| Open the matching Base Components section and **copy** component, props, size, intent, chrome | Invent a “close enough” control for the package |
| Prefer public exports (`AppButton`, `UiInput`, `UiTextarea`, `UiCheckbox`, `UiKanbanBoard`, `AppTableGrid`, …) | Raw `<input>` / `<textarea>` / `<select>` / native checkbox |
| Use Designer palette nodes that resolve to those same wrappers | Ad-hoc HeroUI markup bypassing wrappers |
| Match `size="sm"` on product form surfaces; intents from `buttonSemantics.ts` | Mixed sizes / one-off color classes on buttons |
| If no catalog section exists → **platform** adds a Base Components section first, then the package uses it | Package-local custom base widget “just for CRM/CMS” |

### Package surface → Base Components section

| Package need | Base Components section | Typical export / sample |
|--------------|-------------------------|-------------------------|
| List / editor toolbar | `toolbar` · `search` · `buttons` | `ToolbarSearchInput`, `ToolbarRefreshButton`, `AppButton`, `WorkspaceBackIcon` |
| Dense data grid + footer | `grid` (Paging on) | `AppTableGrid`, `GridPagingFooter` |
| Sparse catalog cards | `grid` (`cardVariant="catalog"`) | Data Studio / CMS vocab living pages |
| Kanban board | **`kanban`** | **`UiKanbanBoard`** |
| Create/edit modal | `create-edit` · `dialog` · `text-fields` · `choice-fields` · `selection-fields` | `CreateEditModalShell`, `FormSection`, `FormField`, `UiInput`, `UiSelect`, … |
| Destructive / confirm | `confirm` | `ConfirmDialogShell`, `DestructiveConfirmBody` |
| Toast feedback | `toast` | `AppToast` (top-center) |
| Form fields / choices | `text-fields` · `choice-fields` · `selection-fields` · `structured-fields` · `ai-fields` | `UiInput`, `UiTextarea`, `UiCheckbox`, `UiRadioGroup`, `UiCombobox`, `UiSwitch`, … |
| Nested AND/OR predicates | `where-builder` | `UiWhereBuilder` — not a tree grid; text values may type a literal or pick a `contextItems` expression |
| Dates | `date-time` | shared date/time field wrappers |
| Tags / status chips | `chip` · relations patterns | chip samples; modeler `RelationBadge` for link-chips |
| Empty / loading / error | `loading-error-empty` · `skeleton` | empty placeholders, route loading — never blank white |
| Tooltips on actions / hints | `popover-tooltip` | `ActionTooltip`, `FieldHintTooltip` |
| Tabs (rare in packages) | `tabs` | `UiTabs` |
| Rich body (CMS-like) | `markdown-editor` · `html-editor` | only when format requires it |
| File upload buckets | `file-media-input` | when assets exist |

### Designer / scaffold obligation

Package pages are built in **Component Designer**, but the **visual contract is Base Components**, not “whatever the palette defaults to.”

1. Before scaffolding a control, name the Base Components **section id** in the plan or scaffold comment.
2. Scaffold / palette item must render the same public primitive the section demos (props, sizes, intents).
3. Contract tests should assert critical palette ids / intents (Create=`create`, Refresh utility, confirm danger, no native inputs in form bodies).
4. **Kanban:** Opportunities board = `UiKanbanBoard` (section `kanban`). Designer palette path already exists as **`viz.kanban`** → runtime `DesignerVizKanban` / `DesignerRuntimeKanban` → must keep wrapping `UiKanbanBoard`. Platform work is only for **domain wiring** (drop → `change-stage`, Won/Lost confirm/lock) — do **not** rebuild columns/cards or invent a second board. If a future palette gap appears, bridge back to `UiKanbanBoard`, never hand-roll CSS in the package.
5. **Ticket reply + message feed:** Reply composer = `UiTextarea` + `AppButton` Send (`text-fields` / `buttons`). Message **rows** = simple chronological stack; body text via BC `text-fields` **DirectionalText** / directional display props — **not** a chat-product bubble kit, and **not** Chat History grid as a thread reference (that page is a Records list, not a conversation feed).

### Pre-flight for every Phase 3 sub-phase

Agent must, before coding UI:

1. `get_feature_graph({ pageKey: "base-components" })` or open `/studio/base-components`
2. For each new control on the page, cite section id + export
3. Reject any PR/scaffold that introduces raw HTML form controls or package-only base widgets

---

## Pattern catalog (pick explicitly in every package plan)

### P1 — Full-height list shell

- Root: `flex h-full min-h-0 w-full flex-col bg-white`
- Toolbar `shrink-0` and grid host `flex min-h-0 w-full flex-1 flex-col` are **direct siblings**
- **No** in-page title in the list chrome
- **Zero** gap / `space-y` / spacer between toolbar and grid (header flush to toolbar border)
- Optional wrappers only when `React.Children.count(children) > 0`
- Toast + modals mount as siblings under the page root

### P2 — Single-row toolbar

- `PAGE_TOOLBAR_SINGLE_ROW_CLASS` (`lg:h-14`); filters **left**, actions **right**
- Search = `ToolbarSearchInput` (~300ms debounce)
- Create = `AppButton` `intent="create"` `size="sm"` + `Plus` (`h-3.5 w-3.5`)
- **Refresh always rightmost** (`ToolbarRefreshButton`)
- All controls `h-8`, vertically centered

### P3 — Dense `AppTableGrid`

- `presentation="auto"` + `card.role` for phone; large lists use server query
- Column order: identity → attrs → status → audit → **actions last**
- Boolean = Check emerald / X rose; null = `-`; dates = `YYYY-MM-DD`
- Action column: empty header, `ActionTooltip`, semantic hues (edit indigo · view cyan · delete rose)
- Footer = `GridPagingFooter` unless the plan explicitly strips chrome (catalog vocab with `pagination: false`)
- **Footer sort (required with paging):** whenever `showPagingFooter` / pagination is on, expose **sort field** + **sort direction** in the footer (`showSortControls: true`, `sortOptions` from sortable columns, `defaultSortBy` / `defaultSortDirection`). Same chrome as Server Functions / `GridPagingFooter` — not a toolbar control. Gold: `FunctionListSidebar.tsx`, CMS Contents list scaffold `standardGrid`.
- Status badges (`cellKind: 'status-badge'`) must use Base Info `ui_color` enrichment (`colorField` / `{key}UiColor`) so list badges match Change-status / status picker chrome.

### P4 — Catalog cards

- When density is title + ~1–3 compact attrs: `presentation="cards"` + `cardVariant="catalog"`
- **Not** stacked responsive row-cards as the intentional desktop design
- Vocab / small LOV catalogs: no paging footer; `pageSize: 1000` OK; reorder → move API when editable

### P5 — Modal create/edit

- `CreateEditModalShell` with explicit `size`
- Footer: Cancel (`intent="cancel"`) + primary (`create`/`primary`) both icon-leading
- Label-over-input: `ps-[4px]`, 2px gap, controls `size="sm"`, errors via `isInvalid` + overlay balloon
- Sectioned with flat `FormSection` (accent bar + bold-uppercase title); short fields in 2-col grid
- Success: **close modal → visible toast → refresh** every same-data-source region
- **Don't:** permanent create form under the grid; `window.confirm`

### P6 — Confirms

- Destructive: `ConfirmDialogShell` + `DestructiveConfirmBody`
- Non-destructive confirms use the same shell with semantic icon tone

### P7 — Package settings form

- White scroll shell; content `max-w-3xl` (or `max-w-2xl` if sparse)
- Flat `SettingsFormGroup` / `FormSection` with concept tones; pair-grid; separate Save footer
- `publishedFormAssist: false` on designer root for package pages

### P8 — Vocabulary pages (manageable Base Info categories)

Full contract: [`package-base-info-vocab.md`](./package-base-info-vocab.md).

- Catalog cards + **shared** `form.base-info-record` (never duplicate Base Info fields in scaffold)
- Inject CRUD via `DataSourceDefinition.operations`
- **Closed enums** (code-locked shortNames): **no** vocab page and **no** nav item — options/badges only

### P9 — Deep editor (main + rail)

Main column stays writable `FormSection`s. The **read-only inspector** is [`ui-inspector-rail.md`](./ui-inspector-rail.md) (gold: Idea Foundry `IdeaFoundryViewRail.tsx`). Do not copy Data Studio’s `FormSection` + `MetaField` rail for new package editors.

| Region | Contents |
|--------|----------|
| Action / publish bar | `WorkspaceBackIcon` + **item identity** (e.g. truncated title + `#id`) + domain verbs (Save, Publish, …) — not buried in rail |
| Main (white, scroll) | Only **writable working** fields in flat `FormSection`s |
| Rail (default `370px`, ghost splitter 280–560, `border-s`, theme wash) | White cards + 1/3–2/3 KV grid per [`ui-inspector-rail.md`](./ui-inspector-rail.md) |

- Empty **read-only** values: **None selected** (inspector shard). Writable empty note/story on the **main** column: dashed clickable placeholder (`MODELER_EMPTY_STATE_CLASS`) → opens edit dialog
- Multi-refs (tags, related): full-width `h-8` chips in the value column; click = navigate/detail, not inline edit-in-place
- Heavy collections (history, full message lists when summarized): **one summary row** in rail → full list in dialog
- **Don't:** `FormSection` / `MetaField` on this inspector; don't put identity/audit as always-open main fields; don't duplicate the content-header title in the rail

**Exception:** Data Studio modeler inspector stays [`data-studio-modeler.md`](./data-studio-modeler.md) §6.

### P10 — Create identity → persist → deep link

When kind/type/locale/format selects editor or field visibility:

1. Collect discriminators in a **create dialog**
2. `POST` → obtain `id`
3. Navigate to `{list}/edit/{id}`
4. Discriminators that choose the editor component are **locked** after create (unless the plan documents a narrow shared-storage mutable exception)

### P11 — Designer scaffold build path

- Prefer reusable builders modeled on `scripts/cms-phase3/` (`createRecordsPageState`, `appendRecordsCrudOverlays`, vocab helpers)
- Contract tests for scaffold layout (CMS: `cmsDesignerScaffoldContracts.test.ts`)
- Install script per phase (`npm run <pkg>:phase3`) + live-verify (HTTP + browser) before claiming Phase 3 done
- **Table-wizard list generators are rejected** for domain packages — use **CRUD Set**
- Every emitted control must satisfy §Base Components contract

---

## UI polish rules (fine — packages must look like the rest of Studio)

These are the same always-on Studio rules; listed here so Phase 3 agents do not skip them:

| Topic | Rule | Shard / sample |
|-------|------|----------------|
| Typography | Titles → section labels (bold uppercase + accent) → field labels → body; vary size/weight so topic is obvious at a glance | `ui-core` · `FormSection` |
| Semantic color | Gentle hues on **text/icons/badges/chips/small objects** only; large surfaces stay white/slate; reuse `buttonSemantics` / `surfaceClasses` / FormSection tones | `ui-core` · “Color it” |
| Buttons | Labeled actions always Lucide `h-3.5 w-3.5` leading; intents: create / cancel / primary / destructive / confirm / secondary / utility | Base Components → `buttons` |
| Back | Nested editor back = **`WorkspaceBackIcon` only** | `ui-toolbar` |
| Field layout | Label-over-input `ps-[4px]` · gap 2px · `size="sm"` · hints = `FieldHintTooltip` not helper paragraphs | Base Components → `text-fields` |
| Invalid | Required empty fields show invalid border from first paint; errors = overlay balloon | `ui-core` |
| Direction | `autoDir` on text fields; ticket message bodies use `DirectionalText` / directional props when displaying mixed scripts | `ui-core` |
| Toast | `AppToast` top-center; success after modal close (~2.6s); **error stays until dismiss** | Base Components → `toast` |
| Loading | Never blank white — shell/page loading surfaces; skeletons where lists load | `loading-error-empty` · `skeleton` · `ui-core` shell loading |
| Empty | Read-only inspector: **None selected**. Writable empty CTAs: dashed placeholders (`MODELER_EMPTY_STATE_CLASS`) — never dead empty panels | [`ui-inspector-rail.md`](./ui-inspector-rail.md) · Data Studio modeler |
| Confirm | In-app shells only — never `window.confirm` | Base Components → `confirm` |
| Grid flush | Zero gap toolbar↔grid header | Users list |
| Form assist | `publishedFormAssist: false` on package designer roots | CMS precedent |
| English | All user-facing strings English | `ui-core` |

---

## Generalized acceptance checklist (every package page)

Plans may add domain rows; these baseline rows are mandatory for Phase 3 ready:

| # | Rule | Reference |
|:-:|------|-----------|
| 1 | Users flex shell; no in-page list title | P1 · `UsersPageView` |
| 2 | Toolbar filters left / actions right; Refresh rightmost; **List Filter** last in filters cluster (`ListFilterToolbarControl`, `separatorBefore` when preceded) — not beside Refresh | P2 · BC `toolbar` · `UserFilterToolbar.tsx` |
| 3 | Search debounce ≈300ms | P2 · BC `search` |
| 4 | Create icon+label `intent="create"` | P2 · BC `buttons` |
| 5 | Dense lists = `AppTableGrid`; sparse = catalog cards | P3 / P4 · BC `grid` |
| 6 | Column / section order follows model groups | Field groups |
| 7 | Boolean / date / action column semantics | P3 |
| 8 | Modal CRUD uses `CreateEditModalShell` + sectioned forms | P5 · BC `create-edit` |
| 9 | Label-over-input `sm` + overlay errors | P5 · BC `text-fields` |
| 10 | Destructive = confirm shells only | P6 · BC `confirm` |
| 11 | No “paste id” workflows — lookup / typeahead / row action | — |
| 12 | Toolbar–grid flush (zero gap); when List Filter is active, only `ListFilterSummaryBand` may sit between toolbar and grid | P1 · [`ui-grid.md`](./ui-grid.md) |
| 13 | Optional slots only when children exist | P1 |
| 14 | Deep editors = main writable FormSections + inspector rail per `ui-inspector-rail` | P9 |
| 15 | Create identity dialog + locked discriminators when applicable | P10 |
| 16 | Related multi-sets as chips / summary rows, not main grids (unless space-required exception) | P9 |
| 17 | Modal success: close → toast → refresh | P5 · BC `toast` |
| 18 | Vocab = shared form + catalog; closed enums have no page | P8 |
| 19 | Nav/culture keys registered (`nav.group.*` when package owns a heading) | Platform nav |
| 20 | Pages visible in Client Components; `loaderKind: "designer"` | Hard rules |
| 21 | **Every control maps to a Base Components section** — no raw HTML inputs | §Base Components contract |
| 22 | Kanban uses `UiKanbanBoard` (BC `kanban`) when a board is required | BC `kanban` |
| 23 | Typography + semantic-color polish rules observed | §UI polish |
| 24 | No blank-white load; empty states use placeholder pattern | BC `loading-error-empty` |
| 25 | Deep editors: URL `{list}/edit/{id}`; shell `{group}/{page}/Edit`; content header back + item identity title | [`deep-linking.md`](./deep-linking.md) |

---

## Phase 3 readiness gate (before coding UI)

A package plan is **Phase 3 ready** only when all are true:

- [ ] Every collection page: pattern id (P3 vs P4), columns or card roles, filters, create path, row→edit navigation
- [ ] Every deep editor: ASCII main/rail/action-bar; each field mapped to main section, rail section, dialog, or locked
- [ ] Deep editors follow [`deep-linking.md`](./deep-linking.md): URL `{list}/edit/{id}`, shell `{group}/{page}/Edit`, content header with item identity title + `WorkspaceBackIcon`
- [ ] Every manageable Base Info category: vocab page contract (P8); closed enums listed as no-page
- [ ] Page→reference mapping table (e.g. “Parties list ≈ Users list”)
- [ ] **Control→Base Components section map** for the package (or explicit reuse of the shared table in this shard)
- [ ] Phase 3 split into **sub-phases** (vocab/shell → golden list+editor → remaining catalogs) with acceptance per sub-phase
- [ ] Scaffold path named (`scripts/<pkg>-phase3/` or shared builders) + contract-test expectation
- [ ] Live-verify protocol named (HTTP endpoints + browser pages)
- [ ] Links to this shard + [`package-base-info-vocab.md`](./package-base-info-vocab.md)

If any box is open, **upgrade the plan first** — do not start Designer scaffolding.

---

## Recommended Phase 3 sub-phase shape

| Sub-phase | Build | Gate |
|-----------|-------|------|
| **3a** | Nav/group + settings shell + vocabulary pages | Vocab CRUD live; culture keys; no domain editors yet |
| **3b** | One **golden** list + create dialog + deep editor | Acceptance checklist + browser verify on that pair |
| **3c…** | Remaining catalogs by cloning 3b patterns | Same checklist per page; no new chrome inventions |

Never ship “all package pages” in one unbounded agent turn.

---

## Planner requirements (`p-packages-<slug>.md`)

When drafting or revising a package plan (see `.claude/skills/appendo-build-new-package-plan/`):

1. In **§ UX ادمین**, include the generalized checklist (or a package-specific table that covers every row) + page→reference mapping + per-page ASCII for deep editors + **control→Base Components section map**.
2. In **§ فاز ۳**, list sub-phases 3a…, scaffold path, contract tests, live-verify, Base Components pre-flight, and **ممنوع** lines (no table-wizard list UI, no core feature, no list+editor URL, no raw HTML inputs).
3. State explicit card-vs-table and closed-vs-manageable vocab decisions.
4. Point implementers at this shard: *load `package-ui` + open Base Components before any Phase 3 prompt*.

---

## Package Manager — initial records

Studio packages that ship domain data must split SQL. Runtime script policy only allows paths under `db/install/`, `db/uninstall/`, `db/seed/`, or `sql/` — not `db/install.sql` at the `db/` root.

- **Required** `db_objects` (schema + foundation vocab) always install. Builder writes `db/install/schema.sql` and `db/uninstall/schema.sql`.
- **Optional** `seed` `db_objects` with `installMode: "optional"` hold initial content rows (for example `cms_contents`) at `db/seed/optional-records.sql` / `db/uninstall/optional-records.sql`. Package Builder and Repack choose whether to pack them. The installer chooses whether to apply them.
- **Binary columns** (`BYTEA` / `file` / `file_xs`) ship as ZIP entries under `db/blobs/files/` with `{{package_blob:...}}` tokens in SQL. Capture related tables in FK order; include descendants for trees (`parent_id` / `parent_content_id`). ZIP limit is 512 MB.
- **Pack CMS module** (Package Builder / Repack) loads CMS schema, captures the `base_info` tree titled `CMS` as required vocab, and optionally captures `cms_contents` plus files. If those vocab ids already exist on the destination with a different title, install remaps the HID tree and rewrites seed SQL.

Do not mix required foundation INSERTs into the optional seed script.

---

## Studio nav group

Package Studio pages get a sidebar group named after the package (`navigation_patches` → `platform/navigation-patches/studio.json`). Do **not** bake this package's pages into shipped `src/config/platform-registry/navigation/studio.json`. Install claims an unowned leftover group with the same heading and tracks only this package's pageKeys. A heading already owned by another package's sidecar is a conflict. Uninstall removes tracked pageKeys and drops the heading only when it would be empty — leftover untracked items stay.

CMS sidebar is **Contents** (`cms-contents-list` → `cms/contents`) and **Settings** (`cms/settings/*`) only. Vocab, comments, and the contents editor stay inside those pages. Packing must not dump table-wizard / `general-cms-*` items into the Studio menu.

When the destination already has those pages as `loaderKind: "designer"`, install **adopts** them — it does not overlay competing `loaderKind: "package"` routes and does not fail the install as a registry conflict.

---

## Public home portal

The shipped `home-shell` redirects `/` and culture roots to Studio. The CMS package (`cms`) claims that shell while installed (`capabilities.home_portal` → `platform/home-shell.json`, `site-shell` layout). Uninstall restores the Studio redirect — including a CMS version that was installed before this capability existed. Do not hardcode `CmsSiteHome` as the only root fallback; Portals already owns redirect vs shell.

---

## Install rollback (atomic)

An extension install must not leave a half-applied package. If any step fails, the same attempt reverses in reverse install order: Studio nav patch, culture keys, home portal / platform capabilities, deployment preview, workflows, record policies, **edge data created by this attempt**, DB uninstall scripts, object registry, UI/API runtime.

- Run uninstall SQL **only if this attempt executed install SQL**. Do not DROP leftover tables from a previous successful install of the same package.
- Do **not** delete edge APIs/models that already existed on this node (same-node pack + reinstall). Rollback deletes only ids recorded as created.
- Continue remaining rollback steps if one reverse step fails (best-effort). The install is still recorded as `failed`.
- A failed / rolled-back install clears `deploymentStatus` so the Packages row shows **Install**, never leftover **Apply**.
- Managed functions superseded at the start of install are not restored.

## Studio extension routes vs Apply

Studio packages (`kind: extension`, including CMS) confirm `ui_routes` during install (`deploymentStatus: applied`). The Packages grid **Apply** button is only for a **vertical-app** with `applyPolicy: propose` (review platform shells/routes before they go live). Do not send operators into an Apply modal after a CMS/Studio extension install.

Leftover extension rows that are already `installed` + `pending` are confirmed when the Packages catalog is listed.

---

## Change management

Update this shard + `projectStandards.ts` id `package.ui.phase3-contract`. Vocab rules: [`package-base-info-vocab.md`](./package-base-info-vocab.md).

**IDs:** `package.ui.phase3-contract` · `package.home-portal` · `package.studio-nav-patch` · `package.install-rollback`.
