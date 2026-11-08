# Implementation Plan

> **Instructions:** Copy this file to `specs/<feature-slug>/plan.md` after `spec.md` is approved. This document describes HOW the feature will be built. No application code until this plan is reviewed.

---

## Metadata

| Field | Value |
| --- | --- |
| **Feature slug** | `<feature-slug>` |
| **Spec reference** | `specs/<feature-slug>/spec.md` |
| **Status** | `Draft` / `Approved` |
| **Created** | YYYY-MM-DD |
| **Planner** | AI Agent / Human |

---

## Plan Summary

<!-- 2–3 sentences: approach overview and key architectural decisions. -->

---

## Frontend Architecture

### Route & Page Entry

| Item | Path / Value |
| --- | --- |
| Route path | `/…` |
| Page entry | `src/pages/<Feature>.tsx` |
| Lazy loaded? | `Yes` / `No` |
| Role guard | `ADMIN` / `Authenticated` / `None` |

### Feature Slice Structure

```
src/features/<feature>/
├── components/
│   ├── <Feature>Workspace.tsx
│   ├── <Feature>PageView.tsx
│   └── …
├── hooks/
│   ├── use<Feature>Page.tsx
│   └── …
├── constants.ts
├── types.ts
└── index.ts
```

### Component Breakdown

| Component | Responsibility | New / Reuse |
| --- | --- | --- |
| `<Feature>Workspace` | State wiring, modal orchestration | New |
| `<Feature>PageView` | Layout composition | New |
| `<Feature>Toolbar` | Filters (left) + actions (right) | New |
| `<Feature>TableGrid` | Data grid with actions column | New |
| `<Feature>CreateModal` | Create form modal | New |
| `<Feature>EditModal` | Edit form modal | New |
| `<Feature>DeleteModal` | Destructive confirmation | New |

### Hooks & State

| Hook | Responsibility | React Query Keys |
| --- | --- | --- |
| `use<Feature>Page` | Composes sub-hooks | — |
| `use<Feature>List` | List/paging/infinite scroll | `['<feature>', 'list', …]` |
| `use<Feature>Mutations` | Create/update/delete | — |
| `use<Feature>Modals` | Modal open/close state | — |

### Shared Layer Additions

| Artifact | Path |
| --- | --- |
| API contracts | `src/shared/api/contracts/<feature>/types.ts` |
| Query hooks | `src/shared/api/queries/<feature>.ts` |
| Shared types (if cross-layer) | `src/shared/types/<feature>.ts` |
| UI primitives needed | `src/shared/ui/` (only if HeroUI wrapper required) |

### FSD Boundary Checklist

- [ ] No imports from `pages/` inside `features/`
- [ ] No cross-feature imports
- [ ] UI primitives from `shared/ui` only
- [ ] API via `shared/api/queries` only (no raw `fetch`)
- [ ] Query errors surfaced via `QueryErrorPanel`
- [ ] List mode supports Paging + Infinite Scroll (if CRUD list)
- [ ] Destructive actions use in-app confirmation modal

### Styling Plan

| Token / Class | Purpose | New token needed? |
| --- | --- | --- |
| `bg-surface-shell` | Page backdrop | No |
| `bg-white` | Form container | No |
| `CREATE_EDIT_MODAL_BODY_CLASS` | Modal body | No |
| | | |

<!-- If new colors needed, list them here and note they must be added to `src/index.css` @theme first. -->

---

## Backend Architecture

### API Endpoints

| Method | Path | Auth | Controller Method | Description |
| --- | --- | --- | --- | --- |
| GET | `/api/…` | `requireAuth` | `list` | |
| POST | `/api/…` | `requireAuth` | `create` | |
| PUT | `/api/…` | `requireAuth` | `update` | |
| DELETE | `/api/…` | `requireAuth` | `remove` | |

### File Layout

```
src/server/
├── routes/<feature>.routes.ts
├── controllers/<feature>.controller.ts      # asyncHandler on every method
├── services/<feature>.service.ts            # facade
├── services/<feature>/                      # specialized services (if needed)
├── domain/<feature>/
│   ├── types.ts
│   ├── schemas.ts                           # Zod validation
│   └── <feature>Repository.ts               # SQL only here
└── utils/                                   # only if cross-cutting helper needed
```

### Service Design

| Service | Responsibility | Calls |
| --- | --- | --- |
| `<Feature>Service` (facade) | HTTP result mapping, delegates | Specialized services or repository |
| | | |

### Domain & Repository Design

| Repository Function | SQL Operation | DB Access |
| --- | --- | --- |
| `list<Feature>` | SELECT | `controlPlane` / `EdgeDbRouter` |
| `create<Feature>` | INSERT | `controlPlane` / `EdgeDbRouter` |
| `update<Feature>` | UPDATE | `controlPlane` / `EdgeDbRouter` |
| `delete<Feature>` | DELETE | `controlPlane` / `EdgeDbRouter` |

**DB routing decision:**

- [ ] Platform `base_*` table → `controlPlaneRows` / `controlPlaneGet` / `controlPlaneExecute`
- [ ] Dynamic data source → `EdgeDbRouter` executor
- [ ] File-based config → existing store pattern (e.g. `dataSourcesStore`)

### Zod Schemas

| Schema | Validates | Used By |
| --- | --- | --- |
| `create<Feature>Schema` | POST body | Controller → Service |
| `update<Feature>Schema` | PUT/PATCH body | Controller → Service |
| `list<Feature>QuerySchema` | GET query params | Controller → Service |

### Error Mapping

| Condition | HTTP Status | Response Shape |
| --- | --- | --- |
| Validation failure | 400 | `{ success: false, error, details? }` |
| Not found | 404 | `{ success: false, error }` |
| Unauthorized | 401 | `{ success: false, error }` |
| Forbidden | 403 | `{ success: false, error }` |
| Conflict | 409 | `{ success: false, error }` |

---

## Database Schema

### New Tables

<!-- Only if spec requires new tables. Follow audit field standards. -->

```sql
-- Example structure (adjust per feature)
CREATE TABLE base_<entity> (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- domain columns --
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by  INTEGER REFERENCES base_users(id),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  INTEGER REFERENCES base_users(id)
);
```

### Table Modifications

<!-- ALTER statements for existing tables, if any. -->

| Table | Change | Migration Notes |
| --- | --- | --- |
| | Add column / Add index / Add FK | Greenfield — add to `initDB` only |

### Indexes

| Table | Index | Columns | Rationale |
| --- | --- | --- | --- |
| | | | |

### Seed / Default Data

<!-- Any bootstrap rows required. -->

---

## Security Considerations

### Authentication

- [ ] All endpoints behind `requireAuth` (except public ones explicitly listed)
- [ ] Role checks server-side for privileged operations
- [ ] Actor ID (`req.auth.userId`) recorded in `created_by` / `updated_by`

### Input Validation

- [ ] Zod schemas for all mutation endpoints
- [ ] Query param validation for filtered list endpoints
- [ ] No raw user input in SQL (parameterized queries only)

### Data Access

- [ ] Platform tables use `controlPlane` — not `EdgeDbRouter` with client headers
- [ ] Secrets not returned in API responses or logs
- [ ] List endpoints return thumbnails only for image fields

### Session & Token Handling

- [ ] No new `localStorage` token storage
- [ ] Cookie-based auth uses `applyAuthSideEffects` / `buildCookieOptions`
- [ ] Destructive actions require confirmation (frontend)

### Threat Scenarios

| Threat | Mitigation |
| --- | --- |
| Unauthorized access | `requireAuth` + role middleware |
| SQL injection | Parameterized queries in repository |
| Mass assignment | Zod schema with strict field allowlist |
| IDOR | Ownership/role checks in service layer |

---

## Testing Plan

| Test | Type | Location |
| --- | --- | --- |
| Zod schema validation | Unit | `src/server/domain/<feature>/__tests__/` |
| Repository queries | Unit/Integration | `src/server/domain/<feature>/__tests__/` |
| Service orchestration | Unit | `src/server/services/__tests__/` |
| Page hook behavior | Unit | `src/features/<feature>/hooks/__tests__/` |
| Grid rendering | Component | `src/features/<feature>/components/__tests__/` |

---

## Rollout & Risks

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| | Low/Med/High | Low/Med/High | |

---

## Approval

| Role | Name | Date | Status |
| --- | --- | --- | --- |
| Product Owner | | | `Pending` / `Approved` |

**Agent instruction:** Do not proceed to `tasks.md` or code until Status is `Approved`.
