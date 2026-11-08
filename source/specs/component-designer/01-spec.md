# Feature Specification — Component Designer (App Builder vision)

---

## Metadata

| Field | Value |
| --- | --- |
| **Feature slug** | `component-designer` |
| **Author** | Antigravity AI Agent |
| **Status** | `Approved` |
| **Created** | 2026-07-06 |
| **Last updated** | 2026-07-06 |
| **Constitution version** | 1.0.0 |

---

## Feature Goal

The goal of this feature is to transition the AppEndO Component Designer from a single-page/component builder into a complete, enterprise-ready **App Builder**. This enables administrators and developers to build entire application interfaces—including layout shells (headers, sidebars, footers), navigation menus, workspace branding assets, database bindings, and deployment lifecycle publish packages—using a visual, drag-and-drop workspace that generates clean, compiler-ready, and security-hardened React TSX components.

### Problem Statement

Today, the AppEndO Component Designer functions primarily as a localized page layout builder. Admins face multiple friction points when creating complete apps:
1. **No Shell Customization**: App shells (sidebars, portals, headers) are hardcoded or require manual code modifications.
2. **Inline Assets**: Uploaded brand assets (like logos) are serialized as bloated inline Data URLs in components, degrading performance.
3. **Manual Navigation**: Menus and routing portals are configured by direct edits to raw JSON files in `platform-registry`.
4. **Draft-ID Leakage**: System URLs and page routing bindings leak designer-internal identifiers (e.g. `draft-xxxx`) rather than utilizing clean canonical path names (`<folder>/<name>`).
5. **Drift and Discrepancies**: The design-time canvas does not achieve 100% parity with live preview layouts and generated TSX code.
6. **Security Hygiene**: Custom HTML inputs lack sanitization, posing XSS vulnerabilities.

### Desired Outcome

A fully integrated App Builder environment where:
- Portal shells can be designed, styled, and customized visually.
- Navigation links, menu hierarchies, route patterns, and security roles can be built without manual JSON edits.
- Media assets can be uploaded to a dedicated workspace folder and resolved via clean URLs.
- Preview and production routing maps only to published `<folder>/<component-name>` canonical paths.
- Canvas design, local preview, and generated TSX code match exactly in styles and layouts.
- Emitted TSX compiles cleanly and is free of designer-only internal properties.

### Success Criteria

- [x] **Criterion 1**: Visual administration of custom portal shells (save, open, and preview) is separate from standard page components.
- [x] **Criterion 2**: Workspace assets (logos, images) support visual uploads, listing, deletion, and resolve to `/assets/workspace/*` paths instead of Data URLs.
- [x] **Criterion 3**: Route bindings and portal navigation link configurations can be managed visually (CRUD) using HeroUI controls.
- [x] **Criterion 4**: Public identity maps strictly to folder + name (`?component=folder/name`), and draft-id endpoints are restricted.
- [x] **Criterion 5**: Code generation parity (WYSIWYG) is achieved for layout grids, custom column ratios (e.g. 20%/70%), headers, footers, and semantic tokens.
- [x] **Criterion 6**: Sanitization of HTML blocks protects the runtime app from XSS attacks.
- [x] **Criterion 7**: Critical test suites remain green.

### Out of Scope

- Legacy database schema migrations (App Builder targets a clean, greenfield model).
- Replacing standard HeroUI v3 controls with native HTML controls.
- Visual custom style utilities outside the Tailwind / CSS variable token systems.
- Multi-framework exports (React/TSX is the single, canonical export target).

---

## User Stories

### US-1: App Shell designer workspace (CD-B01)
**As an** Administrator  
**I want** to create and edit custom app layout shells (sidebar, headers, content outlets) visually  
**So that** I can customize the look-and-feel of different portal entryways (e.g., admin versus partner portal) without writing React layout wrappers.

**Acceptance Criteria:**
- Visually customize sidebar menu options, headers, and header action slots.
- Save shell designs to `workspace/designer/drafts/` with special system naming conventions.
- Preview shell layouts in both desktop and mobile viewports.

---

### US-2: Visual menu builder (CD-E01)
**As a** Studio Developer  
**I want** to edit the portals' navigation links visually using a tree manager  
**So that** I can customize menus without editing raw JSON database definitions in the file system.

**Acceptance Criteria:**
- List, create, update, re-order, and delete menu items for a portal entryway.
- Bind links to page components or external routes.
- Assign security role gates to route items.

---

### US-3: Media and Branding Asset Manager (CD-F01, CD-F02)
**As a** Portal Designer  
**I want** to upload custom images, icons, and logos to the workspace  
**So that** I can use asset paths (e.g., `/assets/workspace/my-logo.png`) in image properties instead of embedding large base64 Data URLs.

**Acceptance Criteria:**
- Upload files via drag-and-drop or file selector inside the designer.
- View and select files from an asset manager grid in property panels (e.g., logo upload).
- Block path traversal attacks and validate mime types.

---

### US-4: Code Generation and Parity (CD-C02, CD-H01, CD-H03)
**As an** App Builder Developer  
**I want** the visual design to translate exactly to a compiled React TSX file  
**So that** there are no layout drifts or broken controls when components are deployed to production.

**Acceptance Criteria:**
- Generated TSX file compiles successfully with no TypeScript errors.
- Internal designer properties (like `_designer`) are filtered out of the output file.
- Custom grid column ratios (e.g., `20% / 70%`) render identically on canvas, preview, and output code.

---

## Runtime Parity Audit (CD-C01)

Phase C starts from the runtime/codegen inventory below. This table tracks the current parity status for the high-impact HeroUI wave and assigns each gap to the phase task that owns it.

| Palette item | Runtime preview | TSX codegen | Gap / note | Owner task |
| --- | --- | --- | --- | --- |
| `heroui.toast` | Toast shell with title/description + `role="status"` | Emits matching status container | Parity complete | — |
| `heroui.toolbar` | HeroUI `Toolbar` wrapper in preview | Emits `<Toolbar>` with child slot | Parity complete | — |
| `heroui.typography-lead` | Lead paragraph preview | Exports `<p>` lead copy | Parity complete | — |
| `heroui.field-container` | `fieldset` + legend + child slot | Exports matching `fieldset` wrapper | Parity complete | — |
| `heroui.breadcrumbs` | Generic preview only | Generic codegen only | Deferred to navigation parity wave | `CD-P02` |
| `heroui.pagination` | Generic preview only | Generic codegen only | Deferred to navigation parity wave | `CD-P02` |
| `heroui.checkbox-group` | Generic preview only | Generic codegen only | Deferred to universal toolbox wave | `CD-P37` |
| `heroui.radio-group` | Generic preview only | Generic codegen only | Deferred to universal toolbox wave | `CD-P37` |
| `heroui.tags-input` | Generic preview only | Generic codegen only | Deferred to universal toolbox wave | `CD-P37` |

The rest of the current HeroUI runtime inventory is either already covered by `HEROUI_RENDERED_IDS` or handled by the phase-2 form/runtime code paths. Phase C focuses only on the four items owned by `CD-C02` before later parity waves expand the matrix.

---

## Business Logic

### Entities & Relationships

| Entity | Key Fields | Notes |
| --- | --- | --- |
| **Component** | `id` (slug), `name`, `folder` | Maps to `<folder>/<name>.json` and companion `.tsx` on disk. |
| **Shell Draft** | `shellKey` | Special system-managed designer layout with placeholders. |
| **Workspace Asset** | `relativePath` | Files saved under `workspace/assets/`. |
| **Route Binding** | `mountId`, `routePattern`, `pageKey` | Declares page paths and maps path prefixes to page modules. |
| **Page Module** | `pageKey`, `loaderRef` | Configures key-to-module loading targets (e.g. `core:ComponentDesigner`). |
| **Navigation Manifest**| `portalKey`, `items` | Layout navigation structure for specific entryway views. |

### Rules & Constraints

1. **R1: Component Identity Path**: Public portal routes must link components using the canonical `<folder>/<component-name>` structure. Draft IDs must never leak to client routes.
2. **R2: Asset Isolation**: All asset paths must resolve relative to `/assets/workspace/` and remain within the workspace boundary to prevent path traversal.
3. **R3: Non-Destructive Code Generation**: Code emitters must strip compiler directives and internal properties before saving production `.tsx`.
4. **R4: Strict Token Styling**: Custom surfaces and controls must draw colors, sizes, and layout settings from `surfaceClasses.ts` and `buttonSemantics.ts`. No raw hex codes are permitted in templates.
5. **R5: In-App Confirmation**: Any deletion of a component, asset, or menu node requires an in-app confirm dialog (use `ConfirmModalShell` or similar, never native browser `window.confirm`).

### State Transitions

```
[Draft created] ──> [Saved on Disk] ──> [Published / Version Pinned] ──> [Exported TSX / Manifest Active]
```

### Edge Cases & Error Scenarios

| Scenario | Expected Behavior |
| --- | --- |
| Duplicate component names | Warn the administrator; name must be unique within folder. |
| Malicious script uploaded to HTML block | Purify using DOMPurify before canvas rendering and TSX output. |
| Missing page module reference | Log diagnostic warning and fallback to generic error boundary view. |
| Asset path traversal query (`../../`) | Sanitize path parameter on the server and return a 400 Bad Request error. |

---

## UI/UX Notes

- Layout grid is structured with standard visual hierarchy: left panel (toolbox), center canvas, right inspector (20% sidebar / 70% center / 10% properties split).
- Custom control components must leverage HeroUI v3 wrappers (e.g., `UiCheckbox` for booleans, `AppButton` for semantics).
- Labels are positioned directly over inputs with a standard `2px` spacing and `ps-[4px]` label indentation padding.

---

## Dependencies & Integrations

| Dependency | Type | Notes |
| --- | --- | --- |
| `platform-registry` | Config Store | Holds route bindings, page modules, and navigation JSON trees. |
| `DOMPurify` | Package | Sanitizes HTML editor content for XSS protection. |
| `lucide-react` | Package | Standard icon catalog for buttons, navigation items, and settings. |

---

## Open Questions
No open questions exist for this specifications phase.

---

## Approval

| Role | Name | Date | Status |
| --- | --- | --- | --- |
| Product Owner | Mohsen Mirshahreza | 2026-07-06 | `Approved` |
