# Standards index

Audience: **AI agents**. Operator does not consume these files.

**Precedence:** only in [`AGENTS.md`](../../AGENTS.md). Do not fork that table here.

Load **one shard** for the task. Do not read this whole folder.

## Document kinds

| Kind | Where | When to load |
|------|-------|----------------|
| **Always-on invariants** | [`AGENTS.md`](../../AGENTS.md) | Every task (injected) |
| **Constraint shards** | this folder (`*.md` except playbooks) | Task matches the topic |
| **Playbooks** | `vibe-*.md`, [`optimization.md`](./optimization.md) | In-app AppEndO Agent, or user asked for optimization / dead-code / performance / security |
| **Architecture** | [`.specify/memory/constitution.md`](../../.specify/memory/constitution.md) · [`src/ARCHITECTURE.md`](../../src/ARCHITECTURE.md) · [`docs/architecture/`](../architecture/) | New feature, layer/security/routing work |
| **Navigation** | [`docs/ai/CODEBASE_INDEX.md`](../ai/CODEBASE_INDEX.md) · `get_feature_graph` | “Where is X?” |
| **Audit / backlog** | [`docs/architecture/ui-fluent2-audit.md`](../architecture/ui-fluent2-audit.md) | Debt log — **not** a standard |
| **Queue** | `plans/` | “What to build next?” |

Machine index of the same constraints: [`src/config/projectStandards.ts`](../../src/config/projectStandards.ts) · `GET /api/project-standards` · `get_project_standards({ shard | query })`.

## Topic map

### UI (tokens → interaction → chrome)

| When | Shard | `get_project_standards` key |
|------|-------|------------------------------|
| Color, typography, spacing, radius, elevation, icons | [`ui-design-system.md`](./ui-design-system.md) | `ui-design-system` |
| Forms, form sections, shell loading, English copy, Color it, floating panels, canvas viewport, toasts, page guide | [`ui-core.md`](./ui-core.md) | `ui-core` |
| Viewport tiers, mobile/tablet adaptation, responsive QA | [`ui-responsive.md`](./ui-responsive.md) | `ui-responsive` |
| Dialogs, wizards, access editor, delete confirm | [`ui-dialog.md`](./ui-dialog.md) | `ui-dialog` |
| Delete confirm (alias) | [`confirmations.md`](./confirmations.md) → ui-dialog | `confirmations` |
| Toolbars, buttons, back, refresh, search, List Filter | [`ui-toolbar.md`](./ui-toolbar.md) | `ui-toolbar` |
| Grids, columns, paging, cards | [`ui-grid.md`](./ui-grid.md) | `ui-grid` |
| CRUD lists, tree pages | [`crud-pages.md`](./crud-pages.md) | `crud-pages` |
| CRUD Set (unified `CrudSet` + Edit / View `RecordForm`; wizard sets props) | [`crud-set.md`](./crud-set.md) | `crud-set` |
| Nested editor URL + shell + content header | [`deep-linking.md`](./deep-linking.md) | `deep-linking` |
| Nested-editor read-only inspector (side panel) | [`ui-inspector-rail.md`](./ui-inspector-rail.md) | `ui-inspector-rail` (alias `ui-side-panel`) |
| Which control to use | Base Components `/studio/base-components` · `baseComponentCatalog.ts` | — (living catalog) |

### Data & identity

| When | Shard | Key |
|------|-------|-----|
| Data API REST / filter DSL | [`data-studio.md`](./data-studio.md) | `data-studio` |
| Data API pivot (dataset prep + request spec) | [`data-api-pivot.md`](./data-api-pivot.md) | `data-api-pivot` |
| Personalizable dashboard canvas | [`personalizable-dashboard-canvas.md`](./personalizable-dashboard-canvas.md) | `personalizable-dashboard-canvas` |
| OLAP SSAS bridge | [`olap-bridge.md`](./olap-bridge.md) | `olap-bridge` |
| Internal ROLAP star schema | [`rolap-star-schema.md`](./rolap-star-schema.md) | `rolap-star-schema` |
| MongoDB analytics provider | [`mongodb-analytics-provider.md`](./mongodb-analytics-provider.md) | `mongodb-analytics-provider` |
| Elasticsearch analytics provider | [`elasticsearch-analytics-provider.md`](./elasticsearch-analytics-provider.md) | `elasticsearch-analytics-provider` |
| Pivot threshold alerts | [`pivot-threshold-alerts.md`](./pivot-threshold-alerts.md) | `pivot-threshold-alerts` |
| Dashboard widget comments | [`dashboard-widget-comments.md`](./dashboard-widget-comments.md) | `dashboard-widget-comments` |
| Dashboard AI assist | [`dashboard-ai-assist.md`](./dashboard-ai-assist.md) | `dashboard-ai-assist` |
| Dashboard sharing | [`dashboard-sharing.md`](./dashboard-sharing.md) | `dashboard-sharing` |
| Data Studio modeler layout/chrome | [`data-studio-modeler.md`](./data-studio-modeler.md) | `data-studio-modeler` |
| `base_` tables, audit, slugs, `note`, control-plane DB (SQL Server default, locked after setup) | [`data-model.md`](./data-model.md) | `data-model` |
| Individual vs Company profile | [`identity-profile.md`](./identity-profile.md) | `identity-profile` |
| Record Policy (Capability ≠ Scope) | [`record-policy.md`](./record-policy.md) | `record-policy` |
| Record event log (append-only history, timeline, client metadata) | [`record-event-log.md`](./record-event-log.md) | `record-event-log` |
| User message inbox (MSGI dispatch ledger, Messages vs work items) | [`user-message-inbox.md`](./user-message-inbox.md) | `user-message-inbox` |
| Platform Ops Dashboards (Insights canvases, Home widget, `base_ops_*`) | [`platform-ops-dashboards.md`](./platform-ops-dashboards.md) | `platform-ops-dashboards` |
| Cache key format | [`cache-keys.md`](./cache-keys.md) | `cache-keys` |

### Platform

| When | Shard | Key |
|------|-------|-----|
| No legacy / dual format | [`greenfield.md`](./greenfield.md) | `greenfield` |
| Dev login + browser session restore | [`dev-auth.md`](./dev-auth.md) | `dev-auth` |
| Access Assistant (Studio tools · contextual Allowed wizard) | [`access-assistant.md`](./access-assistant.md) | `access-assistant` |
| Edge OpenAPI / Swagger | [`server-functions-openapi.md`](./server-functions-openapi.md) | `edge-openapi` |
| MCP packs, inbound host, EUA | [`ai-mcp.md`](./ai-mcp.md) | `mcp-servers` |
| Component Designer name vs draft id | [`component-designer.md`](./component-designer.md) | `component-designer` |
| Workflow Engine: data first, no scenario hardcode | [`workflow-engine-testing.md`](./workflow-engine-testing.md) | `workflow-engine-testing` |

### Packages

| When | Shard | Key |
|------|-------|-----|
| Package lists, editors, Phase 3 gate | [`package-ui.md`](./package-ui.md) | `package-ui` |
| Shared Base Info vocab form | [`package-base-info-vocab.md`](./package-base-info-vocab.md) | `package-base-info-vocab` |
| Local release cut (`npm run release:cut`, OSS cms + remote-hubs only) | [`release-cut.md`](./release-cut.md) | `release-cut` |
| Hawiety multi-step SQL writes → procedures/functions | [`package-hawiety-db.md`](./package-hawiety-db.md) | `package-hawiety-db` |
| Hawiety geo/nakhebin UI words (region vs eghtera, maktab vs tamvin) | [`package-hawiety-ui-vocab.md`](./package-hawiety-ui-vocab.md) | `package-hawiety-ui-vocab` |
| Hawiety member list avatar code (blue username / red tracking; Waited queues) | [`package-hawiety-member-face-caption.md`](./package-hawiety-member-face-caption.md) | `package-hawiety-member-face-caption` |
| Hawiety member-list field-by-field filter rows (mode 2 toolbar) | [`package-hawiety-member-list-legacy-filters.md`](./package-hawiety-member-list-legacy-filters.md) | `package-hawiety-member-list-legacy-filters` |
| Hawiety domain invariants (electoral-tree single anchor per role) | [`package-hawiety-domain-invariants.md`](./package-hawiety-domain-invariants.md) | `package-hawiety-domain-invariants` |

### Agent hub (`agent.*`)

| When | Shard | Key |
|------|-------|-----|
| Page edit lock (all pages locked until prompt names pageKey) | [`agents-hub.md`](./agents-hub.md) | `agents-hub` |

### Playbooks (not product constraints)

| When | Shard | Key |
|------|-------|-----|
| In-app agent first load | [`vibe-operator-playbook.md`](./vibe-operator-playbook.md) | `vibe-operator-playbook` |
| WF-1..4 map | [`vibe-coding-workflows.md`](./vibe-coding-workflows.md) | `vibe-coding-workflows` (alias `appendoo-workflows`) |
| WF-1 Server Functions | [`vibe-server-function.md`](./vibe-server-function.md) | `vibe-server-function` |
| WF-2 CRUD UI | [`vibe-crud.md`](./vibe-crud.md) | `vibe-crud` |
| WF-3 edit layout | [`vibe-designer-edit.md`](./vibe-designer-edit.md) | `vibe-designer-edit` |
| Dead-code cleanup only | [`optimization.md`](./optimization.md) | `dead-code` (alias `optimization-dead-code`) |
| Performance pass only | [`optimization.md`](./optimization.md) | `optimization-performance` |
| Security pass only | [`optimization.md`](./optimization.md) | `optimization-security` |
| Full optimization (all three axes) | [`optimization.md`](./optimization.md) | `optimization` |

## Cursor rules (path-scoped pointers)

`.cursor/rules/*.mdc` fire on globs. They point here — they must not restate shard prose.

| Rule | Shard |
|------|-------|
| `shared-ui.mdc` | `ui-design-system` · `ui-core` · `ui-toolbar` · `ui-grid` · `ui-dialog` · `ui-inspector-rail` |
| `feature-auth-session.mdc` | `dev-auth` |
| `feature-component-designer.mdc` | `component-designer` · `crud-set` · `ui-dialog` · `deep-linking` |
| `feature-server-functions.mdc` | `data-studio` · `edge-openapi` · `deep-linking` |
| `feature-data-studio.mdc` | `data-studio` · `data-studio-modeler` · `deep-linking` · `record-policy` |
| `feature-packages.mdc` | `package-ui` · `package-base-info-vocab` · `greenfield` |
| `feature-settings.mdc` | `ui-core` · `mcp-servers` |
| `feature-cache.mdc` | `cache-keys` |
| `feature-users.mdc` | `crud-pages` · `data-model` · `identity-profile` |
| `feature-roles.mdc` | `crud-pages` · `ui-dialog` |
| `feature-platform-portals.mdc` | [`experience-routing.md`](../architecture/experience-routing.md) |
| `feature-workflow-engine.mdc` | `workflow-engine-testing` |
| `feature-workflows.mdc` | `deep-linking` · `workflow-engine-testing` |
| `feature-chat-history.mdc` | `mcp-servers` |
| `feature-idea-foundry.mdc` | `deep-linking` · `ui-inspector-rail` |
| Other `feature-*.mdc` | `get_feature_graph({ pageKey })` — no extra shard unless listed above |

## Shard file shape

Each constraint shard:

1. **Intent** — what decision it locks
2. **MUST / NEVER** — bullets an agent can violate-check
3. **Do this** — only when a recipe is required
4. **Tokens / files** — owning code
5. **IDs** — `projectStandards.ts` ids

Playbooks may keep procedural steps.

## Change management

1. Edit the shard (canonical).
2. Sync the one-liner in `projectStandards.ts`.
3. Update [`AGENTS.md`](../../AGENTS.md) only if always-on or precedence changes.
4. Add a `STANDARDS_SHARD_PATHS` entry if you add a new shard file.
