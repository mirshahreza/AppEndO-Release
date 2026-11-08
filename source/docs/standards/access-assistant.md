# Access Assistant

> **Shard:** `access-assistant`  
> **Wizard chrome:** [`ui-dialog.md`](./ui-dialog.md) §Step wizard · **Controls:** Base Components only — no raw HTML form controls.

## Intent

Contextual **Allowed** toggles for server functions on the **current page**, for ADMIN and DEVELOPER — not Record Policy, not deny/tri-state in this UI.

## Entry

- **Studio tools** menu in the shell header on **`lg+` only** (`ShellHeaderPageActions` beside the page title) — hidden on phone/tablet compact chrome; not duplicated in the utility cluster (`StudioToolsMenu`).
- The **same menu** (`StudioToolsMenu` · `variant="window"`) appears in **floating panel** and **modal** primary headers (`FloatingPanelShell`, `DialogPrimaryHeader` / `CreateEditModalShell`, `StepWizardShell` title band) via `WindowChromeStudioToolsMenu` registered through `StudioToolsHostProviders` on **AdminLayout**, **AppShell**, and **DesignerPublishedShell** chrome; page context is the current route `pageKey` + `pageTitle`.
- Items: **Access Assistant** · **Edit component** (designer `loaderRef` → pinned component name; package `hawiety:{pageKey}` → Client Components slug: drop `-view` / `-edit`, then drop leading `hwy-`, e.g. `hwy-member-dossier-view` → `member-dossier`; Live Designer auto-creates a blank draft on first open when missing; core modules → disabled + hint).

## Gate and exclusions

- **Roles:** `isAdminUser` or `DEVELOPER`.
- **Pages:** all eligible `pageKey`s except navigation under **Development** and **Extensions** (`navigation/studio.json` ancestry) — menu hidden or disabled with English tooltip.
- **No manifest / derive:** disabled · «No access map for this page — use Server Functions».

## Data and save

- Per-page manifest: `workspace/access-assistant/pages/{pageKey}.json`, or runtime derive from designer/package draft bindings.
- **Save:** `PUT /api/access-assistant/context` — merges **manifest function ids only**; other entity ACL entries unchanged.
- **Semantics:** checkbox off = `none` (not explicit deny). Deny lists stay on Server Functions / technical access panels only.

## API

- `GET /api/access-assistant/eligibility?pageKey=`
- `GET /api/access-assistant/context?pageKey=&entityKind=&entityKey=`
- `PUT /api/access-assistant/context?pageKey=`

**IDs:** `platform.access-assistant.*`

## Wizard shell

- `StepWizardShell` · `size="5xl"` · title **`Configuring access for: {pageTitle}`** · `titleIcon={KeyRound}`.
- Reset all wizard state when `open` becomes false.
- Body: `bodyInnerClassName` = `flex min-h-0 flex-1 flex-col !overflow-hidden` so step content owns vertical scroll.
- Final action: **Save access** (primary) on last step · block step 2 until subject chosen.

## Step 1 — Subject

- Pick **one** user **or** one role (not both).
- **Subject type:** two-up option cards (`sm:grid-cols-2`) — same pattern as other wizards: bordered tile, primary ring when selected, check badge top-end. Tokens: `ACCESS_ASSISTANT_SUBJECT_TYPE_GRID_CLASS` · `resolveAccessAssistantSubjectTypeCardClass`.
- **Picker:** search field + bordered list that **fills remaining body height** (`flex-1 min-h-0 overflow-y-auto` on list host).
- **Rows:** full-width `button` rows inside list — **not** `UiCheckboxChoice`. Selected row = `bg-primary-subtle/50` + trailing `Check` icon. Tokens: `ACCESS_ASSISTANT_PICKER_LIST_CLASS` · `resolveAccessAssistantPickerRowClass`.
- Exclude ACL-bypass users/roles per `functionAccessBypass` helpers.

## Step 2 — Access (functions)

- Load surfaces from context API (root then linked surfaces, manifest order).
- **Layout:** scrollable body · **`md:grid-cols-2`** surface grid (`ACCESS_ASSISTANT_SURFACE_GRID_CLASS`) so sparse sections (one function each) share a row — do **not** stack every section full-width when content is small.
- **Section title:** uppercase compact label (`ACCESS_ASSISTANT_SECTION_TITLE_CLASS`) — distinct from row title typography.
- **Function rows:** same **picker-row** interaction as Subject step (click toggles allowed, `aria-pressed`, trailing check when allowed) — **never** place `UiCheckboxChoice` beside free text in a flex row (`w-full` on choice rows causes overlap).
- **Row content:** human title from blurb when it differs from slug/name · optional slug subtitle · HTTP method badge (semantic Color-it on badge only) + monospace path. Helpers: `resolveAccessAssistantHttpMethodBadgeClass`.
- **Non-editable** rows: `disabled` + reduced opacity; do not fake a separate «Allowed» label that contradicts the control.
- **Admin bypass subject:** body copy only — Save disabled.

## Function blurb

- Server: richest metadata (OpenAPI description → summary → name), truncated (~160 chars) via `resolveFunctionBlurb` / `truncateBlurb`.

## Manifest maintenance

- Core pages: declarative JSON in workspace — **all** linked surfaces (list, create, edit modals, grid actions) for that page. Shipped baseline: `users` and `roles`; add `{pageKey}.json` on demand for other core modules.
- Designer/package: derive from draft bindings; optional workspace override.

## Related surfaces (do not duplicate)

- Record Policy · org/geo scope · MCP grants → their own shards/modals.
- Full tri-state entity access → `AccessControlModal` / Server Functions admin — not this wizard.

## Implementation map

| Piece | Path |
|-------|------|
| Menu + gate | `src/features/access-assistant/components/StudioToolsMenu.tsx` |
| Wizard | `src/features/access-assistant/components/AccessAssistantWizard.tsx` |
| Subject step | `…/AccessAssistantSubjectStep.tsx` |
| Access step | `…/AccessAssistantAccessStep.tsx` |
| Shared wizard tokens | `src/features/access-assistant/lib/accessAssistantWizardChrome.ts` |
## Agent skill

Load [`.claude/skills/appendo-build-access-assistant/SKILL.md`](../../.claude/skills/appendo-build-access-assistant/SKILL.md) when building or revising Access Assistant UI/API/manifests.
