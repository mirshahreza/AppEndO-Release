# 19 — Reusable Component Resolution Engine: Spec + Implementation Plan

> **Status:** Not implemented. This document is the spec and plan for a future implementation pass — it does not implement anything itself. Written after Section 2.1 of the full toolbox audit (`docs/refactor-spec/CLAUDE-FULL-AUDIT-LOG.md`, Cluster F) found and confirmed this gap directly against the current code.

---

## 1. The problem, confirmed against the real code

A user can drag a "Reusable Component" from the Toolbox onto the canvas. This creates a `reusable-slot` node (`nodeType: 'reusable-slot'`, see `src/domain/component-designer/reusablePalette.ts`) that references another designer document via `node.componentRef.{refType, refId, version}` or the legacy `node.props.componentId`.

**Confirmed by direct grep of the entire non-test codebase:** `isReusablePaletteItemId`, `REUSABLE_PALETTE_ITEM_ID_PREFIX`, and `getComponentIdFromPaletteItemId` (all defined in `reusablePalette.ts`) are referenced **nowhere else** — not in `designerRuntimePreview.tsx`, not in `runtimeRenderer.tsx`, not in `tsxNodeRenderer.ts`/`tsxUniversalPalette.ts`. No code path resolves a `reusable-slot` node's reference and renders the referenced document's actual content, in:

- the **live edit canvas** (`src/features/component-designer/canvas/`)
- **preview** (`designerRuntimePreview.tsx` — this is also the *same* code path that renders actually-published pages/shells at runtime, so this gap affects real published output, not just the designer)
- **export/codegen** (`tsxNodeRenderer.ts`, `tsxUniversalPalette.ts`)

Every path falls through to a static "Reusable Component" placeholder. This is confirmed, not inferred from a maturity-report label.

**What already exists and works, so the fix is narrower than "build the feature from scratch":**

| Piece | Status | Where |
|---|---|---|
| Palette entry generation (`reusable.component.<id>`) | ✅ Works | `reusablePalette.ts` |
| Server catalog of available reusable components (drafts + installed package UI components) | ✅ Works | `component-designer.service.ts` → `reusableComponentsCatalog()` |
| Reference data model (`componentRef.refType`/`refId`/`version`) | ✅ Works, already dispatched via `set-node-source-settings` reducer action | `DesignerInspector.tsx` lines ~884–951, `state.ts` reducer |
| Prop-override UI (parent can pass values into the referenced child) | ✅ UI exists | `DesignerInspector.tsx` — "Props Override" section, ~line 140, 777 |
| Version pinning UI (blank = latest, set = pinned) | ✅ UI exists and dispatches correctly | `DesignerInspector.tsx` line 931 (`DesignerFieldRow label="Version"`) |
| Fetching a document by id | ✅ Exists | `getDesignerDraft(lookup)`, `getDesignerDraftVersion(draftId, version)` in `src/server/domain/component-designer/draftIo.ts` |
| Published-version lookups | ✅ Exists | `listDesignerPublishedVersionSummaries`, `resolvePublishedDesignerDraftLookup` in `src/server/domain/component-designer/publishIo.ts` / `publishCoordinator.service.ts` |
| **Actually resolving the reference into rendered content, anywhere** | ❌ **Missing entirely** | — |

So: the data model, the UI to configure a reference, and the backend data-access functions to fetch a referenced document all already exist and are already wired correctly. What's missing is purely the **render-time resolution step**: given a `reusable-slot` node, fetch the referenced document and recursively render its node tree in place — in preview, in the live canvas, and in export.

---

## 2. Why this needs a plan, not a quick patch

Unlike the ~28 bugs fixed elsewhere in Section 2.1 (each a narrow, single-widget wiring gap), this requires:

1. **Recursive rendering.** The resolver must call back into the *same* node-tree renderer that renders top-level documents, to render the referenced document's tree — including the possibility that the referenced document *itself* contains reusable-component nodes (nesting).
2. **Cycle detection.** Component A referencing B referencing A must be detected and fail gracefully (a visible error state), not infinite-loop or crash the browser tab.
3. **Two independent render targets that must produce equivalent output** (preview vs. export), same parity discipline as every other capability in this codebase (see `bindingParitySnapshot.test.ts` for the existing pattern to extend).
4. **Async data fetching in a synchronous-feeling render path.** Preview rendering today is largely synchronous per-node; resolving a reusable component requires a network/IO fetch (draft or published document lookup), which needs a loading state, not a naive blocking call.
5. **A product decision embedded in the mechanism**: does export *inline* the referenced document's compiled JSX directly into the exported file (simplest, but duplicates code across every consumer and bakes in the version at export time), or does it *import* the referenced component as a real React component/module reference (cleaner, but requires the export pipeline to also emit/link a build artifact for the referenced component, which is a bigger pipeline change)? See Decision Point 1 below — **this needs a product call, don't build silently around it.**

---

## 3. Proposed architecture

### 3.1 Preview / live canvas (client-side, browser)

Add a new resolution layer, e.g. `src/domain/component-designer/reusableComponentResolver.ts`:

```ts
type ReusableResolutionResult =
  | { status: 'loading' }
  | { status: 'resolved'; document: DesignerDocument; bindingDefinitions: DesignerBindingDefinitions }
  | { status: 'error'; reason: 'not-found' | 'cycle' | 'fetch-failed'; detail: string };

// Client-side fetch — needs a REST endpoint exposing getDesignerDraft/getDesignerDraftVersion
// by id (+ optional version). Confirm the exact route when implementing; none currently
// exposes single-draft-by-id fetch to the browser for this purpose — reusableComponentsCatalog()
// only returns the *list* summary, not full documents. This is very likely the one genuinely
// new backend surface this feature needs.
const resolveReusableComponentRef = async (
  componentRef: DesignerNode['componentRef'],
  resolutionStack: readonly string[], // for cycle detection — pass refId chain down through recursive calls
): Promise<ReusableResolutionResult> => { /* ... */ };
```

Integration points:
- `designerRuntimePreview.tsx` / `runtimeRenderer.tsx`: add a `case 'reusable-slot':` (or equivalent dispatch) that calls the resolver, handles the 3 states (loading spinner / resolved → recursively call the *same* node-tree render function on the referenced document's root, passing prop overrides down / error → visible error box, not a silent placeholder), and threads `resolutionStack` through recursive calls for cycle detection.
- **Prop overrides**: the existing "Props Override" UI (`DesignerInspector.tsx` ~line 140) already stores override values somewhere on the node — confirm exactly where (likely `node.props` or a dedicated `node.componentRef.propOverrides` field) and thread them into the referenced document's root-node props at resolution time, without mutating the cached/shared referenced document object (each resolution must produce an overridden *copy*, since the same reusable component can be instanced multiple times with different overrides).
- **Caching**: don't refetch the same `refId`+`version` on every render — cache resolved documents (e.g., a simple `Map` keyed by `refId:version`, invalidated on document save/publish events that are likely already broadcast somewhere for the live-canvas-refresh mechanism — check `useDesignerVersions.ts`/`useDesignerPublish` hooks for an existing invalidation signal to hook into rather than inventing a new one).

### 3.2 Export / codegen (`tsxNodeRenderer.ts`, `tsxUniversalPalette.ts` or a new `tsxReusablePalette.ts` mirroring the pattern used for `tsxPlatformPalette.ts` added in Cluster F)

This is where Decision Point 1 (inline vs. import) matters most. Recommended default, pending product sign-off: **inline at export time**, matching how this codebase already treats most content — the export pipeline already resolves bindings, LOV data, etc. into a single self-contained `GeneratedComponent`. Concretely:

- `generateDesignerTsx` needs to accept (or internally resolve) the referenced document for every `reusable-slot` node present, recursively, before rendering — likely a pre-pass that walks the document tree, collects all `reusable-slot` refs, resolves them (server-side, since codegen typically runs server-side per `codegen.ts`), and passes the resolved sub-documents into the render call so `renderDesignerDocumentBodyJsx` can recurse into them the same way the preview renderer does.
- Cycle detection applies identically here.
- **Versioning at export time**: if `version` is blank (auto-latest), what gets baked in is whatever is latest *at export time* — this is a one-time snapshot, not live-updating, same as any other static export. Pinned versions are unambiguous. Confirm this matches user expectation (see Decision Point 2).

### 3.3 Shared: a single resolution function, not two parallel implementations

To avoid a *new* preview/export parity bug (the exact class of bug this whole audit has been hunting), the actual "fetch + prop-override + cycle-check" logic should be a single shared function called from both the client-side (preview) resolver and the server-side (codegen) resolver — only the *data-fetching* transport differs (client fetches over HTTP, server calls `getDesignerDraft` directly in-process). Structure the module so the fetch mechanism is injectable (mirrors how `bindingParity/harness.ts` and other engine/codegen pairs in this codebase already share core logic and only diverge at the I/O boundary).

---

## 4. Decision points needing a product call before implementation

1. **Export: inline vs. import.** Recommended: inline (see 3.2). Confirm.
2. **Auto-update vs. pin semantics for *preview*, not just export.** If a reusable component's source draft changes while a *parent* document has it unpinned (blank version), should the parent's live preview immediately reflect the change (fully live), or only on next explicit reload/save of the parent? Recommended: fully live for preview (matches "what you see is what's live" principle already established elsewhere in this codebase), pin only affects publish/export snapshots. Confirm.
3. **Circular reference UX.** Recommended: render a clearly-styled error box in place of the node (similar to the existing `renderPreviewPlaceholder`/`isUnimplementedHeroUiNode` pattern already in `designerRuntimePreview.tsx`) with the cycle chain shown, not a console-only error. Confirm this is sufficient, or whether the Canvas should also flag it in an outline/error panel.
4. **Depth/complexity limits.** Should nesting depth or total resolved-node-count be capped (to prevent a pathological but non-cyclic deeply-nested reference chain from freezing the canvas)? Recommended: yes, a sane cap (e.g., depth 10) with a clear error past that, but this is a minor detail, not a blocker for the initial implementation.

---

## 5. Phased implementation plan

**Phase R-1 — Backend: expose single-document fetch to the client.**
Add (or confirm/reuse) a REST endpoint the browser can call to fetch a specific draft/published document by `refId` + optional `version`, backed by `getDesignerDraft`/`getDesignerDraftVersion`/`resolvePublishedDesignerDraftLookup`. Write DOM/integration-level test: real HTTP call (or the project's equivalent server-test harness) returns the expected document shape for a known fixture draft.

**Phase R-2 — Shared resolution core.**
Build `reusableComponentResolver.ts` (fetch injectable, cycle detection, prop-override merging, caching hook points) as pure logic, unit-testable but designed to be driven by Phase R-3/R-4's real rendering tests, not just isolated function tests (per this whole audit's standing rule — a green unit test alone proves nothing here).

**Phase R-3 — Preview + live canvas integration.**
Wire the resolver into `designerRuntimePreview.tsx`/`runtimeRenderer.tsx`. Required DOM-level tests (render real component + assert real DOM, per the audit's standing methodology):
- Dropping a reusable component instance renders the *referenced document's actual content*, not a placeholder.
- Editing the *referenced* component's own document (in a separate draft) and reloading the parent preview reflects the change (or doesn't, per Decision Point 2's resolution).
- Prop overrides configured on the instance actually reach the referenced document's root node props in the rendered DOM.
- A circular reference (A → B → A) renders the defined error state, doesn't hang/crash.
- Nesting 2+ levels deep (reusable component containing another reusable component) renders correctly.

**Phase R-4 — Export/codegen integration.**
Wire the shared resolver into `codegen.ts`/`tsxNodeRenderer.ts`. Required test: a **binding-parity-style** test (extend `bindingParitySnapshot.test.ts`'s pattern) proving preview and exported/compiled output produce equivalent rendered structure for the same reusable-component fixture, exactly matching this codebase's established Engine/Codegen parity discipline (see Section 2.2 of the main audit).

**Phase R-5 — Real user validation.**
Per this codebase's own established practice (`t1-14-validation`/`t1-37-validation` folders), build one real fixture scenario: a genuine reusable component (e.g., a "Profile Card") referenced from 2+ different parent documents with different prop overrides in one, a pinned version in another — confirm all render correctly end-to-end, by hand, not just via automated tests.

---

## 6. Files most likely touched (confirm exact list at implementation time — do not treat this as exhaustive)

- New: `src/domain/component-designer/reusableComponentResolver.ts`
- New (probably): `src/domain/component-designer/tsxReusablePalette.ts` (export-side, mirrors `tsxPlatformPalette.ts`)
- New: a server route exposing single-document-by-id fetch to the browser (Phase R-1) — or confirm one doesn't already exist under a different name before assuming it needs to be built.
- `src/domain/component-designer/designerRuntimePreview.tsx`, `runtimeRenderer.tsx` — add `reusable-slot` render case.
- `src/domain/component-designer/tsxNodeRenderer.ts`, `codegen.ts` — add `reusable-slot` codegen case + pre-resolution pass.
- `src/domain/component-designer/bindingParity/` — extend with a reusable-component parity fixture.
- Likely NOT touched: `DesignerInspector.tsx`, `reusablePalette.ts`, the reducer/`state.ts` source-settings action — these are already correct and don't need changes for this feature to work.
