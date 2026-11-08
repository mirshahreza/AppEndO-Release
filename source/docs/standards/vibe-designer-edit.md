# WF-3 — Edit existing layout (vibe shard)

> **Shard key:** `get_project_standards({ shard: "vibe-designer-edit" })`  
> **Workflow:** [`vibe-coding-workflows.md`](./vibe-coding-workflows.md) § WF-3  
> **Playbook:** [`vibe-operator-playbook.md`](./vibe-operator-playbook.md)

---

## When to use

`layoutId` or `selectedNodeId` is in page context — user is editing an open Component Designer layout (Live Designer).

## Manual UI parity (mandatory)

Simulate **Client Components → Live Designer**. The editor AI panel writes a drafted layout onto the canvas (Agent auto-applies). Catalog persist is still **Save**.

| Manual step | Agent equivalent |
|-------------|------------------|
| Canvas tree | `draft_component_layout` with `layoutId` from page context (and the full `document` from the snapshot when editing unsaved canvas) |
| Inspector property | `designer_set_prop` |
| Toolbox insert | `designer_insert_palette_item` |
| Save | Proposal → this editor panel hydrates the document onto the canvas (Agent auto-applies). Catalog persist is still **Save** |

**Never:** `draft_file_patch` under `workspace/designer/` — use `draft_component_layout` / designer tools only.

## Execute — do not re-ask

If the user message already states what to change, **do not** respond with "tell me what to edit". After retrieve:

1. `get_page_context` — `layoutId`, `selectedNodeId`
2. `read_file` on generated/preview if needed
3. `designer_set_prop` / `designer_insert_palette_item` **or** `draft_component_layout` with `layoutId` / `document` from the snapshot
4. Proposal → the Live Designer AI panel writes that document onto the canvas (Agent auto-applies). Catalog Save is still the operator Save button. Do not claim the canvas changed without that apply.

## Tool order

1. `get_page_context` — `layoutId`, `selectedNodeId`
2. `read_file` on generated/preview if needed
3. `designer_set_prop` / `designer_insert_palette_item` **or** `draft_component_layout` with `baseLayoutId`
4. `validateProposal` → confirm → apply → Designer handoff (AppEndO Agent). On the Live Designer AI column, Agent auto-applies onto the canvas — unsaved until Save.

## UI rules

Same as WF-2 — see `vibe-crud` shard + [`component-designer.md`](./component-designer.md) + [`ui-dialog.md`](./ui-dialog.md).

When inserting or editing form controls, set `label` and `hint`. The page guide only explains nodes that have both. Do not ship generated visual pieces without that sidecar.
