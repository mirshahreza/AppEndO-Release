# UI toolbars and buttons

> **Shard:** `ui-toolbar`  
> **Tokens:** [`ui-design-system.md`](./ui-design-system.md) · **Deep links / content header:** [`deep-linking.md`](./deep-linking.md)  
> **Living sample:** Base Components → toolbar / buttons / search.

## Intent

List toolbars, page headers, and button intents share one chrome. Item identity never lives in a list toolbar.

## Toolbar layout
- No page titles in **list/grid page toolbars**.
- **Exception — studio content headers:** document-style workspaces may use a **content header** (back + **item identity title** + optional technical subtitle + primary action) instead of `PAGE_TOOLBAR_*` filter clusters — shell on nested editors is `{group} / {page} / Edit`; item identity belongs in the content header; see [`deep-linking.md`](./deep-linking.md) and [`data-studio-modeler.md`](./data-studio-modeler.md) §Content header. Do not put object titles into ordinary CRUD list toolbars.
- Grid/list page toolbars: **filters left**, **actions right** — wrap the two clusters in `PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS` and `PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS` as direct children of `PAGE_TOOLBAR_SINGLE_ROW_CLASS`. On `lg+`, `index.css` lays out single-row shells with **`grid-template-columns: minmax(0, 1fr) auto`** (filters column 1, actions column 2) so shrink-0 filter controls never paint under create/refresh; filters cluster uses **`lg:w-auto lg:flex-1 lg:basis-0`** below `lg` only (`w-full` stacks on phone). Cramped filters **scroll inside** `.page-toolbar-filters-cluster` (hidden scrollbar). Never raise actions `z-index` above filters — that masks overlap instead of fixing width.
- Vertical separator between action groups of different categories (`PAGE_TOOLBAR_ACTION_SEPARATOR_CLASS`).
- All controls `sm` + `h-8`; `UiInput` / `UiSelect` must set `size="sm"`.
- Controls are vertically centered inside the toolbar: the toolbar is `lg:h-14`, its two direct clusters use `items-center`, and every control remains `h-8`. Do not add asymmetric `pt-*`/`pb-*`, margins, transforms, or feature-specific HeroUI wrapper offsets.
- Active tools not slate/gray (gray = disabled only).
- Page toolbar: `bg-white`, `px-3 sm:px-5`, `select-none`, `border-b border-slate-200` only (no shadow).
- **Height:** single-row toolbars use `PAGE_TOOLBAR_SINGLE_ROW_CLASS` → `lg:h-14` (56px) on desktop. **Default for all list/grid pages** — do not use `PAGE_TOOLBAR_MULTI_ROW_CLASS` unless the toolbar genuinely needs 2+ stacked rows on desktop.
- Multi-row (rare): `PAGE_TOOLBAR_MULTI_ROW_CLASS` + one `PAGE_TOOLBAR_INNER_ROW_CLASS` per row (each inner row is also `lg:h-14`).
- **Responsive:** `PAGE_TOOLBAR_SINGLE_ROW_CLASS` stacks filters then actions on phone/tablet (`flex-col`); single row from `lg` up.
- **Dense actions:** use `ToolbarActionGroup` — **`isCompactChromeTier`** (phone and tablet) keeps `primary` actions + overflow (⋯) menu for secondary; `lg`–`xl` icon-only square buttons (`TOOLBAR_ACTION_COMPACT_BUTTON_CLASS`); **`2xl+`** full labels (`TOOLBAR_ACTION_LABEL_CLASS`) so docked sidebar at ~1280 content width does not shear Filter beside create buttons. **Create toolbar actions** (`intent: 'create'`) are **never** labeled — they always render via **`ToolbarCreateControl`**: one icon-only **Plus** (`AppButton` `size="icon-md"` `intent="secondary"`) or, when a page exposes **2+ create targets**, one **Plus** **`AppSplitButton`** dropdown (menu items keep their labels/icons — e.g. Users Individual / Company). `PAGE_TOOLBAR_SINGLE_ROW_CLASS` wraps `lg`–`xl` (`xl:flex-nowrap`). Optional `compactOverflowActions` merges extra items (e.g. Refresh) into the compact menu. Prefer **`ToolbarActionGroupWithRefresh`** when the cluster includes Refresh — desktop keeps `ToolbarRefreshButton` inline; compact chrome folds Refresh into ⋯. See [`ui-responsive.md`](./ui-responsive.md).
- `ToolbarSearchInput` uses `TOOLBAR_SEARCH_INPUT_HOST_CLASS`: full width on phone; **150px** from `md`; **200px** from `xl`.
- `ToolbarFilterSelect` uses `TOOLBAR_FILTER_SELECT_SINGLE_HOST_CLASS` / `TOOLBAR_FILTER_SELECT_MULTIPLE_HOST_CLASS`: below `lg`, hosts **flex-grow** inside `PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS` (Fluent reposition) so a fixed `20rem` multi-select does not force a solo filter row on tablet; from `lg` the filters cluster is **`flex-nowrap`** (one row; horizontal overflow scrolls inside the cluster when cramped — **no visible horizontal scrollbar** in the `h-14` band; see `index.css` — never a second row that clips under `index.css` h-14). Roles multi-select is **narrower `lg`–`xl`** (`12rem` cap) and **full `20rem` from `2xl`**; low-priority selects (e.g. Users **Person type**) use `visibility="wide-only"`. Do not override width with raw `w-full sm:w-44` on list filters — use `ToolbarFilterSelect` (reference `PackagesToolbar.tsx`, `UserFilterToolbar.tsx`).
- **Filter bar tiers (list pages):** (1) **Always inline** — `ToolbarSearchInput` + 1–2 primary `ToolbarFilterSelect` / checkbox groups; (2) **Wide-only** — secondary enumerations (`wide-only` visibility); (3) **List Filter** — nested WHERE via `ListFilterToolbarControl` last in the filters cluster; (4) **Column header** filters — grid only, not duplicated in the toolbar. Do not add a second toolbar row on desktop — `PAGE_TOOLBAR_MULTI_ROW_CLASS` is for rare tab+filter shells only (`page-toolbar-multi-row` in `index.css`).
- **Scroll-linked toolbar (list pages):** wrap the page in **`ListPageShell`**; toolbar row in **`ListPageToolbarFrame`**; `AppTableGrid` picks up scroll via context (optional `onGridScroll` on the shell for infinite/paging only). Do **not** call `useListPageToolbarScroll` / `useCollapsingListToolbar` in feature hooks. `CrudSet` embeds the same shell; **Designer runtime** `DesignerRuntimeAppTableGrid` + `DesignerGridPageToolbar` and codegen'd `AppTableGrid` companions use the same pair (do not hand-roll toolbar `div`s). — **first downward** grid scroll tick collapses; **any upward** tick expands; near top always expanded; ~360ms grid-row + opacity motion in `index.css` (respect `prefers-reduced-motion`). Constants in `listPageToolbarScrollChrome.ts`. Layout-settle windows prevent flash when the grid resizes — see [`ui-responsive.md`](./ui-responsive.md) §List page scroll chrome. Does **not** collapse admin-shell header (geometry lock). Reference `UsersPageView` / `UserFilterToolbar`.
- Toolbar filter toggles: single checkboxes use `ToolbarFilterCheckbox` (or `PAGE_TOOLBAR_FILTER_CHECKBOX_LABEL_CLASS`) — bordered `h-8` label, **content width only** (`w-auto`), **last** in `PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS` after search/select; small multi-option groups use `PAGE_TOOLBAR_FILTER_CHECKBOX_GROUP_CLASS` with `ToolbarFilterCheckboxGroupItem` (or `PAGE_TOOLBAR_FILTER_CHECKBOX_ITEM_CLASS`) per option. Reference `PackagesToolbar.tsx`.
- **High-cardinality filters** (many options, e.g. Users roles): `ToolbarFilterSelect` `multiple` — same `UiSelect` CSV contract as Form Fields. Empty selection means All (no filter). AND/OR (`matchLogic`) is a group **inside the open menu**, not a sibling badge on the toolbar. Do not wrap a long option list as chips in the page toolbar. Reference `UserFilterToolbar.tsx`.
- **List Filter (where builder):** when a list needs nested AND/OR (Logs, Record Events, Users, CRUD Set / designer grids, and other DB-backed lists), keep ordinary toolbar filters (search, roles, selects, checkboxes) in header 1. Put `ListFilterToolbarControl` at the **end** of `PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS` — after the last inline filter — with `separatorBefore` when any control precedes it. Default **`visibility="hide-phone"`** — hide the Filter button on the narrowest tier when inline filters already cover the job; pass `visibility="always"` or `hide-compact` when the page needs it. See [`ui-responsive.md`](./ui-responsive.md) §Component viewport visibility. `ListFilterButton` (`ListFilter` icon + `actions.filter`) opens `ListFilterDialog` (`CreateEditModalShell` `size="3xl"`): dialog header 1 = Filter; dialog header 2 = live draft summary; body = `UiWhereBuilder` with `WHERE_BUILDER_LIST_FILTER_CHROME` (nested groups, no manual SQL, preview off). Footer = Cancel (`X`) + Apply (`Check`). After Apply, `ListFilterSummaryBand` is page **header 2** (between toolbar and grid). Hide the band when the tree is inactive so flush toolbar→grid still holds. Click the summary to edit; its `X` clears. Empty tree = every row. `ToolbarRefreshButton` stays alone in `PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS` (rightmost). On Logs / Record Events, **Include archived** (`ToolbarFilterCheckbox`) stays in the filters cluster before List Filter — data-source toggle, not a where predicate. **Control logs** / **Control records** (`SlidersHorizontal`) live in actions before Refresh. Persist the tree with `usePersistedListFilters`. Hook: `useListFilter` in `src/shared/ui/list-filter/`. Reference `UserFilterToolbar.tsx`, `LogsToolbar.tsx`, `RecordEventsToolbar.tsx`.
- **BuiltIn origin** (platform vs operator item) uses `ToolbarBuiltInFilter` — All (default) / BuiltIn / Not BuiltIn. Do not mix BuiltIn into a Kind filter, a hide-built-in checkbox, or a Hide/Show `UiSelect`. Persist `builtInFilter` and migrate leftover `showBuiltIn` / `hideBuiltinItems` / Kind CSVs with `migrateLegacyBuiltInFilter`. Reference Client Components, Server Functions, Libraries, Portals, Navigations.
- Grid paging footer: `GRID_PAGING_FOOTER_*` — phone shows range + prev/next + `⋯` menu for page-size/sort; page numbers from `lg`.
- **Reference-first rule:** before creating or generating a list toolbar, compare its DOM/class structure with `UserFilterToolbar.tsx`; reuse the shared `PAGE_TOOLBAR_*` tokens and `ToolbarSearchInput` rather than reproducing their styling.
- **Toolbar → grid adjacency:** on a full-height list page, the toolbar must be immediately followed by the grid host with zero gap, margin, or padding. Do not place a spacer or an empty optional-slot wrapper between them; see `ui-grid.md` §Full-height list composition.

## Page header title + metadata (`PageHeaderToolbar`)
- Workspace page headers with an inline description use `PageHeaderToolbar` + `PAGE_HEADER_*` tokens from `surfaceClasses.ts`.
- `description` is also the page-guide hint for that header (`data-page-guide*`). Pass a real sentence, not a restatement of the title.
- Layout: **icon+title cluster** + `·` + description — stacks on phone (`flex-col`), single row from `sm` with `sm:items-center`.
- **Icon + title:** wrap in `PAGE_HEADER_ICON_TITLE_CLUSTER_CLASS` (`inline-flex items-center gap-2`). Put the icon in `PAGE_HEADER_ICON_SLOT_CLASS` (`h-4 w-4` + overflow clipped). Do not leave the icon as a loose sibling of the heading — a responsive `gap` on the outer metadata row is not enough (Lucide strokes sit on the box edge and look flush).
- **Vertical alignment:** title and inline metadata share the same horizontal midline — both use `leading-none`; metadata gets `PAGE_HEADER_META_INLINE_OFFSET_CLASS` (`sm:mt-[3px]`) for optical balance beside a larger bold title.
- Do not override `leading-snug` / custom `mt-*` on toolbar metadata unless a feature spec requires it — alignment is enforced in `PageHeaderToolbar`.
- Reference: `PlatformTransferPageView.tsx`, `SettingsFooter.tsx`, `BaseComponentsHeader.tsx`, `FileManagerPreviewHeader.tsx`.

## List/catalog footer sort
- **Default:** sort field + sort direction controls live in the **page footer** (`GRID_PAGING_FOOTER_CLASS` / `GRID_PAGING_FOOTER_CONTROLS_CLASS`), not in the toolbar.
- Sort direction: icon toggle (`ArrowUpAZ` / `ArrowDownAZ`) — same as `GridPagingFooter`; do not use a select for direction.
- Footer may also show result count (e.g. `{filtered} of {total} routes`).
- **Package list pages:** every paginated `AppTableGrid` / Designer `standardGrid` must enable footer sort (`showSortControls` + `sortOptions`) whenever paging is on — see [`package-ui.md`](./package-ui.md) §P3.
- **Dialog paging footers:** inside any `AppDialogShell` / `CreateEditModalShell`, `GridPagingFooter` auto-insets **10px** from the window left/right edges (`CREATE_EDIT_MODAL_GRID_PAGING_FOOTER_CLASS` / `DialogHostContext`). Do not flush paging chrome to the dialog border.
- **Exception:** keep sort in the toolbar only when a feature spec or shard explicitly requires it.
- Reference: `FunctionListSidebar.tsx`, `GridPagingFooter.tsx`.

## Toolbar button height
- Labeled toolbar buttons: `AppButton` `size="sm"` (`h-8`) — default, but set explicitly in page toolbars.
- Icon-only buttons in page toolbars: `size="icon-md"` (`h-8 w-8`) — square, never rectangular padding.
- Icons inside labeled buttons: `h-3.5 w-3.5` (Lucide).
- Split buttons in page toolbars: `AppSplitButton` `size="sm"`.

## Toolbar action semantics (same role → same color)
Reuse `buttonSemantics.ts` intents — no ad-hoc colors:

| Action | Intent | Notes |
|--------|--------|-------|
| Create / Add / New (modal footer, wizards — labeled) | `create` | solid indigo |
| Create toolbar (icon-only Plus; `ToolbarCreateControl`) | `secondary` | soft indigo outline; 2+ targets → Plus dropdown |
| Refresh / Reload | `utility` via `ToolbarRefreshButton` | icon-only, rightmost |
| Test / connectivity / expand-collapse tree | `utility` | cyan outline |
| Sync / positive remote reconcile | `confirm` | emerald outline — Data Studio **Sync Model** uses this (never indigo fill) |
| Push / Pull / secondary remote | `secondary` | indigo outline |
| Clear / Flush / bulk delete | `destructive-soft` | rose outline |
| Commit / primary workflow step | `primary` | solid indigo |
| Cancel / dismiss | `cancel` | slate outline |

## Workspace back (`WorkspaceBackIcon`)
- **Canonical** control for leaving a nested editor / development workspace back to its list (Data Studio modeler, Component Designer, Workflows, Server Functions, CMS Content Editor, …).
- **Always** use `WorkspaceBackIcon` from `src/shared/ui/WorkspaceBackIcon.tsx` — **never** invent a parallel back with `AppButton`, `ChevronLeft`, HeroUI `Button`, or ad-hoc ghost chrome.
- **Shape:** icon-only native `<button>`; hit target `h-8 w-8`; Lucide `ArrowLeft` at **`h-6 w-6`** `strokeWidth={2}` with **`rtl:rotate-180`** so “back toward list” matches culture direction (larger than labeled-button icons).
- **Tokens:** `ICON_ACTION_BUTTON_MD_CLASS` + `ICON_ACTION_CANCEL_CLASS` (+ explicit `h-8 w-8 shrink-0`). Ghost slate at rest — no AppButton border/fill.
- **A11y:** required `ariaLabel` (and optional `title`, defaulting to `ariaLabel`) — e.g. `Back to list` / `Back to Data Studio list`.
- Auto-tagged for the page guide (`pageGuide.chrome.workspaceBack`, local scope).
- **Placement:** leading control in the workspace content header / editor toolbar (start of the title row), not in the main AppShell chrome.
- **Designer documents:** set `workspaceBack: true` on a `heroui.button` node so runtime/codegen emit `WorkspaceBackIcon` (do not keep Button className chrome).
- **Living sample:** Base Components → **Buttons** (`/base-components/buttons`).
- Reference: `EdgeModelModelerWorkspace.tsx`, `ComponentDesignerView.tsx`, `WorkflowEditorWorkspace.tsx`, `ServerFunctionEditorPanel.tsx`.

## Refresh button (`ToolbarRefreshButton`)
- **Always** use `ToolbarRefreshButton` in admin page toolbars — never ad-hoc `RefreshCw` / `RotateCw` buttons.
- Auto-tagged for the page guide (`pageGuide.chrome.refresh`).
- **Position:** rightmost control inside `PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS`.
- **Shape:** `size="icon-md"`, `intent="utility"`, `RefreshCw` `h-3.5 w-3.5`, spin when `isRefreshing`.
- **Label:** `title` + `aria-label` from culture key `actions.refresh` (fallback in `CULTURE_ACTION_FALLBACK_LABELS`).
- **Separator:** `separatorBefore={true}` (default) when other actions precede refresh; `false` when refresh is the only action.
- Reference: `UserFilterToolbar.tsx`, `RolesToolbar.tsx`, `LogsToolbar.tsx`.

## Panel search (`AppSearchBox`)
- Sidebars/panels/trees: `AppSearchBox` + `APP_SEARCH_BOX_*`.
- Edge-aligned bar (`APP_SEARCH_BOX_BAR_CLASS`); borderless input; clear icon-only when non-empty.
- `ToolbarSearchInput` is auto-tagged for the page guide (`pageGuide.chrome.search`).
- Reference: `FunctionListSidebar.tsx`, `DesignerPaletteSidebar.tsx`.
- Admin toolbar filters may use `ToolbarSearchInput` until migrated.

## Surface box (`AppSurfaceBox`)
- Use `APP_SURFACE_BOX_*` + tone (`slate`, `violet`, `cyan`, …).
- Layouts: `panel` (default) or `strip`.
- Header `h-9`; title `APP_SURFACE_BOX_TITLE_CLASS`.

## Labeled buttons (`AppButton`)
- **No text-only buttons:** a labeled `AppButton` (any visible text label) is **invalid without** a leading Lucide icon `h-3.5 w-3.5` before the label — including modal footers, form actions, toolbar actions, and wizard steps. Do not ship Cancel, Save, Create, or Publish rows with text alone.
- **Icon required:** every labeled/text `AppButton` must include that leading icon. **Exceptions only:** icon-only buttons (`size="icon-sm"` / `size="icon-md"` with no visible label) and `AppButton closeIcon`.
- Intents from `buttonSemantics.ts` — no ad-hoc colors:
  - `primary`/`create` (solid indigo), `cancel` (slate outline), `destructive` (solid rose), `destructive-soft` (rose outline), `confirm` (emerald outline), `secondary` (indigo outline), `utility` (cyan outline), `warning` (amber outline), `toggle-on`/`toggle-off` (cyan/indigo soft — **pressed tools only**).
- Modal close: `AppButton closeIcon`.

## Icon action buttons (non-grid)
- Ghost icon-only; `ICON_ACTION_*_CLASS` from `surfaceClasses.ts`.
- Confirm=emerald, cancel=slate, edit/duplicate=slate→indigo, view=cyan on hover.
- **Delete / remove (inline):** icon-only `Trash2` (`h-3 w-3` in compact rows, `h-3.5 w-3.5` elsewhere); `AppButton` `size="icon-sm"` + `ICON_ACTION_BUTTON_BASE_CLASS` + `ICON_ACTION_DELETE_CLASS` — slate at rest, rose on hover; **no** `intent="destructive-soft"` on inline row/tool removes. Reference `CrudSetColumnList`, `InspectorJsonArrayListField`.
- **Delete (labeled toolbar / modal footer):** `intent="destructive-soft"` (outline) or `destructive` (solid confirm) after the operator already chose delete — see §Danger / destructive confirmation dialogs and `ui-dialog.md`.

## Icon-only buttons
- Square: `size="icon-sm"` (`h-7 w-7`) or `icon-md` (`h-8 w-8`).
- List/toolbar **Create**: always icon-only **`Plus`** via **`ToolbarCreateControl`** (`secondary`); never a visible Create/Add label on the toolbar.

## Split buttons
- Use `AppSplitButton`; modes: dropdown-only or primary+menu.
- `compact` (`h-7`) in designer; `sm` (`h-8`) in page toolbars.
- Reference: Live Designer toolbar / `AppSplitButton` samples on Base Components.

## Button groups (`AppButtonGroup`)
- Joined cluster of **related peer actions** that share one chrome (align, export format, zoom).
- Use `AppButtonGroup` from `src/shared/ui/AppButtonGroup.tsx` — `role="group"` + required `ariaLabel`. Children are `AppButton` `size="sm"` with a leading Lucide icon.
- `orientation="horizontal"` (default) or `"vertical"`. Logical radii (`rounded-s` / `rounded-e`) so RTL stays correct.
- Prefer one shared intent (usually `secondary`). Do not fake a group with a `flex gap-2` row of loose `AppButton`s.
- **Not** exclusive mode picks — those stay `UiSegmentedControl` (Base Components → Tabs).
- **Not** toolbar action overflow — those stay `ToolbarActionGroup`.
- **Not** primary+menu — those stay `AppSplitButton`.
- Living sample: Base Components → Buttons → button group.

## Selection toggles (`AppSelectionToggle`)
- Wrap of **include/exclude** chips (export columns, output fields, join fields, chip values): always `AppSelectionToggle` from `src/shared/ui/AppSelectionToggle.tsx`.
- **Selected:** `intent="confirm"` (mild emerald `SOFT_TONE_CLASS.emerald`) + leading Lucide `Check` `h-3.5 w-3.5`.
- **Unselected:** `intent="cancel"` (slate) + leading Lucide `X` `h-3.5 w-3.5`.
- Host wrap: `APP_SELECTION_TOGGLE_WRAP_CLASS` (`flex flex-wrap gap-2`). `aria-pressed` follows `selected`.
- **Never** use `toggle-on`/`toggle-off` (pressed tools), `primary`/`secondary`, or a text-only `AppButton` for this role.
- **Not** exclusive mode/category picks — those stay `UiSegmentedControl`.
- **Not** joined peer actions — those stay `AppButtonGroup`.
- Living sample: Base Components → CRUD Set → Export dialog columns; interactive chips on Base Components → Chip.

**IDs:** `ui.toolbar.*`, `ui.toolbar.list-where-filter`, `ui.button.*`, `ui.icon-action.*`, `ui.search.panel.appsearchbox`, `ui.surface.box.appsurfacebox`, `ui.tool.active-color.non-gray`, `ui.list.footer.sort`.
