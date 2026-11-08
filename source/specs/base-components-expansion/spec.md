# Base Components Expansion — Feature Specification

## Metadata

| Field | Value |
| --- | --- |
| **Feature slug** | `base-components-expansion` |
| **Author** | AI Agent with Product Owner decisions |
| **Status** | `Done` |
| **Created** | 2026-08-03 |
| **Last updated** | 2026-08-03 |
| **Constitution version** | 2.0.0 |
| **Normative product contract** | this spec |

---

## Feature Goal

Expand Base Components into the production component laboratory for AppEndO. The catalog will expose meaningful content, behavior, layout, appearance, state, responsive and accessibility options for every supported public component; add the missing component families; and implement the Shell Foundation, Navigation and Effects kits as real shared components before any Shell Studio generator work.

### Problem Statement

The current catalog has 30 sections, but many workspaces demonstrate only a small fraction of their component contracts. Tabs exposes only orientation and variant, several public shared components have no catalog coverage, navigation mega/drawer renderers are stubs, and no Shell Foundation/Navigation/Effects kits exist. This makes the catalog insufficient as a design authority and leaves later shell generation dependent on implementation-time decisions.

### Desired Outcome

Developers can inspect, configure and test all public Base Components through one consistent metadata-driven catalog. Every option is classified as public prop, composition prop, fixture, scenario or catalog-only; invalid combinations are prevented; public components are production implementations rather than demo clones; and all 38 target sections pass export/demo/test coverage.

### Success Criteria

- [x] The current 30 sections are rebuilt against the p-85 option registry.
- [x] Five general sections are added: Accordion & Disclosure, Popover & Tooltip, Date & Time, File & Media Input, Loading/Error/Empty.
- [x] Three Shell sections are added: Shell Foundation, Shell Navigation and Shell Effects.
- [x] Tabs is split into `UiTabs`, `UiWorkspaceTabs` and `UiSegmentedControl` with the complete p-85 contract.
- [x] All 17 Shell Foundation components, all Navigation primitives/compositions and all 20 Effects are real `shared/ui` exports.
- [x] Existing Mega Menu and Top Drawer stubs are replaced by production shared navigation components and wired through existing adapters.
- [x] Catalog metadata, evidence, option constraints, config export and pairwise coverage are validated in CI.
- [x] Every supported public component maps to exactly one primary demo and at least one test.
- [x] Keyboard, RTL, viewport, forced-colors and reduced-motion requirements pass for applicable components.
- [x] No Shell Studio compiler, editor, recipe persistence, publishing API or shell generation UI is implemented in this feature.

### Out of Scope

- Shell Studio routes, page, editor and list UI.
- `ShellRecipeV1` compiler/normalizer and canonical shell generation.
- Shell draft metadata persistence, lifecycle, publish/register, portal assignment and package orchestration.
- Runtime recipe interpretation.
- Changes to built-in shell visual design beyond replacing navigation stubs with compatible production adapters.
- New database tables or APIs.

---

## User Stories

### US-1: Explore option-rich components

**As a** developer  
**I want** every Base Component to expose its meaningful supported options  
**So that** I can evaluate and reuse components without discovering behavior during feature implementation.

**Acceptance Criteria:**

- [ ] AC-1.1: All 38 sections use the shared catalog information architecture.
- [ ] AC-1.2: Config export separates public, composition and demo values.
- [ ] AC-1.3: Unsupported combinations are disabled or normalized according to metadata.

**Priority:** `Must Have`

### US-2: Use complete Tabs patterns

**As a** developer  
**I want** content tabs, document workspace tabs and segmented controls to be separate components  
**So that** close/reorder/lifecycle semantics remain correct and accessible.

**Acceptance Criteria:**

- [ ] AC-2.1: `UiTabs` supports icon/label modes, placement, alignment, width, activation, lifecycle and overflow.
- [ ] AC-2.2: `UiWorkspaceTabs` supports close/add/reorder/pin/dirty/error and non-drag alternatives.
- [ ] AC-2.3: `UiSegmentedControl` provides compact single selection without tab panels.
- [ ] AC-2.4: APG keyboard, focus, RTL and responsive tests pass.

**Priority:** `Must Have`

### US-3: Reuse production shell components

**As a** platform developer  
**I want** real shared Foundation, Navigation and Effects components  
**So that** future shells and current adapters share tested production behavior.

**Acceptance Criteria:**

- [ ] AC-3.1: Shell kits are recipe-independent shared UI exports.
- [ ] AC-3.2: Mega/Drawer stubs are replaced and existing built-in adapters retain behavior.
- [ ] AC-3.3: All 20 effects have deterministic presets, cost metadata and accessibility fallbacks.
- [ ] AC-3.4: Shell kit galleries import production exports only.

**Priority:** `Must Have`

---

## Business Logic

### Entities & Relationships

| Entity | Key Fields | Notes |
| --- | --- | --- |
| Component metadata | ID, family, kind, maturity, anatomy, option IDs | Catalog documentation authority |
| Option metadata | ID, axis, disposition, control, default, constraints, evidence | Maps meaningful options to UI and tests |
| Evidence entry | ID, URL, observed date, supported decisions | Required by option metadata |
| Catalog section | section ID, group, label, maturity | 38 top-level target sections |
| Production component | shared export ID and public props | Runtime authority |
| Demo mapping | component ID, section/anchor, scenarios | Exactly one primary mapping |
| Effect metadata | effect ID, parameters, presets, cost, fallback | Closed 20-effect catalog |

### Rules & Constraints

1. **R1:** p-85 is authoritative for taxonomy, option IDs, Tabs contracts, target sections and anti-options.
2. **R2:** HeroUI v3 wrappers are used whenever HeroUI supplies the behavior.
3. **R3:** Demo controls do not become public props unless disposition is `public-prop`.
4. **R4:** Mutually exclusive behaviors use discriminated modes, not boolean combinations.
5. **R5:** Public component props, excluding the p-85 infrastructure allowlist, require metadata mapping.
6. **R6:** Workspaces import production exports; demo clones are forbidden.
7. **R7:** The catalog target is 38 sections: 30 current + 5 general + 3 Shell.
8. **R8:** Mega Menu and Top Drawer are production implementations in this feature, not deferred stubs.
9. **R9:** Effects are decorative, pointer-inert, deterministic and bounded by cost/fallback policy.
10. **R10:** Shell components remain independent of Shell Studio recipes and feature code.
11. **R11:** Existing built-in shell adapters must pass regression tests after navigation integration.
12. **R12:** The feature is incomplete if any supported export lacks metadata, demo or test coverage.

### State Transitions

```text
experimental → complete contract + product consumer + tests → supported
supported → preferred by platform policy → preferred
supported/preferred → replacement + migration note → deprecated
```

### Edge Cases & Error Scenarios

| Scenario | Expected Behavior |
| --- | --- |
| Invalid option combination | Disable/reset deterministically and report the constraint |
| Unknown option/evidence/component ID | Catalog validation fails |
| Duplicate primary demo | Coverage validation fails |
| Tab panel is lazy/unmounted with automatic activation | Automatic activation is disabled and reset to manual |
| Equal-width Tabs exceed five items | Width resets to fit |
| Navigation data is empty or route unavailable | Explicit empty/unavailable state; no crash |
| Reduced motion/forced colors | Effects simplify/hide and semantic boundaries remain visible |
| Pointer drag unavailable | Keyboard and explicit move actions remain available |

### Permissions & Roles

No new permissions are introduced. Base Components keeps its existing Development-page access and route guard.

---

## UI/UX Notes

- Page type: existing Tier-D Base Components workspace.
- Preserve current named groups, featured strip, configurator/preview split and route behavior.
- Add metadata-driven Decision, Anatomy, Presets, Options, States, Responsive, Accessibility, Anti-options, API and Coverage panels.
- Use English-only application copy and HeroUI wrappers.
- Follow p-85, `AGENTS.md`, `ui-core.md`, `ui-dialog.md`, `ui-toolbar.md` and `ui-grid.md`.

---

## Dependencies & Integrations

| Dependency | Type | Notes |
| --- | --- | --- |
| HeroUI v3 / React Aria | Existing library | Primitive behavior and accessibility |
| Existing Base Components feature | Existing feature | Expanded in place |
| `src/shared/ui` | Existing shared layer | Production component ownership |
| Platform navigation manifests | Existing contract | Navigation fixtures/adapters |
| Existing admin-shell nav renderers | Existing integration | Replace stubs through adapters |
| p-80 frozen matrix | Supporting contract | Shell component/effect inventories |
| p-85 option system | Normative contract | Exact catalog and option behavior |

---

## Product Owner Decisions

On 2026-08-03 the Product Owner explicitly selected:

1. Full 38-section scope, including Shell Foundation, Shell Navigation and Shell Effects.
2. Complete expansion of all 30 current sections plus five new general sections.
3. Production integration of new Navigation components and replacement of Mega/Drawer stubs.

## Open Questions

None.

---

## Approval

| Role | Name | Date | Status |
| --- | --- | --- | --- |
| Product Owner | Mohsen | 2026-08-03 | `Approved` |

Approval basis: explicit implementation request followed by explicit selections for all three scope decisions recorded above.
