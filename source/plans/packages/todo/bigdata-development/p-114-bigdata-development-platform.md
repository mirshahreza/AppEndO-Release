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

<p><strong>خلاصه برای operatore:</strong> این سند جزو <strong>plans</strong> است (p-114-bigdata-development-platform). ستون وضعیت در <a href="../p-00-packages-index.md">index مربوطه</a> مرجع «شروع شده / design / تمام» است.</p>
<p><strong>راهنمای خواندن:</strong> بخش‌های انگلیسی برای agent/dev هستند؛ جداول وضعیت و یادداشت‌های فارسی را اول بخوانید.</p>


# p-114 — Big Data Development Platform (دستیار توسعهٔ چرخهٔ دیتا — تحقیق/ایده‌پردازی)

> **فاز:** تحقیق بازار — **سند اجرا نیست**، سند ایده‌پردازی چندجلسه‌ای است
> **اولویت پیاده‌سازی:** 14 — پس از infra-management
> **وضعیت:** 🟡 جلسهٔ ۵ از N — وابستگی به Core Credential Vault (p-118) برای کلیدهای دسترسی MinIO ثبت شد. جلسهٔ ۴: مسیر قدم‌به‌قدم فاز D (۸ قدم) مستند شد؛ کشف مهم: زمان‌بندی batch از موتور زمان‌بندی موجود Workflow Engine استفاده می‌کند، نه یک scheduler جدید. فقط جملهٔ کلیدی رسمی هنوز منتظر تأیید؛ پردازش/استریم Kafka/Flink و دستیارهای AI دیتا هنوز نیازمند تحقیق تکمیلی
> **پوشه:** `plans/packages/todo/bigdata-development/` — سند خواهر: [`../infra-management/p-113-infra-management-platform.md`](../infra-management/p-113-infra-management-platform.md) (نیمهٔ «زیرساخت» همان هدف کلان)
> **پیش‌نیاز مشترک با سند خواهر:** Core Credential Vault (p-118, بسته شد) — `src/server/domain/security/credentialVault/` (`setSecret`/`getSecret`)؛ مهاجرت Hubها/Data Source برای این سند لازم نیست.

---

## دامنه (۲۰۲۶-۰۹-۱۰)

اپراتور این سند را از سند خواهر (`infra-management`) جدا کرد تا دامنهٔ «توسعهٔ چرخهٔ دیتا» مستقل رشد کند:

> جمع‌آوری، پردازش استریم‌های داده‌ای، ذخیره‌سازی، و هرچیزی که مربوط به دولوپمنت دیتا هست — مخصوصاً بیگ‌دیتا و لیک‌ها.

این گسترده‌تر از فرض اولیهٔ جلسهٔ ۱ سند خواهر («ماژول‌های داده — جمع‌آوری/استریم و پردازش با موتورهایی مثل Spark») است: علاوه‌بر پردازش، **ذخیره‌سازی/لیک** هم صریحاً داخل دامنه است.

---

## هدف کلان مشترک (زمینه، از سند خواهر — جلسهٔ ۳ آن‌جا)

> مدیریت اینفراستراکچر + توسعهٔ چرخهٔ دیتا در اکوسیستم بیگ‌دیتا، به کمک/بهره‌برداری از AI.

این سند نیمهٔ «توسعهٔ چرخهٔ دیتا» همان هدف کلان است.

> **به‌روزرسانی جلسهٔ ۳ سند خواهر (تصمیم قفل‌شده، مشترک هر دو سند):** رابطهٔ دو نیمه **یک دستیار/تجربهٔ کاربری واحد** است، نه دو محصول مستقل. یعنی این سند موتور اجرا (Ansible)، اتصال مانیتورینگ (Zabbix)، و ماشین‌حساب ظرفیت را **دوباره نمی‌سازد** — از همان مؤلفه‌های سند خواهر (`infra-management`) استفادهٔ مجدد می‌کند و فقط لایهٔ داده‌محور (طراحی پایپ‌لاین، انتخاب موتور پردازش، کامپایل به فرمت لیک) را رویش اضافه می‌کند. جزئیات در «تصمیمات قفل‌شده» پایین‌تر.

---

## جملهٔ کلیدی — پیش‌نویس (هنوز تأیید اپراتور نگرفته)

اپراتور برای سند خواهر یک جملهٔ کلیدی رسمی داد («دستیار همه‌فن‌حریف سیس‌ادمین...»)؛ برای این سند هنوز جملهٔ رسمی معادل نداریم. با قیاس مستقیم (نه تصمیم نهایی)، پیشنهاد اولیه برای بررسی:

> دستیاری برای **مهندس داده/تحلیل‌گر** که می‌داند چه پایپ‌لاین یا دیتالِیکی می‌خواهد — ما در **طراحی پایپ‌لاین**، **انتخاب موتور مناسب**، **محاسبهٔ ظرفیت پردازش/استوریج**، و **مانیتورینگ جریان داده** به او کمک می‌کنیم.

این جمله هنوز رسماً تأیید اپراتور را نگرفته. با تصمیم «یک دستیار واحد» (جلسهٔ ۳ سند خواهر)، شاید اصلاً نیازی به جملهٔ کلیدی جداگانه نباشد — می‌شود جملهٔ کلیدی سند خواهر را تعمیم داد: *«...در محاسبهٔ ظرفیت، همبندی/ست‌آپ، و مانیتورینگ — چه برای سرور، چه برای پایپ‌لاین دیتا — کمک می‌کنیم.»* این هم پیشنهاد است، تصمیم نهایی با اپراتور.

---

## موضع معماری: به‌خدمت‌گرفتن، نه بازسازی (تعمیم از سند خواهر)

همان قاعدهٔ سخت سند خواهر، برای موتورهای چرخهٔ دیتا:

<table dir="rtl">
<thead><tr><th>توکار (این ایده)</th><th>به‌خدمت‌گرفته‌شده (نمونه، نه انتخاب نهایی)</th><th>ممنوع</th></tr></thead>
<tbody><tr><td>کنواس/فرم ویژوال + دانش/توصیهٔ AI-محور برای طراحی پایپ‌لاین</td><td>Airflow/Dagster/Prefect (ارکستراسیون) · Spark/Flink/DuckDB/Polars (پردازش) · Kafka/Redpanda (استریم)</td><td>بازنویسی موتور ارکستراسیون/پردازش/استریم موجود یا جایگزینی با DSL خودمان</td></tr>
<tr><td>ذخیره‌سازی/لیک</td><td>Iceberg/Delta Lake/Hudi (فرمت جدول) روی object storage یا استوریج آن‌پرم</td><td>ساخت فرمت فایل یا موتور استوریج اختصاصی</td></tr>
<tr><td>نمایش وضعیت پایپ‌لاین/جریان داده + هشدار</td><td>متریک‌های خودِ موتور (lineage در Dagster، Kafka consumer lag، Spark UI)</td><td>ساخت موتور متریک از صفر</td></tr>
<tr><td>دستیار زبان‌طبیعی/AI که پایپ‌لاین/انتخاب موتور پیشنهاد و (با تأیید) اجرا می‌کند</td><td>مدل LLM + وضعیت واقعی پایپ‌لاین/دیتاست</td><td>جایگزینیِ قضاوت مهندس داده با اجرای خودکار بدون تأیید</td></tr>
</tbody></table>

---

## چشم‌انداز بازار (جلسهٔ ۱ — ناقص، ادامه در جلسهٔ بعد)

> **یادداشت صادقانه:** امشب به سقف جلسهٔ جست‌وجوی وب رسیدیم؛ فقط دو محور (ارکستراسیون، فرمت‌های لیک) واقعاً تحقیق و منبع‌دار شدند. پردازش/استریم (Spark/Kafka/Flink/DuckDB/Polars) و دستیارهای AI مخصوص دیتا (dbt Copilot و مشابه) از دانش عمومی اشاره شدند، بدون منبع تازه — باید در جلسهٔ بعد با جست‌وجوی واقعی تکمیل شوند.

### ۱) ارکستراسیون پایپ‌لاین (تحقیق‌شده، منبع‌دار)
- **Apache Airflow** — بالغ‌ترین و پراستفاده‌ترین؛ Python-محور، DAG-based؛ اکوسیستم/جامعهٔ بزرگ‌ترین.
- **Dagster** — asset-centric، بهترین ادغام با dbt (هر مدل dbt یک asset با lineage/freshness می‌شود)؛ مناسب تیم‌های analytics engineering.
- **Prefect** — سبک، Python-native؛ مناسب تیم‌های کوچک/مهندس داده تک‌نفره.
- **Kestra** — declarative YAML، رو به رشد.
- **Astronomer** — Airflow مدیریت‌شده (SaaS روی همان موتور OSS).
- **Mage AI, Luigi, Argo Workflows** (K8s-native), AWS Step Functions (AWS-only) — بازیگران فرعی‌تر.
اصل مهم صنعت: ارکستراتور فقط **کنترل‌پلین** است (trigger/monitor/retry)، خودش داده پردازش نمی‌کند — پردازش واقعی روی Spark/BigQuery/… انجام می‌شود. این دقیقاً همان تفکیک «توکار/به‌خدمت‌گرفته‌شده» است که در جدول بالا آمد.

### ۲) فرمت‌های جدول Lakehouse (تحقیق‌شده، منبع‌دار)
- **Apache Iceberg** — صنعت رویش به‌عنوان استاندارد تعامل‌پذیری همگرا شده؛ همهٔ کلودهای بزرگ + Snowflake/Databricks به‌طور بومی می‌خوانند/می‌نویسند.
- **Delta Lake** — بزرگ‌ترین اکوسیستم تک‌فروشنده (Databricks)؛ مسیر همگرایی با Iceberg از طریق UniForm.
- **Apache Hudi** — تخصص ingestion در سطح دیتابیس (indexing قوی)، نسخهٔ ۱.۰ منتشر شده.
- **Apache Paimon** — بومی-استریم (طراحی‌شده برای به‌روزرسانی مداوم/استریمی، نه فقط batch).
- **DuckLake** — گرایش «ساده‌گرایی» در برابر پیچیدگی سه‌گانهٔ بالا.
- **Apache XTable** — ترجمهٔ متادیتای دوطرفه بین هر سه فرمت اصلی، بدون کپی داده — گزینه‌ای برای عدم قفل‌شدن روی یک فرمت.
**نکتهٔ مهم برای مخاطب AppEndO (آن‌پرم):** این فرمت‌ها صرفاً cloud-only نیستند — نمونهٔ واقعی مستند شده: یک lakehouse مبتنی بر Iceberg کاملاً آن‌پرم برای یک خرده‌فروش خاورمیانه‌ای، و یک lakehouse چندمستأجری مبتنی بر Hudi برای یک اپراتور مخابراتی. یعنی این مسیر برای مخاطب on-prem AppEndO (طبق تأیید قبلی اپراتور در `olap-bridge.md`) واقعاً قابل‌اجراست.

### ۳) پردازش/استریم (از دانش عمومی — نیاز به تحقیق/منبع در جلسهٔ بعد)
- **Apache Spark** — استاندارد صنعتی پردازش دسته‌ای/توزیع‌شدهٔ مقیاس بزرگ؛ سنگین (نیاز به کلاستر واقعی)، منحنی یادگیری/عملیات بالا.
- **Apache Flink** — استاندارد پردازش استریم واقعی (true streaming، نه micro-batch)؛ رقیب مستقیم Spark Streaming.
- **Apache Kafka / Redpanda** — لایهٔ ingestion/پیام‌رسانی استریم؛ Redpanda به‌عنوان جایگزین سازگار-با-Kafka، سبک‌تر، بدون JVM/ZooKeeper.
- **DuckDB / Polars** — موتورهای تک‌ماشینی سریع برای مقیاس کوچک-متوسط؛ روند صنعتی رو به رشد «شاید Spark لازم نداری» برای دیتاست‌هایی که در حافظهٔ یک ماشین جا می‌شوند.

### ۴) پلتفرم‌های یکپارچهٔ سنتی بیگ‌دیتا (تحقیق‌شده، منبع‌دار — رقیب مستقیم اثبات‌شده)
- **Cloudera Data Platform (CDP)** — جانشین توزیع‌های Hadoop قدیمی Cloudera (CDH/HDP)؛ Spark، Hive، Impala، Kafka، NiFi، پشتیبانی Iceberg، Hue همه در یک باندل؛ هم on-prem هم cloud/hybrid. **این دقیقاً همان چیزی است که این سند می‌خواهد بسازد** (پردازش+استریم+لیک یکپارچه، آن‌پرم-friendly) — با این تفاوت که Cloudera enterprise/سنگین/proprietary است (قیمت مذاکره‌ای، نیاز به تیم متخصص Hadoop/Cloudera)، نه یک دستیار AI ساده برای مهندس داده‌ای که «می‌داند چه می‌خواهد».
- **نکتهٔ مهم صنعتی:** خودِ Cloudera در حال فاصله‌گرفتن از میراث Hadoop است — پلتفرم بعدی‌اش («Anywhere Cloud») صراحتاً «بدون کد Hadoop» معرفی شده. نسخه‌های فعلی CDP هم جدول زمانی End-of-Support مشخص دارند (مثلاً Cloudera Data Services on-premises 1.5.5 تا ژوئن ۲۰۲۶). یعنی حتی بازیگر مسلط قبول دارد پشتهٔ سنگین Hadoop-محور دارد به سمت منسوخ‌شدن می‌رود — دقیقاً فضایی که یک جایگزین سبک‌تر/AI-محور می‌تواند در آن رشد کند.
- جمع‌بندی: Cloudera ثابت می‌کند بازار «باندل پردازش+استریم+لیک آن‌پرم» ۲۰+ سال تقاضای واقعی دارد؛ جای خالی همچنان «سبک، AI-محور، بدون نیاز به ادمین متخصص Hadoop» است — دقیقاً هم‌راستا با جای خالی سند خواهر `infra-management` دربارهٔ Cloudera Manager.

### ۵) دستیارهای AI برای دیتا (از دانش عمومی — نیاز به تحقیق/منبع در جلسهٔ بعد)
موضوعاتی که باید جلسهٔ بعد جست‌وجوی واقعی شوند: dbt Copilot/dbt-مانند AI codegen، Snowflake Cortex/Databricks Assistant به‌عنوان نمونهٔ «دستیار AI روی پلتفرم داده»، ابزارهای AI برای طراحی/دیباگ پایپ‌لاین.

---

## ایدهٔ منتقل‌شده از سند خواهر (جلسهٔ ۴ آن‌جا)

**پیش‌فرض «کوچک‌ترین موتور کافی»، نه Spark.** بخش زیادی از بارهای کاری واقعی نیاز به Spark ندارند؛ DuckDB/Polars برای مقیاس کوچک-متوسط سریع‌تر/ارزان‌تر/ساده‌ترند. بخشی از «دانشِ» دستیار همین باشد که به مهندس داده بگوید احتمالاً Spark لازم ندارد، نه این‌که Spark پیش‌فرض شود.

---

## تصمیمات قفل‌شده (جلسهٔ ۳ — ۲۰۲۶-۰۹-۱۰، هم‌زمان با جلسهٔ ۸ سند خواهر)

<table dir="rtl">
<thead><tr><th>#</th><th>تصمیم</th><th>جزئیات</th></tr></thead>
<tbody><tr><td>۱</td><td><strong>مخاطب</strong></td><td>فقط مشتریان AppEndO Studio — طبق تصمیم مشترک با سند خواهر.</td></tr>
<tr><td>۲</td><td><strong>رابطه با سند خواهر</strong></td><td><strong>یک دستیار واحد.</strong> این سند زیرساخت (سرور/کلاستر) را از طریق همان Ansible bridge/Ops Engine سند خواهر می‌خواهد، نه با موتور پروویژنینگ جدا. جزئیات پایین («ترتیب ساخت»).</td></tr>
<tr><td>۳</td><td><strong>فرمت لیک پیش‌فرض</strong></td><td><strong>Apache Iceberg</strong>، پشت یک لایهٔ آداپتور (الگوی مشابه <code dir="ltr" style="unicode-bidi: embed;">OpsEngineType</code>) تا Delta/Hudi بعداً اضافه‌شدنی باشند. دلیل: صنعت به‌عنوان استاندارد تعامل‌پذیری همگرا شده.</td></tr>
<tr><td>۴</td><td><strong>batch یا استریم اول</strong></td><td><strong>batch اول.</strong> Spark/DuckDB روی دادهٔ ساکن؛ استریم واقعی (Kafka/Flink) در فاز بعدی، چون پیچیدگی عملیاتی به‌مراتب بیشتری دارد.</td></tr>
<tr><td>۵</td><td><strong>استوریج زیرین آن‌پرم</strong></td><td><strong>MinIO</strong> (S3-compatible خودمیزبان) پیش‌فرض — با Iceberg بومی کار می‌کند، از HDFS سنتی ساده‌تر است.</td></tr>
<tr><td>۶</td><td><strong>جملهٔ کلیدی رسمی</strong></td><td>هنوز باز — پیشنهاد بالا (تعمیم جملهٔ کلیدی سند خواهر) منتظر تأیید صریح اپراتور است؛ تنها موردی که کاملاً بسته نشده.</td></tr>
</tbody></table>

## ترتیب ساخت (تعمیم‌یافته از سند خواهر — فاز D، نه فاز جدا و مستقل)

چون رابطه «یک دستیار واحد» است، فازهای این سند **ادامهٔ** فازهای `infra-management` هستند، نه یک مسیر موازی:

```
(از سند خواهر) فاز A → فاز B → فاز C  ──▶  فاز D (این سند)
 ظرفیت+مانیتورینگ   کنواس+کامپایلر   پل اجرا+تأیید      طراحی پایپ‌لاین + کامپایلر Iceberg + انتخاب موتور پردازش
```

- **فاز D** فقط بعد از تکمیل فاز C سند خواهر منطقی است، چون به همان پل اجرا (برای بالابردن Spark/DuckDB روی سرور) و همان گیت تأیید نیاز دارد. کاری که فاز D اضافه می‌کند: (الف) کامپایلر «مشخصات پایپ‌لاین → Ansible playbook برای نصب/کانفیگ Spark/DuckDB + MinIO»، (ب) منطق «کوچک‌ترین موتور کافی» (DuckDB/Polars پیش‌فرض، Spark فقط با توجیه حجم واقعی)، (ج) اتصال مانیتورینگ به متریک‌های خودِ موتور پردازش (نه Zabbix عمومی) روی همان کنواس مشترک.
- هیچ Ansible bridge/اتصال Zabbix/ماشین‌حساب ظرفیت جداگانه‌ای برای این سند ساخته نمی‌شود — طبق تصمیم ۲ بالا.

## مسیر قدم‌به‌قدم فاز D (جلسهٔ ۴ — ۲۰۲۶-۰۹-۱۰)

جهت کلی: فازهای A تا C سند خواهر یک سرور/کلاستر آماده و مانیتورشده تحویل می‌دهند؛ فاز D همان زیرساخت را **پر از کار دیتا** می‌کند — برگشت به همان ایدهٔ اولیهٔ اپراتور («جمع‌آوری، پردازش استریم، موتورهایی مثل Spark»). این‌جا AppEndO از «دستیار سیس‌ادمین» به «دستیار مهندس داده» گسترش پیدا می‌کند، روی همان زیرساخت، بدون ساختن چیزی از نو:

1. **تعریف نیاز** — روی همان کنواس/چت مشترک؛ مهندس داده منبع→تبدیل→مقصد را توصیف می‌کند (مثلاً «لاگ فروش را هر شب جمع/پاکسازی کن و در لیک بریز»).
2. **مشاور انتخاب موتور** — قبل از هرچیز، حجم واقعی داده حساب می‌شود (تعمیم منطق ماشین‌حساب ظرفیت فاز A). اگر داده در حافظهٔ یک سرور جا می‌شود، **DuckDB/Polars** پیشنهاد می‌شود، نه Spark. Spark فقط با توجیه صریح حجم واقعی پیشنهاد می‌شود — و دلیلش باید به کاربر گفته شود («حجمتان ماهیانه ۵۰ گیگ است، نیازی به کلاستر Spark نیست»)، نه یک انتخاب کور.
3. **کامپایلر پایپ‌لاین** — هم‌الگوی کامپایلر «کنواس→Ansible» فاز B؛ مشخصات پایپ‌لاین را به دو چیز تبدیل می‌کند: (الف) playbook نصب/کانفیگ موتور انتخاب‌شده، (ب) تعریف خودِ کار پردازشی (اسکریپت/کوئری).
4. **اجرا از همان پل فاز C** — هیچ موتور اجرای جدیدی ساخته نمی‌شود؛ همان Semaphore که سرور را ست‌آپ می‌کرد، Spark/DuckDB/MinIO را هم نصب می‌کند؛ همان گیت تأیید Human Workflow این‌جا هم صدق می‌کند.
5. **فرود داده در لیک** — خروجی پردازش به‌شکل جدول Iceberg روی MinIO ذخیره می‌شود؛ ساخت این‌ها هم از همان playbook/Semaphore.
6. **زمان‌بندی (batch)** — چون batch اول انتخاب شده، اجرا باید طبق زمان‌بندی تکرار شود. **به‌جای ساختن یک scheduler جدید مخصوص دیتا، از موتور زمان‌بندی موجود Workflow Engine (`scheduleBindingAdapter.ts` — همانی که برای هشدارهای Pivot در `p-112` استفاده شده) استفاده می‌شود.**
7. **مانیتورینگ سطح پایپ‌لاین** — وضعیت هر اجرا (موفق/شکست، تعداد ردیف، مدت) از **خودِ موتور پردازش** خوانده می‌شود (نه Zabbix — Zabbix سطح سرور/CPU را می‌داند، نه سطح «این job چند ردیف پردازش کرد»)؛ روی همان داشبورد مشترک نمایش داده می‌شود.
8. **همه از طریق همان دستیار/چت** — ابزارهای جدید روی همان AppEndoo agent: `design_pipeline`، `recommend_processing_engine`، `provision_lake`، `get_pipeline_status`.

---

## منابع (جلسهٔ ۱ — ناقص)

- [Best Data Engineering Software: Top 12 Solutions in 2026 — Dagster](https://dagster.io/learn/data-engineering-software)
- [Top 10 Data Orchestration Tools 2026: Airflow vs Dagster — Valiotti Data](https://valiotti.com/top-10-data-orchestration-tools-2026/)
- [Complete Data Orchestration Comparison 2026 — Orchestra](https://www.getorchestra.io/blog/dagster-vs-prefect-vs-airflow-complete-data-orchestration-comparison-2026)
- [Airflow vs Prefect vs Dagster vs dbt vs Fivetran 2026 — Alps Agility](https://www.alpsagility.com/modern-data-stack-orchestration-2026)
- [Lakehouse Table Formats in 2026: Iceberg, Delta Lake, Hudi, Paimon, and DuckLake](https://amdatalakehouse.substack.com/p/lakehouse-table-formats-in-2026-iceberg)
- [Apache Iceberg vs Delta Lake vs Apache Hudi — Feature Comparison Deep Dive — Onehouse](https://www.onehouse.ai/blog/apache-hudi-vs-delta-lake-vs-apache-iceberg-lakehouse-feature-comparison)
- [Cloudera Data Platform (CDP) - A Complete Guide — Airbyte](https://airbyte.com/data-engineering-resources/cloudera-data-platform)
- [An overview of Cloudera Data Platform (CDP) — Adaltas](https://www.adaltas.com/en/2021/07/19/cloudera-data-platform-overview/)
- [Exclusive: Cloudera builds Hadoop-free future platform](https://channellife.ca/story/exclusive-cloudera-builds-hadoop-free-future-platform)

**ناتمام (جلسهٔ بعد جست‌وجوی واقعی لازم دارد):** دستیار AI برای دیتا/ETL (dbt Copilot و مشابه)، پردازش/استریم Kafka/Flink به‌طور خاص.

---

## لاگ

<table dir="rtl">
<thead><tr><th>تاریخ</th><th>رویداد</th></tr></thead>
<tbody><tr><td>۲۰۲۶-۰۹-۱۱</td><td><strong>p-118 بسته شد.</strong> Core Credential Vault در <code dir="ltr" style="unicode-bidi: embed;">src/server/domain/security/credentialVault/</code> پیاده شد؛ لینک پلن حذف‌شده به مسیر کد عوض شد.</td></tr>
<tr><td>۲۰۲۶-۰۹-۱۰</td><td><strong>پاورقی گیت p-118.</strong> MinIO فقط به فاز ۰ vault نیاز دارد (<code dir="ltr" style="unicode-bidi: embed;">setSecret</code> برای صاحب DB-native)، نه مهاجرت مصرف‌کننده‌های فایل‌محور. هدر پیش‌نیاز اصلاح شد.</td></tr>
<tr><td>۲۰۲۶-۰۹-۱۰</td><td><strong>جلسهٔ ۵ — وابستگی به p-118 ثبت شد.</strong> حین طراحی سند خواهر، کشف شد رمزنگاری اعتبارنامه در AppEndO ناقص/پراکنده بود؛ پلن جدید <code dir="ltr" style="unicode-bidi: embed;">p-118-credential-vault</code> ساخته شد. این سند هم به آن وابسته است چون کلیدهای دسترسی MinIO (Phase D) باید از همان vault استفاده کنند، نه یک رمزنگاری جدا. با فرض تکمیل p-118 ادامه می‌دهیم</td></tr>
<tr><td>۲۰۲۶-۰۹-۱۰</td><td><strong>جلسهٔ ۴ — مسیر قدم‌به‌قدم فاز D مستند شد.</strong> اپراتور پرسید فاز D («آیتم ۵») دقیقاً چیکار می‌کند؛ پاسخ به ۸ قدم مشخص تبدیل شد: تعریف نیاز روی کنواس مشترک → مشاور انتخاب موتور (DuckDB/Polars پیش‌فرض، Spark فقط با توجیه حجم) → کامپایلر پایپ‌لاین → اجرا از همان پل Semaphore فاز C → فرود در Iceberg/MinIO → زمان‌بندی → مانیتورینگ سطح پایپ‌لاین → ابزارهای agent. کشف مهم حین بحث: زمان‌بندی batch باید از موتور زمان‌بندی موجود Workflow Engine (<code dir="ltr" style="unicode-bidi: embed;">scheduleBindingAdapter.ts</code>، همان‌که برای <code dir="ltr" style="unicode-bidi: embed;">p-112</code> هشدار آستانه‌ای استفاده شد) استفاده مجدد کند، نه یک scheduler جدید</td></tr>
<tr><td>۲۰۲۶-۰۹-۱۰</td><td><strong>جلسهٔ ۳ — ۵ از ۶ سؤال باز بسته شد، هم‌زمان با جلسهٔ ۸ سند خواهر.</strong> رابطه با سند خواهر رسماً «یک دستیار واحد» شد (این سند موتور اجرا/مانیتورینگ/ظرفیت خودش را نمی‌سازد، از سند خواهر استفادهٔ مجدد می‌کند)؛ فرمت لیک=Iceberg، batch اول، استوریج=MinIO قفل شد؛ فازهای ساخت به‌عنوان «فاز D» ادامهٔ فازهای A/B/C سند خواهر بازتعریف شد (نه فاز مستقل). فقط جملهٔ کلیدی رسمی هنوز باز است</td></tr>
<tr><td>۲۰۲۶-۰۹-۱۰</td><td><strong>جلسهٔ ۲</strong> — اپراتور پرسید «کلادرا (Cloudera) کجای بازاره؟». Cloudera Data Platform (Spark/Hive/Impala/Kafka/NiFi/Iceberg باندل‌شده) به‌عنوان رقیب مستقیم اثبات‌شدهٔ ۲۰+ ساله اضافه شد — دستهٔ جدید ۴ در چشم‌انداز بازار. نتیجه: تقاضای بازار واقعی است، Cloudera enterprise/سنگین/proprietary است و خودش هم دارد از میراث Hadoop فاصله می‌گیرد؛ جای خالی («سبک، AI-محور») همچنان باز است</td></tr>
<tr><td>۲۰۲۶-۰۹-۱۰</td><td>سند ایجاد شد — اپراتور دستور داد از سند خواهر <code dir="ltr" style="unicode-bidi: embed;">infra-management</code> جدا شود و در پوشهٔ مستقل <code dir="ltr" style="unicode-bidi: embed;">bigdata-development/</code> زیر <code dir="ltr" style="unicode-bidi: embed;">todo/</code> بیاید. جلسهٔ ۱: دامنه (جمع‌آوری/استریم/ذخیره‌سازی/لیک) ثبت شد، دو محور بازار (ارکستراسیون، فرمت‌های لیک) تحقیق و منبع‌دار شد؛ پردازش/استریم و دستیارهای AI دیتا به‌خاطر محدودیت جلسهٔ جست‌وجو ناتمام ماند و به جلسهٔ بعد موکول شد. جملهٔ کلیدی فقط پیش‌نویس است، هنوز تأیید اپراتور نگرفته</td></tr>
</tbody></table>


</div>
