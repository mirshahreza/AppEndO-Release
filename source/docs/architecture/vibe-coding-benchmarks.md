# Benchmark وایب‌کدینگ — Cursor · Claude Code · Zed · aweb · AppEndO

> **Spec:** [`specs/vibe-coding/01-spec.md`](../../specs/vibe-coding/01-spec.md)  
> **Spec:** [`specs/vibe-coding/01-spec.md`](../../specs/vibe-coding/01-spec.md)  
> **تحلیل Zed:** [`zed-lessons-for-appendo.md`](./zed-lessons-for-appendo.md)  
> **Workflowها:** [`docs/standards/vibe-coding-workflows.md`](../standards/vibe-coding-workflows.md)

---

## هدف سند

این سند برای **تیم داخلی AppEndO** است: مقایسهٔ پلتفرم‌های وایب‌کدینگ رایج با وضعیت فعلی و هدف p-50، تا قبل از شروع پیاده‌سازی VC-1 بدانیم **کجا دست بالا داریم** و **کجا باید از دیگران الهام بگیریم**.

**Non-goal:** جایگزین Cursor برای همهٔ devها؛ AppEndO مکمل in-app روی همان instance زنده است.

---

## ماتریس مقایسه (خلاصه)

| قابلیت | Cursor | Claude Code | Zed | aweb | AppEndO (الان → p-50) |
|--------|--------|-------------|-----|------|------------------------|
| **Harness / loop** | ReAct + agent harness | master loop + hooks + TodoWrite | `AcpThread` + Native/ACP | coordination (mail/tasks) | `AgentOrchestrator` (ReAct) → **VibeHarness** |
| **Context** | semantic index + `@` | compaction + CLAUDE.md/skills | mentions + LSP + `@file` | team context | `pageContext` + feature graph + standards |
| **جستجوی کد** | embedding + ripgrep | grep + read | GrepTool + buffer | — | ripgrep (`search_codebase`) → hybrid index |
| **مدل ویرایش** | patch / multi-file | diff workflow | `EditFileTool` | file reservation | `draft_*` → proposal → confirm → apply |
| **Verify** | lint/test در loop | Pre/PostToolUse hooks | TerminalTool | — | **VC-4:** `run_tests` + post-apply verify |
| **Tool policy** | rules + hooks | permission gates | `ToolPermissionDecision` | locks | MCP access + `writeRequiresConfirm` |
| **Host protocol** | proprietary | CLI/SDK | **ACP** (JSON-RPC) | MCP + identity | **MCP** in-process + Inbound `/api/mcp` |
| **Persistence** | chat history | session resume | SQLite `ThreadStore` | tasks/mail | Prisma chat sessions + rollback snapshots |
| **اجرا / deploy** | edit → build/test محلی | terminal + hooks | `TerminalTool` | file locks | **همان runtime زنده** — apply → API + UI فوری |
| **محصول** | IDE عمومی | CLI/IDE agent | IDE + BYO agent | multi-agent mesh | **admin platform داخلی** |

---

## AppEndO — وضعیت فعلی (baseline)

| لایه | فایل / مسیر | وضعیت |
|------|-------------|--------|
| UI | `src/components/AiPanel.tsx` | Plan / Ask / Agent · proposal confirm |
| Orchestrator | `src/core/ai/agent/AgentOrchestrator.ts` | ReAct · vibe plan event · validation |
| Context | `src/core/ai/agent/contextAssembly.ts` | prompt rules (بدون state machine اجباری) |
| MCP packs | `src/server/services/ai/mcp/builtin/` | P0+P1 in-process |
| Apply | `src/server/services/ai/changeSet.service.ts` | file · layout · server function · git |
| **Server runtime** | managed Server Functions · `workspace/server-functions/` | apply → **همان Node process** — API/route فوری؛ `test_server_function` قبل از confirm |
| **Client runtime** | Component Designer · `workspace/designer/drafts/` | apply → layout/route/preview **در همان app** — handoff Designer |
| Allowlist | `src/core/ai/tools/pathAllowlist.ts` | **gap:** بدون `src/server/` |
| Search | `src/core/ai/tools/native/searchCodebase.ts` | متن (ripgrep) نه vector |

---

## مزیت‌های رقابتی AppEndO (دست بالا)

IDEها و editor agentها این‌ها را **به‌صورت native** ندارند:

1. **Managed Server Functions** — ساخت/تست/اعمال سرویس از UI همان پلتفرم (`appendo-server-functions`، `draft_server_function`، `test_server_function`).
2. **Component Designer** — layout + binding + handoff به `/client-components` (نه فقط patch فایل TSX).
3. **`get_project_standards`** — استانداردهای vibe-coding و UI از shardهای canonical (`docs/standards/`، `projectStandards.ts`).
4. **RBAC روی MCP** — pack/server per role (`mcpAccess`)؛ internal-only بدون SaaS چندمستاجره.
5. **Greenfield policy** — یک مسیر apply/rollback؛ بدون dual format یا migration runtime.
6. **Unified live runtime** — **بدون انجین/پروسس اجرای جدا** برای vibe coding: بعد از apply، Server Function همان لحظه از runtime موجود AppEndO به‌صورت API در دسترس است؛ Client Component از همان instance (Designer preview/route) render می‌شود — نه deploy جدا، نه sandbox engine جدید.

### Unified live runtime (جزئیات)

| لایه | پس از apply | انجین جدا؟ |
|------|-------------|------------|
| **Server** | managed Server Functions در `workspace/server-functions/` · route/API همان process | **خیر** — همان Node runtime |
| **Client** | layout در `workspace/designer/drafts/` · preview/route Component Designer | **خیر** — همان React app |
| **Verify (VC-4)** | `run_tests` · post-apply check | روی **همان** runtime — نه spin-up container/engine |

**Non-goal p-50:** ساخت vibe execution engine جدا (Docker sidecar، VM sandbox، یا deploy pipeline اختصاصی برای هر draft).

Spec: [`specs/vibe-coding/01-spec.md`](../../specs/vibe-coding/01-spec.md) § Unified live runtime.

---

## چه از هر پلتفرم می‌گیریم / نمی‌گیریم

### Cursor

| می‌گیریم | نمی‌گیریم |
|----------|-----------|
| harness جدا از model | cloud index (Turbopuffer) |
| hybrid search (rg + semantic) | IDE-native multi-worktree |
| verify بعد از edit | — |
| Merkle/incremental re-index (ایده) | — |

### Claude Code / Agent SDK

| می‌گیریم | نمی‌گیریم |
|----------|-----------|
| master ReAct + hooks | auto-approve همه tools |
| structured plan / TodoWrite | — |
| compaction با LLM (segment H) | — |
| subagent برای task سنگین (backlog) | — |

### Zed

| می‌گیریم | نمی‌گیریم |
|----------|-----------|
| UI/agent separation (ACP spirit) | GPUI / Rust stack |
| `AcpThread` واحد برای native+external | ACP registry عمومی |
| multi-buffer diff review (هدف UX) | multiplayer collab |
| mentions `@file` (spec VC-2.5) | — |
| Tree-sitter برای chunk (VC-3) | fork Zed |

جزئیات: [`zed-lessons-for-appendo.md`](./zed-lessons-for-appendo.md).

### aweb ([awebai/aweb](https://github.com/awebai/aweb))

| می‌گیریم | نمی‌گیریم |
|----------|-----------|
| file reservation ساده (in-process) | DID / agent mesh |
| task board برای conflict | — |

### OpenCode / AI Factory

| می‌گیریم | نمی‌گیریم |
|----------|-----------|
| MCP vertical rail | wrap agent خارجی به‌جای in-process |
| workflow skills per task | — |

---

## نقشه p-50 روی benchmark

| فاز p-50 | پاسخ به gap benchmark |
|----------|------------------------|
| VC-1 Foundation | allowlist full-stack · server_function apply · pageContext |
| VC-2 VibeHarness | enforced retrieve→draft (Claude/Zed hooks) |
| VC-3 Hybrid index | Cursor-style semantic + rg |
| VC-4 Verify | Claude/Cursor verify loop |
| VC-5 Designer L | Zed multi-buffer + designer tools |
| VC-6 Workflows doc | AI Factory-style skills |

Roadmap: [`specs/vibe-coding/03-implementation-roadmap.md`](../../specs/vibe-coding/03-implementation-roadmap.md).

---

## Gate مستندسازی

**شروع پیاده‌سازی VC-1 (کد)** فقط پس از sign-off PO روی:

- این سند (benchmarks)
- [`vibe-coding-workflows.md`](../standards/vibe-coding-workflows.md)
- [`zed-lessons-for-appendo.md`](./zed-lessons-for-appendo.md)

---

## مراجع

- [Zed — GitHub](https://github.com/zed-industries/zed)
- [Zed — Agent Client Protocol](https://zed.dev/acp)
- [Zed — Bring Your Own Agent](https://zed.dev/blog/bring-your-own-agent-to-zed)
- [aweb.ai](https://aweb.ai/)
- AppEndO: [`docs/standards/ai-mcp.md`](../standards/ai-mcp.md)
