# Codebase Index (AI Navigation)

> **Generated** — do not edit tables by hand. Regenerate: `npm run codegen:ai-index`
> **Source:** `src/config/platform-registry/navigation/studio.json` · 2026-11-04T16:54:02.736Z

This map answers **where things live**. Constraints: `AGENTS.md` + one `docs/standards/` shard (`docs/standards/INDEX.md`). Human-only bulk docs: `docs/archive/` (AI-index excluded).

## Folder convention

| Layer | Path pattern | Role |
|-------|--------------|------|
| Studio menu | `src/config/platform-registry/navigation/studio.json` | Operator nav groups |
| Page module | `src/config/platform-registry/page-modules/{pageKey}.json` | Loader + default roles |
| Page wrapper | `src/features/{feature}/*Page.tsx` (studio) · `src/pages/` (auth only) | Thin route entry |
| Feature UI | `src/features/{feature}/` | Workspace, hooks, components |
| Domain logic | `src/domain/{area}/` | Designer engine (components page) |
| API routes | `src/server/routes/{domain}.routes.ts` | Express routers |
| Services | `src/server/services/{domain}/` | Business logic |
| Contracts | `src/shared/api/contracts/{domain}/` | Shared types/validators |

## Platform routing (shell)

Culture × Application × Route: `ExperienceHost` → `DynamicOutlet` → `resolvers.ts`.
See [`docs/architecture/experience-routing.md`](../architecture/experience-routing.md).

## Shared UI

- Components: `src/shared/ui/` — `AppButton`, `AppTableGrid`, `CreateEditModalShell`, …
- Tokens: `src/shared/ui/surfaceClasses.ts`
- Grid booleans: `src/shared/lib/gridCellRenderers.tsx`

## Menu map

### (ungrouped)

| pageKey | Label | Feature | API prefix | Workspace |
|---------|-------|---------|------------|-----------|
| `dashboard` | Home | `src/features/dashboard/` | /api/dashboard | `DashboardWorkspace` |

### Development

| pageKey | Label | Feature | API prefix | Workspace |
|---------|-------|---------|------------|-----------|
| `appearance` | Appearance | `src/features/appearance/` | — | `AppearanceWorkspace` |
| `base-components` | Base Components | `src/features/base-components/` | — | `BaseComponentsWorkspace` |
| `cache` | Cache Control | `src/features/cache/` | /api/cache | `CacheWorkspace` |
| `client-components` | Client Components | `src/features/component-designer/` | /api/component-designer | `ComponentDesignerWorkspace` |
| `data-studio` | Data Studio | `src/features/data-studio/` | /api/data-api, /api/data-sources | `EdgeModelModelerWorkspace` |
| `file-manager` | File Manager | `src/features/file-manager/` | /api/file-manager | `FileManagerPageView` |
| `git` | Git | `src/features/git/` | /api/git | `GitPageView` |
| `idea-foundry` | Idea Foundry | `src/features/idea-foundry/` | /api/idea-foundry | `IdeaFoundryWorkspace` |
| `jobs` | Jobs | `src/features/jobs/` | /api/jobs | `JobsWorkspace` |
| `platform-portals` | Portals | `src/features/platform-portals/` | /api/platform | `PortalsPageView` |
| `scheduled-tasks` | Scheduled Tasks | `src/features/scheduled-tasks/` | /api/scheduler | `ScheduledTasksWorkspace` |
| `server-functions` | Server Functions | `src/features/server-functions/` | /api/core/server-functions, /api/functions | `ServerFunctionsWorkspace` |
| `settings` | Settings | `src/features/settings/` | /api/settings, /api/ai, /api/mcp | `SettingsWorkspace` |
| `workflows` | Workflows | `src/features/workflows/` | /api/workflows | `WorkflowEditorWorkspace` |

### Extensions

| pageKey | Label | Feature | API prefix | Workspace |
|---------|-------|---------|------------|-----------|
| `libraries` | Libraries | `src/features/libraries/` | /api/libraries | `LibrariesWorkspace` |
| `package-manager` | Package Manager | `src/features/packages/` | /api/packages, /api/package | `PackagesWorkspace` |

### Records

| pageKey | Label | Feature | API prefix | Workspace |
|---------|-------|---------|------------|-----------|
| `base-info` | Base Info | `src/features/base-info/` | /api/base-info | `BaseInfoWorkspace` |
| `chat-history` | Chat History | `src/features/chat-history/` | /api/ai | `ChatHistoryWorkspace` |
| `in-app-notifications` | In-app notifications | `src/features/in-app-notifications/` | — | `InAppNotificationsWorkspace` |
| `logs` | Logs | `src/features/logs/` | /api/logs | `LogsWorkspace` |
| `record-events` | Record events | `src/features/record-events/` | — | `RecordEventsWorkspace` |
| `roles` | Roles | `src/features/roles/` | /api/roles | `RolesWorkspace` |
| `users` | Users | `src/features/users/` | /api/users, /api/profile | `UsersWorkspace` |
| `workbooks` | Workbooks | `src/features/workbooks/` | /api/workbooks | `WorkbooksWorkspace` |

## Registry-only (not in studio menu)

| pageKey | Label | Feature | Notes |
|---------|-------|---------|-------|
| `api-talk` | api-talk | `src/features/api-talk/` | — |
| `dev-reference` | dev-reference | `src/features/dev-reference/` | — |
| `feedback-inbox` | feedback-inbox | `—` | — |
| `geographic-divisions` | geographic-divisions | `src/features/org-geo/` | Scoped Geographic Divisions tree UI over base_info root 100.5 (under Base) |
| `my-apis` | my-apis | `src/features/my-apis/` | Hidden from studio menu — opened from Profile drawer |
| `my-feedback` | my-feedback | `—` | — |
| `my-inbox` | my-inbox | `—` | — |
| `my-workbooks` | my-workbooks | `src/features/workbooks/` | — |
| `organization-chart` | organization-chart | `src/features/org-geo/` | Scoped Organization tree UI over base_info root 100.4 (under Base) |
| `platform-navigations` | platform-navigations | `src/features/platform-navigations/` | — |
| `platform-transfer` | platform-transfer | `src/features/platform-transfer/` | — |
| `sources` | sources | `src/features/data-sources/` | — |
| `sql-console` | sql-console | `src/features/sql-console/` | — |
| `studio-insights-ops` | studio-insights-ops | `—` | — |
| `studio-insights-people` | studio-insights-people | `—` | — |
| `studio-insights-work` | studio-insights-work | `—` | — |

## Machine-readable graph

- Full graph: [`feature-graph.json`](./feature-graph.json)

