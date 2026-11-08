# Runtime workflow — files changed per operator action

Operator-facing map for Git commits after live authoring (p-37 RLE-5).

| Action | Files under `runtime/` |
|--------|-------------------------|
| Save designer page | `designer/drafts/{folder}/{slug}.json` · `designer/index.json` |
| Save designer shell | `designer/drafts/shells/{key}.json` · `designer/index.json` |
| Publish shell (portal) | Same draft paths; portal reads published query cache |
| Add route / menu | `platform-registry/bindings/*.json` · `platform-registry/pages/*.json` |
| Create portal | `platform-registry/mounts/*.json` · `platform-registry/shell-rules/*.json` |
| Save server function | `server-functions/custom/*` · `server-functions/index.json` |
| Package install | `packages-storage/` only (ignored by Git) |
| Apply package deployment | Merged into runtime config via `platform-registry/` ownership rows |

## Git page presets

Use **Platform registry**, **Designer**, and **Edge functions** filters on `/studio/git` to review scoped diffs before commit.

## Ignored paths

- `workspace/designer/tmp/` · lock files
- `packages-storage/`
- `settings.json`

Tracked: `designer/drafts/` (including shells), `platform-registry/`, `server-functions/custom/`.
