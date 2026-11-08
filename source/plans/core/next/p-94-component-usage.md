<div dir="rtl" lang="fa" class="hwy-parity-doc">
<style>
  .hwy-parity-doc { text-align: right; unicode-bidi: plaintext; }
  .hwy-parity-doc h1, .hwy-parity-doc h2, .hwy-parity-doc h3, .hwy-parity-doc h4, .hwy-parity-doc p, .hwy-parity-doc li { text-align: right; }
  .hwy-parity-doc table { direction: rtl; text-align: right; width: 100%; border-collapse: collapse; margin: 0.75rem 0; }
  .hwy-parity-doc th, .hwy-parity-doc td { border: 1px solid #c4c4c4; padding: 0.35rem 0.5rem; vertical-align: top; text-align: right; }
  .hwy-parity-doc th { background: #f6f6f6; font-weight: 600; }
  .hwy-parity-doc blockquote { text-align: right; border-right: 3px solid #ccc; border-left: none; padding-right: 1rem; margin-right: 0; }
  .hwy-parity-doc ul, .hwy-parity-doc ol { padding-right: 1.25rem; padding-left: 0; }
  .hwy-parity-doc pre, .hwy-parity-doc code { direction: ltr; text-align: left; unicode-bidi: embed; }
</style>

<p><strong>خلاصه برای operatore:</strong> این سند جزو <strong>plans</strong> است (p-94-component-usage). ستون وضعیت در <a href="./p-00-next-index.md">index مربوطه</a> مرجع «شروع شده / design / تمام» است.</p>
<p><strong>راهنمای خواندن:</strong> بخش‌های انگلیسی برای agent/dev هستند؛ جداول وضعیت و یادداشت‌های فارسی را اول بخوانید.</p>


# p-94 — Component Usage (هیت کامپوننت‌های منتشرشده)

> **فاز:** USAGE · **موکول** (next)  
> **اولویت:** — — آمار استفادهٔ زمانی برای Client Components / package UI / portal shells  
> **وضعیت:** ⬜ — کنترل: [p-00-next-index.md](p-00-next-index.md)  
> **ورود:** `@plans/core/next/p-94-component-usage.md برو جلو`  
> **وابستگی:** Client Components ✅ · `DynamicOutlet` ✅ · `DbBatchQueue` ✅  
> **استاندارد:** [`docs/standards/component-designer.md`](../../../docs/standards/component-designer.md) (هویت = **name**) · [`docs/standards/data-model.md`](../../../docs/standards/data-model.md) (`base_` + audit)  
> **مرتبط:** Logs persistence [`LogDbBatcher`](../../../src/core/logging/LogDbBatcher.ts) / [`DbBatchQueue`](../../../src/core/logging/DbBatchQueue.ts) · کاتالوگ [`DesignerPaletteSidebar`](../../../src/features/component-designer/components/DesignerPaletteSidebar.tsx) · [`component-designer.md`](../../../docs/standards/component-designer.md)

---

## هدف

بعد از چند هفته/ماه بفهمیم یک کامپوننت **در runtime واقعی استفاده می‌شود یا نه**. هویت کاربر مهم نیست؛ قالب زمانی مهم است (مثلاً دو hit در ۹۰ روز = کاندید بررسی).

این **لاگ دیباگ نیست.** `base_logs_app` برای هر درخواست API است (actor، مدت، موفقیت). Usage کامپوننت **شمارندهٔ روزانه** است.

**تعریف موفقیت (PO):**

- هر mount موفق صفحه/شل **منتشرشده** یک hit می‌شمارد؛ preview و Live Designer نمی‌شمارند.
- DB با هر hit زده نمی‌شود: coalesce در RAM + همان `DbBatchQueue` + یک `UPSERT` برای کلیدهای یکتا.
- کاتالوگ Client Components ستون/فیلتر Last used · Hits (90d) · Stale دارد.
- `npm run test:critical` ✅.

---

## وضعیت یک‌خطی

<table dir="rtl">
<thead><tr><th>محور</th><th>وضعیت</th></tr></thead>
<tbody><tr><td><strong>زیرفاز فعال</strong></td><td><strong>USAGE-0</strong> — قرارداد همین پلن (کد نیست)</td></tr>
<tr><td><strong>کار بعدی</strong></td><td>USAGE-1 — جدول + batcher + UPSERT</td></tr>
<tr><td><strong>blocker</strong></td><td>—</td></tr>
<tr><td><strong>خارج از v1</strong></td><td>slot widget · Base Components · actor/IP · صفحهٔ Logs جدا · portal breakdown</td></tr>
</tbody></table>

---

## کار بعدی (وقتی از next آمد به todo)

> **USAGE-1** — مدل Prisma `BaseComponentUsageDaily` · `ComponentUsageDbBatcher` روی `createDbBatchQueue` · coalesce `(name, kind, day)` قبل از enqueue · `INSERT … ON CONFLICT DO UPDATE hit_count = hit_count + EXCLUDED.hit_count` · وصل به `initLogPersistence` / `flush` / `shutdown`.

---

## چه چیزی hit است

یک hit = **یک بار mount موفق** کامپوننت به‌عنوان صفحه یا شل **منتشرشده**.

<table dir="rtl">
<thead><tr><th>می‌شمارد</th><th>نمی‌شمارد</th></tr></thead>
<tbody><tr><td><code dir="ltr" style="unicode-bidi: embed;">DesignerPublishedPage</code> (<code dir="ltr" style="unicode-bidi: embed;">loaderKind: 'designer'</code>)</td><td>Live Designer / canvas</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">PackagePageModule</code> (<code dir="ltr" style="unicode-bidi: embed;">loaderKind: 'package'</code>)</td><td><code dir="ltr" style="unicode-bidi: embed;">component-preview</code> و پورتال <code dir="ltr" style="unicode-bidi: embed;">component-alone</code></td></tr>
<tr><td>شل Designer روی پورتال (<code dir="ltr" style="unicode-bidi: embed;">designer:portal-layouts/…</code>)</td><td>نمونهٔ Base Components (<code dir="ltr" style="unicode-bidi: embed;">UiButton</code> و بقیه)</td></tr>
<tr><td></td><td>re-render React / StrictMode دابل‌مانت (یک navigation = یک hit)</td></tr>
</tbody></table>

هویت: **component name** (بدون draft id، بدون folder در کلید). `kind`: `designer` · `package` · `shell`.

---

## وضعیت فعلی (as-is)

<table dir="rtl">
<thead><tr><th>لایه</th><th>مسیر</th><th>وضعیت</th></tr></thead>
<tbody><tr><td><strong>Outlet</strong></td><td><a href="../../../src/app/platform/DynamicOutlet.tsx"><code dir="ltr" style="unicode-bidi: embed;">DynamicOutlet.tsx</code></a></td><td>شاخهٔ designer / package / core آماده است؛ telemetry نیست</td></tr>
<tr><td><strong>صفحهٔ designer</strong></td><td><a href="../../../src/app/platform/DesignerPublishedPage.tsx"><code dir="ltr" style="unicode-bidi: embed;">DesignerPublishedPage.tsx</code></a></td><td>GET draft بعد از mount</td></tr>
<tr><td><strong>صفحهٔ پکیج</strong></td><td><a href="../../../src/app/platform/PackagePageModule.tsx"><code dir="ltr" style="unicode-bidi: embed;">PackagePageModule.tsx</code></a></td><td>dynamic import ماژول UI</td></tr>
<tr><td><strong>صف لاگ</strong></td><td><a href="../../../src/core/logging/DbBatchQueue.ts"><code dir="ltr" style="unicode-bidi: embed;">DbBatchQueue</code></a> · <a href="../../../src/core/logging/LogDbBatcher.ts"><code dir="ltr" style="unicode-bidi: embed;">LogDbBatcher</code></a> · <a href="../../../src/core/logging/AuthAuditDbBatcher.ts"><code dir="ltr" style="unicode-bidi: embed;">AuthAuditDbBatcher</code></a></td><td>جنریک؛ فقط INSERT ردیف رویداد</td></tr>
<tr><td><strong>lifecycle</strong></td><td><a href="../../../src/core/logging/logPersistenceRuntime.ts"><code dir="ltr" style="unicode-bidi: embed;">logPersistenceRuntime.ts</code></a></td><td>init / flush / shutdown برای دو batcher</td></tr>
<tr><td><strong>کاتالوگ</strong></td><td><a href="../../../src/features/component-designer/components/DesignerPaletteSidebar.tsx"><code dir="ltr" style="unicode-bidi: embed;">DesignerPaletteSidebar.tsx</code></a></td><td>sort: name / created / updated — <strong>بدون</strong> usage</td></tr>
</tbody></table>

**شکاف:** هیچ شمارنده‌ای برای «این کامپوننت در ۹۰ روز چند بار واقعاً دیده شد» وجود ندارد. کپی کردن hit داخل `base_logs_app` حجم و query اشتباه می‌سازد.

---

## معماری هدف (to-be)

```
DesignerPublishedPage / PackagePageModule / published shell
        │  یک beacon بعد از load موفق (نه هر render)
        ▼
POST /api/component-usage/hit  { name, kind }     ← بدون actor
        │
        ▼
ComponentUsageService.recordHit
        │  RAM Map keyed by (name, kind, UTC day)  → delta += 1
        ▼
createDbBatchQueue<UsageDelta>     ← همان کتابخانهٔ لاگ
        │  flush: batchSize یا interval (پیش‌فرض لاگ OK؛ تا ~1s قابل شل شدن)
        ▼
UPSERT base_component_usage_daily
        │
        ▼
GET /api/component-usage?windowDays=90
        │
        ▼
کاتالوگ Client Components: Last used · Hits (90d) · filter Stale
```

### صف — همان کتابخانه، writer جدا

- **Reuse:** `createDbBatchQueue` از [`DbBatchQueue.ts`](../../../src/core/logging/DbBatchQueue.ts).
- **Reuse نکن:** `LogDbBatcher` / Pino / `base_logs_app`. Hit رویداد دیباگ نیست.
- **خواهر:** `ComponentUsageDbBatcher` مثل `AuthAuditDbBatcher` — `insertBatch` متفاوت (UPSERT نه INSERT).
- **lifecycle:** همان `initLogPersistence` / `flushLogPersistence` / `shutdownLogPersistence` تا تایمر سوم و دادهٔ ازدست‌رفته در shutdown نداشته باشیم.

تفاوت اجباری با لاگ: **coalesce قبل از صف.** ۲۰۰ mount از `invoice-list` در یک ثانیه = یک آیتم `{ name, kind, day, delta: 200 }` نه ۲۰۰ ردیف صف. `maxQueueSize` لاگ قدیمی‌ترین رویداد را drop می‌کند؛ drop یک delta جمع‌شده بدتر از drop یک خط لاگ است — coalesce صف را به تعداد کامپوننت یکتای همان بازه کوچک نگه می‌دارد.

تنظیمات پیش‌فرض لاگ (`batchSize: 50`, `flushIntervalMs: 100`) برای freshness دیباگ است. Usage دقت **روزانه** می‌خواهد؛ همان اعداد قابل قبول‌اند. اگر فشار بنویسی مهم شد، interval را تا حدود ۱s شل کن — تنظیم جدا اختیاری است، مسیر جدا نه.

### جدول کنترل‌پلین

`base_component_usage_daily` — Prisma `BaseComponentUsageDaily` · `@@map` · audit `created_at/by` · `updated_at/by` (`_by` معمولاً NULL = system).

<table dir="rtl">
<thead><tr><th>ستون</th><th>نقش</th></tr></thead>
<tbody><tr><td><code dir="ltr" style="unicode-bidi: embed;">component_name</code></td><td>هویت کاننیکال</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">kind</code></td><td><code dir="ltr" style="unicode-bidi: embed;">designer</code> \</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">day</code></td><td>تاریخ UTC</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">hit_count</code></td><td>جمع همان روز</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">last_hit_at</code></td><td>آخرین flush مؤثر آن روز</td></tr>
</tbody></table>

Unique `(component_name, kind, day)`. Index روی `day` و `component_name`.

Retention: prune روزهای قدیمی‌تر از ۱۳ ماه (job جدا در USAGE-4 یا همان cleanup موجود). رول‌آپ روزانه حجم را کوچک نگه می‌دارد.

Seed story در [`baseStudioMetaStories.ts`](../../../scripts/control-plane/seed/baseStudioMetaStories.ts). SQL Server: unique/index در Prisma؛ اگر ستون Text نباشد نیازی به unicode list نیست.

### API

<table dir="rtl">
<thead><tr><th>متد</th><th>نقش</th></tr></thead>
<tbody><tr><td><code dir="ltr" style="unicode-bidi: embed;">POST /api/component-usage/hit</code></td><td>fire-and-forget · body کوچک · <strong>بدون</strong> actor در payload · نام باید وجود داشته باشد (draft / package page / shell)</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">GET /api/component-usage</code></td><td>خلاصه برای کاتالوگ: <code dir="ltr" style="unicode-bidi: embed;">lastHitAt</code>, <code dir="ltr" style="unicode-bidi: embed;">hits30d</code>, <code dir="ltr" style="unicode-bidi: embed;">hits90d</code>, <code dir="ltr" style="unicode-bidi: embed;">hits365d</code> · <code dir="ltr" style="unicode-bidi: embed;">adminOnly</code></td></tr>
</tbody></table>

پورتال عمومی ممکن است بدون لاگین باشد — POST hit نباید به studio admin محدود شود؛ GET خلاصه باید `adminOnly` باشد. Rate-limit درشت روی POST کافی است (آمار hygiene است، نه امنیت). جعل hit حداکثر عدد را باد می‌کند، دادهٔ PII نمی‌سازد.

Beacon فقط از سه سطح بالا شلیک می‌شود — preview هرگز صدا نمی‌زند. سمت کلاینت: ref per `(name, kind)` در همان navigation تا StrictMode دوبار نشمارد.

FSD: سرویس در `src/server/services/` · قرارداد در `src/shared/api/contracts/component-usage/` · UI فقط کاتالوگ `features/component-designer` (shared query). `features/` همدیگر را import نکنند. صفحهٔ Logs را گسترش نده.

---

## UI (کاتالوگ)

جای درست: **Client Components catalog** نه Logs.

- Sort جدید: Last used · Hits (90d) — کنار Name / Created / Updated موجود.
- `ToolbarFilterSelect` kind موجود بماند؛ فیلتر usage جدا: **All** (پیش‌فرض) / **Active** (hit در ۹۰ روز) / **Stale** (۰ hit در ۹۰ روز، یا هرگز).
- روی کارت: یک خط فشرده `Last used · N hits (90d)`؛ badge کوچک برای Stale (semantic hue روی متن/chip، سطح بزرگ خنثی).

آستانهٔ Stale در v1 ثابت ۹۰ روز. تنظیم‌پذیر بودن بعداً.

---

## برش‌ها

<table dir="rtl">
<thead><tr><th>شناسه</th><th>کار</th><th>وضعیت</th></tr></thead>
<tbody><tr><td>USAGE-0</td><td>همین پلن</td><td>✅ ۲۰۲۶-۰۸-۲۳</td></tr>
<tr><td>USAGE-1</td><td>جدول + coalesce + <code dir="ltr" style="unicode-bidi: embed;">ComponentUsageDbBatcher</code> + UPSERT + lifecycle persistence</td><td>⬜</td></tr>
<tr><td>USAGE-2</td><td><code dir="ltr" style="unicode-bidi: embed;">POST /api/component-usage/hit</code> + هوک در <code dir="ltr" style="unicode-bidi: embed;">DesignerPublishedPage</code> / <code dir="ltr" style="unicode-bidi: embed;">PackagePageModule</code> / published shell · exclude preview</td><td>⬜</td></tr>
<tr><td>USAGE-3</td><td><code dir="ltr" style="unicode-bidi: embed;">GET</code> خلاصه + ستون/sort/filter کاتالوگ Client Components</td><td>⬜</td></tr>
<tr><td>USAGE-4</td><td>prune ۱۳ ماه · تست واحد queue coalesce + UPSERT SQL · smoke کاتالوگ</td><td>⬜</td></tr>
<tr><td>USAGE-5</td><td>(بعدتر، خارج از v1) slot widget hits · اختیاری <code dir="ltr" style="unicode-bidi: embed;">portal_id</code> در کلید روزانه</td><td>⬜ موکول داخل همین فاز نیست</td></tr>
</tbody></table>

---

## تست

- Coalesce: چند `recordHit` هم‌کلید قبل از flush → یک آیتم صف با `delta` جمع.
- Batcher: چند کلید → یک round-trip UPSERT (mock pool مثل `LogDbBatcher.test.ts`).
- Preview: بارگذاری `component-preview` / Live Designer hit نمی‌نویسد.
- Published: mount `DesignerPublishedPage` یک hit enqueue می‌کند؛ remount StrictMode هنوز یک.
- Catalog: draft بدون ردیف usage → Last used `—` و Stale.
- `npm run test:critical`.

---

## خارج از محدوده (عمداً)

- Base Components catalog primitives
- نودهای داخلی سند Designer
- Actor / IP / session / user-agent
- ریختن رویداد در `base_logs_app` یا UI Logs
- Breakdown پر پورتال در v1
- Slot widget (فاز بعد اگر hygiene صفحه کافی نبود)

---

## لاگ

<table dir="rtl">
<thead><tr><th>تاریخ</th><th>خلاصه</th></tr></thead>
<tbody><tr><td>۲۰۲۶-۰۸-۲۳</td><td>قرارداد قفل · شمارندهٔ روزانه + <code dir="ltr" style="unicode-bidi: embed;">DbBatchQueue</code> + coalesce · این پلن در <code dir="ltr" style="unicode-bidi: embed;">next/</code></td></tr>
</tbody></table>

---

*موکول — کار فعال: [`plans/core/todo/p-00-todo-index.md`](../todo/p-00-todo-index.md)*


</div>
