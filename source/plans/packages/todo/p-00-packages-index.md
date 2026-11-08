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

<p><strong>خلاصه برای operatore:</strong> همهٔ <strong>پکیج‌های Studio</strong> (Task، CRM، Hawiety، …) — کدام design-only است و کدام فعال. هویتی: parity از <a href="hawiety-package/hwy-legacy-vs-appendo-feature-parity.md">§۰ parity</a>.</p>


# p-00 — Packages Index

> **آخرین به‌روزرسانی:** ۲۰۲۶-۰۹-۱۷  
> **ورود:** `@plans/packages/todo/p-00-packages-index.md برو جلو` · `@plans/packages/todo/tsk-package برو جلو` · `@plans/packages/todo/infra-management` · `@plans/packages/todo/bigdata-development`  
> **هسته:** [`p-00-todo-index`](../../core/todo/p-00-todo-index.md) · [artifacts](../../../docs/architecture/artifacts.md)  
> **Backlog:** [p-packages-backlog.md](p-packages-backlog.md)

---

## وضعیت

<table dir="rtl">
<thead><tr><th>محور</th><th>وضعیت</th></tr></thead>
<tbody><tr><td><strong>Package فعال</strong></td><td><a href="tsk-package/p-packages-task-management.md">Task Management — tsk-package</a></td></tr>
<tr><td><strong>Packages (design only)</strong></td><td><a href="infra-management/README.md">Infra Management</a> · <a href="bigdata-development/README.md">Big Data Development</a></td></tr>
<tr><td><strong>Platform AI</strong></td><td>AppEndoo shipped · backlog <a href="../../core/next/p-72-ai-backlog.md"><code dir="ltr" style="unicode-bidi: embed;">p-72</code></a></td></tr>
<tr><td><strong>کار بعدی</strong></td><td>فاز ۱ — Data Studio + Base Info + گروه nav <code dir="ltr" style="unicode-bidi: embed;">Tasks</code> · <a href="tsk-package/tsk-phase-execution-prompts.md"><code dir="ltr" style="unicode-bidi: embed;">tsk-phase-execution-prompts.md</code></a></td></tr>
<tr><td><strong>مسیر موازی</strong></td><td><a href="crm-package/p-packages-crm.md">CRM v2</a> · <a href="hawiety-package/hwy-legacy-vs-appendo-feature-parity.md">Hawiety parity §۰</a> · <a href="hawiety-package/p-packages-hawiety-extraction.md">extraction ✅</a> · <a href="hawiety-package/README.md">README هویتی</a></td></tr>
<tr><td><strong>blocker</strong></td><td>—</td></tr>
</tbody></table>

---

## پیشرفت

<table dir="rtl">
<thead><tr><th>#</th><th>سند</th><th>وضعیت</th><th>یادداشت</th></tr></thead>
<tbody><tr><td>3</td><td><a href="p-packages-payment-gateways.md">p-packages-payment-gateways</a></td><td>⬜</td><td>design only — درگاه ایرانی/بین‌المللی · provider · webhook · پیش‌نیاز Commerce/Calendar</td></tr>
<tr><td>8</td><td><a href="tsk-package/p-packages-task-management.md">p-packages-task-management</a></td><td>🟡 <strong>فعال</strong></td><td>design only — پروژه · تسک · کانبان · <code dir="ltr" style="unicode-bidi: embed;">@plans/packages/todo/tsk-package</code></td></tr>
<tr><td>11</td><td><a href="crm-package/p-packages-crm.md">p-packages-crm</a></td><td>⬜</td><td>v2 design only — خروجی فاز ۱–۳ رولبک ۲۰۲۶-۰۸-۳۰ · ۳c-pre پلتفرمی باقی ماند</td></tr>
<tr><td>48</td><td><a href="p-packages-api-connectors.md">p-packages-api-connectors</a></td><td>⏸</td><td>AC-1 blocker</td></tr>
<tr><td>51</td><td><a href="p-packages-adventureworks-showcase.md">p-packages-adventureworks-showcase</a></td><td>⬜</td><td>design only — شوکیس OLTP/DW/ROLAP/OLAP روی AdventureWorks · نه باندل اولیه</td></tr>
<tr><td>52</td><td><a href="p-packages-mail-hub.md">p-packages-mail-hub</a></td><td>⬜</td><td>design only — unified inbox · چند حساب · سینک/ارسال · وابسته API Connectors</td></tr>
<tr><td>17</td><td><a href="p-packages-dms.md">p-packages-dms</a></td><td>⬜</td><td>design only — کتابخانه · پوشه · سند · نسخه · File Manager برای بایت</td></tr>
<tr><td>113</td><td><a href="infra-management/p-113-infra-management-platform.md">infra-management</a></td><td>⬜ <strong>Deferred</strong></td><td>design only — دستیار AI زیرساخت · p-118 ✅ · <code dir="ltr" style="unicode-bidi: embed;">@plans/packages/todo/infra-management</code></td></tr>
<tr><td>114</td><td><a href="bigdata-development/p-114-bigdata-development-platform.md">bigdata-development</a></td><td>⬜ <strong>Deferred</strong></td><td>design only — فاز D پس از infra-management · تحقیق باز</td></tr>
<tr><td>115</td><td><a href="hawiety-package/p-packages-hawiety-extraction.md">Hawiety — extraction + members</a></td><td>✅</td><td>vertical-app gated · <code dir="ltr" style="unicode-bidi: embed;">hawiety:install</code> / <code dir="ltr" style="unicode-bidi: embed;">hawiety:rollback</code> · ETL-not-seed</td></tr>
<tr><td>116</td><td><a href="p-packages-llm-studio.md">p-packages-llm-studio</a></td><td>⬜</td><td>design only — مدل محلی · Playground · dev API شبیه LM Studio</td></tr>
<tr><td>117</td><td><a href="bases-package/p-packages-bases.md">p-packages-bases</a></td><td>⬜</td><td>design only — Base/Collection/View روی Edge · Grid/Kanban/Calendar/Gallery</td></tr>
</tbody></table>

---

## لاگ

<table dir="rtl">
<thead><tr><th>تاریخ</th><th>خلاصه</th></tr></thead>
<tbody><tr><td>۲۰۲۶-۰۹-۱۷</td><td><strong>Bases phase plans split</strong> — <a href="bases-package/README.md">bases-package/README</a> · فاز ۱–۲ + 3a–3d executable docs + <a href="bases-package/bases-phase-execution-prompts.md">execution prompts</a></td></tr>
<tr><td>۲۰۲۶-۰۹-۱۷</td><td><strong>Bases plan drafted</strong> — <a href="bases-package/p-packages-bases.md">p-packages-bases</a> · design only, not implemented · #117 Studio tool · Airtable-like views on Edge</td></tr>
<tr><td>۲۰۲۶-۰۹-۱۷</td><td><strong>LLM Studio plan drafted</strong> — <a href="p-packages-llm-studio.md">p-packages-llm-studio</a> · design only, not implemented · #116 Studio tool</td></tr>
<tr><td>۲۰۲۶-۰۹-۱۶</td><td><strong>Hawiety members phase 1 enriched</strong> — <a href="hawiety-package/p-packages-hawiety-members-phase1.md">hawiety-package</a> · سناریو + مدل غنی از migration</td></tr>
<tr><td>۲۰۲۶-۰۹-۱۵</td><td><strong>DMS plan drafted</strong> — <a href="p-packages-dms.md">p-packages-dms</a> · design only, not implemented · #17 operational module</td></tr>
<tr><td>۲۰۲۶-۰۹-۱۵</td><td><strong>Payment Gateways plan drafted</strong> — <a href="p-packages-payment-gateways.md">p-packages-payment-gateways</a> · design only, not implemented · #3 Studio tool</td></tr>
<tr><td>۲۰۲۶-۰۹-۱۵</td><td><strong>infra-management + bigdata-development → packages/todo</strong> — از <code dir="ltr" style="unicode-bidi: embed;">core/next/</code> · <a href="infra-management/README.md"><code dir="ltr" style="unicode-bidi: embed;">infra-management</code></a> · <a href="bigdata-development/README.md"><code dir="ltr" style="unicode-bidi: embed;">bigdata-development</code></a> · design only</td></tr>
<tr><td>۲۰۲۶-۰۹-۱۵</td><td><strong>Mail Hub plan drafted</strong> — <a href="p-packages-mail-hub.md">p-packages-mail-hub</a> · design only, not implemented · #52 Studio tool · unified inbox</td></tr>
<tr><td>۲۰۲۶-۰۹-۱۵</td><td><strong>p-70 ادغام و حذف</strong> — تفکیک نام از Work Item / Scheduled Task / jobs / feedback + هوک‌های بعد از v1 (Home widget · Ask AppEndO · اعلان) به <a href="tsk-package/p-packages-task-management.md">tsk-package</a>؛ پلن core/next حذف شد</td></tr>
<tr><td>۲۰۲۶-۰۹-۱۵</td><td><strong>Task Management (tsk-package) فعال در todo</strong> — Package فعال ریلیز؛ ورود <code dir="ltr" style="unicode-bidi: embed;">@plans/packages/todo/tsk-package برو جلو</code> · core index هم ارجاع دارد</td></tr>
<tr><td>۲۰۲۶-۰۹-۱۱</td><td><strong>AdventureWorks Showcase plan drafted</strong> — <a href="p-packages-adventureworks-showcase.md">p-packages-adventureworks-showcase</a> · design only, not implemented · #51 نمونه/شوکیس جدا از Insights باندل اولیه (p-120)</td></tr>
<tr><td>۲۰۲۶-۰۹-۰۹</td><td><strong>Dashboard Builder (#۵۰) جایگزین شد — دیگر پکیج نیست</strong> — بعد از بحث عمیق دربارهٔ نیاز واقعی، مشخص شد کاربر نهایی هیچ‌وقت قرار نیست از صفر داشبورد بسازد؛ دولوپر همیشه دامنهٔ اطلاعاتی + ویژوالایزیشن اولیه را در Component Designer طراحی می‌کند، کاربر فقط نمایش را شخصی‌سازی/گسترش می‌دهد (در محدودهٔ همان دامنه). این یعنی دیگر یک دامنهٔ کسب‌وکاری مستقل با رکورد/اشتراک‌گذاری/نسخهٔ خودش نیست — به یک قابلیت <strong>Core در Client Components</strong> تبدیل شد: <a href="../../core/todo/dashboard-canvas/p-108-personalizable-dashboard-canvas.md"><code dir="ltr" style="unicode-bidi: embed;">plans/core/todo/dashboard-canvas/p-108-personalizable-dashboard-canvas.md</code></a> (۲۰۲۶-۰۹-۱۰: کل ابتکار Dashboard Canvas از <code dir="ltr" style="unicode-bidi: embed;">next/</code> به <code dir="ltr" style="unicode-bidi: embed;">todo/dashboard-canvas/</code> منتقل شد). فایل پلن پکیج و پوشه‌اش حذف شدند؛ تصمیم‌های قابل‌استفادهٔ قبلی (فقط ECharts، بدون کتابخانهٔ چارت دوم، <code dir="ltr" style="unicode-bidi: embed;">UiDashboardCanvas</code> روی react-grid-layout، OLAP Bridge p-107 مستقل و دست‌نخورده) به پلن جدید منتقل شدند.</td></tr>
<tr><td>۲۰۲۶-۰۹-۰۹</td><td><strong>Dashboard Builder plan revised</strong> — افزوده شدن فاز ۴ (بسته‌بندی نصب‌پذیر via Package Builder، الگوی CMS/Remote Hubs) — بعداً در همین روز با تصمیم بالا بازنشسته شد</td></tr>
<tr><td>۲۰۲۶-۰۹-۰۹</td><td><strong>Dashboard Builder plan drafted</strong> — design only, not implemented · بررسی بازار OSS (react-grid-layout + ECharts موجود، بدون کتابخانهٔ چارت دوم) و کدبیس موجود پیوست شد — بعداً بازنشسته شد (ردیف بالا)</td></tr>
<tr><td>۲۰۲۶-۰۸-۳۰</td><td><strong>CRM v2 rollback</strong> — <code dir="ltr" style="unicode-bidi: embed;">crm:phase3d/3c/3b/3a/2/1:rollback</code> · جداول <code dir="ltr" style="unicode-bidi: embed;">crm_*</code> · functions · nav/pages · drafts پاک شد؛ پلن و <code dir="ltr" style="unicode-bidi: embed;">scripts/crm-phase*</code> ماند؛ ۳c-pre (<code dir="ltr" style="unicode-bidi: embed;">UiKanbanBoard</code>) رولبک نشد · <a href="crm-package/p-packages-crm.md"><code dir="ltr" style="unicode-bidi: embed;">crm-package/</code></a></td></tr>
<tr><td>۲۰۲۶-۰۸-۲۹</td><td><strong>Task Management plan folder</strong> — سند تکی <code dir="ltr" style="unicode-bidi: embed;">p-packages-task-management.md</code> حذف شد · اجرا از <a href="tsk-package/p-packages-task-management.md"><code dir="ltr" style="unicode-bidi: embed;">tsk-package/</code></a></td></tr>
<tr><td>۲۰۲۶-۰۸-۲۹</td><td><strong>CRM plan folder</strong> — سند تکی <code dir="ltr" style="unicode-bidi: embed;">p-packages-crm.md</code> حذف شد · اجرا از <a href="crm-package/p-packages-crm.md"><code dir="ltr" style="unicode-bidi: embed;">crm-package/</code></a></td></tr>
<tr><td>۲۰۲۶-۰۸-۲۸</td><td><strong>DbEnricher ✅</strong> — پلن <code dir="ltr" style="unicode-bidi: embed;">p-packages-db-enricher</code> حذف شد · مستندسازی و کشف روابط DB با AI روی Data Sources</td></tr>
<tr><td>۲۰۲۶-۰۸-۲۶</td><td><strong>Remote Hubs ✅</strong> — پلن <code dir="ltr" style="unicode-bidi: embed;">p-packages-remote-hubs</code> حذف شد · File/SSH/RDP Hub پکیج اختیاری Studio</td></tr>
<tr><td>۲۰۲۶-۰۸-۲۶</td><td><strong>Unified package portability ✅</strong> — پلن <code dir="ltr" style="unicode-bidi: embed;">p-packages-unified-portability</code> حذف شد · یک مکانیزم پکیج از Package Manager</td></tr>
<tr><td>۲۰۲۶-۰۸-۲۶</td><td><strong>Task Management plan drafted</strong> — <a href="tsk-package/p-packages-task-management.md">p-packages-task-management</a> · design only, not implemented</td></tr>
<tr><td>۲۰۲۶-۰۸-۲۵</td><td><strong>Remote Hubs implemented</strong> — <code dir="ltr" style="unicode-bidi: embed;">npm run remote-hubs:install</code> · گروه سایدبار Remote Hubs · API/WS gated</td></tr>
<tr><td>۲۰۲۶-۰۸-۲۵</td><td><strong>Remote Hubs plan drafted</strong> — design only, not implemented</td></tr>
<tr><td>۲۰۲۶-۰۸-۱۵</td><td><strong>بازآرایی plans</strong> — پلن‌های پکیج ✅ (CMS · reference vertical) حذف شدند · ایندکس فقط کارهای باز</td></tr>
<tr><td>۲۰۲۶-۰۸-۱۵</td><td><strong>Studio nav + culture keys</strong> — unified portability · <code dir="ltr" style="unicode-bidi: embed;">navigation_patches</code> · <code dir="ltr" style="unicode-bidi: embed;">culture_keys</code> · unresolved warnings · font keep-existing</td></tr>
<tr><td>۲۰۲۶-۰۸-۱۵</td><td><strong>Package closure + Edge</strong> — unified portability · seed-component BFS · <code dir="ltr" style="unicode-bidi: embed;">ui_routes</code> · draft JSON صفحات · فونت پلتفرم · Edge Data در Builder/Repack</td></tr>
<tr><td>۲۰۲۶-۰۸-۱۴</td><td><strong>Workflows in Package Builder</strong> — unified portability UP-4 · picker در Builder/Repack · install به‌صورت DRAFT</td></tr>
<tr><td>۲۰۲۶-۰۸-۰۸</td><td><strong>CRM v2 plan (docs)</strong> — <a href="crm-package/p-packages-crm.md">p-packages-crm</a> بازنویسی: <code dir="ltr" style="unicode-bidi: embed;">crm_customers</code> · Customers nav · skill §17</td></tr>
<tr><td>۲۰۲۶-۰۸-۰۸</td><td><strong>CRM v1 rollback</strong> — <code dir="ltr" style="unicode-bidi: embed;">crm:phase3/2/1:rollback</code> · <a href="../../../docs/standards/identity-profile.md"><code dir="ltr" style="unicode-bidi: embed;">identity-profile.md</code></a> · Users: حقیقی/حقوقی</td></tr>
<tr><td>۲۰۲۶-۰۸-۰۷</td><td><strong>CRM plan reviewed</strong> — <a href="crm-package/p-packages-crm.md">p-packages-crm</a> · هنوز design only (v2)</td></tr>
<tr><td>۲۰۲۶-۰۸-۰۴</td><td><strong>Unified package portability</strong> — Shell Designer Import/Export UX حذف · پکیج فقط از Package Manager</td></tr>
<tr><td>۲۰۲۶-۰۷-۲۷</td><td><strong>CRM plan drafted</strong> — <a href="crm-package/p-packages-crm.md">p-packages-crm</a> · design only, not implemented</td></tr>
</tbody></table>

---

*کنترل Packageهای AppEndO Studio*


</div>
