# Runtime artifacts

Canonical map of file-backed artifacts under `workspace/` and the Packages hub.

All on-disk working artifacts live under project-root `workspace/` (File Manager scope + module stores + platform/AI scratch). Shared helper temp is `workspace/temp/` (gitignored). Settings and `packages-storage/` stay outside this tree. There is no separate `runtime/` working directory.

## Hub

| Surface | Route | Role |
|---------|-------|------|
| **Packages** | `/studio/packages` | Upload · install · enable/disable · deployment apply |

## Artifact types

| Artifact | Path | In `package.zip`? | Notes |
|----------|------|-------------------|--------|
| Platform registry | `workspace/platform-registry/` | ✅ (vertical-app) | Portals · shells · routes · navigation |
| Designer drafts | `workspace/designer/drafts/` | ✅ TSX + `designer/pages/{componentKey}.json` | Pages + `shells/*` layouts. Pages restore from packed draft JSON when present; otherwise hydrate from TSX |
| Studio nav patch | `workspace/platform-registry/navigation/studio.json` | ✅ `navigation_patches` → `platform/navigation-patches/studio.json` | Package-owned Studio group (heading = package name). Do not bake it into shipped `src/config/platform-registry/navigation/studio.json`. Install claims an unowned leftover group with the same heading; another package's sidecar still conflicts |
| Home portal claim | `workspace/platform-registry/shells/home-shell.json` | ✅ `home_portal` → `platform/home-shell.json` | CMS (`cms`) claims public `home-shell` as `site-shell` while installed. Uninstall restores the shipped Studio redirect. Built-in home cannot be published via `capabilities.portals` |
| Culture keys | master `us` bundle | ✅ `culture_keys` → `culture/keys.json` | English overlay only (`nav.group.*` / `nav.{pageKey}`). Existing different values are kept + warned; uninstall removes keys this package still owns |
| Server functions | `workspace/server-functions/custom/` | ✅ `api/*` | Managed APIs; tag with `portal:{segment}` for portal export |
| Edge models / APIs / studio-meta | `workspace/edge-*` | ✅ `edge_models` · `edge_apis` · `edge_model_studio_meta` | Data Studio file stores; Package Builder/Repack auto-detect from pages and export into the ZIP. Install writes back into these shared namespaces (not per-package isolated) |
| Workflow definitions | control-plane DB | ✅ `workflows/{scopeKey}/{key}.json` | Authoring bundle only (draft AWM + designer view). Install creates DRAFT definitions; never auto-publishes; secrets/runtime excluded |
| Workspace assets | `workspace/assets/` | via `/assets/workspace/` | Designer + package image/files |
| Platform fonts / PWA icons | `workspace/platform/{fonts,pwa}/` | ✅ via `/assets/platform/…` | Font URLs collected from shells/pages; install seeds `assets/platform/fonts`. Identical bytes skip; different bytes keep existing + warn |
| Feedback attachments | `workspace/feedback-attachments/` | ❌ | Feedback file uploads |
| Local embeddings models | `workspace/models/embeddings/` | ❌ | Transformers.js ONNX cache |
| AppEndO / agent state | `workspace/appendoo/` | ❌ | checkpoints · evidence · embeddings cache |
| Workspace temp | `workspace/temp/` | ❌ | Atomic-write / helper scratch (ignore) |
| Installed package runtime | `packages-storage/` | — | Extracted after install; not in Git |
| Node settings | `settings.json` | ❌ | Data sources · AI keys — never portable |

## Package kinds

| `kind` | Typical capabilities |
|--------|---------------------|
| `extension` | `apis` · `ui_components` · `ui_routes` · `navigation_patches` · `home_portal` · `culture_keys` · `db_objects` · `static_assets` · `edge_models` · `edge_apis` · `edge_model_studio_meta` · `install_hooks` |
| `vertical-app` | Shell · experience · pages · APIs · SQL · MCP |

## Install portability

- **`DATA_SOURCE_ID`** in edge route scripts resolves to the **target node's** default data source at install time. Review SQL and CRUD-Gen routes when moving packages between environments.
- **`settings.json`** and secrets are never included in ZIP artifacts.
- **`db_objects.installMode`** — `required` (default) always runs on install. `optional` is only valid on `seed` objects (initial records). Package Builder and Repack can pack them separately; the installer may skip them. Foundation schema/vocab stay required. Script paths must start with `db/install/`, `db/uninstall/`, `db/seed/`, or `sql/`.
- **Binary seed files** — BYTEA/file columns are stored as `db/blobs/files/*.bin` plus `db/blobs/index.json`. Install SQL uses `{{package_blob:db/blobs/files/...}}` tokens; the installer expands them to the target dialect. Artifact ZIP limit is 512 MB.
- **CMS pack** — Package Builder **Pack CMS module** writes required schema + Base Info vocab and optional content/files. `db/base-info-hid.json` remaps colliding vocab ids at install.
- **Install rollback** — a failed extension install reverses that attempt (nav, portal, created edge data, uninstall SQL if this attempt ran install SQL, runtime). Reused same-node edge APIs are not deleted. No half-installed leftover. Failed install clears pending deployment (Install, not Apply). Studio extension `ui_routes` confirm during install; Packages **Apply** is only for vertical-app `applyPolicy: propose`. Same-node Studio install adopts existing `loaderKind: designer` pages instead of overlaying package routes.

## Related

- [experience-routing.md](./experience-routing.md)
- [system-extensions.md](./system-extensions.md)
