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

<p><strong>خلاصه برای operatore:</strong> ایده‌های پکیج که هنوز سند اجرایی جدا ندارند — برای اولویت‌بندی جلسه.</p>


# p-packages-backlog — Package Backlog

> **ایندکس:** [p-00-packages-index.md](p-00-packages-index.md) · **قرارداد:** [docs/plans-workflow.md](../../../docs/plans-workflow.md)  
> **نقش:** فهرست Packageهای برنامه‌ریزی‌شده — نام و تعریف کوتاه · جزئیات در `p-packages-<slug>.md`

---

## ابزار Studio / مدیریتی

<table dir="rtl">
<thead><tr><th>#</th><th>Package</th><th>تعریف</th><th>پیش‌نیاز</th><th>اندازه</th></tr></thead>
<tbody><tr><td>—</td><td><strong>DbEnricher</strong></td><td>introspection DB · توضیحات AI · کشف روابط</td><td>Data Sources · AI</td><td>خیلی سنگین · ✅ shipped (پلن حذف شد)</td></tr>
<tr><td>1</td><td><strong>File Manager</strong></td><td>مرور/آپلود/حذف فایل سرور (لوکال <code dir="ltr" style="unicode-bidi: embed;">workspace/</code> — نه File Hub)</td><td>—</td><td>سنگین</td></tr>
<tr><td>2</td><td><strong>Database Manager</strong></td><td>DBA کامل (backup · session · user DB) — <strong>نه</strong> SQL Workshop نازک</td><td>—</td><td>خیلی سنگین · Workshop توکار: <a href="../../core/next/p-96-native-dev-platform.md">p-96 PDK-4/6</a></td></tr>
<tr><td>3</td><td><strong>Payment Gateways</strong></td><td>درگاه ایرانی/بین‌المللی · provider · idempotency · webhook</td><td>—</td><td>سنگین → <a href="p-packages-payment-gateways.md">p-packages-payment-gateways</a></td></tr>
<tr><td>49</td><td><strong>Remote Hubs</strong></td><td>File Hub · SSH Hub · RDP Hub در یک Package · زیرمنوی Studio <strong>Remote Hubs</strong> · لایبرری native از Core خارج</td><td>—</td><td>خیلی سنگین · ✅ shipped (پلن حذف شد)</td></tr>
<tr><td>52</td><td><strong>Mail Hub</strong></td><td>صندوق یکپارچه · چند حساب (Gmail · M365 · IMAP) · سینک · خواندن/ارسال — شبیه Outlook/Mailbird</td><td>48</td><td>خیلی سنگین → <a href="p-packages-mail-hub.md">p-packages-mail-hub</a></td></tr>
<tr><td>113</td><td><strong>Infra Management</strong></td><td>دستیار AI زیرساخت (ظرفیت · Ansible · Zabbix · توپولوژی) — یک دستیار با #114</td><td>p-118 ✅</td><td>خیلی سنگین → <a href="infra-management/p-113-infra-management-platform.md">infra-management</a></td></tr>
<tr><td>114</td><td><strong>Big Data Development</strong></td><td>دستیار AI چرخهٔ دیتا (جمع‌آوری · batch · لیک/Iceberg · استریم) — فاز D پس از #113</td><td>113</td><td>خیلی سنگین → <a href="bigdata-development/p-114-bigdata-development-platform.md">bigdata-development</a></td></tr>
<tr><td>116</td><td><strong>LLM Studio</strong></td><td>کشف/دانلود مدل محلی · Playground · سرو OpenAI-compatible — شبیه LM Studio/Ollama</td><td>1</td><td>خیلی سنگین → <a href="p-packages-llm-studio.md">p-packages-llm-studio</a></td></tr>
<tr><td>117</td><td><strong>Bases</strong></td><td>پایگاه شبکه‌ای روی Edge (View Grid/Kanban/Calendar/Gallery — شبیه Airtable بدون اسکیمای ad-hoc)</td><td>Data Studio</td><td>خیلی سنگین → <a href="bases-package/p-packages-bases.md">p-packages-bases</a></td></tr>
</tbody></table>

## کامپوننت UI

<table dir="rtl">
<thead><tr><th>#</th><th>Package</th><th>تعریف</th><th>پیش‌نیاز</th><th>اندازه</th></tr></thead>
<tbody><tr><td>4</td><td><strong>Contact Form</strong></td><td>فرم تماس ساده</td><td>—</td><td>سبک</td></tr>
<tr><td>6</td><td><strong>Engagement</strong></td><td>نظرسنجی · نظرات</td><td>—</td><td>متوسط</td></tr>
</tbody></table>

## پنل · MCP

<table dir="rtl">
<thead><tr><th>#</th><th>Package</th><th>تعریف</th><th>پیش‌نیاز</th><th>اندازه</th></tr></thead>
<tbody><tr><td>5</td><td><strong>Shell / SSH</strong></td><td>MCP agent on top of <strong>SSH Hub</strong> (Remote Hubs package)</td><td>49</td><td>خیلی سنگین</td></tr>
<tr><td>22</td><td><strong>NatQL</strong></td><td>پرس‌وجوی طبیعی DB + MCP</td><td>2</td><td>سنگین</td></tr>
<tr><td>48</td><td><strong>API Connectors</strong></td><td>کاتالوگ SaaS + vault per-user — موتور HTTP/OpenAPI هسته است</td><td>—</td><td>خیلی سنگین → <a href="p-packages-api-connectors.md">p-packages-api-connectors</a> · runtime: <a href="../../core/next/p-96-native-dev-platform.md">p-96 PDK-8</a></td></tr>
</tbody></table>

## ماژول عملیاتی

<table dir="rtl">
<thead><tr><th>#</th><th>Package</th><th>تعریف</th><th>پیش‌نیاز</th><th>اندازه</th></tr></thead>
<tbody><tr><td>7</td><td>Newsletter &amp; Push</td><td>خبرنامه · Web Push</td><td>—</td><td>متوسط</td></tr>
<tr><td>8</td><td><strong>Task Management</strong></td><td>پروژه · تسک · کانبان · یک شکل work item</td><td>—</td><td>سنگین → <a href="tsk-package/p-packages-task-management.md">p-packages-task-management</a></td></tr>
<tr><td>9</td><td>HR &amp; Recruitment</td><td>HR · استخدام</td><td>—</td><td>خیلی سنگین</td></tr>
<tr><td>10</td><td>Time &amp; Payroll</td><td>حضور · حقوق</td><td>9</td><td>سنگین</td></tr>
<tr><td>11</td><td>CRM &amp; Support</td><td>CRM · مشتری (User+Profile) · تیکت · چت</td><td>—</td><td>خیلی سنگین → <a href="crm-package/p-packages-crm.md">p-packages-crm</a> · v1 رولبک · v2 روی identity-profile</td></tr>
<tr><td>12</td><td>CMS</td><td>محتوا · وبلاگ · انواع تحریری</td><td>—</td><td>خیلی سنگین · ✅ shipped (پلن حذف شد)</td></tr>
<tr><td>13</td><td>Forum</td><td>تالار گفتگو</td><td>—</td><td>سنگین</td></tr>
<tr><td>14</td><td>Calendar &amp; AMS</td><td>تقویم · رزرو · قرار</td><td>3</td><td>خیلی سنگین</td></tr>
<tr><td>15</td><td>Commerce</td><td>فروش · انبار · فاکتور</td><td>3</td><td>خیلی سنگین</td></tr>
<tr><td>17</td><td><strong>DMS</strong></td><td>مدیریت اسناد · کتابخانه · پوشه · نسخه · کنترل وضعیت</td><td>—</td><td>خیلی سنگین → <a href="p-packages-dms.md">p-packages-dms</a></td></tr>
<tr><td>16–47</td><td>*(ماژول‌های عملیاتی دیگر)*</td><td>Procurement · Warehouse · Workflow · Fleet · Accounting · … *(Email unified inbox → #52 Mail Hub)*</td><td>متغیر</td><td>سنگین</td></tr>
</tbody></table>

> ردیف‌های ۱۶–۴۷ بدون تغییر مفهومی از backlog قبلی — هنگام شروع هر Package سند اختصاصی اضافه شود.
> «Dashboard Builder» (#۵۰، پکیج مستقل) در ۲۰۲۶-۰۹-۰۹ **جایگزین شد** با یک قابلیت Core در Client Components (نه پکیج) — [`plans/core/todo/dashboard-canvas/p-108-personalizable-dashboard-canvas.md`](../../core/todo/dashboard-canvas/p-108-personalizable-dashboard-canvas.md) (۲۰۲۶-۰۹-۱۰: منتقل به `todo/dashboard-canvas/`). دلیل: نیاز واقعی همیشه «دولوپر دامنهٔ داده را طراحی می‌کند، کاربر فقط نمایش را شخصی‌سازی می‌کند» بود، نه self-service کامل با رکورد/اشتراک‌گذاری/نسخهٔ مستقل — پس دیگر یک دامنهٔ کسب‌وکاری مستقل با backlog number نیست.

## نمونه · شوکیس

<table dir="rtl">
<thead><tr><th>#</th><th>Package</th><th>تعریف</th><th>پیش‌نیاز</th><th>اندازه</th></tr></thead>
<tbody><tr><td>51</td><td><strong>AdventureWorks Showcase</strong></td><td>بوم‌های دمو روی AW OLTP / DW / ROLAP / OLAP Bridge — پکیج اختیاری، نه باندل اولیه</td><td>Dashboard Canvas ✅</td><td>سنگین → <a href="p-packages-adventureworks-showcase.md">p-packages-adventureworks-showcase</a></td></tr>
</tbody></table>

---

## اسناد اجرایی

<table dir="rtl">
<thead><tr><th>#</th><th>سند</th><th>وضعیت</th></tr></thead>
<tbody><tr><td>3</td><td><a href="p-packages-payment-gateways.md">p-packages-payment-gateways</a></td><td>⬜ design only</td></tr>
<tr><td>8</td><td><a href="tsk-package/p-packages-task-management.md">p-packages-task-management</a></td><td>🟡 فعال — design only · <code dir="ltr" style="unicode-bidi: embed;">@plans/packages/todo/tsk-package</code></td></tr>
<tr><td>11</td><td><a href="crm-package/p-packages-crm.md">p-packages-crm</a></td><td>⬜ v2 design only — فاز ۱–۳ رولبک ۲۰۲۶-۰۸-۳۰</td></tr>
<tr><td>48</td><td><a href="p-packages-api-connectors.md">p-packages-api-connectors</a></td><td>⏸ AC-1 blocker</td></tr>
<tr><td>51</td><td><a href="p-packages-adventureworks-showcase.md">p-packages-adventureworks-showcase</a></td><td>⬜ design only</td></tr>
<tr><td>52</td><td><a href="p-packages-mail-hub.md">p-packages-mail-hub</a></td><td>⬜ design only</td></tr>
<tr><td>17</td><td><a href="p-packages-dms.md">p-packages-dms</a></td><td>⬜ design only</td></tr>
<tr><td>113</td><td><a href="infra-management/p-113-infra-management-platform.md">infra-management</a></td><td>⬜ design only · deferred</td></tr>
<tr><td>114</td><td><a href="bigdata-development/p-114-bigdata-development-platform.md">bigdata-development</a></td><td>⬜ design only · deferred</td></tr>
<tr><td>116</td><td><a href="p-packages-llm-studio.md">p-packages-llm-studio</a></td><td>⬜ design only</td></tr>
<tr><td>117</td><td><a href="bases-package/p-packages-bases.md">p-packages-bases</a></td><td>⬜ design only</td></tr>
</tbody></table>


</div>
