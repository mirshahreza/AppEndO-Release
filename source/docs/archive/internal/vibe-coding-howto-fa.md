# راهنمای وایب‌کدینگ داخلی AppEndO (How-To)

> **مخاطب:** تیم توسعه داخلی  
> **Workflow کامل:** [`docs/standards/vibe-coding-workflows.md`](../../standards/vibe-coding-workflows.md)  
> **Benchmark:** [`docs/architecture/vibe-coding-benchmarks.md`](../../architecture/vibe-coding-benchmarks.md)  
> **Plan:** [`plans/core/todo/p-50-vibe-coding-platform.md`](../../../plans/core/todo/p-50-vibe-coding-platform.md)


---

## ۰. Runtime واحد — بدون انجین جدا

کد تولیدشده توسط Agent **روی همان AppEndO زنده** اجرا می‌شود:

| لایه | بعد از Apply |
|------|--------------|
| **Server Function** | بلافاصله API/route از runtime موجود (untime/server-functions/) |
| **Client Component** | layout در همان app — Designer preview/handoff (untime/designer/drafts/) |

نیازی به deploy جدا، Docker، یا engine اختصاصی vibe نیست. 	est_server_function همین مسیر runtime را تست می‌کند.
---

## ۱. فعال‌کردن Agent و packها

1. از هدر shell دکمه **AppEndO** را باز کنید.
2. حالت **Agent** را انتخاب کنید (نه Ask یا Plan برای write).
3. مدلی با قابلیت **tools** انتخاب کنید.
4. در **Capability scope** packهای لازم را فعال کنید:
   - همیشه: `appendo-files`, `appendo-codebase`, `appendo-standards`, `appendo-context`
   - Server Function: `appendo-server-functions`
   - UI/Designer: `appendo-designer`
5. تنظیمات MCP در **Settings → MCP Servers** (ادمین).

---

## ۲. ساخت Server Function با AppEndO

1. به **Server Functions** بروید.
2. در Agent توضیح دهید چه API/منطقی لازم است (نام، ورودی/خروجی، نمونه مشابه).
3. Agent باید (پس از p-50):
   - `get_project_standards({ shard: "vibe-server-function" })`
   - `list_server_functions` / `get_server_function`
   - `draft_server_function` → `test_server_function`
4. **Confirm** روی proposal → apply.
5. در صورت خطا: **Rollback** از AiPanel.

---

## ۳. ساخت layout CRUD (Client Components)

1. Server Function یا API موجود باشد.
2. به **Client Components** بروید.
3. pack `appendo-designer` فعال باشد.
4. از Agent بخواهید grid + form با binding بسازد (`draft_component_layout`).
5. Confirm → apply → لینک **Designer handoff** (`/client-components?load=…`).

---

## ۴. ویرایش grid/form موجود

1. layout را در **Component Designer** باز کنید (`layoutId` در context).
2. تغییر را دقیق بگویید (مثلاً «ستون boolean به icon»).
3. Agent از `get_page_context` و designer tools استفاده می‌کند.
4. Confirm → apply → Designer را refresh کنید.

---

## ۵. Apply · Reject · Rollback

| عمل | زمان |
|-----|------|
| **Confirm / Apply** | proposal درست و standards رعایت شده |
| **Reject** | proposal اشتباه — prompt دقیق‌تر بدهید |
| **Rollback** | بعد از apply اگر نتیجه بد بود |

همه writeها از gate **confirm** عبور می‌کنند (`writeRequiresConfirm`).

---

## ۶. چه زمانی Cursor بماند؟

| کار | AppEndO | Cursor |
|-----|---------|--------|
| Server Function + Designer CRUD | ✅ | — |
| refactor گسترده خارج allowlist | محدود (تا VC-1) | ✅ |
| debug عمیق terminal/local | محدود | ✅ |
| رعایت استاندارد UI/platform | ✅ (`get_project_standards`) | rules دستی |

AppEndO **مکمل** است — جایگزین IDE برای همه سناریوها نیست.

---

## ۷. استانداردها و shardها

```text
get_project_standards({ shard: "vibe-coding-workflows" })
get_project_standards({ query: "vibe-crud" })
```

Shardها: `vibe-server-function`, `vibe-crud`, `vibe-designer-edit`, `vibe-benchmarks`.

Hub: [`AGENTS.md`](../../../AGENTS.md) · [`docs/standards/INDEX.md`](../../standards/INDEX.md).

---

## ۸. عیب‌یابی سریع

| مشکل | راه‌حل |
|------|--------|
| tool در دسترس نیست | Agent mode + pack فعال + RBAC MCP |
| proposal رد شد validation | shard مربوطه را بخوانید؛ prompt دقیق‌تر |
| apply شکست خورد | rollback · fix دستی · retry |
| جستجو نتیجه ضعیف | نام فایل/مسیر بدهید؛ پس از VC-3 semantic index |

---

*نسخه doc-only p-50-DOC — پیاده‌سازی VC-1..5 پس از sign-off PO.*
