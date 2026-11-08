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

<p><strong>خلاصه برای operatore:</strong> یک <strong>اسکیل واحد</strong> (<code dir="ltr">@appendo-release-cut</code>) روی <code dir="ltr">main</code> خصوصی؛ سپس خروجی عمومی فقط داخل ریپوی جدا <strong><code dir="ltr">AppEndO-Release</code></strong> (public) — نه زیرپوشه <code dir="ltr">releases/</code> در monorepo. staging موقت: <code dir="ltr">.appendo-release-staging/vX.Y.Z/</code> — فقط cms + remote-hubs + سورس بدون هویتی + <code dir="ltr">dist</code>. همه لوکال، بدون GitHub Actions.</p>
<p><strong>راهنمای خواندن:</strong> §۰ تصمیم‌های قفل‌شده · §۱ جریان operatore · §۲ فازهای پیاده‌سازی (RCUT) · §۳ تست پذیرش · §۴ پرامپت agent.</p>

# p-130 — Local release cut (اسکیل + orchestrator لوکال)

> **وضعیت:** 🟡 RCUT-0..6 + export/push — مدل <strong>AppEndO-Release</strong> جایگزین <code dir="ltr">releases/public/</code> شد (پلن + اسکریپت)؛ push به clone عمومی با <code dir="ltr">release:push-appendo-release</code>  
> **ورود operatore:** <code dir="ltr">@appendo-release-cut</code> یا <code dir="ltr">npm run release:cut</code> (پس از پیاده‌سازی)  
> **ایندکس:** <a href="p-00-todo-index.md">p-00-todo-index.md</a>  
> **GitHub Actions:** عمداً <strong>غیرفعال</strong> بماند — <code dir="ltr">.github/workflows/ci.yml</code> بدون trigger روی push/tag

---

## §۰ — تصمیم‌های قفل (محصول)

<table dir="rtl">
<thead><tr><th>#</th><th>تصمیم</th><th>توضیح</th></tr></thead>
<tbody>
<tr><td>1</td><td>توسعهٔ روزانه</td><td>همه‌چیز روی <code dir="ltr">main</code> ترکیبی (پلتفرم + هر پکیج در درخت)؛ بدون branch جدا برای ریلیز.</td></tr>
<tr><td>2</td><td>تریگر انتشار</td><td>فقط وقتی operatore اسکیل را صدا می‌زند — <strong>نه</strong> روی هر کامیت؛ ۵۰ کامیت در روز بی‌اثر است.</td></tr>
<tr><td>3</td><td>هزینه</td><td>هیچ workflow ابری GitHub برای release-cut فعال نشود؛ push اختیاری و رایگان است؛ runner = ماشین operatore.</td></tr>
<tr><td>4</td><td>ریلیز عمومی (OSS)</td><td>اسنپ‌شات/آرتیفکت شامل پلتفرم + <strong>فقط</strong> پکیج‌های <code dir="ltr">cms</code> و <code dir="ltr">remote-hubs</code> — بدون ZIP هویتی و بدون seed/route پیش‌فرض هویتی در باندل عمومی.</td></tr>
<tr><td>5</td><td>پکیج‌های خصوصی/عمودی</td><td>در همان run: pack + verify + تست برای لیست قابل تنظیم (پیش‌فرض <code dir="ltr">hawiety</code>؛ بعداً <code dir="ltr">crm</code> و … از registry).</td></tr>
<tr><td>6</td><td>ورژن</td><td>operatore دستی ورژن نمی‌زند؛ orchestrator semver (پیش‌فرض patch)؛ override: <code dir="ltr">--bump minor|major</code>.</td></tr>
<tr><td>7</td><td>تگ git</td><td>پس از commit ورژن (در صورت تغییر فایل‌ها): <code dir="ltr">release/vX.Y.Z</code> روی همان SHA — نشانگر لوکال + اختیاری push.</td></tr>
<tr><td>8</td><td>خود-ترمیمی</td><td>فقط repairهای <strong>whitelist</strong> (جدول §۲.۵) + یک retry per phase؛ شکست نهایی = بدون publish آرتیفکت عمومی و حذف تگ لوکال اگر commit انتشار push نشده.</td></tr>
<tr><td>9</td><td>ریپوی عمومی</td><td><strong><code dir="ltr">AppEndO-Release</code></strong> — ریپوی git public جدا؛ <strong>ممنوع</strong>: <code dir="ltr">releases/public/</code> داخل AppEndO خصوصی. staging: <code dir="ltr">.appendo-release-staging/</code> (gitignore).</td></tr>
<tr><td>10</td><td>فورک</td><td>فورک GitHub از کل monorepo خصوصی <strong>نه</strong> — push فیلترشده از staging به <code dir="ltr">AppEndO-Release</code> (بدون تاریخ هویتی).</td></tr>
</tbody>
</table>

---

## §۱ — جریان operatore (یک خط)

<p>کار معمول (commit / sync) → یک بار <code dir="ltr">@appendo-release-cut</code> → orchestrator لوکال همه فازها → خروجی در <code dir="ltr">dist/release-cut/&lt;runId&gt;/</code> + گزارش متنی.</p>

<table dir="rtl">
<thead><tr><th>فاز</th><th>کار</th><th>خروجی</th></tr></thead>
<tbody>
<tr><td>RCUT-P0</td><td>پیش‌شرط: branch <code dir="ltr">main</code>، working tree تمیز (یا <code dir="ltr">--allow-dirty</code> با هشدار)، <code dir="ltr">git fetch</code> اختیاری</td><td>runId + SHA</td></tr>
<tr><td>RCUT-P1</td><td>محاسبه ورژن؛ به‌روزرسانی منابع حقیقت (§۲.۲)</td><td>bump plan</td></tr>
<tr><td>RCUT-P2</td><td><code dir="ltr">chore(release): prepare …</code> یک commit (فقط ورژن‌ها + manifest slice)</td><td>commit SHA</td></tr>
<tr><td>RCUT-P3</td><td>تگ <code dir="ltr">release/vX.Y.Z</code></td><td>tag ref</td></tr>
<tr><td>RCUT-P4</td><td>Pack پکیج‌های publish (registry)</td><td>ZIPها + verify log</td></tr>
<tr><td>RCUT-P5</td><td>تست‌های سنگین (§۳)</td><td>vitest/junit log</td></tr>
<tr><td>RCUT-P6</td><td>بیلد پلتفرم + gate ریلیز لاغر (§۲.4)</td><td><code dir="ltr">platform/</code> در آرتیفکت</td></tr>
<tr><td>RCUT-P7</td><td>Export به staging + gate OSS + checksum + MANIFEST (§۲.۸)</td><td><code dir="ltr">.appendo-release-staging/vX.Y.Z/</code></td></tr>
<tr><td>RCUT-P8</td><td>خلاصه operatore؛ push خصوصی اختیاری (<code dir="ltr">--push</code>)؛ push <strong>AppEndO-Release</strong> (<code dir="ltr">release:push-appendo-release</code> یا فلگ آینده)</td><td>تگ <code dir="ltr">vX.Y.Z</code> روی ریپوی public</td></tr>
</tbody>
</table>

---

## §۲ — جزئیات اجرایی (برای agent)

### §۲.۱ — تحویل‌ها

<table dir="rtl">
<thead><tr><th>آیتم</th><th>مسیر / نام</th></tr></thead>
<tbody>
<tr><td>Orchestrator</td><td><code dir="ltr">scripts/release-cut/run-release-cut.ts</code></td></tr>
<tr><td>Registry پکیج publish</td><td><code dir="ltr">scripts/release-cut/releaseCutPackageRegistry.ts</code></td></tr>
<tr><td>Gate OSS</td><td><code dir="ltr">scripts/release-cut/assertPublicOssReleaseScope.ts</code></td></tr>
<tr><td>npm</td><td><code dir="ltr">release:cut</code> · <code dir="ltr">release:cut:dry-run</code> · <code dir="ltr">release:cut:resume</code></td></tr>
<tr><td>Skill</td><td><code dir="ltr">.claude/skills/appendo-release-cut/SKILL.md</code> + رجیستر در <code dir="ltr">SKILLS-CATALOG.md</code></td></tr>
<tr><td>Checkpoint</td><td><code dir="ltr">dist/release-cut/&lt;runId&gt;/checkpoint.json</code></td></tr>
<tr><td>گزارش</td><td><code dir="ltr">dist/release-cut/&lt;runId&gt;/REPORT.md</code></td></tr>
<tr><td>Staging عمومی</td><td><code dir="ltr">.appendo-release-staging/vX.Y.Z/</code></td></tr>
<tr><td>Export</td><td><code dir="ltr">npm run release:export-appendo-release</code> · <code dir="ltr">assemblePublicReleaseTree.ts</code></td></tr>
<tr><td>Push عمومی</td><td><code dir="ltr">npm run release:push-appendo-release</code> · clone <code dir="ltr">../AppEndO-Release</code> یا <code dir="ltr">APPENDO_RELEASE_REPO_PATH</code></td></tr>
<tr><td>نام ریپو</td><td><strong>AppEndO-Release</strong> (ثابت — <code dir="ltr">appendoReleaseRepo.ts</code>)</td></tr>
</tbody>
</table>

### §۲.۸ — AppEndO-Release (ریپوی public / «فورک ریلیز»)

<p><strong>منسوخ:</strong> پوشه <code dir="ltr">releases/public/</code> داخل ریپوی خصوصی — حذف از gitignore و اسناد؛ اگر روی دیسک مانده، فقط آرشیو لوکال است.</p>

<table dir="rtl">
<thead><tr><th>گام</th><th>operatore / agent</th><th>خروجی</th></tr></thead>
<tbody>
<tr><td>۱</td><td><code dir="ltr">main</code> خصوصی + <code dir="ltr">release:cut</code> (اختیاری tag <code dir="ltr">release/vX.Y.Z</code> روی خصوصی)</td><td>ZIP هویتی داخلی؛ ورژن‌ها bump</td></tr>
<tr><td>۲</td><td><code dir="ltr">npm run build</code></td><td><code dir="ltr">dist/server.cjs</code></td></tr>
<tr><td>۳</td><td><code dir="ltr">npm run release:export-appendo-release</code></td><td><code dir="ltr">.appendo-release-staging/vX.Y.Z/</code> — <code dir="ltr">source/</code> بدون hwy، <code dir="ltr">dist/</code>، <code dir="ltr">packages/</code> (cms + remote-hubs)، MANIFEST</td></tr>
<tr><td>۴</td><td>یک‌بار: <code dir="ltr">git clone &lt;public-url&gt; ../AppEndO-Release</code></td><td>ریپوی public خالی/موجود</td></tr>
<tr><td>۵</td><td><code dir="ltr">npm run release:push-appendo-release</code></td><td>commit + tag <code dir="ltr">vX.Y.Z</code> روی <strong>AppEndO-Release</strong> + <code dir="ltr">git push</code></td></tr>
</tbody>
</table>

<p>ریشهٔ <strong>AppEndO-Release</strong> بعد از push = کل محتوای staging (شامل <code dir="ltr">source/</code>، <code dir="ltr">dist/</code>، <code dir="ltr">packages/</code>، ZIPها، MANIFEST). اپراتور می‌تواند بعداً layout را به «ریشه = source» تغییر دهد — خارج از v0.0.1.</p>

### §۲.۲ — منابع حقیقت ورژن (یکپارچه‌سازی در RCUT-1)

<table dir="rtl">
<thead><tr><th>ورژن</th><th>امروز در کد</th><th>بعد از RCUT-1</th></tr></thead>
<tbody>
<tr><td>پلتفرم / اپ</td><td><code dir="ltr">package.json</code> <code dir="ltr">0.0.0</code></td><td><code dir="ltr">PLATFORM_VERSION</code> در <code dir="ltr">scripts/release-cut/versionManifest.ts</code> + sync به <code dir="ltr">package.json</code></td></tr>
<tr><td>cms</td><td><code dir="ltr">scripts/cms-phase1/pack-cms-package.ts</code> ثابت</td><td>همان manifest؛ pack از ثابت export</td></tr>
<tr><td>remote-hubs</td><td><code dir="ltr">src/core/packages/remoteHubsPackage.ts</code></td><td>manifest</td></tr>
<tr><td>hawiety</td><td><code dir="ltr">src/core/packages/hawietyPackage.ts</code></td><td>manifest</td></tr>
</tbody>
</table>

<p>قانون bump: <code dir="ltr">platform</code> و هر <code dir="ltr">packageId</code> در لیست <code dir="ltr">--publish-packages</code> در همان run یک patch بالا می‌رود مگر <code dir="ltr">--bump</code> یا per-package override در registry.</p>

### §۲.۳ — نگاشت pack / تست (موجود — wire نه بازنویسی)

<table dir="rtl">
<thead><tr><th>packageId</th><th>pack</th><th>release pipeline موجود</th></tr></thead>
<tbody>
<tr><td><code dir="ltr">hawiety</code></td><td><code dir="ltr">hawiety:pack</code></td><td><code dir="ltr">hawiety:release</code> (registry + pack + verify + audit + hwy:audit-db-coverage + test:hawiety-package)</td></tr>
<tr><td><code dir="ltr">cms</code></td><td><code dir="ltr">scripts/cms-phase1/pack-cms-package.ts</code> (via reference-build در صورت نیاز)</td><td>verify از packaging tests + <code dir="ltr">package:reference-build</code></td></tr>
<tr><td><code dir="ltr">remote-hubs</code></td><td><code dir="ltr">remote-hubs:pack</code></td><td>verify + install smoke در orchestrator</td></tr>
</tbody>
</table>

<p>پکیج جدید روی <code dir="ltr">main</code>: فقط یک ردیف در <code dir="ltr">releaseCutPackageRegistry.ts</code> — بدون تغییر orchestrator core.</p>

### §۲.۴ — Gate ریلیز لاغر (OSS)

<p>پس از بیلد، assert خودکار (exit non-zero):</p>
<ul>
<li>در درخت staging / <strong>AppEndO-Release</strong> فقط ZIPهای <code dir="ltr">cms-*</code> و <code dir="ltr">remote-hubs-*</code> (+ manifest platform).</li>
<li>نه <code dir="ltr">hawiety-*.zip</code> در خروجی عمومی.</li>
<li>فایل <code dir="ltr">MANIFEST.json</code> در staging: <code dir="ltr">bundledPackageIds: ["cms","remote-hubs"]</code>.</li>
<li>اسکن مسیرهای ممنوع در tree منتشرشده (لیست اولیه): <code dir="ltr">**/hwy-*.zip</code>، seed هویتی در snapshot نصب پیش‌فرض OSS (تعریف در RCUT-2).</li>
</ul>

### §۲.۵ — خود-ترمیمی (whitelist)

<table dir="rtl">
<thead><tr><th>علامت خطا</th><th>اقدام خودکار (حداکثر ۱ بار)</th></tr></thead>
<tbody>
<tr><td><code dir="ltr">ZIP_VERSION_MISMATCH</code> (هویتی)</td><td>دوباره <code dir="ltr">hawiety:pack</code> بعد از sync version manifest</td></tr>
<tr><td><code dir="ltr">hawiety:repair-ui-routes</code> / parity verify</td><td>اجرای <code dir="ltr">npm run hawiety:repair-ui-routes</code> سپس retry verify</td></tr>
<tr><td><code dir="ltr">prisma generate</code> / client stale</td><td><code dir="ltr">npm run prisma:generate</code> + retry فاز بیلد</td></tr>
<tr><td>نصب پکیج محلی شکست</td><td><code dir="ltr">package:purge</code> scoped + retry install smoke (فقط محیط cut، نه DB production operatore)</td></tr>
<tr><td>تست flaky شناخته‌شده</td><td>retry همان vitest job یک بار</td></tr>
<tr><td>غیر از موارد بالا</td><td>توقف؛ گزارش در <code dir="ltr">REPORT.md</code>؛ operatore + agent</td></tr>
</tbody>
</table>

### §۲.۶ — GitHub / هزینه

<ul>
<li><code dir="ltr">.github/workflows/ci.yml</code>: بدون <code dir="ltr">on: push tags</code> برای release-cut.</li>
<li>سند CI: یادداشت در orchestrator README که release-cut عمداً لوکال است.</li>
<li>آینده: اگر operatore خواست، workflow_dispatch جدا — خارج از scope این پلن.</li>
</ul>

### §۲.۷ — پرچم‌های CLI (خلاصه)

<pre dir="ltr">
npm run release:cut
npm run release:cut -- --dry-run
npm run release:cut -- --bump minor
npm run release:cut -- --publish-packages hawiety
npm run release:cut -- --publish-packages hawiety,crm
npm run release:cut -- --skip-oss
npm run release:cut -- --push
npm run release:cut -- --resume &lt;runId&gt;
npm run release:export-appendo-release
npm run release:push-appendo-release
</pre>

---

## §۳ — فازهای پیاده‌سازی (RCUT)

<table dir="rtl">
<thead><tr><th>فاز</th><th>کار</th><th>معیار خروج</th></tr></thead>
<tbody>
<tr><td><strong>RCUT-0</strong></td><td>اسکلت orchestrator + checkpoint + dry-run بدون تغییر git</td><td><code dir="ltr">release:cut:dry-run</code> گزارش فازها را چاپ کند</td></tr>
<tr><td><strong>RCUT-1</strong></td><td><code dir="ltr">versionManifest.ts</code> + bump + commit + tag</td><td>تگ لوکال روی SHA درست؛ ورژن hawiety/cms/remote-hubs هم‌خوان</td></tr>
<tr><td><strong>RCUT-2</strong></td><td>Wire <code dir="ltr">hawiety:release</code> + cms + remote-hubs در P4</td><td>سه ZIP در <code dir="ltr">artifacts/packages/</code></td></tr>
<tr><td><strong>RCUT-3</strong></td><td>پیل تست §۳.۱ در P5</td><td>همه سبز روی ماشین operatore (یا skip با <code dir="ltr">--fast</code> فقط در dev)</td></tr>
<tr><td><strong>RCUT-4</strong></td><td>بیلد platform + gate OSS</td><td><code dir="ltr">assertPublicOssReleaseScope</code> سبز</td></tr>
<tr><td><strong>RCUT-5</strong></td><td>Skill <code dir="ltr">appendo-release-cut</code></td><td>agent با @skill همان npm را صدا می‌زند</td></tr>
<tr><td><strong>RCUT-6</strong></td><td>تست پذیرش end-to-end (§۳.۲) + repair path</td><td>دو run پشت‌سرهم: یکی dry-run کامل، یکی cut واقعی در sandbox git</td></tr>
<tr><td><strong>RCUT-7</strong></td><td><strong>AppEndO-Release</strong> — حذف <code dir="ltr">releases/public</code> · export staging · push به clone عمومی</td><td>ریپوی public به‌روز؛ بدون پوشه <code dir="ltr">releases/</code> در monorepo خصوصی</td></tr>
</tbody>
</table>

### §۳.۱ — پیل تست داخل release-cut (P5 — پیش‌فرض کامل)

<p>ترتیب پیشنهادی (قابل موازی‌سازی محدود در RCUT-3):</p>
<ol>
<li><code dir="ltr">npm run lint</code></li>
<li><code dir="ltr">npm run test:critical</code></li>
<li>برای هر publish package: pipeline جدول §۲.۳</li>
<li><code dir="ltr">npm run test:appendoo-golden</code> (اختیاری <code dir="ltr">--fast</code> حذف)</li>
<li>Smoke packaging: <code dir="ltr">src/core/packages/__tests__/pEcosystemZipMatrix.exit.test.ts</code> و <code dir="ltr">p32PackagingSurface.exit.test.ts</code></li>
</ol>

<p><code dir="ltr">--fast</code>: فقط برای توسعهٔ orchestrator — در run operatore واقعی ممنوع مگر <code dir="ltr">--allow-fast</code>.</p>

### §۳.۲ — تست پذیرش پلن (قبل از «تمام»)

<table dir="rtl">
<thead><tr><th>#</th><th>سناریو</th><th>انتظار</th></tr></thead>
<tbody>
<tr><td>T1</td><td>۵۰ کامیت بدون release-cut</td><td>هیچ آرتیفکت/تگ جدید</td></tr>
<tr><td>T2</td><td><code dir="ltr">release:cut:dry-run</code></td><td>بدون commit/tag؛ REPORT کامل</td></tr>
<tr><td>T3</td><td>cut کامل با <code dir="ltr">hawiety</code> + export</td><td>ZIP هویتی داخلی + staging / <strong>AppEndO-Release</strong> بدون hawiety</td></tr>
<tr><td>T4</td><td>شبیه‌سازی <code dir="ltr">ZIP_VERSION_MISMATCH</code></td><td>repair + retry موفق</td></tr>
<tr><td>T5</td><td>شکست عمدی gate OSS</td><td>run قرمز؛ staging ناقص به <strong>AppEndO-Release</strong> push نشود</td></tr>
<tr><td>T6</td><td><code dir="ltr">--resume</code> بعد از قطع برق/کرش</td><td>ادامه از checkpoint</td></tr>
</tbody>
</table>

---

## §۴ — پرامپت agent (شروع پیاده‌سازی)

<blockquote>
<code dir="ltr">@plans/core/todo/p-130-local-release-cut.md</code> — RCUT-0..7 (مدل <strong>AppEndO-Release</strong>، نه <code dir="ltr">releases/public</code>). scope فقط release-cut scripts، export/push، skill، npm. بدون GitHub Actions. operatore: <code dir="ltr">@appendo-release-cut</code> + <code dir="ltr">release:push-appendo-release</code>.
</blockquote>

---

## §۵ — بعد از تمام شدن پیاده‌سازی

<ul>
<li>وضعیت این سند → ✅ و حذف از <code dir="ltr">p-00-todo-index</code> (قانون plans).</li>
<li>shard کوتاه در <code dir="ltr">docs/standards/release-cut.md</code> (اختیاری) + یک خط در <code dir="ltr">projectStandards.ts</code> اگر operatore بخواهد.</li>
</ul>

</div>
