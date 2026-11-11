# Nested-editor inspector rail

> **Shard:** `ui-inspector-rail` (alias `ui-side-panel`)  
> **Gold sample:** `src/features/idea-foundry/components/IdeaFoundryViewRail.tsx`  
> **URL / content header:** [`deep-linking.md`](./deep-linking.md)  
> **Package editors:** [`package-ui.md`](./package-ui.md) §P9  
> **Tokens:** [`ui-design-system.md`](./ui-design-system.md) · `APP_SURFACE_BOX_SHELL_CLASS` · `SHADOW_FLAT`

## Intent

A nested editor (list → `{list}/edit/{id}`) that shows **read-only metadata beside the working body** uses this inspector — not `FormSection`, not `MetaField`, not a flush dialog flag rail.

Copy the Idea Foundry rail. Do not invent a second inspector primitive until a shared component is extracted into `src/shared/ui`.

## Scope

**This shard**

- Read-only inspector on a nested-editor page (main column + default **370px** rail, ghost-resize **280–560**).
- Compact label/value metadata, people/model chips, audit stamps.

**Not this shard**

| Surface | Shard |
|---------|--------|
| Writable Data Studio modeler inspector (`FormSection` + `tone`) | [`data-studio-modeler.md`](./data-studio-modeler.md) §6 — **exception** |
| CRUD Set / `RecordForm` dialog side column (writable flags, flush, unboxed) | [`crud-set.md`](./crud-set.md) — **shares** wash + ghost splitter; not boxed KV |
| Admin shell nav drawer | [`ui-core.md`](./ui-core.md) |
| Create/edit **form** field groups | [`ui-core.md`](./ui-core.md) §Form sections — no boxed groups |

Boxed inspector cards are an **explicit exception** to `ui.form.flat-sections-no-boxes`. That rule still forbids boxes around **form** sections.

## MUST

### Shell

- `aside`: `INSPECTOR_RAIL_ASIDE_CLASS` — default width **`370px`** (`--app-inspector-rail-width`, which is `w-80` + 50px; live width from `useInspectorRailSplit`), `shrink-0`, `border-s` using `--app-inspector-rail-border` (logical start/end — never `border-l` / `border-r`), wash `--app-inspector-rail-bg`, `overflow-y-auto overflow-x-hidden`.
- Inner stack: `INSPECTOR_RAIL_INNER_CLASS` (`flex flex-col space-y-6 p-4`).
- One card per conceptual group: `INSPECTOR_RAIL_CARD_CLASS` (elevated white, `--app-inspector-rail-card-border`).
- **Wash:** same paper as the admin sidebar — `--app-accent-soft` with a **3.5%** whisper of `--app-accent-rgb` (`color-mix(… 3.5%, var(--app-accent-soft))`). Soft and thin, not a saturated slab. Do not use 18%+ accent. Do not mix two slate tokens (that disappears). Do not hardcode `bg-slate-50`.
- **Splitter (desktop only):** `useInspectorRailSplit(WORKSPACE_SPLIT_PANEL_KEYS.<surface>)` on the main+rail flex row **`≥lg`**, then `<WorkspaceVerticalSplitHandle {...split.splitHandleProps} appearance="ghost" />` between the body and the `aside`. Ghost is hit-target only (`cursor-col-resize`, 8px transparent) — never a painted rail, grip, or chevron. Not collapsible. Persist width **280–560** (`INSPECTOR_RAIL_MIN_WIDTH_PX` / `INSPECTOR_RAIL_MAX_WIDTH_PX`). Pass `widthPx={split.size}` into the rail. Do **not** use `appearance="default"` or `"quiet"` on this inspector (`quiet` still tints on hover). **RecordForm** Edit / View (Base Components living sample) uses the same ghost handle and wash; dialog rail width stays `RECORD_FORM_SIDE_PANEL_WIDTH_PX` (not 370).

### Compact layout (`<lg`)

**Default for every nested-editor read-only inspector** (same mental model as master–detail stack in [`ui-responsive.md`](./ui-responsive.md) §Master–detail):

1. Outer host: `flex min-h-0 flex-1 flex-col overflow-hidden` (not `flex-row`).
2. **Body first:** `flex-1 min-h-0 overflow-auto` — primary edit/read work stays on top and takes remaining height.
3. **Rail second:** full width, `shrink-0`, `border-t` using `--app-inspector-rail-border`, wash unchanged, **`max-h-[45%]`** (acceptable band **40–45%**), `overflow-y-auto`. Same cards and KV grid inside — no simplified mobile copy.
4. **No** ghost `WorkspaceVerticalSplitHandle` below `lg`. **No** persisted horizontal split width on compact — width is always 100%.
5. Metadata stays **visible without an extra tap** — audit and team/context rows are not optional chrome on compact.

**Do not** use a content-header **Details** tab, icon toggle, or collapsed-by-default panel to hide this rail on phone/tablet unless a feature shard documents a **named exception** (see below).

**Named exceptions only** (shard must say why):

| Case | Allowed compact pattern |
|------|-------------------------|
| Rail is overwhelmingly tall (many cards / heavy media) and body needs full viewport height | End-edge **overlay drawer** with page peek (profile-drawer pattern) — not a bottom sheet that fights keyboard |
| Page is **read-only** with no body edit task | May omit rail or use drawer — rare in nested editors |
| Operator-approved one-off in feature spec | Document in that feature shard; do not fork inspector KV chrome |

### KV grid

Every label/value pair uses the **same** 3-column grid:

`INSPECTOR_RAIL_KV_CLASS` — `grid grid-cols-3 items-start gap-x-3 gap-y-2`

| Cell | Class | Role |
|------|-------|------|
| Label | `INSPECTOR_RAIL_LABEL_CLASS` | Short noun; sentence-case English; `min-h-8 items-center` so it shares a horizontal midline with the value |
| Value | `INSPECTOR_RAIL_VALUE_CLASS` | Tight to the label, **start-aligned**; same `min-h-8 items-center` |

Do **not** `justify-between`, `ml-auto`, `pt-0.5` on the label, or park values on the far edge of the card. Display strings use `DirectionalText`. Stacked chips grow **down** from that midline (`items-start` on the grid so the label stays with the first chip).

### Section titles

- Optional. Use a title only when the card needs a group name the body does not already state (e.g. **Metadata**, **Team**).
- Sentence-case English in JSX (`Metadata`, not `METADATA`). Look is CSS: `text-[11px] font-semibold uppercase tracking-wider text-slate-400`.
- Hint = `FieldHintTooltip` after the title (`ICON_LABEL_ROW_CLASS` + `mb-3`). No under-heading helper paragraph.
- **Omit** chrome titles that only restate the body: no **Identity**, no **Audit trail**. Identity that already lives in the content header (title, glyph) stays there — do not duplicate it in the rail. Audit is an untitled card.

### Values

- **Glyphs:** `NavigationIcon` (or Lucide) — never the `lucide:Name` storage string as text.
- **Badges** (kind, importance, scale): compact `rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-700`.
- **People / model chips:** `flex h-8 w-full` in the value column (same height, stretch to the column end). Stack multiples with `flex-col gap-1.5`. Avatar + name; lead/decision marker is a small Lucide glyph, not a second color system.
- **Empty:** English **None selected** (`text-xs text-slate-400`) — not an em dash, not a blank cell. Writable empty CTAs that open an editor stay on the **main** column (dashed `MODELER_EMPTY_STATE_CLASS`); do not put those in this read-only rail.
- **People vs models** (or any two related chip lists in one card): a full-width `col-span-3 my-1 border-t border-slate-100` separator (`role="separator"`).
- **Audit:** labels **Created** / **Edited**; value `username • Mon D, YYYY` (`en-US` UTC, `text-xs text-slate-500`). Hide a row when both who and when are missing; hide the whole card when both rows are empty. When the subject model `history.enabled`, `RecordEventHistoryIcon` (`History`, `h-3.5 w-3.5`, culture `platform.recordSubjectTimeline.*`) sits beside the **Created** label and opens the maximized record timeline spine (`RecordEventHistoryDialog`, GET on click) — do **not** fill Created/Edited from events and do **not** paint event rows on the form. See [`record-event-log.md`](./record-event-log.md).

## NEVER

- `FormSection` ink bars / `tone` / `divided` on this rail.
- `MetaField` stacked label-over-value as the inspector KV recipe.
- A bordered card **and** a `FormSection` around the same group.
- Wrapping the whole `aside` in `bg-white` (the wash is the rail; cards are elevated).
- Hardcoded `w-80` or `bg-slate-50/50` on this rail — use the inspector tokens.
- A painted splitter (`appearance="default"` / `"quiet"`) or a collapsible inspector rail.
- **Side-by-side** body + rail with ghost splitter **below `lg`**.
- Hiding read-only metadata behind a **Details** tab, header toggle, or collapsed panel **below `lg`** on default nested-editor surfaces (use stack instead).
- Far-right values, `justify-between` rows, or a 2-column `justify-items-end` grid.
- Pre-uppercased title strings, `font-medium` as a fourth type weight, or `lucide:…` as visible copy.
- Duplicating the content-header item title in the rail.
- Using boxed KV inspector cards inside `CreateEditModalShell` / `RecordForm` (those rails stay flush, unboxed flags — they still use the wash + ghost splitter).

## Do this

1. **`≥lg`:** row layout — body `flex-1` + ghost splitter + `aside` (tokens above).
2. **`<lg`:** column layout — body then full-width rail (`max-h-[45%]`, `border-t`, no splitter).
3. Wire `useInspectorRailSplit` + ghost handle only on the desktop row; persist width **280–560** for `≥lg` only.
4. One white card per group. Title + hint only when the group name is not obvious from the rows.
5. All rows share the 1/3–2/3 KV grid. Chips stretch in the value column. Empty = **None selected**.
6. Untitled audit card last when stamps exist.

## Tokens / files

`IdeaFoundryView.tsx` · `IdeaFoundryViewRail.tsx` · `useInspectorRailSplit.ts` · `WorkspaceVerticalSplitHandle` (`appearance="ghost"`) · `surfaceClasses.ts` (`INSPECTOR_RAIL_*`) · `src/index.css` (`--app-inspector-rail-*`) · `FieldHintTooltip` · `DirectionalText` · `UiAvatar` · `NavigationIcon`

**IDs:** `ui.inspector-rail.chrome`, `ui.inspector-rail.splitter`, `ui.inspector-rail.compact-stack`, `ui.inspector-rail.kv-grid`, `ui.inspector-rail.titles`, `ui.inspector-rail.values`
