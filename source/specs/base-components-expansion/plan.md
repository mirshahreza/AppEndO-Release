# Base Components Expansion — Implementation Plan

## Metadata

| Field | Value |
| --- | --- |
| **Feature slug** | `base-components-expansion` |
| **Spec reference** | `specs/base-components-expansion/spec.md` |
| **Status** | `Approved` |
| **Created** | 2026-08-03 |
| **Planner** | AI Agent |

---

## Plan Summary

Implement the Base Components expansion as an independent, frontend-focused feature governed by p-85. First establish catalog metadata and prove it with the Tabs vertical slice. Then build recipe-independent Shell Foundation, Navigation and Effects kits, expand all existing workspaces, add eight sections and pass completeness/accessibility/regression gates. No Shell Studio compiler, editor, persistence or publishing code is included.

---

## Frontend Architecture

### Route & Page Entry

| Item | Path / Value |
| --- | --- |
| Route path | Existing `/{culture}/studio/base-components/{section?}` |
| Page entry | Existing Base Components page |
| Lazy loaded? | Existing behavior preserved |
| Role guard | Existing Development-page guard |

### Feature Structure

```text
src/features/base-components/
├── catalog/
│   ├── baseComponentOptionTypes.ts
│   ├── baseComponentEvidenceRegistry.ts
│   ├── baseComponentCatalog.ts
│   ├── validateBaseComponentCatalog.ts
│   ├── resolveBaseComponentConfig.ts
│   ├── generatePairwiseCases.ts
│   └── sections/*.options.ts
├── components/catalog/
│   ├── BaseComponentsMetadataConfiguratorShell.tsx
│   ├── BaseComponentsDecisionPanel.tsx
│   ├── BaseComponentsAnatomyPanel.tsx
│   ├── BaseComponentsPresetsPanel.tsx
│   ├── BaseComponentsOptionsPanel.tsx
│   ├── BaseComponentsStatesPanel.tsx
│   ├── BaseComponentsResponsivePanel.tsx
│   ├── BaseComponentsAccessibilityPanel.tsx
│   ├── BaseComponentsAntiOptionsPanel.tsx
│   ├── BaseComponentsApiMappingPanel.tsx
│   └── BaseComponentsCoveragePanel.tsx
├── hooks/
│   ├── useBaseComponentsOptionState.ts
│   └── useBaseComponentsConfigExport.ts
├── <30-current-section>/
├── accordion-disclosure/
├── popover-tooltip/
├── date-time/
├── file-media-input/
├── loading-error-empty/
├── shell-foundation/
├── shell-navigation/
└── shell-effects/
```

### Shared UI Additions

```text
src/shared/ui/
├── UiTabs.tsx
├── UiWorkspaceTabs.tsx
├── UiSegmentedControl.tsx
├── UiDisclosure.tsx
├── shell-foundation/   # 17 p-80 components
├── shell-navigation/   # primitives + compositions
└── shell-effects/      # stack/layer + 20 effects
```

### Component Breakdown

| Component/Module | Responsibility | New / Reuse |
| --- | --- | --- |
| Catalog metadata | Closed component/option/evidence authority | New |
| Metadata configurator shell | Shared option panels and config export | New |
| `UiTabs` | APG content tabs | Extend |
| `UiWorkspaceTabs` | Document tabs with lifecycle actions | New |
| `UiSegmentedControl` | Compact single choice | New |
| `UiDisclosure` | Independent trigger/region | New |
| Shell Foundation kit | Structural shell primitives | New |
| Shell Navigation kit | Production nav primitives/compositions | New/extract |
| Shell Effects kit | Deterministic bounded effects | New |
| Existing 30 workspaces | Metadata-driven option-rich galleries | Refactor |
| Five general workspaces | Missing public component coverage | New |
| Three Shell workspaces | Production kit galleries | New |

### State

- Catalog option state remains local to each workspace.
- Metadata conditions resolve deterministically from option IDs.
- Config export uses `{ public, composition, demo }`.
- No server state or TanStack Query additions.

### FSD Boundary Checklist

- [x] No new page/route feature required.
- [x] Shared UI does not import feature code.
- [x] Base Components imports production components from `shared/ui`.
- [x] No cross-feature imports.
- [x] No new API client or persistence.

### Styling Plan

- Reuse existing Tailwind/theme tokens, `surfaceClasses.ts`, semantic tone maps and Base Components layout tokens.
- No raw color literals or arbitrary per-component palettes.
- Shell effects accept semantic/accent palettes and render decorative layers only.
- No new large colored surfaces outside existing semantic policies.

---

## Catalog Architecture

### Metadata

Implement p-85 types exactly:

- option axes;
- public/composition/fixture/scenario/catalog-only dispositions;
- conditions, conflicts and requirements by option ID;
- maturity enum;
- anatomy, states, accessibility and anti-options;
- evidence registry with HTTPS and date validation.

### Validation

CI/test validation must reject:

- unknown or duplicate IDs;
- unresolved evidence;
- invalid option conditions;
- missing public prop mappings outside the infrastructure allowlist;
- duplicate/missing primary demos;
- unsupported components presented as supported/preferred;
- orphan exports/options/tests.

### Generation Strategy

- Option definitions live in section shards, not duplicated in workspaces.
- Shared controls render metadata where behavior is generic.
- Complex previews remain hand-authored compositions.
- Pairwise tests are generated from orthogonal options plus explicit conflict boundaries.

---

## Tabs Vertical Slice

1. Replace current `orientation`/`primary|secondary` wrapper API with p-85 semantic API.
2. Implement manual/eager activation constraints and mounted-panel lifecycle.
3. Implement logical placement/alignment, equal/fit width and selected-item overflow visibility.
4. Add Workspace Tabs with close/add/reorder/pin/dirty/error and button alternatives.
5. Add Segmented Control with radio-group semantics.
6. Rebuild Tabs workspace as the reference metadata-driven section.
7. Add APG keyboard/focus/RTL/responsive tests.

---

## Shell Foundation Kit

Implement all p-80 exports:

`ShellFrame`, `ShellRegion`, `ShellHeader`, `ShellSidebar`, `ShellContentHost`, `ShellAside`, `ShellHero`, `ShellFooter`, `ShellSurface`, `ShellLogoRegion`, `ShellHeaderContext`, `ShellHeaderActions`, `ShellResponsiveDrawer`, `ShellResponsivePopover`, `ShellAccentControl`, `ShellMotionControl`, `ShellBackToTop`.

Constraints:

- controlled, recipe-independent props;
- no imports from Shell Studio or app feature code;
- logical direction/placement;
- responsive and focus contracts;
- shared semantic token inputs.

---

## Navigation Kit and Integration

### Production Components

Implement p-80 primitives and compositions under `src/shared/ui/shell-navigation/`.

### Existing Adapter Wiring

- extract reusable behavior from `TreeNavTwoLevel`, `TopBarNav` and `FlatLinks`;
- replace `MegaMenu` and `TopDrawerNav` stubs with adapters to production shared components;
- preserve existing public adapter props and built-in shell behavior;
- extend navigation component metadata without introducing Shell Studio recipe types;
- add grouped/deep/featured/long-label/RTL fixtures.

### Accessibility

- list/disclosure semantics by default;
- menubar/tree only with complete APG keyboard model;
- Escape, focus return and outside-press behavior;
- route activation closes overlays;
- drag is never required.

---

## Effects Kit

Implement the closed 20-effect p-80 catalog with:

- discriminated parameter schemas;
- 40 curated presets;
- deterministic seeded output;
- maximum four layers;
- CSS/SVG/Canvas 2D backend ownership;
- offscreen/hidden pause;
- reduced-motion/transparency/data and mobile fallbacks;
- pointer-inert decorative output;
- cost-tier diagnostics.

No arbitrary CSS, JavaScript, shaders or remote assets.

---

## Base Components Expansion

### Existing 30

Apply p-85 §6.8 metadata and required scenarios to every current workspace. Prioritize high-touch sections:

- Form Fields subsection anchors;
- 16-widget Relations nested configurator;
- Chart purpose/kind compatibility and accessible alternatives;
- Kanban keyboard/programmatic move;
- Sidebar Menu production mega/drawer integration.

### Five General Sections

- `accordion-disclosure`
- `popover-tooltip`
- `date-time`
- `file-media-input`
- `loading-error-empty`

### Three Shell Sections

- `shell-foundation`
- `shell-navigation`
- `shell-effects`

Catalog target: 38 sections.

---

## Backend / Database / API

No new backend routes, controllers, services, schemas, tables or persistence are required.

Existing Component Designer draft metadata, Shell Studio compiler/runtime/publish services and portal assignment are explicitly excluded.

---

## Security and Safety

- No untrusted executable content.
- Effects use trusted registered code and bounded parameters.
- File input demos use local fixture object URLs only and do not upload.
- Tooltip/popover and navigation content is React data, not raw HTML.
- Existing authentication and route permissions remain unchanged.

---

## Testing Plan

| Test | Type | Location |
| --- | --- | --- |
| Catalog/evidence/option validation | Unit | `src/features/base-components/catalog/__tests__/` |
| Tabs patterns and APG behavior | Component | `src/shared/ui/__tests__/` |
| Foundation behavior | Component | `src/shared/ui/shell-foundation/__tests__/` |
| Navigation keyboard/focus/RTL | Component | `src/shared/ui/shell-navigation/__tests__/` |
| Built-in adapter regression | Component | existing admin-shell nav tests |
| Effect catalog/determinism/fallback/cost | Unit/Component | `src/shared/ui/shell-effects/__tests__/` |
| Section route/coverage parity | Unit | `src/features/base-components/__tests__/` |

Verification:

```text
npx tsc --noEmit
npx vitest run
npm run build
```

Focused commands will run after each phase before the full gate.

---

## Rollout & Risks

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Refactoring 30 workspaces creates duplication | High | Medium | Shared metadata/configurator first; Tabs proves pattern |
| HeroUI Tabs compound API mismatch | Medium | Medium | Wrapper-owned semantic contract and focused tests |
| Navigation adapter regression | Medium | High | Preserve adapters and add before/after regression tests |
| Effects hurt performance | Medium | High | Cost tiers, pause/fallback and bounded layers |
| Public prop explosion | Medium | High | p-85 dispositions, presets and metadata validation |
| Large test runtime | Medium | Medium | Pairwise cases plus targeted boundary tests |

---

## Approval

| Role | Name | Date | Status |
| --- | --- | --- | --- |
| Product Owner | Mohsen | 2026-08-03 | `Approved` |

Approval basis: approved independent Base Components scope and explicit full-38/full-expansion/production-integration selections.
