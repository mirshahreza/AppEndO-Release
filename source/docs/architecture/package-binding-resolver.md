# Package binding resolver (designer → installed package)

**Status:** Accepted (p-37 RLE-3.7)

## Problem

Designer pages use managed `/api/...` URLs during authoring. After install, the same page must resolve package-relative API paths.

## Resolution

| Loader | Authoring | After install |
|--------|-----------|---------------|
| `designer` | `loaderRef` = draft slug | Same JSON document; bindings rewritten at apply |
| `package` | N/A | `loaderRef` = `package:{packageId}:{pageKey}` |

Package API routes are served at `/packages/{packageId}/{slug}` (see `packageApiRuntime.service.ts`).

Designer `bindingDefinitions` that target managed server functions should use package-relative URLs when `ownerPackageId` is set on the route binding.

## Conflict policy (RLE-3.8)

| Field | Policy |
|-------|--------|
| `shellKey` | Deny if owned by another package |
| `mount.id` / `pathPrefix` | Deny on collision |
| API slug | Deny if path owned by another package |

Enforced in `packageDeployment.service.ts` → `collectDeploymentConflicts`.

## Related

- [artifacts.md](./artifacts.md)
- [experience-routing.md](./experience-routing.md)
