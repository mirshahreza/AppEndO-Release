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

<p><strong>خلاصه برای operatore:</strong> این سند جزو <strong>plans</strong> است (p-113-infra-management-platform). ستون وضعیت در <a href="../p-00-packages-index.md">index مربوطه</a> مرجع «شروع شده / design / تمام» است.</p>
<p><strong>راهنمای خواندن:</strong> بخش‌های انگلیسی برای agent/dev هستند؛ جداول وضعیت و یادداشت‌های فارسی را اول بخوانید.</p>


# p-113 — Infra Management Platform (دستیار مدیریت اینفراستراکچر — تحقیق/ایده‌پردازی)

> **فاز:** تحقیق بازار — **سند اجرا نیست**، سند ایده‌پردازی چندجلسه‌ای است
> **اولویت پیاده‌سازی:** 13 — پس از credential vault
> **وضعیت:** 🟢 جلسهٔ ۱۰ از N — با فرضِ «Core Credential Vault (p-118) کامل و بدون نقص پیاده‌سازی شده»، سند بازبینی و اصلاح شد: محل نگه‌داری API token همهٔ سرویس‌های بیرونی (Semaphore/AWX/Zabbix) رسماً p-118 است، نه مقایسهٔ نادرست قبلی با `bridgeApiKey`. p-118 هم فاز A (Zabbix) و هم فاز C (Semaphore/AWX) را می‌بندد. فاز بعدی = شروع کدنویسی فاز A
> **پوشه:** `plans/packages/todo/infra-management/` — سند خواهر: [`../bigdata-development/p-114-bigdata-development-platform.md`](../bigdata-development/p-114-bigdata-development-platform.md) (نیمهٔ «چرخهٔ دیتا» همان هدف کلان)
> **مرتبط:** [p-96-native-dev-platform](../../../core/next/p-96-native-dev-platform.md) (کارخانهٔ تحویل هسته) · Core Credential Vault (p-118, بسته شد) — `src/server/domain/security/credentialVault/` (`setSecret`/`getSecret`)

---

## دامنهٔ این سند در برابر سند خواهر (۲۰۲۶-۰۹-۱۰، جلسهٔ ۵)

اپراتور صراحتاً این ایده را به **دو طرح مجزا در دو پوشه** تقسیم کرد:

1. **این سند (`infra-management`)** — مدیریت اینفراستراکچر: سرور، شبکه، استوریج، توپولوژی، ظرفیت، مانیتورینگ. **الزاماً مختص بیگ‌دیتا نیست** — دامنهٔ عمومی زیرساخت است — اما باید از ابتدا **ویژگی‌های خاصی برای بیگ‌دیتا پیش‌بینی کند** (پایین را ببینید).
2. **سند خواهر (`bigdata-development`)** — توسعهٔ چرخهٔ دیتا در اکوسیستم بیگ‌دیتا: جمع‌آوری، پردازش استریم، ذخیره‌سازی/لیک، و هرچیز مربوط به دولوپمنت دیتا.

هر دو سند از یک **هدف کلان مشترک** می‌آیند (ثبت‌شده در جلسهٔ ۳، پیش از تفکیک به دو پوشه): مدیریت اینفراستراکچر + توسعهٔ چرخهٔ دیتا در اکوسیستم بیگ‌دیتا، به کمک/بهره‌برداری از AI.

> **به‌روزرسانی جلسهٔ ۸ (تصمیم قفل‌شده):** تفکیک به دو پوشه فقط برای رشد مستقل *اسناد* بود، نه محصول. رابطهٔ نهایی دو طرح **یک دستیار/تجربهٔ کاربری واحد** است — `bigdata-development` موتور اجرا/مانیتورینگ/ماشین‌حساب ظرفیتِ همین سند را دوباره نمی‌سازد، از همان‌ها استفادهٔ مجدد می‌کند و فقط لایهٔ داده‌محور را روی آن می‌افزاید. جزئیات در «تصمیمات قفل‌شده» پایین‌تر.

### ویژگی‌های ویژهٔ بیگ‌دیتا که این سند باید پیش‌بینی کند (بدون این‌که فوکوس اصلی‌اش شود)
- **آگاهی از توپولوژی خوشه‌ای/توزیع‌شده** — کلاسترهای چندگرهی (Spark/Kafka/Hadoop-style) نیازهای خاصی دارند که یک سرور تکی ندارد: rack-awareness، replication factor، quorum sizing، پهنای باند شبکهٔ بین‌گرهی. محاسبهٔ ظرفیت باید این الگو را به‌عنوان یک «شکل توپولوژی» بشناسد، نه فقط CPU/RAM/Storage یک ماشین.
- **ظرفیت‌سنجی متمرکز بر I/O، نه فقط CPU/RAM** — بارهای کاری داده‌محور معمولاً throughput/IOPS دیسک و شبکه محدودکننده‌اند، نه CPU — پارامتری که در فرم‌های ظرفیت‌سنجی سنتی (وب‌سرور معمولی) اغلب نادیده گرفته می‌شود.
- **نقطهٔ اتصال به سند خواهر** — اگر `bigdata-development` تصمیم بگیرد یک کلاستر Spark/Kafka لازم دارد، باید بتواند «نیاز» را از این سند (یا موتور مشترکش) به‌عنوان سرویس بخواهد، نه این‌که دوباره منطق پروویژنینگ زیرساخت را در خودش بسازد.

---

## هدف کلان (زمینه، از جلسهٔ ۳ — پیش از تفکیک به دو پوشه)

> اپراتور: Ansible/Zabbix/Checkmk/NetBox/Turbonomic که در جلسهٔ ۲ اسم برده شدند **صرفاً نمونه** بودند. **هدف کلی، مدیریت اینفراستراکچر + توسعهٔ چرخهٔ دیتا در اکوسیستم بیگ‌دیتا است، به کمک/بهره‌برداری از AI.**

---

## جملهٔ کلیدی (North Star — ۲۰۲۶-۰۹-۱۰)

> چیزی که دوست داریم بسازیم یک **دستیار همه‌فن‌حریف برای سیس‌ادمین** است. کسی که دانش دارد و می‌داند می‌خواهد چه‌کار کند — ما در **محاسبهٔ ظرفیت‌های موردنیاز**، **همبندی و ست‌آپ**، و **مانیتورینگ سرورها و استوریج‌ها** به او کمک می‌کنیم.

نکتهٔ صریح اپراتور دربارهٔ موضع معماری: **قرار نیست چیزی مثل Ansible بسازیم.** قرار است ابزار بالغ موجود (Ansible یا معادلش) را **به خدمت بگیریم** تا ادمین بتواند با آن ساده کار کند — تا جایی که ممکن است، گرافیکی و ویژوال. یعنی موتور اجرا عوض نمی‌شود؛ لایه‌ای که رویش می‌نشیند (دانش، محاسبه، تجربهٔ ویژوال، AI) محصول ماست.

---

## موضع معماری: به‌خدمت‌گرفتن، نه بازسازی

قاعدهٔ سخت (باید در هر پلن اجرایی بعدی هم رعایت شود، هم‌ردیف با قاعدهٔ مشابه در `olap-bridge.md` — «bridge خارجی، نه وابستگی داخلی»). ستون وسط **نمونه** است، نه فهرست بسته:

<table dir="rtl">
<thead><tr><th>توکار (این ایده)</th><th>به‌خدمت‌گرفته‌شده (نمونه، نه انتخاب نهایی)</th><th>ممنوع</th></tr></thead>
<tbody><tr><td>دیالوگ/فرم/کنواس ویژوال + محاسبهٔ ظرفیت + دانش/توصیهٔ AI-محور</td><td>Ansible / AWX یا معادل (اجرای واقعی ست‌آپ)</td><td>بازنویسی موتور اجرا یا جایگزینی آن با DSL خودمان</td></tr>
<tr><td>نمایش وضعیت + هشدار + توپولوژی زنده</td><td>Zabbix / Checkmk / Prometheus (جمع‌آوری متریک واقعی)</td><td>ساخت agent مانیتورینگ از صفر</td></tr>
<tr><td>دستیار زبان‌طبیعی/AI که اقدام پیشنهاد و (با تأیید) اجرا می‌کند</td><td>مدل LLM (مشابه الگوی Ansible Lightspeed) + inventory واقعی</td><td>جایگزینیِ قضاوت ادمین با اجرای خودکار بدون تأیید</td></tr>
</tbody></table>

الگوی رابطه دقیقاً «Semaphore UI روی Ansible» یا «Ansible Lightspeed روی Ansible Automation Platform» است: خودِ AppEndO موتور اتوماسیون تولید نمی‌کند، **رویش یک لایهٔ دانش + ویژوال + محاسبه + AI** می‌سازد.

---

## چرا این جدا از کارهای فعلی است

کارهای فعال/موکول فعلی (`p-93` Pivot API، `p-107` OLAP Bridge، `p-109` ROLAP، `p-110`/`p-111` Mongo/Elasticsearch providers، `p-108` Dashboard Canvas) همگی روی **گزارش‌گیری/BI روی داده‌ی موجود** هستند. این‌جا حرف از **تولید/تأمین خودِ زیرساخت** (سرور، شبکه، کلاستر) است — لایه‌ای زیرِ همهٔ آن‌ها، نه کنارشان. هیچ‌کدام از اسناد قفل‌شدهٔ فعلی را نقض یا تکرار نمی‌کند.

---

## چشم‌انداز بازار

بازار «Internal Developer Platform / Platform Engineering» را در جلسهٔ ۱ به پنج دسته تقسیم کردیم. با جملهٔ کلیدی («دستیار همه‌فن‌حریف سیس‌ادمین، به‌خدمت‌گیرندهٔ Ansible») مرکز ثقل به سمت چهار دستهٔ **جدید** (۶ تا ۹) جابه‌جا شد که دقیق‌تر با این ایده منطبق‌اند:

### ۱) ارکستراتورهای ویژوال (نزدیک‌ترین قیاس به ایدهٔ اپراتور)
- **Massdriver** — کنواس ویژوال: بلوک‌های IaC آماده (Terraform/OpenTofu/Helm/Bicep) را می‌کشی، به هم وصل می‌کنی، دیپلوی می‌شود؛ کنواس خودِ workflow است، نه فقط تصویرسازی. بدون YAML/IaC برای دولوپر.
- **Humanitec** — Score-based، YAML-محور، پایپ‌لاین از طریق GitHub Actions/ArgoCD؛ تیم پلتفرم باید Resource Definition برای هر نوع منبع بنویسد.
- **Facets.cloud** — control-plane orchestration، مشابه Humanitec، لایهٔ orchestration بالای Terraform.

### ۲) پورتال‌های کاتالوگ (لایهٔ نمایش، نه پروویژنینگ)
- **Backstage.io** (Spotify، OSS) / **Port** — کاتالوگ سرویس‌ها + software templates؛ پروویژنینگ واقعی را به پلاگین Terraform/CloudFormation واگذار می‌کنند.

### ۳) کنترل‌پلین‌های Kubernetes-native (لایهٔ زیرین، بدون UI)
- **Crossplane** — IaC-as-Kubernetes-CRD.
- **Kratix** — «Platform-as-a-Product»، Promises روی kubectl/GitOps.
- **Score** (مشخصات Humanitec) — قرارداد workload، نه محصول مستقل.

### ۴) PaaS سبک خودمیزبان
- **Coolify, CapRover, Dokploy** — رایگان/OSS، دیپلوی Docker روی سرور خودت، بدون کنواس توپولوژی واقعی.
- **Northflank** — Kubernetes-native، مدل مصرفی (~$5/کانتینر/ماه).

### ۵) پروویژنینگ آن‌پرم/بِر-متال (مخاطب دقیقاً هم‌جنس AppEndO)
- **Canonical MAAS, MetalSoft, Platform9 Managed Bare Metal, Microsoft SCVMM Self-Service Portal** — تنها گروهی که روی سرور/VM فیزیکی و آن‌پرم کار می‌کنند، اما محصولات سنگین/سازمانیِ زیرساخت‌محور (ops-driven) هستند، نه developer-need-driven.

### گروه IaC/CI جدا (برای مقایسهٔ مدل قیمت‌گذاری، نه رقیب مستقیم)
Spacelift (concurrency/worker)، env0 (apply/environment + FinOps)، Terraform Cloud (resources-under-management)، Scalr (run).

### ۶) پوسته‌های ویژوال روی Ansible (دقیقاً همان الگوی «به‌خدمت‌گرفتن»)
- **Semaphore UI** — یک باینری Go، وب‌UI کامل روی Ansible/Terraform/OpenTofu/PowerShell، نصب زیر ۵ دقیقه، حداقل منابع (512MB RAM).
- **AWX** — همان ایده ولی سنگین‌تر (نیاز به Kubernetes، ۸+ گیگ RAM).
- **Rundeck** — عمومی‌تر از فقط-Ansible، پیچیده‌تر برای شروع.
هیچ‌کدام محاسبهٔ ظرفیت یا دانش/توصیه ندارند — فقط «دکمه‌ای برای اجرای playbook موجود»‌اند.

### ۷) دستیارهای هوشمند AIOps / کمک‌نویس زیرساخت
- **Ansible Lightspeed with IBM watsonx Code Assistant** — از زبان طبیعی، playbook/role تولید می‌کند؛ نزدیک‌ترین محصول به «دستیار هوشمند برای Ansible» — اما هدفش نویسندهٔ Ansible ماهر است، نه ادمینی که بدون YAML کار می‌کند؛ محاسبهٔ ظرفیت/مانیتورینگ در دامنه‌اش نیست.
- **K8sGPT / kubectl-ai / Botkube / Sedai** — تشخیص/توصیهٔ زبان‌طبیعی روی خطاهای K8s موجود؛ فقط تشخیص/توضیح، نه ست‌آپ اولیه یا محاسبهٔ ظرفیت.

### ۸) ابزارهای محاسبهٔ ظرفیت (Capacity Planning) با AI
- **IBM Turbonomic** — right-sizing و پیش‌بینی ظرفیت از تله‌متری واقعی؛ سناریوسازی what-if.
- **Densify** — مشابه، تمرکز روی حجم داده/انطباق.
هر دو تحلیلی/توصیه‌ای‌اند (نه اجراکننده)، enterprise/گران، عمدتاً VMware/multicloud-محور.

### ۹) مستندساز توپولوژی/DCIM + مانیتورینگ آن‌پرم بالغ
- **NetBox** — منبع حقیقت برای رَک/کابل‌کشی/IP/توپولوژی؛ «سیستم ثبت» نه «کنترلر».
- **Zabbix** (عمق سرور/شبکه)، **Checkmk** (auto-discovery قوی، توپولوژی، Proxmox/K8s built-in)، **LibreNMS** (کشف از CDP/LLDP/OSPF/BGP/SNMP/ARP).

### ۱۰) مدیریت کلاستر بیگ‌دیتا آن‌پرم (نزدیک‌ترین رقیب واقعی/اثبات‌شده به «ویژگی‌های ویژهٔ بیگ‌دیتا» بالا)
- **Cloudera Manager** — پروویژنینگ/کانفیگ/توپولوژی/مانیتورینگ کلاستر Hadoop/Spark/Kafka؛ دقیقاً همان rack-awareness/replication-factor/quorum-sizing که در بخش «ویژگی‌های ویژهٔ بیگ‌دیتا» بالا پیش‌بینی شد، اینجا از ۲۰+ سال پیش عملیاتی است. بیش از ۲۰ سال سابقهٔ enterprise، عمدتاً on-prem؛ proprietary، قیمت مذاکره‌ای (بدون لیست عمومی)، نیاز به ادمین متخصص Hadoop/Cloudera.
- **Apache Ambari** — معادل رایگان/OSS برای همان نقش (پروویژنینگ/مدیریت/مانیتورینگ کلاستر Hadoop)؛ به‌گفتهٔ منابع کمتر بالغ و فاقد قابلیت‌های پیشرفتهٔ Cloudera Manager؛ روی ابزارهای OSS دیگر (Puppet، Nagios) سوار است.
**نکتهٔ مهم:** خودِ Cloudera دارد از میراث Hadoop فاصله می‌گیرد — پلتفرم بعدی‌اش («Anywhere Cloud») صراحتاً «بدون کد Hadoop» معرفی شده، یعنی حتی این بازیگر مسلط قبول دارد پشتهٔ سنگین/سنتی دارد منسوخ می‌شود. **این‌ها اثبات می‌کنند بازار «مدیریت زیرساخت بیگ‌دیتا آن‌پرم» ۲۰+ سال تقاضای واقعی دارد، ولی هیچ نسخهٔ سبک/ویژوال/AI-محورش وجود ندارد** — دقیقاً جای خالی این سند.

---

## یافتهٔ کلیدی: جای خالی

<table dir="rtl">
<thead><tr><th>ویژگی</th><th>Ansible+Semaphore/AWX</th><th>Ansible Lightspeed / K8sGPT</th><th>Turbonomic/Densify</th><th>NetBox+Zabbix/Checkmk</th><th>Cloudera Manager/Ambari</th><th><strong>جای خالی برای AppEndO</strong></th></tr></thead>
<tbody><tr><td>رابط ویژوال/گرافیکی ساده روی موتور اجرای واقعی</td><td>✅</td><td>❌ (اکثراً CLI/VSCode)</td><td>تا حدی (داشبورد)</td><td>✅ (Checkmk)</td><td>✅ (وب‌UI بالغ)</td><td>باید حفظ شود</td></tr>
<tr><td>دانش/دستیار زبان‌طبیعی که «چیکار باید کرد» را می‌فهمد</td><td>❌</td><td>✅</td><td>❌ (فقط عدد/نمودار)</td><td>❌</td><td>❌</td><td>باید ساخته شود</td></tr>
<tr><td><strong>محاسبهٔ ظرفیت</strong> پیوسته با ست‌آپ و مانیتورینگ در یک تجربه</td><td>❌</td><td>❌</td><td>✅ ولی جدا از اجرا/ست‌آپ</td><td>❌</td><td>تا حدی (فقط برای Hadoop/Spark/Kafka)</td><td><strong>ترکیب این سه در یک دستیار، فراتر از فقط بیگ‌دیتا</strong></td></tr>
<tr><td>آن‌پرم/بِرمتال ساده، بدون قفل‌شدن به VMware/AWS/GCP، بدون هزینهٔ enterprise مذاکره‌ای</td><td>✅ (OSS)</td><td>✅</td><td>❌</td><td>✅ (OSS)</td><td>❌ (proprietary، مذاکره‌ای) / Ambari ✅ ولی کم‌قابلیت</td><td>باید حفظ شود</td></tr>
<tr><td>سادگی برای ادمین غیرمتخصص (بدون نیاز به تخصص عمیق ابزار زیرین)</td><td>تا حدی</td><td>❌ (هدفش نویسندهٔ ماهر است)</td><td>❌</td><td>تا حدی</td><td>❌ (نیاز به ادمین متخصص Hadoop/Cloudera)</td><td><strong>این هم باید حفظ شود — نقطهٔ ضعف اصلی Cloudera</strong></td></tr>
</tbody></table>

جمع‌بندی: تک‌تک قابلیت‌ها (رابط ساده روی Ansible، دستیار زبان‌طبیعی، محاسبهٔ ظرفیت، مانیتورینگ/توپولوژی) هرکدام در بازار جواب دارند، ولی **در سه محصول جدا** پخش‌اند. فرضیهٔ تمایز نهایی: مزیت «AppEndO لایهٔ اپ را هم می‌شناسد» (Workflow/Data Sources/Packages) می‌تواند ورودیِ محاسبهٔ ظرفیت را از تعریف واقعی اپ استخراج کند، به‌جای پرسیدن دستی از ادمین.

### زمینهٔ بازار (برای توجیه سرمایه‌گذاری)
- Platform Engineering از ۴۵٪ (۲۰۲۲) به ۵۵٪ (۲۰۲۵) و پیش‌بینی ۸۰٪ (۲۰۲۶) در سازمان‌های بزرگ رسیده؛ رشد بازار IDP ~۲۵٪ CAGR.
- بودجهٔ پلتفرم در سازمان‌های پیشرو ۵-۱۰ میلیون دلار، ولی ۴۷٪ سازمان‌ها هنوز زیر ۱ میلیون دلار.
- هیچ مدل قیمت‌گذاری استانداردی در بازار نیست — فضای آزاد برای تعریف مدل خودِ AppEndO.

---

## این ابزار از کدام خانواده است؟ (جلسهٔ ۷ — ۲۰۲۶-۰۹-۱۰)

اپراتور پرسید ابزار ما با کدام یک از ۱۰ خانوادهٔ بالا قابل‌مقایسه است. جواب: **هیچ‌کدام به‌تنهایی** — ترکیبی از چهار خانواده است، که خودش تأییدی بر «جای خالی» بالاست:

<table dir="rtl">
<thead><tr><th>لایهٔ محصول ما</th><th>خانواده</th><th>نزدیک‌ترین قیاس</th><th>فرقش با ما</th></tr></thead>
<tbody><tr><td>اجرای واقعی ست‌آپ (رابط ویژوال روی Ansible)</td><td>۶ — پوسته‌های ویژوال روی Ansible</td><td><strong>Semaphore UI</strong></td><td>Semaphore فقط دکمهٔ اجرای playbook موجود است؛ دانش/محاسبه ندارد</td></tr>
<tr><td>دستیار زبان‌طبیعی/دانش</td><td>۷ — AIOps copilot</td><td><strong>Ansible Lightspeed</strong></td><td>Lightspeed برای نویسندهٔ ماهر Ansible کد تولید می‌کند؛ ما برای ادمینی هستیم که اصلاً نمی‌خواهد YAML ببیند</td></tr>
<tr><td>محاسبهٔ ظرفیت</td><td>۸ — Capacity Planning با AI</td><td><strong>Turbonomic/Densify</strong></td><td>آن‌ها enterprise/گران‌اند و عمدتاً *بعد از* استقرار right-size می‌کنند؛ ما باید *قبل از* استقرار هم اندازه‌گیری کنیم (sizing سبزفیلد)</td></tr>
<tr><td>مانیتورینگ/توپولوژی زنده</td><td>۹ — DCIM + مانیتورینگ</td><td><strong>Zabbix / Checkmk</strong> (wrap می‌شوند، نه بازسازی)</td><td>خودشان دستیار/محاسبه ندارند، فقط داده خام می‌دهند</td></tr>
</tbody></table>

**نزدیک‌ترین «پیش‌نمونهٔ کامل و باندل‌شده»** (نه فقط یک لایه، محصولی که هر چهار کار را زیر یک سقف دارد): **Cloudera Manager** — همین ایده، ۲۰ سال پیش، فقط برای Hadoop/Spark/Kafka، سنگین، proprietary، بدون لایهٔ AI/زبان‌طبیعی.

جمع‌بندی یک‌خطی: **Semaphore UI (اجرا) + Ansible Lightspeed (دانش/زبان طبیعی) + یک Turbonomic سبک/رایگان (محاسبه) + پوششی روی Zabbix/Checkmk (مانیتورینگ)** — همه زیر یک تجربهٔ واحد، برخلاف Cloudera Manager نه محدود به بیگ‌دیتا و نه سنگین/enterprise.

---

## چه چیزی دقیقاً پیاده‌سازی می‌کنیم (جلسهٔ ۷)

شش تکه، همه **کد جدید AppEndO** — دقیقاً همان چیزهایی که هیچ ابزار بیرونی در بازار ندارد:

1. **ماشین‌حساب ظرفیت** — فرم/ویزارد (یا مکالمهٔ AI) که از نیاز (یا از تعریف واقعی اپ، طبق فرضیهٔ تمایز اصلی) ورودی می‌گیرد و CPU/RAM/دیسک/IOPS/شبکه (و برای کلاستر: تعداد نود/replication factor) پیشنهاد می‌دهد. اول heuristic ساده (طبق سؤال باز ۴)، بعد یادگیری‌محور.
2. **کنواس ویژوال توپولوژی** — روی `@xyflow/react` که از قبل در کدبیس نصب است (همان‌که Workflow Engine استفاده می‌کند)؛ سرورها/نقش‌ها/لینک شبکه را نشان می‌دهد.
3. **کامپایلر کنواس → Ansible** — همان الگوی `PivotSpec`→SQL/MDX که برای Pivot API داریم؛ اینجا: گراف کنواس → Ansible inventory/playbook.
4. **پل اجرا (Execution Bridge)** — playbook کامپایل‌شده را از طریق REST API به **Semaphore UI** (پیش‌فرض v1) می‌فرستد (جدول زیر و بخش «مدل اتصال اجرا» پایین).
5. **گیت تأیید** — از موتور Human Workflow (p-100) استفادهٔ مجدد؛ قبل از هر اجرا، پیش‌نمایش تغییرات + تأیید صریح ادمین (خط قرمز سؤال باز ۵).
6. **toolset روی AppEndoo agent + Infra Enricher** — ابزارهایی مثل `calculate_capacity`/`propose_setup_plan`/`get_monitoring_status` که با هر استفاده، دانش واقعی زیرساخت را ذخیره/غنی می‌کنند (ایدهٔ ۲ بالا).

### به چه زیرساخت بیرونی وصل می‌شویم (مدیریت می‌کنیم، پوسته می‌سازیم، بازسازی نمی‌کنیم)

<table dir="rtl">
<thead><tr><th>زیرساخت بیرونی</th><th>نقش</th><th>الگو</th></tr></thead>
<tbody><tr><td><strong>Semaphore UI</strong> (پیش‌فرض v1) — یا <strong>AWX/Ansible Automation Platform</strong> به‌عنوان جایگزین برای اپراتورهایی که از قبل دارند</td><td>پنل کنترلی که خودش روی Ansible سوار است و آن را اجرا می‌کند</td><td>AppEndO فقط <strong>API</strong> آن را صدا می‌زند (<code dir="ltr" style="unicode-bidi: embed;">OpsEngineType</code> adapter)؛ API token در <strong>Core Credential Vault (p-118)</strong> ذخیره می‌شود، نه یک رمزنگاری تازه — هیچ کد Ansible/bridge خودساخته‌ای نداریم</td></tr>
<tr><td>موتور مانیتورینگ — Zabbix (پیش‌فرض v1)</td><td>متریک/وضعیت زنده</td><td>فقط API آن خوانده می‌شود (<code dir="ltr" style="unicode-bidi: embed;">MonitoringProviderType</code>)؛ API token آن هم در همان <strong>Core Credential Vault (p-118)</strong> ذخیره می‌شود</td></tr>
<tr><td>سرورهای واقعی مدیریت‌شونده</td><td>هدف نهایی همهٔ عملیات</td><td>AppEndO هرگز مستقیم به آن‌ها وصل نمی‌شود — فقط Semaphore/AWX (و از طریقش Ansible) به آن‌ها SSH می‌زند</td></tr>
<tr><td>مدل LLM</td><td>لایهٔ دانش/زبان‌طبیعی</td><td>همان زیرساخت مدلی که AppEndoo agent از قبل دارد</td></tr>
</tbody></table>

### مدل اتصال اجرا و محل کردنشیال (جلسهٔ ۹ — ۲۰۲۶-۰۹-۱۰، تصمیم قفل‌شده)

سه لایه، هیچ‌کدام رابط کاربری‌شان را به دیگری نشان نمی‌دهد:

```
AppEndO (رابط کاربری کامل خودش: کنواس/چت/داشبورد)
   │  فقط REST API — هیچ صفحهٔ Semaphore داخل AppEndO لود نمی‌شود
   ▼
Semaphore UI/AWX (پنل کنترل — کردنشیال SSH سرورها این‌جا نگه‌داری می‌شود)
   │  خودش Ansible را اجرا می‌کند
   ▼
Ansible  →  سرورهای واقعی (SSH)
```

- **کردنشیال سرورهای واقعی هرگز داخل دیتابیس AppEndO ذخیره نمی‌شود.** فقط یک‌بار، در راه‌اندازی اولیه، ادمین مستقیماً داخل رابط Semaphore/AWX کلید SSH/یوزرپسورد را وارد می‌کند — دقیقاً همان قاعدهٔ «احراز هویت Bridge→SSAS کار خودِ bridge است» که در `olap-bridge.md` قفل شد، اینجا با Semaphore/AWX به‌جای bridge.
- **AppEndO فقط یک API token برای صحبت با Semaphore/AWX (و یک token جدا برای Zabbix) نگه می‌دارد** — نه کلید SSH سرورها. این توکن‌ها از طریق **Core Credential Vault (p-118)** رمزنگاری‌شده ذخیره می‌شوند (`ownerType: 'infra_ops_engine'`/`'infra_monitoring'`، `getSecret`/`setSecret` — نه یک فایل رمزنگاری تازه و جداگانه برای این پلن). **تصحیح نسبت به جلسهٔ ۹:** قبلاً این‌جا با `bridgeApiKey` در OLAP Bridge مقایسه شده بود؛ بررسی دقیق‌تر (که به‌طور مستقیم به ایجاد p-118 منجر شد) نشان داد آن الگو خودش از مسیر متن‌سادهٔ `dataSourcesStore.ts`/`settings.json` رد می‌شود — یعنی رمزنگاری نمی‌شود. پس مرجع درست از این به بعد **Core Credential Vault**، نه `bridgeApiKey`، است.
- **کار روزمره (اجرا/مانیتور/نگاه‌کردن) همیشه از داخل رابط AppEndO انجام می‌شود** — ادمین بعد از تنظیم اولیه دیگر نیازی به بازکردن Semaphore ندارد.
- **هیچ bridge خودساختهٔ AppEndO وجود ندارد** — ایدهٔ قبلی «bridge سبک خودمان روی `ansible-runner`» رد شد، چون Semaphore دقیقاً همان نقش را از قبل پر می‌کند (تناقض مستقیم با اصل «به‌خدمت‌گرفتن نه بازسازی» بود).

### چه لایبری‌هایی تزریق می‌کنیم

**تقریباً هیچی جدید** — نتیجهٔ مستقیم اصل «به‌خدمت‌گرفتن نه بازسازی»:

- کنواس ویژوال: هیچی جدید — `@xyflow/react` (^12.11.2) از قبل در `package.json` هست.
- نمودار ظرفیت/متریک: هیچی جدید — `echarts` (^6.1.0) از قبل در `package.json` هست.
- ارتباط با Semaphore/AWX/Zabbix: هیچی جدید — همه REST/JSON-RPC هستند، با HTTP client موجود کافی است.
- ذخیرهٔ API token: هیچی جدید — از ماژول موجود **Core Credential Vault (p-118)** استفاده می‌شود، نه یک فایل رمزنگاری تازه (این خودش تعمیم مستقیم اصل «به‌خدمت‌گرفتن نه بازسازی» رو به داخل خودِ AppEndO است).
- موتور AI/agent: هیچی جدید — همان AppEndoo agent framework.
- موتور approval: هیچی جدید — همان Human Workflow.
- تنها کاندیدای احتمالی که امروز نداریم: یک کتابخانهٔ SSH مستقیم (مثل `ssh2`) — طبق تصمیم فعلی لازم نیست، چون fact-gathering از خروجی خودِ Ansible گرفته می‌شود، نه اتصال مستقیم AppEndO به هاست‌ها.

---

## ایده‌های Claude برای بررسی (پیشنهاد، نه تصمیم)

هر ایده یک اصل دارد: به‌جای طراحی از صفر، از سرمایه‌گذاری‌های معماری‌ای که AppEndO **همین الان** دارد استفاده کنیم:

1. **دستیار جدید نسازیم؛ toolset جدید روی AppEndoo agent موجود.** AppEndO از قبل یک agent framework دارد که ممیزی/اصلاح شده (p-63، p-98).
2. **الگوی «Enricher» را از SQL Console AI Assistant بیاوریم.** «Infra Enricher»ای که از facts واقعی (خروجی Ansible، متریک مانیتورینگ) دانش توپولوژی را می‌سازد/به‌روز می‌کند — برخلاف NetBox که کاملاً دستی‌ثبت است.
3. **معماری Provider پشت یک قرارداد ثابت را از Pivot API کپی کنیم.** الگوی `DataSourceType` + provider دقیقاً همان شکلی است که «موتور عملیات» (Ansible/معادل) لازم دارد.
4. **گیت تأیید تغییرات را از موتور Human Workflow (p-100) بگیریم، نسازیم.** به‌جای طراحی مکانیزم تأیید جدید، همان موتور approval موجود به‌خدمت گرفته شود.
5. **حلقهٔ بازخورد پیش‌بینی↔واقعیت برای محاسبهٔ ظرفیت.** پیشنهاد اولیه (heuristic) یک‌بارمصرف نباشد؛ با دادهٔ مانیتورینگ واقعیِ بعد از ست‌آپ، دوباره کالیبره شود — نسخهٔ سبک‌تر و رایگان از Turbonomic.

> ایدهٔ ششم جلسهٔ ۴ («کوچک‌ترین موتور کافی، نه Spark به‌طور پیش‌فرض») به سند خواهر `bigdata-development` منتقل شد چون مربوط به انتخاب موتور پردازش دیتا است، نه زیرساخت.

---

## تصمیمات قفل‌شده (جلسهٔ ۸ — ۲۰۲۶-۰۹-۱۰)

هر ۷ سؤال باز قبلی با اپراتور بسته شد. از این‌جا به بعد این‌ها **قاعده‌اند**، نه گزینه:

<table dir="rtl">
<thead><tr><th>#</th><th>تصمیم</th><th>جزئیات</th></tr></thead>
<tbody><tr><td>۱</td><td><strong>مخاطب</strong></td><td>فقط مشتریان AppEndO Studio. یعنی مزیت «استنتاج از تعریف اپ» (Workflow/Data Sources/Packages) یک قابلیت واقعی v1 است، نه فرضیهٔ دور — چون کاربر همیشه داخل Studio است. ابزار مستقل/بازار عمومی هدف نیست.</td></tr>
<tr><td>۲</td><td><strong>رابطه با سند خواهر (<code dir="ltr" style="unicode-bidi: embed;">bigdata-development</code>)</strong></td><td><strong>یک دستیار/تجربهٔ واحد.</strong> یعنی <code dir="ltr" style="unicode-bidi: embed;">bigdata-development</code> موتور اجرا/مانیتورینگ/ماشین‌حساب ظرفیت خودش را دوباره نمی‌سازد — از همین Ansible bridge، همین اتصال Zabbix، همین ماشین‌حساب ظرفیت این سند استفاده مجدد می‌کند و فقط لایهٔ داده‌محور (طراحی پایپ‌لاین، انتخاب موتور پردازش، فرمت لیک) را روی آن اضافه می‌کند. یک چت/کنواس مشترک، نه دو رابط جدا.</td></tr>
<tr><td>۳</td><td><strong>دامنهٔ دقیق «توپولوژی»</strong></td><td>v1 فقط سرور فیزیکی/VM/استوریج/شبکهٔ ساده. مدیریت کلاستر Kubernetes (شبیه Rancher) <strong>در دامنهٔ v1 نیست</strong> — دنیای جدا با ابزار بالغ خودش.</td></tr>
<tr><td>۴</td><td><strong>موتور اجرای پایه</strong></td><td><strong>Ansible</strong> در v1 — نه مستقیم، بلکه از طریق <strong>Semaphore UI</strong> (پنل کنترلی که خودش روی Ansible سوار است) — پشت یک قرارداد داخلی <code dir="ltr" style="unicode-bidi: embed;">OpsEngineType</code> (دقیقاً الگوی <code dir="ltr" style="unicode-bidi: embed;">DataSourceType</code> در Pivot API) تا AWX/Terraform بعداً بدون بازطراحی اضافه شوند. جزئیات کامل در «مدل اتصال اجرا» (جلسهٔ ۹) پایین‌تر.</td></tr>
<tr><td>۵</td><td><strong>موتور مانیتورینگ پایه</strong></td><td><strong>Zabbix</strong> در v1، پشت <code dir="ltr" style="unicode-bidi: embed;">MonitoringProviderType</code> مشابه؛ Checkmk/Prometheus بعداً پشت همان قرارداد.</td></tr>
<tr><td>۶</td><td><strong>هوشمندی محاسبهٔ ظرفیت</strong></td><td>v1 = قانون‌محور/heuristic ساده. مدل یادگیری‌محور (شبیه Turbonomic) موکول به بعد از جمع‌شدن تلهٔ‌متری واقعی — همان درسی که در p-98 (fastApplyPatch) گرفته شد: بدون داده واقعی، ML حدسی است.</td></tr>
<tr><td>۷</td><td><strong>سطح خودکاری اجرا</strong></td><td><strong>هیچ اجرای تغییردهنده‌ای بدون تأیید صریح ادمین.</strong> گیت تأیید = موتور Human Workflow موجود (p-100)، نه مکانیزم جدید.</td></tr>
</tbody></table>

**تأکید صریح روی یک نکته که در جلسهٔ ۸ باعث سوءتفاهم شد:** هر سه فعل جملهٔ کلیدی (محاسبهٔ ظرفیت + ست‌آپ + مانیتورینگ) **همه در دامنهٔ نهایی v1 هستند — هیچ‌کدام کنار گذاشته نمی‌شود.** تنها چیزی که پایین («ترتیب ساخت») تعیین می‌کند، توالی کدنویسی است، نه کوچک‌شدن دامنه.

---

## ترتیب ساخت (جلسهٔ ۸ — تأیید اپراتور: «کاملاً درسته»)

سه فاز، بر اساس ریسک و وابستگی فنی (نه اهمیت — هر سه از اول در نقشه‌اند):

```
فاز A (کم‌ریسک، موازی) ──▶ فاز B (پیش‌نیاز اجرا) ──▶ فاز C (پرریسک‌ترین، آخر)
  ماشین‌حساب ظرفیت            کنواس توپولوژی                پل اجرا (Ansible bridge)
  اتصال مانیتورینگ (Zabbix)    کامپایلر کنواس→Ansible          + گیت تأیید (Human Workflow)
```

- **فاز A** — ماشین‌حساب ظرفیت (heuristic) + اتصال خواندنی به Zabbix. هیچ‌کدام تغییری روی سرور واقعی نمی‌دهند؛ می‌توانند موازی و مستقل ساخته شوند؛ سریع‌ترین راه برای یک نسخهٔ قابل‌نمایش. **پیش‌نیاز واقعی:** اتصال Zabbix از روز اول به Core Credential Vault (p-118) نیاز دارد (برای نگه‌داری token آن) — یعنی p-118 نه‌فقط فاز C، بلکه همین فاز A را هم می‌بندد.
- **فاز B** — کنواس ویژوال روی `@xyflow/react` موجود + کامپایلر «گراف کنواس → Ansible inventory/playbook». خروجی این فاز ورودی فاز C است.
- **فاز C** — پل اجرا (ارسال playbook کامپایل‌شده به Semaphore UI/AWX از طریق API) + سیم‌کشی گیت تأیید Human Workflow قبل از هر اجرا. تنها فازی که واقعاً زیرساخت واقعی را تغییر می‌دهد — عمداً آخر، چون به فاز A (ظرفیت درست) و فاز B (توپولوژی درست) به‌عنوان پیش‌نیاز نیاز دارد.

toolset روی AppEndoo agent + Infra Enricher (idea از جلسهٔ ۴) به‌موازات هر سه فاز رشد می‌کند — هر فاز که کد می‌شود، ابزار متناظرش به‌عنوان تابع agent هم اضافه می‌شود، نه یک فاز جدای چهارم.

---

## منابع (جلسات ۱–۲)

- [Top internal developer portals in 2026 — Northflank](https://northflank.com/blog/top-internal-developer-portals)
- [10 Best Internal Developer Platforms in 2026 — TheCTOClub](https://thectoclub.com/tools/best-internal-developer-platforms/)
- [Internal Developer Platforms (IDPs): 2026's Top 11 — Cycloid](https://www.cycloid.io/cycloid_page/internal-developer-platforms-idps-2026s-top-11/)
- [Humanitec vs Massdriver — Massdriver](https://www.massdriver.cloud/comparisons/humanitec-vs-massdriver)
- [The Massdriver Bundle Spec](https://www.massdriver.cloud/blogs/the-massdriver-bundle-spec)
- [Best Cloud Infrastructure Automation Tools in 2026 — Facets](https://www.facets.cloud/blog/cloud-infrastructure-automation-tools)
- [Backstage Software Catalog and Developer Platform](https://backstage.io/)
- [CrossPlane vs Kratix for Platform Engineering in 2025](https://www.taloflow.ai/guides/comparisons/crossplane-vs-kratix-platform-engineering)
- [Best Kubernetes UI Management Tools — computingforgeeks](https://computingforgeeks.com/best-kubernetes-ui-management-tools/)
- [MetalSoft — Intelligent Infrastructure Orchestration](https://www.metalsoft.io/)
- [Automating Server Provisioning with MAAS — phoenixNAP](https://phoenixnap.com/blog/automated-server-provisioning-bare-metal-cloud)
- [Coolify vs CapRover: Which Self-Hosted PaaS Wins in 2026 — Contabo](https://contabo.com/blog/coolify-vs-caprover/)
- [Spacelift Alternatives 2026 — Scalr](https://scalr.com/learning-center/spacelift-alternatives)
- [Humanitec Software Pricing — Capterra](https://www.capterra.com/p/204560/Humanitec/)
- [Platform Engineering in 2026: 80% Adoption — byteiota](https://byteiota.com/platform-engineering-2026-80-adoption-devops-dead/)
- [Ansible Lightspeed with IBM watsonx Code Assistant — Red Hat](https://developers.redhat.com/products/ansible/lightspeed)
- [Ansible Lightspeed AI-Assisted Automation (2026) — lucaberton](https://lucaberton.com/blog/ansible-lightspeed-ai-automation-2026/)
- [Ansible AWX vs. Semaphore UI: The Honest Open-Source Comparison (2026)](https://semaphoreui.com/blog/awx-vs-semaphore)
- [Semaphore vs AWX vs Rundeck (2026) — Pi Stack](https://www.pistack.xyz/posts/semaphore-vs-awx-vs-rundeck-self-hosted-ansible-ui-guide-2026/)
- [IBM Turbonomic — AI Workload Optimization](https://www.ibm.com/products/turbonomic/ai-workload-optimization)
- [Densify vs IBM Turbonomic vs VMware Aria Operations (2025) — PeerSpot](https://www.peerspot.com/products/comparisons/densify_vs_ibm-turbonomic_vs_vmware-aria-operations)
- [NetBox — The Premier Network Source of Truth](https://netbox.readthedocs.io/)
- [K8sGPT: AI SRE Copilot for Kubernetes (2026)](https://devops.gheware.com/blog/posts/k8sgpt-ai-sre-kubernetes-2026.html)
- [How Kubernetes AI Assistants Work and 5 Tools Compared — PerfectScale](https://www.perfectscale.io/blog/kubernetes-clusters-ai)
- [Checkmk: The Scalable, High-Performance Zabbix Alternative](https://checkmk.com/l/zabbix-alternative)
- [Zabbix vs LibreNMS in 2026 — MrPlanB](https://www.mrplanb.com/blog/zabbix-vs-librenms-k12-network-monitoring)

## منابع (جلسهٔ ۶ — Cloudera)

- [Cloudera Data Platform (CDP) - A Complete Guide — Airbyte](https://airbyte.com/data-engineering-resources/cloudera-data-platform)
- [An overview of Cloudera Data Platform (CDP) — Adaltas](https://www.adaltas.com/en/2021/07/19/cloudera-data-platform-overview/)
- [Exclusive: Cloudera builds Hadoop-free future platform](https://channellife.ca/story/exclusive-cloudera-builds-hadoop-free-future-platform)
- [Apache Ambari vs. Cloudera Manager — OpenLogic](https://www.openlogic.com/blog/ambari-vs-cloudera-manager)
- [A Second Wind for Apache Ambari — OpenLogic](https://www.openlogic.com/blog/about-apache-ambari)

---

## لاگ

<table dir="rtl">
<thead><tr><th>تاریخ</th><th>رویداد</th></tr></thead>
<tbody><tr><td>۲۰۲۶-۰۹-۱۱</td><td><strong>p-118 بسته شد.</strong> Core Credential Vault در <code dir="ltr" style="unicode-bidi: embed;">src/server/domain/security/credentialVault/</code> پیاده شد؛ لینک پلن حذف‌شده به مسیر کد عوض شد.</td></tr>
<tr><td>۲۰۲۶-۰۹-۱۰</td><td><strong>پاورقی گیت p-118.</strong> بازبینی p-118 مشخص کرد این سند فقط به فاز ۰ (کریپتوی واحد + <code dir="ltr" style="unicode-bidi: embed;">base_credential_vault_secrets</code> + <code dir="ltr" style="unicode-bidi: embed;">setSecret</code>/<code dir="ltr" style="unicode-bidi: embed;">getSecret</code>) نیاز دارد، نه مهاجرت هفت مصرف‌کنندهٔ موجود. هدر پیش‌نیاز اصلاح شد.</td></tr>
<tr><td>۲۰۲۶-۰۹-۱۰</td><td><strong>جلسهٔ ۱۰ — بازبینی با فرض p-118 کامل.</strong> اپراتور خواست سند با فرض «Core Credential Vault (p-118) کامل و بدون نقص پیاده‌سازی شده» بازبینی/اصلاح شود. تصحیح مهم: مقایسهٔ قبلی «مثل <code dir="ltr" style="unicode-bidi: embed;">bridgeApiKey</code> در OLAP Bridge» غلط بود — بررسی دقیق‌تر (که خودش به ساخت p-118 منجر شد) نشان داد آن الگو از مسیر متن‌سادهٔ <code dir="ltr" style="unicode-bidi: embed;">dataSourcesStore.ts</code> رد می‌شود. مرجع درست همه‌جا به Core Credential Vault اصلاح شد؛ روشن شد p-118 هم فاز A (توکن Zabbix) هم فاز C (توکن Semaphore/AWX) را می‌بندد، نه فقط C</td></tr>
<tr><td>۲۰۲۶-۰۹-۱۰</td><td><strong>جلسهٔ ۹ — مدل اتصال اجرا نهایی شد، از طریق چند سؤال اپراتور دربارهٔ فیچرلیست فرضی محصول.</strong> اصلاح مهم: ایدهٔ «bridge سبک خودمان روی ansible-runner» <strong>رد شد</strong> چون خودش نقض اصل «به‌خدمت‌گرفتن نه بازسازی» بود — Semaphore UI از قبل همین نقش را پر می‌کند. تصمیم نهایی: v1 فقط به Semaphore UI وصل می‌شود (AWX جایگزین بعدی)، صرفاً از طریق REST API (هیچ صفحهٔ Semaphore داخل AppEndO لود نمی‌شود — رابط کاربری کاملاً مال AppEndO است)، کردنشیال SSH سرورها داخل Semaphore/AWX تنظیم می‌شود نه داخل دیتابیس AppEndO (AppEndO فقط یک API token نگه می‌دارد، مثل <code dir="ltr" style="unicode-bidi: embed;">bridgeApiKey</code> در OLAP Bridge). لایه‌بندی سه‌تایی AppEndO→Semaphore/AWX→Ansible→سرور مستند شد</td></tr>
<tr><td>۲۰۲۶-۰۹-۱۰</td><td><strong>جلسهٔ ۸ — همهٔ ۷ سؤال باز بسته شد، سند اصولی/قابل‌پیاده‌سازی شد.</strong> تصمیمات: مخاطب فقط مشتریان Studio؛ رابطه با سند خواهر = یک دستیار واحد (نه دو محصول جدا)؛ توپولوژی v1 فقط VM/سرور/استوریج (بدون K8s)؛ موتور اجرا = Ansible پشت قرارداد <code dir="ltr" style="unicode-bidi: embed;">OpsEngineType</code>؛ موتور مانیتورینگ = Zabbix پشت <code dir="ltr" style="unicode-bidi: embed;">MonitoringProviderType</code>؛ محاسبهٔ ظرفیت = heuristic در v1؛ اجرا هیچ‌وقت بدون تأیید صریح ادمین. یک سوءتفاهم مهم اصلاح شد: «ترتیب ساخت» به‌معنی حذف بخشی از دامنه نیست — هر سه فعل (ظرفیت/ست‌آپ/مانیتورینگ) در v1 نهایی هستند، فقط توالی کدنویسی سه‌فازی شد: فاز A (ماشین‌حساب ظرفیت + Zabbix، موازی، کم‌ریسک) → فاز B (کنواس + کامپایلر Ansible) → فاز C (پل اجرا + گیت تأیید، پرریسک‌ترین، آخر). اپراتور با «کاملاً درسته» تأیید کرد</td></tr>
<tr><td>۲۰۲۶-۰۹-۱۰</td><td><strong>جلسهٔ ۷</strong> — اپراتور پرسید «ابزار ما از کدام خانواده است؟» و بعد «دقیقاً چه چیزی پیاده‌سازی می‌کنیم؟». پاسخ اول: ترکیبی از ۴ خانواده (اجرا≈Semaphore UI، دانش≈Ansible Lightspeed، محاسبه≈Turbonomic سبک، مانیتورینگ≈Zabbix/Checkmk wrap)، نزدیک‌ترین باندل تاریخی Cloudera Manager. پاسخ دوم: ۶ مؤلفهٔ کد جدید (ماشین‌حساب ظرفیت، کنواس روی <code dir="ltr" style="unicode-bidi: embed;">@xyflow/react</code> موجود، کامپایلر کنواس→Ansible، پل اجرا، گیت تأیید از Human Workflow، toolset+Enricher روی AppEndoo agent) + جدول اتصال به زیرساخت بیرونی (Ansible bridge/AWX/Semaphore، Zabbix/Checkmk/Prometheus) + تأیید عملی که <code dir="ltr" style="unicode-bidi: embed;">@xyflow/react</code>/<code dir="ltr" style="unicode-bidi: embed;">echarts</code> از قبل در <code dir="ltr" style="unicode-bidi: embed;">package.json</code> هستند، صفر وابستگی جدید سنگین لازم است</td></tr>
<tr><td>۲۰۲۶-۰۹-۱۰</td><td><strong>جلسهٔ ۶</strong> — اپراتور پرسید «کلادرا (Cloudera) کجای بازاره؟». تحقیق نشان داد Cloudera Manager/Ambari دقیقاً معادل اثبات‌شدهٔ ۲۰+ ساله برای «ویژگی‌های ویژهٔ بیگ‌دیتا» این سند است (rack-awareness/replication/quorum) ولی سنگین/proprietary/نیازمند ادمین متخصص — یک ردیف جدید به جدول جای خالی و یک دستهٔ دهم به چشم‌انداز بازار اضافه شد؛ نتیجه: تقاضا واقعی است، نسخهٔ سبک/AI-محورش هنوز خالی است</td></tr>
<tr><td>۲۰۲۶-۰۹-۱۰</td><td><strong>جلسهٔ ۵ — تفکیک به دو پوشهٔ مجزا در <code dir="ltr" style="unicode-bidi: embed;">todo/</code>.</strong> اپراتور دستور داد این ایده به دو طرح مستقل تقسیم شود: این سند (مدیریت اینفراستراکچر عمومی + ملاحظات ویژهٔ بیگ‌دیتا) و سند خواهر <code dir="ltr" style="unicode-bidi: embed;">bigdata-development/p-114</code> (توسعهٔ چرخهٔ دیتا). از <code dir="ltr" style="unicode-bidi: embed;">plans/core/next/p-113-infra-topology-platform.md</code> به <code dir="ltr" style="unicode-bidi: embed;">plans/core/todo/infra-management/p-113-infra-management-platform.md</code> منتقل شد. ایدهٔ «کوچک‌ترین موتور کافی، نه Spark» به سند خواهر منتقل شد. سؤال باز جدید دربارهٔ مرز دقیق با سند خواهر اضافه شد</td></tr>
<tr><td>۲۰۲۶-۰۹-۱۰</td><td><strong>جلسهٔ ۴</strong> — اپراتور از Claude ایده خواست؛ ۶ پیشنهاد ثبت شد که همه از یک اصل می‌آیند («به‌خدمت‌گرفتن» رو به داخل خودِ AppEndO): toolset روی AppEndoo agent موجود به‌جای دستیار جدید، الگوی Enricher از SQL Console AI، معماری Provider از Pivot API، گیت تأیید از Human Workflow (p-100)، پیش‌فرض کوچک‌ترین‌موتور-کافی به‌جای Spark، حلقهٔ بازخورد پیش‌بینی↔واقعیت. صرفاً پیشنهاد — تصمیم با اپراتور در جلسات بعد</td></tr>
<tr><td>۲۰۲۶-۰۹-۱۰</td><td><strong>جلسهٔ ۳</strong> — اپراتور تصریح کرد ابزارهای جلسهٔ ۲ صرفاً نمونه بودند؛ هدف واقعی «مدیریت اینفراستراکچر + توسعهٔ چرخهٔ دیتا در اکوسیستم بیگ‌دیتا با کمک AI» است، هدف کلان‌تر از تفکیک دو-مسیرهٔ جلسهٔ ۱</td></tr>
<tr><td>۲۰۲۶-۰۹-۱۰</td><td><strong>جلسهٔ ۲</strong> — جملهٔ کلیدی ثبت شد: «دستیار همه‌فن‌حریف سیس‌ادمین، به‌خدمت‌گیرندهٔ Ansible نه بازسازی‌کنندهٔ آن» · موضع معماری («به‌خدمت‌گرفتن، نه بازسازی») اضافه شد · ۴ دستهٔ رقیب جدید تحقیق شد</td></tr>
<tr><td>۲۰۲۶-۰۹-۱۰</td><td>سند ایجاد شد (با نام اولیهٔ «Infra Topology &amp; Provisioning Platform») — جلسهٔ ۱: چشم‌انداز بازار (۵ دسته رقیب) + فرضیهٔ تمایز اصلی («استنتاج از تعریف اپ») + ۵ سؤال باز</td></tr>
</tbody></table>


</div>
