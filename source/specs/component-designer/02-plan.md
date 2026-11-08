# Implementation Plan — Component Designer (historical; execution plan p-46 removed 2026-09-15)

---

## Metadata

| Field | Value |
| --- | --- |
| **Feature slug** | `component-designer` |
| **Spec reference** | `specs/component-designer/01-spec.md` |
| **Status** | `Approved` |
| **Created** | 2026-07-06 |
| **Planner** | Antigravity AI Agent |

---

## Plan Summary

The App Builder feature transitions AppEndO's single-page component designer into a layout, routing, asset, and publish manager. The implementation is divided into focused waves:
1. **Layout Shells & Presets (Phase B & F)**: Design portal shells and manage custom workspace assets (images, icons) locally on disk.
2. **Navigation Trees & Routing (Phase E & G)**: Bind shells and components to portals via manifest managers, removing raw-JSON editing and legacy routing mechanisms.
3. **WYSIWYG Runtime Parity (Phase C & H)**: Standardize rendering behaviors between the designer canvas, previews, and generated React/TSX files.
4. **Security & Validation (Phase J)**: Implement XSS sanitization for custom HTML blocks and configure role-based access rules.

---

## Frontend Architecture

### Route & Page Entry

| Item | Path / Value |
| --- | --- |
| Route path | `/studio/client-components` |
| Page entry | `src/features/component-designer/ComponentDesignerPage.tsx` |
| Lazy loaded? | `Yes` |
| Role guard | `ADMIN` |

### Feature Slice Structure

```
src/features/component-designer/
├── canvas/                              # Layout grid and element rendering
│   ├── ComponentDesignerCanvas.tsx
│   └── …
├── components/                          # Sidebar, toolbox, workspace
│   ├── ComponentDesignerWorkspace.tsx
│   ├── DesignerPublishedShell.tsx
│   └── …
├── dialogs/                             # Modals (e.g. DesignerDialog)
│   ├── DesignerAssetManagerModal.tsx
│   └── …
├── hooks/                               # State handlers (recoilers, history)
│   ├── useComponentDesignerPage.ts
│   └── …
├── inspector/                           # Property panels and editors
│   ├── DesignerInspectorShellLogoField.tsx
│   └── …
├── layout-presets/                      # Component seed templates
│   └── builtInComponents.ts
├── lib/                                 # Shared utilities and parsing
│   └── shellDesignerDraft.ts
├── types.ts                             # Typings for components and nodes
└── index.ts                             # Export barrel
```

### Component Breakdown

| Component | Responsibility | New / Reuse |
| --- | --- | --- |
| `ComponentDesignerWorkspace` | Orchestrates the primary designer layout. | Reuse |
| `DesignerPublishedShell` | Renders a portal's custom layout shell framework. | New |
| `DesignerAssetManagerModal` | Handles file uploading, grid view, and deletion of media. | New |
| `NavigationTreeEditor` | Visual tree builder for portal navigation links. | Reuse/Enhance |
| `DesignerInspectorShellLogoField` | Media picker interface inside the shell property inspector. | New |

### Hooks & State

| Hook | Responsibility | React Query Keys |
| --- | --- | --- |
| `useDesignerDrafts` | Retrieves and updates component definitions. | `['designer', 'drafts']` |
| `useDesignerVersions` | Fetches saved snapshot list for rollback views. | `['designer', 'drafts', id, 'versions']` |
| `useWorkspaceAssets` | Lists available uploaded files. | `['designer', 'assets']` |

### Shared Layer Additions

| Artifact | Path |
| --- | --- |
| API contracts | `src/shared/api/contracts/component-designer/types.ts` |
| UI tokens | `src/shared/ui/surfaceClasses.ts` |
| Button semantic maps | `src/shared/ui/buttonSemantics.ts` |

---

## Backend Architecture

### API Endpoints

| Method | Path | Auth | Controller Method | Description |
| --- | --- | --- | --- | --- |
| GET | `/api/component-designer/drafts` | `requireRole('ADMIN')` | `listDrafts` | Fetch all component and shell drafts. |
| GET | `/api/component-designer/drafts/:id` | `requireRole('ADMIN')` | `getDraft` | Load specific draft or version snapshot. |
| PUT | `/api/component-designer/drafts/:id` | `requireRole('ADMIN')` | `updateDraft` | Save modifications to a component. |
| POST | `/api/component-designer/preview/runtime` | `requireRole('ADMIN')` | `previewRuntime` | Dry-run execute bound queries/variables. |
| GET | `/api/component-designer/assets` | `requireRole('ADMIN')` | `listAssets` | List media files in the workspace. |
| POST | `/api/component-designer/assets` | `requireRole('ADMIN')` | `uploadAsset` | Upload file to the workspace. |
| DELETE | `/api/component-designer/assets/*` | `requireRole('ADMIN')` | `deleteAsset` | Remove file from the workspace. |

### File Layout

```
src/server/
├── routes/component-designer.routes.ts              # Route registry
├── controllers/component-designer.controller.ts      # HTTP handlers
├── services/component-designer.service.ts            # Business logic orchestration
└── domain/component-designer/
    ├── draftFolderPaths.ts                           # Storage path configurations
    ├── draftIo.ts                                    # JSON/TSX storage serialization
    ├── draftTsxExport.ts                             # Code generation TSX builder
    ├── drafts.ts                                     # File system retrieval queries
    └── storage.ts                                    # Workspace folder builders
```

### Domain & Repository Design

All component design artifacts are stored as files on disk. The PostgreSQL database serves as the control plane for metadata, logs, and routing.

- **File-based config**: Existing store pattern resolving to directories inside `runtime/`.
  - Component Drafts: `workspace/designer/drafts/<folder>/<name>.json`
  - Companion TSX Code: `workspace/designer/drafts/<folder>/<name>.tsx`
  - Workspace Assets: `workspace/assets/`
  - Snapshots/Versions: `workspace/designer/snapshots/<folder>/<id>/<version>.json`
  - Portal manifests: `workspace/platform-registry/`

---

## Security Considerations

### Input Validation & Sanitization
- Strictly validate filenames and paths to prevent directory traversal (`../`) attacks.
- File uploads are constrained by mime type allowlists and size limits (max 5MB).
- Parse HTML blocks through `DOMPurify` before rendering on canvas or exporting code.

### Authentication & RBAC
- All API routes under `/api/component-designer/**` require the `ADMIN` role.
- Public routes under `/assets/workspace/**` are read-only and restricted to safe media formats.

---

## Testing Plan

| Test | Type | Location |
| --- | --- | --- |
| Route bindings test | Unit | `src/app/platform/__tests__/p06AdminShell.exit.test.tsx` |
| Binding cycle solver | Unit | `src/server/services/component-designer.service.ts` (preview logic) |
| TSX Code validity | Integration | `src/server/domain/component-designer/__tests__/generatedTsxValidity.test.ts` |
| XSS sanitization check | Unit | `src/server/domain/component-designer/__tests__/htmlSanitizer.test.ts` |
