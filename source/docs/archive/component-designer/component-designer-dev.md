# Component Designer & App Builder Developer Guide

This document is a technical-operational reference for developers extending the Component Designer / App Builder features in the AppEndO repository.

---

## 1. Storage & Directory Structures

All visual layouts, portal shells, versions, and assets designed in the workspace are saved directly on disk inside the `runtime/` directory.

### Core File Mappings

| Resource | File Path | Format / Schema |
| --- | --- | --- |
| Component layout | `runtime/designer/drafts/<folder>/<name>.json` | `DesignerDocument` node tree |
| Preview companion code | `runtime/designer/drafts/<folder>/<name>.tsx` | Generated React TSX module |
| Component metadata | `runtime/designer/drafts/<folder>/<name>.meta.json` | Sidecar descriptors / bindings |
| Snapshots / Versioning | `runtime/designer/snapshots/<folder>/<draftId>/<version>.json` | Pinned JSON snapshot copies |
| Workspace assets | `runtime/designer/workspace-assets/<filename>` | Standard media / binary files |
| Execution preview logs | `runtime/designer/preview-logs/preview-<timestamp>.json` | Trace logs of binding runs |

### Workspace Assets (`runtime/designer/workspace-assets/`)
Custom images and files uploaded by page layouts must reside in this directory:
- **Disk Path**: `runtime/designer/workspace-assets/`
- **Runtime URL**: `/assets/workspace/<relative-path>`
- **Compilation Package**: Packed relative to `assets/workspace/` inside portal zip configurations.

---

## 2. Canonical Identity vs. Draft Identifiers

A strict design boundary is maintained between **workspace drafts** and **published routes**.

```
+-----------------------------------+
|         Designer Workspace        |
|  - Identifies by internal ID      |
|  - e.g. "draft-l3g4k7u2"          |
|  - Saves state, snapshots, locks  |
+-----------------+-----------------+
                  |
                  | [Publish Pipeline]
                  v
+-----------------------------------+
|         Production Portals        |
|  - Identifies by path stem        |
|  - e.g. "folder/component-name"   |
|  - Used by manifests & routing    |
+-----------------------------------+
```

### Identity Rules
1. **Draft IDs are Designer-Internal**:
   - `draft-xxxx` strings are generated during draft creation.
   - They index locking state and snapshot sequences.
   - No external features (portals, manifest navigation, portal menu definitions) should reference these identifiers.
2. **Canonical Paths for Routes**:
   - Routes, dynamic link builders, and dynamic previews must reference files by `<folder>/<component-name>`.
   - Direct links must load endpoints using query format `?component=<folder>/<name>`.
   - Never surface `?draft=` parameters or draft-id pathways in the portal navigation interface.

---

## 3. Preview Lifecycle & Binding Resolvers

When a page is previewed, query variables and state bindings are dry-run resolved by the backend service.

### Execution Flow: `POST /api/component-designer/preview/runtime`

1. **Dependency Analysis**:
   - Gathers all dynamic values defined in property bindings.
   - Builds a dependency map to detect cycle loops (circular references).
2. **Topological Ordering**:
   - Sorts bindings based on execution order (e.g. parameter dependencies are solved first).
3. **API Resolution**:
   - Executes outbound REST fetches sequentially or in parallel using mock request configs.
   - Emits detailed trace logs mapping start/duration times, HTTP codes, and result payloads.
4. **Log Retention**:
   - Preview output traces are saved in `runtime/designer/preview-logs/`.
   - Retention manager automatically purges files, keeping a maximum of 40 logs.

---

## 4. Code Emitters & E2E TSX Egress

Export pipelines generate fully qualified, compiler-compliant TSX components representing visual layouts.

### Codegen Engine: `src/server/domain/component-designer/draftTsxExport.ts`

- **Node Renderers**: Resolves catalog elements into standard JSX element strings.
- **Surface Token Binding**: Replaces designer classes with standard variables defined in `surfaceClasses.ts` and `buttonSemantics.ts`.
- **Property Sanitation**:
  - Drops designer-internal tags (`_designer` identifiers, selection states).
  - Sanitizes raw HTML inputs through custom sanitizers to block script injections.
- **Parity Tests**:
  - Compilations are verified against standard layouts in `generatedTsxValidity.test.ts`.
  - Ensures exported TSX has no missing React imports or invalid JSX properties.
