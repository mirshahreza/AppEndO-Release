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

<p><strong>خلاصه برای operatore:</strong> این سند جزو <strong>plans</strong> است (p-75-unified-runtime-engine). ستون وضعیت در <a href="./p-00-next-index.md">index مربوطه</a> مرجع «شروع شده / design / تمام» است.</p>
<p><strong>راهنمای خواندن:</strong> بخش‌های انگلیسی برای agent/dev هستند؛ جداول وضعیت و یادداشت‌های فارسی را اول بخوانید.</p>


# p-75 — Unified Runtime Engine (بدون Build-Time · «core» فقط یک فلگ)

> **فاز:** URE · **⏸️ Deferred — پیش‌نویس/آرشیو تحقیق، فعال نیست**
> **وضعیت:** ⬜ **DEFERRED** — کنترل: [p-00-next-index.md](p-00-next-index.md)  
> **آخرین به‌روزرسانی:** ۲۰۲۶-۰۷-۳۰  
> **استانداردها:** `AGENTS.md` · `.specify/memory/constitution.md` (DB-04…DB-07) · `docs/appendoo/dynamic-code-surfaces-reference.md` · `docs/appendoo/reality-audit.md` §11
>
> ⚠️ **تصمیم نهایی کاربر (۲۰۲۶-۰۷-۳۰):** بعد از تصویب اولیهٔ گزینهٔ X3 (پایین)، بررسی مزیت/هزینهٔ دقیق‌تر نشون داد نیاز واقعی پشت این پلن (packaging + workflow hooks روی رویدادهای core) با یک scope خیلی کوچک‌تر حل می‌شه — بدون هزینهٔ از دست دادن type-safety، کارایی مسیر auth/login، ابزار build-time، و مرز امنیتی ساختاری core که این پلن تحمیل می‌کرد. **این سند به `next/` برگشت — deferred، نه رد‌شده.** اگر یک روز context دیگری (نه فقط packaging/workflow) این چشم‌انداز رو موجه کرد، تحقیقش این‌جا حاضره. کارِ واقعی که انجام شد: `p-73` § Scope IN #13/#14 (SEA-9.1/9.2) و `p-60` WFV2-23.

---

## این پلن بخشی از یک تاریخچهٔ سه‌مرحله‌ای بود

سند اولیهٔ این ابتکار در `next/` به‌عنوان پیش‌نویس بررسی نوشته شد؛ محتوایش موقتاً داخل `p-73` ادغام شد؛ سپس به فایل مستقل خودش با فازبندی URE-0…8 منتقل شد و **فعال** اعلام شد؛ و در همون روز، بعد از یک بررسی هزینه/فایده صریح‌تر، **دوباره به `next/` برگشت** — چون نیاز واقعی (packaging + workflow hooks) بدون این پلن قابل حل بود.

<table dir="rtl">
<thead><tr><th>پلن</th><th>موضوع</th><th>وضعیت فعلی</th></tr></thead>
<tbody><tr><td><strong>p-73 Data API</strong></td><td>Data API از روی مدل (Sequelize) + SEA-9 (package portability + hooks)</td><td><strong>shipped</strong> — راه‌حل واقعی packaging/hooks</td></tr>
<tr><td><a href="p-76-control-plane-prisma-migration.md"><strong>p-76</strong></a></td><td>حذف کامل Prisma، شامل <code dir="ltr" style="unicode-bidi: embed;">base_*</code></td><td><strong>Deferred</strong> — همراه همین تصمیم</td></tr>
<tr><td><strong>p-75 (همین سند)</strong></td><td>یک موتور اجرای سرور/کلاینت برای همه‌چیز غیر-utility</td><td><strong>Deferred</strong></td></tr>
</tbody></table>

این سند و `p-76` **دیگر پیرو مستقیم p-73 نیستند** — فقط آرشیو تحقیق برای یک چشم‌انداز بزرگ‌تر که فعلاً لازم نیست.

---

## نحوهٔ استفاده (برای تو)

**این سند `deferred` است — «برو جلو» روش اجرا نکن.** SEA-9 و workflow definition export/import shipped هستند. اگر کاربر صریحاً خواست این چشم‌انداز بزرگ‌تر دوباره فعال بشه، این سند (URE-0…8 پایین) نقطهٔ شروع آماده‌ست — ولی خودت شروع نکن.

**دستورالعمل Agent (اگر فعال شد):**

1. **بخوان:** این سند کامل — به‌خصوص § «تصمیم فنی مشتق‌شده از X3» و § «فازها» — قبل از هر migration کد core.
2. **محدوده:** فقط یک زیرفاز از چک‌لیست فعال — اولین آیتم `[ ]` — مگر کاربر صریحاً چیز دیگری بگوید.
3. **پیش‌نیاز:** URE-0 قبل از هر migration دیگر. URE-3 (auth/login سرور) فقط بعد از URE-2 و بعد از اینکه p-76 دادهٔ auth را منتقل کرده باشد (CPM-2). URE-6 (compile+cache) قبل از URE-7 (migration واقعی صفحات).
4. **بدون فرض:** تصمیم فنی مشتق‌شده از X3 (§ پایین، سمت سرور/کلاینت) باید صریح در URE-0.1 تأیید یا رد شود — فرض نگیر که پیشنهاد این سند خودکار پذیرفته شده.
5. **تست:** `npm run test:critical` + پوشش تست shadow-mode برای auth/login.
6. **به‌روزرسانی سند:** پایان جلسه — `[ ]` → `[x]` · «کار بعدی» · لاگ.
7. **اتمام:** همه معیارهای خروج → حذف این فایل · drop از `p-00-next-index`.

---

## وضعیت یک‌خطی

<table dir="rtl">
<thead><tr><th>محور</th><th>وضعیت</th></tr></thead>
<tbody><tr><td><strong>زیرفاز فعال</strong></td><td>URE-0 — هنوز شروع نشده</td></tr>
<tr><td><strong>کار بعدی</strong></td><td>URE-0.1 — تصمیم فنی صریح دربارهٔ سطح ایزولاسیون سرور/کلاینت (§ «تصمیم فنی مشتق‌شده از X3»)</td></tr>
<tr><td><strong>blocker</strong></td><td>وابسته به SEA-4…6 در p-73 (باید پایدار باشد)</td></tr>
<tr><td><strong>تخمین</strong></td><td><strong>نامشخص — این پلن هنوز بلاست‌رادیوس دقیق ندارد</strong> (برخلاف p-76). URE-0/URE-4 باید در پایان یک تخمین واقعی تولید کنند</td></tr>
</tbody></table>

---

## کار بعدی (الان)

> **URE-0.1** — لیست دقیق native/require dependency هایی که کد core (auth/login در اولویت) لازم داره؛ تصمیم بگیر که `sandboxWorkerPool` یک allowlist بگیره یا این dependencyها به شکل دیگه در دسترس باشن. این پیش‌نیاز URE-1 است.

---

## چرا این سند نوشته شد

در بررسی «آیا CMS الان قابل‌پکیج‌کردنه؟» (رجوع: [`p-packages-cms.md`](../../packages/done/p-packages-cms.md) § دور نهم/دهم)، این الگو کشف شد:

هفت نوع artifact که CMS (طبق اصل «developer-built» همان پلن) تولید کرده — Edge models، DATA_API، سند Component Designer، `page-modules`، `route-bindings`، گروه ناوبری — همگی **JSON در `workspace/` هستند که فقط در runtime توسط یک سرویس سرور خوانده می‌شوند**؛ هیچ‌کدام کامپایل نمی‌شوند. در مقابل، Package Manager wizard فقط برای «کد کامپایل‌شده که فایل می‌شود» (Server Functions، `ui_components` به‌صورت TSX) ساخته شده. این یعنی **هر پکیجی که طبق شیوهٔ رسمی «developer-built» پلتفرم ساخته شود** (نه فقط CMS) به همین دیوار می‌خورد.

کاربر این را به یک تشخیص عمومی‌تر تعمیم داد: پلتفرم دو زیرساخت موازی دارد — یکی **کامپایل/build-time** (کد core، صفحات `loaderKind: 'core'`)، یکی **runtime/دینامیک** (Designer JSON، DATA_API، Server Functions sandbox) — و همین دوگانگی، نه فقط ریشهٔ مشکل پکیج‌سازی، بلکه یک منبع مداوم اصطکاک در کل پلتفرم است. راه‌حل: **حذف کامل مفهوم build-time** به‌جز فریم‌ورک خودش؛ دقیقاً دو موتور اجرا (سرور + کلاینت) که همه‌چیز — از جمله آنچه امروز «core» است — از همان‌جا رانتایم اجرا شود؛ «core» فقط یک **فلگ** حفاظتی باشد، نه یک مسیر کد جدا. یک لایهٔ بیلد پنهان/transparent در پس‌زمینه (کش‌شده، نه دیده‌شده توسط دولوپر) مجاز است.

**تصمیم نهایی (۲۰۲۶-۰۷-۳۰):** کاربر این چشم‌انداز را تصویب کرد، به‌عنوان گزینهٔ X3 — دقیقاً یک سطح ایزولاسیون، بدون استثنا برای core، حتی auth/login.

---

## اصل: بدون بیلد سراسری، ماده‌سازی/کامپایل تنبل بر اساس تقاضا

هیچ مرحلهٔ «همه‌چیز رو یک‌جا آماده کن» در این پلن وجود ندارد. هر تکه — چه یک API روی سرور، چه یک صفحه/کامپوننت روی کلاینت — فقط وقتی که واقعاً درخواست شود ساخته/کامپایل و کش می‌شود (مثل `EdgeSequelizeFactory.getOrCreate` امروز که per-`dataSourceId` lazy است). ویرایش یک definition، cache همون definition را invalidate می‌کند، نه کل سیستم را — یعنی «تغییر در runtime واقعاً اثر می‌کند» (بدون نیاز به deploy/rebuild)، بدون اینکه یعنی «هر request از صفر تفسیر خام بشود» (که URE-6 دقیقاً برای جلوگیری از آن است).

**تعریف utility در برابر runtime:**

<table dir="rtl">
<thead><tr><th><strong>utility (کامپایل‌شده، بخشی از انجین)</strong></th><th><strong>runtime (دینامیک، از روی definition اجرا می‌شود)</strong></th></tr></thead>
<tbody><tr><td>خودِ کد موتور/executor (<code dir="ltr" style="unicode-bidi: embed;">DataApiExecutor</code>، Sequelize factory، sandbox runner، client renderer)</td><td>هر API handler — چه developer-built چه پلتفرمی (<code dir="ltr" style="unicode-bidi: embed;">base_*</code>)</td></tr>
<tr><td>primitive componentهای بدون concept دامنه‌ای (button، grid، input، layout، icon، modal shell)</td><td>هر page/entity controller — <strong>بدون استثنا برای صفحات core</strong></td></tr>
<tr><td>infrastructure محض (connection pool، cache layer، logger خودِ پلتفرم)</td><td><strong>auth/login flow</strong> — هم UI هم منطق سرور</td></tr>
<tr><td>—</td><td>workflow hooks · business logic هرجایی که باشد</td></tr>
</tbody></table>

---

## وضعیت فعلی — نقشهٔ دقیق (یافته‌های تحقیق، ۲۰۲۶-۰۷-۳۰ — قبل از URE-0 دوباره verify کن)

### پنج سطح اجرای دینامیک موجود — نه دو تا

پلتفرم همین امروز **پنج** سطح جدا دارد، نه دو تا، و هرکدام عمداً یک مدل اعتماد متفاوت دارند (`docs/appendoo/dynamic-code-surfaces-reference.md`):

<table dir="rtl">
<thead><tr><th>#</th><th>سطح</th><th>کجا</th><th>ایزوله‌سازی امروز</th><th>چرا فرق داره</th></tr></thead>
<tbody><tr><td>1</td><td><strong>Server Functions</strong> (SANDBOX_JS)</td><td><code dir="ltr" style="unicode-bidi: embed;">sandboxWorkerPool.ts</code></td><td><code dir="ltr" style="unicode-bidi: embed;">vm</code> واقعی + <code dir="ltr" style="unicode-bidi: embed;">worker_threads</code> + سقف حافظه (۶۴/۱۲۸/۲۵۶MB) + timeout ۱۰۰–۱۵۰۰۰ms، بدون <code dir="ltr" style="unicode-bidi: embed;">require</code></td><td>کد را یک دولوپر تأییدنشده روی همین نصب می‌نویسد</td></tr>
<tr><td>2</td><td><strong>Package API Handlers</strong></td><td><code dir="ltr" style="unicode-bidi: embed;">packageApiRuntime.service.ts</code></td><td><code dir="ltr" style="unicode-bidi: embed;">vm</code> واقعی، main thread، <strong>بدون</strong> سقف حافظه</td><td>فایل واقعی TS از یک zip نصب‌شده — سطح اعتماد بالاتر از #1</td></tr>
<tr><td>3</td><td><strong>Package UI Module Compile</strong></td><td><code dir="ltr" style="unicode-bidi: embed;">packageUiModuleCompile.service.ts</code></td><td>فقط esbuild bundling، بدون sandbox اجرایی</td><td>تنها جایی با دسترسی واقعی به <code dir="ltr" style="unicode-bidi: embed;">node_modules</code> — چون build-time کنترل‌شده است</td></tr>
<tr><td>4</td><td><strong>Workflow corePack Actions</strong></td><td><code dir="ltr" style="unicode-bidi: embed;">actions/corePack/*.ts</code></td><td>رجیستری بسته، <strong>بدون هیچ eval</strong></td><td>طراح فقط Action آماده انتخاب می‌کند — امن‌ترین سطح</td></tr>
<tr><td>5</td><td><strong>Designer Expressions (کلاینت)</strong></td><td>۴ فایل (<code dir="ltr" style="unicode-bidi: embed;">visibilityConditionEngine.ts</code> و…)</td><td><strong>هیچ sandbox‌ای نیست</strong> — <code dir="ltr" style="unicode-bidi: embed;">new Function</code> خام در مرورگر <strong>کاربر نهایی ناشناس</strong></td><td>چون طراح UI نوشته، نه کاربر نهایی — ولی در مرورگر بازدیدکنندهٔ سایت اجرا می‌شود</td></tr>
</tbody></table>

### `DataApiExecutor` — عمومی نیست، فقط CRUD/routine

`src/server/services/data-api/dataApiExecutor.ts` یک enum بسته از عملیات دارد: `list | getOne | create | update | patch | delete | lookup | routine`. **نمی‌تواند منطق کسب‌وکار دلخواه اجرا کند** — برای آن هنوز SANDBOX_JS لازم است. «موتور سرور» یکپارچه باید حداقل این دو مسیر (DataApiExecutor برای CRUD schema-driven + SANDBOX_JS برای منطق آزاد) را ترکیب کند.

### `loaderKind: 'core'` — وسعت امروز

- `src/app/platform/resolvers.ts`: **۳۱** ورودی `core:*` (۴ لایهٔ شل + ۲۷ صفحهٔ واقعی — Dashboard، Users، Roles، Settings، Data Studio، Workflows، …)
- در نمونهٔ dev: از ۳۴ ردیف `page-modules` فعال، **۲۹ تا `core`**، فقط **۵ تا `designer`**.
- در مقابل: ۱۷۱ فایل draft در `workspace/designer/drafts/` وجود دارد — بخش زیادی fragment/کامپوننت قابل‌استفادهٔ مجدد است، نه صفحهٔ کامل.

### پیشینهٔ «بیلد پنهان» — دو نمونهٔ واقعی موجود

1. **`sandboxCompileCache.ts`** — کد Server Function با esbuild کامپایل و کش می‌شود؛ فقط وقتی فانکشن ویرایش شود invalidate می‌شود.
2. **`packageUiModuleCompile.service.ts`** — کد UI پکیج نصب‌شده را با esbuild به یک ماژول ESM واقعی مرورگر تبدیل می‌کند.

رندر زندهٔ صفحات Designer (`DesignerDocumentPreview`) **این نیست** — تفسیر مستقیم JSON در هر request است. اگر «موتور کلاینت» یکپارچه بخواهد هم performance صفحات core را حفظ کند هم دینامیک بماند، باید از الگوی #۱/#۲ الهام بگیرد — این دقیقاً URE-6 است.

### Reuse — این پلن از صفر شروع نمی‌شود

- `DataApiExecutor` (p-73) → پایهٔ بخش CRUD «موتور سرور»
- `sandboxWorkerPool` + `sandboxCompileCache` → پایهٔ بخش منطق آزاد «موتور سرور» + الگوی «بیلد پنهان کش‌شده»
- `DesignerDocumentPreview` + پالت ۱۵۰+ آیتمی → پایهٔ «موتور کلاینت» (باید بررسی شود آیا برای UI پیچیدهٔ core مثل صفحهٔ تنظیمات کافی است — URE-5)
- `packageUiModuleCompile.service.ts` → الگوی «کامپایل واقعی + کش» برای رندر کلاینت با کارایی production

---

## تصمیم X1/X2/X3 — چرا X3 انتخاب شد (تاریخچه)

برای رسیدن به «دقیقاً دو موتور»، سه گزینه مطرح بود:

<table dir="rtl">
<thead><tr><th>گزینه</th><th>شرح</th><th>تریدآف</th></tr></thead>
<tbody><tr><td><strong>X1 — دو موتور با trust-tier داخلی</strong></td><td>یک <code dir="ltr" style="unicode-bidi: embed;">ServerEngine</code> که داخلش بر اساس منشأ کد (core-flagged / developer / package) سطح ایزوله‌سازی را انتخاب می‌کند</td><td>نزدیک‌ترین به خواستهٔ کاربر با کمترین ریسک؛ پیچیدگی داخلی موتور بالا می‌رود</td></tr>
<tr><td><strong>X2 — یکپارچگی فقط تا سطح رجیستری/publish، نه اجرا</strong></td><td>فانکشن/کامپوننت core هم مثل developer-built در همان رجیستری ثبت شود، ولی اجرا هنوز می‌تواند native باشد</td><td>ریسک امنیتی کمتر؛ ولی «هیچ فرقی بین core و developer» را صددرصد محقق نمی‌کند</td></tr>
<tr><td><strong>X3 — یکپارچگی کامل بدون tier</strong> ✅ <strong>انتخاب‌شده</strong></td><td>همه از دقیقاً یک مسیر اجرا (یک سطح ایزوله‌سازی) رد شوند</td><td>دقیقاً خواستهٔ کاربر به‌صورت لفظی؛ پرریسک‌ترین — باید یا سخت‌ترین سطح امنیتی را روی core اعمال کرد یا امن‌ترین سطح امروز را به core تعمیم داد</td></tr>
</tbody></table>

توصیهٔ اولیهٔ این سند X1 بود. **کاربر آگاهانه X3 را انتخاب کرد (۲۰۲۶-۰۷-۳۰).** پیامد عملی این انتخاب در بخش بعدی صریح شده — این پلن آن را نادیده نمی‌گیرد.

---

## تصمیم فنی مشتق‌شده از X3 (نیاز به تأیید صریح در URE-0.1)

«دقیقاً یک سطح» دو معنی متفاوت برای سرور و کلاینت دارد که باید جدا تصمیم گرفته شوند:

- **سمت سرور — پیشنهاد:** سطح ۱ (Server Functions sandbox: `worker_threads`+`vm`+memcap+timeout) به‌عنوان تنها سطح اجرای سرور برای هر چیز غیر-utility — یعنی حتی منطق login هم داخل همین worker pool اجرا شود. **پیامد عملی:** sandbox امروز `require` را مسدود می‌کند؛ auth/login به کتابخانه‌های native نیاز دارد (bcrypt, jwt, crypto, session store). قبل از URE-1، باید یک allowlist صریح از capabilityهای مجاز داخل sandbox برای کد core تعریف شود (URE-0) — وگرنه یا login کار نمی‌کند، یا مجبوریم دوباره یک استثنا برای core بسازیم که دقیقاً همان چیزی است که تصمیم رد کرد.
- **سمت کلاینت — پیشنهاد:** سطح ۵ (بدون sandbox اجرایی، مرز امنیتی طبیعی = خودِ مرورگر بازدیدکننده) به‌عنوان تنها سطح رندر کلاینت برای همه (شامل صفحهٔ لاگین) — چون این سطح دربارهٔ محافظت از خودِ کاربر است، نه جداسازی اعتماد بین AppEndO و دولوپر؛ اضافه‌کردن sandbox به این لایه «فقط وزن اضافه می‌کند بدون مرز امنیتی جدید».

**این دو پیشنهاد باید صریح تأیید یا رد شوند در URE-0.1** — این تصمیم فنی است که از تصمیم استراتژیک «یک سطح» مشتق شده، نه خودِ آن تصمیم.

### مسئلهٔ bootstrap (باید حل شود، نه نادیده گرفته شود)

اگر صفحهٔ ورود/auth هم از طریق موتور کلاینت (تفسیر JSON در runtime، مثل امروز Designer) رندر شود: خود بارگذاری آن JSON و اجرای موتور به session/auth نیاز ندارد (چون قبل از ورود اجرا می‌شود) ولی به یک **مسیر بارگذاری اولیهٔ حداقلی و همیشه در دسترس** نیاز دارد که خودش build-time نباشد ولی وابسته به هیچ‌چیز runtime دیگری هم نباشد. این یک مسئلهٔ حل‌شدنی است (بسیاری پلتفرم‌های no-code این را دارند) ولی باید صریح طراحی شود — URE-4.

---

## فازها

### URE-0 — Sandbox Capability Audit (پیش‌نیاز هر migration کد core)

- [ ] **URE-0.1** — تصمیم فنی صریح: آیا سطح ۱ (Server Functions sandbox) برای سرور و سطح ۵ (بدون sandbox، مرز = مرورگر) برای کلاینت به‌عنوان «همون یک سطح» پذیرفته می‌شود؟ (پیشنهاد بالا — نیاز به تأیید صریح دارد)
- [ ] **URE-0.2** — لیست دقیق native/require dependency لازم برای auth/login (bcrypt, jwt, crypto, session store, …)
- [ ] **URE-0.3** — طراحی allowlist یا مکانیزم جایگزین برای دسترسی این dependencyها داخل `sandboxWorkerPool`

### URE-1 — قرارداد «Core Server Routine»

- [ ] **URE-1.1** — گسترش `EdgeApiDefinition`/Server Function contract برای بیان کنترلر دست‌نویس به‌عنوان definition منتشرشده
- [ ] **URE-1.2** — یک کنترلر نمونهٔ کم‌ریسک (نه auth) به این قرارداد منتقل و از `managedFunctionProxy` سرو شود — اثبات مفهوم
- [ ] **URE-1.3** — **تصمیم صریح ACL پکیج روی محتوای `isBase`/core** (کشف‌شده ۲۰۲۶-۰۷-۳۰، حل‌نشده): فلگ `isBase` (در `p-76`) فقط گارد UI در برابر ویرایش تصادفی ادمین است — **نه** مرز access-control در برابر یک پکیج نصب‌شده. حالا که core فقط یک فلگ است نه مسیر کد جدا، باید صریح مشخص شود: آیا یک پکیج می‌تواند definition مربوط به `isBase: true` (مثلاً مدل کاربران، تعریف صفحهٔ لاگین) را بخواند؟ ویرایش کند؟ override کند؟ نصب‌کننده باید تأیید صریح بدهد یا پیش‌فرض ممنوع است؟ این تصمیم باید قبل از URE-2 مکتوب شود، وگرنه مرز اعتماد پکیج‌ها روی حساس‌ترین بخش پلتفرم نامشخص می‌ماند.

### URE-2 — مهاجرت دامنه‌های غیر-auth (سرور)

- [ ] **URE-2.0** — **audit کامل** همهٔ فایل‌های `src/server/routes/*.routes.ts` (نه فقط `users.routes.ts` که نمونه چک شد) — فهرست هر route/controller که امروز مسیر جدا از `managedFunctionProxy` دارد؛ این فهرست پیش‌نیاز واقعی‌بودن ادعای «همهٔ APIها از یک مکانیزم» است
- [ ] **URE-2.1** — از روی audit بالا، ترتیب migration کنترلرهای `base_*` غیرحساس — هماهنگ با CPM-1 در `p-76` (دادهٔ دامنه باید اول/هم‌زمان منتقل شده باشد)
- [ ] **URE-2.2** — مهاجرت یکی‌یکی با rollback مجزا برای هرکدام

### URE-3 — مهاجرت auth/login (سرور، آخرین و بحرانی‌ترین)

> فقط بعد از URE-2 **و** بعد از اینکه `p-76` CPM-2 (دادهٔ auth) موفق شده باشد.

- [ ] **URE-3.1** — rollback plan مکتوب + پوشش تست اضافی روی auth/session
- [ ] **URE-3.2** — دورهٔ shadow-mode (هر دو مسیر فعال، مقایسهٔ نتیجه) قبل از هر cutover
- [ ] **URE-3.3** — cutover واقعی + حذف مسیر قدیمی (`UsersController`/`AuthController` دست‌نویس)

### URE-4 — طراحی Bootstrap کلاینت (پیش‌نیاز صفحات auth-adjacent)

- [ ] **URE-4.1** — طراحی صریح یک loader حداقلی و بدون وابستگی به session/runtime دیگر برای رندر definition صفحهٔ لاگین

### URE-5 — Primitive Catalog Gap Analysis برای auth/login UI

- [ ] **URE-5.1** — بررسی پوشش پالت امروز (فرم، validation، دکمه، خطا، redirect) برای نیاز صفحهٔ لاگین
- [ ] **URE-5.2** — تکمیل primitiveهای کم، بدون concept دامنه‌ای

### URE-6 — الگوی Compile+Cache برای رندر کلاینت

- [ ] **URE-6.1** — گسترش الگوی `sandboxCompileCache`/`packageUiModuleCompile` به رندر Designer — کامپایل یک‌بار + کش، نه تفسیر خام per-request

### URE-7 — مهاجرت تدریجی صفحات core (کلاینت)

- [ ] **URE-7.1** — فهرست کامل ۲۹ صفحهٔ `core:*` + ترتیب migration مکتوب (کم‌ریسک اول، auth-adjacent آخر)
- [ ] **URE-7.2** — مهاجرت صفحات کم‌ریسک، یکی‌یکی با معیار go/no-go
- [ ] **URE-7.3** — مهاجرت صفحات auth-adjacent (هم‌زمان با URE-3)

### URE-8 — Cutover نهایی

- [ ] **URE-8.1** — حذف پیاده‌سازی سخت‌کد React صفحات مهاجرت‌شده
- [ ] **URE-8.2** — `loaderKind: 'core'` رسماً فقط یک فلگ حفاظتی — صفر مسیر کد جدا برای core در مقایسه با developer-built

---

## معیارهای خروج (Exit Criteria)

- [ ] تصمیم فنی X3 (sandbox سرور یکسان + بدون-sandbox کلاینت یکسان) صریح مستند و تأییدشده (URE-0.1)
- [ ] تصمیم ACL پکیج روی محتوای `isBase` مستند و پیاده‌شده — یک پکیج نصب‌شده نمی‌تواند بدون مجوز صریح تعریف auth/core را بخواند یا تغییر دهد (URE-1.3)
- [ ] auth/login از موتور یکپارچهٔ سرور (نه کنترلر دست‌نویس جدا) سرو می‌شود، با shadow-mode قبل از cutover (URE-3)
- [ ] auth/login از موتور رندر یکپارچهٔ کلاینت (Designer definition، نه React سخت‌کد) رندر می‌شود (URE-7.3/8)
- [ ] همهٔ ۲۹ صفحهٔ `core:*` مهاجرت‌شده یا با دلیل مستند استثنا شده‌اند (URE-7)
- [ ] `loaderKind: 'core'` فقط یک فلگ حفاظتی است — صفر مسیر اجرای جدا برای core نسبت به developer-built (URE-8.2)
- [ ] هیچ رگرسیون امنیتی/کارایی روی صفحات حساس (auth/admin) — تست‌های shadow-mode + قبل/بعد سبز
- [ ] `npm run test:critical` سبز

---

## ریسک‌ها (بالاترین ریسک کل مجموعهٔ سه‌پلنه)

<table dir="rtl">
<thead><tr><th>ریسک</th><th>شدت</th><th>کاهش</th></tr></thead>
<tbody><tr><td>ضعیف‌شدن مرز امنیتی auth/login اگر sandbox capability audit (URE-0) ناقص باشد یا رد شود</td><td><strong>بالا</strong></td><td>URE-0 قبل از هر migration کد auth اجباری · shadow-mode در URE-3 قبل از cutover</td></tr>
<tr><td>یک پکیج نصب‌شده به تعریف محتوای <code dir="ltr" style="unicode-bidi: embed;">isBase</code> (لاگین، مدل کاربران، …) دسترسی/تغییر بدهد چون <code dir="ltr" style="unicode-bidi: embed;">isBase</code> مرز ACL نیست، فقط گارد UI</td><td><strong>بالا</strong></td><td>تصمیم صریح ACL پکیج در URE-1.3 — قبل از URE-2 مکتوب شود، نه فرض گرفته شود</td></tr>
<tr><td>کارایی رندر production اگر URE-6 (compile+cache) قبل از URE-7 (migration واقعی) انجام نشود</td><td><strong>بالا</strong> (صفحهٔ login پرترافیک‌ترین صفحهٔ پلتفرم است)</td><td>ترتیب فاز اجباری: URE-6 قبل از URE-7/8</td></tr>
<tr><td>Bootstrap صفحات pre-auth بدون طراحی صریح</td><td><strong>بالا</strong></td><td>URE-4 قبل از هر migration صفحهٔ auth-adjacent</td></tr>
<tr><td>هماهنگی نادرست با p-76 — migrate شدن اجرای یک دامنه قبل از دادهٔ همان دامنه</td><td><strong>بالا</strong></td><td>چک صریح قبل از URE-2/URE-3؛ § «این پلن بخشی از یک مجموعهٔ سه‌تایی است»</td></tr>
<tr><td>هیچ تخمین زمانی واقعی برای این پلن وجود ندارد (برخلاف p-76 که بلاست‌رادیوس دقیق دارد)</td><td>متوسط (ریسک برنامه‌ریزی)</td><td>URE-0/URE-4 باید در پایان یک تخمین واقعی تولید کنند</td></tr>
<tr><td>Scope creep — تبدیل به بازنویسی کامل ۲۹ صفحه بدون معیار توقف</td><td>متوسط</td><td>معیار go/no-go صریح بعد از هر صفحه در URE-7</td></tr>
</tbody></table>

---

## وابستگی و ترتیب

```
p-73 SEA-4…6 پایدار (پیش‌نیاز)
    │
    └── p-75 (همین سند)
            │
            ├── URE-0 sandbox capability audit → تصمیم فنی X3 مستند
            ├── URE-1 قرارداد Core Server Routine + یک اثبات مفهوم + تصمیم ACL پکیج
            ├── URE-2 مهاجرت دامنه‌های غیر-auth سرور (هماهنگ با p-76 CPM-1)
            ├── URE-4 bootstrap کلاینت + URE-5 primitive gap (می‌توانند موازی با URE-0…2 پیش بروند)
            ├── URE-6 compile+cache کلاینت (قبل از URE-7)
            ├── URE-7 مهاجرت تدریجی صفحات core (auth-adjacent هم‌زمان با URE-3)
            ├── URE-3 auth/login سرور (فقط بعد از URE-2 و بعد از p-76 CPM-2)
            └── URE-8 cutover نهایی (بعد از همهٔ موارد بالا)
```

موازی با todo: p-52 · p-60 — بدون blocker سخت.

---

## سؤالات باز — قبل از URE-1 باید پاسخ داده شوند

1. ~~کدام گزینه برای «دو موتور» (X1/X2/X3)؟~~ — **پاسخ داده شد: X3.**
2. تصمیم فنی مشتق‌شده از X3 (§ بالا) — تأیید یا رد؟ (URE-0.1)
3. تصمیم ACL پکیج روی محتوای `isBase` (URE-1.3) — چه سیاستی؟

---

## لاگ

<table dir="rtl">
<thead><tr><th>تاریخ</th><th>رویداد</th></tr></thead>
<tbody><tr><td>۲۰۲۶-۰۷-۳۰ (نهایی)</td><td><strong>Deferred — برگشت به <code dir="ltr" style="unicode-bidi: embed;">next/</code></strong> — بعد از فعال‌سازی با فازبندی URE-0…8، کاربر پرسید چه سطحی از پیاده‌سازی packaging و workflow-hooks رو حل می‌کنه بدون هزینه‌هایی که این پلن تحمیل می‌کرد (perf مسیر auth/login، از دست رفتن type-safety، تضعیف مرز امنیتی ساختاری core، از دست رفتن ابزار build-time). نتیجه: نیاز واقعی خیلی کوچیک‌تر از این پلن بود — یک capability در Package Manager (<code dir="ltr" style="unicode-bidi: embed;">p-73</code> SEA-9.1) و چند فراخوانی هدفمند hook (<code dir="ltr" style="unicode-bidi: embed;">p-73</code> SEA-9.2) کافی بود. این سند به <code dir="ltr" style="unicode-bidi: embed;">next/</code> برگشت، deferred نه رد‌شده — تحقیقش برای یک context آینده که واقعاً این چشم‌انداز بزرگ رو موجه کنه، حفظ شد. <strong>هیچ کدی تغییر نکرد.</strong></td></tr>
<tr><td>۲۰۲۶-۰۷-۳۰</td><td><strong>بازفعال‌سازی مستقل — تجدید ساختار سه‌پلنه</strong> — این سند از <code dir="ltr" style="unicode-bidi: embed;">next/</code> (پیش‌نویس بررسی) خارج شد، موقتاً محتوایش داخل <code dir="ltr" style="unicode-bidi: embed;">p-73</code> ادغام شده بود، و امروز دوباره فایل مستقل خودش شد (<code dir="ltr" style="unicode-bidi: embed;">next/</code> → <code dir="ltr" style="unicode-bidi: embed;">todo/</code>) — این‌بار به‌عنوان پلن فعال با فازبندی URE-0…8 (نه X0…X5 پیش‌نویس قبلی). دلیل: کاربر خواست فایل‌بندی سه موضوع (Data API/حذف Prisma/یکپارچگی موتور) منسجم و هرکدام به‌اندازهٔ یک جلسهٔ کاری قابل‌مدیریت باشد. § «تصمیم X1/X2/X3» و بلاست‌رادیوس ۵ سطح اجرا/۲۹ صفحهٔ core بدون تغییر از تحقیق قبلی حفظ شد. یک آیتم جدید (URE-1.3 — ACL پکیج روی محتوای <code dir="ltr" style="unicode-bidi: embed;">isBase</code>) از یک سؤال کاربر دربارهٔ پیامد این پلن روی packaging/Workflow کشف و اضافه شد؛ همان تحقیق نشان داد <code dir="ltr" style="unicode-bidi: embed;">WorkflowDefinition</code> و ۱۵ مدل مرتبط خودشان روی Prisma‌اند (نه JSON آزاد) — به <code dir="ltr" style="unicode-bidi: embed;">p-76</code> منتقل شد. <strong>هیچ کدی تغییر نکرد.</strong></td></tr>
<tr><td>۲۰۲۶-۰۷-۳۰ (قبلی)</td><td><strong>ابتکار D تصویب و منتقل شد</strong> — به <code dir="ltr" style="unicode-bidi: embed;">p-73</code>/بعداً <code dir="ltr" style="unicode-bidi: embed;">p-76</code> منتقل شد.</td></tr>
<tr><td>۲۰۲۶-۰۷-۳۰ (اولیه)</td><td><strong>ایجاد سند</strong> — از بررسی پکیج‌سازی CMS به یک تشخیص عمومی‌تر رسید؛ تحقیق بلاست‌رادیوس Prisma + نقشهٔ ۵ سطح اجرای دینامیک موجود انجام شد؛ سند به‌عنوان <strong>پیش‌نویس بررسی</strong> در <code dir="ltr" style="unicode-bidi: embed;">next/</code> ایجاد شد.</td></tr>
</tbody></table>

---

*Unified Runtime Engine — یک موتور سرور، یک موتور کلاینت، برای همه‌چیز غیر-utility*


</div>
