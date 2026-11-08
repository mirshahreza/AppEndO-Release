# UI grids and table columns

> **Shard:** `ui-grid`  
> **List composition:** [`crud-pages.md`](./crud-pages.md) · **Footer sort:** [`ui-toolbar.md`](./ui-toolbar.md)  
> **Living sample:** Base Components → Grid / TreeGrid (Chrome + Paging).

## Intent

All table lists use `AppTableGrid`. Page lists use `chrome="classic"` (default). Embedded editors, dialogs, and property panels use `chrome="hero"`. One footer owns paging + sort.

## Grid shell (`AppTableGrid`)
- All **page / CRUD list** and **embedded** grids through `AppTableGrid` + `APP_TABLE_GRID_*`.
- **Chrome** (`chrome`, default **`classic`**): same component, two visual treatments. Living sample: Base Components → Grid → Chrome (`classic` | `hero`).
  - **`classic`** — flush page list (margin 0, border 0). Current CRUD density (`py-3` cells, slate-300 header rule).
  - **`hero`** — joined 8px card (`APP_TABLE_GRID_JOINED_SHELL_CLASS`), airy rows (`py-4`), quieter header band, default margin **4px** / border **5px** (override with `margin` / `borderWidth`). Pair the `footer` slot with `GridPagingFooter chrome="hero"` so the paging band matches the card. Header top corners use `HERO_TABLE_HEADER_CORNER_CLASS`. Use `scrollOwner="panel"` when a parent panel should scroll (Column Properties, floating panels).
- Sticky headers; paging footer via `footer` slot (`GridPagingFooter`). Living sample: Base Components → Grid / TreeGrid → **Paging** (on/off plus pattern, page size, sort controls, summary). Default **on** for Grid; TreeGrid defaults **off** (product trees are not paged — see [`crud-pages.md`](./crud-pages.md)). Operators can still turn Paging on in the TreeGrid living sample.
- **Full-height list composition:** follow `UsersPageView.tsx`: page root `flex h-full min-h-0 w-full flex-col`; toolbar `shrink-0`; grid host `flex min-h-0 w-full flex-1 flex-col`; `AppTableGrid` owns the scroll body and renders the footer as `shrink-0`. **Height** (`fillHeight`, default `true` / **100%**) is that fill. Set `fillHeight={false}` (**content**) to hug rows instead of stretching. Living sample: Base Components → Grid / TreeGrid → Height (`100%` | `content`).
- **Flush header:** the grid host must directly follow the page toolbar with **zero** `gap`, `space-y-*`, margin, or padding, so the table header touches the toolbar bottom border. Do not fix structural spacing with global CSS selectors or `!important`.
- **Exception — List Filter header 2:** when `ListFilterSummaryBand` has an active summary it sits between the toolbar and the grid host (`LIST_FILTER_SUMMARY_BAND_CLASS`, `shrink-0`, `border-b`). That is the only allowed chrome in that gap. Render the band only when the filter is active (`ListFilterSummaryBand` returns `null` when the summary is empty) so an inactive filter keeps flush toolbar→grid. Do not leave an empty wrapper, spacer, or always-on band. Reference `UsersPageView.tsx` / `LogsPageView.tsx` / `RecordEventsPageView.tsx`.
- Optional content above a grid may add spacing only when it actually renders. React arrays are truthy even when empty: use `React.Children.count(children) > 0` (or an equivalent semantic check) before creating a spacer/wrapper such as `mb-2`.
- Generated Designer/CRUD pages must preserve the same composition as `UsersPageView.tsx` + `UserTableGrid.tsx`; generated output is accepted only when toolbar controls are vertically centered, the table header is flush below the toolbar, and the body fills through to `GridPagingFooter`.
- **Choose presentation by information density, not habit:** when a collection has only a few meaningful fields (typically a title plus about 1–3 compact attributes/status values), prefer `presentation="cards"` at every viewport. Use a table/grid when many comparable columns, dense scanning, or cross-row column alignment materially helps the operator.
- **Adaptive presentation:** `presentation` (`table` | `cards` | `table-scroll` | `auto`; default **`auto`**) + optional `cardBelow` (`phone` | `tablet` | `desktop`; default **`tablet`**). In `auto`: phone → 1 card per row, tablet → 2 cards per row, desktop+ → table. `cardBelow="phone"` keeps tablet as horizontal table-scroll with a frozen first column; `cardBelow="desktop"` uses cards at every size (including wide) — only when each record is a self-contained item, not a comparison task. Column mode only. Do not ship page lists as `presentation="table"` unless the operator must compare many columns on compact screens.
- **Compact viewport policy** (`compact.phone` / `compact.tablet`) overlays that preset so every `AppTableGrid` can control tablet/phone independently:
  - `layout`: `keep-table` (stay a grid) | `table-scroll` (horizontal table + freeze first column by default) | `cards`.
  - Phone cards are locked to **one card per row**. Tablet list cards default to **2** per row; set **`compact.tablet.cardsPerRow`** (`1` | `2` | `3`) on `AppTableGrid` / CRUD Set / Base Components **Compact viewport** whenever tablet uses card layout (default `auto` + `cardBelow="tablet"` qualifies — not only when tablet layout is explicitly `cards`). Desktop/wide card lists default to **2** per row so a wide pane is not a single stacked stream. **Cards in the same row share equal height** (`items-stretch` + `h-full` card shell).
  - `freezeFirstColumn`, `collapseExtraFields` + `visibleFieldCount` (More/Less), `showActions`, `showMeta`.
- Living sample: Base Components → Grid / TreeGrid → Presentation + Compact viewport (same labels and values). Designer inspector fields `compactPhoneLayout` / `compactTabletLayout` / `compactTabletCardsPerRow` / … map to the same contract. TreeGrid `cards` is stacked rows; it omits table-scroll, freeze-first-column, and cards-per-row. TreeGrid stacked rows still support field-label chrome and action placement; AppTableGrid standard cards use fixed label rules and footer actions only.
- **Standard card layout** (single built-in card view — no presets): row 1 = optional `media` at logical start beside the first three data fields (`title` + `subtitle` + `field`, no labels); solo `media` centers in the card. Remaining `field` / `meta` rows render below as one-line `label:value` rows (`truncate`). `media` never shows a field label. Pass row actions via `getCardRowActions` — footer only; non-delete actions start, `intent="delete"` end.

## List card chrome (unity — phone through desktop)

### Compare two living lists (mobile)

| | **Server Functions** (catalog) | **Users** (CRUD record) |
|---|-------------------------------|-------------------------|
| **Host** | `DevelopmentCatalogCardGrid` + `DevelopmentCatalogCard` | `AppTableGrid` compact cards |
| **Outer shell** | `APP_TABLE_GRID_CARD_CLASS` (border + `shadow-sm`) | Same token via `APP_TABLE_GRID_CARD_SHELL_CLASS` |
| **Inside the tile** | Title (mono slug) + one footer row (date + method badge) | Title + subtitle + optional **labeled** rows (`ROLES:`, `LOCK STATUS:`) + footer actions |
| **Phone columns** | **1 card per row** (`grid-cols-1` below `sm`) | **1 card per row** (`resolveGridCompactViewport` forces `cardsPerRow: 1` on `phone`) |
| **Tablet columns** | 2+ (`sm:grid-cols-2`, …) | Default **2** per row (`compact.tablet.cardsPerRow`) |

The screenshots **should differ inside** (catalog vs dense record). They **must not** differ because phone invented a second chrome (borderless strips, zero gap, or a “flat list” variant). If two lists look like different **containers**, that is a bug — not an intentional “mobile mode.”

### Rules

**Decision:** every list uses the **same raised tile** on compact tiers. Reference catalog: **Server Functions** (`DevelopmentCatalogCard*` in `FunctionListSidebar.tsx`). CRUD lists use the **same outer shell** via `AppTableGrid` — not a separate borderless list on phone.

| Layer | Token / component | Rule |
|-------|-------------------|------|
| **Outer shell** (all list cards) | `LIST_PAGE_CARD_SHELL_CLASS` (`APP_TABLE_GRID_CARD_CLASS` alias) / `APP_TABLE_GRID_CARD_SHELL_CLASS` | `rounded-md`, `border border-slate-200`, `bg-white`, `px-2 py-1.5`, `shadow-sm`, shared hover (`hover:shadow-md`, primary border tint). **Identical** on catalog and CRUD — do not override padding/shadow per page. |
| **Grid gutter** | `LIST_PAGE_CARD_GRID_GUTTER_CLASS` + `LIST_PAGE_CARD_GRID_GAP_CLASS` | Shared card gap (`gap-2`) and inset (`px-3 py-2`, `sm:px-4`) for `appTableGridCardListClass` and `DevelopmentCatalogCardGrid`. Virtualized AppTableGrid card lists must pass `LIST_PAGE_CARD_GRID_GAP_PX` to `useVirtualizer({ gap })` — CSS `gap` does not apply to absolutely positioned virtual rows. Wrap the virtualizer’s `position: relative` host in an outer element with `LIST_PAGE_CARD_GRID_INSET_CLASS` so `px-3`/`sm:px-4` inset is not ignored by absolutely positioned card rows. |
| **Footer band** | `APP_TABLE_GRID_CARD_ACTIONS_CLASS` | `mt-1 pt-1 border-t border-slate-100` — catalog footer and AppTableGrid card actions use the same spacing. |
| **Inner layout A — catalog** | `DevelopmentCatalogCardHeader` + `DevelopmentCatalogCardFooter` | Sparse inventories: identifier title, optional chips, date + badge row, hover icon actions. **Same inner layout on phone and tablet** — only column count changes. |
| **Inner layout B — record** | `AppTableGridCardItem` standard layout | Dense CRUD: title/subtitle band + labeled field rows + footer actions. **Same inner layout on phone and tablet** — only column count changes; trim fields with `card.phoneRole` / `hideBelow`, not a new card frame. |

**Phone tier (`viewportTier === 'phone'`):**

- **Exactly one card per row** — `cardsPerRow` is **always 1**; ignore `compact.phone.cardsPerRow` overrides (`gridCompactViewport.ts` + tests).
- **No mobile-only card chrome** — do not branch JSX/CSS to drop border, shadow, or inter-card `gap` on phone.
- **No “flat list” presentation** — stacked rows without `APP_TABLE_GRID_CARD_CLASS` are forbidden for page lists.

**Tablet tier:** may show 2 (default) or 3 cards per row; outer shell unchanged.

**Desktop (`lg+`) with `presentation="auto"`:** switches to **table** — that is a presentation change, not a phone card-style change.

**Trim compact cards** with `card.phoneRole` / `card.tabletRole` / `hideBelow` — hide low-value fields instead of swapping chrome.

**Anti-patterns:** borderless full-bleed rows on phone; `max-lg:` overrides that strip `shadow-sm`/`border`; per-page “mobile card” components; forcing catalog inner layout onto CRUD (or the reverse) — only the **shared outer tile** is unified.

See also [`ui-responsive.md`](./ui-responsive.md) §Grids and lists · [`ui-design-system.md`](./ui-design-system.md) §Catalog inventory typography.
- **Card metadata** on `AppTableGridColumnDef`: `card.role` (`title` | `subtitle` | `meta` | `field` | `media` | `actions` | `hidden`), optional `card.label` / `card.priority`; `card.phoneRole` / `card.tabletRole` override role on that viewport (`hidden` drops the column from cards). `hideBelow` (`md` | `lg`) hides the column in **table, table-scroll, and card** layouts below that breakpoint (`md` = phone, `lg` = phone+tablet). Reuse existing `renderCell` (boolean icons, dates, actions semantics unchanged).
- **Card row actions** (`getCardRowActions`): default inline budget when `cardActionsMaxVisible` is omitted — **1** on phone, **2** on tablet (`resolveGridCardActionsMaxVisible`). Footer uses `AppGridRowActions` `density="card"` (32px icon targets). Mark the primary task with `GridRowActionItem.cardLabeled` for a labeled `sm` button; delete and secondary tools collapse into overflow.
- **Card actions:** compact `showActions: false` hides row actions on cards. Card actions always render in the footer when `getCardRowActions` is provided.
- **Sticky header scroll:** when `stickyHeader` is on (default) and the grid owns vertical scroll (`scrollOwner="self"`), the header band stays fixed and **only the row body scrolls** (split table layout). Horizontal scroll appears **only on the body**; the header tracks body `scrollLeft` via transform (no second scrollbar). The header band uses `overflow-hidden` to clip that horizontal transform — column filter popovers and the column-layout menu must **portal to `document.body`** (fixed, same pattern as `AppGridRowActions` overflow) so they are not clipped by the band or covered by the body. **Shell route outlet** (`ShellRouteOutlet`) uses **`overflow-hidden`** — list pages scroll inside `AppTableGrid` (or another host), not on the shell outlet, so a shell-level native scrollbar cannot cause load-time horizontal jump. Non-list pages that need document scroll should use **`AppScrollOverlayHost`** (or `scrollGutter="overlay"` on a grid).

**Scroll gutter** (`scrollGutter` on `AppTableGrid`, default **`overlay`**): **`overlay`** — native bars hidden via **`APP_TABLE_GRID_SCROLL_OVERLAY_CLASS`** plus **`AppTableGridOverlayScrollbars`** (`z-[30]` thumbs over the last column / bottom edge; wheel, trackpad, and thumb drag still scroll); header and body stay the same width when overflow toggles after load — do not pad the header band. With **`overlay`**, the last column adds **`APP_TABLE_GRID_LAST_COLUMN_OVERLAY_INSET_CLASS`** on the table plus **`APP_TABLE_GRID_LAST_COLUMN_OVERLAY_INSET_CELL_CLASS`** on last header/body cells (+13px inline padding each side via `--app-table-grid-last-column-overlay-inset`) so overlay thumbs and column `!px-*` overrides do not cover cell content. **`native`** — OS scrollbars reserve width; split sticky-header bands pad **`padding-inline-end`** by the body vertical scrollbar gutter (`syncSplitHeaderScrollbarGutter`) so header and body tables align. Set `stickyHeader={false}` to scroll header + rows together.
- **Cell padding:** `cellPaddingX` (default **5**) is left and right padding on **every** column (header + body). Override per grid; living sample: Base Components → Grid → Cell padding. Applied via `--app-table-grid-cell-px` on `APP_TABLE_GRID_TABLE_CLASS`. Standalone tables that cannot use the table class: `appTableGridCellPxClass()` / `appTableGridHeaderCellClass()`.
- **Cell overflow:** body cells clip at the column edge (`table-fixed` + `overflow-hidden` on `APP_TABLE_GRID_TABLE_CLASS` / `APP_TABLE_GRID_BODY_CELL_CLASS`). Default inner wrap is `APP_TABLE_GRID_CELL_CLIP_CLASS` (`truncate` / ellipsis). Set `wrap: true` on a column to use `APP_TABLE_GRID_CELL_WRAP_CLASS` (`whitespace-pre-wrap break-words`) so long text stacks onto extra lines instead of a single-line ellipsis. Header cells stay overflow-visible; filter popovers and the column-layout menu still portal out of the split header band. Fix this in the base grid, not per page.
- **Leftover width:** `table-fixed` + `w-full` leftover goes to the unconstrained column (typically Title). Compact columns keep their authored widths and sit next to Actions. Do not insert a dead spacer/`__filler__` column — that empty band between Timeline and Actions is leftover width in the wrong place, and two unconstrained columns make split header/body tables disagree.
- **Column resize:** default **on**. Drag the header edge to set width; **double-click the resize handle** to auto-fit the column to header + visible cell content (Excel-style). Widths restore from browser `localStorage` when `persistListKey` is set (same list-prefs blob as paging/sort). Per-column `layout.resizable` defaults true; set `false` (or `layout={false}`) to lock a column. Selection and typical Actions columns stay locked. Hide/reorder/pin stay behind `enableColumnLayout`. Optional `minWidth` on `AppTableGridColumnDef` sets a per-column resize/sanitize floor (global minimum remains `GRID_COLUMN_MIN_WIDTH` / 48px). Living sample: Base Components → Grid → Name min width.

## Column sort/filter
- Use `AppTableGridColumnDef` + `useGridQueryState`.
- Per-column `sort`/`filter`; modes `client` or `server`.
- Client mode needs `getSortValue` / `getFilterValue`.
- Header icons: client stroke `1.25`, server `2.75`; `title`/`aria-label` include `(client-side)` or `(server-side)`.
- Filter popovers: draft-then-apply; icon-only confirm/cancel; body-portaled so the sticky header band cannot clip them. Flip horizontal align (and vertical side) when the viewport has no room — last columns open toward the start, not off-screen.
- **Header sort/filter visibility** (`headerQueryControlsVisibility`, default **`hover`**): `always` keeps sort/filter icons inline beside the label; `hover` hides idle icons and reveals them on a header-band overlay when the pointer is over that column header; the **active sort** column also reveals on pointer-over **any** header in the row (pinned while a filter is active or the filter popover is open). Living sample: Base Components → Grid → Column query → Header sort/filter.
- Server-sliced pages: `gridQueryMode="server"`.
- Optional `getCellClassName(row)` merges with `cellClassName`. CRUD Set column `conditionalFormat` maps onto this. Do not invent a second cell-style engine.

## List modes
- Paging + Infinite Scroll; user can switch.
- `useGridListPresentation`; mode switch in footer.
- Default page size `50`; options `50`–`10000` (`gridPagingConstants.ts`).
- Label-style dropdowns for page size/sort field; icon toggle for sort direction.
- **Package / Designer list grids:** if the footer is shown (`showPagingFooter` / pagination on), also enable footer **sort field + direction** (`showSortControls`, `sortOptions`) — see [`package-ui.md`](./package-ui.md) §P3 and [`ui-toolbar.md`](./ui-toolbar.md) §List/catalog footer sort. Do not ship a paging footer without sort controls unless the plan strips pagination entirely.
- **Dialog inset:** paging footers inside dialogs use **10px** left/right inset from the window edge (`CREATE_EDIT_MODAL_GRID_PAGING_FOOTER_CLASS`, auto via `DialogHostContext` under `AppDialogShell`). `chrome="hero"` skips that inset: classic paging, hero body fill, joined rounded shell around grid + footer (`HERO_TABLE_JOINED_SHELL_CLASS`, `borderWidth` default 5px).
- **Client remember:** list filters + pagination settings (`pageSize`, `listMode`), column sort/filter (`useGridQueryState` with `persistListKey`), and **column resize widths** persist in **browser `localStorage` only** via `usePersistedListPaging` / `usePersistedListFilters` + `APP_LIST_PREFERENCE_KEYS` / AppTableGrid `persistListKey` — not user profile / server attributes. Do not persist current page number.

## Actions column
- No visible header title.
- Render through `AppGridRowActions` when a row has more than one icon action. Show up to `maxVisibleActions` (default 3) inline 20px tools; extra actions collapse into a `MoreHorizontal` dropdown (fixed portal menu so overflow-hidden grid shells do not clip it).
- 20px per **visible** slot (inline icons + overflow trigger); width = padding + (20 × slot count) + (7 × (slot count − 1)). Use `gridActionsColumnWidth(resolveGridActionSlotCount(actionCount, maxVisible))`.
- Conditional actions stay visible but disabled (`text-slate-400`).
- Semantics: View/Test=cyan, Access=`KeyRound`+`GRID_ACTION_ACCESS_CLASS`, Edit=indigo, Activate=emerald, Lock=amber, Delete=rose.
- Card/stacked surfaces honor `cardActionsPlacement`: footer, header, or none.

## Column text direction
- Set reading direction on `AppTableGridColumnDef` with `textDirection` (default **`culture`** — same as the active culture / theme direction).
- Use **`opposite`** when the column must read against the culture direction.
- Use explicit **`ltr`** or **`rtl`** only for technical identifiers, locale codes, or other content that must not follow culture (never hard-code physical `text-left` / `[direction:ltr]` on columns).
- Center- or end-aligned columns (booleans, dates, actions) keep their alignment; bidi overrides apply to start-aligned data columns only.
- Living sample: Base Components → Grid → Column text direction.

## Boolean / date / audit columns
- Booleans: `Check` emerald / `X` rose icons only; `-` for null.
- Dates: center-aligned, `YYYY-MM-DD` only.
- `_by` columns: plain text, not clickable.
- Created/Updated width: `150px` (`APP_TABLE_GRID_AUDIT_COLUMN_WIDTH`).

## Grid image payloads
- List/grid endpoints: thumbnails only; full size on detail endpoints.

**IDs:** `ui.grid.*`, `ui.grid.list-filter.header-2`, `data.images.grid-thumbnail-only`.
