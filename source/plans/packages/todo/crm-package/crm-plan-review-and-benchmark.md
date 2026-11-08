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

<p><strong>خلاصه برای operatore:</strong> مقایسه با بازار/OSS — برای تصمیم scope، نه وضعیت پیاده‌سازی روزانه.</p>


# بررسی طرح CRM & Support (v2) — ارزیابی، بنچمارک تکمیلی، و راه‌حل مشکل فرم‌ها

> این سند مکمل `p-packages-crm.md` است؛ چیزی از آن حذف یا جایگزین نمی‌کند — فقط نقاط ریسک را برای اجرای تمیزتر توسط Claude Code/Cursor مشخص می‌کند.

## نتیجهٔ کلی

این سند در سطح خیلی بالاتری از حد معمول یک طرح اولیه است — قوانین سخت، ممنوعیت‌های صریح، مدل داده کامل با associations و ایندکس، بنچمارک رقبا، acceptance criteria per فاز، و حتی concurrency edge-caseها (merge، change-stage) از قبل دیده شده‌اند. مشکل «چند روز فیکس با پرامپت» که گفتی، به احتمال زیاد از کمبود محتوای سند نمی‌آید — از **مقیاس اجرا در یک نوبت** و **نبود حلقهٔ خودبررسی برای ایجنت** می‌آید. جزئیات در بخش «مشکل فرم‌ها» پایین.

---

## ۱. نقاط ابهام / ریسک که پیدا شد

<table dir="rtl">
<thead><tr><th>#</th><th>محل</th><th>ابهام</th><th>چرا مهم است</th><th>پیشنهاد اصلاح</th></tr></thead>
<tbody><tr><td>R1</td><td>سراسر API</td><td>هیچ قاعدهٔ صریح RBAC روی endpointها نیست (کی می‌تونه Merge کنه؟ کی می‌تونه Reopen کنه؟)</td><td>بدون این، ایجنت یا هیچ چکی نمی‌زاره یا یه قاعدهٔ اختراعی می‌زاره که با بقیهٔ پلتفرم هم‌خوان نیست</td><td>یک جدول کوتاه «Endpoint → نقش لازم» اضافه کن (حتی اگر فعلاً «هر کاربر لاگین‌شدهٔ Studio» باشه، صریح بنویسش)</td></tr>
<tr><td>R2</td><td>صفحات لیست (Customers/Tickets/Opportunities)</td><td>ترتیب پیش‌فرض مرتب‌سازی گفته نشده</td><td>کم‌هزینه‌ترین چیزیه که معمولاً دیرتر کشف میشه و یه راند فیکس جدا می‌گیره</td><td>یک خط اضافه کن: مثلاً «پیش‌فرض: <code dir="ltr" style="unicode-bidi: embed;">updated_at</code> نزولی» برای هر سه لیست</td></tr>
<tr><td>R3</td><td><code dir="ltr" style="unicode-bidi: embed;">crm_customers.owner_id</code></td><td>محدودیتی روی نقش کاربرِ owner نیست (هر <code dir="ltr" style="unicode-bidi: embed;">base_users</code> می‌تونه باشه؟)</td><td>اگه پلتفرم نقش SALES/SUPPORT داره، بهتره اینجا صریح بشه وگرنه لیست انتخاب owner باز و گیج‌کننده میشه</td><td>یک خط: «owner فقط از کاربران با نقش X» یا صریحاً «بدون محدودیت نقش در v1»</td></tr>
<tr><td>R4</td><td>3c-pre (تکمیل BC مشترک Kanban)</td><td>خودِ سند یک باگ شناخته‌شده رو مستند کرده (optimistic local state در <code dir="ltr" style="unicode-bidi: embed;">DesignerVizKanban</code> که روی Cancel درست revert نمی‌کنه) ولی راه‌حلش رو به «یک مسیر revert صریح اضافه شود» به‌صورت باز گذاشته</td><td>این دقیقاً از اون دسته باگ‌هاییه که چون فقط با drag واقعی در مرورگر دیده میشه، ایجنت بدون تست صریح رد میشه و بعداً کاربر با دست پیدا می‌کنه</td><td>قبل از شروع 3c یک unit/e2e test مشخص برای «Cancel → board برمی‌گرده به حالت قبل از drag» بنویس؛ این تست باید قرمز باشه قبل از فیکس و سبز بعدش — نه فقط توضیح متنی</td></tr>
<tr><td>R5</td><td><code dir="ltr" style="unicode-bidi: embed;">crm_ticket_messages</code></td><td>مشخص نیست پیام سیستم (مثلاً «Assigned to X» یا «Status changed to Resolved») هم به همین جدول میره یا نه</td><td>اگه بعداً بخوای این‌ها رو نشون بدی، یا باید ستون نوع پیام اضافه کنی (breaking change) یا باید همین حالا <code dir="ltr" style="unicode-bidi: embed;">message_type_code</code> بذاری (حتی با یه مقدار پیش‌فرض <code dir="ltr" style="unicode-bidi: embed;">reply</code>)</td><td>تصمیم رو صریح کن: «v1 فقط reply؛ system events از این جدول نمی‌گذرن» یا اضافه کردن ستون از همین فاز ۱</td></tr>
<tr><td>R6</td><td>Customer create (Add Individual/Company)</td><td>چیزی دربارهٔ برخورد با ایمیل/تلفن تکراری در لحظهٔ create گفته نشده — فقط Merge دستی *بعد از* create هست</td><td>این دقیقاً همون نقطه‌ایه که Dynamics/Sugar باهاش دست‌وپنجه نرم می‌کنن (بخش بنچمارک پایین)</td><td>یک هشدار نرم non-blocking در دیالوگ create وقتی ایمیل/موبایل با یک user موجود یکی است — بدون اتوماسیون dedupe، فقط پیام "Possible existing customer: X — continue anyway?"</td></tr>
</tbody></table>

هیچ‌کدوم از این‌ها اصل معماری رو زیر سؤال نمی‌بره؛ همه‌شون از جنس «یک خط/یک جدول کوچیک اضافه کن قبل از اینکه به فاز ۱ برسی» هستن — ارزون به‌شرط اینکه الان اضافه بشن، گرون اگه بعد از پیاده‌سازی کشف بشن.

---

## ۲. بنچمارک تکمیلی — Microsoft Dynamics CRM و SugarCRM

جدول بنچمارک موجود در سند (Salesforce/SuiteCRM/Pipedrive/HubSpot/Zendesk) عالیه؛ این بخش فقط دو نمونه‌ای که خودت اسم بردی رو اضافه می‌کنه.

<table dir="rtl">
<thead><tr><th>الگو</th><th>منبع</th><th>نسبت با تصمیم فعلی سند</th><th>تصمیم پیشنهادی</th></tr></thead>
<tbody><tr><td>هشدار duplicate نرم در لحظهٔ create (نه auto-merge)</td><td>Dynamics · Sugar</td><td>سند فعلاً فقط Merge دستی *بعد از* create داره؛ هیچ هشداری در لحظهٔ create نیست</td><td>✅ اضافه شود — همون R6 بالا؛ فازی نیست، bloat هم نیست چون فقط یک query ساده روی email/phone قبل از submit</td></tr>
<tr><td>Business Process Flow / stage checklist اجباری روی هر مرحله</td><td>Dynamics</td><td>مخالف مستقیم فلسفهٔ سند («بدون موتور جادویی»)</td><td>❌ رد — همون تصمیم رد شدهٔ Workflow Engine در سند صدق می‌کنه</td></tr>
<tr><td>Territory / assignment rule خودکار</td><td>Dynamics</td><td>نیازمند موتور قانون جدا</td><td>❌ v1 → بک‌لاگ (هم‌راستا با نبود escalation rule engine)</td></tr>
<tr><td>Outlook/Email two-way sync</td><td>Dynamics · Sugar</td><td>سند صراحتاً inbound رو به Portals/بعداً محول کرده</td><td>❌ تأیید مجدد رد قبلی</td></tr>
<tr><td>Unified Activity Timeline (call/email/meeting/note/task یکجا)</td><td>Dynamics · Sugar</td><td><strong>از قبل پیاده‌سازی شده</strong> — دقیقاً همون <code dir="ltr" style="unicode-bidi: embed;">crm_activities</code> با <code dir="ltr" style="unicode-bidi: embed;">activity_type_code</code></td><td>✅ هیچ کاری لازم نیست، فقط تأیید که طراحی فعلی هم‌راستاست</td></tr>
<tr><td>Recently Viewed / Favorites روی رکوردها</td><td>Sugar</td><td>UX nicety، نه معماری</td><td>❌ v1 → بک‌لاگ اختیاری، ریسک صفر اگه حذف بمونه</td></tr>
<tr><td>Mass Update از لیست</td><td>Sugar</td><td>معادل bulk actions (C10) که از قبل هست</td><td>✅ پوشش داده شده، کاری لازم نیست</td></tr>
<tr><td>Soft-required field indicator (نه Required سخت)</td><td>Dynamics («Business Recommended»)</td><td>جزئیات UI ریز</td><td>❌ اختیاری، فقط اگه بعداً کاربرها گله کردن اضافه شه</td></tr>
</tbody></table>

**نتیجهٔ بنچمارک:** فقط یک آیتم واقعاً جدید و ارزش‌مند پیدا شد — هشدار duplicate نرم در لحظهٔ create. بقیهٔ الگوهای این دو محصول یا از قبل پوشش داده شده‌ن یا آگاهانه (و درست) رد شده‌ن. این خودش نشونهٔ خوبیه که طرح اولیه‌ت قبلاً به‌اندازهٔ کافی این محصول‌ها رو در نظر گرفته.

---

## ۳. مشکل فرم‌ها — چرا خسته‌کننده‌ست و چیکار کنیم

### چرا این اتفاق میفته (نه به‌خاطر کمبود سند)

سند فعلی برای هر فیلد از هر جدول، `formWidget`، گروه، `required`، آیکون، و حتی props (`maxLength`, `precision`) رو مشخص کرده — این سطح از دقت خیلی بالاتر از چیزیه که اکثر تیم‌ها قبل از شروع کدنویسی دارن. با این حال وقتی همهٔ این اطلاعات رو یک‌جا (مثلاً کل صفحهٔ ویرایش Customer با ده‌ها فیلد) به یک ایجنت میدی و میگی «بساز»، سه چیز اتفاق می‌افته:

1. ایجنت باید بین **سند** + **کد واقعی Base Componentها** (که مجبوره حدس بزنه یا باز کنه) + **الگوی بصری Records** هم‌زمان جفت‌وجور کنه؛ هرچی حجم بیشتر باشه احتمال اینکه یک جزئیات (مثلاً یک prop از یک BC) رو اشتباه بزنه بیشتر میشه.
2. هیچ‌کس (نه ایجنت، نه تو) بین ساخت و تحویل، صفحه رو مرحله‌به‌مرحله چک نمی‌کنه — همه‌چیز یک‌جا ساخته میشه و خطاها فقط وقتی تو دستی هر فیلد رو نگاه می‌کنی معلوم میشن.
3. فیکس کردن هم همون مشکل رو داره: یک پرامپت «این فیلد درست نیست» بدون اشاره به BC دقیق، دوباره حدس‌زنی ایجاد می‌کنه.

### راه‌حل عملی (بدون تغییر معماری سند)

**الف) واحد ساخت رو کوچیک‌تر کن.** به‌جای «صفحهٔ ویرایش Customer رو بساز»، هر `FormSection` رو جدا بساز و بین‌شون تأیید بگیر: اول skeleton (chrome + عنوان بخش‌ها بدون فیلد واقعی)، بعد یک گروه ستون در main، بعد rail، بعد Tags/Related. سند خودش این گروه‌بندی رو داره (Identity/Pipeline/Ownership/Audit …) — فقط باید در پرامپت هم به همین واحدها تقسیمش کنی.

**ب) قرارداد BC رو دیکته کن، نه فقط اسمش رو بیار.** قبل از شروع هر زیرفاز ۳، از ایجنت بخواه که پراپ‌های واقعی هر BC (که استفاده می‌کنه — `FormSection`, `FormField`, `UiInput`, `UiSelect`, `CreateEditModalShell`, `AppTableGrid`, `UiKanbanBoard`) رو از سورس واقعی کپی کنه و در پاسخش نشون بده، **قبل از نوشتن کد** — نه بعدش به‌عنوان توضیح. اگه امضای واقعی جلوی چشمش باشه، حدس‌زنی حذف میشه. سند فعلاً میگه «باز کن» ولی الزام نمی‌کنه که نتیجه رو نشون بده — این تفاوت کوچیک، تفاوت بزرگی در دقت ایجاد می‌کنه.

**پ) یک صفحهٔ طلایی واقعاً tight بساز، بعد الگوبرداری اجباری کن.** سند از قبل Customers editor رو «طلایی» نامیده — عالیه. بعد از تکمیل و تأیید *دستی* همون یک صفحه، برای Opportunities و Tickets بگو: «دقیقاً همون ساختار فایل‌به‌فایل صفحهٔ Customers رو کپی کن و فقط فیلدها/BCهای مخصوص این دامنه رو عوض کن» — نه «یک صفحهٔ جدید بساز که شبیه Customers باشه». تفاوت این دو دستور در عمل خیلی بزرگه؛ اولی الگوی کد رو تحمیل می‌کنه، دومی اجازهٔ ابداع دوباره میده.

**ت) چک‌لیست C1–C11 رو تبدیل به خوداظهاری اجباری کن.** بعد از هر زیرفاز، از ایجنت بخواه ردیف‌به‌ردیف چک‌لیست (C1 تا C11 + baseline `package-ui.md`) رو با ارجاع به فایل/خط کد ثابت کنه — نه فقط بگه «انجام شد». این کار خطا رو قبل از اینکه به تو برسه گیر می‌ندازه.

**ث) Live-verify رو ریزتر کن.** سند یک Live-verify کلی برای «فاز ۳» داره؛ پیشنهاد: همین کار رو بعد از هر زیرفاز (3a، 3b، 3c، 3d) جدا انجام بده، نه فقط در پایان فاز ۳. هزینه‌ش یه چرخهٔ اضافه‌ست، ولی جلوی «فیکس تجمعی روزها بعد» رو می‌گیره.

نتیجه: این‌ها هیچ‌کدوم تغییر معماری نیستن — فقط **نحوهٔ دادن پرامپت به Claude Code/Cursor** رو عوض می‌کنن. فایل دوم («پرامپت‌های اجرای فاز به فاز») این‌ها رو مستقیم پیاده کرده تا فقط کپی/پیست کنی.

</div>
