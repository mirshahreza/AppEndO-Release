# UI core — forms, shell, copy, feedback

> **Shard:** `ui-core`  
> **Tokens:** [`ui-design-system.md`](./ui-design-system.md) — do not restate color/type/radius/elevation here.  
> **Controls:** Base Components `/studio/base-components` (always-on in `AGENTS.md`).

## Intent

How product forms, the admin shell, and feedback behave. Visual tokens are the design-system shard.

## MUST

- Use Base Components primitives (`UiInput`, `UiTextarea`, `UiCheckbox`, `UiRadioGroup`, `UiSelect`, `UiCombobox`, `FormField`, `FormSection`, `AppToast`, `FloatingPanelShell`, …).
- Form Tab order visits **value controls** in document order (inputs, textareas, selects, radio groups, checkboxes, switches). Accessory chrome grouped with a field is `tabIndex={-1}` — §Form tab order.
- English-only strings in production source (`src/`, `public/`) — TS/TSX/JSON. Markdown under `docs/` and `plans/` is exempt and is not shipped in the Electron installer.
- Run `npm run hygiene:english-copy` before merge; it fails on Arabic-script characters outside the allowlist in `scripts/hygiene-english-copy.ts`.
- Tenant entity labels: canonical English `label` on the record + seeded `settings.attributes.label.{key}` in Cultures → Translations. No `label_en` / `label_fa` columns. Resolve `t(key)` → `label` → `key`.
- Label over input: one vertical stack, label `ps-[4px]`, **2px** gap to control.
- Default control size `sm` (`heroFieldSize.ts`). One size per form surface.
- Required fields: invalid rose border **from first paint** until valid (`FormField` `invalid` / `required`). Overlay feedback default (`feedbackPlacement="overlay"`). Overlay balloons prefer **above** the control and flip **below** when the viewport or a clipping ancestor has no room.
- Field hints: `FieldHintTooltip` / `FormField hint` — never under-field helper paragraphs or native `title=` for field guidance. The studio page guide reads the same `hint` (plus `title`) from `data-page-guide*` — see §Page guide.
- Shell loading: never a blank white viewport — `AppRouteLoading` (see below).
- In-shell menu/link clicks raise the embedded cover **from the click**, not after the URL commits. React may keep the previous page on screen until the next chunk is ready; `useShellNavigate` / `beginShellNavigationPending` must not wait for that. Same-path and CMS Settings soft-nav stay uncovered.
- Text `autoDir` on for `UiInput` / `UiTextarea` / Markdown editor except machine/identifier fields (`autoDir={false}`). Markdown editor `dir="auto"` (default) uses the first meaningful character (`getContentTextDirection`); explicit `dir=ltr|rtl` wins.

## NEVER

- Raw `<input>` / `<textarea>` / `<select>` / native checkbox in product forms. Exceptions: `type="file"|"hidden"|"color"` and designer runtime/export parity widgets.
- Native HTML `<select>` or `UiSelect` **`preferNativeSelect`** on operator/public forms — use the HeroUI **`UiSelect` menu** (Base Components → selection-fields). See §Closed-set pickers.
- Positive `tabIndex` on form controls, or leaving generate/copy/browse/clear/hint/AI buttons in the Tab sequence beside a field.
- Hand-rolled HeroUI Radio/Checkbox rows — use `UiCheckboxChoiceList` / `UiRadioChoiceList` / `UiRadioGroup`. Exclusive **title + description** options use option cards (§ below) — do not add radio dots to those boxes.
- Large saturated panel or page color washes.
- `window.confirm` — [`ui-dialog.md`](./ui-dialog.md) §Danger.
- Ad-hoc HeroUI toasts — `showAppFeedbackToast` → `AppToastHost`.

## English-only (production)

Production artifacts are the Vite client bundle, `dist/server.cjs`, and `public/`. They must not contain Arabic-script characters in source files except:

| Allowlist | Why |
|-----------|-----|
| `src/core/culture/translations/` · `culture-packs/` | Translation keys (built-in packs stay English; operators may localize in DB) |
| `src/core/db/database.ts` | Multilingual `title_fa` / `title_ar` seed columns |
| `src/shared/lib/rtlScriptPreviewSamples.ts` | RTL/bidi fixture strings for font preview and Base Components demos |

**Operator data:** Cultures → Translations and `base_info` localized titles are runtime data, not governed by this scan.

## Color it

Tokens: design-system Tier 2/3. Recipe:

1. Targets: small backgrounds, borders, fonts/labels, icons — never modal/page body fills.
2. Meaning first: identity indigo/violet, technical cyan, relation emerald/lime, caution/PK amber, danger rose, success emerald.
3. Reuse `FormSection` tones, `APP_SURFACE_BOX_TONE_CLASS`, `buttonSemantics.ts`.
4. Restraint: a few accents, not every element.
5. Named section lists (nav rails, group headers) keep **per-item hue visible at rest**.

## Page guide

User-facing name: **Tour guide**. The header Route control (next to feedback) opens the companion. The first step sits in the **center of the page** and asks what to explain, with three exclusive option cards (`UiOptionCardGroup`): **This page** (workspace body, topic, toolbars, fields), **Other pages and navigation** (sidebar, app switcher, nav items), **Your capabilities** (studio tools and account controls available to this user). After a choice, the companion walks only `[data-page-guide]` stops in that topic that have both **title** and **hint**. Hidden on phone. Skip self-explanatory landing chrome (**Home** nav, studio logo). Previous from the first stop of a topic returns to the chooser. Play advances to the next stop every 8 seconds; pause or the last stop ends autoplay. While playing, a cyan circular countdown rings the play control. Click the companion to cycle body shapes. Drag it away and release — it hops back under the bubble. The tour does not open AppEndO chat. The active hotspot stays visible — the bubble and companion do not cover it. Hotspot dots swallow pointer events so the control underneath does not activate. Bubble controls are ghost icon-only (`ICON_ACTION_*`). Do not invent filler copy on every existing field or unlabeled nav item.

How the guide learns a stop:

- `FormField` `hint` and `FormSection` `hint` or `description`
- `FieldHintTooltip`
- Settings `labelInfo`
- `PageHeaderToolbar` `description`
- Shared page primitives: `ToolbarSearchInput`, `ToolbarRefreshButton`, `GridPagingFooter`, `AppButton intent="create"`, `AppSearchBox`, `ToolbarFilterRadioGroup`, `ToolbarFilterSelect`, `ToolbarFilterCheckbox`, `ToolbarFilterMatchLogicBadge`, `AppSplitButton intent="create"`, dialog/wizard headers, floating panel titles
- `pageGuideProps({ title, hint, priority, scope: 'local', topic: 'page' })` or `pageGuideLocalProps` / `pageGuideChromeProps` / `pageGuideNavItemProps` (`topic` is `page` | `navigation` | `capabilities`)
- Designer/CRUD generators: field `hint` on the node (runtime + exported TSX wrap the control)

**IDs:** `ui.page-guide.hints`

## Forms

Canonical: Base Components → Form fields group (`text-fields`, `choice-fields`, `selection-fields`, `structured-fields`, `ai-fields`, `ai-chat-panel`).

- Group with flat `FormSection` + `FormField` — §Form sections below. Intra-stack `flex flex-col gap-1`.
- **Do not** wrap ordinary fields in bordered panel boxes. Boxed shells are for **choice lists**, **option cards**, and **data hosts** (grids) only.
- Pair short fields: `resolveFormFieldPairGridClass(true)`. Full-width (textarea) below the pair grid.
- Tab order: value controls only — §Form tab order.
- `FormField layout="side"` (dense inspectors / dialog title bands): label column and control share **one horizontal midline** (`items-center`, `FORM_FIELD_SIDE_LABEL_COLUMN_CLASS`). Do not `items-start` that row. Stack layout stays label-over-input (`gap-[2px]`, label `ps-[4px]`).
- Invalid border: `HEROUI_FIELD_INVALID_BORDER_CLASS` / `resolveHeroUiFieldBorderClass` — no per-page red borders.
- `ui_color`: picker + hex in one field container.
- Combobox vs autocomplete: typeable filterable pickers use `UiCombobox`, not button-style `UiAutocomplete`. `menuTrigger`: `focus` (default, open the list on focus) · `input` (suggestions only after typing) · `manual` (chevron only).

### Closed-set pickers (`UiSelect`)

Fixed option lists (status, province, role, enum) use **`UiSelect`** with `<option>` children — the **HeroUI trigger + listbox menu**, matching Base Components → **selection-fields**. Default `size="sm"`, `placeholder` for empty state. Inside clipped wizards/cards/dialogs use **`clipSafePopover`** (or `nested` when the field is on a bordered nested surface) plus `popoverPlacement` / `shouldFlip` so the portaled menu stays visible (`z-[1100]`).

| Need | Control |
|------|---------|
| Closed list, pick one | `UiSelect` (HeroUI menu) |
| Closed list + type-to-filter | `UiCombobox` |
| Toolbar / dense filter chip | `ToolbarFilterSelect` or `UiSelectMenu` where the catalog says so |

**Never** ship plain browser `<select>` or `preferNativeSelect` on product forms to “fix” overflow — set `nested`, `popoverPlacement`, and `shouldFlip` instead. **Only** allowed native escape: Appearance shell preferences panel (locked internal prefs).

**IDs:** `ui.form.select.heroui-menu`

### Form tab order

Tab / Shift+Tab in product forms moves through **value controls** in document (visual) order: text inputs, textareas, select / combobox triggers, radio groups, checkboxes, switches, and file-upload hosts. It does **not** stop on chrome grouped with a field.

**Value controls (stay in the sequence)**

- `UiInput`, `UiTextarea`, `UiPasswordInput` (the text field, not the visibility toggle)
- `UiSelect` / `UiCombobox` / `UiAutocomplete` / `UiTreeSelect` triggers
- `UiRadioGroup` / `UiRadioChoiceList` (native radio group: one stop, arrows change option)
- `UiOptionCardGroup` — one tab stop for the group (the checked card, or the first enabled). Arrow keys / Home / End move between cards. Do not put every card in the Tab sequence.
- `UiCheckbox` / `UiCheckboxChoiceList` (each independent checkbox is a stop)
- `UiSwitch` / `FeatureToggleField`
- File / image upload hosts (the control that picks the file)

**Accessory chrome (skip — `tabIndex={-1}`)**

Buttons and extra widgets **grouped with** a field, including: `FieldHintTooltip` / Settings `labelInfo`, AI sparkle (`AiAssistFormField` `labelExtra`), record-history icons on the label, password visibility, `UiInput` / `UiTextarea` start/end adornment buttons, clear / copy / generate / browse / binding toggles in the same control row, chip dismiss, where-builder add/remove/drag, relation-picker **clear** (the search trigger stays — it is the field). Click still works.

Use `FormAccessorySlot` around grouped addon slots, or `AppButton tabStop="skip"`, or `formAccessoryTabProps`. Do not assign a **positive** `tabIndex` to force order — keep DOM order.

Footer primary actions (Save / Cancel / Next / Test connection that is not inside a field row) stay after the last field.

**IDs:** `ui.form.tab-order.fields-only`

### Form sections

Gold sample: Portals → Edit portal (`PortalsPageView` + `PortalBrandFields`). Match that chrome; do not invent a parallel heading.

`FormSection` owns the header: ink accent bar, CSS-uppercased eyebrow title, optional hint icon, optional ink wash. Callers pass **sentence-case English** titles (`Portal`, `Identity`, `Redirect`, `Layout`) — never pre-uppercased strings, never a raw `<h2>`/`<h3>` plus a handmade bar.

**Write a section**

1. One `FormSection` per conceptual group. Title is a short noun or noun phrase (1–2 words). Do not use a sentence or a field-name dump as the section title.
2. First group: omit `divided`. Every later group: `divided` (`FORM_SECTION_DIVIDED_CLASS` / `pt-3`). No extra `<hr>` or border-b between sections.
3. Outer body stack: `flex flex-col gap-1`. Intra-section field stack is the component default (`FORM_SECTION_BODY_STACK_CLASS` / `space-y-2`).
4. Section guidance uses `hint` (info icon after the title). On dense create/edit, do not also pass `description` (visible under-heading paragraph). Field guidance stays on `FormField hint`.
5. Two related short fields: `resolveFormFieldPairGridClass(true)`. Full-width controls (textarea, long copy) sit **below** the pair grid. A logo + stacked titles row may use a custom flex row inside the same section — still not a bordered panel.
6. `ink` is required on product create/edit (not `tone` palettes). Rotate channels so adjacent sections differ:
   - `accent` — primary record identity (Portal, Layout)
   - `complement` — related chrome / brand (Identity)
   - `contrast` — policy / routing (Redirect)
   Repeat a channel only after another channel sits between. Nested `FormField` labels inherit the section ink.
7. Dialog top bands (Enabled, System Protected) are **not** `FormSection`s. Keep them on the create/edit enabled band; do not wrap them as PORTAL / ENABLED groups.

**Never**

- Hand-rolled section headers, `uppercase` in the title string, or under-heading helper `<p className="text-[10px] …">`.
- `rounded-md border` / `AppSurfaceBox` around a field group. **Exception:** read-only nested-editor inspector cards — [`ui-inspector-rail.md`](./ui-inspector-rail.md). Do not use `FormSection` ink bars on those rails.
- `tone` on product create/edit when `ink` is available (Settings / catalog config may still use `tone`).
- A `FormSection` with no fields (empty chrome).

Settings config uses `SettingsFormGroup` instead — same divided/flat rules, different typography. Living catalog: Base Components → text-fields.

**IDs:** `ui.form.section.write`, `ui.form.section.intra-stack`, `ui.form.flat-sections-no-boxes` (inspector cards: `ui.inspector-rail.*`), `ui.form.field.side-align`

### Exclusive option cards

When each exclusive option has a **title plus description** (mode / policy / encryption pickers — not a short label list):

- One **button/box per option**. Layout via `UiOptionCardGroup` `columns` (2 → side-by-side, 3 → three-up, 1 → stacked).
- **No visible radio** — not `UiRadioChoiceList`, not a radio-card wrapper, not HeroUI `Radio`. Host `role="radiogroup"`; each control `role="radio"` + `aria-checked`. One tab stop per group (checked or first enabled); arrows / Home / End move between cards — §Form tab order.
- Selected state is **border + light fill** (`accentClassName`, or the option’s `tone` wash), not a filled disc.
- Optional Lucide icon sits **in the title row** (`inline-flex items-center gap-1.5`; icon `h-3.5 w-3.5` compact / `h-4 w-4` default) — never a separate chip beside the body.
- Optional per-option `tone` (`AppSurfaceBoxTone`) tints border, icon, and title **at rest**; selected adds the tone strip wash. Descriptions wrap to multiple lines (`whitespace-pre-line`). Group `accentClassName` is the fallback when an option has no `tone`.
- Field label stays above the grid (label-over-input, `gap-[2px]`).
- Two options → `columns={2}`. Three title+description options → `columns={3}`. Long stacked lists → `columns={1}`. Short name chips that hug their label → `columns="auto"` (flex wrap, width fits the title).
- Living sample: `UiOptionCardGroup` (`src/shared/ui/UiOptionCardGroup.tsx`) — Base Components → Choice. Product wrapper: `SmtpEncryptionField` on Settings → Email / SMTP and the install email step.

Short label-only exclusive lists still use `UiRadioChoiceList`.

### Settings forms

- `SettingsFormGroup` over `FormSection`. First group plain, later groups `divided`.
- Intra-group `SETTINGS_FORM_GROUP_BODY_STACK_CLASS`; grids `SETTINGS_FORM_GRID_GAP_CLASS`.
- Feature toggles **disable** dependent fields (`SettingsDisabledFieldset`) — do not unmount them.
- `labelInfo` sits immediately after the label; reserve the 16×16 slot (`reserveInfoSlot`).
- Stacked full-width fields: `labelBand={false}`.
- New field labels follow design-system **Field label**. Existing screens keep `getSettingsTypography()` until a migration pass.

### WHERE builder

Base Components → where-builder · `UiWhereBuilder`. Nested AND/OR on the **group header**. Field/operator = `UiSelectMenu`. Value widgets follow field type; closed `options` use a select (or `UiCombobox` when `allowCustomValue`). Text values may pick `contextItems` (server context). Manual expression is one-way (delete to leave). `allowReorder` for sibling/group drag. Do not invent a parallel predicate editor. **List Filter** dialogs reuse this builder via `ListFilterDialog` + `WHERE_BUILDER_LIST_FILTER_CHROME`. New list pages: keep inline toolbar filters, put `ListFilterToolbarControl` last in the filters cluster, `ListFilterSummaryBand` + `ListFilterDialog` on the page — checklist in [`crud-pages.md`](./crud-pages.md) §New DB-backed list interface; placement in [`ui-toolbar.md`](./ui-toolbar.md) §List Filter.

### EUA fields

Base Components → AI assist. `AiAssistFormField` inside `AiFieldAssistSectionProvider`. Structured extract launcher in the form **header toolbar**, not `FormSection headerExtra`. Pair-grid: reserve sparkle slot on the plain neighbor (`AI_FIELD_LABEL_EXTRA_PLACEHOLDER_CLASS`).

### AI chat panel

Base Components → AI Chat Panel · `UiContextChatPanel`. One chrome for SQL Console, Image Editor, SSH Hub, File Hub, Server Functions editor, Live Designer, Workflow Designer, and the AppEndO header agent. Hosts send context and apply returned actions. Docking (beside a console vs inside a host window) is host layout — not a catalog option on this panel. Agency is host-settable (`agencyModes` / `agencyMode` / `agencyPickerVariant`): **Ask** replies in the panel only, **Read only** auto-runs read commands (SQL SELECT, SSH inspect), **Agentic** runs every suggested action. Picker chrome is header buttons or a dropdown next to the model. Omit `agencyModes` when the host owns a different mode control (AppEndO Ask/Agent/Plan). Do not rebuild message list / prompt / model / send chrome per surface — mount this panel and pass slots (`headerSlot`, `bodySlot`, `promptToolbarStart`, `promptComposerStart`, `onSend` or `onSubmitPrompt`). **Session history + New chat are the default** for managed side panels (`onSend`): restore the latest chat on open, persist in browser storage scoped by `sessionHistoryKey` (or `panelKey`). Host-owned AppEndO fill chats keep history in the host window. **Image Editor opts out** (`sessionHistory={false}`). Code in assistant markdown and command cards uses `ChatCodeBlock`: hosts pass `codeDiffBaseline` so a full replacement shows **changed lines only** (not the whole file); dumps longer than five displayed lines collapse behind an `AppButton intent="utility"` expand/collapse. Short snippets stay as code. Copy still copies the full source.

## Responsive (selective)

**Canonical shard:** [`ui-responsive.md`](./ui-responsive.md) — tiers, shell/nav, toolbars, grids, dialogs, splits, inspector stack, touch targets, QA pass.

Summary: desktop-first chrome; **all studio pages work on phone and tablet**; compact tiers use overlay nav and near-fullscreen dialogs; docked rail from **1024px** only — geometry lock unchanged. Do **not** set `minViewport: 'desktop'` on core studio routes.

## Floating panels

`FloatingPanelShell` / `ToolboxPanelShell`. Default `border-2` via `FLOATING_PANEL_SHELL_CHROME_BORDER_CLASS` + `resolveSurfaceChrome`. Body white; tint on border/header/footer only. Click raises z-stack. Modeler windows: [`data-studio-modeler.md`](./data-studio-modeler.md).

## Canvas viewport

Every pan/zoom canvas uses the same overlay layout. Three slots are fixed: **search** (`CanvasSearchBox` = `AppSearchBox`) at **top-left**; **zoom** in / out / fit (`CanvasViewportControls` / `CanvasFlowViewportControls`) at **bottom-left**; **layout** at **bottom-right** (above MiniMap when present). Every other canvas button (toolbox, execute, settings, …) sits at **top-right**. MiniMap stays bottom-right. Dotted slate background (`#cbd5e1`, 16px). The canvas **clips overflow** — no native scrollbars. Pan with pointer drag; wheel zooms. Do not invent a parallel zoom bar, percent label, or per-surface xyflow `Controls` styling. File-manager image preview stays its own compact inline zoom (not a canvas). **ID:** `ui.canvas.viewport-controls`

## Overlay motion

Menus, drawers, flyouts, popovers, and dialogs open with a directional enter that matches the **trigger edge**. Phone/tablet hamburger and start-edge drawers slide from `start` (RTL-aware). Desktop collapsed-rail flyouts emerge from the rail. Popovers and split-button menus grow from the placement edge against the trigger (`bottom-start` → origin `top-start`). Compact fullscreen dialogs rise from the bottom; desktop dialogs scale from center. AppEndoo overlay enters from the header end. Use `overlayMotionPanelProps` / `overlayMotionBackdropProps` in `src/shared/ui/overlay-motion/overlayMotion.ts` — do not invent ad-hoc fade/slide classes. Respect `prefers-reduced-motion`.

## Admin shell

Page, sidebar, and header share one light tone. Content host flush right/bottom; start-edge lift shadow only. Shell header and sidebar default to **no** line-pattern texture (`header-line-pattern` / `menu-line-pattern` stay off the chrome class names). Theme Designer can raise `--app-menu-texture-opacity` / `--app-header-texture-opacity` and `--app-sidebar-fill-opacity` / `--app-header-fill-opacity` (0% default). Geometric atmosphere behind chrome is **on by default**; Theme Designer can turn `--app-atmosphere-geometry` off. **ID:** `ui.admin-shell.no-chrome-texture`

Compact header (`<lg`): fixed **52px** content band, `items-center`. Each control’s center is equidistant from the header top and bottom. `env(safe-area-inset-top)` is **extra padding above** that band (notch), not a substitute for vertical padding — do not pair `py-1.5` with top-only `pt-[env(safe-area-inset-top)]`. Inner row is `h-full items-center`. Desktop `lg:h-[59px]` unchanged. **ID:** `ui.admin-shell.header-vertical-center`

Below `sm` (640px) the first header row cannot hold hamburger + mark + title + actions. Hide the inline title and add a **second header band** (`ADMIN_SHELL_HEADER_TITLE_ROW_CLASS`) with the page title centered. Do not change `sm` through desktop. **ID:** `ui.admin-shell.header-title-row`

Header utility hover hints (feedback, tour guide, header nav, account trigger) use `HeaderHintTooltip` / `buildSideHintContent`: dark compact chrome, **bold hue title**, optional description. Never native `title=` on those controls. **Notification bell** follows the utility cluster with no separator before it. **Expand page width** sits after the bell with `ADMIN_SHELL_HEADER_VERTICAL_SEPARATOR_CLASS` between bell and page-width (logical order; mirrors RTL layout). **Fullscreen** and the **account control** (inline end / outer edge) live in `ShellHeaderAccountEndCluster` with `ADMIN_SHELL_HEADER_VERTICAL_SEPARATOR_CLASS` before the account control — same on `AdminShellHeader` / `AppShellHeader` (studio + published shells). **Accent color** stays in Appearance (and profile-adjacent theme flows), not in that strip. **ID:** `ui.admin-shell.header-hints`

Every client component inherits **`UiClientComponent`**. Default is **all sizes**: `minViewport` `always` + `belowMin` `continue`. Set `tablet` / `desktop` and `hide` / `placeholder` only for a named exception. `placeholder` is the Desktop only body message. Living sample: Base Components → Client component. Designer inspector exposes the same props on every node. **ID:** `ui.client-component.viewport-host`

Collapsed sidebar **section** labels (nav group headings on the rail) and collapsed **item** labels show the **last 6 graphemes** of the visible title when no override is set; the rest is hidden (no ellipsis). Navigation manifest groups and items may set optional `collapsedLabel` for a custom rail string (still capped at 6 visible graphemes). The hover flyout heading and the control `aria-label` keep the full name. The selected box on the collapsed rail is **14px narrower** (`calc(100% - 14px)`, centered) so it clears the left and right edges, with **no start accent bar** and a slightly stronger accent wash than the expanded row. **ID:** `ui.admin-shell.collapsed-section-label`

Profile drawer is an **end-edge overlay**, not a full-screen sheet. Never `w-full`. Cap at 400px and leave a page peek of the collapsed-rail width (`81px` / `--admin-shell-sidebar-width-collapsed`) so the shell stays visible and tappable to dismiss — same idea as the hamburger overlay. **ID:** `ui.admin-shell.profile-drawer-peek`

Studio surfaces are **not text-selectable**. `PlatformMountProvider` sets `data-studio-no-select` on `html` for mount id `studio`, so the lock covers the shell, pages, dialogs, and portaled overlays. Restore selection only on `input` / `textarea` / `select` / `contenteditable` and Monaco editors. Public portals stay selectable. **ID:** `ui.admin-shell.no-text-select`

### Admin shell geometry lock (operator approval required)

**Locked for AI agents:** admin-shell **layout, spacing, and sizing** are product chrome — not incidental styling. Do **not** change them while fixing unrelated features, “cleaning up” CSS, or matching a one-off portal unless the operator **explicitly asked** for a shell change **and confirmed** the edit in that session.

**What stays frozen unless approved**

- **Sidebar widths:** expanded `250px`, collapsed rail `81px` (`--admin-shell-sidebar-width`, `--admin-shell-sidebar-width-collapsed`, `--admin-shell-sidebar-active-width`).
- **Logo band:** expanded `h-[91px]` + `px-2 py-[11px]`; collapsed `h-[74px]`; expanded lockup `translate-y-[10px]` on built-in sidebar logo; **no** `overflow-hidden` on the inner logo wrapper (designer template uses a plain flex host).
- **Shortcut strip (Home / Theme / Settings):** `ShellChromeUtilityNav` `sidebar-top` lives **inside** the side nav host as the first child; nav host top inset is **`pt-3`** (not `pt-2`) with `pb-2` and `px-[16px]` — parity with published designer shells.
- **Side nav order:** logo → optional portal-menu inset → nav host (shortcuts, then tree) — mirror `ADMIN_SHELL_LAYOUT_TEMPLATE` and keep `AdminShellSidebar` / `AppShellSidebar` structurally aligned.
- **Header heights:** desktop `lg:h-[59px]`; compact `<lg` **52px** content band (see header-vertical-center above).
- **Collapse control:** `.admin-shell-sidebar-collapse-toggle` seam (`top: 17px`, logical end `-0.75rem`).
- **Collapsed-rail logo nudges:** `[data-sidebar-collapsed='true']` rules in `src/index.css` (shared `translateY` on mark; band uses `padding-top`) — treat as calibrated; do not retune for one portal.
- **Collapsed section labels / rail item width:** `admin-nav-item-collapsed`, 6-character section labels — see collapsed-section-label above.
- **Layout width / bounded column:** `ShellLayoutWidthContext`, `ShellBoundedLayoutCanvas`, portal layout drafts — width modes affect chrome; same approval rule.
- **Logo asset metrics:** `AppEndLogo` sidebar heights (`h-[64px]` lockup, `h-[33px]` mark, aspect ratios) and themed mask assets.

**Canonical sources (edit together or not at all)**

| Layer | Location |
|-------|----------|
| Designer template | `src/domain/component-designer/layout-presets/adminShellLayoutTemplate.ts` |
| React sidebars | `src/layouts/adminShell/AdminShellSidebar.tsx`, `src/layouts/appShell/AppShellSidebar.tsx` |
| Surface tokens | `src/shared/ui/surfaceClasses.ts` (`ADMIN_SHELL_*`) |
| Published-shell patches | `ensureShellAdminRootChrome`, `ensureShellSideNavFillHeight`, `ensureShellSidebarCollapsedChrome` |
| Sidebar metrics (single source) | `src/shared/ui/adminShellSidebarMetrics.ts` · `ShellSidebarColumn` / `ShellSidebarAside` |
| Runtime chrome slots | `DesignerPublishedShellChrome.tsx` (`ShellLogoSlot`, …) |
| Global collapsed CSS | `src/index.css` (`.admin-shell-sidebar-logo-region`, collapse toggle) |

**Two render paths, one shell:** Studio `AdminLayout` and experience portals `DesignerPublishedShell` must remain **visually symmetric** in LTR and RTL; only navigation, culture, portal menu visibility, and approved layout-width options may differ.

**When changing is allowed:** operator request names the symptom (e.g. logo clip, shortcut spacing, RTL rail); agent states which locked files will move; operator confirms; then patch **all parity layers** in the table and verify Studio + one experience portal (screenshot or geometry check).

**ID:** `ui.admin-shell.geometry-lock`

## Shell loading (no blank white)

- `AppRouteLoading` `variant="fullscreen"` for boot/shell/auth. Same look as `#app-boot-splash`. Colors from **active accent** — never hardcoded teal.
- `variant="embedded"` for lazy pages inside a mounted shell.
- In-shell nav: `useShellNavigate` marks pending on click so `ShellRouteEnter` covers the content host immediately (same embedded `AppRouteLoading`), then keeps the cover until formatted reveal. Do not wait for the route to commit. Same-path and CMS Settings soft-nav skip the cover.
- First paint: `#app-boot-splash` in `index.html` with theme CSS vars; hydrate `localStorage` `appendo-accent-css-v3` in `<head>`.
- Keep splash until `ShellFormattedReveal` `onRevealed`. Wrap chrome in `ShellChromeEnter`, outlet in `ShellRouteEnter`. Atmosphere lives **inside** the cover, not as a sibling.
- Respect `prefers-reduced-motion`.

## Toasts

Top center: `fixed top-4 left-1/2 -translate-x-1/2`. `AppToast` types `success | error | warning | info`. Success/info auto-dismiss (~2.6–4s). **Error toasts stay until the operator dismisses them** (X). `showAppFeedbackToast` uses `durationMs: 0` for errors.

## Base Info icons

Store `<i data-lucide="IconName"></i>` in `ui_html`. Render `BaseInfoUiIcon`.

## Tokens / files

`heroFieldSize.ts` · `formChoiceLayout.ts` · `formTabOrder.tsx` · `HeroFieldControls.tsx` · `surfaceClasses.ts` · `AppRouteLoading.tsx` · `AppToast.tsx` · `FloatingPanelShell.tsx` · `useShellNavigate.ts` · `shellNavigationPending.ts`

**IDs:** `ui.base-components.first`, `ui.heroui.*`, `ui.component.default-size`, `ui.where-builder`, `ui.copy.english-only`, `ui.content.labels-via-cultures`, `ui.form.*` (field/settings/section), `ui.form.tab-order.fields-only`, `ui.form.section.write`, `ui.page-guide.hints`, `ui.shell.loading-alive-surface`, `ui.admin-shell.*`, `ui.admin-shell.geometry-lock`, `ui.admin-shell.header-hints`, `ui.responsive.selective`, `ui.overlay.directional-motion`, `ui.floating-panel.border`, `ui.canvas.viewport-controls`, `ui.feedback.toast.*`, `data.base-info.ui-html.icon-format`.
