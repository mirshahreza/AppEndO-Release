# AI Coding Standards (hub)

Audience: **AI agents**. The operator does not read these files. Load **one topic shard** per task — never the whole `docs/standards/` folder.

## Precedence (canonical — do not fork)

When instructions conflict, this order wins:

| # | Source | Governs |
|---|--------|---------|
| 1 | [`.specify/memory/constitution.md`](.specify/memory/constitution.md) | Architecture, security, FSD import graph, SDD |
| 2 | Approved `specs/<feature>/` | Feature scope |
| 3 | **This hub** (always-on) + **one** [`docs/standards/`](docs/standards/INDEX.md) shard | Product / UI / API constraints |
| 4 | [`src/ARCHITECTURE.md`](src/ARCHITECTURE.md) | Structural map |
| 5 | [`src/config/projectStandards.ts`](src/config/projectStandards.ts) | Machine **index** of the same rules (`GET /api/project-standards`, `get_project_standards`). Not a second policy. |
| 6 | Session prompt | Current task |

**Inside UI:** [`ui-design-system.md`](docs/standards/ui-design-system.md) (tokens) → [`ui-core.md`](docs/standards/ui-core.md) (interaction) → `ui-dialog` / `ui-toolbar` / `ui-grid` / `ui-inspector-rail` / `crud-pages` → feature shards (`data-studio-modeler`, `package-ui`, …). A feature shard may mark an explicit **exception**.

## Always-on

1. **Prompt scope only.** Work strictly on what the current operator prompt explicitly requests. Do not edit, refactor, fix, test, or extend anything outside that scope — no drive-by cleanup, unrelated lint fixes, opportunistic improvements, or implied follow-on work. Minimum necessary reads and edits to fulfill the prompt are in scope; everything else is not. If the prompt is ambiguous or the goal requires touching out-of-scope code, **stop and ask** — do not assume or proceed on your own.
2. **Base Components first.** Every UI control comes from `/studio/base-components` (`pageKey: base-components`, catalog `src/features/base-components/`). No raw HTML form inputs/checkboxes/textareas, no ad-hoc HeroUI, no parallel base widgets when a catalog section exists. Match the living sample (component, props, size, intent, chrome).
3. **Greenfield.** One contract per feature. No dual parsers, legacy aliases, runtime migration, or `@deprecated` shims. Shard: [`greenfield.md`](docs/standards/greenfield.md).
4. **English-only production source** (TS/TSX/JSON under `src/` and `public/`). Exceptions: culture translation paths, `rtlScriptPreviewSamples.ts`, multilingual columns in `database.ts` seeds — see [`ui-core.md`](docs/standards/ui-core.md) §English-only (production). Enforce with `npm run hygiene:english-copy`. Markdown `docs/` / `plans/` exempt.
5. **FSD downward only.** `features/` must not import other `features/` or `pages/`. `shared/` must not import `features/` or `pages/`. Page files stay thin. Full graph: constitution §2.
6. **DB path.** Control-plane `base_*` tables via domain repositories. **New** control-plane tables use **Sequelize** (`controlPlaneSequelize`). External/edge data via `EdgeDbRouter` / Edge Sequelize only. **Prisma is locked** — do not add Prisma models, `getPrismaControlPlane()` calls, or `schema.prisma` tables unless the operator **explicitly and clearly** grants Prisma for that task. Existing Prisma usage is legacy; do not extend it.
7. **JWTs in HttpOnly cookies only** — never `localStorage` / `sessionStorage`. Shard: [`dev-auth.md`](docs/standards/dev-auth.md).
8. **Color / type tokens** live in [`ui-design-system.md`](docs/standards/ui-design-system.md). Semantic hues on **text, icons, badges, small objects**; large surfaces stay slate/neutral. Operator cue **“Color it”** → small-area meaning-first accents — recipe in [`ui-core.md`](docs/standards/ui-core.md).
9. **Dev auth.** Simple username/password unless the task is auth E2E. Shard: [`dev-auth.md`](docs/standards/dev-auth.md).
10. **Admin shell geometry locked.** Do not change admin-shell sidebar/header/logo **sizes, spacing, or React vs designer-published parity** unless the operator explicitly asked for a shell fix **and confirmed** the edit in that session. Shard: [`ui-core.md`](docs/standards/ui-core.md) §Admin shell geometry lock · ID `ui.admin-shell.geometry-lock`.

Domain rules (deep links, record policy, workflow-engine testing, package UI) are **not** always-on. Load their shard when the task hits that surface.

## Where to look

| Need | Open |
|------|------|
| Full topic map | [`docs/standards/INDEX.md`](docs/standards/INDEX.md) |
| Architecture / SDD | constitution · [`src/ARCHITECTURE.md`](src/ARCHITECTURE.md) |
| Where code lives | [`docs/ai/CODEBASE_INDEX.md`](docs/ai/CODEBASE_INDEX.md) · `get_feature_graph({ pageKey })` |
| What to build next | [`plans/core/todo/p-00-todo-index.md`](plans/core/todo/p-00-todo-index.md) |
| In-app AppEndO Agent | [`vibe-operator-playbook.md`](docs/standards/vibe-operator-playbook.md) |

## Topic map (load one)

| Task | Shard |
|------|-------|
| Which control | Base Components `/studio/base-components` · `baseComponentCatalog.ts` |
| Color, type, space, radius, elevation, icons | [`ui-design-system.md`](docs/standards/ui-design-system.md) |
| Forms, shell loading, English copy, Color it, toasts | [`ui-core.md`](docs/standards/ui-core.md) |
| Mobile/tablet adaptation, viewport QA | [`ui-responsive.md`](docs/standards/ui-responsive.md) |
| Dialogs, wizards, access, delete confirm | [`ui-dialog.md`](docs/standards/ui-dialog.md) |
| Toolbars, buttons, WorkspaceBack, refresh | [`ui-toolbar.md`](docs/standards/ui-toolbar.md) |
| Grids, columns, paging | [`ui-grid.md`](docs/standards/ui-grid.md) |
| CRUD / tree pages | [`crud-pages.md`](docs/standards/crud-pages.md) |
| CRUD Set (unified `CrudSet` + Edit / View `RecordForm`; wizard sets props) | [`crud-set.md`](docs/standards/crud-set.md) |
| Nested editor URL + shell header | [`deep-linking.md`](docs/standards/deep-linking.md) |
| Nested-editor read-only inspector (side panel) | [`ui-inspector-rail.md`](docs/standards/ui-inspector-rail.md) |
| Data API REST | [`data-studio.md`](docs/standards/data-studio.md) |
| Data API pivot (dataset prep + request spec) | [`data-api-pivot.md`](docs/standards/data-api-pivot.md) |
| Data Studio modeler chrome | [`data-studio-modeler.md`](docs/standards/data-studio-modeler.md) |
| `base_` tables, slugs, note vs description, control-plane DB (SQL Server default, locked after setup) | [`data-model.md`](docs/standards/data-model.md) |
| Individual / Company profile | [`identity-profile.md`](docs/standards/identity-profile.md) |
| Record Policy (Capability vs Scope) | [`record-policy.md`](docs/standards/record-policy.md) |
| Record event log / timeline / client metadata | [`record-event-log.md`](docs/standards/record-event-log.md) |
| Package lists / editors / Phase 3 | [`package-ui.md`](docs/standards/package-ui.md) |
| Package Base Info vocab forms | [`package-base-info-vocab.md`](docs/standards/package-base-info-vocab.md) |
| Component Designer identity | [`component-designer.md`](docs/standards/component-designer.md) |
| Cache keys | [`cache-keys.md`](docs/standards/cache-keys.md) |
| OpenAPI / Swagger | [`server-functions-openapi.md`](docs/standards/server-functions-openapi.md) |
| MCP / AppEndO Agent platform | [`ai-mcp.md`](docs/standards/ai-mcp.md) |
| Access Assistant (Studio tools · page function Allowed wizard) | [`access-assistant.md`](docs/standards/access-assistant.md) |
| Workflow Engine testing | [`workflow-engine-testing.md`](docs/standards/workflow-engine-testing.md) |
| Dead-code cleanup only | [`optimization.md`](docs/standards/optimization.md) (`dead-code`) |
| Performance pass only | [`optimization.md`](docs/standards/optimization.md) (`optimization-performance`) |
| Security pass only | [`optimization.md`](docs/standards/optimization.md) (`optimization-security`) |
| Full optimization (all three axes) | [`optimization.md`](docs/standards/optimization.md) |
| Full-app smoke (every studio route, errors + screenshots) | [`.claude/skills/appendo-qa-smoke-pass/SKILL.md`](.claude/skills/appendo-qa-smoke-pass/SKILL.md) |
| Full-app functional QA (Appearance + Settings + Base Components + routes; screenshot/fix loop, non-stop) | [`.claude/skills/appendo-qa-functional-pass/SKILL.md`](.claude/skills/appendo-qa-functional-pass/SKILL.md) |
| Startup / boot performance (READY, `/api/boot`, first shell paint) | [`.claude/skills/appendo-perf-startup/SKILL.md`](.claude/skills/appendo-perf-startup/SKILL.md) |
| Soft / playful UI polish (گوگولی · خوشگل) on Studio chrome | [`.claude/skills/appendo-build-ui-playful-polish/SKILL.md`](.claude/skills/appendo-build-ui-playful-polish/SKILL.md) |
| Hawiety TS → SQL Server objects + verify gate | [`.claude/skills/appendo-build-hwy-db-objects/SKILL.md`](.claude/skills/appendo-build-hwy-db-objects/SKILL.md) · shard [`package-hawiety-db.md`](docs/standards/package-hawiety-db.md) |
| Hawiety UI words (region / maktab, not eghtera / tamvin) | [`package-hawiety-ui-vocab.md`](docs/standards/package-hawiety-ui-vocab.md) |
| Hawiety member list avatar caption (username blue / tracking red; queue lists) | [`package-hawiety-member-face-caption.md`](docs/standards/package-hawiety-member-face-caption.md) |
| Hawiety member-list field-by-field filter rows (toolbar mode 2) | [`package-hawiety-member-list-legacy-filters.md`](docs/standards/package-hawiety-member-list-legacy-filters.md) |
| Hawiety domain invariants (electoral geo: process vs direct) | [`package-hawiety-domain-invariants.md`](docs/standards/package-hawiety-domain-invariants.md) |
| Custom skill index (`appendo-build-*` · `appendo-qa-*` · `appendo-perf-*`) | [`.claude/skills/SKILLS-CATALOG.md`](.claude/skills/SKILLS-CATALOG.md) |

## Change management

1. Edit the **shard** (canonical prose).
2. Update the matching one-liner in `projectStandards.ts` (`id` + `value` + `appliesTo`).
3. Touch this hub only if always-on rules or precedence change.

`.github/copilot-instructions.md` and `README.md` are pointers only.
