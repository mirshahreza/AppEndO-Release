# UI responsive — viewport tiers, adaptation, QA

> **Shard:** `ui-responsive`  
> **Shell chrome (geometry lock):** [`ui-core.md`](./ui-core.md) §Admin shell · §Responsive (summary) · §Overlay motion  
> **Surface shards:** [`ui-toolbar.md`](./ui-toolbar.md) · [`ui-grid.md`](./ui-grid.md) · [`ui-dialog.md`](./ui-dialog.md) · [`ui-inspector-rail.md`](./ui-inspector-rail.md) · [`crud-pages.md`](./crud-pages.md)  
> **Living catalog:** Base Components → Client component (`UiClientComponent`) · Grid → Presentation + Compact viewport  
> **QA skill:** `.claude/skills/appendo-qa-ui-responsive-pass/SKILL.md`

## Intent

AppEndO is **desktop-first** in design but **must work on phone and tablet** for every studio route. Responsive behavior is **selective adaptation** (change presentation and layout), not shrinking a fixed desktop canvas.

External references (inform our rules, not copy blindly). QA agents: [`.claude/skills/appendo-qa-ui-responsive-pass/SKILL.md`](../../.claude/skills/appendo-qa-ui-responsive-pass/SKILL.md) §Design-system lens.

| Source | Takeaway for AppEndO |
|--------|----------------------|
| [WCAG 2.2 SC 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum) | Minimum **24×24 CSS px** targets (AA); prefer **44×44** for primary chrome on touch tiers ([SC 2.5.5](https://www.w3.org/WAI/WCAG21/Understanding/target-size.html) AAA). |
| [WCAG 2.1 SC 1.4.10 Reflow](https://www.w3.org/WAI/WCAG21/Understanding/reflow.html) | **No horizontal scroll** for page content at 320 CSS px width (400% zoom); tables/maps/canvases are documented exceptions. |
| [web.dev — tap targets](https://web.dev/articles/accessible-tap-targets) | ~**48×48** recommended; **8px** spacing between adjacent targets on touch surfaces. |
| [Material 3 — breakpoints](https://m3.material.io/foundations/layout/breakpoints/overview) | **Compact** &lt;600dp, **medium** 600–839, **expanded** 840+: change **nav + panes**, not one shrunk desktop canvas. |
| [Material 3 — adaptive layout](https://m3.material.io/foundations/layout/layout-overview/adaptive-design) | **Reflow / show-hide** over horizontal scroll; **modal drawer** on compact/medium; **full-screen dialog** for long tasks on compact. |
| [Material 3 — navigation drawer](https://m3.material.io/components/navigation-drawer/guidelines) | One **navigation graph**; drawer **modal** below expanded widths; dismiss on selection, scrim, Escape. |
| [Fluent 2 — layout](https://fluent2.microsoft.design/layout) | **Reposition · resize · reflow · show/hide · re-architect**; design to **320px**; touch **44×44** (web) / **48×48** (Android). |
| [Fluent 2 — responsive (WinUI)](https://learn.microsoft.com/en-us/windows/apps/design/layout/responsive-design) | **Reposition** stacks→rows; **reflow** more columns; **show/hide** secondary chrome; less navigation depth on large windows. |
| SaaS admin shell | **One nav model per band**: overlay drawer &lt;1024; docked rail ≥1024; studio tools **lg+** title row only. |

### Crosswalk: Material 3 / Fluent 2 → AppEndO tiers

Do **not** add parallel breakpoint constants — map guidance to **`viewportTokens.ts`**.

| Industry band | Material 3 (dp) | Fluent 2 size class | AppEndO tier | Shell / content |
|---------------|-----------------|---------------------|--------------|-----------------|
| Narrow phone | Compact &lt;600 | `small` 320–479 | `phone` ≤399 | Overlay nav; cards; toolbar stack |
| Phablet | Compact &lt;600 | `medium` 480–639 | `phone` / early `tablet` | Overlay nav; second title row &lt;`sm` (640) |
| Tablet | Medium 600–839 | `large` 640–1023 | `tablet` 400–1023 | **Same overlay nav as phone** (not hover rail) |
| Desktop | Expanded ≥840 | `x-large` ≥1024 | `desktop` / `wide` | Docked sidebar ≥**1024** (`lg`); table grid |
| Wide | Large ≥1200 | `xx-large` ≥1366 | `wide` ≥1280 | Toolbar labels `xl+` |

**Do not copy without adaptation:** M3 **bottom navigation bar** (studio uses hamburger drawer); M3 **bottom sheet** for long CRUD forms (use near-fullscreen dialog); Fluent **separate adaptive markup** (prefer one tree + visibility props); M3 **persistent drawer at 840dp** (AppEndO rail at **1024** — geometry lock).

### Fluent techniques (audit vocabulary)

| Technique | AppEndO example |
|-----------|-----------------|
| Reposition | Toolbar filters above actions &lt;`lg`; master-detail stack |
| Reflow | Table → cards; `sm:grid-cols-2` form pairs |
| Show / hide | `ComponentViewportVisibility`; card field roles |
| Re-architect | Inspector stack &lt;`lg`; list/detail navigation on phone |
| Resize | Search width steps; bounded `max-w-*` desktop column |

## MUST

- Use **`viewportTokens.ts`** + **`useViewportTier()`** for tier-aware behavior. Do not invent parallel breakpoint constants.
- Treat **phone and tablet as compact chrome** via `isCompactChromeTier` / `isOverlayNavTier` unless a shard documents a narrower exception.
- Ship **studio route nav** without `minViewport: 'desktop'` on core pageKeys (Users, Git, Data Studio, File Manager, hubs, …). Optional `minViewport` on a **single** custom binding may hide that nav item and gate deep links — see `filterAdminShellNavByViewport` / `DesktopOnlyGate`.
- List pages: `AppTableGrid` **`presentation="auto"`** and **`cardBelow="tablet"`** by default — see [`ui-grid.md`](./ui-grid.md).
- Page toolbars: **`PAGE_TOOLBAR_SINGLE_ROW_CLASS`** (stacks below `lg`) + **`ToolbarActionGroup`** for dense actions.
- Modals on compact chrome: **`AppDialogShell`** near-fullscreen on phone **and** tablet (`isCompactChromeTier`), except `size="full"` / `contained` — see [`ui-dialog.md`](./ui-dialog.md).
- Overlay motion: **`overlayMotionPanelProps`** / directional enter from trigger edge — [`ui-core.md`](./ui-core.md) §Overlay motion; respect `prefers-reduced-motion`.
- **Safe areas:** header uses `env(safe-area-inset-top)` as **extra** inset above the 52px compact band; pinned footers / composers add `env(safe-area-inset-bottom)` — do not let fixed chrome sit under the home indicator.
- Prefer **shared primitives** (`ShellResponsiveDrawer`, `ShellResponsivePopover`, `ToolbarActionGroup`, grid `compact.*`) over page-level `hidden lg:block` forests.

## NEVER

- **Horizontal scroll on the page body** to “fit” desktop layouts (exception: `table-scroll` / frozen column **inside** `AppTableGrid`, or pan/zoom **canvases** that intentionally clip).
- **Docked sidebar rail** or **hover flyouts** below **1024px** (`lg`) — compact tiers use **hamburger + overlay drawer** only.
- **`presentation="table"`** on full-page CRUD lists without an operator reason (column comparison on compact).
- **`minViewport: 'desktop'`** on studio surfaces to avoid mobile work.
- Ad-hoc dialog slide/fade classes — use shared overlay motion.
- Change **admin-shell geometry** (sidebar widths, header heights, logo metrics) for responsive fixes — [`ui-core.md`](./ui-core.md) §Admin shell geometry lock.

---

## Viewport model

### JS tiers (`resolveViewportTier`)

| Tier | Width (px) | Role |
|------|------------|------|
| `phone` | ≤399 | Narrow phone; second header title row below `sm` (640) |
| `tablet` | 400–1023 | Compact chrome + overlay nav (same nav UX as phone) |
| `desktop` | 1024–1279 | Docked expandable sidebar from `lg` |
| `wide` | ≥1280 | Same shell as desktop; more horizontal room for content |

Helpers:

- `isCompactChromeTier` → `phone` \| `tablet` (dialogs, AppEndO overlay, mark-only logo).
- `isOverlayNavTier` → `phone` \| `tablet` (hamburger drawer; **no** collapsed-rail flyouts).

### Tailwind alignment

| Token | px | Use |
|-------|-----|-----|
| `sm` | 640 | Page header metadata row; form pair grid second column |
| `md` | 768 | Toolbar search min width; column `hideBelow: 'md'` (= phone only) |
| `lg` | **1024** | Shell rail vs overlay; toolbar single row; master-detail row layout |
| `xl` | 1280 | Toolbar action labels; wider search |

**Rule:** Shell / nav / compact dialog policy follows **JS tier at 1024**. Page layout stacks often use **`lg:`** so they match overlay nav. Form pairs use **`sm:grid-cols-2`** (640) — acceptable: fields reflow earlier than the shell rail.

### Design widths (QA)

| Profile | Size | Notes |
|---------|------|--------|
| Phone | **390×844** | Primary phone pass (iOS logical) |
| Phone narrow | **360×640** | Supported; avoid horizontal page scroll |
| Tablet | **768×1024** | Portrait tablet |
| Desktop | **1280×800** | Studio default |
| RTL | 390×844 `dir=rtl` | When culture is RTL |

**Minimum supported layout width:** **360px** content. Do not require 320px multi-column layouts; at 320px single-column stack and grid cards are acceptable.

**Tablet landscape:** Width may exceed 1024 while still classified as `tablet` tier only when width ≤1023. At ≥1024 width, tier becomes `desktop` and docked rail applies — **no** special-case “landscape tablet rail.”

---

## Admin shell and navigation

| Tier | Navigation | Logo | Page guide |
|------|------------|------|------------|
| `desktop`+ | Docked sidebar (expanded / collapsed rail); section flyouts on collapsed rail | Full lockup in sidebar (`appendo-wordmark-currentColor.svg`) | Available |
| `tablet` + `phone` | **Overlay drawer** from logical `start`; backdrop; closes on navigate / backdrop / Escape; focus return to hamburger | Mark-only in header + drawer (`appendo-mark-currentColor.svg`) | Hidden on `phone`; available on `tablet`+ |

**Tablet uses the same overlay nav as phone** — pointer hover is not a reliable tablet affordance; do not show docked rail or hover-only nav between 400–1023px.

**Header**

- Compact (`<lg`): **52px** content band + safe-area top — [`ui-core.md`](./ui-core.md) §Admin shell.
- Below `sm` (640): **second band** with centered page title (`ADMIN_SHELL_HEADER_TITLE_ROW_CLASS`).

**AppEndO agent panel:** overlay (not docked) on `isCompactChromeTier`.

**Profile drawer:** end-edge overlay with peek — not full screen — [`ui-core.md`](./ui-core.md) §Admin shell.

**IDs:** `ui.responsive.selective` · `ui.admin-shell.*` (see `ui-core`)

---

## List page scroll chrome

Industry pattern (Material 3 [top app bar](https://m3.material.io/components/top-app-bar/guidelines), Fluent [scroll behavior](https://learn.microsoft.com/en-us/windows/apps/design/behavior/touch-scroll), iOS Safari): **scroll down** into content → **reclaim vertical space** by hiding or collapsing **page-local** chrome; **scroll up** → restore chrome immediately; **near top** (≤24px) → always expanded.

| Chrome | Scroll down | Scroll up | Lock |
|--------|-------------|-----------|------|
| Admin shell header / sidebar | No change | No change | Geometry lock |
| Page toolbar (filters + create) | Collapse (`useCollapsingListToolbar` + `listPageToolbarCollapsedClass` / `page-toolbar-scroll-collapsed` — must zero `index.css` `h-14` lock, not only `opacity`) | Expand | — |
| `ListFilterSummaryBand` | Keep visible when active (operator context) | — | — |
| `GridPagingFooter` | Sticky at grid bottom (default) | — | — |

**Implementation (all full-height list / CRUD grids):**

| Piece | Location |
|-------|----------|
| Scroll hook | `useCollapsingListToolbar` or `useListPageToolbarScroll` — wire `onScroll` on the grid scroll owner (`AppTableGrid` / `BaseTreeGrid`) |
| Toolbar wrapper | `ListPageToolbarScrollHost` or `ListPageToolbarScrollRoot` around the `PAGE_TOOLBAR_*` root (grid `0fr`/`1fr` clip — do not height-collapse the toolbar node alone) |
| Constants / motion | `listPageToolbarScrollChrome.ts` (`LIST_PAGE_TOOLBAR_*`) + `index.css` `.list-page-toolbar-scroll-host` (~360ms, Material-style easing, `prefers-reduced-motion: reduce` → none) |

**Scroll intent (do not fork per page):**

- **Down** (`scrollTop` increases): collapse on the **first** downward tick (trackpads emit small steps — no 10px gate).
- **Up** (`scrollTop` decreases): expand on **any** upward tick.
- **Near top** (`scrollTop` ≤ `LIST_PAGE_TOOLBAR_TOP_REVEAL_PX`): always expanded.
- **Layout settle** (~`LIST_PAGE_TOOLBAR_LAYOUT_SETTLE_MS` after collapse or expand): ignore opposite-direction deltas caused by grid client resize / `scrollTop` clamp so the toolbar does not flash open/closed.

Do not hide the only path to **Refresh** or **Create** without an overflow menu — compact toolbar uses existing `ToolbarActionGroup` on phone/tablet; collapsed desktop toolbar is temporary until scroll up.

**ID:** `ui.list.scroll-toolbar`

## Bounded shell and compact bleed

Studio admin chrome defaults to **`shellLayoutWidth: bounded`** (`ShellBoundedLayoutCanvas`).

| Tier | Bounded column |
|------|----------------|
| `phone` + `tablet` (`<lg`) | **Full bleed** — `px-0` on the **bounded shell column** (`SHELL_BOUNDED_HORIZONTAL_PAD_CLASS`); no atmosphere gutter beside the white host; drop outset shadow on the column (`max-lg:shadow-none`). Page toolbars keep `px-3 sm:px-5` so controls do not touch the viewport edge. |
| `desktop`+ (`≥lg`) | Centered `max-w-*` column, also **`px-0`** (no inset beside the lateral edge seams); atmosphere only outside the column gutters; outset/hairline/`::before` edge as designed |

The white **content host** (`ADMIN_SHELL_CONTENT_HOST_CLASS`) already drops start border and corner radius below `lg`. Compact tiers should read as one continuous surface edge-to-edge.

---

## Component viewport visibility

Prefer **declarative props on shared controls** over page-level `hidden lg:flex` forests.

| API | Location |
|-----|----------|
| `ComponentViewportVisibility` | `src/shared/lib/viewportVisibility.ts` |
| `useComponentViewportVisible(visibility)` | `src/shared/lib/useComponentViewportVisible.ts` |

Values: `always` · `hide-phone` (≤399) · `hide-compact` (phone+tablet) · `wide-only` (≥1280).

**Defaults are per component** (chosen from what the control does on that tier):

| Control | Default `visibility` | Rationale |
|---------|----------------------|-----------|
| `ListFilterToolbarControl` | `hide-phone` | Where-builder is heavy; phone keeps search + inline selects; use summary band / tablet+ to open the dialog |
| `ToolbarFilterSelect` | `always` | Pages set `hide-phone` / `hide-compact` when a filter is redundant on that tier (e.g. Users person type on phone) |
| `ToolbarActionGroupWithRefresh` | Refresh in compact ⋯ menu | Desktop keeps inline `ToolbarRefreshButton`; phone + tablet fold Refresh into the action overflow |
| `AppTableGrid` `cardActionsMaxVisible` | phone **1**, tablet **2** (when omitted) | Card footer uses `density="card"` + `cardLabeled` on the primary row action |
| `AppTableGridColumnDef` | `hideBelow` / `card.phoneRole` / `card.tabletRole` | Trim table + card metadata per tier — see [`ui-grid.md`](./ui-grid.md) |

Override per page when the feature needs a different contract (`visibility="always"` on `ListFilterToolbarControl`, etc.).

---

## Page toolbars and headers

| Tier | List toolbar | Actions |
|------|--------------|---------|
| `<lg` | Filters cluster **above** actions (`flex-col`) | **`ToolbarActionGroup`**: on **`isCompactChromeTier`**, keep `primary` actions visible + **overflow (⋯)** for secondary (phone **and** tablet) |
| `lg`–`xl` | Single row `lg:h-14` | Icon-only actions (`TOOLBAR_ACTION_COMPACT_BUTTON_CLASS`) |
| `xl`+ | Same | Full text labels |

Search: `ToolbarSearchInput` — full width on phone; **150px** from `md`; **200px** from `xl`.

**Desktop overlap (P0):** at `lg+`, single-row toolbars use **`index.css` grid** `minmax(0, 1fr) auto` on `.page-toolbar:not(.page-toolbar-multi-row)` (and `.page-toolbar-inner-row`) — filters in column 1 with `overflow-x: auto`, actions in column 2 `justify-self: end`. Do not rely on flex `flex-1` alone when filter children are `shrink-0`; do not `z-index` actions over filters. Token: `lg:w-auto` on filters cluster below `lg` only (`w-full` stacks on phone).

**Content headers** (nested editors): `WorkspaceBack` + identity cluster; wrap metadata on phone — [`ui-toolbar.md`](./ui-toolbar.md) §Page header.

**Paging footer:** compact range + prev/next + menu; page numbers from `lg` — [`ui-toolbar.md`](./ui-toolbar.md).

---

## Grids and lists

Default page list contract — [`ui-grid.md`](./ui-grid.md):

| Tier | `presentation="auto"` + `cardBelow="tablet"` |
|------|-----------------------------------------------|
| `phone` | **1 card per row only** (locked in code; not configurable). Same `APP_TABLE_GRID_CARD_CLASS` shell as tablet — no separate “flat mobile” variant. |
| `tablet` | 2 cards per row (equal height) |
| `desktop`+ | Table |

Alternatives (operator-driven):

- `cardBelow="phone"` → tablet keeps **table-scroll** + frozen first column.
- `cardBelow="desktop"` → cards at all sizes (self-contained records, not comparison tasks).

Use `card.phoneRole` / `card.tabletRole` / `hideBelow` to trim columns on compact tiers.

**List card unity:** compact tiers use the **same raised tile** everywhere (`APP_TABLE_GRID_CARD_CLASS` — border + `shadow-sm`), shared list gutter `LIST_PAGE_CARD_GRID_GUTTER_CLASS`. Catalog (Server Functions) vs CRUD (Users) may look different **inside** the tile; phone must not introduce a second container style — only **one card per row**. Full spec: [`ui-grid.md`](./ui-grid.md) §List card chrome (compare table).

**Embedded grids** in narrow panels: if the **panel** is phone-wide while the viewport is desktop, prefer `presentation="cards"` or `compact.tablet.layout: 'cards'` — do not rely on viewport alone ([container-aware adaptation](https://orwa-mahmoud.github.io/adapttable/mobile/) principle).

**Grid row icon actions (20px):** dense by design; ensure **overflow menu** (`AppGridRowActions`) for >1 action; on cards, footer actions meet touch-friendly layout.

---

## Dialogs, wizards, create/edit

| Tier | Shell |
|------|--------|
| `isCompactChromeTier` | Near-fullscreen slide from bottom (compact fullscreen) |
| `desktop`+ | Sized shells (`lg`, `3xl`, `maximized`, …) |

Markdown/HTML/code editors: **`maximized`** or 16px inset — not `h-[85vh]` fighting maximized — [`ui-dialog.md`](./ui-dialog.md).

**Responsive dialog vs drawer (industry):** On compact, **fullscreen or near-fullscreen dialog** is preferred over a partial bottom sheet for **long forms**; bottom sheets / drawers are for **short filters or pickers** that do not need a full form scroll region. AppEndO standard: **`CreateEditModalShell`** / `AppDialogShell` on compact tier.

Wizard steps: one column on compact; do not use fixed multi-column checkbox grids (`lg:grid-cols-3`) for short lists — [`ui-dialog.md`](./ui-dialog.md).

---

## Forms

- Short field pairs: **`resolveFormFieldPairGridClass(true)`** → one column default, **two columns from `sm`** when both columns visible — [`ui-core.md`](./ui-core.md) §Forms.
- Option cards: `sm:grid-cols-2` when labels are short; single column on very narrow if copy wraps badly.
- Invalid/hint overlays: flip below when no room above — already in `FormField`.
- Settings phone: section select pattern (existing platform behavior) — keep one column body.

---

## Master–detail and split workspaces

**Canonical pattern:** `FileManagerPageView` — [`file-manager` feature].

| Tier | Layout |
|------|--------|
| `<lg` | `flex-col`: primary pane **`max-h-[45%]`** `w-full` `shrink-0`; detail **`flex-1`** below; splitter handle still between (or suppress resize on compact if it fights scroll — prefer vertical stack without horizontal split) |
| `≥lg` | `flex-row` + `WorkspaceVerticalSplitHandle` + persisted width |

Apply the same recipe to Git changes, dual-pane explorers, and similar **tree + preview** surfaces unless a feature shard documents an exception.

---

## Nested editor + read-only inspector rail

Gold sample: Idea Foundry — [`ui-inspector-rail.md`](./ui-inspector-rail.md).

| Tier | Body + inspector |
|------|------------------|
| `≥lg` | Row: body `flex-1` + ghost splitter + `aside` 370px default (280–560) |
| `<lg` | **Stack (required):** body full width scrollable first; inspector **`border-t`**, full width, **`max-h-[45%]`** (`shrink-0`, `overflow-y-auto`), **no** ghost splitter. Same read-only cards as desktop — metadata stays visible without a **Details** tab or header toggle. |

**RecordForm** inside dialogs: keep flush dialog rail rules — not boxed inspector cards.

Do not duplicate content-header identity in the rail at any tier.

**Policy:** compact inspector uses **vertical stack**, not progressive disclosure via tabs. A **Details** tab or collapsed rail is allowed only when a **feature shard** documents a named exception (very tall rail, read-only-only page, or operator-approved spec) — see [`ui-inspector-rail.md`](./ui-inspector-rail.md) §Compact layout.

---

## Canvases (modeler, workflow, designers)

- Viewport controls: fixed corners — [`ui-core.md`](./ui-core.md) §Canvas viewport.
- Clip overflow; pan/zoom instead of page scroll.
- Floating toolboxes must not cover primary canvas actions; respect safe-area on bottom controls.

---

## Touch targets and spacing (compact tiers)

| Control class | Target |
|---------------|--------|
| Header hamburger, primary toolbar buttons | **`h-8` (32px)** minimum chrome — pad hit area to **≥44px** where feasible without breaking geometry lock |
| `AppButton` `size="icon-md"` in toolbars | 32px visual; ensure spacing **≥8px** between adjacent icon tools |
| Grid row actions (table) | 20px icons; use overflow menu for secondary actions |
| Grid row actions (card footer) | **`density="card"`** — inline primary + **32px** (h-8) overflow control; **≥8px** gap (Fluent / web.dev) |
| Nav drawer rows | Full-width row hit targets (existing nav items) |

Audit compact pages for **accidental &lt;24px** targets on the **only** path to a task (WCAG 2.5.8) and **&lt;8px** between adjacent icon tools; fix with `ToolbarActionGroup` overflow, card `density`, or spacing tokens — without violating admin-shell geometry lock.

---

## `UiClientComponent` (viewport host)

Default: **`minViewport: always`**, **`belowMin: continue`**.

Use **`tablet`** / **`desktop`** + **`hide`** / **`placeholder`** only for named exceptions (e.g. published operator component). Designer inspector exposes the same fields.

Living sample: Base Components → Client component.

---

## Verification (`appendo-qa-ui-responsive-pass`)

**Operator must not be the first mobile QA.** Implementation runs in [`.claude/skills/appendo-qa-ui-responsive-pass/SKILL.md`](../../.claude/skills/appendo-qa-ui-responsive-pass/SKILL.md):

1. **Browser screenshots** at **390**, **768**, **1280** (+ nav open, dialog/filter, inspector scroll on nested editors).
2. **Different-model critic** (`Task` + image attachments) returns P0/P1 — parent model **does not** self-approve layout.
3. Patch → **recapture** → fresh critic until **STOP** (max 3 patch rounds after baseline).
4. **One page per run** by default; studio-wide work is a **critic audit backlog**, then page-by-page loops.

**P0 examples:** body horizontal scroll; primary action only in desktop hover; table list on phone without cards; dialog trapped below fold; overlay nav unusable.

**P1 examples:** inspector still side-by-side on phone; toolbar all icons on tablet without overflow; `presentation="table"` on CRUD list.

---

## Change management

1. Edit this shard for new responsive rules.
2. Update `projectStandards.ts` (`ui.responsive.selective`, `ui.responsive.adaptation`, …).
3. Trim duplicate prose from `ui-core.md` §Responsive — link here.
4. Implement gaps in shared UI first (`ToolbarActionGroup`, inspector stack), then feature pages.

**IDs:** `ui.responsive.selective` · `ui.responsive.adaptation` · `ui.responsive.qa-pass`
