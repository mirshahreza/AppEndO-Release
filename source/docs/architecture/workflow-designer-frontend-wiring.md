# Workflow Designer — frontend wiring (Slice 11 architecture decision)

Status: decided, 2026-07-14, as part of Workflow Engine Slice 11 ([`workflow-engine-testing.md`](../standards/workflow-engine-testing.md)).

## Context

Slices 1–10 built the entire durable Workflow Engine (`src/server/domain/workflow/`) as server-side
domain logic with zero UI surface. Slice 11 is the first slice that has to expose that engine to a
browser. AppEndO already has a "Designer" concept (`src/domain/component-designer/`,
`src/app/platform/DesignerPublishedShell.tsx`) — that is the *component/page* designer for the
"vibe coding platform" product surface and has no relationship to Workflow. Workflow's own Designer
(doc 08, "Designer and Authoring") is a **separate, first-class Core navigation surface** per doc
08 §1's center-of-gravity invariant: "Unrelated product-specific authoring surfaces are not
Workflow Designer navigation." Nothing from `component-designer` is reused.

## Decision

1. **Server transport**: a conventional Express controller/routes pair
   (`src/server/controllers/workflowDesigner.controller.ts`,
   `src/server/routes/workflow-designer.routes.ts`), mounted in `bootstrapFullRuntime.ts` next to
   every other feature's routes — no new transport framework. Every handler is a thin adapter: it
   parses the request, calls exactly one already-tested domain/service function under
   `src/server/domain/workflow/designer/`, and maps `WorkflowDomainError` to an HTTP status
   (`409` for `*_STALE_*`/CAS-fence codes, `400` for every other domain error, `500` otherwise).
   This is a **working transport for the Designer UI**, not the formal doc 10 Integration/API
   Contract review — that is delivery-plan item 12, a separate later slice, and is explicitly out
   of scope here.
2. **Client**: a new React feature area under `src/features/workflow-designer/` (own routing entry,
   own components), following the same Feature-Sliced-Design boundary convention
   `src/shared/lib/__tests__/fsdImportBoundaries.test.ts` already enforces for every other feature.
3. **Graph canvas**: a **custom, dependency-free SVG/DOM canvas**, not `react-flow`/`@xyflow/react`.
   Doc 08 §2's normative text ("React Flow is a projection... moving nodes changes view state
   only... positions/viewport/comments do not affect semantic fingerprint or execution") is
   read as describing the *required behavior* — semantic/view separation — using React Flow as the
   illustrative mental model, not as a hard dependency mandate; nothing elsewhere in the frozen
   contract (docs 01–11) names the package `react-flow`/`@xyflow/react` as a required dependency,
   and no other AppEndO feature currently depends on it. A custom canvas satisfies the actual
   normative requirement (dragging writes only `WorkflowDesignerView.viewJson`; connecting/deleting
   translates to explicit `ADD_EDGE`/`REMOVE_EDGE`/`REMOVE_NODE` draft operations; positions never
   enter the semantic fingerprint) without a new third-party dependency's maintenance/security
   surface for a first Designer slice. If a future slice needs richer graph interaction (multi-node
   drag-select, auto-layout, minimap), swapping in `@xyflow/react` behind the same
   `WorkflowDesignerView` contract is a pure UI-layer change — no domain/service code depends on
   which canvas library renders it.
4. **State/version discipline**: the client always carries the exact `draftVersion` /
   `expectedInstanceStateVersion` / etc. it last loaded and never optimistically increments it
   locally (doc 08 §3, §12) — every mutation command round-trips to the server and reconciles from
   the server's returned record on success, and surfaces `WF_DEF_STALE_DRAFT_VERSION` (etc.) as an
   explicit "reload" prompt rather than an automatic retry, per doc 08 §12's "a newer draft
   invalidates the displayed validation/publication confirmation and requires refresh."

## Consequences

- No new runtime dependency was added for the graph canvas.
- The Designer UI can only ever express what `WorkflowDraftOperation` already allows — there is no
  UI-side shortcut that mutates AWM JSON directly; every semantic command becomes exactly one
  `ApplyDraftOperations` call, matching doc 02 §12/§13.
- Simulation, duplication, publish-diff and the reference picker all call already-independently-
  tested `src/server/domain/workflow/designer/*` services — the controller adds no business logic,
  keeping the "one validation/diff/simulation authority" invariants intact end-to-end.
