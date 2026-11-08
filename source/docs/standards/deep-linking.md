# Nested editor deep linking

> **Shard:** `deep-linking`  
> **Back control:** [`ui-toolbar.md`](./ui-toolbar.md) §Workspace back  
> **Inspector:** [`ui-inspector-rail.md`](./ui-inspector-rail.md)  
> **Helpers:** `src/shared/routing/nestedEditorDeepLink.ts` · overlay query sync `src/shared/routing/workspaceOverlayDeepLink.ts` · `useWorkspaceOverlayDeepLink`

## Intent

Studio list → item uses one URL shape, one shell title, and one content-header role.

Floating panels (`FloatingPanelShell`) and modal shells (`CreateEditModalShell`) on the same route use the **`overlay` query param** — see [Workspace overlays](#workspace-overlays) below.

## MUST

### Address bar

```text
/{culture}/{portal}/{page}
/{culture}/{portal}/{page}/edit/{item…}
```

Folder-scoped: `{page}/edit/{folder}/{name}`. Literal `edit` is required. Query string must not carry item identity.

| Surface | List | Edit |
|---------|------|------|
| Idea Foundry | `idea-foundry` | `idea-foundry/edit/{id}` |
| Workflows | `workflows` | `workflows/edit/order-approval` |
| Server Functions | `server-functions` | `server-functions/edit/auth/login` |
| New Server Function | — | `server-functions/edit/new` |
| Client Components | `client-components` | `client-components/edit/{name}` |
| Workbooks | `workbooks` | `workbooks/edit/{id}` |
| Data Studio | `data-studio` | `data-studio/edit/{objectName}` |
| Sftp | `sftp` | `sftp/edit/{key}` |
| SSH | `ssh` | `ssh/edit/{key}` |
| RDP | `rdp` | `rdp/edit/{key}` |

Emit only these shapes. `LegacyAdminUrlResolver.ts` redirects retired URLs; new code must not depend on them.

### Shell header

| Surface | Title |
|---------|--------|
| List | `{nav group} / {page label}` |
| Nested editor (item) | `{nav group} / {page label} / Edit` |
| Connection session (Sftp, SSH, RDP) | `{nav group} / {page label} / Session` |

Group always present. The extra mode segment is required on list→item deep links so the main header is not identical to the list. Use **Edit** for authoring surfaces; use **Session** for live connection hubs (file browser / terminal / remote desktop). No folder or item identity in the shell title — that stays in the content header.

Hook lives on the **page/workspace**, not inside a nested editor panel. Leave `groupLabel` unset so nav group is kept. Builder: `buildNestedEditorShellHeaderOverride` (default `Edit`; hubs pass `NESTED_EDITOR_SHELL_SESSION_LABEL`; pass `modeLabel: null` only for singleton pages that are not list→item).

### Content header (editors only)

`WorkspaceBackIcon` + **item identity title** + actions (+ optional technical subtitle).

| Feature | Item title | Do not use |
|---------|------------|------------|
| Idea Foundry | idea `title` | UUID in the shell title |
| Workflows | `definition.key` | `WorkflowModel.name` |
| Server Functions | function `name` | folder segment as the title |
| Data Studio | `objectName` | model `id` |
| Client Components | component `name` | folder, incidental draft display names |
| Workbooks | workbook `name` | UUID in the shell title |
| CMS Contents | truncated `title` + `#id` | shell item segment |

## NEVER

- Alternate URL shapes (`workflow-designer/{key}`, `data-studio/{objectName}` without `edit`, …).
- Item identity (folder, key, id, object name) in the main shell title.
- `groupLabel: null` on the header override.
- Ad-hoc back buttons — only `WorkspaceBackIcon`.

## New list→edit checklist

1. Build/parse via `buildNestedEditorEditRelativePath` / `resolveNestedEditorItemSlug`.
2. Select updates URL; unknown slug redirects to list; rename uses `replace: true`.
3. Route binding: list exact + edit splat.
4. Workspace-level shell hook (`{page} / Edit` or `{page} / Session` trail; no item identity).
5. Content header identity + `WorkspaceBackIcon`.
6. Tests: builders, shell trail, list↔edit, legacy redirects if retiring a shape.

Package Phase 3 editors must follow this shard ([`package-ui.md`](./package-ui.md)). Read-only inspectors beside the editor body follow [`ui-inspector-rail.md`](./ui-inspector-rail.md) (gold: Idea Foundry).

**IDs:** `routing.nested-editor.deep-link`, `routing.nested-editor.shell-header`, `routing.nested-editor.implementation-checklist`.

## Workspace overlays

Secondary UI on an already-routed page (floating studio windows, create/edit modal shells, maximized configure dialogs) must be **bookmarkable** without moving primary item identity off the path.

### Address bar

```text
/{culture}/{portal}/{page}/edit/{item…}?overlay={token}
/{culture}/{portal}/{page}?overlay={token}
```

| Rule | Detail |
|------|--------|
| Query param name | `overlay` only (`WORKSPACE_OVERLAY_QUERY_PARAM`) |
| Token shape | Lowercase segments separated by `/` — e.g. `panel/designer`, `dialog/create`, `panel/sql/VIEW/v_orders` |
| Primary identity | Still **path only** (`…/edit/{item}`). Never encode the main list→edit slug solely in `overlay`. |
| Extra identity in overlay | Allowed when the page is still the **list** route and the overlay targets one explorer row (SQL/Run panels on Data Studio list). Use `{panelKind}/{objectKind}/{objectName}`. |
| Sync | `useWorkspaceOverlayDeepLink` — URL→open on load; UI close clears `overlay`; front-most floating panel wins when multiple are open. |
| Helpers | `workspaceOverlayDeepLink.ts` · per-feature token catalogs (e.g. `dataStudioWorkspaceOverlay.ts`) |

### Reference implementation

**Data Studio** (`useDataStudioWorkspaceOverlayDeepLink`): modeler route tokens `panel/designer`, `panel/datasheet`, `panel/relations`; list route `dialog/create-object`; list SQL/Run `panel/sql/{kind}/{name}`, `panel/run/{kind}/{name}`.

### Adoption checklist (new or existing workspace)

1. Register stable overlay tokens (document in feature shard or `*WorkspaceOverlay.ts`).
2. Wire `useWorkspaceOverlayDeepLink` with `activeToken` from panel managers / modal `open` state.
3. Implement `openFromUrl` (resolve row/context from path + catalog before opening).
4. Emit links via `buildHrefWithWorkspaceOverlay` / home-widget `query` when sharing shortcuts.
5. Tests: token builders/parsers + one URL↔open integration test where cheap.

### Wired surfaces (reference)

| Area | Token catalog / hook |
|------|----------------------|
| Data Studio list + modeler panels | `dataStudioWorkspaceOverlay.ts` · `useDataStudioWorkspaceOverlayDeepLink` |
| Data Studio modeler dialogs | `dataStudioModelerOverlay.ts` · `useDataStudioModelerOverlayDeepLink` |
| Workflows list + designer | `workflowsWorkspaceOverlay.ts` · `useWorkflowsListOverlayDeepLink` · `useWorkflowEditorOverlayDeepLink` |
| Workbooks | `workbooksWorkspaceOverlay.ts` · `useWorkbooksWorkspaceOverlayDeepLink` |
| Server Functions | `serverFunctionsWorkspaceOverlay.ts` · `useServerFunctionsOverlayDeepLink` |
| Users | `usersWorkspaceOverlay.ts` · `useUsersOverlayDeepLink` |
| Live designer | `liveDesignerWorkspaceOverlay.ts` · `useLiveDesignerOverlayDeepLink` |
| SQL Console | `sqlConsoleWorkspaceOverlay.ts` · `useSqlConsoleOverlayDeepLink` |
| SSH / Sftp / RDP hubs | `remoteHubWorkspaceOverlay.ts` · `useRemoteHubOverlayDeepLink` |
| CrudSet (all list pages) | `crudSet/crudSetWorkspaceOverlay.ts` · `useCrudSetOverlayDeepLink` in `CrudSet.tsx` |
| Roles | `rolesWorkspaceOverlay.ts` · `useRolesOverlayDeepLink` |
| Users | `usersWorkspaceOverlay.ts` · `useUsersOverlayDeepLink` |
| Settings · AI models | `settingsAiModelsOverlay.ts` · `useSettingsAiModelsOverlayDeepLink` |
| Settings · Cultures | `settingsCulturesOverlay.ts` · `useSettingsCulturesOverlayDeepLink` |
| Settings · MCP servers | `settingsMcpServersOverlay.ts` · `useSettingsMcpServersOverlayDeepLink` |
| Settings · Identity providers | `settingsIdentityProvidersOverlay.ts` · `useSettingsIdentityProvidersOverlayDeepLink` |
| Settings · Attributes | `settingsAttributesOverlay.ts` · `useSettingsAttributesOverlayDeepLink` (`dialog/edit/{id}`, `dialog/delete/{id}`) |
| Settings · Web fonts | `settingsWebFontsOverlay.ts` · `useSettingsWebFontsOverlayDeepLink` (`dialog/delete/{fontId}`) |
| Data Studio confirm dialogs | `dataStudioConfirmOverlay.ts` (sync, delete/truncate object, configure/delete API) |
| Data Studio modeler column editor | `dialog/column/{name}` · `useDataStudioModelerColumnOverlayDeepLink` |

### Remaining adoption

| Area | Notes |
|------|--------|
| Package Phase 3 generated list pages | Inherit **CrudSet** overlay sync automatically when using `CrudSet` (not `contained`) |
| Settings · cache / feedback / EUA assist | Inline forms or no modal shell — **N/A** for `overlay=` unless a shareable dialog is added |
| Settings · web fonts upload | Native file picker — not linkable; delete confirm uses `dialog/delete/{fontId}` |
| Workflow palette / edge selector popovers | Ephemeral — no `overlay=` unless product requires shareable popover links |
| Workflow list · duplicate dialog | Generic `dialog/duplicate` token reserved; no id-scoped URL until duplicate target is page-level state |
| Component designer classic (catalog list) | Live designer wired; classic catalog uses list + `load=` query — optional dock tokens if classic editor gains docks |

**IDs:** `routing.workspace-overlay.deep-link`, `routing.workspace-overlay.implementation-checklist`.
