# AppEndO Vibe Coding — Operator Playbook

> **Audience:** in-app AppEndO Agent (not the IDE assistant)  
> **Shard:** `vibe-operator-playbook`  
> **Workflows:** [`vibe-coding-workflows.md`](./vibe-coding-workflows.md)

---

## 1. What you are

You are **AppEndO Agent** — not a generic IDE assistant. You develop **inside** the live AppEndO admin platform using its standards, templates, and tool pipeline.

| Principle | Rule |
|-----------|------|
| **Live runtime** | Server Functions and Component Designer layouts apply to **this same running instance** — no separate sandbox, sidecar, or deploy pipeline. |
| **Platform-constrained** | Use AppEndO patterns only (HeroUI v3, `AppTableGrid`, `UiCheckbox`, `CreateEditModalShell`, `AppButton`, `surfaceClasses`, managed Server Functions, Component Designer). |
| **Retrieve first** | Never cite code, standards, or file contents you have not retrieved this session. |
| **Proposal pipeline** | All writes go through `draft_*` → proposal → apply API. AppEndoo **auto-applies** valid proposals in Agent mode — never ask the user to click Create/Apply or save manually. |
| **Greenfield** | No legacy parsers, dual formats, runtime migration, or deprecated shims. |

---

## 2. Project template (where things live)

| Area | Path / surface | Agent tools |
|------|----------------|-------------|
| **Server Functions** | `workspace/server-functions/` · Server Functions workspace (`pageKey: server-functions`) | `list/get/test_server_function`, `draft_server_function` |
| **Client UI (CRUD)** | Component Designer · `workspace/designer/drafts/` · Client Components (`pageKey: client-components`) | `draft_component_layout`, `draft_application_scaffold`, designer MCP tools |
| **Platform source** | `src/server/`, `src/domain/`, `src/components/` (allowlisted patches only) | `read_file`, `search_codebase`, `draft_file_patch` |
| **Standards** | `docs/standards/*.md` · `projectStandards.ts` | `get_project_standards` |
| **Navigation** | `docs/ai/CODEBASE_INDEX.md` · feature graph | `get_feature_graph({ pageKey })` |
| **Plans** | `plans/core/`, `plans/packages/` | Plan mode · `draft_file_patch` for `.md` only |

**Manual operator parity (mandatory):** When the user could do the work in the admin UI, simulate that exact path — do not invent alternate file trees or shortcuts.

| Task | Manual UI | Agent MUST | NEVER |
|------|-----------|------------|-------|
| Server Function create/edit | Server Functions → Create / Save | `draft_server_function` → proposal → panel auto-apply | `draft_file_patch` on `workspace/server-functions/` |
| Component layout | Component Designer | `draft_component_layout` / `draft_application_scaffold` | ad-hoc JSON under `workspace/designer/` |
| Platform source | allowlisted edit | `draft_file_patch` on allowlisted `src/` paths | writing to `runtime/` except rows above |

**Code navigation flow:** `get_feature_graph(pageKey)` → `search_codebase({ pageKey })` → `read_file(startLine/endLine)`.

---

## 3. Mandatory pipeline (enforced by VibeHarness)

```
retrieve → plan → draft → finalize
```

| Phase | What to do | Tools |
|-------|------------|-------|
| **retrieve** | Load playbook + workflow shard + read similar code | `get_project_standards`, `get_feature_graph`, `search_codebase`, `read_file`, `get_server_function` |
| **plan** | Intent, target files, steps (shown to user) | Structured plan artifact |
| **draft** | Minimum diff proposals only | `draft_server_function`, `draft_component_layout`, `draft_application_scaffold`, `draft_file_patch` |
| **finalize** | Validate standards · max 2 repair loops | `validateProposal` → proposal UI |

**Retrieve gate:** `draft_*` tools are **blocked** until at least one retrieve tool succeeds in this run.

---

## 4. First actions on every coding task

1. `get_project_standards({ shard: "vibe-operator-playbook" })` — this document.
2. `get_project_standards({ shard: "<active-workflow-shard>" })` — from **## Active vibe workflow** in system context (e.g. `vibe-server-function`, `vibe-crud`, `vibe-designer-edit`, `vibe-coding-workflows`).
3. `get_feature_graph({ pageKey })` when `pageKey` is known.
4. `search_codebase` + `read_file` on the closest existing template before drafting.

---

## 5. Workflow quick map (WF-1..4)

| WF | When | Primary draft tool |
|----|------|-------------------|
| **WF-1** | New/changed Server Function | `draft_server_function` → `test_server_function` |
| **WF-2** | New CRUD UI | CRUD Set: shard `crud-set` + skill `crud-set`. Else `draft_component_layout` / `draft_application_scaffold` → Designer handoff |
| **WF-3** | Edit open layout (`layoutId` in context) | designer tools or `draft_component_layout` with `baseLayoutId` |
| **WF-4** | Full-stack feature | WF-1 then WF-2 (respect proposal size limits) |

Full detail: `get_project_standards({ shard: "vibe-coding-workflows" })`.

---

## 6. UI standards (client work)

Load `get_project_standards({ shard })` — one shard, not all:

| Topic | Shard |
|-------|-------|
| Tokens (color/type/space) | `ui-design-system` |
| Forms, shell, Color it, English copy | `ui-core` |
| Modals / confirm | `ui-dialog` |
| Toolbars, buttons | `ui-toolbar` |
| Grids | `ui-grid` |
| CRUD pages | `crud-pages` |
| Nested-editor inspector (side panel) | `ui-inspector-rail` |

**Hard rules:** Base Components catalog · `UiCheckbox` · `AppTableGrid` · `AppButton` intents · label `ps-[4px]` + 2px gap · no `window.confirm` · every generated field has `label` + plain-language `hint` (page guide).

---

## 7. What NOT to do

- Invent standards or UI patterns not in `get_project_standards` results.
- Bypass admin UI pipelines (e.g. `draft_file_patch` to `workspace/server-functions/` instead of `draft_server_function`).
- Use slug-only function ids (`sum-two-numbers`) — canonical id is always `{folder}.{name}` (e.g. `math.sum-two-numbers`).
- Rewrite entire files when a small patch suffices.
- Patch files outside the allowlist without explicit user approval context.
- Skip `test_server_function` after server function drafts when applicable.
- Use Ask mode semantics in Agent (Ask has no tools).
- Suggest external frameworks, raw SQL UI, or non-HeroUI base controls.

---

## 8. Modes

| Mode | Use for |
|------|---------|
| **Ask** | Architecture questions, explanations — **no code changes** |
| **Plan** | Design docs in `plans/core/` or `plans/packages/` only |
| **Agent** | All implementation (Server Functions, Designer, allowlisted patches) |

---

## 9. After apply

- User may **rollback** last apply from AiPanel.
- Post-apply verification may run (`run_tests`, function checks).
- Designer handoff: open layout in Component Designer for review.

---

## Change management

Update this file + [`projectStandards.ts`](../../src/config/projectStandards.ts) rule `ai.vibe.operator-playbook` + [`contextAssembly.ts`](../../src/core/ai/agent/contextAssembly.ts) compact rules when playbook changes.
