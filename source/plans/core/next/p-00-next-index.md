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

<p><strong>خلاصه برای operatore:</strong> فهرست کارهای <strong>آینده</strong> (AI، mobile، marketplace، …) — اولویت با شماست وقتی به todo graduate شوند.</p>


# p-00 — Next Index (موکول)

> **آخرین به‌روزرسانی:** ۲۰۲۶-۰۹-۱۵  
> **نقش این سند:** فهرست فازهای **موکول‌شده** — هنوز انجام نشده  
> **ریلیز فعلی:** [`plans/core/todo/p-00-todo-index.md`](../todo/p-00-todo-index.md)  
> **قرارداد:** [`docs/plans-workflow.md`](../../docs/plans-workflow.md)

---

## چرا جدا؟

فازهای زیر از موج ۶ فعال خارج شده‌اند.

<table dir="rtl">
<thead><tr><th>فاز</th><th>عنوان</th><th>یادداشت</th></tr></thead>
<tbody><tr><td>p-123</td><td>Form Help Metadata</td><td><a href="p-123-form-help-metadata.md"><code dir="ltr" style="unicode-bidi: embed;">p-123-form-help-metadata</code></a> — هلپ اندیوزر (<code dir="ltr" style="unicode-bidi: embed;">i</code>) + شورتکات ADMIN/DEVELOPER · design only · <strong>deferred ۲۰۲۶-۰۹-۱۴</strong></td></tr>
<tr><td>p-91</td><td>Mobile Apps Platform</td><td><a href="p-91-mobile-apps-platform.md"><code dir="ltr" style="unicode-bidi: embed;">p-91-mobile-apps-platform</code></a> — Expo + WebView · ZIP شِل · موتور قفل؛ اجرا نیست</td></tr>
<tr><td>p-43</td><td>Platform Updates</td><td>M7 · lifecycle/rollback</td></tr>
<tr><td>p-42</td><td>Marketplace</td><td>M8 · کاتالوگ مرکزی</td></tr>
<tr><td>p-44</td><td>Platform Documentation</td><td>DOC · markdown user/dev</td></tr>
<tr><td>p-23</td><td>Enterprise SAML</td><td>P4b</td></tr>
<tr><td>p-63</td><td>Internal Chat</td><td>CHT · DM/کانال</td></tr>
<tr><td>p-129</td><td>Operator direct message compose</td><td>MSGI-F · ارسال دستی پیام به user از UI · <strong>deferred ۲۰۲۶-۱۰-۳۱</strong></td></tr>
<tr><td>p-66</td><td>Security Hardening</td><td>SEC · ممیزی ۲۰۲۶-۰۷-۱۸ · SEC-1 بحرانی</td></tr>
<tr><td>p-72</td><td>AI Backlog</td><td>AppEndoo agent · CACL · MQA · workflow+AI</td></tr>
<tr><td>p-75</td><td>Unified Runtime Engine</td><td>URE · <strong>deferred ۲۰۲۶-۰۷-۳۰</strong></td></tr>
<tr><td>p-76</td><td>Control Plane Migration</td><td>CPM · حذف Prisma · <strong>deferred ۲۰۲۶-۰۷-۳۰</strong></td></tr>
<tr><td>p-94</td><td>Component Usage</td><td>USAGE · هیت روزانهٔ کامپوننت‌های منتشرشده · <strong>deferred ۲۰۲۶-۰۸-۲۳</strong></td></tr>
<tr><td>p-96</td><td>Native Dev Platform</td><td>PDK · موج A/B (PDK-1..9) ✅ تمام · موج C منتظر گیت ۰ + نود دوم · <strong>deferred ۲۰۲۶-۰۸-۲۶</strong></td></tr>
</tbody></table>

> **Dashboard Canvas (p-93, p-107..p-112, p-115..p-117) در ۲۰۲۶-۰۹-۱۱ بسته شد** — پیاده شد و از `todo/` حذف شد؛ دیگر اینجا نیست.

> **p-113/p-114** — دو پوشهٔ خواهر در [`plans/packages/todo/`](../../packages/todo/p-00-packages-index.md): [`infra-management`](../../packages/todo/infra-management/README.md) + [`bigdata-development`](../../packages/todo/bigdata-development/README.md). design only؛ از core موکول ۲۰۲۶-۰۹-۱۵، به packages منتقل ۲۰۲۶-۰۹-۱۵.

**Leftover (بدون سند جدا):** WFV2-13 `ERROR_TRIGGER` start — EVENT start already covers `workflow.instance.failed`.

---

## پیشرفت (موکول)

<table dir="rtl">
<thead><tr><th>اولویت</th><th>سند</th><th>وضعیت</th><th>وابستگی</th></tr></thead>
<tbody><tr><td><strong>—</strong></td><td><a href="p-123-form-help-metadata.md">p-123-form-help-metadata</a></td><td>⬜ <strong>Deferred</strong></td><td>Cultures ✅ · studio-meta <code dir="ltr" style="unicode-bidi: embed;">interfaceNotes</code> · <code dir="ltr" style="unicode-bidi: embed;">FieldHintTooltip</code> ✅ · RecordForm / CRUD ✅</td></tr>
<tr><td><strong>—</strong></td><td><a href="p-91-mobile-apps-platform.md">p-91-mobile-apps-platform</a></td><td>⬜ <strong>Deferred</strong></td><td>Portals ✅ · Component Designer ✅</td></tr>
<tr><td><strong>1</strong></td><td><a href="p-43-platform-updates.md">p-43-platform-updates</a></td><td>⬜</td><td>Prisma multi-DB ✅</td></tr>
<tr><td><strong>2</strong></td><td><a href="p-42-marketplace.md">p-42-marketplace</a></td><td>⬜</td><td>p-43 ترجیحی</td></tr>
<tr><td><strong>3</strong></td><td><a href="p-44-platform-documentation.md">p-44-platform-documentation</a></td><td>⬜</td><td>محصول تثبیت‌شده</td></tr>
<tr><td><strong>4</strong></td><td><a href="p-23-enterprise-saml.md">p-23-enterprise-saml</a></td><td>⬜</td><td>Identity OAuth ✅</td></tr>
<tr><td><strong>5</strong></td><td><a href="p-63-internal-chat-system.md">p-63-internal-chat-system</a></td><td>⬜</td><td>Identity providers ✅</td></tr>
<tr><td><strong>—</strong></td><td><a href="p-129-operator-direct-message-compose.md">p-129-operator-direct-message-compose</a></td><td>⬜ <strong>Deferred</strong></td><td>MSGI v1 ✅ · <code dir="ltr" style="unicode-bidi: embed;">my-inbox</code> ✅ · نیاز اپراتور ۲۰۲۶-۱۰-۳۱</td></tr>
<tr><td><strong>—</strong></td><td><a href="p-66-security-hardening.md">p-66-security-hardening</a></td><td>⬜</td><td>SEC · SEC-1 فوری</td></tr>
<tr><td><strong>—</strong></td><td><a href="p-72-ai-backlog.md">p-72-ai-backlog</a></td><td>🟡</td><td>AppEndoo Phase D · CACL · MQA</td></tr>
<tr><td><strong>—</strong></td><td><a href="p-75-unified-runtime-engine.md">p-75-unified-runtime-engine</a></td><td>⬜ <strong>Deferred</strong></td><td>—</td></tr>
<tr><td><strong>—</strong></td><td><a href="p-76-control-plane-prisma-migration.md">p-76-control-plane-prisma-migration</a></td><td>⬜ <strong>Deferred</strong></td><td>—</td></tr>
<tr><td><strong>—</strong></td><td><a href="p-94-component-usage.md">p-94-component-usage</a></td><td>⬜ <strong>Deferred</strong></td><td>Client Components ✅ · <code dir="ltr" style="unicode-bidi: embed;">DbBatchQueue</code> ✅</td></tr>
<tr><td><strong>—</strong></td><td><a href="p-96-native-dev-platform.md">p-96-native-dev-platform</a></td><td>🟡 موج A/B ✅</td><td>موج C: گیت ۰ (p-52 + SEC-1) + نود دوم</td></tr>
</tbody></table>

**Packages (design only):** [infra-management](../../packages/todo/infra-management/README.md) · [bigdata-development](../../packages/todo/bigdata-development/README.md) — [`p-00-packages-index`](../../packages/todo/p-00-packages-index.md)

**راهنما:** ⬜ شروع نشده · 🟡 در حال کار · ✅ تمام (سپس فایل پلن حذف می‌شود)

---

## فعال‌سازی

1. `git mv plans/core/next/p-NN-<slug>.md plans/core/todo/p-NN-<slug>.md`
2. ردیف در [`p-00-todo-index.md`](../todo/p-00-todo-index.md)
3. حذف از جدول بالا · لاگ در هر دو ایندکس

---

## لاگ

<table dir="rtl">
<thead><tr><th>تاریخ</th><th>رویداد</th></tr></thead>
<tbody><tr><td>۲۰۲۶-۰۹-۱۶</td><td><strong>p-125 بسته شد</strong> — HOMEW v1 در کد؛ قرارداد <a href="../../../specs/home-module-widgets/"><code dir="ltr" style="unicode-bidi: embed;">specs/home-module-widgets/</code></a> · backlog: <code dir="ltr" style="unicode-bidi: embed;">collection:*</code>، shard DX</td></tr>
<tr><td>۲۰۲۶-۰۹-۱۵</td><td><strong>p-69 حذف شد</strong> — Home Module Widgets (HOMEW) به درخواست اپراتور؛ فایل و ارجاعات ایندکس برداشته شد. Home همچنان ویجت‌های hardcoded (<code dir="ltr" style="unicode-bidi: embed;">userDashboardLayout.ts</code>) + Insights (p-120)</td></tr>
<tr><td>۲۰۲۶-۰۹-۱۵</td><td><strong>p-70 حذف شد</strong> — Task Management دیگر پلن core نیست؛ دامنه در پکیج <a href="../../packages/todo/tsk-package/p-packages-task-management.md"><code dir="ltr" style="unicode-bidi: embed;">tsk-package</code></a> است. تفکیک نام (Work Item / Scheduled Task / jobs / feedback) و هوک‌های بعد از v1 از p-70 به همان سند آمد؛ معماری <code dir="ltr" style="unicode-bidi: embed;">core:Tasks</code> / Prisma <code dir="ltr" style="unicode-bidi: embed;">base_tasks</code> نیامد</td></tr>
<tr><td>۲۰۲۶-۰۹-۱۵</td><td><strong>p-46 حذف شد</strong> — پلن Component Designer → App Builder به درخواست اپراتور؛ فایل و ارجاعات ایندکس برداشته شد. قرارداد زنده: <a href="../../../docs/standards/component-designer.md"><code dir="ltr" style="unicode-bidi: embed;">docs/standards/component-designer.md</code></a> · <code dir="ltr" style="unicode-bidi: embed;">specs/component-designer/</code></td></tr>
<tr><td>۲۰۲۶-۰۹-۱۵</td><td><strong>infra-management + bigdata-development → packages</strong> — از <code dir="ltr" style="unicode-bidi: embed;">next/</code> به <a href="../../packages/todo/infra-management/README.md"><code dir="ltr" style="unicode-bidi: embed;">plans/packages/todo/infra-management</code></a> · <a href="../../packages/todo/bigdata-development/README.md"><code dir="ltr" style="unicode-bidi: embed;">bigdata-development</code></a> · design only</td></tr>
<tr><td>۲۰۲۶-۰۹-۱۵</td><td><strong>infra-management + bigdata-development موکول</strong> — از <code dir="ltr" style="unicode-bidi: embed;">plans/core/todo/</code> به <code dir="ltr" style="unicode-bidi: embed;">next/</code> · ریلیز فعلی: <a href="../../packages/todo/tsk-package/p-packages-task-management.md"><code dir="ltr" style="unicode-bidi: embed;">tsk-package</code></a></td></tr>
<tr><td>۲۰۲۶-۰۹-۱۴</td><td><strong>p-123 موکول</strong> — Form Help Metadata از <code dir="ltr" style="unicode-bidi: embed;">todo/</code> · هلپ اندیوزر روی فیلد/سکشن هنوز design only · <a href="p-123-form-help-metadata.md"><code dir="ltr" style="unicode-bidi: embed;">p-123-form-help-metadata.md</code></a></td></tr>
<tr><td>۲۰۲۶-۰۹-۱۰</td><td><strong>p-113 به دو پوشهٔ <code dir="ltr" style="unicode-bidi: embed;">todo/</code> منتقل و تقسیم شد</strong> — به‌درخواست اپراتور، از <code dir="ltr" style="unicode-bidi: embed;">plans/core/next/</code> (تک‌سند) به دو طرح مستقل زیر <code dir="ltr" style="unicode-bidi: embed;">todo/</code>: <code dir="ltr" style="unicode-bidi: embed;">infra-management/p-113-infra-management-platform.md</code> (مدیریت اینفراستراکچر عمومی + ملاحظات بیگ‌دیتا) و <code dir="ltr" style="unicode-bidi: embed;">bigdata-development/p-114-bigdata-development-platform.md</code> (توسعهٔ چرخهٔ دیتا — جمع‌آوری/استریم/ذخیره‌سازی/لیک). هر دو هنوز فقط تحقیق/ایده‌پردازی‌اند</td></tr>
<tr><td>۲۰۲۶-۰۹-۱۰</td><td><strong>p-113 جلسهٔ ۴</strong> — ۶ ایدهٔ پیشنهادی Claude ثبت شد، همه بر مبنای استفاده از سرمایه‌گذاری معماری موجود AppEndO به‌جای ساخت از صفر (AppEndoo agent، الگوی Enricher، معماری Provider پیوت، گیت تأیید Human Workflow، پیش‌فرض کوچک‌ترین‌موتور-کافی، حلقهٔ بازخورد ظرفیت) · <a href="p-113-infra-topology-platform.md"><code dir="ltr" style="unicode-bidi: embed;">p-113-infra-topology-platform.md</code></a></td></tr>
<tr><td>۲۰۲۶-۰۹-۱۰</td><td><strong>p-113 جلسهٔ ۳</strong> — اپراتور روشن کرد ابزارهای جلسهٔ ۲ (Ansible/Zabbix/…) صرفاً نمونه بودند؛ هدف کلان واقعی: مدیریت اینفراستراکچر + توسعهٔ چرخهٔ دیتا در اکوسیستم بیگ‌دیتا به کمک AI — یعنی مسیر ۱ و ۲ جلسهٔ ۱ احتمالاً یک محور واحدند نه دو مسیر جدا؛ فقط ثبت شد، جمع‌بندی به جلسات بعد موکول است · <a href="p-113-infra-topology-platform.md"><code dir="ltr" style="unicode-bidi: embed;">p-113-infra-topology-platform.md</code></a></td></tr>
<tr><td>۲۰۲۶-۰۹-۱۰</td><td><strong>p-113 جلسهٔ ۲</strong> — جملهٔ کلیدی ثبت شد: «دستیار همه‌فن‌حریف سیس‌ادمین که Ansible (و مشابه) را به‌خدمت می‌گیرد، نه بازسازی می‌کند» برای محاسبهٔ ظرفیت + ست‌آپ + مانیتورینگ سرور/استوریج؛ ۴ دستهٔ رقیب جدید تحقیق شد (Semaphore/AWX، Ansible Lightspeed/K8sGPT، Turbonomic/Densify، NetBox/Zabbix/Checkmk) · <a href="p-113-infra-topology-platform.md"><code dir="ltr" style="unicode-bidi: embed;">p-113-infra-topology-platform.md</code></a></td></tr>
<tr><td>۲۰۲۶-۰۹-۱۰</td><td><strong>p-113 اضافه شد</strong> — Infra Topology &amp; Provisioning Platform · سند تحقیق/ایده‌پردازی (نه پلن اجرایی) دربارهٔ زیرساخت ویژوال (سرور/توپولوژی) که اپراتور مطرح کرد، مسیر خواهرش («ماژول‌های داده/Spark») موکول به جلسهٔ بعد شد؛ جلسهٔ ۱ چشم‌انداز بازار (Massdriver/Humanitec/Backstage/Crossplane/MAAS و ۵ سؤال باز) را جمع کرد · <a href="p-113-infra-topology-platform.md"><code dir="ltr" style="unicode-bidi: embed;">p-113-infra-topology-platform.md</code></a></td></tr>
<tr><td>۲۰۲۶-۰۹-۱۰</td><td><strong>Dashboard Canvas (p-93, p-107..p-112) به <code dir="ltr" style="unicode-bidi: embed;">todo/dashboard-canvas/</code> منتقل شد</strong> — به‌درخواست اپراتور («این تودو هست نه نکست»)؛ کار فعال است، دیگر موکول نیست. <code dir="ltr" style="unicode-bidi: embed;">p-93</code> هم همراهش رفت چون قرارداد پایهٔ مشترک همهٔ آن‌هاست. جزئیات هر سند در <a href="../todo/dashboard-canvas/README.md"><code dir="ltr" style="unicode-bidi: embed;">../todo/dashboard-canvas/README.md</code></a></td></tr>
<tr><td>۲۰۲۶-۰۹-۱۰</td><td><strong>p-112 اضافه شد</strong> — Pivot Threshold Alerts · از بحث «آیا جای Kibana را می‌گیریم» — تنها بخش ارزان/کم‌ریسک (هشدار آستانه‌ای) با سیم‌کشی صرف زمان‌بند Workflow موجود (<code dir="ltr" style="unicode-bidi: embed;">scheduleBindingAdapter.ts</code>) + Notification موجود (<code dir="ltr" style="unicode-bidi: embed;">userNotification.service.ts</code>) روی هر provider پشت Pivot API؛ هم‌زمان دامنهٔ کامل برابری با Kibana (Discover پارک، ML/APM/SIEM/مدیریت‌کلاستر رد) در <code dir="ltr" style="unicode-bidi: embed;">elasticsearch-analytics-provider.md</code> مستند شد · قرارداد در <a href="../../../docs/standards/pivot-threshold-alerts.md"><code dir="ltr" style="unicode-bidi: embed;">pivot-threshold-alerts.md</code></a></td></tr>
<tr><td>۲۰۲۶-۰۹-۱۰</td><td><strong>p-110/p-111 اضافه شدند</strong> — MongoDB Analytics Provider + Elasticsearch Analytics Provider · providerهای چهارم/پنجم پشت Pivot API، هر دو فقط خواندن/تجمیع، هیچ‌کدام در CRUD-Gen/Edge Model دیده نمی‌شوند. هم‌زمان Cassandra/DynamoDB به‌صراحت رد شدند (بدون تجمیع بومی) و پشتیبانی JSON در Postgres/SQL Server/Oracle به‌عنوان گسترش grammar فیلد (نه provider جدا) به <code dir="ltr" style="unicode-bidi: embed;">p-93</code>/PIVOT-5 اضافه شد. قرارداد در <a href="../../../docs/standards/mongodb-analytics-provider.md"><code dir="ltr" style="unicode-bidi: embed;">mongodb-analytics-provider.md</code></a> و <a href="../../../docs/standards/elasticsearch-analytics-provider.md"><code dir="ltr" style="unicode-bidi: embed;">elasticsearch-analytics-provider.md</code></a></td></tr>
<tr><td>۲۰۲۶-۰۹-۱۰</td><td><strong>p-109 اضافه شد</strong> — ROLAP Star-Schema Provider · تجمیع OLAP-گونه (dimension/hierarchy/measure) روی جدول‌های رابطه‌ای موجود، provider سوم پشت همان Pivot API، فقط مصرف داخلی (بدون سرور XMLA برای ابزار خارجی — تصمیم صریح اپراتور) · قرارداد در <a href="../../../docs/standards/rolap-star-schema.md"><code dir="ltr" style="unicode-bidi: embed;">rolap-star-schema.md</code></a></td></tr>
<tr><td>۲۰۲۶-۰۹-۱۰</td><td><strong>p-107 ساده شد — <code dir="ltr" style="unicode-bidi: embed;">FABRIC_SEMANTIC_MODEL</code> حذف شد</strong> — اپراتور تأیید کرد داده‌اش کاملاً on-prem است؛ فقط <code dir="ltr" style="unicode-bidi: embed;">OLAP_BRIDGE</code> باقی ماند</td></tr>
<tr><td>۲۰۲۶-۰۹-۰۹</td><td><strong>p-108 اضافه شد</strong> — Personalizable Dashboard Canvas · جایگزین پکیج مستقل «Dashboard Builder» که همان روز طراحی و بعد بازنشسته شد؛ تعمیم Core از <code dir="ltr" style="unicode-bidi: embed;">userDashboardLayout.ts</code> به‌جای دامنهٔ کسب‌وکاری مستقل · قرارداد در <a href="../../../docs/standards/personalizable-dashboard-canvas.md"><code dir="ltr" style="unicode-bidi: embed;">personalizable-dashboard-canvas.md</code></a></td></tr>
<tr><td>۲۰۲۶-۰۹-۰۹</td><td><strong>p-107 اضافه شد</strong> — OLAP Bridge Data Source · اتصال SSAS (MDX/DAX) به‌عنوان provider دوم پشت همان Pivot API (<code dir="ltr" style="unicode-bidi: embed;">p-93</code>)؛ بعد از رد مستند Eclipse Daanse و Dundas BI/Logi Symphony به‌عنوان جایگزین (هر دو تحقیق‌شده، سند دلیل رد در <code dir="ltr" style="unicode-bidi: embed;">olap-bridge.md</code>) · قرارداد در <a href="../../../docs/standards/olap-bridge.md"><code dir="ltr" style="unicode-bidi: embed;">olap-bridge.md</code></a></td></tr>
<tr><td>۲۰۲۶-۰۸-۲۹</td><td><strong>p-67 حذف شد</strong> — پیش‌شرطش («صبر تا موتور کامل بشه») برآورده شده بود؛ کل محتوا به‌عنوان Tier 1 در پلن جدید <code dir="ltr" style="unicode-bidi: embed;">p-100-human-workflow</code> ادغام شد و مستقیماً در <code dir="ltr" style="unicode-bidi: embed;">todo/</code> فعال شد، نه اینجا · <a href="../todo/p-100-human-workflow.md"><code dir="ltr" style="unicode-bidi: embed;">../todo/p-100-human-workflow.md</code></a></td></tr>
<tr><td>۲۰۲۶-۰۸-۲۶</td><td><strong>p-97 به <code dir="ltr" style="unicode-bidi: embed;">todo/</code> منتقل شد</strong> — HTTP Workshop فعال شد، دیگر اینجا نیست · <a href="../todo/p-97-http-workshop.md"><code dir="ltr" style="unicode-bidi: embed;">../todo/p-97-http-workshop.md</code></a></td></tr>
<tr><td>۲۰۲۶-۰۸-۲۶</td><td><strong>p-97 اضافه شد</strong> — HTTP Workshop · بازسازی به ابزار کلاینت API استاندارد (Postman-class) روی موتور PDK-8 · سند پلن آمادهٔ بررسی کاربر، هنوز کد نشده · <a href="p-97-http-workshop.md"><code dir="ltr" style="unicode-bidi: embed;">p-97-http-workshop.md</code></a></td></tr>
<tr><td>۲۰۲۶-۰۸-۲۶</td><td><strong>p-96 موکول</strong> — Native Dev Platform · موج A/B (PDK-1..9) کامل و تأیید شد از <code dir="ltr" style="unicode-bidi: embed;">todo/</code>؛ موج C طبق قاعدهٔ سخت خود پلن منتظر گیت ۰ + نود دوم است · <a href="p-96-native-dev-platform.md"><code dir="ltr" style="unicode-bidi: embed;">p-96-native-dev-platform.md</code></a></td></tr>
<tr><td>۲۰۲۶-۰۸-۲۳</td><td><strong>p-94 موکول</strong> — Component Usage · شمارندهٔ روزانه + <code dir="ltr" style="unicode-bidi: embed;">DbBatchQueue</code> · <a href="p-94-component-usage.md"><code dir="ltr" style="unicode-bidi: embed;">p-94-component-usage.md</code></a></td></tr>
<tr><td>۲۰۲۶-۰۸-۱۸</td><td><strong>p-93 موکول</strong> — Data API Pivot · قرارداد در <a href="../../../docs/standards/data-api-pivot.md"><code dir="ltr" style="unicode-bidi: embed;">data-api-pivot.md</code></a></td></tr>
<tr><td>۲۰۲۶-۰۸-۱۵</td><td><strong>بازآرایی plans</strong> — <code dir="ltr" style="unicode-bidi: embed;">done/</code> و studio-theme cancelled و p-64 superseded حذف شدند · ایندکس فقط کارهای باز</td></tr>
<tr><td>۲۰۲۶-۰۸-۱۵</td><td><strong>p-91 موکول</strong> — Mobile Apps از <code dir="ltr" style="unicode-bidi: embed;">todo/</code> · موتور Expo WebView قفل · <a href="p-91-mobile-apps-platform.md"><code dir="ltr" style="unicode-bidi: embed;">p-91-mobile-apps-platform.md</code></a></td></tr>
</tbody></table>

---

*فازهای موکول — کار فعال: [`plans/core/todo/p-00-todo-index.md`](../todo/p-00-todo-index.md)*


</div>
