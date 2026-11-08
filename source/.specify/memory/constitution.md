# AppEndO Project Constitution

**Version:** 2.0.0  
**Effective:** 2026-06-07  
**Status:** Absolute source of truth for all AI-assisted development  
**Methodology:** Spec-Driven Development (SDD) — GitHub Spec Kit governance model  
**Repository:** AppEndO — full-stack admin platform monorepo

---

## Document Authority

This file (`.specify/memory/constitution.md`) is the **supreme architectural contract** governing how every AI agent and contributor must **write**, **refactor**, and **structure** code in AppEndO. It is not advisory. Violations are defects.

### Precedence Hierarchy

When instructions conflict, resolve in this strict order — **same table as `AGENTS.md`** (do not fork):

| Priority | Source | Governs |
| ---: | --- | --- |
| 1 | **This constitution** | Architecture, security, layer boundaries, SDD workflow |
| 2 | **Approved feature spec** | `specs/<feature>/spec.md`, `plan.md`, `tasks.md` |
| 3 | **`AGENTS.md` always-on + one `docs/standards/` shard** | Product / UI / API constraints. Inside UI: `ui-design-system` (tokens) → `ui-core` (interaction) → chrome shards → feature shards |
| 4 | **`src/ARCHITECTURE.md`** | Structural reference |
| 5 | **`src/config/projectStandards.ts`** | Machine **index** of the same rules — not a second policy |
| 6 | **Session instructions** | Current user message |

This constitution wins on architecture, security, and import boundaries. `AGENTS.md` + UI shards win on granular product chrome (toolbar, grid, modal) not restated here. Do not duplicate UI recipes in this file.

### SDD Gate — No Code Without Spec

| Work Type | Spec Required? |
| --- | --- |
| Net-new feature | **Yes** — approved `spec.md` before any application code |
| Feature scope expansion | **Yes** — update `spec.md` first |
| Bug fix within existing spec scope | No new spec if scope unchanged |
| Refactor preserving behavior | No new spec if no boundary/security regression |
| Documentation-only | No spec |

**Agent obligation:** Before implementing a new feature, read this constitution, confirm or request `specs/<feature>/spec.md`, then produce `plan.md` and `tasks.md` from templates in `specs/template/`.

---

## 1. System Overview

| Surface | Technology | Architectural Pattern |
| --- | --- | --- |
| **Frontend** | React 19, Vite, TypeScript, TanStack Query v5, HeroUI v3, Tailwind CSS v4 | Feature-Sliced Design (FSD) |
| **Backend** | Express, TypeScript, Zod, `pg` (PostgreSQL) | Clean Architecture: Routes → Controllers → Services → Domain |
| **Platform database** | PostgreSQL control-plane pool | `controlPlane` helpers for all `base_*` tables |
| **Edge database** | Multi-engine dynamic router | `EdgeDbRouter` for user-configured external data sources only |
| **Auth** | JWT + httpOnly cookies | `auth.middleware.ts`, `authCookies.ts`, `authSession.ts` |
| **Edge execution** | Node.js `vm` sandbox | `src/core/api/sandbox.ts` — restricted runtime |

AppEndO is **greenfield**. Do not add legacy migration paths, compatibility renames, backfill scripts, or runtime schema upgrade logic unless an approved spec explicitly requires it.

---

## 2. Frontend Architecture — Feature-Sliced Design (FSD)

### 2.1 Dependency Graph (Strict — Downward Only)

```
app/ (routes, guards)
  └── pages/          ← thin route entries (< 10 LOC)
        └── features/ ← all feature UI, hooks, modals, grids
              └── shared/ ← API client, contracts, query hooks, UI primitives, types
                    └── external libraries (HeroUI, TanStack Query, Lucide, etc.)

domain/ (client-only pure logic — optional, no React/API)
```

**Forbidden upward imports:**

```
features/  ✗→  pages/
features/  ✗→  features/   (cross-slice)
shared/    ✗→  features/
shared/    ✗→  pages/
shared/    ✗→  components/
```

### 2.2 Layer Responsibilities

| Layer | Path | Owns | Forbidden |
| --- | --- | --- | --- |
| **Pages** | `src/pages/` | Single-line delegation to `<Feature>Workspace />` | Business logic, hooks, fetch, grids, modals, state |
| **Features** | `src/features/<slice>/` | Workspace, PageView, hooks, toolbars, grids, modals | Import `pages/`; import other features; raw `fetch`; DB access |
| **Shared** | `src/shared/` | `api/`, `ui/`, `types/` — cross-cutting primitives | Feature workflows; upward imports |
| **App shell** | `src/app/`, `src/layouts/`, `src/contexts/` | Routing, role guards, `AuthContext`, `AdminLayout` | Feature business rules |
| **Components** | `src/components/` | Legacy shell widgets (logo, loading, profile drawer) | New feature UI; new base primitives |
| **Client domain** | `src/domain/` | Pure algorithms, catalogs, codegen, validation | React, hooks, API, side effects |

### 2.3 Import Rules (Machine-Enforceable Intent)

| ID | Rule |
| --- | --- |
| **F-01** | `src/features/**` MUST NOT import from `src/pages/**` |
| **F-02** | `src/features/**` MUST NOT import from other `src/features/**` slices |
| **F-03** | `src/shared/**` MUST NOT import from `src/features/**`, `src/pages/**`, or `src/components/**` |
| **F-04** | `src/pages/**` MAY import only from `src/features/**` (one workspace per page) |
| **F-05** | All base UI primitives MUST be imported from `src/shared/ui/` via `src/shared/ui/index.ts` |
| **F-06** | MUST NOT import from `src/components/ui/HeroFieldControls.tsx` (legacy 1-line shim) — use `shared/ui` |
| **F-07** | Feature data access MUST go through `src/shared/api/queries/<feature>.ts` and `src/shared/api/client.ts` |
| **F-08** | Cross-layer shared types MUST live in `src/shared/types/`, not inside feature component files |
| **F-09** | MUST NOT monkey-patch `window.fetch` or global `fetch` — auth lives in `authSession.ts` |

### 2.4 UI Primitives — `shared/ui/` Only

All base interactive and presentational primitives MUST come from HeroUI v3 wrappers in `src/shared/ui/`:

| Primitive | Export | Underlying |
| --- | --- | --- |
| Button | `UiButton` | HeroUI Button |
| Native button | `NativeButton` | Styled `<button>` for grid actions |
| Input / Select / Checkbox / Textarea | `UiInput`, `UiSelect`, `UiCheckbox`, `UiTextarea` | HeroUI field controls |
| Tooltip | `ActionTooltip` | HeroUI Tooltip |
| Card | `Card` | Layout card |
| Loading | `LoadingSpinner` | Spinner |
| Error panel | `QueryErrorPanel` | Query failure surface |
| Search input | `ToolbarSearchInput` | Toolbar filter |
| Shell panel | `ShellPanel` | Admin shell surface |
| Surface classes | `surfaceClasses.ts` | Modal body tokens |

**F-10:** Do NOT build raw `<input>`, `<select>`, `<button>`, or `<textarea>` base controls inside feature slices when HeroUI provides an equivalent.

**F-11:** Create custom UI elements ONLY when HeroUI v3 lacks required behavior. Document the gap in the feature spec.

**F-12:** Default form field control size is `sm` (`UiInput`, `UiSelect`, `UiTextarea`, `UiAutocomplete`, `UiCheckbox`); use `md` only when a surface explicitly needs larger controls. Toolbar fields use the same default (`h-8`) per `AGENTS.md`.

### 2.5 Componentization — No Raw JSX Soup

Agents MUST extract semantic components. The following in feature `PageView`, `Workspace`, or modal files are **violations**:

| Violation | Required Action |
| --- | --- |
| Repeated raw HTML blocks (`<div>`, `<span>`, `<table>`) copy-pasted | Extract named component in `features/<slice>/components/` |
| Tailwind class strings exceeding ~80 characters on a single element | Extract component or use `shared/ui` primitive |
| Inline business-semantic markup (grid row, toolbar section, modal footer) | Dedicated `*Toolbar`, `*TableGrid`, `*Modal` component |
| Mixed concerns in one file (fetch + layout + modal + grid) | Split into hook + PageView + Workspace |

**Component naming convention:**

```
<Feature>Workspace.tsx     — wires hooks, opens/closes modals
<Feature>PageView.tsx      — pure layout composition
<Feature>Toolbar.tsx       — filters (left) + actions (right)
<Feature>TableGrid.tsx     — data grid + actions column
<Feature>CreateModal.tsx    — create form
<Feature>EditModal.tsx      — edit form
<Feature>DeleteModal.tsx    — destructive confirmation
<Feature>Footer.tsx         — paging/infinite scroll footer (CRUD)
```

### 2.6 Workspace Pattern — Thin Pages

**F-13:** Every routable page entry MUST be a thin wrapper delegating to a feature workspace. Target: **fewer than 10 lines of code**.

**Canonical pattern:**

```tsx
// src/pages/Users.tsx
import { UsersWorkspace } from '../features/users/components/UsersWorkspace';
export const Users = () => <UsersWorkspace />;
```

**F-14:** `Workspace` composes hooks and passes props to `PageView`. `PageView` contains zero data-fetching logic.

**F-15:** Page hooks decompose into focused sub-hooks when exceeding ~150 LOC:

```
use<Feature>Page.tsx      — composer
use<Feature>List.ts       — query/pagination/infinite scroll
use<Feature>Mutations.ts  — create/update/delete mutations
use<Feature>Modals.ts     — modal open state and selected entity
```

Reference: `useUsersPage`, `useServerFunctionsPage`, `useRolesPage`.

### 2.7 State Management — Server State Only via TanStack Query

| State Type | Mechanism | Location |
| --- | --- | --- |
| **Server state** | TanStack Query (`useQuery`, `useMutation`, `useInfiniteQuery`) | `src/shared/api/queries/<feature>.ts` |
| **UI ephemeral state** | `useState` / `useReducer` in feature hooks | `src/features/<slice>/hooks/` |
| **Auth session** | `AuthContext` | `src/contexts/AuthContext.tsx` |
| **Global API errors** | `API_ERROR_EVENT` + `GlobalApiErrorToast` | `src/shared/api/` |

**F-16:** Features MUST NOT call `fetch`, `axios`, or `apiFetch` directly. All traffic flows:

```
Feature hook → shared/api/queries → shared/api/client (apiRequest) → authSession (apiFetch)
```

**F-17:** All `apiFetch` calls MUST use `credentials: 'include'` for cookie-based session (handled in `authSession.ts` — do not override).

### 2.8 Error Handling — Fail Visible

| Error Context | Required Surface |
| --- | --- |
| Initial list/load query failure | `QueryErrorPanel` with `message`, `detail`, `onRetry`, `isRetrying` |
| Mutation failure (form save) | Inline form error or toast via `formatApiErrorMessage` |
| Unexpected API failure (global) | `GlobalApiErrorToast` via `API_ERROR_EVENT` |

**F-18:** Page hooks MUST expose `isError`, formatted error message, and `retryLoad` (via `refetch()`).

**F-19:** MUST NOT silently swallow query errors (empty grid with no error state is forbidden).

**F-20:** MUST NOT return `undefined` on failed API loads — `apiRequest` throws `ApiError`.

Reference implementations: `useRolesPage`, `useCachePage`, `RolesTableGrid`, `QueryErrorPanel`.

### 2.9 Styling & Design Tokens — Tailwind v4 `@theme` Only

All color, surface, glow, border, and shadow values MUST originate from CSS custom properties defined in `src/index.css` under `@theme`.

**Token examples (use utilities, not raw values):**

| Utility Class | CSS Variable |
| --- | --- |
| `bg-primary-500` | `--color-primary-500` |
| `bg-surface-shell` | `--color-surface-shell` |
| `bg-surface-base` | `--color-surface-base` |
| `border-border-subtle` | `--color-border-subtle` |
| `bg-surface-modal-body` | `--background-image-surface-modal-body` |
| `shadow-content-host` | `--shadow-content-host` |

**F-21 — FORBIDDEN in JSX, TSX, and CSS files (outside `@theme`):**

- Hardcoded hex (`#00a28a`, `#fff`, `bg-[#ffffff]`)
- Hardcoded `rgb()` / `rgba()` / `hsl()` color literals in class names or inline styles
- Arbitrary Tailwind color brackets (`text-[#333]`, `bg-[rgb(248_250_252)]`) without first adding a `@theme` token
- `style={{ color: '#...', backgroundColor: 'rgba(...)' }}` for theme colors

**F-22 — PERMITTED:**

- Structural utilities: `p-[15px]`, `gap-[2px]`, `h-8`, `w-5`, `rounded-md`, `rounded-xl`
- Semantic surface classes from `src/shared/ui/surfaceClasses.ts` (`CREATE_EDIT_MODAL_BODY_CLASS`, etc.)
- Layout-only arbitrary values that are not colors

**F-23:** When a new color is needed:

1. Add `--color-<name>` (or shadow/background token) to `@theme` in `src/index.css`
2. Use the generated Tailwind utility in components
3. If a non-Tailwind consumer needs a hex fallback (e.g. `<input type="color">`), add a named constant in `surfaceClasses.ts` that mirrors the token

**F-24:** UI visual standards for forms, modals, toolbars, grids, trees, and destructive confirmations are defined in `AGENTS.md`. Agents MUST comply. Key mandates:

- HeroUI v3 for all new UI
- Create/edit forms: `bg-white`, `p-[15px]`, header/footer `bg-slate-50/80`, blur backdrop modals
- Toolbars: `h-8`, `size="sm"`, filters left / actions right
- Grid actions: semantic icon colors (cyan view, indigo edit, rose delete), disabled = `text-slate-400`
- Booleans: icon only (`Check` / `X`), not Yes/No text
- Dates: `YYYY-MM-DD`, center-aligned
- Destructive actions: in-app confirmation modal — NEVER `window.confirm`
- CRUD lists: paging + infinite scroll toggle in footer

---

## 3. Backend Architecture — Clean Architecture & Express

### 3.1 Layered Request Flow

```
HTTP Request
  → src/server/routes/<context>.routes.ts     (path + middleware registration)
  → src/server/controllers/<context>.controller.ts   (thin mapping)
  → src/server/services/<context>.service.ts         (orchestration facade)
  → src/server/services/<context>/*.service.ts       (specialized coordinators)
  → src/server/domain/<context>/*.ts                 (repositories + pure logic)
  → controlPlane | EdgeDbRouter | file store gateway
```

**Dependency direction:** Domain NEVER imports from services, controllers, or routes.

### 3.2 Layer Responsibilities

| Layer | Path | Owns | Forbidden |
| --- | --- | --- | --- |
| **Routes** | `src/server/routes/` | `router.get/post/...`, `requireAuth` attachment | Business logic, SQL, Zod parsing |
| **Controllers** | `src/server/controllers/` | Input extraction, Zod parse, `res.json()`, cookie side effects | `try/catch`, raw SQL, orchestration, validation logic bodies |
| **Services** | `src/server/services/` | Workflow sequencing, `{ body, statusCode? }` mapping, lock boundaries | Raw SQL strings, `pool.query`, `controlPlane*` calls |
| **Domain** | `src/server/domain/` | Types, Zod schemas, repositories, pure algorithms | HTTP, `req`/`res`, multi-aggregate locking |
| **Utils** | `src/server/utils/` | `asyncHandler`, `authCookies`, `controllerHttp`, IDs | Feature business rules |
| **Core** | `src/core/` | Logging, DB drivers, plugin file I/O, sandbox | New orchestration (belongs in services) |

### 3.3 Controller Rules

| ID | Rule |
| --- | --- |
| **B-01** | EVERY controller method MUST be wrapped in `asyncHandler` from `src/server/utils/asyncHandler.ts` |
| **B-02** | Manual `try/catch` blocks inside controllers are **FORBIDDEN** for orchestration, control flow, or swallowing errors — those errors flow to `asyncHandler` → global error middleware. **Allowed:** mapping an already-thrown domain `HttpError` (or translating a known domain error type to `HttpError`) inside an `asyncHandler`-wrapped method |
| **B-03** | Controllers MUST be thin: Zod-validated input → single service call → HTTP response |
| **B-04** | Auth cookie mutations MUST use `applyAuthSideEffects` from `src/server/utils/authCookies.ts` |
| **B-05** | Structured errors MUST use `HttpError` + `sendHttpError` from `src/server/errors/HttpError.ts` and `src/server/utils/controllerHttp.ts` |
| **B-06** | Controllers MUST NOT import repositories directly — always go through services |
| **B-07** | Actor context MUST come from `req.auth` via `toActorContext` / `toAuthAuditContext` helpers |

**Canonical controller method shape:**

```ts
create = asyncHandler(async (req: Request, res: Response) => {
  const parsed = createEntitySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: 'Validation failed.', details: parsed.error.issues });
    return;
  }
  const result = await this.entityService.create(parsed.data, toActorContext(req, hasAdminRole(req)));
  res.status(result.statusCode ?? 200).json(result.body);
}, 'Failed to create entity.');
```

### 3.4 Service Rules

| ID | Rule |
| --- | --- |
| **B-08** | Services act as **orchestration facades** — they sequence domain calls, never embed SQL |
| **B-09** | Raw SQL strings in services are **FORBIDDEN** |
| **B-10** | Services MUST NOT call `pool.query`, `controlPlaneRows`, `controlPlaneGet`, or `controlPlaneExecute` directly |
| **B-11** | One bounded context = one facade service (`users.service.ts`, `plugins.service.ts`, `auth.service.ts`) delegating to specialized services |
| **B-12** | Multi-step workflows with locks/rollback use a **coordinator** (e.g. `pluginLifecycle.service.ts`) — not a god module |
| **B-13** | Services return typed `{ body, statusCode? }` shapes — controllers map to HTTP |
| **B-14** | Prefer `createXService(deps?)` factories; use `getDefaultX()` in production; inject mocks in tests |
| **B-15** | Legacy `src/core/` I/O MUST be accessed through service gateways (`gateways.ts` pattern), not directly from controllers |

**God module remediation pattern (Plugins reference):**

```
plugins.service.ts           → HTTP facade
pluginLifecycle.service.ts     → install/uninstall coordinator
pluginRegistry.service.ts      → manifest/registry
pluginDependency.service.ts    → dependency graph
pluginInstallState.service.ts  → state machine
pluginScriptPolicy.service.ts  → script allowlist
gateways.ts                    → file-store adapters
```

### 3.5 Domain & Repository Rules

| ID | Rule |
| --- | --- |
| **B-16** | ALL raw SQL and database interaction MUST reside in `src/server/domain/<context>/` repositories |
| **B-17** | Repository files follow naming: `<entity>Repository.ts` (e.g. `userRepository.ts`, `roleRepository.ts`) |
| **B-18** | Domain holds pure types, Zod schemas, conflict detection, registry building — no HTTP |
| **B-19** | If a function needs locks, event emission, or multi-step rollback, it belongs in a **service**, not domain |
| **B-20** | Reusable DB utility functions/procedures use the `zz_` prefix |

### 3.6 Request Validation — Zod at Controller Boundary

| ID | Rule |
| --- | --- |
| **B-21** | EVERY mutation endpoint (POST, PUT, PATCH, DELETE) MUST validate payload at the controller boundary using Zod |
| **B-22** | Zod schemas live in `src/server/domain/<context>/schemas.ts` — NOT inline in controllers |
| **B-23** | Validation failure → HTTP 400: `{ success: false, error: 'Validation failed.', details?: ZodIssue[] }` |
| **B-24** | GET endpoints with filters/pagination/query params MUST validate query strings with Zod when accepting user input |
| **B-25** | Route params (IDs) MUST be validated/parsed (type coercion + bounds) before service calls |
| **B-26** | Environment variables validated via Zod in `src/server/config/env.ts` — extend this pattern consistently |

### 3.7 API Contracts

- Shared DTO types: `src/shared/api/contracts/<feature>/types.ts`
- Mappers when DB shape ≠ API shape: `src/shared/api/contracts/<feature>/mappers.ts`
- List/grid endpoints: thumbnail payloads only for images; full binary on detail endpoints only
- Audit fields: `created_at`, `created_by`, `updated_at`, `updated_by` on app-managed tables

---

## 4. Database Access Rules — Dual-Path Restriction

AppEndO has **two distinct database access paths**. Mixing them is a **security defect**.

### 4.1 Platform Path — `controlPlane` (PostgreSQL Pool)

**Rule DB-01:** Any table whose name starts with `base_` MUST be accessed exclusively through:

```ts
import { controlPlaneRows, controlPlaneGet, controlPlaneExecute } from '../db/controlPlane';
```

**Platform tables include (non-exhaustive):**

| Table | Purpose |
| --- | --- |
| `base_users` | User accounts |
| `base_roles` | Role definitions |
| `base_user_roles` | User-role assignments |
| `base_info` | Hierarchical base info / lookup tree |
| `base_logs_app` | Application HTTP logs |
| `base_auth_refresh_tokens` | Refresh token sessions |

**Rule DB-02:** Platform repositories live in `src/server/domain/<context>/` and call `controlPlane*` only.

**Rule DB-03:** `initControlPlanePool` is called at bootstrap (`src/server/bootstrap.ts`). Repositories MUST NOT create their own pools.

### 4.2 Edge Path — `EdgeDbRouter` / `RequestDb` (External Data Sources)

**Rule DB-04:** `EdgeDbRouter` (`src/core/database/EdgeDbRouter.ts`) and `RequestDb` context (`src/server/types/requestContext.ts`) are for **user-configured external data sources** only (SQL Server, PostgreSQL, MySQL, SQLite, MongoDB, Redis, Oracle).

**Rule DB-05 — FORBIDDEN:** Using `EdgeDbRouter`, `RequestDb`, or client-supplied `x-append-datasource-*` headers to read/write any `base_*` platform table.

**Rule DB-06:** `toRequestDbContext(req)` passes headers/query/body for edge routing — controllers pass this to services that delegate to `EdgeDbRouter`. Platform CRUD MUST NOT use `toRequestDbContext` for `base_*` persistence.

**Rule DB-07:** After edge query execution, connection pools are cached per data source in `EdgeDbRouter` — do not bypass the router with ad-hoc driver connections in services.

### 4.3 File-Based Configuration Stores

Some entities (data sources, plugins settings) persist to JSON file stores (`dataSourcesStore`, `pluginsSettings`). These are a third path for **non-SQL configuration**, not a substitute for `controlPlane` on `base_*` tables.

**Rule DB-08:** Application settings/config (`settings.json`, data-source definitions, logging/PWA flags) stay in their **existing** file/API paths. They MUST NOT be moved under `runtime/`.

### 4.3.1 Runtime Artifact File Stores

**Rule DB-09:** Only **function**, **component (designer)**, and **plugin** artifacts use dedicated runtime file stores:

| Artifact | Path |
| --- | --- |
| Custom server functions | `workspace/server-functions/` |
| Component designer drafts | `workspace/designer/` |
| Plugin ZIP + lifecycle | `plugins-storage/` |

Implementation: `FunctionFileStore`, `component-designer/storage`, `PluginFileStore`. See `runtime/` on-disk layout in codebase.

### 4.4 Data Model Standards

- App-managed SQL tables include audit columns where applicable
- `created_by` / `updated_by`: nullable FK → `base_users(id)`; set from `req.auth.userId`; `NULL` for system rows
- No legacy migration/backfill in runtime startup
- Grid `_by` columns: plain text actor display, non-interactive, not clickable

---

## 5. Security & Authentication Posture

Security is **fail-closed**. When uncertain, reject and escalate to the product owner.

### 5.1 Token Storage — HttpOnly Cookies Only

| ID | Rule |
| --- | --- |
| **S-01** | Access tokens MUST be stored in httpOnly cookies (`ACCESS_COOKIE_NAME` = `access_token`) |
| **S-02** | Refresh tokens MUST be stored in httpOnly cookies (`REFRESH_COOKIE_NAME` = `refresh_token`) |
| **S-03** | Cookie options MUST use `buildCookieOptions` from `src/server/constants/auth.ts`: `httpOnly: true`, `sameSite: 'lax'`, `secure: true` in production |
| **S-04** | **FORBIDDEN:** Writing, reading, or caching access/refresh tokens in `localStorage`, `sessionStorage`, `IndexedDB`, or non-httpOnly cookies |
| **S-05** | **FORBIDDEN:** New code calling `writeAccessToken`, `readAccessToken`, or `ACCESS_TOKEN_STORAGE_KEY` patterns — these exist as technical debt in `authSession.ts` and MUST be eliminated, not extended |
| **S-06** | Browser API calls MUST use `credentials: 'include'` so httpOnly cookies are sent automatically |
| **S-07** | `requireAuth` middleware reads httpOnly cookie first; `Authorization: Bearer` header is fallback for API tooling only — not for new frontend code |
| **S-08** | Login rate limiting via `loginAttempt.service.ts` MUST NOT be bypassed |
| **S-09** | Session lifecycle audit via `sessionAudit.service.ts` for login/logout/revoke events |

**Auth side effects:** Always `applyAuthSideEffects(res, result)` in auth controllers — never `res.cookie(...)` ad hoc.

### 5.2 Authorization

| ID | Rule |
| --- | --- |
| **S-10** | Every protected endpoint MUST enforce `requireAuth` at the route level |
| **S-11** | Privileged operations MUST check roles server-side (`hasAdminRole`, `normalizeAuthRoles`) — never trust client-side guards alone |
| **S-12** | Frontend role gates (`RequireRoleLayout`) are UX-only; server is authoritative |
| **S-13** | Destructive mutations MUST record `updated_by` from authenticated actor |

### 5.3 Sandbox Execution — Header Stripping

Edge functions execute in a restricted Node.js `vm` sandbox (`src/core/api/sandbox.ts`).

| ID | Rule |
| --- | --- |
| **S-14** | Before sandbox execution, `cookie` and `authorization` headers MUST be stripped from the request object passed to sandbox code |
| **S-15** | Sandbox `req.headers` MUST NOT contain session tokens or bearer credentials |
| **S-16** | New sandbox context builders MUST replicate the stripping logic in `sandbox.ts` lines 159–165 — never pass raw `req.headers` |
| **S-17** | Edge function scripts MUST pass `scriptPolicy` validation before install/execute |
| **S-18** | Client-supplied `x-append-datasource-*` override headers MUST NOT affect platform `base_*` operations |

**Canonical stripping pattern (mandatory):**

```ts
const sandboxHeaders = { ...req.headers };
for (const key of Object.keys(sandboxHeaders)) {
  const normalizedKey = key.toLowerCase();
  if (normalizedKey === 'cookie' || normalizedKey === 'authorization') {
    delete sandboxHeaders[key];
  }
}
```

### 5.4 Audit Logging — Sensitive Data Redaction

HTTP request/response payloads persisted to `base_logs_app` MUST be sanitized before storage.

| ID | Rule |
| --- | --- |
| **S-19** | Use `sanitizeClientPayloadForLog` from `src/server/utils/httpLogging.ts` before writing log payloads |
| **S-20** | Headers `cookie` and `authorization` MUST be redacted |
| **S-21** | Body fields matching sensitive keys MUST be replaced with `[REDACTED]`: `password`, `newPassword`, `currentPassword`, `confirmPassword`, `passwordHash`, `refreshToken`, `accessToken` (case-insensitive) |
| **S-22** | Binary payloads and oversized text fields MUST be stripped per `LOG_SANITIZE_MAX_TEXT_BYTES` |
| **S-23** | MUST NOT log raw secrets, connection strings, or API keys — use `dataSourceSecrets.ts` patterns |
| **S-24** | Production error responses MUST NOT expose stack traces or internal file paths |

### 5.5 Input Integrity

| ID | Rule |
| --- | --- |
| **S-25** | All mutation endpoints: Zod validation (B-21–B-26) |
| **S-26** | SQL MUST use parameterized queries — never string-interpolate user input |
| **S-27** | Secrets MUST NOT appear in API responses, error messages, or client-side state |

---

## 6. Spec-Driven Development Workflow

### 6.1 Artifact Chain

```
specs/<feature-slug>/
├── spec.md    ← WHAT/WHY     (from specs/template/01-spec-template.md)
├── plan.md    ← HOW          (from specs/template/02-plan-template.md)
└── tasks.md   ← CHECKLIST    (from specs/template/03-tasks-template.md)
```

### 6.2 Implementation Sequence

1. Read this constitution
2. Obtain approved `spec.md`
3. Write `plan.md` — no code
4. Write `tasks.md` — ordered checklist
5. Implement tasks in order; mark `[x]` as complete
6. Run verification gate (Section 7)
7. Complete agent checklist (Section 10)

### 6.3 Refactoring Under SDD

When refactoring existing code, agents MUST:

- Preserve or improve layer boundary compliance
- Not introduce new cross-feature imports
- Migrate `localStorage` token usage toward cookie-only when touching auth code
- Migrate raw SQL in services to domain repositories
- Wrap unwrapped controllers in `asyncHandler`
- Add missing Zod validation on mutations being touched
- Extract components per Section 2.5 when splitting large files

---

## 7. Verification Gate

Before marking any task complete, run:

```bash
npx tsc --noEmit
npx vitest run
npm run build
```

| Check | Requirement |
| --- | --- |
| TypeScript | Zero new errors |
| Tests | All existing tests pass; new tests for non-trivial domain logic |
| Build | Production build succeeds |

Tests colocate in `__tests__/` adjacent to the module. Reset singleton coordinators in tests when using `getDefault…()` helpers.

---

## 8. Anti-Patterns — Explicitly Forbidden

| # | Anti-Pattern | Correct Pattern |
| ---: | --- | --- |
| 1 | God module service (500+ LOC, multiple concerns) | Facade + specialized services + coordinator |
| 2 | Feature imports another feature | Extract to `shared/` |
| 3 | Feature imports `pages/` | Invert dependency — pages import features |
| 4 | `shared/` imports `features/` or `components/` | Move shared code down to `shared/` |
| 5 | Raw SQL in controller or service | Domain repository + `controlPlane`/`EdgeDbRouter` |
| 6 | `base_*` table via `EdgeDbRouter`/`RequestDb` | `controlPlane` only |
| 7 | External DS query via `controlPlane` | `EdgeDbRouter` only |
| 8 | `try/catch` in controller for orchestration or swallowed errors | `asyncHandler` (domain `HttpError` mapping after the wrapper is allowed) |
| 9 | Controller without `asyncHandler` | Wrap every method |
| 10 | Mutation endpoint without Zod | Add schema at controller boundary |
| 11 | `localStorage` for tokens | httpOnly cookies only |
| 12 | Raw `fetch` in feature hook | `shared/api/queries` |
| 13 | Swallowed query error | `QueryErrorPanel` |
| 14 | `window.confirm` for delete | In-app confirmation modal |
| 15 | Hardcoded hex/rgba in Tailwind/JSX | `@theme` token + utility class |
| 16 | Custom base input in feature | `shared/ui` HeroUI wrapper |
| 17 | 50+ line Tailwind on one element | Extract semantic component |
| 18 | Page file with business logic | Thin wrapper < 10 LOC |
| 19 | Sandbox receives `cookie`/`authorization` headers | Strip before `vm` context |
| 20 | Unredacted passwords in `base_logs_app` | `sanitizeClientPayloadForLog` |
| 21 | Legacy migration/backfill in startup | Greenfield — spec required |
| 22 | Code before approved spec | SDD gate — stop and request spec |

---

## 9. New Capability Quick Reference

### Full-Stack CRUD Feature

| Step | Artifact |
| ---: | --- |
| 1 | Approved `specs/<feature>/spec.md` |
| 2 | `specs/<feature>/plan.md` + `tasks.md` |
| 3 | `src/shared/api/contracts/<feature>/types.ts` |
| 4 | `src/shared/api/queries/<feature>.ts` |
| 5 | `src/server/domain/<feature>/types.ts` + `schemas.ts` + `*Repository.ts` |
| 6 | `src/server/services/<feature>.service.ts` |
| 7 | `src/server/controllers/<feature>.controller.ts` (all `asyncHandler`) |
| 8 | `src/server/routes/<feature>.routes.ts` |
| 9 | `src/features/<feature>/` (workspace pattern) |
| 10 | `src/pages/<Feature>.tsx` (< 10 LOC) |
| 11 | Route wiring in `App.tsx` / `lazyPages.ts` |
| 12 | Verification gate + agent checklist |

---

## 10. Checklist for AI Agents

**An agent MUST verify every item below before marking any task or feature as complete. If any item fails, the task is NOT done.**

### SDD & Governance

- [ ] I loaded constitution sections relevant to this task (FSD for UI, DB for data, security for auth) — not necessarily the whole file
- [ ] I have an approved `specs/<feature>/spec.md` (or confirmed the work is a scoped bug fix/refactor)
- [ ] `plan.md` and `tasks.md` exist and reflect what was implemented
- [ ] I did not expand scope beyond the approved spec without owner approval

### Frontend — FSD Boundaries

- [ ] `features/` does NOT import from `pages/`
- [ ] `features/` does NOT import from other `features/` slices
- [ ] `shared/` does NOT import from `features/`, `pages/`, or `components/`
- [ ] Page entry is a thin wrapper (< 10 LOC) delegating to `<Feature>Workspace />`
- [ ] Workspace/PageView/hooks/modals/grids are properly separated

### Frontend — UI & Components

- [ ] Base UI primitives imported from `src/shared/ui/` — not built raw in features
- [ ] HeroUI v3 used for all new interactive controls
- [ ] No raw HTML/JSX soup — semantic components extracted
- [ ] No Tailwind class strings > ~80 chars on a single element without extraction
- [ ] `AGENTS.md` standards followed (toolbars, grids, modals, forms, confirmations)

### Frontend — State & Errors

- [ ] Server state uses TanStack Query via `src/shared/api/queries/`
- [ ] No raw `fetch` / `apiFetch` in feature code
- [ ] Initial load failures surface via `QueryErrorPanel` with retry
- [ ] Mutation errors use inline form errors or `GlobalApiErrorToast`
- [ ] No `window.fetch` monkey-patching

### Frontend — Styling

- [ ] All colors use Tailwind v4 `@theme` tokens (`bg-primary-500`, `bg-surface-base`, etc.)
- [ ] No hardcoded hex, `rgb()`, or `rgba()` in JSX/CSS outside `@theme`
- [ ] New colors added to `src/index.css` `@theme` before use
- [ ] Structural spacing utilities (`p-[15px]`, `h-8`) used per standards — not confused with color tokens

### Backend — Layer Compliance

- [ ] Routes only register paths and middleware — no business logic
- [ ] EVERY controller method wrapped in `asyncHandler`
- [ ] NO manual `try/catch` in controllers except mapping domain `HttpError` after `asyncHandler`
- [ ] Controllers are thin: Zod parse → service call → response
- [ ] Services contain NO raw SQL strings
- [ ] Services do NOT call `controlPlane*` or `pool.query` directly
- [ ] All SQL lives in `src/server/domain/<context>/` repositories

### Backend — Validation

- [ ] Every POST/PUT/PATCH/DELETE endpoint validates input with Zod at controller boundary
- [ ] Zod schemas defined in `domain/<context>/schemas.ts`
- [ ] Validation failures return HTTP 400 with structured error body
- [ ] Query params validated with Zod where filters/pagination are accepted

### Database — Dual-Path

- [ ] All `base_*` tables accessed via `controlPlane` only
- [ ] `EdgeDbRouter` / `RequestDb` used ONLY for external user-configured data sources
- [ ] No `base_*` platform queries routed through `EdgeDbRouter` or client datasource headers
- [ ] Audit fields (`created_by`, `updated_by`) set from `req.auth` where applicable

### Security

- [ ] No tokens stored in or read from `localStorage` / `sessionStorage`
- [ ] Auth uses httpOnly cookies with `credentials: 'include'`
- [ ] Auth cookie side effects use `applyAuthSideEffects` — not ad-hoc `res.cookie`
- [ ] Protected endpoints enforce `requireAuth` server-side
- [ ] Role checks performed server-side for privileged operations
- [ ] Sandbox strips `cookie` and `authorization` headers before execution
- [ ] HTTP log payloads sanitized via `sanitizeClientPayloadForLog` — passwords/tokens redacted
- [ ] No secrets in API responses, logs, or error messages
- [ ] SQL uses parameterized queries only
- [ ] Destructive actions use in-app confirmation modal (frontend)

### Quality Gate

- [ ] `npx tsc --noEmit` passes
- [ ] `npx vitest run` passes
- [ ] `npm run build` passes
- [ ] No debug `console.log` artifacts left in production paths
- [ ] `tasks.md` checkboxes updated to reflect completion

---

*End of Constitution v2.0.0*
