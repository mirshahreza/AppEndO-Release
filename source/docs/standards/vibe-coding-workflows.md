# Workflowهای وایب‌کدینگ داخلی AppEndO

> **Shard:** `vibe-coding-workflows` (alias `appendoo-workflows`)  
> **Playbook:** [`vibe-operator-playbook.md`](./vibe-operator-playbook.md)  
> **Spec:** `specs/vibe-coding/01-spec.md`

---

## Runtime واحد (بدون انجین جدا)

وایب‌کدینگ روی **همان instance زنده AppEndO** اجرا می‌شود:

| لایه | بعد از apply |
|------|--------------|
| **Server** | Server Function → API/route فوری از runtime موجود (`workspace/server-functions/`) |
| **Client** | layout → preview/route در همان app (`workspace/designer/drafts/` · Designer handoff) |

نیازی به deploy جدا، Docker sidecar، یا engine اختصاصی vibe نیست. `test_server_function` و (VC-4) `run_tests` روی **همین** runtime هستند.

Benchmark: [`vibe-coding-benchmarks.md`](../architecture/vibe-coding-benchmarks.md) § Unified live runtime.

---

## پیش‌نیازهای مشترک

| مورد | توضیح |
|------|--------|
| **Mode** | **Agent** (نه Ask/Plan برای write) |
| **Model** | `capabilities.tools: true` |
| **Confirm** | همهٔ writeها via proposal + apply API (`writeRequiresConfirm`); AiPanel در Agent mode proposal معتبر را خودکار apply می‌کند |
| **Packهای پیش‌فرض (هدف p-50)** | files · codebase · standards · context · **server-functions** · **designer** |

---

## WF-1 — سرویس جدید (Server Functions)

**هدف:** API/منطق backend جدید در managed Server Functions.

**Preconditions:**

- کاربر در **Server Functions** (`pageKey: server-functions`)
- pack `appendo-server-functions` فعال

**ترتیب tool (هدف harness):**

1. `get_project_standards({ shard: "vibe-server-function" })` یا query `vibe-server-function`
2. `list_server_functions` / `get_server_function` (اگر مشابه وجود دارد)
3. `read_file` روی نمونه یا contract مرتبط (retrieve gate)
4. `draft_server_function`
5. `test_server_function`
6. proposal → **panel auto-apply** (معتبر در Agent mode)
7. (VC-4) post-apply verify / `run_tests`

**Rollback:** `/api/ai/agent/rollback` پس از apply.

**استانداردها:** [`data-studio.md`](./data-studio.md) · [`server-functions-openapi.md`](./server-functions-openapi.md)

---

## WF-2 — UI CRUD جدید (Client Components)

**هدف:** grid + form CRUD با Component Designer.

**Preconditions:**

- WF-1 انجام شده یا API موجود است
- کاربر در **Client Components** / Designer
- pack `appendo-designer` + `appendo-files` فعال

**ترتیب tool:**

1. `get_project_standards({ shard: "crud-set" })` for a CRUD Set, else `vibe-crud`
2. `get_page_context` · `get_feature_graph({ pageKey: "client-components" })`
3. `search_codebase` + `read_file` روی template/preset مشابه
4. `draft_component_layout` (templateId یا document) — برای **چند صفحه + Shell + منو** از `draft_application_scaffold` استفاده کن (orchestration روی همان draft_component_layout)
5. proposal → panel auto-apply → **Designer handoff** (`/client-components?load=…`)

**UI rules:** HeroUI · `AppTableGrid` · `UiCheckbox` · [`ui-core.md`](./ui-core.md) · [`ui-grid.md`](./ui-grid.md)

---

## WF-3 — تغییر grid/form موجود

**هدف:** اصلاح layout منتشرشده یا draft (مثلاً ستون boolean به icon).

**Preconditions:**

- `layoutId` در `pageContext` (Designer باز است)
- pack designer + standards

**ترتیب tool:**

1. `get_page_context` — `layoutId` · `selectedNodeId`
2. `read_file` روی generated/preview در صورت نیاز
3. (VC-5) `designer_set_prop` / `designer_insert_palette_item` یا `draft_component_layout` از `baseLayoutId`
4. `validateProposal` (standards heuristics)
5. panel auto-apply → باز کردن Designer

**الهام Zed:** multi-buffer diff review قبل از confirm (VC-5).

---

## WF-4 — Full-stack (Server Function + UI)

**هدف:** feature کامل از backend تا UI در یک session یا دو session پشت‌سرهم.

**فاز A — Backend (همان WF-1)**

**فاز B — UI (همان WF-2)** با binding به API جدید

**Harness phases (هدف VC-2):**

```
retrieve → plan → draft → finalize
```

| Phase | Tools مجاز |
|-------|------------|
| retrieve | graph · search · read · get_server_function · standards |
| plan | structured plan artifact (intent · files · steps) |
| draft | `draft_*` فقط پس از retrieve gate |
| finalize | validate · repair (max 2) · proposal |

**محدودیت proposal:** `vibeMaxFilesPerProposal` (هدف: 12 full-stack) · `vibeMaxLinesPerProposal`

---

## Shard keys برای `get_project_standards`

| Shard key | محتوا |
|-----------|--------|
| `vibe-coding-workflows` | این سند (خلاصه WF-1..4) |
| `vibe-operator-playbook` | playbook Agent · runtime زنده · قالب پروژه |
| `vibe-server-function` | WF-1 + template sandbox · `draft_server_function` |
| `vibe-crud` | WF-2 leftover (non CRUD Set) |
| `crud-set` | CRUD Set: one `CrudSet`, wizard sets props |
| `vibe-designer-edit` | WF-3 + component-designer |
| `vibe-benchmarks` | pointer به [`vibe-coding-benchmarks.md`](../architecture/vibe-coding-benchmarks.md) |

Query mode: `get_project_standards({ query: "vibe-crud" })`

---

## چه زمانی Cursor بماند

| سناریو | AppEndO کافی | Cursor بهتر |
|--------|--------------|-------------|
| Server Function + Designer CRUD | بله (WF-1/2) | — |
| refactor گسترده `src/server/` | پس از VC-1 allowlist | بله (index + IDE) |
| debug تعاملی deep | محدود | بله |
| استاندارد UI/platform | **AppEndO** (`get_project_standards`) | rules دستی |

راهنمای عملی: [`docs/archive/internal/vibe-coding-howto-fa.md`](../archive/internal/vibe-coding-howto-fa.md)

---

## خطا و recovery

| خطا | اقدام |
|-----|--------|
| validation violation | repair loop (VC-2) یا reject و prompt دقیق‌تر |
| apply fail | پیام در AiPanel · fix دستی یا retry |
| post-apply verify fail | banner قرمز + لیست checks در AiPanel (VC-4.2) · rollback یا fix دستی |
| rollback | دکمه rollback آخرین apply در AiPanel (`/api/ai/agent/rollback`) |

**VC-6 split:** این shard (VC-6-doc) تکمیل شده؛ **اجرای runtime** قوانین WF و retrieve gate در VC-6-runtime (`contextAssembly.ts` + VibeHarness) — جزئیات در [`01-spec.md`](../../specs/vibe-coding/01-spec.md).

**تست‌های E2E:** ماتریس WF-1..4 در [`03-implementation-roadmap.md`](../../specs/vibe-coding/03-implementation-roadmap.md) § Testing strategy.

---

## تغییرات این shard

هنگام تغییر workflow: این فایل + [`projectStandards.ts`](../../src/config/projectStandards.ts) rules `ai.vibe.*` + [`specs/vibe-coding/01-spec.md`](../../specs/vibe-coding/01-spec.md) + [`01-spec.md`](../../specs/vibe-coding/01-spec.md).
