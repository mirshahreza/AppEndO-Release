# Component Designer — storage and public identity

> **Shard:** `component-designer` · **URL:** [`deep-linking.md`](./deep-linking.md) · **Vocab pages:** [`package-base-info-vocab.md`](./package-base-info-vocab.md)

## Operator identity (catalog UX)

Operators identify components by **name** (and optional **catalog tags**). Folder is storage-only (`general`) and must not appear in titles, URLs, create/rename dialogs, or list sort/filter chrome.

- **Create:** catalog toolbar **Create** is an `AppSplitButton` dropdown: **CRUD Set**, **Based on Templates** (no Start-step kind cards; Empty is parked, not a catalog Create option). Kind is chosen on the button; the wizard opens on that kind. Last step is always name + optional tags. **CRUD Set** follows [`crud-set.md`](./crud-set.md) / `CrudSetSpec`: the wizard **only sets `CrudSet` props** (collection mode first, then list API / columns / creates / patches / delete / export, then name). Living sample is Base Components → CRUD Set. API Connected Form / Grid / CRUD Set stay in code but are not catalog Create options. Name is required before opening Live Designer. Step tabs follow `stepTabColor` (wizard default `theme`).
- **Tags:** `CatalogTagsField` (Base Components Chip + Combobox / Tags list). Previous catalog tags are suggested after you type (`UiCombobox` `menuTrigger="input"`); press Enter to create a new tag. Inside Client Components `DesignerDialog` (native `<dialog>`), the combobox uses an in-tree listbox so suggestions stay attached to the field. Open **Tags** from the catalog card (no footer — each add/remove saves immediately) or set tags on create/rename. Type markers are **footer text badges** next to the date, same chrome as Server Functions (`DevelopmentCatalogCardFooter` `badge` + `CatalogSystemTagBadge` / `BuiltInBadge` — not title-row dots): **builtin** amber, **template** cyan, **shell** indigo, **custom** emerald. Built-in cards show only `BuiltInBadge` (type is not a second badge); operator drafts and installed package UI show the type badge (`custom` / `shell` / `template`). Do **not** show operator-tag chips or package-source badges (no `cms` / package-name text on the card). Search matches name and kind.
- **Catalog list:** one flat list of **saved components** (operator drafts + installed package UI). Do not split the catalog into Templates / tag headings. **Templates** are copy sources (`blog-list`, `contact-form`, …) in the virtual `templates` folder — Create → Based on Templates copies that starter’s **layout nodes** (heading, cards, form fields, …) into a named component. Do not leave a single composite template widget (`content.feature-grid`, `marketing.hero-cta`, …) as the new document. Saved drafts tagged `template` (or any other tag) remain editable. **Shells** are live portal skins (`app-shell`) in the main catalog folder (`general`), not templates. Clicking a card title opens Live Designer for **every** component, including built-in starters, templates, and shells; the first save writes an editable overlay draft under the same name (the built-in catalog row is then hidden). Duplicate still copies to a new name. Delete stays off for built-ins and package UI. The catalog kind filter is a toolbar `ToolbarFilterSelect`: **All** (default, no filter), **Custom**, **Shell**, **Template** — type only. **BuiltIn** is `ToolbarBuiltInFilter` (**All** default, **BuiltIn**, **Not BuiltIn**) and does not mix with type. An item is listed when All is selected for type, or when its type matches the selected kind; BuiltIn further restricts by `isBuiltIn`. Search still matches tags. Catalog footer paging is locked at **1000** per page — no page-size dropdown and no paging/infinite switch; sort controls stay.
- **Rename / tags:** from the Client Components catalog list (not inside Live Designer), including built-in cards (first save/tag writes the overlay draft).
- All drafts persist under `workspace/designer/drafts/general/`. `portal-layouts` is a virtual portal shell prefix (`designer:portal-layouts/{name}`), not a disk folder.

## Admin shell template (`app-shell`) — geometry locked

Built-in portal chrome comes from `ADMIN_SHELL_LAYOUT_TEMPLATE` (`adminShellLayoutTemplate.ts`) plus runtime slots (`buildShellRuntimeSlots`, `DesignerPublishedShellChrome`). **Sidebar/header/logo spacing and widths are locked** — same rule as Studio `AdminLayout` / `AdminShellSidebar`. Agents must not retune shell node `className` heights, padding, or slot order in the template or `ensureShell*` migrators without operator approval. Full list: [`ui-core.md`](./ui-core.md) §Admin shell geometry lock · ID `ui.admin-shell.geometry-lock`.

## Canonical component identity (runtime / API)

Outside the Component Designer workspace, **components are identified by name**. Disk files live under `workspace/designer/drafts/general/`. Folder-qualified paths (`general/{name}`, `portal-layouts/{name}`) collapse to the component name.

Use the component **name** for:

- Editor URLs (`client-components/edit/{name}`)
- Runtime preview URLs (`?component={name}` or legacy `?component=general/{name}`)
- Component-designer API lookups from other features

Use the component **name only** (no folder) for experience manifest `pageKey` when the platform contract requires a single slug segment (`^[a-z][a-z0-9-]{1,63}$`).

Never surface internal draft/version identifiers (for example `draft-…` ids from the designer index) in URLs, manifests, portal wiring, or user-visible labels outside the designer.

## Drafts are designer-internal

The designer **draft index**, **draft id**, **version history**, and **snapshot** storage are implementation details of `src/features/component-designer/` and `src/server/domain/component-designer/`.

- Draft ids exist for designer persistence, locking, and workspace state only.
- Other features must load components by **name** (via the component-designer API or on-disk name-based files), not by draft id.
- Do not add `?draft=` query params, manifest keys, or navigation entries keyed by draft id.
- Catalog **tags** live on the draft record / index summary — not in the `.meta.json` export sidecar.

## Workspace assets

Custom images and files used by designer components and packages must live in the workspace assets folder:

- **Disk:** `workspace/assets/`
- **Runtime URL:** `/assets/workspace/<relative-path>`
- **Package entry:** `assets/workspace/<relative-path>`

Reference that URL in component image `src` values. Package Builder auto-detects `/assets/workspace/...` references and packs them with the portal.


Preview must target the saved component file:

1. User saves the component in the Live Designer workspace.
2. Preview opens with `component={normalized-name}` (legacy `component=<folder>/<name>` still resolves).
3. The preview loader resolves the component by name on the server via `GET /api/component-designer/drafts/by-path?path=…` or `GET /api/component-designer/drafts/:name` (never put slashes in `/drafts/:id` path segments).

Unsaved in-memory edits use the short-lived `session` preview path only inside the designer flow; that path is also designer-internal.

## Editor surface

Client Components has one editor: **Live Designer**.

| Mode | URL |
|------|-----|
| Catalog list | `client-components` |
| Editor | `client-components/edit/{name}` |

Classic `client-components/{folder}/{name}`, `client-components/live-designer/…`, `client-components/edit/{folder}/{name}`, and `client-components/new` redirect to the canonical editor or the list. Do not reintroduce a parallel canvas editor. Shell header: `{nav group} / Client Components / Edit`; content header shows `{name}`.

The Live Designer editor AI chat (Sparkles toggle, docked right) matches Server Functions: Ask proposes a layout JSON for Apply; Agent drafts via `draft_component_layout` / designer tools and writes the document onto the canvas. Nothing is saved until **Save**.

Canvas size (preset, corner-resize, or **100% height**) is remembered **per component name** in browser `localStorage` (`appendo:designer:viewport:{name}`). The corner grip includes a 100% height toggle (`fillMode: fill-height`) that fills the designer area vertically while keeping width fixed; click again or drag the grip to restore a fixed height. Last chosen size restores on reopen without a save. Do not key this by draft id.

## Route propagation

Auto-propagated studio routes register `pageKey` / `loaderRef` with the **component name**. Renaming or deleting a component must disable routes registered under the previous name.

## Package Base Info vocabulary pages

Do not duplicate the Base Info create/edit form in designer scaffold. Full rules: [`package-base-info-vocab.md`](./package-base-info-vocab.md) (`form.base-info-record` + injected `DataSourceDefinition.operations`).

## Toolbox ⊆ Base Components

The Live Designer Toolbox is **derived from** `/studio/base-components` — not a parallel list. Groups, section order, and labels come from `BASE_COMPONENTS_NAV_SECTIONS`. Identity only maps a section onto a droppable palette item. One concept has one `componentId` (catalog section), one public `paletteItemId` (or several D8 tools under the same section), and one exported runtime (`CrudSet`, `RecordForm`, `UiTabs`, …). **Toolbox labels are the Base Components section titles** (`Grid`, not `App Table Grid`). **Properties are read from that catalog** (`public-prop` + `composition-prop` via `compileInspectorFromCatalog`) — Designer does not keep a second component-prop list. Property accordion groups come from `option.inspectorGroup` / `resolveCatalogInspectorGroup` (the same FormSection titles as the lab). Writes go through `propPath` onto `node.props` (CRUD Set keeps `node.props.spec` as `CrudSetSpec`). CRUD Set Properties uses the same accordion as the Base Components lab (Body / Paging / Columns / Dialogs / Toolbar / Records chrome / **APIs**). APIs is a production group (list / read-one / creates / patches / delete endpoints) — the lab may show demo fixtures in that group; Designer binds real endpoints. Columns is one shared `CrudSetColumnList`. Other sections use the same shared living widgets (`CrudSetGridFields`, `CrudSetPagingFields`, `CrudSetDialogFields`, …). Lab-only Relations fixtures and display State stay off the Designer. Binding keys are those options with `axis: 'data'` (or a non-fixture `data-editor`). Merge losers stay in the catalog as `legacy: true` so old drafts still resolve. Shell / platform slots stay out of the public Toolbox. Landing / marketing blocks stay parked.

**IDs:** `component-designer.toolbox-catalog-subset`.

## Page guide sidecar

Generated client/visual pieces must carry enough sidecar for the studio page guide:

- Auto-form / auto-CRUD: `buildControlProps` always sets `hint` from the field label and type.
- Runtime preview and exported TSX wrap nodes that have `label`/`title` plus `hint` with `data-page-guide*`.
- Inspector: **Page Guide Hint** on form controls. Agents set it with `designer_set_prop({ propKey: "hint", value: "…" })` after a manual insert.
- Do not leave new fields with only a placeholder.

**IDs:** `component-designer.public-component-name`, `component-designer.page-guide.sidecar`, `component-designer.toolbox-catalog-subset`, `package.base-info-vocab.shared-form`.
