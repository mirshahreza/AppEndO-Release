# UI dialogs and modals

> **Shard:** `ui-dialog`  
> **Tokens:** [`ui-design-system.md`](./ui-design-system.md) · **Forms:** [`ui-core.md`](./ui-core.md)  
> **Living sample:** Base Components → Dialog / create-edit / confirm / wizard.

## Intent

One dialog anatomy for admin, designer, wizards, access, and destructive confirms.

## Admin dialog anatomy
- Primitives: `AppDialogShell`, `DialogPrimaryHeader`, `DialogBand`, `DialogBody`, `DialogFooter` in `src/shared/ui/dialog/`; tokens `DIALOG_*` in `surfaceClasses.ts`.
- **Backdrop:** `admin` (`CREATE_EDIT_MODAL_BACKDROP_CLASS`) for admin UI; `designer` (native `::backdrop`) on `/client-components` only. Admin / create-edit / confirm / wizard div overlays may set `backdropTint`, `backdropBlur`, and `backdropTransparency` (see Overlay backdrop dim, blur, and transparency).
- **PrimaryHeader:** fixed `h-10`; title + optional icon-only `headerExtra` (`AppButton` `size="icon-sm"`, 0–3) + Close rightmost (`AppButton closeIcon`) when `showCloseButton` is true. Hide Close when the operator must finish via footer actions.
- **Band:** `muted` | `elevated` | `shell` secondary strips.
- **Body:** inner `bg-white p-[15px]`; optional outer gradient.
- **Footer:** ActionFooter last with primary actions (`AppButton` `size="sm"`); surface `DIALOG_FOOTER_SURFACE_BG_CLASS` (`bg-slate-100/90`) via surface chrome or shared footer tokens; every labeled footer button includes a leading Lucide icon (`h-3.5 w-3.5`) — `ConfirmDialogShell` defaults cancel=`X`, confirm by intent.
- Reference: Base Components → Dialog (`/studio/base-components/dialog`).

## Create/Edit modal shell
- Reuse `CreateEditModalShell` or `CREATE_EDIT_MODAL_*` constants in `surfaceClasses.ts`.
- Main form container: `bg-white`, `p-[15px]`; header `bg-slate-50/80`, footer `DIALOG_FOOTER_SURFACE_BG_CLASS` (`bg-slate-100/90`), edge-aligned.
- Pass `size`: `auto`, `sm`–`5xl`, `maximized`, or `full`.
- **`maximized`:** 16px inset (`p-4` backdrop), keeps `rounded-xl` + border.
- **`full`:** edge-to-edge viewport; no outer margin.
- **Markdown / HTML / code editor dialogs** (`MarkdownEditDialog`, `HtmlEditDialog`, and any Monaco/code edit modal): default `size="maximized"` so the editor fills the viewport with the 16px inset. Do not cap height with `h-[85vh]` on those shells — that overrides maximized via class merge. Use `CONTENT_EDITOR_DIALOG_SHELL_CLASS` (`flex min-h-0 flex-col overflow-hidden`). A smaller `size` is allowed when the opener passes it explicitly; then `CONTENT_EDITOR_DIALOG_SIZED_SHELL_CLASS` (`h-[85vh]`) applies.
- Body slot edge-aligned (`-mx-[15px]`); inner host `CREATE_EDIT_MODAL_BODY_INNER_CLASS`.
- Gradient tokens in `src/index.css` (`--color-surface-modal-gradient-*`).
- Blur-based backdrop required; never white overlay behind dialog surface.

## Overlay backdrop dim, blur, and transparency

Applies only to overlays with a page scrim: Dialog (`admin` kind), Create/Edit, Confirm, Wizard.

- **Dim** (`backdropTint`): `faint` (`bg-slate-900/12`) · `light` (`/25`) · `medium` (`/40`).
- **Blur** (`backdropBlur`): `soft` (`backdrop-blur-[2px]`) · `default` (`backdrop-blur-[4px]`).
- **Transparency** (`backdropTransparency`): `opaque` · `soft` (`opacity-70`) · `clear` (`opacity-40`). Applied on a dedicated scrim layer so the dialog surface never fades.
- Compose with `resolveDialogBackdropLayoutClass` + `resolveDialogBackdropScrimClass` when tint, blur, or transparency is passed. Named production profiles stay exact class strings when omitted: `admin` = medium+default+opaque, `adminLight` = light+default+opaque, `adminSoftBlur` = medium+soft+opaque, wizard = faint+default+opaque (`STEP_WIZARD_BACKDROP_CLASS`).
- Do not add `none` or 8px+ frost. Designer native `::backdrop` stays the fixed 12% + 4px recipe. Popover, tooltip, and floating panel have no page scrim.

## Enabled-gated configuration modals
- Follow `IdentityProviderFormModal` (`src/features/settings/components/identityProviders/IdentityProviderFormModal.tsx`).
- **Enabled** first in top band (`-mx-[15px] -mt-[15px]`, `border-b border-slate-200 bg-slate-50/80 px-[15px] py-3`).
- Secondary booleans in second band; dim (`opacity-60`) when `enabled` is off.
- Remaining fields in `<fieldset disabled={!form.enabled}>`.
- New creates default `enabled: false`.
- Errors: rose banner at body top.
- Reference: `MountFormModal` in `PlatformFormModals.tsx`.

## Access control modal
- Use `AccessControlModal` + `FunctionAccessControl`; no parallel access UIs.
- Shell: `CreateEditModalShell` `size="maximized"`; mode option cards (`UiOptionCardGroup`); four allow/deny columns; `AccessEntityPickerDialog`.
- Platform auth: `PlatformRouteBindingAuth`; parse legacy at boundaries via `parsePlatformRouteBindingAuth`.
- Opener icon: `AccessControlActionIcon` (`KeyRound`); grid: `GRID_ACTION_ACCESS_CLASS`.
- Reference: `ServerFunctionsPageView.tsx`, `PortalAccessModal.tsx`, `McpServersSection.tsx`.

## Component Designer (`/client-components`)
- All dialogs via `DesignerDialog` + `HTMLDialogElement.showModal()`.
- Class `designer-dialog-native`; blur only on native `::backdrop` in `src/index.css`:
  - `background-color: rgba(15, 23, 42, 0.12);`
  - `backdrop-filter: blur(4px);` (light blur only — no `blur(8px+)`).
- Forbidden: div overlays, opaque scrims, heavy frosted glass.
- Body: `bodyClassName="!bg-white !p-0 -mx-[15px]"`; inner `bg-white p-[15px]`.
- Reference: `NewLayoutDialog.tsx`, `DesignerDraftDialog.tsx`.

## Step wizard
- Use `StepWizardShell` + `STEP_WIZARD_*` tokens.
- Backdrop: `STEP_WIZARD_BACKDROP_CLASS` (`bg-slate-900/12 backdrop-blur-[4px]`) — visually aligned to DesignerDialog native `::backdrop` (phase 14). Remains div-based (full `<dialog>` merge is out of scope). Do not use admin `CREATE_EDIT_MODAL_BACKDROP_CLASS` (40%) for wizards.
- Shell border: single definition via `CREATE_EDIT_MODAL_SHELL_CLASS` only — do not also apply `DIALOG_SHELL_CHROME_BORDER_CLASS`.
- Default `size="5xl"`; fixed height `h-[85vh] max-h-[92vh]`. `size="maximized"` uses the 16px-inset create/edit maximized shell (`h-[calc(100vh-32px)]`) instead of that 85vh cap.
- Layout: title → step indicators → description band → white body → footer.
- Description band (header 3): one shade darker than the step-indicator band (`STEP_WIZARD_DESCRIPTION_SURFACE_CLASS`, `bg-slate-200/50`). Do not reuse `chrome.headerBand` on this strip. No tram or background pattern.
- Step tabs: `stepTabColor` on `StepWizardShell` — default `theme` (accent wash on selected and unselected; **titles and step icons use darkened theme ink** `--app-nav-group-header-text` / `STEP_WIZARD_HEADER_TITLE_INK_CLASS`, not bright `--app-accent-700`), `gray` (slate/nav), or `{ selected, unselected }` hex pair. Wizard dialog title uses the same darkened ink (`STEP_WIZARD_HEADER_TITLE_TEXT_CLASS`).
- Final submit via `footerExtra` (`intent="primary"`); block advance with `onNext` → `false`.
- Reset state whenever a wizard opens.
- **Exception:** `DesignerPreviewDialog` stays a separate floating/animated shell without modal backdrop (live preview panel, not a blocking modal).

## Wizard / create form sections (flat — no panel boxes)

Form grouping rules: [`ui-core.md`](./ui-core.md) §Form sections. Wizards and create/edit modals use the same flat `FormSection` + `FormField` as Portals → Edit portal and `UserCreateWizardModal`.

- **Forbidden** in wizard/create-edit **and** Settings config: `rounded-md border …` panel boxes, per-row tinted cards, `AppSurfaceBox` around field groups.
- **Allowed:** bordered shells for **data** hosts only (grids, JSON areas).
- `AppSurfaceBox` is for workspace/tool panels — not form sections.
- Settings details: [`ui-core.md`](./ui-core.md) §Settings forms.
- Reference: `PackageBuilderModal.tsx`, `UserCreateWizardModal.tsx`, `AuthSettingsFields.tsx`.

## Record editor workspace + create identity
- Full-page record editors: white main column with flat semantic `FormSection`s and a separate action bar. The **read-only inspector** is [`ui-inspector-rail.md`](./ui-inspector-rail.md) (Idea Foundry `IdeaFoundryViewRail.tsx`) — not `FormSection` / `MetaField`. Do not put a bordered card around each **form** section.
- Data Studio **Column Properties** dialogs still use a left form / right summary split ([`data-studio-modeler.md`](./data-studio-modeler.md)); that is not the page inspector recipe.
- If type/locale/format determines the editor/schema, collect those values in a create dialog,
  POST first, then navigate to `{list}/edit/{id}` from the response. Do not open a fake
  `edit/new` editor.
- Item identity title lives in the content header ([`deep-linking.md`](./deep-linking.md)). Do not duplicate it in the inspector. An identity-edit dialog may expose mutable values;
  a format/kind that selects the editor component remains read-only and locked after create.

## Create/Edit modals with a flex-growing body host

Use when a dialog has a **checklist, grid, or list** that must stretch to the footer (no dead gutter, no orphan grid column).

### Required flex chain

1. **Shell** — give the dialog a minimum height and column flex:
   - `shellClassName="flex min-h-[min(520px,72vh)] flex-col overflow-hidden"` (or `size="maximized"` for full workspace modals).
2. **Body** — inner host must grow and allow children to shrink:
   - `bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden !min-h-0"`.
3. **Fixed bands** — route preview, form rows, errors: `shrink-0`.
4. **Growing section** — `FormSection` with `className="flex min-h-0 flex-1 flex-col"`.
5. **Scroll host** — one bordered data shell: `flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200`; scroll **inside** with `min-h-0 flex-1 overflow-y-auto p-3`.

### Forbidden patterns (cause empty column / dead space)

- `AppSurfaceBox fill` inside `CreateEditModalShell` without the flex chain above — `fill` sets `flex-1` but the parent body is not a bounded flex column, so the box leaves an empty gutter.
- Duplicate section titles — `AppSurfaceBox title` **and** an inner editor header (e.g. “OUTPUT FIELDS” twice). Use `FormSection` + `embedded` on the editor.
- Fixed multi-column checkbox grids (`lg:grid-cols-3`) for short lists — leaves orphan empty cells. Prefer `flex flex-wrap gap-2`.

### Reference implementations

- `ConfigureDataApiDialog.tsx` — single-page API configure modal.

## Danger / destructive confirmation dialogs
- Use `ConfirmDialogShell` (admin) or `DesignerDialog` with `tone="danger"` (component designer).
- **Header:** always rose-tinted band (`border-rose-200 bg-rose-50/80`, title `text-rose-800`, icon `text-rose-600`); tokens `DIALOG_PRIMARY_HEADER_DANGER_*` in `surfaceClasses.ts` via `DialogPrimaryHeader` `tone="danger"`.
- `ConfirmDialogShell` defaults to `tone="danger"` when `confirmIntent` is `destructive`; override with `tone="default"` for warning/unlock flows.
- **Body:** flat typography on white — no nested `rounded-md border bg-*` panel boxes around the message; hierarchy via font size/weight only (question → warning line → entity name/path in `font-mono`).
- English copy in RTL locales: wrap body in `dir="ltr"` + `text-start` to avoid bidi punctuation glitches.
- **Footer:** `Cancel` (`X` icon) + destructive confirm (`Trash2` icon); reference `ServerFunctionDeleteModal.tsx`.
- Alias shard: [`confirmations.md`](./confirmations.md). Reference: `ConfirmDialogShell.tsx`, `ServerFunctionDeleteModal.tsx`, `DesignerDeleteComponentDialog.tsx`.

**IDs:** `ui.dialog.*`, `ui.form.create-edit.*`, `ui.form.record-editor.workspace`, `ui.form.access-control.modal`, `ui.wizard.*`, `ui.form.flat-sections-no-boxes`, `ui.dialog.flex-growing-body`, `ui.form.create-edit.content-editor-dialog`, `ui.destructive.confirmation.*`. Inspector rails: `ui.inspector-rail.*` in [`ui-inspector-rail.md`](./ui-inspector-rail.md).
