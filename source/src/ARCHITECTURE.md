# AppEndO Architecture

Source of truth for how code is organized, where logic belongs, and how to extend the system without reintroducing monoliths.

## Architectural Philosophy

AppEndO follows **Feature-Sliced Design (FSD)** on the client and a mirrored **Domain + Services** split on the server.

| Layer | Responsibility | Must not |
| --- | --- | --- |
| **Features** (`src/features/`) | Page UI, hooks, modals, grid/toolbar composition | Call DB, read files, or embed business rules |
| **Shared** (`src/shared/`) | API client, query hooks, contracts, reusable UI primitives | Own feature-specific workflows |
| **Server domain** (`src/server/domain/`) | Pure types, validation, repositories, algorithms | Orchestrate HTTP, locks, or multi-step workflows |
| **Server services** (`src/server/services/`) | Thin orchestration, HTTP mapping, dependency wiring | Grow into multi-concern god modules |

**Dependency direction:** Features → Shared API → Server routes/controllers → Services → Domain. Domain never imports from services or features.

Legacy infrastructure that predates the split (e.g. `src/core/packages/PackageFileStore`) remains as low-level I/O helpers; new orchestration lives under `src/server/services/`.

## Directory Standards

### `src/server/domain/`

- Entity types, result unions, and option bags (e.g. `src/server/domain/package-domain/types.ts`).
- Repositories: read/write persistence with no workflow sequencing.
- Pure functions: conflict detection, registry building, script policy evaluation.

**Rule:** If a function needs locks, event emission, or “call A then B then rollback,” it belongs in a service—not domain.

### `src/server/services/`

- **Facade services** (e.g. `packages.service.ts`): map HTTP/controller inputs to operations, status codes, and response bodies.
- **Specialized services** (e.g. `src/server/services/package-runtime/`): one concern per file—registry, dependencies, install state, script policy, lifecycle coordination.
- **Gateways** (`gateways.ts`): adapt legacy/core I/O (file store, index locks) behind injectable interfaces for tests.

Controllers stay thin; they delegate to a single facade service per bounded context.

### `src/features/`

- `components/`, `hooks/`, `constants.ts`, `types.ts`, `utils.ts` per feature slice.
- Page hooks compose React Query mutations/queries from `src/shared/api/queries/`.
- No direct `fetch`—use shared API helpers.

### `src/shared/`

- `api/client.ts` — `apiRequest`, `ApiError`, formatting helpers.
- `api/queries/` — TanStack Query hooks and mutation functions.
- `api/contracts/` — DTO types shared with the UI.
- `ui/` — cross-feature components (`QueryErrorPanel`, form primitives).

## The “God Module” Anti-Pattern

We **decompose** modules that accumulate unrelated responsibilities (install + uninstall + graph + policy + locking in one file). The standard remediation is:

**Facade + specialized services** (Plugins reference implementation):

```
packages.service.ts          → HTTP-facing facade
packageLifecycle.service.ts  → Coordinator (install / uninstall / reinstall)
packageRegistry.service.ts   → Manifest selection, object registry, conflicts
packageDependency.service.ts → Dependency graph resolution
packageInstallState.service.ts → Install state machine + events
packageScriptPolicy.service.ts → DB script allowlist validation
gateways.ts                 → File-store / lock adapters
```

Domain holds algorithms and persistence; the **coordinator** only sequences steps and handles locks/rollback boundaries. Prefer `createXService(deps?)` and `getDefault…()` for production; inject mocks in tests via `resetDefault…()` + fresh coordinator.

**Do not** re-export monolith shims from `src/core/`—call the coordinator or inject services directly.

## Networking Standards

### `apiRequest` and query hooks

- All browser API traffic goes through `apiRequest` / `apiGet` / `apiPost` in `src/shared/api/client.ts`, which wraps `apiFetch` from `authSession.ts`.
- Parse failures and non-2xx responses throw **`ApiError`** with status, path, and body snippet—never return silent `undefined` for failed loads.

### `AuthContext` (no monkey-patching)

- Session state lives in `src/contexts/AuthContext.tsx` using explicit `apiGet` / `apiPost` and `registerAuthFailureListener`.
- **Do not** patch `window.fetch` or global `fetch` for auth headers or 401 handling—that logic belongs in `authSession.ts` (`apiFetch`, token refresh lock, `SessionExpiredError`).

### Error surfacing — `QueryErrorPanel`

List and workspace pages must **surface** query failures, not swallow them:

1. In the page hook: `isError` + `formatQueryError(error, fallback)` (or `formatApiErrorMessage` for mutations).
2. Expose `retryLoad…` via `refetch()`.
3. In the grid/view: render `QueryErrorPanel` with `message`, `detail`, `onRetry`, `isRetrying`.

See `useRolesPage`, `useCachePage`, and `RolesTableGrid` for the canonical pattern. Mutation errors may use toasts or inline form errors; **initial data load** failures always get a panel.

## How to Contribute

### Add a new CRUD feature (UI)

1. Add API contract types under `src/shared/api/contracts/<feature>/`.
2. Add `src/shared/api/queries/<feature>.ts` using `apiRequest` / React Query.
3. Create `src/features/<feature>/` with `hooks/use<Feature>Page.tsx`, components, and a thin `src/pages/<Feature>.tsx` entry.
4. Wire route in the app router; follow `AGENTS.md` and relevant `docs/standards/*` shards for grids, toolbars, and modals.

### Add a new server capability

1. Define types and repositories in `src/server/domain/<context>/`.
2. Add a focused `*.service.ts` under `src/server/services/` (or subfolder if multiple concerns).
3. Add or extend a facade service method; map errors to `HttpError` or structured `{ success: false, code }` bodies in the controller layer.
4. Register routes in `src/server/routes/` and controller in `src/server/controllers/`.

### Extend an existing “god-risk” area

Before adding 50+ lines to a service file, ask: *Is this a new concern?* If yes, extract a specialized service and call it from a coordinator—mirror the Plugins layout.

### Verification checklist

```bash
npx tsc --noEmit
npx vitest run
npm run build
```

Keep tests colocated (`__tests__/` next to domain or core modules). Reset singleton coordinators in tests when using `getDefault…()` helpers.

## Data layers

| Layer | Path | Role |
| --- | --- | --- |
| **Control plane** | `prisma/schema.prisma` · `src/server/db/prismaControlPlane.ts` · `src/server/db/controlPlane.ts` | `base_*` tables — auth, roles, settings cache, designer metadata |
| **Edge / runtime** | `src/core/database/EdgeDbRouter.ts` · `settings.json` `dataSources[]` | User-created data sources — CRUD-Gen, edge scripts, Oracle |

Do not query `base_*` through EdgeDbRouter. See [`docs/architecture/control-plane-prisma.md`](../docs/architecture/control-plane-prisma.md).

---

**Related:** `AGENTS.md` (always-on) · `docs/standards/INDEX.md` (one shard per task) · `/api/project-standards` (`src/config/projectStandards.ts`).
