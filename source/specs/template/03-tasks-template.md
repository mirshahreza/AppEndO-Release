# Implementation Tasks

> **Instructions:** Copy this file to `specs/<feature-slug>/tasks.md` after `plan.md` is approved. Execute tasks **in order**. Mark each checkbox `[x]` when complete. Do not skip verification.

---

## Metadata

| Field | Value |
| --- | --- |
| **Feature slug** | `<feature-slug>` |
| **Spec reference** | `specs/<feature-slug>/spec.md` |
| **Plan reference** | `specs/<feature-slug>/plan.md` |
| **Status** | `Not Started` / `In Progress` / `Done` |
| **Started** | YYYY-MM-DD |
| **Completed** | |

---

## Pre-Implementation

- [ ] Read `.specify/memory/constitution.md`
- [ ] Confirm `spec.md` is **Approved**
- [ ] Confirm `plan.md` is **Approved**
- [ ] Identify reference implementations (e.g. Users, Roles) for pattern parity

---

## Phase 1: Shared Contracts & API Client

- [ ] Create `src/shared/api/contracts/<feature>/types.ts` with request/response DTOs
- [ ] Create `src/shared/api/contracts/<feature>/mappers.ts` (if DB shape differs from API)
- [ ] Create `src/shared/api/queries/<feature>.ts` with TanStack Query hooks
- [ ] Export query keys and mutation helpers
- [ ] Verify no imports from `features/` or `components/` in shared layer

---

## Phase 2: Backend Domain & Validation

- [ ] Create `src/server/domain/<feature>/types.ts`
- [ ] Create `src/server/domain/<feature>/schemas.ts` with Zod schemas for all mutations
- [ ] Create `src/server/domain/<feature>/<feature>Repository.ts` with SQL via `controlPlane` or `EdgeDbRouter`
- [ ] Add unit tests for Zod schemas (`__tests__/`)
- [ ] Add unit tests for repository functions (if non-trivial)

---

## Phase 3: Backend Services & Controllers

- [ ] Create `src/server/services/<feature>.service.ts` (facade)
- [ ] Create specialized services under `src/server/services/<feature>/` (if plan requires)
- [ ] Create `src/server/controllers/<feature>.controller.ts` — **every handler uses `asyncHandler`**
- [ ] Wire Zod validation in controller before service calls
- [ ] Map errors to `HttpError` with correct status codes
- [ ] Create `src/server/routes/<feature>.routes.ts`
- [ ] Register routes in server app bootstrap
- [ ] Add service unit tests (if non-trivial orchestration)

---

## Phase 4: Database Schema (if applicable)

- [ ] Add table definitions to `initDB` / schema bootstrap
- [ ] Include audit fields (`created_at`, `created_by`, `updated_at`, `updated_by`)
- [ ] Add indexes per plan
- [ ] Add seed/default data (if applicable)
- [ ] Verify `zz_` prefix for any reusable DB utilities

---

## Phase 5: Frontend Feature Slice

- [ ] Create `src/features/<feature>/types.ts`
- [ ] Create `src/features/<feature>/constants.ts`
- [ ] Create `src/features/<feature>/hooks/use<Feature>List.ts`
- [ ] Create `src/features/<feature>/hooks/use<Feature>Mutations.ts`
- [ ] Create `src/features/<feature>/hooks/use<Feature>Modals.ts`
- [ ] Create `src/features/<feature>/hooks/use<Feature>Page.tsx` (composer)
- [ ] Create `src/features/<feature>/components/<Feature>Toolbar.tsx`
- [ ] Create `src/features/<feature>/components/<Feature>TableGrid.tsx`
- [ ] Create `src/features/<feature>/components/<Feature>CreateModal.tsx`
- [ ] Create `src/features/<feature>/components/<Feature>EditModal.tsx`
- [ ] Create `src/features/<feature>/components/<Feature>DeleteModal.tsx` (if destructive)
- [ ] Create `src/features/<feature>/components/<Feature>PageView.tsx`
- [ ] Create `src/features/<feature>/components/<Feature>Workspace.tsx`
- [ ] Create `src/features/<feature>/index.ts` barrel
- [ ] Verify: no imports from `pages/` or other `features/`
- [ ] Verify: UI primitives from `shared/ui` only
- [ ] Verify: `QueryErrorPanel` for load failures
- [ ] Verify: Paging + Infinite Scroll footer (if CRUD list)
- [ ] Verify: no hardcoded hex colors — CSS variables only

---

## Phase 6: Page Entry & Routing

- [ ] Create `src/pages/<Feature>.tsx` (thin wrapper, <15 LOC)
- [ ] Wire route in `src/App.tsx` or `src/app/routes/lazyPages.ts`
- [ ] Add role guard if required (`RequireRoleLayout`)
- [ ] Add menu entry in `src/config/menu.json` (if applicable)

---

## Phase 7: Styling & Theme (if new tokens needed)

- [ ] Add new color/surface tokens to `src/index.css` `@theme` block
- [ ] Use new Tailwind utility classes in components (not raw hex)
- [ ] Update `src/shared/ui/surfaceClasses.ts` if non-Tailwind consumers need constants

---

## Phase 8: Verification & Cleanup

- [ ] `npx tsc --noEmit` — passes
- [ ] `npx vitest run` — passes
- [ ] `npm run build` — passes
- [ ] Manual smoke test: list, create, edit, delete (per spec)
- [ ] Manual smoke test: error states and retry
- [ ] Manual smoke test: role/permission restrictions
- [ ] No `console.log` debug artifacts left behind
- [ ] Update `tasks.md` — all items checked

---

## Post-Implementation

- [ ] Update `spec.md` status to `Done`
- [ ] Note any deviations from plan in a `## Implementation Notes` section below
- [ ] Product owner sign-off

---

## Implementation Notes

<!-- Agent: document any deviations, discovered issues, or follow-up work here. -->

-

---

## Task Progress Summary

| Phase | Total | Done | Status |
| --- | ---: | ---: | --- |
| Pre-Implementation | 4 | 0 | Not Started |
| Phase 1: Shared | 5 | 0 | Not Started |
| Phase 2: Domain | 5 | 0 | Not Started |
| Phase 3: Services | 8 | 0 | Not Started |
| Phase 4: Database | 5 | 0 | Not Started |
| Phase 5: Frontend | 18 | 0 | Not Started |
| Phase 6: Routing | 4 | 0 | Not Started |
| Phase 7: Styling | 3 | 0 | Not Started |
| Phase 8: Verification | 9 | 0 | Not Started |
