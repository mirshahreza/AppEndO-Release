# AppEndO documentation

Audience: **AI agents**. Bulk human-only docs live in [`archive/`](./archive/) (`.cursorignore` — explicit `@` to load).

## Active stack

```
AGENTS.md  (always-on + precedence)
  → docs/standards/INDEX.md  (topic map)
    → one shard
  → constitution / ARCHITECTURE.md  (when architecture)
  → docs/ai/CODEBASE_INDEX.md  (where code lives)
  → plans/  (what to build next)
```

| Path | Role |
|------|------|
| [`../AGENTS.md`](../AGENTS.md) | Always-on invariants + single precedence |
| [`standards/INDEX.md`](./standards/INDEX.md) | Topic map — load one shard |
| [`standards/*.md`](./standards/) | Constraint shards and in-app playbooks |
| [`ai/CODEBASE_INDEX.md`](./ai/CODEBASE_INDEX.md) | **Generated** navigation — `npm run codegen:ai-index` |
| [`plans-workflow.md`](./plans-workflow.md) | `plans/core` · `plans/packages` lifecycle |
| [`architecture/`](./architecture/) | Domain runtime contracts + audit backlogs |

## Domain contracts (load when touching that area)

| Path | Role |
|------|------|
| [`architecture/experience-routing.md`](architecture/experience-routing.md) | Culture × Application × Route |
| [`architecture/system-extensions.md`](architecture/system-extensions.md) | System Extensions vs Packages |
| [`architecture/artifacts.md`](architecture/artifacts.md) | Studio ZIP artifacts map |
| [`architecture/identity-engine.md`](architecture/identity-engine.md) | Identity Engine · provider extensions |
| [`architecture/multi-node-deployment.md`](architecture/multi-node-deployment.md) | Multi-node ops · proxy · health/readiness |
| [`architecture/ui-fluent2-audit.md`](architecture/ui-fluent2-audit.md) | UI token/HTML audit backlog (not a standard) |

## Product docs

| Path | Role |
|------|------|
| [`outreach/why-appendo.md`](./outreach/why-appendo.md) | English introduction: AI coding guardrails, platform capabilities, and why AppEndO is useful |
| [`outreach/why-appendo-fa.md`](./outreach/why-appendo-fa.md) | Persian version of the AppEndO introduction |
| [`appendo-architecture.md`](./appendo-architecture.md) | High-level product architecture and runtime model |
| [`appendo-features.md`](./appendo-features.md) | MVP feature inventory extracted from the current codebase |

Package ZIP contract: [`architecture/artifacts.md`](architecture/artifacts.md) · [`standards/data-model.md`](standards/data-model.md).

Path-scoped Cursor rules: `.cursor/rules/feature-*.mdc`, `shared-ui.mdc`.
