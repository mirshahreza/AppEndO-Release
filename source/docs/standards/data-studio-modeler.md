# Data Studio Modeler — layout and chrome

> **Shard:** `data-studio-modeler`  
> **REST / URL:** [`data-studio.md`](./data-studio.md) · [`deep-linking.md`](./deep-linking.md)  
> **Tokens:** [`ui-design-system.md`](./ui-design-system.md) · code: `src/features/data-studio/lib/modelerChipStyles.ts`  
> **Root:** `EdgeModelModelerWorkspace.tsx`

This shard is **modeler-only** layout, density, and window chrome. General UI shards win unless a rule here is marked **exception**. Do not reintroduce page-local indigo fills (`MODELER_SECTION_ACTION_BUTTON_CLASS` is empty/deprecated).

**Exception — inspector:** this modeler rail stays writable `FormSection` + `tone` (below). New nested-editor **read-only** inspectors use [`ui-inspector-rail.md`](./ui-inspector-rail.md) (Idea Foundry), not this panel.

---

## 1. Composition (regions)

Document-style studio — **not** a freeform canvas. True diagram/table work opens in floating panels.

```
┌─ Admin shell: "{nav group} / Data Studio / Edit" ───────────────────────────┐
├─ Content header (white, border-b) ──────────────────────────────────────────┤
│  [←] [icon] objectName (+ lock) · Data source  [Data] [Dependencies] [Record Policies] [Sync] │
├───────────────────────────────┬────────────────────────────────────────────┤
│ Main (slate-50, scroll)       │ Inspector rail (white, w-80, border-s)     │
│  Columns (hero / indigo)      │  General (slate)                           │
│  Relations (secondary/violet) │  Story (slate, divided)                    │
│  Data APIs (secondary/slate)  │  Danger zone footer (destructive-soft)     │
│  Record Policies (summary)    │                                            │
└───────────────────────────────┴────────────────────────────────────────────┘
```

| Region | Surface | Notes |
|--------|---------|--------|
| Content header | `bg-white` + `border-b border-slate-200` | Back + **objectName identity title** + optional data-source subtitle + Dependencies / Record Policies / Sync — item identity lives here, not in the shell |
| Main column | `MODELER_PAGE_SURFACE_CLASS` (`bg-slate-50`) | `px-5 py-4`, stack `gap-5`; first section undivided, later sections `divided` |
| Inspector | white, fixed `w-80` | Read-first; edit via icon actions; destructive ops in footer only |
| Floating workspaces | `FloatingPanelShell` | Designer, **Data datasheet**, Relations diagram/datasheet, Column/Relation Properties |

**Exception — toolbar titles:** [`ui-toolbar.md`](./ui-toolbar.md) forbids page titles in **list/grid page toolbars**. The modeler content header is a **workspace action bar** (back + subtitle + Sync), not a filter toolbar — do not copy this pattern onto CRUD list toolbars.

---

## 2. Token catalog (`modelerChipStyles.ts`)

Reuse these constants — do not hardcode one-off slate/indigo washes in JSX when a token exists.

### Surfaces

| Token | Value / role |
|-------|----------------|
| `MODELER_PAGE_SURFACE_CLASS` | Page + main wash `bg-slate-50 text-slate-900` |
| `MODELER_CARD_SURFACE_CLASS` | Group/API card: `rounded-lg border border-slate-200 bg-white` |
| `MODELER_GROUP_ACCENT_BAR_CLASS` | 2px start bar on named column groups (`bg-current` + nav color class) |
| `MODELER_EMPTY_STATE_CLASS` | Dashed empty CTA shell (neutral hover — **no** indigo wash) |
| `MODELER_INSPECTOR_LIST_PREVIEW_COUNT` | Inspector Relations / APIs show this many items (5) before **and N more** |
| `MODELER_INSPECTOR_MORE_LINK_CLASS` | Caption-size disclosure link under a collapsed inspector list |

### Typography

| Token | Classes | Use |
|-------|---------|-----|
| `MODELER_TITLE_CLASS` | `TYPE_PAGE_TITLE_CLASS` + `font-mono` | Content-header object title |
| `MODELER_SUBTITLE_CLASS` | `TYPE_CAPTION_CLASS` + `text-slate-500` | `objectName · data source` |
| `MODELER_CAPTION_CLASS` | `TYPE_CAPTION_CLASS` | Counts, empty helpers, loading lines |

**Avoid** new `text-[10px]` in modeler chrome. Prefer caption / `TYPE_CAPTION_CLASS`. Identifiers use `font-mono` at caption/`text-xs` size. Relation titles stay **roman** (`MODELER_RELATION_TITLE_CLASS` — no italic).

### Chips & focus

| Token | Role |
|-------|------|
| `MODELER_FIELD_CHIP_CLASS` | Column chips — slate-100 fill, medium roman |
| `MODELER_RELATION_CHIP_CLASS` | Relation summary chips — white + slate hover |
| `MODELER_CHIP_FOCUS_CLASS` | `focus-visible:ring-2 focus-visible:ring-slate-300` |
| `MODELER_NEUTRAL_ICON_CLASS` | `text-slate-400` for decorative / empty icons |

### Floating panel chrome

| Token | Role |
|-------|------|
| `MODELER_FLOATING_PANEL_HEADER_CLASS` | `h-9 border-b border-slate-200 bg-white px-3` |
| `MODELER_FLOATING_PANEL_TITLE_CLASS` | `text-xs font-semibold tracking-tight text-slate-800` |
| `MODELER_FLOATING_PANEL_HEADER_BAND_CLASS` | Secondary band under title (identity row) — slate-50/80, not indigo wash |
| `MODELER_PANEL_BORDER_COLUMN_CLASS` | Column Properties — `border-2 border-indigo-200/70` |
| `MODELER_PANEL_BORDER_RELATION_CLASS` | Relation Properties / Relations workspace — `border-2 border-violet-200/70` |
| `MODELER_PANEL_BORDER_DESIGNER_CLASS` | Table designer — `border-2 border-slate-300/90` |

Body of every floating panel: **white / neutral**. No full-panel violet/indigo gradients or `bg-indigo-50/30` asides — summary rails use `border-slate-200 bg-slate-50/50`.

### Deprecated

| Token | Rule |
|-------|------|
| `MODELER_SECTION_ACTION_BUTTON_CLASS` | Empty / deprecated — **never** restore indigo-100 button fills; use `AppButton` intents |
| `MODELER_CHIP_SHELL_CLASS` | Alias of field chip — prefer explicit field/relation chip tokens |

---

## 3. Color semantics (small-area only)

Aligns with [`ui-design-system.md`](./ui-design-system.md) (Tier 2/3) and [`ui-core.md`](./ui-core.md) §Color it. Large surfaces stay white / slate-50.

| Meaning | Hue | Where |
|---------|-----|--------|
| Structure / columns | Indigo | `FormSection` tone on Columns; Column Properties border + title icon |
| Relations | Violet | Relations section tone; Relations panel / Relation Properties border; Physical nature badge |
| Logical nature | Teal | Logical nature badge (matches diagram dash) |
| Kind label | Amber | Relation kind pill (`Has many`, etc.) |
| Primary key | Amber | PK links in Columns header; PK badge in Column Properties |
| Foreign key | Emerald | FK badge in Column Properties |
| Sync / success | Emerald | Sync Model → `intent="confirm"` |
| Create | Indigo solid | Create API → `intent="create"` |
| Danger | Rose | Truncate / Delete → `intent="destructive-soft"` |
| Control-plane lock | Amber | Lock icon next to title |
| Neutral chrome | Slate | Page wash, cards, captions, inspector sections, designer border |
| Group accent | Operator nav color | Thin start bar + group title/icon only (`resolveNavColor`) |

**Rules**

1. At most **one loud accent** in the first viewport (usually Columns indigo + Sync emerald).
2. Do not paint section action buttons, Sync, Story empty, or summary asides with filled indigo-100.
3. Badge fills are soft (`*-50` bg + `*-200` border + `*-800` text) — never solid success-green for both kind and nature.

---

## 4. Content header

Reference: `EdgeModelModelerWorkspace.tsx`.

| Element | Spec |
|---------|------|
| Padding | `px-3 sm:px-5 py-2.5` |
| Back | `WorkspaceBackIcon` only — see [`ui-toolbar.md`](./ui-toolbar.md) §Workspace back (do not fork) |
| Icon | Object icon or `TableProperties`, `h-4 w-4`, colored via `resolveNavColor` |
| Title | `MODELER_TITLE_CLASS` — `font-mono` **objectName** (item identity; shell stays `{group} / Data Studio`) |
| Subtitle | `MODELER_SUBTITLE_CLASS` — data source name (technical) |
| Lock | Amber Lucide `Lock` + HeroUI tooltip when control-plane |
| Dependencies | `AppButton intent="secondary" size="sm"` + `GitFork` — opens `CreateEditModalShell` on demand (do not auto-load in the inspector) |
| Data | `AppButton intent="secondary" size="sm"` + Lucide `Sheet` — live table datasheet (edit-open row editor, save on leaving a row, one editable SELECT with named columns and TOP/LIMIT). Card grid **Data** action opens the same panel. Max 200 rows. |
| Record Policies | `AppButton intent="secondary" size="sm"` + `Shield` + count badge |
| Primary action | **Sync Model** — `AppButton intent="confirm" size="sm"` + `RefreshCcw` `h-3.5 w-3.5` (spin while refreshing) |

Display title / story remain in the inspector (General) — do not duplicate a second marketing-style title beside `objectName`.

Metadata / AI-guidance hints belong on the **General** inspector section (`FormSection hint`), not beside the subtitle.

---

## 5. Main sections (`FormSection`)

| Section | Tone | Role | Header actions |
|---------|------|------|----------------|
| Columns | `indigo` | Hero structure | New group → `secondary`; Edit (designer) → `secondary` |
| Relations | `violet` | Secondary summary | Open diagram → `secondary` |
| Data APIs | `slate` | Secondary inventory | Create API → `create` |
| Record Policies | `slate` | Scope summary only | Configure → `secondary` + `Shield` (opens maximized editor; not `KeyRound`) |

- Relations, APIs, and Record Policies use `divided`.
- Section actions use stock `AppButton` intents — no className color overrides.
- Prefer opening deep workspaces (diagram / designer / record-policy editor) from section headers; keep the main scroll as a **summary**, not a second full editor.

### Columns density

- Named groups: `MODELER_CARD_SURFACE_CLASS` + optional accent bar.
- Chips: `h-7`, `text-xs`, `font-mono` name, wrap `gap-1.5`.
- **Always visible** on named groups (when layout editable): group icon (if set), **color swatch**, title, count.
- **Progressive disclosure** (reveal on `group-hover` / `group-focus-within`): missing icon affordance, rename pencil, move ↑↓, remove.
- DnD over-state: slate border/wash (`border-slate-300`, `bg-slate-50/80`) — not indigo-50.

### Relations summary

- Grid of chips (`MODELER_RELATION_CHIP_CLASS`) — **title only** (kind / nature / studio fields live in Relation Properties and the Relations diagram/datasheet).
- Click chip → Relation Properties floating panel.
- Inspector lists longer than five chips collapse behind **and N more** (see §6).
- Empty → `MODELER_EMPTY_STATE_CLASS` CTA that opens the diagram.

### Data APIs summary

- Compact **single-line** rows: method pill · path · source pill (Platform / Built-in / Published / Draft).
- Click a **Data API** row (or its pencil) to open `ConfigureDataApiDialog`. Change-reason Ask / Include general / Manage reasons live on the Runtime tab of that panel (no Vocab node picker). Hover Access / Hooks open that same dialog on the matching tab (and the Access or Hooks form).
- Click a **Built-in / managed function** row (or its Settings icon) to open `ConfigureFunctionApiDialog` — the **same** Server Functions Settings form (Function Type, VM, logs, cache, portal tag, Change reason). Access and Hooks icons open those forms in place. Change reason is stored on that function’s `metadataJson`. Package APIs are view-only (no Access/Hooks). GET/list never ask at runtime.
- Platform-only rows (no matching function or Data API) stay non-clickable and have no edit/delete.
- Hover / focus-within reveals row actions: Data APIs — pencil, Access, Hooks, delete; function rows — Settings, Access, Hooks. Delete must not bubble to row click. Delete only on Data APIs.
- Inspector lists longer than five rows collapse behind **and N more** (see §6).
- Empty → dashed CTA → Create API (only when the object has no platform, function, or Data API operations).

### Record Policies summary

- Read-only: scope pill (off / on), incomplete-on warning when on with no policies (summary only — not in the Configure dialog), optional Force ADMIN, policy count, predicate preview.
- Empty → `MODELER_EMPTY_STATE_CLASS` CTA opens the same Configure dialog as the section header.
- Do **not** put Rule Builder, Explain, or Add/Delete policy on the main scroll.
- Configure dialog: On/Off + ADMIN checkbox in the header; body is a `BaseTreeGrid` of the AND/OR policy tree (all groups expanded by default). Each leaf is a SQL-style condition (field / operator / value). No name or roles columns. No left/right split and no nested add-policy window. Drag rows to reorder or nest. No per-action checkboxes. Do not show compiled-WHERE preview. Do not describe scope as granting or denying API calls.
- Data APIs: **Skip scope** badge when an operation has `bypassRecordPolicy`.

---

## 6. Inspector (side panel)

**Exception** vs [`ui-inspector-rail.md`](./ui-inspector-rail.md): the modeler inspector is **writable** (`FormSection` + `tone`, identity/story pencils). Do not migrate it to boxed KV cards unless this shard is revised.

Reference: `EdgeModelModelerSidePanel.tsx`.

| Item | Spec |
|------|------|
| Width | `w-80` fixed (**exception** — nested-editor inspectors are `370px`) |
| General | `tone="slate"`, `hint` for AI metadata guidance; identity + edit as `secondary` `icon-sm` |
| Story | `tone="slate"` `divided`; Markdown preview or empty CTA; edit `icon-sm` `secondary` |
| Relations / APIs lists | First **5** chips/rows (`MODELER_INSPECTOR_LIST_PREVIEW_COUNT`). Remainder stays hidden behind a caption `NativeButton` link **and N more** (`MODELER_INSPECTOR_MORE_LINK_CLASS`) that expands in place; **Show less** collapses. Do not let long lists stretch the `w-80` rail. |
| Meta fields | Label `text-[11px]` normal-case slate-500; value `text-sm font-medium text-slate-800`; label-over-value `ps-[4px]` + `gap-[2px]` |
| Danger zone | Footer only; label `text-[10px] font-semibold uppercase tracking-wider text-slate-400`; Truncate/Delete = `AppButton intent="destructive-soft" size="sm"` — **not** ad-hoc rose NativeButton classes |
| Control-plane | Hide Truncate/Delete |

---

## 7. Empty & loading states

| State | Treatment |
|-------|-----------|
| Modeler load | Skeleton: header bars + 3 main cards + rail blocks (pulse slate-100) — never centered gray text alone |
| Section empty | `MODELER_EMPTY_STATE_CLASS` + neutral icon (`MODELER_NEUTRAL_ICON_CLASS`) + caption; clickable when there is a primary CTA |
| Empty group drop | Caption only: “Drop columns here” |

Do not give Story a louder empty treatment than Columns / Relations / APIs.

---

## 8. Floating studio windows

Aligns with [`ui-core.md`](./ui-core.md) §Floating panels (`border-2`, white body). Data Studio overrides use **modeler border tokens** above.

| Window | Border token | Header |
|--------|--------------|--------|
| Column Properties | `MODELER_PANEL_BORDER_COLUMN_CLASS` | Neutral header + headerBand; indigo on icon / mono name only |
| Relation Properties | `MODELER_PANEL_BORDER_RELATION_CLASS` | Same band recipe; violet on icon |
| Relations (diagram/datasheet) | violet border token | White header; body `bg-white` (no violet page gradient) |
| Table designer | slate border token | White header `h-9` |
| Add table (relations) | violet border token | White header |

Property windows: left form / right summary rail. Summary rail stays **slate**, not tinted indigo.

Modal CRUD (General edit, Identity): `CreateEditModalShell` per [`ui-dialog.md`](./ui-dialog.md) — not `FloatingPanelShell`.

---

## 9. Buttons & icons (quick map)

| Action | Intent / control |
|--------|------------------|
| Sync Model | `confirm` |
| Dependencies / Record Policies | `secondary` |
| Create API / Add Column (designer) | `create` |
| New group, Open diagram, Edit (designer), inspector pencils | `secondary` |
| Truncate / Delete | `destructive-soft` |
| Chip / row icon actions at rest | `ICON_ACTION_*` ghost (no filled indigo) |
| Labeled buttons | Leading Lucide `h-3.5 w-3.5` — always ([`ui-toolbar.md`](./ui-toolbar.md)) |

---

## 10. Sizes & density cheat sheet

| Element | Size |
|---------|------|
| Form controls | `sm` default |
| Content-header icon | `h-4 w-4` |
| Section / button icons | `h-3.5 w-3.5` |
| Chip / footer micro icons | `h-3 w-3` |
| Column chip height | `h-7` |
| Floating panel title bar | `h-9` |
| Inspector width | `20rem` (`w-80`) |
| Main horizontal padding | `px-5` |
| Section stack gap | `gap-5` (+ `divided` `pt-3` on later sections) |
| Label → control / meta | `ps-[4px]`, `gap-[2px]` |

---

## 11. Anti-patterns (do not ship)

1. Indigo-filled “third button” style for every section action.
2. Sync styled as secondary/indigo instead of `confirm`.
3. Italic technical identifiers (relation names, column names).
4. Large indigo/violet body washes on pages or floating panels.
5. `border-4` brand chrome on designer windows.
6. Always-on clutter of group chrome (↑↓ / remove / rename) — keep progressive disclosure except **color swatch** (always visible when editable).
7. Object name in the admin shell header (deep-link exception).
8. Persian / non-English UI copy ([`ui-core.md`](./ui-core.md) §English-only).
9. Native `<input type="checkbox">` or raw text inputs — use `UiCheckbox` / `UiInput` / etc.
10. `window.confirm` for Truncate/Delete — in-app confirm dialogs only.

---

## 12. File map (implementation)

| Concern | File |
|---------|------|
| Tokens | `src/features/data-studio/lib/modelerChipStyles.ts` |
| Workspace shell | `…/EdgeModelModelerWorkspace.tsx` |
| Columns | `…/EdgeModelModelerColumnsSection.tsx` |
| Relations summary | `…/EdgeModelModelerRelationsSection.tsx` |
| APIs summary | `…/EdgeModelModelerApisSection.tsx` |
| Inspector list preview | `…/ModelerInspectorListPreview.tsx` · `…/lib/modelerInspectorListPreview.ts` |
| Inspector | `…/EdgeModelModelerSidePanel.tsx` |
| Column Properties | `…/EdgeModelModelerColumnDialog.tsx` |
| Relation Properties | `…/EdgeModelModelerRelationDialog.tsx` |
| Designer window | `…/EdgeModelDesignerPanel.tsx` |
| Relations window | `…/EdgeModelRelationsPanel.tsx` |
| Dependencies dialog | `…/EdgeModelModelerDependenciesDialog.tsx` |

When changing visuals, update **tokens first**, then consumers, then this shard + `projectStandards.ts`.

---

## 13. Applying this system to new studio surfaces

For a new document-style studio page (list → full workspace swap):

1. Keep large surfaces neutral; pick **one** section accent + semantic badges.
2. Put object identity in a content header; shell is `{group} / {page} / Edit` (not the object name).
3. Use `AppButton` intents from [`ui-toolbar.md`](./ui-toolbar.md) — never a local filled-accent button class.
4. Prefer summary chips/rows on the main scroll; open `FloatingPanelShell` for deep editing with `border-2` + white body.
5. Empty states: one dashed shell pattern; loading: skeleton, not orphan text.
6. Progressive disclosure for dense chrome; keep identity cues (color swatch, status pills) always visible.

### Base Components living catalog

Base Components (`pageKey: base-components`) is the interactive reference for shared UI — **not** a fake modeler. Its outer chrome follows this restraint via `src/features/base-components/baseComponentsVisualTokens.ts`:

- Slate page wash + slate header title; nav active without rainbow fills (small icon hue only).
- Empty CTAs use `BASE_COMPONENTS_EMPTY_STATE_CLASS` (same recipe as `MODELER_EMPTY_STATE_CLASS`).
- Soft selection chips (`BASE_COMPONENTS_OPTION_SELECTED_CLASS`) — no indigo-50 fills.
- Floating-panel section can **preview** modeler window chrome via `studioChrome` presets (`column` / `relation` / `designer`).
- Keep FormSection tones inside configurators — they teach the tone map.
- Inside-section rhythm: `BASE_COMPONENTS_PREVIEW_BODY_CLASS` (`gap-3 p-3`) for preview bodies; `BASE_COMPONENTS_CONFIG_*` field grids; `BaseComponentsResetButton`; subsection labels via `BASE_COMPONENTS_CONFIG_SUBSECTION_LABEL_CLASS` — no ad-hoc `p-4`/`p-6` preview pads.

**IDs:** `ui.data-studio.modeler.*`. Read-only nested-editor inspectors: `ui.inspector-rail.*`.
