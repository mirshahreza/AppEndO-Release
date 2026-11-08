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

<p><strong>خلاصه برای operatore:</strong> این سند جزو <strong>plans</strong> است (p-76-control-plane-prisma-migration). ستون وضعیت در <a href="./p-00-next-index.md">index مربوطه</a> مرجع «شروع شده / design / تمام» است.</p>
<p><strong>راهنمای خواندن:</strong> بخش‌های انگلیسی برای agent/dev هستند؛ جداول وضعیت و یادداشت‌های فارسی را اول بخوانید.</p>


# p-76 — Control Plane Migration (حذف کامل Prisma)

> **فاز:** CPM · **⏸️ Deferred — پیش‌نویس/آرشیو تحقیق، فعال نیست**
> **وضعیت:** ⬜ **DEFERRED** — کنترل: [p-00-next-index.md](p-00-next-index.md)  
> **آخرین به‌روزرسانی:** ۲۰۲۶-۰۷-۳۰  
> **وابستگی:** Prisma control plane shipped ([`control-plane-prisma.md`](../../../docs/architecture/control-plane-prisma.md)) — این پلن اجرا نمی‌شود پس نیازی به superseded شدن نیست
> **استانداردها:** `AGENTS.md` · `.specify/memory/constitution.md` (DB-04…DB-07 — بدون تغییر می‌ماند)
>
> ⚠️ **تصمیم نهایی کاربر (۲۰۲۶-۰۷-۳۰):** بعد از تصویب اولیهٔ «حذف کامل Prisma»، بررسی دقیق‌تر مزیت/هزینه نشون داد نیاز واقعی (package portability برای workflow definitions) با یک serializer هدفمند حل می‌شه — نه مهاجرت کل ۴۳ مدل control-plane. هزینهٔ این پلن (از دست رفتن type-safety کامپایل‌تایم، ریسک regression روی auth، خنثی‌کردن Prisma control plane) در برابر فایده‌اش توجیه نداشت وقتی نیاز واقعی اینقدر کوچیک‌تره. **این سند به `next/` برگشت — deferred، نه رد‌شده.** کارِ واقعی: WFV2-23 (export/import تعریف workflow، نه مهاجرت ORM) — shipped.

---

## این پلن بخشی از یک تاریخچهٔ سه‌مرحله‌ای بود

این سند در ۲۰۲۶-۰۷-۳۰ از داخل `p-73` استخراج شد (که خودش محتوای تحقیقی‌اش را از ابتکار D در `p-75` گرفته بود)، به‌عنوان پلن فعال با فازبندی CPM-0…3 معرفی شد، و در همون روز — بعد از یک بررسی هزینه/فایدهٔ صریح‌تر — **دوباره به `next/` برگشت**.

<table dir="rtl">
<thead><tr><th>پلن</th><th>موضوع</th><th>وضعیت فعلی</th></tr></thead>
<tbody><tr><td><strong>p-73 Data API</strong></td><td>Data API از روی مدل + SEA-9 (package portability + hooks)</td><td><strong>shipped</strong></td></tr>
<tr><td><strong>p-76 (همین سند)</strong></td><td>حذف کامل Prisma، شامل <code dir="ltr" style="unicode-bidi: embed;">base_*</code></td><td><strong>Deferred</strong></td></tr>
<tr><td><a href="p-75-unified-runtime-engine.md"><strong>p-75</strong></a></td><td>یک موتور اجرای سرور/کلاینت</td><td><strong>Deferred</strong></td></tr>
</tbody></table>

---

## نحوه استفاده (برای تو)

**این سند `deferred` است — «برو جلو» روش اجرا نکن.** SEA-9 و WFV2-23 shipped هستند. اگر کاربر صریحاً خواست حذف کامل Prisma دوباره فعال بشه، این سند (CPM-0…3 پایین) نقطهٔ شروع آماده‌ست — ولی خودت شروع نکن.

**دستورالعمل Agent (اگر فعال شد):**

1. **بخوان:** این سند کامل، به‌خصوص § «تناقض فعلی» و § «بلاست‌رادیوس» — قبل از هر migration، ترتیب اجباری را دوباره چک کن.
2. **محدوده:** فقط یک زیرفاز از چک‌لیست فعال — اولین آیتم `[ ]` — مگر کاربر صریحاً چیز دیگری بگوید.
3. **پیش‌نیاز:** CPM-0 قبل از هر migration دیگر. CPM-1 قبل از CPM-2 (auth آخرین قدم، نه اول). این پلن خودش قبل از شروع، نیازمند SEA-4…6 پایدار در p-73 است.
4. **هماهنگی با p-75:** قبل از migrate کردن دادهٔ یک دامنه، چک کن p-75 در همان دامنه کار اجرایی هم‌زمان نکرده باشد — یک دامنه، یک زمان.
5. **تست:** `npm run test:critical` + پوشش تست اضافی برای هر دامنه‌ای که auth-adjacent است.
6. **به‌روزرسانی سند:** پایان جلسه — `[ ]` → `[x]` · «کار بعدی» · لاگ.
7. **اتمام:** همه معیارهای خروج → حذف این فایل · drop از `p-00-next-index`.

---

## وضعیت یک‌خطی

<table dir="rtl">
<thead><tr><th>محور</th><th>وضعیت</th></tr></thead>
<tbody><tr><td><strong>زیرفاز فعال</strong></td><td>CPM-0 — هنوز شروع نشده</td></tr>
<tr><td><strong>کار بعدی</strong></td><td>CPM-0.1 — ابزار codegen از <code dir="ltr" style="unicode-bidi: embed;">EdgeModelDefinition</code> به TS types</td></tr>
<tr><td><strong>blocker</strong></td><td>وابسته به SEA-4…6 در p-73 (باید پایدار باشد)</td></tr>
<tr><td><strong>تخمین</strong></td><td>۱۲–۱۴ هفته (برآورد از تحقیق blast-radius زیر) — <strong>ریسک بالا</strong>، شامل بازنویسی auth/session</td></tr>
</tbody></table>

---

## کار بعدی (الان)

> **CPM-0.1** — ابزار codegen بساز (`EdgeModelDefinition` JSON → TS types)، قبل از هر migration دیگر. بدون این ابزار، type-safety کامپایل‌تایمی که امروز روی ۶۰+ فایل هست از بین می‌رود بدون جایگزین.

---

## چرا این پلن لازم است

هدف: جدول‌های `base_*` هم Edge model شوند (JSON در `workspace/edge-models/`، فلگ `isBase: true` برای حفاظت UI در برابر حذف/ویرایش تصادفی)، دقیقاً مثل جدول‌های کاربر — تا هیچ تمایز مکانیزمی بین «چیزی که پلتفرم ساخته» و «چیزی که دولوپر بعداً اضافه کرد» نماند. این مقدمهٔ لازم برای:
- **یک ORM واحد** در کل پلتفرم (Sequelize-only، حذف کامل Prisma).
- **package portability**: تا وقتی `base_*` روی Prisma است، هیچ‌چیز مربوط به آن قابل export/import در یک package bundle نیست — دقیقاً همان مشکلی که در بررسی packaging کردن CMS کشف شد (منبع ابتکار D در `p-75`).
- پیش‌نیاز واقعی برای p-75 (نمی‌توان کنترلر `UsersController` را به موتور یکپارچه برد در حالی که دیتایش هنوز Prisma است و هیچ EdgeModel معادلی ندارد).

---

## تناقض فعلی که باید صریح حل شود (نه دور زده شود)

<table dir="rtl">
<thead><tr><th>منبع</th><th>چی می‌گه</th></tr></thead>
<tbody><tr><td><code dir="ltr" style="unicode-bidi: embed;">.specify/memory/constitution.md</code> DB-04</td><td><code dir="ltr" style="unicode-bidi: embed;">EdgeDbRouter</code> فقط برای data source خارجی کاربر است</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">.specify/memory/constitution.md</code> DB-05 — <strong>FORBIDDEN</strong></td><td>استفاده از <code dir="ltr" style="unicode-bidi: embed;">EdgeDbRouter</code>/<code dir="ltr" style="unicode-bidi: embed;">RequestDb</code>/هدرهای <code dir="ltr" style="unicode-bidi: embed;">x-append-datasource-*</code> برای خواندن/نوشتن هر جدول <code dir="ltr" style="unicode-bidi: embed;">base_*</code></td></tr>
<tr><td>Prisma control plane (<a href="../../../docs/architecture/control-plane-prisma.md"><code dir="ltr" style="unicode-bidi: embed;">control-plane-prisma.md</code></a>)</td><td>پروژهٔ ۱۲–۱۴ هفتهٔ <strong>کامل‌شده</strong> که دقیقاً تصمیم عکس رو گرفته: Prisma برای control plane، به‌خاطر type-safety کامپایل‌تایم + پشتیبانی ۴ دیتابیس رابطه‌ای</td></tr>
</tbody></table>

این پلن با این‌ها مستقیم در تضاد است چون Sequelize/`EdgeDbRouter` را برای `base_*` هم می‌خواهد. **راه‌حل درست، amend صریح constitution و علامت‌زدن `p-45` به `superseded` است (CPM-3) — نه bypass ساکت.** تا CPM-3 کامل نشده، این تناقض باز می‌ماند و باید در هر جلسه یادآوری شود.

---

## بلاست‌رادیوس (طبق تحقیق p-75، ۲۰۲۶-۰۷-۳۰ — قبل از CPM-0 دوباره verify کن، ممکنه عوض شده باشه)

<table dir="rtl">
<thead><tr><th>معیار</th><th>عدد</th></tr></thead>
<tbody><tr><td>مدل در <code dir="ltr" style="unicode-bidi: embed;">prisma/schema.prisma</code></td><td><strong>۴۳</strong> — auth/user/identity (۷) · settings/attributes (۶) · auth security/audit (۲) · platform ops (۳) · AI (۳) · Workflow Engine (۱۵–۱۸، دوباره بشمار) · Feedback (۴)</td></tr>
<tr><td>فایل‌هایی که <code dir="ltr" style="unicode-bidi: embed;">prisma()</code> صدا می‌زنند</td><td><strong>۶۰</strong></td></tr>
<tr><td>فایل‌هایی که از <code dir="ltr" style="unicode-bidi: embed;">prismaHelpers</code> import می‌کنند</td><td><strong>۶۷</strong></td></tr>
<tr><td>فایل‌های auth-critical (<code dir="ltr" style="unicode-bidi: embed;">prisma()</code> + auth/user/role/session/identity)</td><td><strong>۱۱</strong> فایل زیر <code dir="ltr" style="unicode-bidi: embed;">src/server/domain/auth/<strong></code> و <code dir="ltr" style="unicode-bidi: embed;">src/server/domain/users/</strong></code></td></tr>
<tr><td>ابزار codegen از EdgeModel/Sequelize → TS types</td><td><strong>صفر — امروز وجود ندارد</strong></td></tr>
<tr><td>مدل‌های <code dir="ltr" style="unicode-bidi: embed;">WorkflowDefinition</code>/<code dir="ltr" style="unicode-bidi: embed;">WorkflowInstance</code>/…</td><td><strong>۱۵ مدل تأییدشده با grep روی <code dir="ltr" style="unicode-bidi: embed;">prisma/schema.prisma</code></strong> — تعریف workflow خودش هم در Prisma است، نه JSON آزاد؛ بعد از migration این‌ها، تعریف workflow هم قابل‌حمل (packageable) می‌شود</td></tr>
</tbody></table>

**نتیجهٔ حیاتی:** اگر CPM-0 اول ابزار codegen نسازد، هر migration بعدی یعنی از دست دادن type-safety کامپایل‌تایم روی حساس‌ترین مسیر پلتفرم بدون جایگزین. **CPM-0 نباید رد بشه یا سبک گرفته بشه.**

---

## فازها — ترتیب اجباری (auth آخرین قدم، نه اول)

### CPM-0 — Codegen Spike

- [ ] **CPM-0.1** — ابزار codegen از `EdgeModelDefinition` → TS types
- [ ] **CPM-0.2** — فلگ `isBase: true` روی EdgeModel + گارد حفاظتی در برابر حذف/ویرایش تصادفی در UI
- [ ] **CPM-0.3** — مهاجرت آزمایشی یک جدول کم‌ریسک/غیرحیاتی (مثلاً یک جدول لاگ ساده، نه چیزی در ۴۳ مدل بالا که وابستگی زیاد داره) · اندازه‌گیری DX/type-safety · تصمیم go/no-go مکتوب قبل از CPM-1

### CPM-1 — دامنه‌های غیرحیاتی

- [ ] **CPM-1.1** — Feedback (۴ مدل)
- [ ] **CPM-1.2** — AI (۳ مدل)
- [ ] **CPM-1.3** — Platform ops (۳ مدل)
- [ ] **CPM-1.4** — Settings/attributes (۶ مدل)
- [ ] **CPM-1.5** — Workflow Engine (۱۵ مدل — به زیرمرحله‌های کوچک‌تر بشکن؛ این دامنه از قبل چند دور سخت‌شدن داشته، احتیاط بیشتر)

### CPM-2 — Auth/Users (بحرانی‌ترین — فقط بعد از موفقیت کامل CPM-1)

- [ ] **CPM-2.1** — rollback plan مکتوب + پوشش تست اضافی روی auth/session قبل از هر تغییر کد
- [ ] **CPM-2.2** — مهاجرت ۷ مدل auth/user/identity + ۲ مدل security/audit + ۱۱ فایل auth-critical · دورهٔ هم‌زیستی طولانی پشت فلگ

### CPM-3 — نهایی‌سازی

- [ ] **CPM-3.1** — amend صریح `constitution.md` DB-04…DB-07
- [ ] **CPM-3.2** — `p-45-prisma-multi-database.md` → وضعیت `superseded` (فایل را جابه‌جا نکن، فقط badge/وضعیت)
- [ ] **CPM-3.3** — حذف پکیج Prisma · `schema.prisma` · generated client · همهٔ فراخوانی‌های `prisma()`/`prismaHelpers`
- [ ] **CPM-3.4** — `npm run test:critical` سبز · صفر reference به Prisma در `src/` و `package.json`

---

## معیارهای خروج (Exit Criteria)

- [ ] ابزار codegen `EdgeModel → TS types` با پوشش معادل Prisma حداقل روی دامنهٔ auth (CPM-0.1، تأییدشده در CPM-2)
- [ ] همهٔ ۴۳ مدل control plane روی Sequelize + `isBase: true`
- [ ] **صفر** `prisma()` / `prismaHelpers` / `schema.prisma` / پکیج Prisma در `src/` و `package.json`
- [ ] `constitution.md` DB-04…DB-07 رسماً amend‌شده — نه silent bypass
- [ ] `p-45-prisma-multi-database.md` روی `superseded`
- [ ] `npm run test:critical` سبز
- [ ] هیچ رگرسیون auth/session — پوشش تست قبل/بعد سبز

---

## ریسک‌ها

<table dir="rtl">
<thead><tr><th>ریسک</th><th>شدت</th><th>کاهش</th></tr></thead>
<tbody><tr><td>Regression در auth/session حین CPM-2</td><td><strong>بالا</strong></td><td>آخرین مرحله بودن · دورهٔ هم‌زیستی طولانی · rollback مکتوب قبل از شروع</td></tr>
<tr><td>از دست رفتن type-safety کامپایل‌تایم</td><td><strong>بالا</strong></td><td>CPM-0 (codegen) اجباری و اول، نه اختیاری</td></tr>
<tr><td>Workflow Engine (۱۵ مدل، دامنهٔ بزرگ و از قبل سخت‌شده با چند دور رفع باگ) رگرس کند</td><td>متوسط‌به‌بالا</td><td>زیرمرحله‌های کوچک در CPM-1.5 · تست پوشش کامل هر زیرمرحله</td></tr>
<tr><td>هماهنگی نادرست با p-75 — migrate شدن اجرای یک دامنه قبل از دادهٔ همان دامنه</td><td>متوسط</td><td>§ «وضعیت یک‌خطی» و این‌جا صریح تکرار شود؛ چک قبل از هر migration</td></tr>
<tr><td>تخمین ۱۲–۱۴ هفته روی چیزی که همین الان کار می‌کند</td><td>متوسط (هزینهٔ فرصت)</td><td>تصمیم کاربر است، آگاهانه گرفته شده</td></tr>
</tbody></table>

---

## وابستگی و ترتیب

```
p-73 SEA-4…6 پایدار (پیش‌نیاز)
    │
    └── p-76 (همین سند)
            │
            ├── CPM-0 codegen spike + یک دامنهٔ غیرحیاتی → go/no-go
            ├── CPM-1 بقیهٔ دامنه‌های غیرحیاتی (فقط اگر CPM-0 go بود)
            ├── CPM-2 auth/users (فقط بعد از موفقیت کامل CPM-1)
            └── CPM-3 amend constitution + p-45 superseded + حذف نهایی

هماهنگی با p-75:
  برای هر دامنه → دادهٔ دامنه (اینجا) باید قبل یا هم‌زمان با اجرای دامنه (در p-75) migrate شود، نه بعدش.
  auth/users: CPM-2 (اینجا) باید قبل از URE-3 (auth در p-75) تمام شود.
```

موازی با todo: p-52 · p-60 — بدون blocker سخت. `p-45` با CPM-3 مستقیم وضعیتش عوض می‌شود.

---

## لاگ

<table dir="rtl">
<thead><tr><th>تاریخ</th><th>رویداد</th></tr></thead>
<tbody><tr><td>۲۰۲۶-۰۷-۳۰ (نهایی)</td><td><strong>Deferred — برگشت به <code dir="ltr" style="unicode-bidi: embed;">next/</code></strong> — همون روزی که فعال شد، کاربر پرسید چه سطحی از پیاده‌سازی packaging/workflow رو حل می‌کنه بدون هزینهٔ کامل این پلن. نتیجه: package portability برای workflow definitions فقط به یک export/import serializer نیاز داشت (<code dir="ltr" style="unicode-bidi: embed;">p-60</code> WFV2-23)، نه مهاجرت ۴۳ مدل control-plane از Prisma. این سند به <code dir="ltr" style="unicode-bidi: embed;">next/</code> برگشت، deferred نه رد‌شده. <code dir="ltr" style="unicode-bidi: embed;">p-45</code> بدون تغییر روی done ✅ ماند. <strong>هیچ کدی تغییر نکرد.</strong></td></tr>
<tr><td>۲۰۲۶-۰۷-۳۰</td><td><strong>ایجاد سند</strong> — از داخل <code dir="ltr" style="unicode-bidi: embed;">p-73</code> استخراج شد (که خودش این محتوا را از ابتکار D در <code dir="ltr" style="unicode-bidi: embed;">p-75</code> گرفته بود)، طبق درخواست کاربر برای تقسیم یک فایل بیش‌ازحد بزرگ به سه پلن مرتبط و مستقل. محتوای تناقض/بلاست‌رادیوس/فازها بدون تغییر منتقل شد، فقط پیشوند فاز از <code dir="ltr" style="unicode-bidi: embed;">SEA-9…12</code> به <code dir="ltr" style="unicode-bidi: embed;">CPM-0…3</code> تغییر کرد و یک § هماهنگی صریح با <code dir="ltr" style="unicode-bidi: embed;">p-75</code> اضافه شد. <strong>هیچ کدی تغییر نکرد.</strong></td></tr>
</tbody></table>

---

*Control Plane Migration — حذف کامل Prisma، یک ORM واحد برای کل پلتفرم*


</div>
