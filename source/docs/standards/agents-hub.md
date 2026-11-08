# Agents hub

Machine index prefix: `agent.*` · resolves via `get_project_standards({ query: "agent" })`.

## Page edit lock

**ID:** `agent.page-edit-lock`

**Policy:** `all-locked` (`src/config/operatorPageEditLocks.ts`).

Every Studio and package page listed in `docs/ai/page-edit-locks.json` is **edit-locked** for AI agents (IDE assistant, AppEndO Agent, background jobs). Agents must **not** modify files under a page's `searchRoots` until the **current operator prompt** explicitly names that page — by `pageKey`, route, or unambiguous label. Investigation reads are allowed when they directly support an explicitly scoped task. Implied cross-page fixes, refactors, and drive-by cleanup remain forbidden (see also `agent.prompt-scope`).

**Operator actions:**

| Goal | Action |
|------|--------|
| Keep default (all pages locked) | No change — policy is already `all-locked`. |
| Permanently exempt one page | Add its `pageKey` to `OPERATOR_PAGE_EDIT_LOCK_EXCEPTION_PAGE_KEYS` in `src/config/operatorPageEditLocks.ts`. |
| Refresh manifest after registry changes | Run `npm run codegen:ai-index`. |

**Tools:** `get_operator_page_edit_locks` · `get_feature_graph({ pageKey })` · Cursor rule `.cursor/rules/operator-page-edit-lock.mdc` (always on).
