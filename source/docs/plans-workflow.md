# Plans Workflow — plans/core / plans/packages

> **Core index:** [`plans/core/todo/p-00-todo-index.md`](../plans/core/todo/p-00-todo-index.md)  
> **Packages index:** [`plans/packages/todo/p-00-packages-index.md`](../plans/packages/todo/p-00-packages-index.md)  
> **Next release:** [`plans/core/next/p-00-next-index.md`](../plans/core/next/p-00-next-index.md)  
---

## Folder layout

```
plans/
  core/
    todo/    — current release (platform core)
    next/    — deferred next-wave
  packages/
    todo/    — Studio package tracks
```

Completed plans are **deleted**, not archived. Specs and shards remain the long-lived source of truth.

| Folder | Purpose |
|--------|---------|
| `plans/core/todo/` | Active `p-NN` platform plans — «برو جلو» entry |
| `plans/core/next/` | Deferred unfinished work |
| `plans/packages/todo/` | Package backlog + per-package specs (`p-packages-*` or `<slug>-package/`) |

---

## File naming

| Pattern | Meaning |
|---------|---------|
| `p-NN-<slug>.md` | Platform phase |
| `p-packages-<slug>.md` | Package track (single file) |
| `<slug>-package/` | Package track folder (spec + execution prompts) — e.g. `crm-package/` · `tsk-package/` |
| `p-00-todo-index.md` | Core control index |
| `p-00-packages-index.md` | Packages control index |
| `p-00-next-index.md` | Deferred phases index |

---

## Persian prose and RTL (plans and operator-facing dev docs)

Markdown under `plans/` (and any **development** document meant for the operator or Persian-speaking team) follows these rules. They do **not** replace the English-only rule for production source under `src/` and `public/` (`AGENTS.md`).

| Rule | Detail |
|------|--------|
| Wrapper | Wrap the full document in `<div dir="rtl" lang="fa">` … `</div>` so mixed Persian/English blocks render right-to-left and stay readable in GitHub and the IDE. |
| Body prose | Section intros, decisions, and acceptance notes are written in **fluent Persian** — complete sentences, natural connectors, not telegraphic bullet chains or machine-translated stiffness. |
| Persian paragraphs | Prefer **full Persian characters** in explanatory paragraphs (نه نیم‌فاصلهٔ انگلیسی در وسط جملهٔ فارسی). Keep **identifiers** in English as in code: table names (`tsk_tasks`), paths, `pageKey`, culture keys, API paths. |
| Tables | Column headers and cell labels may mix English technical terms with Persian gloss where it helps; long narrative still belongs in prose above the table. |
| Code / prompts | Execution prompts and shell commands stay as-is (often English); surround them with Persian instructions when the audience is the operator. |
| Studio-meta Story | English Markdown inside `extensions.story` in Data Studio remains English (modeler convention); the **plan** may summarize the same rules in Persian in the domain section. |

When adding or revising a package plan folder (`<slug>-package/`), apply the wrapper and tone to **all** companion files (`*-phase-execution-prompts.md`, review notes, README).

---

## Plan header metadata

Every plan file under `plans/core/todo/` and `plans/packages/todo/` must include an **implementation priority** line in the opening blockquote:

```markdown
> **اولویت پیاده‌سازی:** 1 — short English or Persian note
```

| Rule | Detail |
|------|--------|
| Field | `اولویت پیاده‌سازی` (also accepted: `Implementation priority`) |
| Value | Integer starting at `1` (lower = sooner). Unset dash (`—`) means no rank. |
| Legacy | Older `> **اولویت:** N` lines are still parsed when the new field is absent. |

---

## Lifecycle

**Create:** add plan file + row in relevant index.  
**Complete:** delete the plan file + drop from indexes + `npm run test:critical`.  
**Defer:** `git mv` to `next/` + update both indexes.

**Agent prompt:**

```
@plans/core/todo/p-00-todo-index.md برو جلو
```

---

## Current release (موج ۶)

| Priority | Plan | Status |
|----------|------|--------|
| P1 | [tsk-package](../plans/packages/todo/tsk-package/p-packages-task-management.md) | Package فعال — design only |
| — | — | p-52 بسته شد (۲۰۲۶-۰۹-۱۵). Core فاز ترتیبی: اپراتور انتخاب کند. |

**Deferred:** [p-00-next-index.md](../plans/core/next/p-00-next-index.md)

**Packages:** [`p-packages-backlog.md`](../plans/packages/todo/p-packages-backlog.md)

---

## AI Plan mode

Plan mode reads/writes markdown under `plans/core/` and `plans/packages/` — see `src/core/ai/tools/pathAllowlist.ts`.

---

*AppEndO implementation planning*
