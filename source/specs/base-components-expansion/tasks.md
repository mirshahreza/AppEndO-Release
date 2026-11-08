# Base Components Expansion — Implementation Tasks

## Metadata

| Field | Value |
| --- | --- |
| **Feature slug** | `base-components-expansion` |
| **Spec reference** | `specs/base-components-expansion/spec.md` |
| **Plan reference** | `specs/base-components-expansion/plan.md` |
| **Status** | `Done` |
| **Started** | 2026-08-03 |
| **Completed** | 2026-08-03 |

---

## Pre-Implementation

- [x] Read `.specify/memory/constitution.md`
- [x] Confirm independent `spec.md` is approved
- [x] Confirm independent `plan.md` is approved
- [x] Freeze scope: 38 sections, all 30 current sections expanded, production navigation wiring
- [x] Confirm SS-0+ Shell Studio compiler/editor/persistence/publish is excluded
- [x] Rerun Base Components/Shell kit reality checks against current HEAD

---

## BC-1A — Catalog Metadata Foundation

- [x] Create catalog metadata types from p-85
- [x] Create and validate evidence registry
- [x] Create component/export classification
- [x] Create section option shards for 38 target sections
- [x] Implement condition/conflict/requirement resolution
- [x] Implement `{ public, composition, demo }` config export
- [x] Implement pairwise case generation
- [x] Implement shared Decision/Anatomy/Presets/Options panels
- [x] Implement shared States/Responsive/Accessibility/Anti-options panels
- [x] Implement API Mapping/Coverage panels
- [x] Implement shared metadata configurator shell and hooks
- [x] Add catalog/evidence/orphan/duplicate/prop-mapping tests
- [x] Migrate section maturity to `experimental|supported|preferred|deprecated`

---

## BC-1B — Tabs Reference Slice

- [x] Extend `UiTabs` to the complete p-85 content-tabs contract
- [x] Add `UiWorkspaceTabs`
- [x] Add `UiSegmentedControl`
- [x] Add lifecycle/activation and width/item-count constraints
- [x] Add icon/label/badge/status fixtures
- [x] Add close/add/reorder/pin/dirty/error workspace scenarios
- [x] Add non-drag reorder actions and focus-after-close behavior
- [x] Rebuild Tabs workspace on the metadata configurator
- [x] Add APG keyboard, focus, RTL, overflow and responsive tests

---

## BC-2 — Shell Foundation Kit

- [x] Implement `ShellFrame`, `ShellRegion`
- [x] Implement `ShellHeader`, `ShellSidebar`, `ShellContentHost`
- [x] Implement `ShellAside`, `ShellHero`, `ShellFooter`
- [x] Implement `ShellSurface`, `ShellLogoRegion`
- [x] Implement `ShellHeaderContext`, `ShellHeaderActions`
- [x] Implement `ShellResponsiveDrawer`, `ShellResponsivePopover`
- [x] Implement `ShellAccentControl`, `ShellMotionControl`, `ShellBackToTop`
- [x] Export all Foundation components through `shared/ui`
- [x] Add controlled behavior, direction, responsive and focus tests

---

## BC-3 — Navigation Component Kit

- [x] Implement all p-80 navigation primitives
- [x] Implement sidebar standard/rail/mega compositions
- [x] Implement top standard/overflow/mega compositions
- [x] Implement mega panel/group/featured primitives
- [x] Implement mobile drawer/popover compositions
- [x] Implement footer/context/search/utilities compositions
- [x] Add navigation fixture catalog
- [x] Extend platform navigation component metadata
- [x] Replace `MegaMenu` stub through production adapter
- [x] Replace `TopDrawerNav` stub through production adapter
- [x] Extract/reuse standard top/sidebar/footer navigation behavior
- [x] Add keyboard, Escape, focus-return, route-close, RTL and viewport tests
- [x] Add built-in shell adapter regression tests

---

## BC-4 — Visual Effects Component Kit

- [x] Implement `ShellEffectStack` and `ShellEffectLayer`
- [x] Implement closed 20-effect catalog
- [x] Implement discriminated parameter schemas
- [x] Implement 40 curated presets
- [x] Implement deterministic seed handling
- [x] Implement maximum-four-layer validation
- [x] Implement cost-tier validator and diagnostics
- [x] Implement offscreen/tab-hidden pause
- [x] Implement reduced-motion/transparency/data and mobile fallbacks
- [x] Add catalog, determinism, fallback, cost and corpus tests

---

## BC-5A — Existing and General Catalog Expansion

- [x] Add `UiDisclosure`
- [x] Add five new section IDs/routes/icons/themes/descriptions
- [x] Implement Accordion & Disclosure workspace
- [x] Implement Popover & Tooltip workspace
- [x] Implement Date & Time workspace
- [x] Implement File & Media Input workspace
- [x] Implement Loading/Error/Empty workspace
- [x] Expand Actions workspaces
- [x] Expand Layout & Chrome workspaces
- [x] Expand Dialog workspaces
- [x] Expand Data workspaces
- [x] Expand Form workspaces and subsection anchors
- [x] Implement 16-widget Relations nested configurator
- [x] Expand Feedback workspaces
- [x] Expand Identity workspaces
- [x] Align Chart purpose/kind/accessibility scenarios
- [x] Align Kanban keyboard/programmatic/phone scenarios
- [x] Add section-level coverage tests for all 35 general sections

---

## BC-5B — Shell Galleries

- [x] Add Shell group and three section IDs/routes/icons/themes/descriptions
- [x] Implement Shell Foundation workspace using production exports
- [x] Implement Shell Navigation workspace using production exports
- [x] Implement Shell Effects workspace and layer composer
- [x] Add LTR/RTL, viewport, reduced-motion and forced-colors controls
- [x] Add API/capability/fallback/accessibility documentation panels
- [x] Add inventory/export/demo/test bijection tests
- [x] Confirm total catalog target is 38 sections

---

## Verification

- [x] Focused catalog tests pass
- [x] Focused Tabs tests pass
- [x] Focused Foundation tests pass
- [x] Focused Navigation and adapter regression tests pass
- [x] Focused Effects tests pass
- [x] Base Components route/coverage tests pass
- [x] `npx tsc --noEmit` introduces zero new errors
- [x] `npx vitest run` passes or all pre-existing unrelated failures are documented
- [x] `npm run build` passes
- [x] No new lint diagnostics in edited files
- [x] No direct HeroUI imports outside allowed wrapper/runtime boundaries
- [x] No demo clone, unsupported stub or unmapped supported export remains

---

## Explicit Exclusion Gate

- [x] No Shell Studio route/page/editor/list was added
- [x] No recipe compiler/normalizer was added
- [x] No shell draft persistence/publish/portal/package API was added
- [x] No runtime recipe interpretation was added

---

## Post-Implementation

- [x] Mark this spec and task set `Done`
- [x] Keep p-82 and p-78 unchanged because Shell Studio is outside this independent feature
- [x] Keep Shell Studio central plan indexes unchanged
- [x] Record implementation deviations below

## Implementation Notes

- Independent SDD feature created because Product Owner requested Base Components only; Shell Studio SS-0+ remains separately gated.
- The full TypeScript run still reports the repository's existing generated `packages-storage` and `workspace/server-functions` diagnostics; no diagnostic references a changed Base Components or shell-kit file.
- The full Vitest run completed with 1086 files / 6355 tests passing and 50 files / 89 tests failing in existing package, Component Designer, culture-provider, file-manager and other unrelated suites. Focused Base Components and shell-kit verification passes (18 files / 75 tests); the existing Admin Shell RTL and p-06 tests still fail on their prior missing provider/reveal timing assumptions, outside the changed Mega/Drawer adapter paths.
- Production build passes. Build/test-generated registry, attribution, rule and workspace snapshot artifacts were removed after verification.
