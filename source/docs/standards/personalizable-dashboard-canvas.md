# Personalizable Dashboard Canvas

> **Shard:** `personalizable-dashboard-canvas` · **Renders via:** existing Component Designer chart/KPI/grid/text nodes (`bindingChartEngine`, `designerGridAggregation`) — no new renderer
> **Plan:** [`plans/core/todo/dashboard-canvas/p-108-personalizable-dashboard-canvas.md`](../../plans/core/todo/dashboard-canvas/p-108-personalizable-dashboard-canvas.md)
> **Supersedes:** the standalone "Dashboard Builder" package concept (2026-09-09) — retired, this is Core/Client Components, not an installable package.

Locked 2026-09-09. Implemented 2026-09-11.

## Intent

The end user almost never assembles a dashboard's data layer from scratch — a developer always defines it. What the end user *can* do is personalize the **display** of a data layer the developer already scoped, and optionally add **new** widgets that stay bound to that same, already-approved information domain.

```
Component Designer (developer, design time)
  → declares a page "domain": one or more DataSourceDefinitions (+ fields/measures) this page allows
  → places initial chart/KPI/grid/text nodes on a grid-layout canvas, bound to that domain
  → publishes the page like any other Client Component

Runtime (end user, per viewer)
  → sees the developer's initial layout
  → may: hide/show/reorder/resize any widget, pick a pre-approved "variant" the developer defined
  → may: add a NEW widget — but only bound to an entry already in the page's declared domain
  → personalization is saved per (user, pageId), not a new business record
```

This is a generalization of the existing Home Dashboard per-user layout mechanism (`userDashboardLayout.ts`: `widgetOrder`/`hiddenWidgets`/`widgetSizes`), not a new domain. There is no `dbb_dashboards`-style table, no per-dashboard sharing/publish/versioning, no end-user "Create Dashboard" action, and no new `DataSourceType`/connector concept — those belonged to the retired package design.

## MUST

- Bind every widget — developer-authored or user-added — to an entry from the page's **declared domain** (one or more `DataSourceDefinition`s the developer explicitly opted in for this page). The domain is an explicit whitelist the developer sets, never inferred implicitly from whatever happens to already be on the canvas.
- Render developer-authored and user-added widgets through the **same existing** Designer runtime (`bindingChartEngine`, `designerGridAggregation`, `viz.chart`/`grid`/`kpi`/`text` nodes). No second rendering pipeline.
- Persist personalization as one JSON preference keyed by `(userId, pageId)` — generalizing `userDashboardLayout.ts`'s existing shape, not a new record type with its own lifecycle.
- Enforce the domain whitelist **server-side** on every read/write of personalization state — a user-added widget's `dataSourceRef`/field must resolve to a domain entry the page actually declares; reject anything else, regardless of what the client sends.
- Keep the "Add Widget" runtime surface bounded: widget kind (closed catalog: chart/KPI/table/text) + a domain entry + the same minimal chart-config fields Component Designer already exposes (metric, dimension, aggregation, chart kind). No free-text query, no new Data Source picker.
- Let a developer optionally define a small, pre-approved "variant" menu per widget (e.g., "this KPI may show Revenue or Profit") — the user picks among developer-authorized options, never types a new expression.
- Allow the end user to remove only widgets **they** added; developer-authored widgets can be hidden, never deleted, from the personalization layer.
- Reuse `UiDashboardCanvas` (react-grid-layout, MIT — the one new dependency) as the sole grid/drag/resize primitive, shared with any later Report Builder work.

### Added 2026-09-10 — promoted from "Later" after a deep OSS benchmark (Metabase, Superset, Redash, Grafana, Lightdash, Cube, Evidence.dev)

One finding changed the calculus for all of these: **none of the surveyed products persist a viewer's own filter-value choice server-side, per-user** — Metabase's docs state dashboard filter state is "per-browser-session, not per-user-persisted," Superset's is URL-query-string-shareable but not server-saved, Lightdash's cross-filters are explicitly "temporary... belong to your session." This means dashboard-level filters and drill interactions can be added **without inventing any new persisted record** — they're all URL/session-ephemeral, which fits this shard's "no new record type" rule exactly.

- **Dashboard filter bar**: the developer adds filter controls in the same Page Settings "Dashboard Domain" section, each wired to one or more domain-entry fields (Lightdash's "Tiles" pattern — the developer explicitly picks which widgets a filter reaches, never an implicit "every widget with a matching column name" auto-wire). A viewer changes filter values at view time (self-service, no edit rights needed); the current filter state lives in the **URL query string** (shareable/bookmarkable, matching every product surveyed) — not in the `(userId, pageId)` personalization JSON. An editor may optionally bake a **default value** into the domain declaration (`personalizable-dashboard-canvas` page config), which every fresh viewer sees before touching the URL.
- **Cross-filtering (click-to-filter)**: clicking a data point on one widget sets a temporary filter value that propagates to every *other* widget in the page bound to a matching domain field — session-only (Lightdash's model), never written to the personalization JSON, never reaching outside the page's declared domain.
- **Drill-down ("view underlying rows")**: clicking an aggregated cell opens a modal showing the raw rows behind it — mechanically just another `PivotSpec` request (the clicked cell's row/column key becomes an additional filter) against the *same* domain entry and provider. Zero new provider work; every provider (`flat-sql`/`star-schema`/`olap-bridge`/`mongo-aggregation`/`elasticsearch-aggregation`) already returns rows for a `PivotSpec`, this just requests a finer-grained one.
- **"Drill by" (temporary re-slice)**: a viewer may swap a widget's grouping dimension to any *other* field already in the page's declared domain, temporarily (not saved unless the viewer also personalizes the widget's permanent config) — bounded to the domain whitelist exactly like everything else here.
- **Binning**: for a numeric domain field, the Add-Widget/Reconfigure config surface offers "group into ranges" (fixed-count, fixed-width, or custom breakpoints) as a dimension option — Lightdash ships this to its self-service viewer tier on already-exposed fields only; same bound applies here.
- **Table calculations**: a small closed set of post-processing display options (running total, % of total, rank) computed over an already-returned `PivotResult` — pure presentation-layer math, no new provider/query capability, no new server round-trip.
- **Reference/goal line**: a widget's `viz_config` may declare a static or dynamic (min/max/median/average) threshold line — cheap (existing ECharts capability) and deliberately share-able with [`pivot-threshold-alerts.md`](./pivot-threshold-alerts.md)'s threshold value so the same number drives both the visual line and an alert condition, mirroring Metabase's goal-line dual-duty.

AI-agent-dependent capabilities (an MCP query tool, natural-language widget drafting, chart narration) were originally listed here but **split out 2026-09-10 into [`dashboard-ai-assist.md`](./dashboard-ai-assist.md)** — see that shard's own header for why (a different subsystem dependency, independently shippable). This shard's MUST/NEVER rules below cover only the pure canvas/state/interaction surface.

### Added 2026-09-10 (second round) — six ideas explicitly requested to all be brought into scope

- **On-demand export (PNG/PDF)**: a toolbar button that renders the current page/widget on demand, reusing the exact same headless-render capability [`pivot-threshold-alerts.md`](./pivot-threshold-alerts.md)'s `data.pivot-snapshot-delivery` action needs for scheduled delivery — one rendering code path serving both an on-demand button and a cron job, not two.
- **Saved Views**: a viewer may name and save the *current URL query string* (filter values + cross-filter + active tab, if any) into their own `(userId, pageId)` personalization record as a `savedViews` entry — this is not a new record type, it's one more array in the JSON bag that already exists; a "My saved views" dropdown lets them jump back. No sharing/publish semantics — a saved view is personal, exactly like the rest of this shard's personalization state.
- **AI-drafted widgets and "Explain this chart"** — moved to [`dashboard-ai-assist.md`](./dashboard-ai-assist.md), same split reasoning as the MCP tool above.
- **Cross-provider combo widgets** (the most involved of the six — see MUST below for the full contract): one widget rendering data from **two or more domain entries at once**, potentially backed by different providers (e.g. a MongoDB metric and a SQL metric on one time-series chart), merged client-side by a shared join field.
- **Widget comments**: a lightweight discussion thread anchored to one widget. Unlike every other addition in this shard, this genuinely needs one new small persisted table — see [`dashboard-widget-comments.md`](./dashboard-widget-comments.md) for the full (separately-shardable) contract; this shard only references it as an optional, independently-sequenced capability.

#### Combo widget contract (cross-provider join)

- The developer, in the same Page Settings "Dashboard Domain" section, may declare a `joinablePairs` list: `{ domainEntryIdA, fieldA, domainEntryIdB, fieldB }` — an explicit statement that these two fields are safe to join on (e.g. both are a `date` at daily grain, or both are a `region` code from the same reference list). Declaring this is authoring-time only; nothing about it is inferred automatically from field names or types.
- At query time, the widget fires **two independent `PivotSpec` requests** (one per domain entry, potentially two different providers) and the client merges the two `PivotResult`s by matching row-axis member keys on the declared join field — never a server-side cross-provider join (the five providers have no shared query engine to join through; SQL, Mongo, Elasticsearch, and an external SSAS bridge cannot literally join with each other).
- Both sides must already be aggregated to the same grain (e.g. both "per day," not one "per day" and one "per hour") before merging — the developer's `joinablePairs` declaration is also where this grain compatibility is asserted, not inferred.
- Render as a standard multi-series chart via the existing ECharts binding — no new chart-rendering engine, just a second series fed from a second `PivotResult`.
- Unmatched keys on either side render as a gap/null in that series (standard outer-join display behavior) rather than dropping the whole row — a partial match is still informative, silently discarding it is not.

### Added 2026-09-10 (third round) — one already-free capability, two small additions, one split to a new shard

- **Reusable widgets across pages — already free, no new work.** Component Designer already has a genuine reusable-component mechanism (`node.componentRef.refId` + `.version`, rendered as a `reusable-slot` node — see `src/domain/component-designer/designerRuntimePreview.tsx`): a developer can save any `viz.chart`/`viz.kpi`/`grid`/`text` node as a named, versioned, referenced-by-id component and place it on multiple dashboard pages, with edits propagating to every placement (or pinned to a specific version). This is mechanically equivalent to Grafana's "Library Panels." Nothing in this shard needs to build this — it only needs to note that a dashboard widget authored as a `reusable-slot` reference works exactly like any other developer-authored widget here, bound to that page's own declared domain like normal.
- **Dashboard Tabs**: a personalizable page may declare multiple named tabs, each holding its own `UiDashboardCanvas` arrangement of developer-authored widgets, all sharing the **same** page-level domain declaration (tabs are a display/layout grouping, not a second domain). Matches Metabase's and Superset's tabs; Superset's lazy-load-inactive-tab behavior is adopted too (a tab's widgets don't query until it's opened). This needs no change to how `hiddenNodeIds`/`order`/`sizes`/`variantSelections` are keyed — node ids are already unique across the whole page regardless of which tab holds them, and each node's home tab comes from the page's own tab declaration, not from personalization state; only a user-*added* widget needs to record which tab it was added to (a `tabId` field), since nothing else already implies that for it.
- **Dashboard Links**: the developer may add a short list of named links (to another personalizable page, or an external URL) in the same Page Settings section, each optionally forwarding the current filter/URL-query state to the target (`{{filterValue}}`-style template, matching Metabase's custom-destination templating) — a lightweight nav aid, not a data-bound widget.
- **Sharing, embedding, and snapshots — split to a new shard**, [`dashboard-sharing.md`](./dashboard-sharing.md), because unlike everything else in this document it genuinely needs new persisted state (a per-page access-control record, and a frozen snapshot record) rather than staying URL/session-ephemeral — the same reasoning that already split widget comments out. It reuses the exact `FunctionAccessControl` pattern Workbooks sharing already ships with, not a new access model.

## NEVER

- Let an end user attach a new Data Source or reference a field/measure outside the page's declared domain.
- Let an end user author raw SQL/WHERE/MDX or otherwise bypass the bounded chart-config surface.
- Create a `dbb_dashboards`-style independent record with its own sharing/publish/version lifecycle — a dashboard here is one Designer page; personalization is a per-viewer preference on it, not a new record a user "owns."
- Add a second chart/grid/canvas rendering engine — reuse what Component Designer already has.
- Package this as an installable/uninstallable Package Manager artifact — it is a Client Components / Base Components capability, present the moment the platform is, like any other Designer primitive.
- Silently trust a client-supplied domain reference without server-side whitelist validation.
- Persist a viewer's filter value, cross-filter click, or "drill by" dimension swap into the `(userId, pageId)` personalization JSON — these are URL/session-ephemeral by design (see the 2026-09-10 additions above); only permanent widget personalization (hide/reorder/resize/variant/user-added-widgets) belongs in that JSON.
- Let cross-filtering, drill-down, or "drill by" reach a field outside the page's declared domain — same whitelist enforcement as every other capability here, no exceptions for interaction-triggered requests.
- (AI-agent-specific NEVER rules — MCP tool, `draft_dashboard_widget`, "Explain this chart" — moved to [`dashboard-ai-assist.md`](./dashboard-ai-assist.md).)
- Let a saved view carry anything beyond a name + URL query string — no embedded credentials, no bypass of the domain whitelist a fresh page load would already enforce.
- Let a combo widget join two domain entries on a field pair the developer did not explicitly declare joinable (see the domain declaration's `joinablePairs`, below) — never infer a join key from matching column names, and never join across two providers' results in a way that silently produces misleading aggregates (e.g. joining before both sides are aggregated to the same grain).
- Build widget comments as a generic "attach a comment to anything" platform service — this is a narrowly-scoped, dashboard-widget-specific thread; see `dashboard-widget-comments.md`.
- Let a tab declare its own domain — all tabs on one page share the single page-level domain declaration; a genuinely different data domain means a different page, not a second-domain tab.
- Query a tab's widgets before that tab is actually opened — lazy-load, matching Superset's behavior, not "fetch everything on page load."
- Let a Dashboard Link forward anything beyond the current filter/URL-query values — no session data, no auth token, in the template substitution.
- Build sharing, embedding, or snapshots as part of this shard — see [`dashboard-sharing.md`](./dashboard-sharing.md); this shard's own access story stays "whatever Studio/route permission already governs the page," nothing more.

## Personalization state shape (per `userId` + `pageId`)

**Deliberately excludes filter values, cross-filter clicks, and "drill by" swaps** — those live in the URL query string, ephemeral per view, matching every surveyed product. Only genuinely permanent per-viewer customization lives here:

```ts
{
  hiddenNodeIds: string[]           // developer-authored nodes the user hid
  order: string[]                   // display order, developer + user node ids mixed
  sizes: Record<string, { w: number; h: number }>
  variantSelections: Record<string, string>   // nodeId -> developer-defined variant key
  userWidgets: Array<{
    id: string
    tabId?: string                    // 2026-09-10 (third round) — which tab this was added to; omit on single-tab pages
    kind: 'chart' | 'kpi' | 'table' | 'text' | 'combo'   // 'combo' added 2026-09-10 (second round)
    domainEntryId?: string           // required for every kind except 'combo'; must resolve to a domain entry the page declares
    comboRef?: { domainEntryIdA: string; fieldA: string; domainEntryIdB: string; fieldB: string }
                                       // required only when kind === 'combo'; must match a declared `joinablePairs` entry verbatim — never freeform
    fieldMapping: unknown            // same shape bindingChartEngine already uses
    vizConfig: unknown                // same shape existing viz.chart/kpi/grid nodes use, plus optional
                                       // binning / tableCalculation / referenceLine config (2026-09-10)
    gridPosition: { x: number; y: number; w: number; h: number }
  }>
  savedViews: Array<{                 // 2026-09-10 (second round) — personal named URL bookmarks
    id: string
    name: string
    urlQueryString: string            // filters + cross-filter + tab state, verbatim
    createdAt: string
  }>
}
```

## Page domain declaration (developer, design time)

A dashboard-shaped Designer page opts in with a page-level flag (`personalizable: true`) plus an explicit domain list:

```ts
{
  personalizable: true
  domain: Array<{
    id: string                       // stable id user-added widgets reference
    dataSourceRef: unknown           // existing DataSourceDefinition reference
    exposedFields: string[]          // whitelist within that source — not "all columns"
  }>
  filters?: Array<{                  // 2026-09-10 addition — the dashboard filter bar
    id: string
    label: string
    domainEntryId: string            // which domain entry this filter targets
    field: string                    // must be in that entry's exposedFields
    controlType: 'select' | 'multiSelect' | 'dateRange' | 'text' | 'numericRange'
    appliesToWidgetIds?: string[]     // explicit "Tiles" wiring (Lightdash pattern) — omit = applies to every widget bound to this field
    defaultValue?: unknown
  }>
  joinablePairs?: Array<{             // 2026-09-10 (second round) — enables combo widgets
    domainEntryIdA: string
    fieldA: string
    domainEntryIdB: string
    fieldB: string
    label?: string                    // e.g. "by day" — documents the asserted grain compatibility
  }>
  tabs?: Array<{                      // 2026-09-10 (third round) — omit entirely for a single-tab page
    id: string
    label: string
  }>
  dashboardLinks?: Array<{            // 2026-09-10 (third round) — toolbar nav aid, not a data-bound widget
    label: string
    target: { pageId: string } | { url: string }
    forwardFilterState?: boolean      // append current filter/URL-query values as {{field}} template substitutions
  }>
}
```

## UX (authoring + runtime) — added 2026-09-10, was missing

This shard is a real Base Components/Designer feature, not just a data contract — per this repo's own `package-ui.md` convention (every interactive control cites a Base Components section, no raw HTML controls), here is where each piece actually lives.

### Authoring (developer, Component Designer)

- **Domain declaration** lives in the page-level **Page Settings** panel (the same panel that already carries page-level flags like `publishedFormAssist`) — a new **"Dashboard Domain"** subsection: a list of domain entries, each `Add entry` → pick an existing `DataSourceDefinition` (`selection-fields`) → pick allowed fields from it (`selection-fields`, multi-select) → optional label. This is authoring-time only; it is not shown to end users.
- **`personalizable: true`** is a single toggle in the same Page Settings panel (`choice-fields`).
- **Initial widgets** are placed exactly like any other Designer page today — drag `viz.chart`/`viz.kpi`/`grid`/`text` nodes onto the new `viz.dashboard-canvas` container node, bind them to a domain entry the same way any node is bound to a `DataSourceDefinition` today. No new authoring flow beyond adding the container node and enabling the toggle.
- **Variant menu** (optional, per developer-authored widget): a small `props` array (`variants: [{ key, label, fieldMapping }]`) set in the node's existing Properties panel — reuses whatever field-list control already edits node props; not a new UI.
- **Filter bar entries** (2026-09-10): same "Dashboard Domain" subsection, a new **"Filters"** list below the domain-entry list — `Add filter` → pick a domain entry (`selection-fields`) → pick a field from its exposed whitelist (`selection-fields`) → pick control type (`choice-fields`: Select/Multi-select/Date range/Text/Numeric range) → optionally scope to specific widgets (`selection-fields`, multi-select of the page's current widgets — the "Tiles" wiring) → optional default value.
- **Joinable pairs** (2026-09-10, second round): a third list in the same subsection, `Add joinable pair` → pick two domain entries + one field from each (`selection-fields` ×4) + optional label — enables the combo-widget kind in Add Widget for end users; if left empty, combo widgets simply don't appear as an option.
- **Tabs** (2026-09-10, third round): a fourth list, `Add tab` → label (`text-fields`) only — reorderable (drag handle, same list-reorder pattern used elsewhere in Designer). Zero tabs declared = today's single-canvas behavior, no tab strip rendered at all.
- **Dashboard Links** (2026-09-10, third round): a fifth list, `Add link` → label (`text-fields`) → target: another personalizable page (`selection-fields`, page picker) or an external URL (`text-fields`) → toggle "forward current filters" (`choice-fields`).

### Runtime (end user, viewing a personalizable page)

```
┌─ Tabs: [Sales] [Operations] [Finance] ──────────────────────── (visible only if tabs declared) ┐
├─ Canvas toolbar: [Add Widget] [Export ▾] [My Views ▾] [Related ▾] ─ (visible only if personalizable) ┤
├─ Filter bar: [Region ▾] [Date range ▾] [Save view] ──────── (visible only if filters declared) ┤
├─────────────────────────────────────────────────────────────────────────────────────────────── ┤
│  UiDashboardCanvas (react-grid-layout)                                                          │
│   ┌──────────────┐ ┌──────────────┐ ┌──────────────────────────┐                                │
│   │ Chart          │ │ KPI            │ │ Table                      │  ← hover: [variant ▾][drill by ▾][💬][hide ×] (+AI controls, see dashboard-ai-assist.md) │
│   │ (dev-authored) │ │ (dev-authored) │ │ (user-added, shows [🗑])   │  ← click bar/cell: cross-filter + drill-down │
│   └──────────────┘ └──────────────┘ └──────────────────────────┘                                │
└─────────────────────────────────────────────────────────────────────────────────────────────── ┘
```

- **Add Widget** (`buttons` BC section, toolbar) opens a dialog (`dialog`/`create-edit` BC section, standard `CreateEditModalShell`-style anatomy):
  1. Kind — icon button group (`choice-fields`): Chart · KPI · Table · Text.
  2. Domain entry — dropdown (`selection-fields`) listing only the page's declared domain entries.
  3. Minimal config — the *same* metric/dimension/aggregation/chart-kind fields Component Designer's own node Properties panel already renders for that kind, plus (2026-09-10) an optional binning control (`selection-fields` + `text-fields` for custom breakpoints) when the picked dimension is numeric, and an optional reference-line value (`text-fields`); this dialog does not invent new config controls beyond these, it reuses the existing property-field renderer scoped to the chosen domain entry's exposed fields.
  - Success: close → toast (`toast` BC section) → widget appears on the canvas at the next open grid slot.
- **Filter bar** (`selection-fields`/`date-time`/`text-fields` per `controlType`, toolbar-level): changing a value updates the URL query string and re-queries every widget wired to that field (via `appliesToWidgetIds` or, if omitted, every widget bound to a matching domain field). No save action — the URL *is* the persisted state, matching every product surveyed.
- **Cross-filter (click-to-filter)**: clicking a bar/point/cell on a chart sets the same URL-backed temporary filter state as the filter bar, scoped to widgets bound to the clicked field. A small dismissible chip near the filter bar shows the active cross-filter with a clear/× action.
- **Drill-down**: clicking an aggregated cell/bar opens a modal (`dialog` BC section) showing the underlying rows — `AppTableGrid` reused, not a new grid component — scoped to the same domain entry and its exposed fields only.
- **"Drill by"** (per-widget hover control, `selection-fields`): a dropdown of the domain entry's other exposed fields; picking one re-groups that widget's chart/table temporarily (not persisted unless the viewer then explicitly saves it via the widget's own Reconfigure/variant action).
- **Per-widget hover chrome**: a variant dropdown (`selection-fields`, only if the developer defined variants for that node), the "drill by" dropdown above, a comment icon (`buttons`, opens the thread from [`dashboard-widget-comments.md`](./dashboard-widget-comments.md) if that capability is installed), and a hide/remove control. Developer-authored widgets get **hide** only (no delete icon — matches the NEVER rule below); user-added widgets get a delete icon that opens `ConfirmDialogShell` (`confirm` BC section) before removing. (The AI "Explain" icon is a separate, optional addition to this same hover chrome — see [`dashboard-ai-assist.md`](./dashboard-ai-assist.md).)
- **Export** (`buttons` BC section, toolbar dropdown: PNG / PDF): triggers the same render path `data.pivot-snapshot-delivery` uses, synchronously, and hands the viewer the file — reuses [`pivot-threshold-alerts.md`](./pivot-threshold-alerts.md)'s rendering capability, not a second one.
- **Save view / My Views** (`buttons` + `selection-fields`, filter-bar and toolbar): "Save view" prompts for a name (`text-fields`, small inline popover, not a full dialog) and appends to `savedViews`; "My Views" is a dropdown listing saved entries, selecting one navigates to that saved URL query string.
- **Add Widget — Combo kind**: when the page has at least one `joinablePairs` entry, the Kind picker in the Add Widget dialog gains a fifth option, **Combo** — its config step asks for the joinable pair (`selection-fields`, pre-populated from the declared pairs) instead of a single domain entry, then the usual metric/dimension pickers for *each* side. (A sixth entry point, the AI "Describe what you want" text input, is likewise a separate, optional addition — see [`dashboard-ai-assist.md`](./dashboard-ai-assist.md).)
- **Empty/no-domain state**: if a personalizable page has zero domain entries declared, the "Add Widget" button is disabled with a tooltip ("no data domain configured for this page") rather than opening an empty picker — the developer must declare a domain before end users can add anything.
- **Tab strip** (`toolbar` BC section, tab-style navigation): switching tabs swaps which widgets are mounted (lazy — an unopened tab's widgets never fire a `PivotSpec` request); the filter bar and its URL-query state persist across tabs (filters are page-scoped, not tab-scoped) unless a filter's `appliesToWidgetIds` only reaches widgets on one tab.
- **Related / Dashboard Links** (`buttons` BC section, toolbar dropdown "Related"): each declared link navigates to its target page/URL, optionally with the current filter values appended as query parameters the target page's own filter bar picks up on load (only meaningful when the target is another personalizable page with a matching filter).
- **Sharing, embedding, and snapshot controls** are a separate, optional addition to this same toolbar — see [`dashboard-sharing.md`](./dashboard-sharing.md) for its own UX section, not duplicated here.

## Later (not this shard's v1)

- Non-flat-SQL domain entries — once [`p-107-olap-bridge-data-source`](../../plans/core/todo/dashboard-canvas/p-107-olap-bridge-data-source.md) (real external SSAS), [`p-109-rolap-star-schema`](../../plans/core/todo/dashboard-canvas/p-109-rolap-star-schema.md) (internal ROLAP), [`p-110-mongodb-analytics-provider`](../../plans/core/todo/dashboard-canvas/p-110-mongodb-analytics-provider.md), or [`p-111-elasticsearch-analytics-provider`](../../plans/core/todo/dashboard-canvas/p-111-elasticsearch-analytics-provider.md) ship, a domain entry could point at a Pivot API dataset backed by any of those providers — no change to this shard's contract, since it already consumes `PivotResult`-shaped data like any other chart.
- Any UI letting a developer curate variant menus visually (v1: variants are declared in node props, not a dedicated builder UI).
- **Event annotations/timelines** (Metabase's Timelines, Grafana's annotations) — marking a discrete event (deploy, incident) on a time-series widget. Confirmed absent in Lightdash too (the closest architectural peer), and would need a new small persisted record type (named events with a date), unlike everything else added 2026-09-10 which stayed URL/session-ephemeral. Lower priority; revisit only if a concrete need shows up.
- **Full pre-aggregation/rollup engine** (Cube's "aggregate awareness" — background-refreshed rollup tables the query planner automatically routes matching requests to) — the simple per-`PivotSpec` result cache added to [`data-api-pivot.md`](./data-api-pivot.md) 2026-09-10 covers the common case cheaply; a full rollup engine is a much larger, separate undertaking, not assumed here.
- **Cascading filters** (a filter's options constrained by another filter's current selection, per Metabase's "linked filters" / Superset's dependent filters) — mechanically straightforward to add once the basic filter bar (above) ships, but deliberately sequenced after it rather than bundled in, since both Metabase and Superset shipped the basic filter bar well before cascading.

## Tokens / files (when implemented)

- Canvas BC: `src/shared/ui/UiDashboardCanvas.tsx` (react-grid-layout wrapper).
- Designer node: `src/domain/component-designer/DesignerRuntimeDashboardCanvas.tsx` (reads page domain + personalization state, renders developer nodes + user widgets through existing renderers).
- Personalization store: generalize `src/shared/lib/userDashboardLayout.ts` from Home-only to `(userId, pageId)`-keyed.
- Domain whitelist enforcement: server-side alongside wherever page/component definitions are already validated — not a new standalone service.
- Filter bar / cross-filter / drill state (2026-09-10): pure client-side URL-query-string state — no new server storage, no new endpoint beyond additional filters on the existing `PivotSpec` request.
- Drill-down modal: reuses `AppTableGrid` — no new grid component.
- Export: reuses the render function built for [`pivot-threshold-alerts.md`](./pivot-threshold-alerts.md)'s `data.pivot-snapshot-delivery` — one shared render module, called synchronously from an HTTP endpoint for the on-demand path and from the workflow action for the scheduled path.
- Saved views: an extra array on the same `userDashboardLayout.ts` generalization — no new store.
- Combo widgets: client-side merge logic in `DesignerRuntimeDashboardCanvas.tsx` (or a small extracted `mergePivotResultsByJoinField.ts` pure function) — two `PivotSpec` calls in, one merged series set out.
- AI-related tokens/files (MCP tool, `draft_dashboard_widget`, "Explain this chart") — see [`dashboard-ai-assist.md`](./dashboard-ai-assist.md).
- Reusable widgets across pages: already-shipped `node.componentRef` / `reusable-slot` mechanism in `src/domain/component-designer/designerRuntimePreview.tsx` — no new file.
- Tabs: a thin tab-strip wrapper around `UiDashboardCanvas` in `DesignerRuntimeDashboardCanvas.tsx`, gating which tab's widgets mount — no new BC section, reuses `toolbar`.
- Dashboard Links: rendered from the same `DesignerRuntimeDashboardCanvas.tsx`, a plain nav action — no new endpoint.
- Sharing/embedding/snapshot tokens/files — see [`dashboard-sharing.md`](./dashboard-sharing.md).

## IDs

`personalizable-dashboard.domain-is-explicit-whitelist`, `personalizable-dashboard.no-new-record-type`, `personalizable-dashboard.same-renderer`, `personalizable-dashboard.bounded-add-widget`, `personalizable-dashboard.server-side-domain-check`, `personalizable-dashboard.base-components-only`, `personalizable-dashboard.filter-state-is-url-not-record`, `personalizable-dashboard.drill-reuses-pivotspec`, `personalizable-dashboard.combo-join-is-client-side-and-declared`, `personalizable-dashboard.export-shares-render-path-with-delivery`, `personalizable-dashboard.tabs-share-one-domain`, `personalizable-dashboard.tabs-lazy-load`, `personalizable-dashboard.reusable-component-already-exists`, `personalizable-dashboard.sharing-is-a-separate-shard`
