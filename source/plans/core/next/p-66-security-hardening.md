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

<p><strong>خلاصه برای operatore:</strong> این سند جزو <strong>plans</strong> است (p-66-security-hardening). ستون وضعیت در <a href="./p-00-next-index.md">index مربوطه</a> مرجع «شروع شده / design / تمام» است.</p>
<p><strong>راهنمای خواندن:</strong> بخش‌های انگلیسی برای agent/dev هستند؛ جداول وضعیت و یادداشت‌های فارسی را اول بخوانید.</p>


# p-66 — Security Hardening (سخت‌سازی امنیتی پلتفرم)

> **فاز:** SEC · **موکول** (next)  
> **اولویت:** بالا — ۲ یافتهٔ بحرانی + ۴ پرخطر از ممیزی امنیتی ۲۰۲۶-۰۷-۱۸  
> **وضعیت:** ⬜ — کنترل: [p-00-next-index.md](p-00-next-index.md)  
> **ورود:** `@plans/core/next/p-66-security-hardening.md برو جلو`  
> **وابستگی:** — (مستقل · قابل اجرای موازی)

---

## هدف

رفع یافته‌های ممیزی امنیتی لایهٔ سرور: حذف ذخیرهٔ متن‌سادهٔ credential ها، بستن مسیرهای SQL injection، جلوگیری از بوت production با secret پیش‌فرض، و سخت‌سازی سطح حمله (headers، rate limit، file-manager scope).

**تعریف موفقیت:**

- هیچ secret ای به صورت متن ساده روی دیسک نماند.
- هیچ `$executeRawUnsafe` با interpolation ورودی کاربر باقی نماند.
- سرور production با secret پیش‌فرض **بالا نیاید** (fail-fast).
- `npm run test:critical` ✅ + تست‌های جدید برای هر آیتم.

---

## وضعیت یک‌خطی

<table dir="rtl">
<thead><tr><th>محور</th><th>وضعیت</th></tr></thead>
<tbody><tr><td><strong>زیرفاز فعال</strong></td><td>SEC-1 — بحرانی‌ها (شروع نشده)</td></tr>
<tr><td><strong>کار بعدی</strong></td><td>SEC-1-1 — fail-fast روی secret پیش‌فرض</td></tr>
<tr><td><strong>blocker</strong></td><td>—</td></tr>
</tbody></table>

---

## زیرفازها

### SEC-1 — بحرانی (فوری)

<table dir="rtl">
<thead><tr><th>#</th><th>آیتم</th><th>محل</th><th>شرح</th><th>معیار پذیرش</th><th>وضعیت</th></tr></thead>
<tbody><tr><td>SEC-1-1</td><td>Fail-fast روی JWT secret پیش‌فرض</td><td><code dir="ltr" style="unicode-bidi: embed;">src/server/app.ts</code> · <code dir="ltr" style="unicode-bidi: embed;">src/server/config/authSecrets.ts</code></td><td>در <code dir="ltr" style="unicode-bidi: embed;">env.isProduction</code> اگر secret ها مقدار <code dir="ltr" style="unicode-bidi: embed;">dev_..._change_me</code> باشند فقط warning لاگ می‌شود و سرور بالا می‌آید → هر کسی می‌تواند توکن ادمین جعل کند. در dev هم secret تصادفی در اولین اجرا تولید و در <code dir="ltr" style="unicode-bidi: embed;">settings.json</code> ذخیره شود.</td><td>بوت production با secret پیش‌فرض <code dir="ltr" style="unicode-bidi: embed;">throw</code> می‌کند + تست واحد</td><td>⬜</td></tr>
<tr><td>SEC-1-2</td><td>رمزنگاری Git PAT</td><td><code dir="ltr" style="unicode-bidi: embed;">src/server/services/git/gitCredentialStore.ts</code></td><td>توکن Git به صورت متن ساده در <code dir="ltr" style="unicode-bidi: embed;">.appendo-git-credentials.json</code> (ریشهٔ repo) ذخیره و وارد <code dir="ltr" style="unicode-bidi: embed;">git credential approve</code> می‌شود.</td><td>ذخیرهٔ AES-256-GCM با کلید مشتق از secret پلتفرم + migration خواندن فایل قدیمی + افزودن نام فایل به denied patterns فایل‌منیجر</td><td>⬜</td></tr>
<tr><td>SEC-1-3</td><td>حذف interpolation در raw SQL</td><td><code dir="ltr" style="unicode-bidi: embed;">src/server/domain/users/userRepository.ts:468</code> · <code dir="ltr" style="unicode-bidi: embed;">src/server/db/controlPlaneSeed.ts</code></td><td><code dir="ltr" style="unicode-bidi: embed;">$executeRawUnsafe</code> با interpolation مستقیم <code dir="ltr" style="unicode-bidi: embed;">input.username</code>/<code dir="ltr" style="unicode-bidi: embed;">email</code>/<code dir="ltr" style="unicode-bidi: embed;">passwordHash</code> و escape دست‌ساز (فقط <code dir="ltr" style="unicode-bidi: embed;">'</code> → <code dir="ltr" style="unicode-bidi: embed;">''</code>).</td><td>مهاجرت به <code dir="ltr" style="unicode-bidi: embed;">$executeRaw</code> پارامتری / <code dir="ltr" style="unicode-bidi: embed;">Prisma.sql</code>؛ فقط <code dir="ltr" style="unicode-bidi: embed;">SET IDENTITY_INSERT</code> ثابت raw بماند + تست injection</td><td>⬜</td></tr>
<tr><td>SEC-1-4</td><td>حذف پسوردهای seed ثابت</td><td><code dir="ltr" style="unicode-bidi: embed;">src/server/db/controlPlaneSeed.ts:322</code></td><td>کاربران seed با پسوردهای <code dir="ltr" style="unicode-bidi: embed;">admin123</code> و <code dir="ltr" style="unicode-bidi: embed;">user12345</code> — روی محیط واقعی backdoor است.</td><td>پسورد ادمین اولیه تصادفی + نمایش یک‌باره در نصب + فلگ «تغییر اجباری در اولین ورود» · کاربر demo فقط پشت فلگ dev</td><td>⬜</td></tr>
</tbody></table>

### SEC-2 — پرخطر

<table dir="rtl">
<thead><tr><th>#</th><th>آیتم</th><th>محل</th><th>شرح</th><th>معیار پذیرش</th><th>وضعیت</th></tr></thead>
<tbody><tr><td>SEC-2-1</td><td>Rate limit بر اساس IP برای مسیرهای بدون auth</td><td><code dir="ltr" style="unicode-bidi: embed;">src/server/middleware/rateLimit.ts</code></td><td>limiter فعلی درخواست‌های بدون <code dir="ltr" style="unicode-bidi: embed;">userId</code> را کلاً رد نمی‌کند → login/register/recovery بدون محدودیت نرخ IP-محور.</td><td>شاخهٔ fallback بر اساس <code dir="ltr" style="unicode-bidi: embed;">req.ip</code> (با <code dir="ltr" style="unicode-bidi: embed;">trust proxy</code>) + سقف پایین (۱۰/دقیقه) روی مسیرهای auth + تست</td><td>⬜</td></tr>
<tr><td>SEC-2-2</td><td>Allowlist در File Manager</td><td><code dir="ltr" style="unicode-bidi: embed;">src/server/domain/file-manager/pathScope.ts</code></td><td>رویکرد blacklist روی کل <code dir="ltr" style="unicode-bidi: embed;">process.cwd()</code>؛ الگوها <code dir="ltr" style="unicode-bidi: embed;">settings.install.json</code>، <code dir="ltr" style="unicode-bidi: embed;">settings.json.install-backup</code>، <code dir="ltr" style="unicode-bidi: embed;">cookies.txt</code>، <code dir="ltr" style="unicode-bidi: embed;">logs/</code>، فایل‌های <code dir="ltr" style="unicode-bidi: embed;">*.db</code> را پوشش نمی‌دهند.</td><td>تبدیل به allowlist (<code dir="ltr" style="unicode-bidi: embed;">workspace/</code>, <code dir="ltr" style="unicode-bidi: embed;">public/</code>, مسیرهای صریح) یا تکمیل blacklist + تست پوشش برای همهٔ فایل‌های حساس ریشه</td><td>⬜</td></tr>
<tr><td>SEC-2-3</td><td>هدرهای امنیتی HTTP</td><td><code dir="ltr" style="unicode-bidi: embed;">src/server/app.ts</code></td><td>نه CSP، نه <code dir="ltr" style="unicode-bidi: embed;">X-Frame-Options</code>، نه <code dir="ltr" style="unicode-bidi: embed;">X-Content-Type-Options</code>، نه HSTS — با محتوای user-generated (SVG آپلودی، کامپوننت‌ها) ریسک XSS/clickjacking واقعی است.</td><td>افزودن <code dir="ltr" style="unicode-bidi: embed;">helmet</code> + CSP سخت‌گیرانه/<code dir="ltr" style="unicode-bidi: embed;">sandbox</code> روی مسیر سرو فایل‌های آپلودی + تست هدرها</td><td>⬜</td></tr>
</tbody></table>

### SEC-3 — متوسط / کم

<table dir="rtl">
<thead><tr><th>#</th><th>آیتم</th><th>محل</th><th>شرح</th><th>معیار پذیرش</th><th>وضعیت</th></tr></thead>
<tbody><tr><td>SEC-3-1</td><td>محافظت CSRF صریح</td><td><code dir="ltr" style="unicode-bidi: embed;">src/server/middleware/auth.middleware.ts</code></td><td>تکیهٔ صرف به <code dir="ltr" style="unicode-bidi: embed;">sameSite: 'lax'</code>؛ عملیات حساس توکن CSRF ندارند.</td><td>double-submit cookie یا هدر custom اجباری برای عملیات حساس · <code dir="ltr" style="unicode-bidi: embed;">sameSite: 'strict'</code> برای refresh cookie</td><td>⬜</td></tr>
<tr><td>SEC-3-2</td><td>Bind پیش‌فرض <code dir="ltr" style="unicode-bidi: embed;">127.0.0.1</code> در dev</td><td><code dir="ltr" style="unicode-bidi: embed;">src/server/app.ts:175</code></td><td>bind همیشگی روی <code dir="ltr" style="unicode-bidi: embed;">0.0.0.0</code> → پنل ادمین در شبکهٔ محلی expose می‌شود.</td><td>host قابل تنظیم · پیش‌فرض dev = <code dir="ltr" style="unicode-bidi: embed;">127.0.0.1</code> · <code dir="ltr" style="unicode-bidi: embed;">0.0.0.0</code> فقط با تنظیم صریح</td><td>⬜</td></tr>
<tr><td>SEC-3-3</td><td>اعتبارسنجی <code dir="ltr" style="unicode-bidi: embed;">x-request-id</code></td><td><code dir="ltr" style="unicode-bidi: embed;">src/server/app.ts:47-52</code></td><td>echo بدون validation → log injection.</td><td>محدودیت فرمت <code dir="ltr" style="unicode-bidi: embed;">/^[A-Za-z0-9_-]{1,64}$/</code> وگرنه UUID جدید · <strong>اجرا داخل <a href="p-96-native-dev-platform.md">p-96 PDK-1</a></strong></td><td>✅ (۲۰۲۶-۰۸-۲۵ — <code dir="ltr" style="unicode-bidi: embed;">src/server/requestId.ts</code> پیدا شد؛ PDK-1 در p-96 بسته شد)</td></tr>
<tr><td>SEC-3-4</td><td>Audit + time-box برای <code dir="ltr" style="unicode-bidi: embed;">fn-auth-loginas</code></td><td><code dir="ltr" style="unicode-bidi: embed;">src/shared/api/contracts/server-functions/initialFunctions.ts:82-124</code></td><td>server function توکار <code dir="ltr" style="unicode-bidi: embed;">POST /api/auth/loginas/:id</code> (فقط <code dir="ltr" style="unicode-bidi: embed;">ADMIN</code>) یک سشن کامل برای کاربر هدف صادر می‌کند — بدون audit log و بدون time-box. <strong>۲۰۲۶-۰۸-۲۶: PDK-7 در <a href="p-96-native-dev-platform.md">p-96</a> ساخته و تأیید شد</strong> — مکانیزم امن جایگزین (grant موقت in-memory، سقف ۶۰ دقیقه، audit اجباری با <code dir="ltr" style="unicode-bidi: embed;">IMPERSONATE_START</code>/<code dir="ltr" style="unicode-bidi: embed;">IMPERSONATE_END</code>، بدون عوض‌کردن سشن) الان موجوده. <code dir="ltr" style="unicode-bidi: embed;">fn-auth-loginas</code> دست‌نخورده باقی مونده — تصمیم حذف/محدودسازیش رو این آیتم پوشش می‌ده.</td><td>تصمیم: <code dir="ltr" style="unicode-bidi: embed;">fn-auth-loginas</code> حذف شود یا فقط پشت یه فلگ dev محدود بمونه، چون PDK-7 جایگزین امن‌ترش الان در دسترسه؛ اگر نگه داشته شد حداقل audit log اضافه شود</td><td>⬜</td></tr>
</tbody></table>

---

## ترتیب اجرا

```
SEC-1-1 (یک‌روزه · بیشترین ریسک) → SEC-1-4 → SEC-2-1
SEC-1-2 · SEC-1-3 (موازی)
SEC-2-2 · SEC-2-3
SEC-3-* (تدریجی)
```

---

## لاگ

<table dir="rtl">
<thead><tr><th>تاریخ</th><th>خلاصه</th></tr></thead>
<tbody><tr><td>۲۰۲۶-۰۸-۲۵</td><td><strong>بررسی p-96</strong> — SEC-3-3 بسته شد (PDK-1 در p-96 از قبل پیاده بود). SEC-3-4 اضافه شد: <code dir="ltr" style="unicode-bidi: embed;">fn-auth-loginas</code> بدون audit/time-box، مستقل از زمان‌بندی PDK-7</td></tr>
<tr><td>۲۰۲۶-۰۸-۲۶</td><td><strong>PDK-7 در p-96 ساخته شد</strong> — SEC-3-4 به‌روز شد: جایگزین امن (grant موقت + audit اجباری) الان موجوده؛ تصمیم باقی‌مانده فقط دربارهٔ حذف/محدودسازی <code dir="ltr" style="unicode-bidi: embed;">fn-auth-loginas</code> قدیمیه</td></tr>
<tr><td>۲۰۲۶-۰۸-۲۶</td><td><strong>p-96 موکول شد</strong> — موج A/B (PDK-1..9) تمام؛ p-96 از <code dir="ltr" style="unicode-bidi: embed;">todo/</code> به <code dir="ltr" style="unicode-bidi: embed;">next/</code> منتقل شد (همین پوشه). SEC-3-3/SEC-3-4 بالا دست‌نخورده مانند؛ فقط مسیر لینک‌ها به‌روز شد</td></tr>
<tr><td>۲۰۲۶-۰۸-۲۵</td><td><strong>برنامه / گیت‌ها</strong> — p-96 ستون کارخانه؛ گیت ۰ = p-52 + SEC-1؛ SEC-3-3 فیوز PDK-1؛ خواهر بعد از موج C = p-43 / مرز Package. PDK-1…12 عوض نشد</td></tr>
<tr><td>۲۰۲۶-۰۷-۱۸</td><td><strong>ایجاد سند</strong> — از ممیزی امنیتی/پرفورمنسی · یافته‌های پرفورمنسی همان روز مستقیماً اعمال شدند (خارج از این پلن)</td></tr>
</tbody></table>

---

*کنترل مرکزی — AppEndO*


</div>
