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

<p><strong>خلاصه برای operatore:</strong> این سند جزو <strong>plans</strong> است (p-128-workbook-database-connections). ستون وضعیت در <a href="./p-00-todo-index.md">index مربوطه</a> مرجع «شروع شده / design / تمام» است.</p>
<p><strong>راهنمای خواندن:</strong> بخش‌های انگلیسی برای agent/dev هستند؛ جداول وضعیت و یادداشت‌های فارسی را اول بخوانید.</p>


# p-128 — Workbook Database Connections (اتصال وورک‌بوک به دیتابیس / منبع داده)

> **فاز:** WDBC · **ریلیز:** todo (موج ۶)  
> **اولویت پیاده‌سازی:** — — design only · خام برای تحلیل اپراتور  
> **وضعیت:** ⬜ — کنترل: [p-00-todo-index.md](p-00-todo-index.md)  
> **وابستگی:** Workbooks (`UiSpreadsheet` · `base_workbooks`) · Data Studio / Edge Data Sources · Data API · (احتمالاً) Pivot request spec · Credential Vault · Record Policy — **تأیید نشده**  
> **شارد هدف (هنگام پیاده):** سند جدید `docs/standards/workbooks.md` (یا بخش در `data-studio.md` / `data-api-pivot.md` — **در تحلیل قفل شود**)

<div dir="rtl" lang="fa">

---

## برای ریویو اپراتور

این سند **خام است**. هدف: امکان **اتصال** یک یا چند شیت وورک‌بوک به **منبع دادهٔ پلتفرم** (دیتابیس Edge، آبجکت Data Studio، کوئری ذخیره‌شده، یا معادل Data API) و **بارگذاری / تازه‌سازی** داده در سلول‌ها — بدون دور زدن امنیت (اعتبارنامه، scope، ACL وورک‌بوک). تا حکم «شروع کن» **کد نمی‌زنیم**.

---

## محور ۱ — تعریف اتصال (Connection spec)

**نیاز (خام):** کاربر (یا دولوپر در Designer) برای یک شیت یا **محدودهٔ هدف** یک **اتصال داده** تعریف کند: از کجا می‌آید، با چه کوئری/درخواست، و خروجی چگونه به grid map می‌شود.

<table dir="rtl">
<thead><tr><th>#</th><th>سؤال باز</th><th>یادداشت</th></tr></thead>
<tbody><tr><td>1.1</td><td>سطح اتصال: per-sheet · per-named-range · per-workbook · چند اتصال روی یک شیت</td><td></td></tr>
<tr><td>1.2</td><td>منابع مجاز v1: فقط Data Sourceهای ثبت‌شده در Studio · + Data API published · + SQL Console ذخیره‌شده · همه</td><td></td></tr>
<tr><td>1.3</td><td>شکل کوئری: SQL خام · builder/Where tree · Pivot request spec · CRUD list spec</td><td></td></tr>
<tr><td>1.4</td><td>پارامترها: سلول‌های ورودی · پارامترهای ثابت · context session (org/geo)</td><td></td></tr>
<tr><td>1.5</td><td>قرارداد ذخیره: JSON در <code dir="ltr" style="unicode-bidi: embed;">base_workbooks</code> · جدول جانبی <code dir="ltr" style="unicode-bidi: embed;">base_workbook_data_connections</code> · extension در sheet meta</td><td></td></tr>
<tr><td>1.6</td><td>نسخه‌گذاری اتصال هنگام publish مدل / تغییر schema</td><td></td></tr>
</tbody></table>

**تحلیل اپراتور:** _(خالی)_

---

## محور ۲ — وارد کردن و تازه‌سازی (Import / Refresh)

**نیاز (خام):** پس از تعریف اتصال، داده در شیت **materialize** شود (مثل Excel «Get Data» / Refresh). فرمول‌ها و قالب‌بندی دستی در محدودهٔ هدف مشخص شوند.

<table dir="rtl">
<thead><tr><th>#</th><th>سؤال باز</th><th>یادداشت</th></tr></thead>
<tbody><tr><td>2.1</td><td>اولین بار: overwrite کامل محدوده · append · فقط مقادیر (فرمول دست‌نخورده خارج محدوده)</td><td></td></tr>
<tr><td>2.2</td><td>Refresh دستی (دکمه/toolbar) · خودکار هنگام باز کردن · زمان‌بندی (Job)</td><td></td></tr>
<tr><td>2.3</td><td>سقف ردیف/ستون · timeout · pagination/streaming برای نتیجهٔ بزرگ</td><td></td></tr>
<tr><td>2.4</td><td>نوع سلول: فقط <code dir="ltr" style="unicode-bidi: embed;">v</code>/<code dir="ltr" style="unicode-bidi: embed;">m</code> · حفظ <code dir="ltr" style="unicode-bidi: embed;">ct</code> (format) از منبع · LOV label vs raw id</td><td></td></tr>
<tr><td>2.5</td><td>خطا در refresh: toast · برچسب روی شیت · آخرین snapshot موفق</td><td></td></tr>
<tr><td>2.6</td><td>تعامل با dirty state و Save وورک‌بوک — اتصال جدا از <code dir="ltr" style="unicode-bidi: embed;">celldata</code> ذخیره می‌شود یا داخل آن</td><td></td></tr>
</tbody></table>

**تحلیل اپراتور:** _(خالی)_

---

## محور ۳ — امنیت، دسترسی، و اعتبارنامه

**نیاز (خام):** اتصال هرگز نباید پسورد Data Source را به کلاینت بدهد؛ اجرای کوئری **سرور** با هویت کاربر و policyهای موجود.

<table dir="rtl">
<thead><tr><th>#</th><th>سؤال باز</th><th>یادداشت</th></tr></thead>
<tbody><tr><td>3.1</td><td>اجرا از EdgeDbRouter با همان قیود SQL Console / Data API</td><td></td></tr>
<tr><td>3.2</td><td>Record Policy روی نتیجه · فیلتر اجباری per-user</td><td></td></tr>
<tr><td>3.3</td><td>viewer <code dir="ltr" style="unicode-bidi: embed;">can-view</code> روی وورک‌بوک: refresh مجاز است؟ snapshot فقط؟</td><td></td></tr>
<tr><td>3.4</td><td>اشتراک وورک‌بوک (p-106): اتصال با مالک اجرا شود یا viewer</td><td></td></tr>
<tr><td>3.5</td><td>audit: لاگ refresh · <code dir="ltr" style="unicode-bidi: embed;">base_record_events</code> · App logs</td><td></td></tr>
<tr><td>3.6</td><td>SQL injection / فقط read در v1 · ممنوعیت DDL/DML</td><td></td></tr>
</tbody></table>

**تحلیل اپراتور:** _(خالی)_

---

## محور ۴ — UI و سطوح محصول

**نیاز (خام):** تجربهٔ یکسان در **My Workbooks** و (در صورت نیاز) کامپوننت **Spreadsheet** در Component Designer.

<table dir="rtl">
<thead><tr><th>#</th><th>سؤال باز</th><th>یادداشت</th></tr></thead>
<tbody><tr><td>4.1</td><td>wizard اتصال: انتخاب Data Source → preview → map ستون‌ها → محدودهٔ هدف</td><td></td></tr>
<tr><td>4.2</td><td>مدیریت اتصال‌ها: پنل کناری · منوی شیت · Inspector</td><td></td></tr>
<tr><td>4.3</td><td>Base Components: propهای <code dir="ltr" style="unicode-bidi: embed;">spreadsheet.*</code> برای اتصال از designer binding</td><td></td></tr>
<tr><td>4.4</td><td>تفاوت ADMIN Records→Workbooks vs My Workbooks (همان قابلیت یا محدودتر)</td><td></td></tr>
<tr><td>4.5</td><td>فرهنگ/RTL و copy انگلیسی production طبق <code dir="ltr" style="unicode-bidi: embed;">AGENTS.md</code></td><td></td></tr>
</tbody></table>

**تحلیل اپراتور:** _(خالی)_

---

## محور ۵ — نوشتن برگشت (Write-back) — احتمالاً بعد از v1

**نیاز (خام):** ویرایش سلول و **Push** به جدول منبع (دوطرفه). عمداً جدا از v1 read-only مگر اپراتور تأکید کند.

<table dir="rtl">
<thead><tr><th>#</th><th>سؤال باز</th><th>یادداشت</th></tr></thead>
<tbody><tr><td>5.1</td><td>mapping کلید primary · conflict resolution</td><td></td></tr>
<tr><td>5.2</td><td>Data API PATCH vs SQL batch · workflow تأیید</td><td></td></tr>
<tr><td>5.3</td><td>Record Event / reason code روی write-back</td><td></td></tr>
</tbody></table>

**تحلیل اپراتور:** _(خالی)_

---

## وضعیت فعلی (برای تحلیل — بدون قفل)

<table dir="rtl">
<thead><tr><th>سطح</th><th>امروز (خلاصه)</th></tr></thead>
<tbody><tr><td>ذخیره وورک‌بوک</td><td><code dir="ltr" style="unicode-bidi: embed;">base_workbooks</code> + <code dir="ltr" style="unicode-bidi: embed;">sheets</code> JSON (FortuneSheet <code dir="ltr" style="unicode-bidi: embed;">celldata</code>) — <strong>بدون</strong> metadata اتصال داده</td></tr>
<tr><td>UI</td><td><code dir="ltr" style="unicode-bidi: embed;">WorkbooksWorkspace</code> / <code dir="ltr" style="unicode-bidi: embed;">UiSpreadsheet</code> — ویرایش دستی، فرمول، ذخیرهٔ owner-scoped</td></tr>
<tr><td>منابع داده</td><td>Data Studio + Edge + Data API + Pivot — <strong>جدا</strong> از Workbooks؛ الگوی اجرای کوئری موجود است</td></tr>
<tr><td>اشتراک</td><td><code dir="ltr" style="unicode-bidi: embed;">FunctionAccessControl</code> روی وورک‌بوک (My Workbooks) — ارتباط با refresh هنوز تعریف نشده</td></tr>
<tr><td>Designer</td><td>section <code dir="ltr" style="unicode-bidi: embed;">spreadsheet</code> در Base Components — binding دادهٔ خارجی <strong>ندارد</strong></td></tr>
</tbody></table>

_(جزئیات کد در فاز تحلیل با `get_feature_graph({ pageKey: "workbooks" })` و مسیر Data API تکمیل شود.)_

---

## تعریف موفقیت (پیش‌نویس — بعد از تحلیل قفل شود)

1. کاربر مجاز می‌تواند برای یک شیت اتصال read-only به منبع مجاز تعریف کند و نتیجه را در محدودهٔ مشخص ببیند.
2. Refresh دستی (حداقل) از سرور با همان سیاست‌های دسترسی منبع اجرا می‌شود؛ اعتبارنامه در کلاینت لو نمی‌رود.
3. مشخصات اتصال با Save وورک‌بوک persist می‌شود و در share/view طبق تصمیم محور ۳ رفتار می‌کند.
4. قرارداد greenfield یک‌منبع — بدون dual parser برای sheet JSON.
5. `npm run test:critical` بدون رگرسیون پس از پیاده‌سازی.

---

## خروجی‌های بعد از تحلیل (چک‌لیست)

- [ ] specs زیر `specs/workbook-database-connections/` (در صورت تأیید)
- [ ] shard `docs/standards/workbooks.md` (یا ادغام در shard موجود)
- [ ] `projectStandards.ts` یک‌خطی‌ها
- [ ] فازهای پیاده (WDBC-1 …) در همین فایل یا execution prompts
- [ ] (اختیاری) نمونهٔ living در Base Components / My Workbooks demo

---

## لاگ

<table dir="rtl">
<thead><tr><th>تاریخ</th><th>خلاصه</th></tr></thead>
<tbody><tr><td>۲۰۲۶-۰۹-۱۷</td><td>ایجاد سند خام — اتصال وورک‌بوک به منبع داده · import/refresh · امنیت · UI · write-back موکول</td></tr>
</tbody></table>

</div>


</div>
