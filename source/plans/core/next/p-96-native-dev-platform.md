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

<p><strong>خلاصه برای operatore:</strong> این سند جزو <strong>plans</strong> است (p-96-native-dev-platform). ستون وضعیت در <a href="./p-00-next-index.md">index مربوطه</a> مرجع «شروع شده / design / تمام» است.</p>
<p><strong>راهنمای خواندن:</strong> بخش‌های انگلیسی برای agent/dev هستند؛ جداول وضعیت و یادداشت‌های فارسی را اول بخوانید.</p>


# p-96 — Native Dev Platform (کارخانهٔ تحویل)

> **فاز:** PDK · **موکول** (موج A/B ✅ تمام · موج C منتظر گیت ۰ + نود دوم)  
> **وضعیت:** 🟡 موج A/B تمام — کنترل: [p-00-next-index.md](p-00-next-index.md)  
> **وابستگی:** Client Components ✅ · Data Studio ✅ · Server Functions ✅ · Data Sources ✅ · Logs ✅ · Packages ✅  
> **استانداردها:** `AGENTS.md` · [greenfield.md](../../../docs/standards/greenfield.md) · [ui-core.md](../../../docs/standards/ui-core.md) · [data-studio.md](../../../docs/standards/data-studio.md)  
> **مرتبط (قورت داده نمی‌شوند):** [p-52 (closed)](../../../docs/architecture/control-plane-prisma.md) · [p-66](p-66-security-hardening.md) · [p-94](p-94-component-usage.md) · [p-43](p-43-platform-updates.md) · [p-23](p-23-enterprise-saml.md) · [p-100](../todo/p-100-human-workflow.md) · [p-91](p-91-mobile-apps-platform.md) · [p-93](../todo/dashboard-canvas/p-93-data-api-pivot.md) · [p-44](p-44-platform-documentation.md) · [p-42](p-42-marketplace.md)

```
@plans/core/next/p-96-native-dev-platform.md برو جلو
@plans/core/next/p-96-native-dev-platform.md فاز PDK-N بساز
@plans/core/next/p-96-native-dev-platform.md فاز PDK-N را رولبک کن
@plans/core/next/p-96-native-dev-platform.md از فاز PDK-N به بعد را رولبک کن
```

«برو جلو» روی این فایل → **زیرفاز فعال همین پلن**. موج A/B (PDK-1..9) کامل و تأیید شد؛ موج C (PDK-10..12) طبق قاعدهٔ سخت پلن منتظر گیت ۰ (نصب پایدار + SEC-1) و نود دوم است — اپراتور باید این‌ها را فراهم کند. ایندکس `p-00` را عوض نمی‌کند. p-52 در ۲۰۲۶-۰۹-۱۵ بسته شد.

---

## هدف

بخش Development را پکیج نمی‌کنیم. هسته را با قابلیت‌هایی کامل می‌کنیم که **ساخت را به تحویل و اطمینان** وصل کنند: دیباگ روی اپ زنده، SQL روی Data Source، تست آرتیفکت، سپس ALM چندمحیطی.

**تعریف موفقیت نهایی:** اپراتور بتواند روی صفحهٔ منتشرشده دیباگ کند، روی Edge یک `SELECT` بزند و ببیند، Server Function را داخل Studio تست کند، و در موج C یک بستهٔ آرتیفکت را با impact analysis از `dev` به `test` ببرد — بدون CRM یا کانکتور SaaS در هسته.

**چرخهٔ کامل (ایده → محصول)** در بخش [چرخهٔ تولید — از ایده تا محصول](#چرخهٔ-تولید--از-ایده-تا-محصول) تصریح شده؛ p-96 فقط **مرحله‌های ۷–۹** را در هسته می‌بندد — بقیهٔ مراحل قبل/بعدش از قبل یا در پلن‌های خواهر است.

---

## چرخهٔ تولید — از ایده تا محصول

این جدول **کل مسیر AppEndO** برای یک قابلیت (صفحه، API، پکیج دامنه) است. p-96 عمداً فقط **شکاف «اطمینان + تحویل بین محیط‌ها»** را پر می‌کند؛ مراحل ۱–۶ قبل از این پلن در Studio/هسته وجود داشتند.

<table dir="rtl">
<thead><tr><th>#</th><th>مرحله</th><th>معنی برای اپراتور</th><th>کجا در پلتفرم</th><th>نقش p-96</th></tr></thead>
<tbody><tr><td>1</td><td><strong>ایده / دامنه</strong></td><td>چه محصولی می‌سازیم، مرز scope</td><td><code dir="ltr" style="unicode-bidi: embed;">plans/</code> · پلن پکیج (مثلاً CMS، Task)</td><td>بیرون</td></tr>
<tr><td>2</td><td><strong>مدل داده</strong></td><td>جداول Edge، روابط، Base Info</td><td>Data Studio · Data Sources</td><td>بیرون (پیش‌نیاز ✅)</td></tr>
<tr><td>3</td><td><strong>قرارداد API</strong></td><td>عملیات، ACL، Record Policy</td><td>Data Studio → Data API</td><td>بیرون · PDK-5 <strong>تست</strong> همان قرارداد</td></tr>
<tr><td>4</td><td><strong>منطق</strong></td><td>قوانین، یکپارچگی، orchestration</td><td>Server Functions · Workflow</td><td>بیرون · PDK-3 <strong>تست</strong> · PDK-8 <strong>HTTP/OpenAPI</strong></td></tr>
<tr><td>5</td><td><strong>تجربهٔ UI</strong></td><td>صفحات، کامپوننت، تعامل</td><td>Client Components (Designer)</td><td>بیرون · PDK-9 <strong>هشدار وابستگی</strong> قبل از حذف</td></tr>
<tr><td>6</td><td><strong>ترکیب و انتشار محلی</strong></td><td>ناوبری، mount، publish روی <strong>همین نود</strong></td><td>Platform Pages · Packages · Git</td><td>بیرون · draft هرگز auto-publish (قرارداد Packages)</td></tr>
<tr><td>7</td><td><strong>اطمینان روی اپ زنده</strong></td><td>«روی portal واقعاً چه می‌شود؟»</td><td>Logs · portal</td><td><strong>موج A/B</strong> — PDK-1/2 (correlation · toolbar) · PDK-7 (View as)</td></tr>
<tr><td>8</td><td><strong>بازبینی داده و یکپارچگی</strong></td><td>SQL read-only · دادهٔ Edge · call خارجی</td><td>Development در Studio</td><td><strong>موج A/B</strong> — PDK-4/6 (SQL Workshop) · PDK-8 (HTTP Connections)</td></tr>
<tr><td>9</td><td><strong>تحویل بین محیط‌ها (ALM اپ)</strong></td><td><code dir="ltr" style="unicode-bidi: embed;">dev</code> → <code dir="ltr" style="unicode-bidi: embed;">test</code> → <code dir="ltr" style="unicode-bidi: embed;">prod</code> · impact · rollback <strong>آرتیفکت</strong></td><td>Settings <code dir="ltr" style="unicode-bidi: embed;">environmentKind</code> · promote</td><td><strong>موج C</strong> — PDK-10/11/12 ⬜</td></tr>
<tr><td>10</td><td><strong>محصول برای کاربر نهایی</strong></td><td>استفاده در portal · SLA · موبایل</td><td>Runtime portal · <a href="p-91-mobile-apps-platform.md">p-91</a></td><td>بیرون (کانال جدا)</td></tr>
<tr><td>11</td><td><strong>به‌روزرسانی خود پلتفرم</strong></td><td>ZIP پکیج/ماژول · باینری AppEndO</td><td><a href="p-43-platform-updates.md">p-43</a> · Marketplace <a href="p-42-marketplace.md">p-42</a></td><td>بیرون — <strong>rollback p-43 ≠ rollback PDK-12</strong></td></tr>
</tbody></table>

```
ایده (plans / package plan)
  → مدل (Data Studio) → API (Data API) → منطق (Functions / Workflow)
  → UI (Designer) → compose + publish روی نود dev
        │
        ├─ p-96 موج A/B ✅  observe · test · SQL · graph · impersonate · connectors
        │
        └─ p-96 موج C ⬜     dev ──promote──► test ──► prod  (+ rollback release)
              │
              └─► کاربر نهایی (portal / mobile)     ·     p-43 = آپدیت خود AppEndO
```

**هدفی که با p-96 دنبال می‌کنیم:** مراحل ۱–۶ = **ساخت** (قبلاً قوی بود). p-96 مرحلهٔ ۷–۸ را **روی یک نود** بست (✅) و مرحلهٔ ۹ را **بین نودها** می‌بندد (⬜، بعد از گیت ۰ + نود دوم). بدون مرحلهٔ ۹، «محصول» هنوز با Export/Import دستی یا تک‌محیط تحویل می‌شود — کارخانه نیمه‌کاره می‌ماند.

---

## وضعیت یک‌خطی

<table dir="rtl">
<thead><tr><th>محور</th><th>وضعیت</th></tr></thead>
<tbody><tr><td><strong>زیرفاز فعال</strong></td><td>— (موج A/B تمام شد؛ موج C منتظر اپراتور)</td></tr>
<tr><td><strong>کار بعدی</strong></td><td>اپراتور: گیت ۰ (p-52 پایدار + SEC-1) را ببندد + نود دوم فراهم کند، سپس PDK-10</td></tr>
<tr><td><strong>blocker</strong></td><td>موج C — گیت ۰ + نود دوم (طبق قاعدهٔ سخت پلن، نه یک باگ)</td></tr>
<tr><td><strong>خارج از این پلن</strong></td><td>پکیج کردن Dev · Marketplace · موبایل · Pivot · SAML · Human Task · chat · CRM · استخراج Remote Hubs · FSD/IA hygiene · URE</td></tr>
</tbody></table>

---

## قاعدهٔ سخت

<table dir="rtl">
<thead><tr><th>توکار (این پلن)</th><th>پکیج / پلن دیگر</th><th>ممنوع</th></tr></thead>
<tbody><tr><td>SQL Workshop نازک روی Data Sources</td><td>Database Manager کامل — <a href="../../packages/todo/p-packages-backlog.md">backlog #2</a></td><td>پکیج کردن Client Components / Data Studio / Package Manager</td></tr>
<tr><td>HTTP + OpenAPI <strong>runtime</strong> در هسته</td><td>کاتالوگ Stripe/Salesforce — <a href="../../packages/todo/p-packages-api-connectors.md">p-packages-api-connectors</a></td><td>Jenkins / CI کامل داخل Studio</td></tr>
<tr><td>ALM آرتیفکت اپ (صفحه، مدل، API، ورک‌فلو)</td><td>به‌روزرسانی باینری پلتفرم — <a href="p-43-platform-updates.md">p-43</a></td><td>چت داخلی / تسک‌برد — <a href="p-63-internal-chat-system.md">p-63</a> · <a href="../../packages/todo/tsk-package/p-packages-task-management.md">tsk-package</a></td></tr>
<tr><td>تست آرتیفکت پلتفرم (function / Data API)</td><td>Playwright E2E کامل محصول</td><td>SQL آزاد برای غیر-<code dir="ltr" style="unicode-bidi: embed;">ADMIN</code> · DDL در موج A</td></tr>
</tbody></table>

پلن‌های `next/` را کپی یا حذف نکن. اگر کاری از آن‌ها اینجا تمام شد، همان سند `next/` را ببند/منتقل کن — دو قرارداد موازی نساز ([greenfield.md](../../../docs/standards/greenfield.md)).

### هم‌پوشانی با `next/`

<table dir="rtl">
<thead><tr><th>کار</th><th>سند</th><th>نقش نسبت به p-96</th></tr></thead>
<tbody><tr><td>شمارش استفادهٔ کامپوننت</td><td><a href="p-94-component-usage.md">p-94</a></td><td>پیش‌نیاز ترجیحی گراف PDK-9</td></tr>
<tr><td>SAML</td><td><a href="p-23-enterprise-saml.md">p-23</a></td><td>IAM جدا — این پلن impersonate موقت می‌سازد نه SSO</td></tr>
<tr><td>فرم Human Task</td><td><a href="../todo/p-100-human-workflow.md">p-100</a></td><td>تکمیل Workflow جدا</td></tr>
<tr><td>Pivot</td><td><a href="../todo/dashboard-canvas/p-93-data-api-pivot.md">p-93</a></td><td>Data API جدا</td></tr>
<tr><td>موبایل</td><td><a href="p-91-mobile-apps-platform.md">p-91</a></td><td>کانال رانتایم جدا</td></tr>
<tr><td>Docs محصول</td><td><a href="p-44-platform-documentation.md">p-44</a></td><td>جدا؛ Toolbar فقط هوک request-id می‌گذارد</td></tr>
<tr><td>Platform binary update</td><td><a href="p-43-platform-updates.md">p-43</a></td><td>ALM پلتفرم ≠ ALM اپ — برنامهٔ خواهر بعد از موج C</td></tr>
<tr><td>Marketplace catalog</td><td><a href="p-42-marketplace.md">p-42</a></td><td>هاب جدا؛ بعد از p-43</td></tr>
<tr><td>سخت‌سازی امنیتی</td><td><a href="p-66-security-hardening.md">p-66</a></td><td>گیت موازی — کل پلن بلعیده نمی‌شود؛ SEC-3-3 داخل PDK-1</td></tr>
<tr><td>نصب control plane</td><td><a href="../../../docs/architecture/control-plane-prisma.md">control-plane-prisma.md</a></td><td>p-52 بسته شد — گیت موازی نود دوم برای موج C</td></tr>
<tr><td>Client Components publish</td><td><a href="../../../docs/standards/component-designer.md"><code dir="ltr" style="unicode-bidi: embed;">component-designer.md</code></a></td><td>گیت نازک قبل از موج C — فقط برش publish که PDK-11 لازم دارد</td></tr>
</tbody></table>

---

## برنامه / گیت‌ها / خارج

p-96 **ستون فقرات کارخانهٔ تحویل** است، نه ظرف همهٔ بدهی ساختاری. اصلاح‌های هسته یا گیت‌اند یا برنامهٔ خواهر — فاز PDK جدید نمی‌سازند.

```
برنامه: بستن هستهٔ تحویل
│
├─ گیت ۰ (موازی با موج A؛ فاز فعال ریلیز = p-52)
│     p-52 نصب پایدار MySQL/SQLite
│     p-66 SEC-1 (secret پیش‌فرض · PAT · raw SQL · پسورد seed)
│     SEC-3-3 داخل PDK-1 (نه پلن جدا)
│
├─ موج A–B  =  همین سند (PDK-1…9)
│     اطمینان روی یک نود: correlation · toolbar · تست آرتیفکت · SQL نازک · گراف
│
├─ گیت Designer (نازک، قبل از موج C — بدون بک‌لاگ App Builder قدیمی)
│     فقط برش publish که PDK-11 برای صفحهٔ designer لازم دارد
│
├─ موج C  =  PDK-10…12
│     محیط + promote + rollback آرتیفکت اپ
│
└─ برنامهٔ خواهر (بعد از موج C، سند جدا در todo/)
      p-43 lifecycle پکیج/باینری
      مرز Package (Remote Hubs واقعاً loaderKind: package)
      CRM / Marketplace / موبایل / IA عملیاتی
```

سه قانون — اگر بشکنند، تلفیق خراب می‌شود:

1. **دو جور rollback قاطی نشود.** PDK-12 = نسخهٔ صفحه/API/مدل روی نود مقصد. [p-43](p-43-platform-updates.md) = ZIP پکیج و باینری AppEndO.
2. **پلن `next/` کپی نشود.** اگر کاری واقعاً اینجا تمام شد، همان سند `next/` بسته/منتقل شود — دو قرارداد موازی نه.
3. **موج C قبل از گیت ۰ و نود دوم شروع نشود.** Promote بدون نصب پایدار و بدون SEC-1 روی SQL / impersonate / OpenAPI، کارخانه را روی سطح حملهٔ باز سوار می‌کند.

<table dir="rtl">
<thead><tr><th>اصلاح هسته</th><th>نقش نسبت به p-96</th></tr></thead>
<tbody><tr><td>کارخانهٔ تحویل / promote / rollback آرتیفکت اپ</td><td>خود موج C</td></tr>
<tr><td>گراف وابستگی قبل از پابلیش/حذف</td><td>خود PDK-9</td></tr>
<tr><td>مشاهده‌پذیری روی اپ زنده</td><td>موج A (PDK-1 · PDK-2)</td></tr>
<tr><td>تست Function / Data API</td><td>موج A (PDK-3 · PDK-5)</td></tr>
<tr><td>اعتبار <code dir="ltr" style="unicode-bidi: embed;">x-request-id</code> (SEC-3-3)</td><td>فیوز در PDK-1</td></tr>
<tr><td>SEC-1</td><td>گیت موازی — فاز PDK نیست</td></tr>
<tr><td>p-52</td><td>گیت موازی — فاز PDK نیست</td></tr>
<tr><td>صفحه با <code dir="ltr" style="unicode-bidi: embed;">ownerPackageId</code> که هنوز <code dir="ltr" style="unicode-bidi: embed;">loaderKind: core</code> است</td><td>invariant در PDK-9 — استخراج Remote Hubs فاز این پلن نیست</td></tr>
<tr><td>publish Designer که PDK-11 لازم دارد</td><td>گیت نازک قبل از موج C — فقط همان برش publish</td></tr>
<tr><td>p-43 · مرز Package · CRM · Marketplace · موبایل</td><td>برنامهٔ خواهر بعد از موج C</td></tr>
<tr><td>جمع‌کردن IA (Jobs / Scheduler / Work Items)</td><td>بیرون — p-96 حتی <code dir="ltr" style="unicode-bidi: embed;">sql-workshop</code> توکار به Development اضافه می‌کند</td></tr>
<tr><td>خالی کردن <code dir="ltr" style="unicode-bidi: embed;">src/core</code> / <code dir="ltr" style="unicode-bidi: embed;">src/components</code> (FSD)</td><td>بیرون — بهداشت لایه</td></tr>
<tr><td>Human Task · Agent/CACL · URE · حذف Prisma</td><td>بیرون</td></tr>
</tbody></table>

SQL Workshop با `loaderKind: core` عمدی است: Development را پکیج نمی‌کنیم. این را با استخراج Remote Hubs قاطی نکن.

---

## چرا این برش (زمینه)

Gartner LCAP 2025 برای هستهٔ پلتفرم توسعه IDE بصری + دادهٔ توزیع‌شده را اجباری می‌داند؛ رقابت روی **SDLC کامل** است: چند محیط، تست، observability، کانکتور، موبایل. APEX همان را با SQL Workshop و Developer Toolbar عملی کرده؛ OutSystems با LifeTime (محیط + impact). AppEndO از نظر ابزار ساخت (Designer، Data Studio، Functions، Git، Packages) جلو است؛ شکاف در **کارخانهٔ تحویل** است نه یک ادیتور دیگر.

---

## ترتیب اجرا

```
گیت ۰ (موازی)     p-52 · p-66 SEC-1
موج A (نازک)
  PDK-1 correlation (+ اعتبار x-request-id)
    → PDK-2 toolbar
    → PDK-3 function test ‖ PDK-4 SQL v1
    → PDK-5 Data API test
موج B (متوسط)
  PDK-6 SQL v2
  PDK-7 impersonate (روی toolbar)
  PDK-8 OpenAPI runtime
  PDK-9 graph (ترجیحاً بعد از فعال‌شدن p-94)
گیت Designer (نازک)  برش publish مورد نیاز PDK-11 — بدون بک‌لاگ App Builder جدا
موج C (سنگین — ALM)  بعد از PDK-9 + گیت ۰ + نود دوم
  PDK-10 env → PDK-11 promote → PDK-12 rollback
```

فازهای یک موج را می‌توان موازی کرد فقط اگر وابستگی جدول زیر اجازه بدهد. موج C قبل از PDK-9، قبل از گیت ۰، و قبل از وجود نود دوم شروع نشود.

---

## موج A — نازک

هر فاز یک برش قابل رولبک. بدون مدل محیط، بدون پروموت.

### PDK-1 — Correlation id

هر درخواست Data API و Server Function یک `x-request-id` می‌گیرد (اگر کلاینت نفرستد سرور می‌سازد). همان id در Logs دیده می‌شود.

**فیوز SEC-3-3:** مقدار ورودی را محدود کن (`/^[A-Za-z0-9_-]{1,64}$/` وگرنه UUID جدید). echo بدون validation = log injection — این کار مال [p-66](p-66-security-hardening.md) است و اینجا تمام می‌شود؛ آیتم SEC-3-3 را در آن سند تیک بزن / اگر تنها باقی‌مانده بود سند را به‌روز کن. بقیهٔ SEC-* را به این فاز نیاور.

<table dir="rtl">
<thead><tr><th><strong>موفقیت</strong></th><th>از Network تب مرورگر تا ردیف Logs همان شناسه است · id نامعتبر عوض می‌شود نه echo خام</th></tr></thead>
<tbody><tr><td><strong>خارج</strong></td><td>APM · OpenTelemetry exporter · تغییر قرارداد لاگ موجود فراتر از یک فیلد · بقیهٔ p-66</td></tr>
<tr><td><strong>UI</strong></td><td>ندارد</td></tr>
</tbody></table>

### PDK-2 — Developer Toolbar روی صفحهٔ منتشرشده

نوار کوچک فقط برای نقش `ADMIN` **و** فلگ صریح Settings (مثلاً `developerToolbar`). روی portal برای بازدیدکنندهٔ غیرادمین صفر DOM اضافه.

موج A فقط: نمایش request id آخرین فراخوانی، لینک «Open in Client Components» اگر صفحه `loaderKind: designer` است، مدت پاسخ آخرین Data API همان صفحه (اگر باشد).

<table dir="rtl">
<thead><tr><th><strong>موفقیت</strong></th><th><code dir="ltr" style="unicode-bidi: embed;">/us/{portal}/…</code> با فلگ روشن نوار را نشان می‌دهد؛ بدون فلگ هیچ markup اضافه نیست</th></tr></thead>
<tbody><tr><td><strong>خارج</strong></td><td>impersonate (PDK-7) · trace درختی · Toolbar روی Live Designer</td></tr>
<tr><td><strong>UI</strong></td><td>جزء رانتایم portal است نه <code dir="ltr" style="unicode-bidi: embed;">pageKey</code> جدا · Base Components (<code dir="ltr" style="unicode-bidi: embed;">chip</code> / <code dir="ltr" style="unicode-bidi: embed;">tooltip</code> / دکمهٔ <code dir="ltr" style="unicode-bidi: embed;">size="sm"</code>)</td></tr>
</tbody></table>

**یادداشت فنی (بررسی سورس ۲۰۲۶-۰۸-۲۵):** این فاز واقعاً چیز جدیدی است، ولی نقاط اتصال آماده‌اند — دوباره کشف نکن:
- ریشهٔ تزریق: `PortalShell` (`src/app/platform/PortalHost.tsx:26-77`) داخل `PortalContextProvider`، کنار `ShellLayout` — یک‌بار per-portal، نه per-page.
- نقش/کاربر: `useAuth()` از `src/contexts/AuthContext.tsx:288-291` (`currentUser.role`)، `PortalShell` همین حالا مصرفش می‌کند.
- فلگ Settings: `useAppSettingsQuery()` در `src/shared/api/queries/settings.ts:25-30`؛ `AppSettings` (`src/shared/api/contracts/settings/types.ts`) یک آبجکت مسطح بولین است — `developerToolbar` را همانجا اضافه کن؛ `/api/settings` از قبل `ADMIN`-only است.
- `pageKey`/`loaderKind` فعلاً در هیچ context ای پایین پاس داده نمی‌شود — باید از `DynamicOutlet`/`ExperiencePageOutlet` به `PortalContext` (`src/app/platform/PortalContext.tsx`) اضافه شود.
- آخرین request id/duration: تک‌نقطهٔ همهٔ کال‌ها `apiRequest()` در `src/shared/api/client.ts:169-217` است (`response.headers.get('x-request-id')` همینجا در دسترس است) — هیچ interceptor فعلی نیست، اینجا اضافه شود.
- لینک Client Components: `buildComponentDesignerDraftUrl` در `src/features/component-designer/lib/designerDraftPath.ts:25-30`.

### PDK-3 — تست Server Function داخل Studio

**اسکوپ واقعی کوچک‌تر از حد پلن است:** یک کنسول تست کامل از قبل هست — `TestConsolePanel.tsx` (`src/features/server-functions/components/`) + `useServerFunctionRunner.ts` (اجرای sandbox، خروجی زنده، بنر موفق/خطا). چیزی که واقعاً کم است فقط **پایداری fixture** (ورودی + انتظار status/بدنه ذخیره‌شده روی function) و **مقایسهٔ خودکار** نتیجهٔ اجرا با آن انتظار برای سبز/قرمز است؛ اجرای sandbox و پنل نمایش را از نو نساز.

<table dir="rtl">
<thead><tr><th><strong>موفقیت</strong></th><th>یک fixture ذخیره می‌شود، از همان کنسول موجود اجرا می‌شود، سبز/قرمز بر اساس مقایسه با انتظار بدون Postman</th></tr></thead>
<tbody><tr><td><strong>خارج</strong></td><td>تست UI · صف Jobs · CI جنکینز · بازسازی کنسول اجرای موجود</td></tr>
<tr><td><strong>UI</strong></td><td>همان پنل موجود <code dir="ltr" style="unicode-bidi: embed;">TestConsolePanel</code> روی <code dir="ltr" style="unicode-bidi: embed;">/studio/server-functions/edit/…</code> را با fixture/diff گسترش بده</td></tr>
</tbody></table>

### PDK-4 — SQL Workshop v1 (فقط SELECT)

صفحهٔ Studio جدید در گروه **Development**، نقش `ADMIN`. منبع = Data Source موجود (`EdgeDbRouter`). فقط `SELECT` (و معادل read-only همان موتور). هر اجرا در Logs با actor، مدت، `x-request-id`.

پیشنهاد هویت صفحه: `pageKey: sql-workshop` · مسیر `/studio/sql-workshop` · `loaderKind: core`.

<table dir="rtl">
<thead><tr><th><strong>موفقیت</strong></th><th>کوئری روی Edge انتخاب‌شده برمی‌گردد؛ <code dir="ltr" style="unicode-bidi: embed;">INSERT</code> / <code dir="ltr" style="unicode-bidi: embed;">UPDATE</code> / <code dir="ltr" style="unicode-bidi: embed;">DELETE</code> / <code dir="ltr" style="unicode-bidi: embed;">DROP</code> / <code dir="ltr" style="unicode-bidi: embed;">ALTER</code> رد می‌شود</th></tr></thead>
<tbody><tr><td><strong>خارج</strong></td><td>object browser · <code dir="ltr" style="unicode-bidi: embed;">EXPLAIN</code> · DDL — PDK-6</td></tr>
<tr><td><strong>UI</strong></td><td>شِل Users-like: انتخاب منبع + editor + grid نتیجه · Base Components</td></tr>
</tbody></table>

این **Database Manager پکیج** نیست. DBA کامل (backup، kill session، user DB) در backlog #2 می‌ماند.

### PDK-5 — تست Data API (یک عملیات)

از Data Studio روی یک operation منتشرشده: نمونهٔ query/body + انتظار status و کلیدهای JSON + یک کاربر یا نقش برای ACL.

<table dir="rtl">
<thead><tr><th><strong>موفقیت</strong></th><th>تست Record Policy «کاربر A می‌بیند / B نمی‌بیند» داخل Studio</th></tr></thead>
<tbody><tr><td><strong>خارج</strong></td><td>مجموعهٔ رگرسیون بزرگ · ذخیرهٔ suite در پکیج zip</td></tr>
<tr><td><strong>UI</strong></td><td>پنل روی مدلر Data Studio · نه صفحهٔ جدا در v1</td></tr>
</tbody></table>

---

## موج B — متوسط

روی A سوار می‌شود. هنوز چند نود به‌عنوان محیط رسمی نیست.

### PDK-6 — SQL Workshop v2

درخت اشیاء (table/view) از introspection موجود Data Studio. `EXPLAIN` اگر موتور بدهد. تاریخچهٔ کوئری per-user در `workspace/` (نه در zip پکیج، نه `settings.json` اسرار).

<table dir="rtl">
<thead><tr><th><strong>موفقیت</strong></th><th>کلیک روی جدول → <code dir="ltr" style="unicode-bidi: embed;">SELECT</code> محدود پیش‌پر می‌شود</th></tr></thead>
<tbody><tr><td><strong>خارج</strong></td><td>backup · restore · kill session · ساخت user دیتابیس</td></tr>
</tbody></table>

### PDK-7 — Impersonate از Toolbar

«View as role» / «View as user» فقط `ADMIN`، audit اجباری، تایم‌باکس (۱۵ دقیقه، قابل تنظیم). جلسهٔ JWT اصلی عوض نمی‌شود؛ فقط زمینهٔ رانتایم همان تب برای Record Policy و Data API.

<table dir="rtl">
<thead><tr><th><strong>موفقیت</strong></th><th>با نقش دیگر ردیف‌ها طبق Record Policy عوض می‌شوند؛ Logs فیلد <code dir="ltr" style="unicode-bidi: embed;">impersonatorId</code> دارد</th></tr></thead>
<tbody><tr><td><strong>خارج</strong></td><td>sudo پایدار · عوض کردن کوکی جلسه · impersonate برای غیر-ADMIN</td></tr>
</tbody></table>

**⚠️ ریسک امنیتی موجود، مستقل از زمان‌بندی این فاز (بررسی سورس ۲۰۲۶-۰۸-۲۵):** یک server function توکار به نام `fn-auth-loginas` از قبل در کد هست (`src/shared/api/contracts/server-functions/initialFunctions.ts:82-124`، `POST /api/auth/loginas/:id`، محدود به `ADMIN`) که برخلاف طراحی PDK-7 یک **سشن کامل** برای کاربر هدف صادر می‌کند — بدون audit log و بدون time-box. این قابلیت همین الان در پروداکشن وجود دارد و طراحی PDK-7 آن را جایگزین نمی‌کند مگر صریحاً گفته شود. قبل یا حین ساخت PDK-7 باید تصمیم گرفته شود: `fn-auth-loginas` حذف/محدود شود، یا حداقل audit+timebox به آن اضافه شود؛ در غیر این صورت PDK-7 یک مسیر دوم امن می‌سازد در حالی که مسیر ناامن قبلی باز می‌ماند. پیشنهاد: این آیتم را هم به‌عنوان یک بند مستقل در [p-66](p-66-security-hardening.md) ثبت کن (شبیه SEC-1)، تا اگر PDK-7 دیر اجرا شد، ریسک بدون گیت نماند.

### PDK-8 — موتور کانکتور HTTP/OpenAPI توکار

یک اتصال جنریک در هسته: base URL، فایل/URL اوپن‌اپی، API key یا OAuth **کلاینت ادمین** (نه vault per-user — آن لایه مال پکیج #48 است). فراخوانی از Server Function یا لایهٔ host با سیاست شبکه؛ sandbox خام بدون allowlist ممنوع.

<table dir="rtl">
<thead><tr><th><strong>موفقیت</strong></th><th>import یک OpenAPI نمونه → یک call تست از Studio</th></tr></thead>
<tbody><tr><td><strong>خارج</strong></td><td>کاتالوگ SaaS · credential per-user — <a href="../../packages/todo/p-packages-api-connectors.md">p-packages-api-connectors</a></td></tr>
</tbody></table>

اگر AC-1 همان «موتور پروکسی OpenAPI» را تعریف کرده، در اجرای PDK-8 موتور به هسته منتقل می‌شود و پکیج فقط کاتالوگ/مصرف‌کننده می‌ماند (یک قرارداد).

پیشنهاد هویت صفحه (در صورت نیاز): گروه Development یا Extensions — در فاز مشخص شود؛ تکراری با Package Manager نباشد.

**✅ ساخته و تأیید زنده شد (۲۰۲۶-۰۸-۲۶).** جزئیات کامل در ردیف PDK-8 جدول لاگ فاز پایین. تصمیم‌های مقیاس v1: `authKind` فقط `none/apiKey/bearer/basic` — OAuth client-credentials کامل (token endpoint + کش/رفرش توکن) عمداً کنار گذاشته شد چون یک قابلیت مستقل و بزرگ‌تر است؛ اگر لازم شد به‌عنوان فاز بعدی جدا اضافه می‌شود، نه این‌که PDK-9 را عقب بیندازد. صفحه زیر گروه **Development** ثبت شد (کنار SQL Workshop، نه Extensions) — چون یک ابزار توسعه‌دهنده است نه یک کاتالوگ نصب‌شدنی مثل Package Manager.

### PDK-9 — گراف «کجا استفاده می‌شود»

ترجیح: بعد از آمدن [p-94](p-94-component-usage.md) به `todo/`. اگر p-94 هنوز موکول است، v1 فقط **وابستگی استاتیک** (صفحهٔ portal، `ownerPackageId`، ارجاع workflow اگر در رجیستری باشد) بدون hit روزانه.

از نام کامپوننت Designer: کجا published است. UI: پنل در Client Components.

**Invariant (هشدار، نه مهاجرت):** اگر صفحه `ownerPackageId` دارد و هنوز `loaderKind: core` است، در گراف/هشدار وابستگی دیده شود. استخراج Remote Hubs و بازنویسی loader فاز این پلن نیست.

<table dir="rtl">
<thead><tr><th><strong>موفقیت</strong></th><th>قبل از پابلیش/حذف، هشدار وابستگی دیده می‌شود</th></tr></thead>
<tbody><tr><td><strong>خارج</strong></td><td>پروموت بین محیط‌ها (PDK-11) · hit روزانه (مال p-94) · استخراج پکیج از Core</td></tr>
</tbody></table>

**✅ ساخته و تأیید زنده شد (۲۰۲۶-۰۸-۲۶).** جزئیات کامل در ردیف PDK-9 جدول لاگ فاز پایین. p-94 هنوز در `next/` بود، پس دقیقاً طبق قاعدهٔ v1 پلن ساخته شد: گراف کاملاً استاتیک از رجیستری موجود، بدون هیچ جدول/شمارندهٔ جدید. هیچ رجیستری ارجاع workflow→component پیدا نشد (فقط جهت عکس هست: یک Dynamic Action داخل کامپوننت می‌تواند workflow را trigger کند) — طبق تصمیم صریح، این بخش خالی (`workflows: []`) ماند، نه شبیه‌سازی‌شده.

---

## موج C — سنگین (ALM)

فقط بعد از PDK-9 **و** گیت ۰ (p-52 پایدار روی حداقل یک provider غیر از PG که نود دوم با آن بالا بیاید + SEC-1). اگر publish Designer برای بستهٔ `designer` هنوز برش لازم PDK-11 را ندارد، همان برش را به‌عنوان گیت نازک ببند — بک‌لاگ App Builder جدا داخل موج C نیاید.

این لایه «این نود = test، آن نود = prod» است — نه Export/Import کارتنی امروز ([Platform Transfer](../../../docs/ai/CODEBASE_INDEX.md)).

### PDK-10 — هویت محیط

نود یک `environmentKind`: `dev` | `test` | `prod` در Settings (صریح؛ hostname به‌تنهایی منبع حقیقت نیست). کانفیگ جدا از سورس: Data Source پیش‌فرض، base URL کانکتور PDK-8. صفحهٔ Designer با عوض کردن محیط ویرایش نمی‌شود.

<table dir="rtl">
<thead><tr><th><strong>موفقیت</strong></th><th>دو نود با یک پکیج نصب‌شده؛ روی <code dir="ltr" style="unicode-bidi: embed;">prod</code> منبع دادهٔ دیگر بدون ادیت Client Components</th></tr></thead>
<tbody><tr><td><strong>خارج</strong></td><td>cluster چند نود هم‌محیط · DNS خودکار</td></tr>
</tbody></table>

### PDK-11 — Promote + impact

بستهٔ آرتیفکت انتخابی: صفحات `designer` + مدل‌های Edge وابسته + API + workflow طبق سیاست موجود (draft هرگز auto-publish نشود — قرارداد فعلی Packages). قبل از اعمال: گزارش «روی مقصد ساخته می‌شود / می‌شکند» از گراف PDK-9.

<table dir="rtl">
<thead><tr><th><strong>موفقیت</strong></th><th>از نود <code dir="ltr" style="unicode-bidi: embed;">dev</code> به <code dir="ltr" style="unicode-bidi: embed;">test</code> با پیش‌نمایش؛ رد اگر وابستگی غایب است</th></tr></thead>
<tbody><tr><td><strong>خارج</strong></td><td>merge کانفلیکت Designer · CI خارجی · بازنویسی Platform Transfer</td></tr>
</tbody></table>

### PDK-12 — Release history + rollback

هر promote یک `releaseId`. rollback مقصد را به release قبلی برمی‌گرداند (آرتیفکت اپ). اسرار `settings.json` و master keyها برنمی‌گردند.

<table dir="rtl">
<thead><tr><th><strong>موفقیت</strong></th><th>یک اقدام بازگشت صفحه/API به نسخهٔ قبلی promote</th></tr></thead>
<tbody><tr><td><strong>خارج</strong></td><td>rollback باینری AppEndO — <a href="p-43-platform-updates.md">p-43</a></td></tr>
</tbody></table>

---

## UI و کپی

- Base Components first؛ کپی انگلیسی در سورس.
- SQL Workshop و (اگر صفحه شد) Artifact Tests / Connector runtime: گروه **Development**، `ADMIN`.
- Developer Toolbar جزء رانتایم portal است نه آیتم سایدبار.
- SQL Workshop از `/studio/base-components` برای grid نتیجه، toolbar، empty/error — نه `<textarea>` خام اگر کاتالوگ editor دارد؛ در غیر این صورت اول بخش کاتالوگ، بعد صفحه.

---

## Scope OUT (کل پلن)

- پکیج کردن گروه Development
- Marketplace محتوا (`p-42`)
- موبایل (`p-91`) · Pivot (`p-93`) · SAML (`p-23`) · Human Task (`p-100`)
- Internal chat / task management
- CRM / Commerce / Payment provider خاص
- Remote Hubs (پکیج #49)
- Database Manager به‌عنوان DBA کامل
- ۷۰ کانکتور SaaS در هسته
- Playwright به‌عنوان محصول داخل Studio
- استخراج Remote Hubs از Core · جمع‌کردن IA عملیاتی · بهداشت FSD (`src/core` / `src/components`)
- URE · حذف Prisma · Agent/CACL به‌عنوان فاز PDK

---

## یافتهٔ جانبی — خارج از این پلن (نیاز به سند/فاز جدا)

**باگ واقعی و فعلاً زندهٔ روی صفحهٔ اصلی سایت** — حین تأیید زندهٔ PDK-2 کشف شد (۲۰۲۶-۰۸-۲۶)، ربطی به این پلن ندارد ولی چون کاربر واقعی رو می‌شکنه ثبت می‌شود تا بوقتش رسیدگی شود (احتمالاً باید به یه سند جدا تبدیل بشه، شاید مقدمهٔ همون «مرز Package» که در جدول برنامهٔ خواهر ردیف‌شده):

- **علامت:** روی `/us/` (و هر صفحهٔ دیگری که اسلات‌های پکیج CMS رو داره)، `CmsSiteBrandSlot` / `CmsSiteNavSlot` / `CmsSiteCtaSlot` / `CmsSiteFooterSlot` مدام کرش می‌کنن؛ متن خطا («No QueryClient set, use QueryClientProvider to set one») مستقیم توی صفحه می‌افته.
- **ریشه:** [src/core/packages/ensurePackageUiRuntime.ts](../../../src/core/packages/ensurePackageUiRuntime.ts) و [packageUiRuntimeGlobals.ts](../../../src/core/packages/packageUiRuntimeGlobals.ts) یه رجیستری global (`__APPENDO_PACKAGE_RUNTIME__`) برای به‌اشتراک‌گذاشتن `react` / `react-router-dom` / `@heroui/react` / چند ماژول داخلی با باندل UI پکیج‌ها می‌سازن — ولی `@tanstack/react-query` توی این لیست نیست. پس هر UI پکیج (مثل CMS) که از `useQuery`/`useQueryClient` استفاده کنه، نسخهٔ جدای خودش از react-query رو باندل می‌کنه؛ `QueryClientContext` اون نسخه با نسخهٔ اپ اصلی یکی نیست، پس `useQueryClient()` همیشه fail می‌کنه — حتی با اینکه کامپوننت توی همون درخت React اصلیه (نه iframe/remote root جدا).
- **برش فیکس احتمالی:** `@tanstack/react-query` به لیست shared globals (مثل هسته React) اضافه بشه؛ + [src/server/services/package/packageUiModuleCompile.service.ts](../../../src/server/services/package/packageUiModuleCompile.service.ts) (کامپایلر سمت سرور که importهای پکیج رو بازنویسی می‌کنه) باید `@tanstack/react-query` رو هم مثل `react`/`@/shared/ui` بشناسه و بازنویسی کنه؛ باندل‌های از‌قبل‌کامپایل‌شده (`packages-storage/runtimes/*/ui/*.tsx`) هم باید rebuild بشن.
- **ریسک اگر دست‌نخورده بمونه:** صفحهٔ اصلی سایت (و هر پکیج دیگه‌ای که از react-query استفاده کنه) روی این و مشابه دیپلوی‌ها برای کاربر نهایی خراب دیده می‌شه.

---

## لاگ فاز

<table dir="rtl">
<thead><tr><th>فاز</th><th>وضعیت</th><th>یادداشت</th></tr></thead>
<tbody><tr><td>PDK-1</td><td>✅</td><td>correlation id + اعتبار x-request-id (SEC-3-3) — پیاده‌سازی از قبل توی کد موجود بود (<code dir="ltr" style="unicode-bidi: embed;">src/server/requestId.ts</code> + <code dir="ltr" style="unicode-bidi: embed;">app.ts:47-52,90-126</code>)؛ فقط ستون مستقل requestId در جدول Logs UI باز مانده (اختیاری، جزئی)</td></tr>
<tr><td>PDK-2</td><td>✅</td><td>developer toolbar — تأیید زنده در مرورگر واقعی (Playwright + اکانت ادمین واقعی): روی <code dir="ltr" style="unicode-bidi: embed;">/us/</code> نمایش داده می‌شود (request id + duration)، روی <code dir="ltr" style="unicode-bidi: embed;">/us/studio/*</code> صفر است، با خاموش‌کردن فلگ صفر است. یک باگ واقعی حین تأیید پیدا و رفع شد (<code dir="ltr" style="unicode-bidi: embed;">isStudioMount</code> باید روی <code dir="ltr" style="unicode-bidi: embed;">shellKey</code> پورتال چک شود نه <code dir="ltr" style="unicode-bidi: embed;">PlatformMount.id</code>؛ <code dir="ltr" style="unicode-bidi: embed;">mountId==='studio'</code> غلط بود چون <code dir="ltr" style="unicode-bidi: embed;">/us/studio/...</code> از mount دیگری سرو می‌شود)</td></tr>
<tr><td>PDK-3</td><td>✅</td><td>function tests — fixture (<code dir="ltr" style="unicode-bidi: embed;">metadataJson.fixture</code>) + مقایسهٔ خودکار روی <code dir="ltr" style="unicode-bidi: embed;">TestConsolePanel</code> موجود. تأیید زنده در مرورگر واقعی: بج FIXTURE PASS با انتظار درست، FIXTURE FAIL با انتظار غلط — هر دو درست. (محیط dev فقط کند بود — با صبر ~۱۵-۲۰ ثانیه بعد از ناوبری هر صفحه کاملاً بالا می‌آید؛ این تأخیر پیشنهاد PDK-9/بعدی نیست، صرفاً نکتهٔ عملیاتی)</td></tr>
<tr><td>PDK-4</td><td>✅</td><td>SQL Workshop v1 — صفحهٔ جدید Studio (گروه Development) با انتخاب Data Source + ادیتور Monaco SQL + گرید نتیجه؛ از موتور اعتبارسنجی/اجرای موجود (<code dir="ltr" style="unicode-bidi: embed;">executeDataSourceQuery</code> + <code dir="ltr" style="unicode-bidi: embed;">validateExecuteDataSourceSql</code>) استفاده می‌کند، صفر تغییر بک‌اند. تأیید زنده: <code dir="ltr" style="unicode-bidi: embed;">SELECT 1;</code> روی PostgreSQL واقعی نتیجه برگرداند؛ <code dir="ltr" style="unicode-bidi: embed;">DELETE FROM users;</code> رد شد با «Only read or routine invocation SQL is allowed.» گرید نتیجه هم با <code dir="ltr" style="unicode-bidi: embed;">SchemaObjectRunPanel</code> (Data Studio) به یک کامپوننت مشترک (<code dir="ltr" style="unicode-bidi: embed;">DataSourceQueryResultView</code>) بازآرایی شد</td></tr>
<tr><td>PDK-5</td><td>✅</td><td>Data API tests — تب تازهٔ «Test» در <code dir="ltr" style="unicode-bidi: embed;">ConfigureDataApiDialog</code> (کنار Fields/Access/…)؛ اجرا با endpoint موجود <code dir="ltr" style="unicode-bidi: embed;">/try</code> (<code dir="ltr" style="unicode-bidi: embed;">EdgeApiService.tryDefinition</code>) که برای actor override گسترش یافت (<code dir="ltr" style="unicode-bidi: embed;">testActorUserId</code>/<code dir="ltr" style="unicode-bidi: embed;">testActorRoles</code>/<code dir="ltr" style="unicode-bidi: embed;">testActorIsAdmin</code> → <code dir="ltr" style="unicode-bidi: embed;">execute()</code>). انتخاب Anonymous/Role/User (از <code dir="ltr" style="unicode-bidi: embed;">useRolesListQuery</code>/<code dir="ltr" style="unicode-bidi: embed;">useUsersListQuery</code> موجود) + fixture مشترک با PDK-3 (<code dir="ltr" style="unicode-bidi: embed;">evaluateApiCallFixture</code>، به <code dir="ltr" style="unicode-bidi: embed;">shared/lib</code> منتقل شد). تأیید زنده: اجرا به‌عنوان نقش ADMIN روی <code dir="ltr" style="unicode-bidi: embed;">/api/cms/settings</code> داده واقعی برگرداند. یک باگ واقعی حین تأیید پیدا و رفع شد (مسیر عملیات از پیش‌نمایش draft فرم گرفته می‌شد نه از <code dir="ltr" style="unicode-bidi: embed;">operation.pathPattern</code> واقعی — روی این جدول خطای «no operation matches» می‌داد)</td></tr>
<tr><td>PDK-6</td><td>✅</td><td>SQL Workshop v2 — درخت اشیاء (Tables/Views از <code dir="ltr" style="unicode-bidi: embed;">useExplorerCatalogQuery</code> موجود) با کلیک→پیش‌پرکردن <code dir="ltr" style="unicode-bidi: embed;">SELECT * FROM … LIMIT 100</code>؛ <code dir="ltr" style="unicode-bidi: embed;">EXPLAIN</code> (پیشوند مجاز شد در <code dir="ltr" style="unicode-bidi: embed;">validateExecuteDataSourceSql</code>، دکمه فقط برای موتورهایی که EXPLAIN ساده پشتیبانی می‌کنند: Postgres/MySQL/SQLite/SQL Server)؛ تاریخچهٔ کوئری per-user در <code dir="ltr" style="unicode-bidi: embed;">workspace/sql-workshop-history/index.json</code> (فایل‌محور، با lock، مثل الگوی ssh-hub — نه settings.json نه zip پکیج)، سقف ۵۰ ردیف هر کاربر. ۴ تست واحد برای store + ۲ تست برای EXPLAIN validation، سبز. تأیید زنده: کلیک روی جدول SQL رو پر کرد، Run و Explain هر دو روی PostgreSQL واقعی جواب دادن (طرح کوئری واقعی برگشت)، تاریخچه ذخیره و نمایش داده شد</td></tr>
<tr><td>PDK-7</td><td>✅</td><td>impersonate — جلسهٔ JWT اصلی هرگز عوض نمی‌شود؛ فقط <code dir="ltr" style="unicode-bidi: embed;">req.auth</code> برای طول همان یک درخواست Data API در <code dir="ltr" style="unicode-bidi: embed;">dataApiExecutor.middleware.ts</code> (تنها مسیر واقعی اجرای Data API، طبق تحقیق) با یک grant موقت (in-memory، سقف ۶۰ دقیقه، پیش‌فرض ۱۵) جایگزین می‌شود — چون همهٔ Record Policy/cache-key منطق از قبل از <code dir="ltr" style="unicode-bidi: embed;">req.auth</code> می‌خوانند، این جایگزینی هم‌زمان هر دو را درست می‌کند (بدون نیاز به دور زدن cache جدا). فقط همان ادمینی که grant را ساخته می‌تواند استفاده‌اش کند؛ گیت ADMIN دوباره روی <code dir="ltr" style="unicode-bidi: embed;">req.auth</code> اصلی چک می‌شود. Audit اجباری با <code dir="ltr" style="unicode-bidi: embed;">logAuthEvent</code> موجود (<code dir="ltr" style="unicode-bidi: embed;">IMPERSONATE_START</code>/<code dir="ltr" style="unicode-bidi: embed;">IMPERSONATE_END</code>، شامل <code dir="ltr" style="unicode-bidi: embed;">impersonatorId</code>) — بدون مکانیزم لاگ جدید. UI: کنترل «View as» روی <code dir="ltr" style="unicode-bidi: embed;">DeveloperToolbar</code> (PDK-2)، هدر <code dir="ltr" style="unicode-bidi: embed;">x-impersonate-grant</code> از طریق سیگنال مشترک <code dir="ltr" style="unicode-bidi: embed;">devToolbarSignal</code>. تست: ۱۵ تست واحد (۶ grant store + ۵ سرور + ۴ کلاینت) — همه‌ی حالت‌های امنیتی حساس پوشش داده شد (غیرادمین رد می‌شود، grant دیگری قابل استفاده نیست، grant منقضی/ناموجود نادیده گرفته می‌شود). تأیید زنده کامل: پنل «View as» با نقش‌های واقعی کار کرد، شروع/پایان impersonation round-trip واقعی زد، و در <code dir="ltr" style="unicode-bidi: embed;">IMPERSONATE_START</code>/<code dir="ltr" style="unicode-bidi: embed;">IMPERSONATE_END</code> واقعی در <code dir="ltr" style="unicode-bidi: embed;">/api/auth/audit-logs</code> با <code dir="ltr" style="unicode-bidi: embed;">impersonatorId</code> درست ثبت شد. حین این فاز یک رگرسیون واقعی از PDK-4 هم پیدا و رفع شد (<code dir="ltr" style="unicode-bidi: embed;">ExperienceHost.routing.test.tsx</code> mock لیست صفحات <code dir="ltr" style="unicode-bidi: embed;">SqlWorkshopPage</code> را نداشت)</td></tr>
<tr><td>PDK-8</td><td>✅</td><td>موتور HTTP/OpenAPI — رمزنگاری AES-256-GCM اختصاصی (<code dir="ltr" style="unicode-bidi: embed;">httpConnectionCrypto.ts</code>، الگوی <code dir="ltr" style="unicode-bidi: embed;">sshHubCrypto.ts</code>)، پارسر OpenAPI کمینه (<code dir="ltr" style="unicode-bidi: embed;">shared/lib/openApiConnectorSpec.ts</code>)، store فایل‌محور (<code dir="ltr" style="unicode-bidi: embed;">workspace/http-connections/index.json</code>، مثل الگوی PDK-6)، executor با SSRF guard مشترک (<code dir="ltr" style="unicode-bidi: embed;">mcpUrlGuard.ts</code>) + <strong>allowlist = فقط عملیات‌های داخل اسپک ذخیره‌شده</strong> (نه URL دلخواه)، مسیر <code dir="ltr" style="unicode-bidi: embed;">POST /api/http-connections/:id/call</code> برای تست از Studio. پل sandbox: تابع سراسری جدید <code dir="ltr" style="unicode-bidi: embed;">connectors.call(name, operationId, params)</code> در VM Server Function (بدون <code dir="ltr" style="unicode-bidi: embed;">fetch</code>/<code dir="ltr" style="unicode-bidi: embed;">require('http')</code> خام) — پیام‌رسانی postMessage مثل الگوی <code dir="ltr" style="unicode-bidi: embed;">workflow.start()</code> موجود در <code dir="ltr" style="unicode-bidi: embed;">sandboxWorkerPool.ts</code> (نه raw network، این دقیقاً قاعدهٔ سخت پلن است). صفحهٔ Studio جدید «HTTP Connections» (گروه Development). ۲۷ تست واحد جدید سبز (crypto/parser/store/executor/sandbox bridge)، صفر خطای TypeScript جدید. تأیید زنده کامل: import اسپک OpenAPI نمونه (JSONPlaceholder) → پیک عملیات → <code dir="ltr" style="unicode-bidi: embed;">GET /todos/1</code> واقعی روی اینترنت با پاسخ ۲۰۰ واقعی. حین تأیید یک باگ واقعی در همون کامپوننت جدید پیدا و رفع شد (نه در کد قدیمی) — چهار child جدای JSX در یک <code dir="ltr" style="unicode-bidi: embed;">&lt;option&gt;</code> باعث می‌شد <code dir="ltr" style="unicode-bidi: embed;">UiSelect</code> متن را با کاما بشکند؛ راه‌حل: یک رشتهٔ واحد به‌جای چند expression</td></tr>
<tr><td>PDK-9</td><td>✅</td><td>گراف استاتیک «کجا استفاده می‌شود» — <code dir="ltr" style="unicode-bidi: embed;">computeDesignerComponentUsage(draftId)</code> در <code dir="ltr" style="unicode-bidi: embed;">designerComponentUsage.service.ts</code>، با استفادهٔ مجدد از <code dir="ltr" style="unicode-bidi: embed;">collectDesignerResiduePageKeys</code> (همان تابعی که قبلاً فقط برای پاک‌سازی حذف استفاده می‌شد؛ حالا هم برای هشدار قبل از حذف). می‌خواند از <code dir="ltr" style="unicode-bidi: embed;">listPageModuleFiles()</code>/<code dir="ltr" style="unicode-bidi: embed;">listRouteBindingFiles()</code> (<code dir="ltr" style="unicode-bidi: embed;">PlatformRegistryFileStore.ts</code>) — بدون جدول/hit جدید. اندپوینت <code dir="ltr" style="unicode-bidi: embed;">GET /api/component-designer/drafts/:id/usage</code> (ADMIN-gated، پشت همون <code dir="ltr" style="unicode-bidi: embed;">requireBuilderStudioAccess</code> موجود). UI: در <code dir="ltr" style="unicode-bidi: embed;">DesignerDeleteComponentDialog</code> (Client Components) — قبل از تأیید حذف، اگه صفحه‌ای این کامپوننت رو استفاده کنه، جعبهٔ هشدار زرد با فهرست pageKey/mount نشون داده می‌شه؛ هرگز حذف رو بلاک نمی‌کنه (فقط هشدار). Invariant <code dir="ltr" style="unicode-bidi: embed;">ownerPackageId</code> + <code dir="ltr" style="unicode-bidi: embed;">loaderKind: core</code> هم به‌صورت بج جداگانه روی هر صفحه نشون داده می‌شه. ۴ تست واحد سبز، صفر خطای TypeScript جدید (فقط باگ pre-existing تایپ‌اینفرنس همون فایل که قبلاً هم روی ۳ هوک دیگه بود، دست‌نخورده ماند). تأیید زنده کامل: روی کامپوننت واقعی <code dir="ltr" style="unicode-bidi: embed;">UI for sum-two-numbers</code> کلیک Delete → دیالوگ واقعی نشون داد «Used on 1 page — deleting will break it / ui-for-sum-two-numbers» — دقیقاً معیار موفقیت پلن</td></tr>
<tr><td>PDK-10</td><td>⬜</td><td>environment kind</td></tr>
<tr><td>PDK-11</td><td>⬜</td><td>promote</td></tr>
<tr><td>PDK-12</td><td>⬜</td><td>rollback</td></tr>
</tbody></table>

---

## لاگ

<table dir="rtl">
<thead><tr><th>تاریخ</th><th>خلاصه</th></tr></thead>
<tbody><tr><td>۲۰۲۶-۰۸-۲۵</td><td><strong>برنامه / گیت‌ها / خارج</strong> — ستون کارخانه؛ گیت ۰ و گیت Designer؛ خواهر بعد از موج C. PDK-1…12 همان فازها؛ SEC-3-3 فیوز PDK-1؛ invariant PDK-9</td></tr>
<tr><td>۲۰۲۶-۰۸-۲۵</td><td><strong>PDK-1 بسته شد</strong> — بررسی سورس نشان داد correlation id + فیوز SEC-3-3 + دیده‌شدن در Logs از قبل کامل پیاده بود (<code dir="ltr" style="unicode-bidi: embed;">requestId.ts</code>, <code dir="ltr" style="unicode-bidi: embed;">app.ts</code>). زیرفاز فعال → PDK-2</td></tr>
<tr><td>۲۰۲۶-۰۸-۲۵</td><td><strong>بررسی PDK-2..9 در برابر سورس</strong> — PDK-2/4/5/8/9 واقعاً ساخته‌نشده تأیید شد (یادداشت فنی مسیرهای اتصال به PDK-2 اضافه شد). PDK-3 کوچیک‌تر از حد پلن است — کنسول تست (<code dir="ltr" style="unicode-bidi: embed;">TestConsolePanel</code>) از قبل هست، فقط fixture+diff کم است. PDK-7: ریسک امنیتی مستقل کشف شد (<code dir="ltr" style="unicode-bidi: embed;">fn-auth-loginas</code> بدون audit/time-box) → SEC-3-4 در <a href="p-66-security-hardening.md">p-66</a> ثبت شد؛ SEC-3-3 همانجا بسته شد</td></tr>
<tr><td>۲۰۲۶-۰۸-۲۶</td><td><strong>PDK-2 پیاده‌سازی شد</strong> — <code dir="ltr" style="unicode-bidi: embed;">DeveloperToolbar</code> (root پورتال) + <code dir="ltr" style="unicode-bidi: embed;">devToolbarSignal</code> (سیگنال خارجی برای آخرین request-id/duration و صفحهٔ فعال) + فلگ <code dir="ltr" style="unicode-bidi: embed;">developerToolbar</code> در Settings/UI + لینک Client Components. تست‌های واحد/رندر سبز؛ <code dir="ltr" style="unicode-bidi: embed;">test:critical</code> بدون رگرسیون جدید. حین تأیید زنده (Playwright + اکانت ادمین واقعی) دو باگ واقعی پیدا و رفع شد: (۱) <code dir="ltr" style="unicode-bidi: embed;">developerToolbar</code> به <code dir="ltr" style="unicode-bidi: embed;">SECTION_FIELD_MAP</code> در <code dir="ltr" style="unicode-bidi: embed;">sections.ts</code> اضافه نشده بود → مرج/پرسیست بی‌صدا حذفش می‌کرد، (۲) گیت Studio روی <code dir="ltr" style="unicode-bidi: embed;">PlatformMount.id</code> بود نه <code dir="ltr" style="unicode-bidi: embed;">shellKey</code> پورتال → روی <code dir="ltr" style="unicode-bidi: embed;">/us/studio/...</code> هم نشون داده می‌شد. بعد از رفع هر دو، تأیید نهایی زنده موفق: نمایش روی <code dir="ltr" style="unicode-bidi: embed;">/us/</code>، صفر روی Studio، صفر با فلگ خاموش. یک باگ pre-existing نامرتبط هم کشف شد (<code dir="ltr" style="unicode-bidi: embed;">CmsSiteBrandSlot</code>/<code dir="ltr" style="unicode-bidi: embed;">CmsSiteNavSlot</code> و مشابه بدون QueryClient در باندل پکیج CMS، صفحهٔ اصلی سایت رو می‌شکنه) — خارج از این پلن، نیاز به پیگیری جدا دارد. زیرفاز فعال → PDK-3</td></tr>
<tr><td>۲۰۲۶-۰۸-۲۶</td><td><strong>PDK-3 پیاده‌سازی شد</strong> — <code dir="ltr" style="unicode-bidi: embed;">ServerFunctionFixture</code> (<code dir="ltr" style="unicode-bidi: embed;">expectedStatus</code>/<code dir="ltr" style="unicode-bidi: embed;">expectedBodyJson</code>) در <code dir="ltr" style="unicode-bidi: embed;">metadataJson.fixture</code> (بدون تغییر بک‌اند، از همون مسیر پرسیست <code dir="ltr" style="unicode-bidi: embed;">testPayload</code> استفاده می‌کند) + <code dir="ltr" style="unicode-bidi: embed;">evaluateServerFunctionFixture</code> (تابع خالص، جزئی/subset match روی بدنه) + بخش تازهٔ «Expected Result (Fixture)» و بج PASS/FAIL روی <code dir="ltr" style="unicode-bidi: embed;">TestConsolePanel</code> موجود. ۹ تست واحد سبز، تایپ‌چک تمیز، <code dir="ltr" style="unicode-bidi: embed;">test:server-functions</code> بدون رگرسیون</td></tr>
<tr><td>۲۰۲۶-۰۸-۲۶</td><td><strong>کاربر: «همه رو تا انتها برو جلو».</strong> طبق قانون سخت پلن، موج C (PDK-10..12) قبل از گیت ۰ + نود دوم شروع نمی‌شود — این‌ها منتظر می‌مانند. ادامه با موج A/B (PDK-4..9). فهمیدیم محیط dev فقط کند است (نه خراب) — بعد از ناوبری هر صفحه ~۱۵-۲۰ ثانیه صبر لازم است؛ PDK-3 با این روش دوباره تست و ✅ شد (بج PASS/FAIL هر دو درست)</td></tr>
<tr><td>۲۰۲۶-۰۸-۲۶</td><td><strong>PDK-4 و PDK-5 پیاده‌سازی و تأیید شدند</strong> — جزئیات در ردیف‌های خودشان بالا. منطق مقایسهٔ fixture از <code dir="ltr" style="unicode-bidi: embed;">server-functions/lib</code> به <code dir="ltr" style="unicode-bidi: embed;">shared/lib/apiCallFixtureMatch.ts</code> منتقل شد تا هم PDK-3 هم PDK-5 از یک تابع استفاده کنند. زیرفاز فعال → PDK-6</td></tr>
<tr><td>۲۰۲۶-۰۸-۲۶</td><td><strong>PDK-4 پیاده‌سازی شد</strong> — صفحهٔ جدید <code dir="ltr" style="unicode-bidi: embed;">SQL Workshop</code> (Studio، گروه Development، <code dir="ltr" style="unicode-bidi: embed;">pageKey: sql-workshop</code>) با <code dir="ltr" style="unicode-bidi: embed;">useDataSourcesQuery</code> + Monaco SQL + <code dir="ltr" style="unicode-bidi: embed;">useExecuteDataSourceQueryMutation</code> — همان موتور موجود <code dir="ltr" style="unicode-bidi: embed;">executeDataSourceQuery</code>/<code dir="ltr" style="unicode-bidi: embed;">validateExecuteDataSourceSql</code> را دوباره‌استفاده می‌کند (صفر تغییر بک‌اند). گرید نتیجه با <code dir="ltr" style="unicode-bidi: embed;">SchemaObjectRunPanel</code> (Data Studio) در <code dir="ltr" style="unicode-bidi: embed;">DataSourceQueryResultView</code> مشترک شد. ثبت page-module/route-binding/nav هم در seed (<code dir="ltr" style="unicode-bidi: embed;">src/config/platform-registry</code>) هم در workspace زندهٔ این محیط. تأیید زنده: <code dir="ltr" style="unicode-bidi: embed;">SELECT 1;</code> روی PostgreSQL واقعی جواب داد؛ <code dir="ltr" style="unicode-bidi: embed;">DELETE FROM users;</code> رد شد. زیرفاز فعال → PDK-5</td></tr>
<tr><td>۲۰۲۶-۰۸-۲۶</td><td><strong>PDK-6 پیاده‌سازی و تأیید شد</strong> — جزئیات در ردیف خودش بالا. زیرفاز فعال → PDK-7. یادداشت: PDK-7 (impersonate) اولین فازیه که مسیر واقعی اجرای Data API (نه فقط ابزار تست جدا) رو لمس می‌کنه — قبل از پیاده‌سازی تحقیق دقیق‌تری انجام شد</td></tr>
<tr><td>۲۰۲۶-۰۸-۲۶</td><td><strong>PDK-7 پیاده‌سازی و تأیید کامل شد</strong> — جزئیات در ردیف خودش بالا. حین این فاز رگرسیون واقعی از PDK-4 پیدا و رفع شد (mock فراموش‌شده). الان که مکانیزم امن و audit-شدهٔ impersonate ساخته شد، SEC-3-4 در <a href="p-66-security-hardening.md">p-66</a> به‌روز شد — <code dir="ltr" style="unicode-bidi: embed;">fn-auth-loginas</code> قدیمی دیگه تنها گزینه نیست، تصمیم حذف/محدودسازیش عملی‌تره. زیرفاز فعال → PDK-8</td></tr>
<tr><td>۲۰۲۶-۰۸-۲۶</td><td><strong>PDK-8 پیاده‌سازی و تأیید کامل شد</strong> — جزئیات کامل در ردیف خودش بالا. مهم‌ترین تصمیم معماری: sandbox خام (VM بدون <code dir="ltr" style="unicode-bidi: embed;">fetch</code>) قبلاً <code dir="ltr" style="unicode-bidi: embed;">require()</code> نامحدود داشت (می‌شد <code dir="ltr" style="unicode-bidi: embed;">require('http')</code> صدا زد و از هر سیاست شبکه رد شد) — این شکاف دقیقاً همونیه که قاعدهٔ سخت پلن («sandbox خام بدون allowlist ممنوع») می‌گفت. راه‌حل: به‌جای دادن fetch خام به sandbox، یک پل کنترل‌شده (<code dir="ltr" style="unicode-bidi: embed;">connectors.call</code>) اضافه شد که همیشه از مسیر host (executor سرور، با SSRF guard + allowlist = فقط عملیات‌های اسپک ذخیره‌شده) رد می‌شود — الگوی postMessage دقیقاً کپی از پل <code dir="ltr" style="unicode-bidi: embed;">workflow.start()</code> موجود (PDK-8 دومین قابلیتیه که این الگو رو تکرار می‌کنه، بعد از workflow bridge). زیرفاز فعال → PDK-9</td></tr>
<tr><td>۲۰۲۶-۰۸-۲۶</td><td><strong>PDK-9 پیاده‌سازی و تأیید کامل شد — موج A/B (PDK-1..9) تمام شد.</strong> جزئیات کامل در ردیف خودش بالا. قبل از پیاده‌سازی یک تحقیق دقیق (Explore agent) معماری Designer draft/publish/page-module را نقشه‌برداری کرد — پیدا شد که <code dir="ltr" style="unicode-bidi: embed;">collectDesignerResiduePageKeys</code> (تابع موجود در <code dir="ltr" style="unicode-bidi: embed;">designerDeleteCleanup.ts</code>، قبلاً فقط برای پاک‌سازی بعد از حذف) دقیقاً همون منطق «این کامپوننت کجا به‌عنوان صفحه شناخته می‌شه» رو داره که PDK-9 لازم داشت — با استفادهٔ مجدد از همون تابع، به‌جای پیاده‌سازی موازی، این تضمین حفظ شد که «این کامپوننت» یک تعریف واحد در کل کدبیس داره. طبق قاعدهٔ v1 پلن (چون p-94 هنوز در <code dir="ltr" style="unicode-bidi: embed;">next/</code>)، گراف کاملاً استاتیک و بدون هیچ ردیابی/شمارندهٔ جدید ساخته شد. <strong>موج C (PDK-10..12) طبق قاعدهٔ سخت پلن شروع نمی‌شود</strong> — منتظر گیت ۰ (p-52 پایدار + SEC-1) و نود دوم می‌ماند؛ هیچ‌کدام در این محیط فراهم نیست. زیرفاز فعال → (هیچ — منتظر اپراتور)</td></tr>
<tr><td>۲۰۲۶-۰۹-۱۵</td><td><strong>چرخهٔ تولید (ایده → محصول)</strong> — جدول ۱۱ مرحله‌ای + دیاگرام ASCII اضافه شد؛ نقش p-96 فقط مراحل ۷–۹ (اطمینان تک‌نود + ALM بین نودها) صریح شد</td></tr>
</tbody></table>

---

*AppEndO — Native Dev Platform*


</div>
