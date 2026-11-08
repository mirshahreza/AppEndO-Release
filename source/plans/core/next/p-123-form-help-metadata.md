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

<p><strong>خلاصه برای operatore:</strong> این سند جزو <strong>plans</strong> است (p-123-form-help-metadata). ستون وضعیت در <a href="./p-00-next-index.md">index مربوطه</a> مرجع «شروع شده / design / تمام» است.</p>
<p><strong>راهنمای خواندن:</strong> بخش‌های انگلیسی برای agent/dev هستند؛ جداول وضعیت و یادداشت‌های فارسی را اول بخوانید.</p>


# p-123 — Form Help Metadata (راهنمای اندیوزر روی فیلد و سکشن)

> **فاز:** HLP · **موکول** (next) · مسیر موازی با p-52 بود  
> **اولویت پیاده‌سازی:** — — شورتکات نویسندگی هلپ برای ADMIN/DEVELOPER · نمایش `i` برای اندیوزر · design only تا «شروع کن»  
> **وضعیت:** ⬜ — کنترل: [p-00-next-index.md](p-00-next-index.md)  
> **وابستگی:** Cultures → Translations ✅ · studio-meta `interfaceNotes` (بدنهٔ ترجمه نشده، به فرم وصل نیست) · `FieldHintTooltip` / `FormField hint` ✅ · `RecordForm` / CRUD Set ✅ · Data Studio Column Properties ✅ · package `culture_keys` ✅ · `data.prisma.locked`  
> **خواهر:** آیکون History روی همان `labelExtra` پیاده شد (شارد [`record-event-log.md`](../../../docs/standards/record-event-log.md) `form-surfaces`). این پلن بدنهٔ هلپ است نه تاریخچه.  
> **شارد هدف (هنگام پیاده):** شارد جدید [`docs/standards/form-help.md`](../../../docs/standards/form-help.md) + یک‌خط `projectStandards.ts` + بند کوتاه در [`ui-core.md`](../../../docs/standards/ui-core.md) §Field hints و [`data-studio-modeler.md`](../../../docs/standards/data-studio-modeler.md)

---

## برای ریویو اپراتور

این سند **طراحی محصول است**. کد نمی‌زنیم تا بگویی شروع کن.

<table dir="rtl">
<thead><tr><th>#</th><th>حکم</th><th>منبع</th></tr></thead>
<tbody><tr><td>R1</td><td>هدف نهایی = متادیتای راهنما برای <strong>اندیوزر</strong> وقتی فیلد/سکشن مبهم است</td><td>جلسه ۲۰۲۶-۰۹-۱۲</td></tr>
<tr><td>R2</td><td>نمایش به اندیوزر = همان <strong>آیکون <code dir="ltr" style="unicode-bidi: embed;">i</code></strong> (<code dir="ltr" style="unicode-bidi: embed;">FieldHintTooltip</code>) در لیبل فیلد و عنوان سکشن</td><td>همان</td></tr>
<tr><td>R3</td><td>ADMIN یا DEVELOPER روی فرم <strong>اسمارت‌تگ</strong> می‌بینند؛ کلیک = نوشتن هلپ با مارک‌داون ساده</td><td>همان</td></tr>
<tr><td>R4</td><td>ذخیره/بازیابی <strong>یکی</strong> است: سیستم ترجمهٔ چندوجهی Cultures. فرم و Data Studio فقط شورتکات‌اند</td><td>همان</td></tr>
<tr><td>R5</td><td>Data Studio مدلر همان منبع را ویرایش می‌کند (ستون، رابطه، گروه/سکشن)</td><td>همان</td></tr>
</tbody></table>

---

## هدف

اپراتور (ADMIN / DEVELOPER) بتواند **همان‌جا که فرم را می‌بیند** — و همچنین از Data Studio که کل مدل را ویرایش می‌کند — راهنمای اندیوزر را برای فیلد و سکشن بگذارد. اندیوزر همان `i` را می‌بیند و ابهام را برمی‌دارد.

این یک CMS جدا، یک جدول هلپ جدید، یا پاراگراف زیر فیلد **نیست**. شورتکات نویسندگی است روی قرارداد موجود:

```
Cultures → Translations (master انگلیسی + override هر فرهنگ)
        ↑                    ↑
  اسمارت‌تگ روی فرم      Column / Group / Relation Properties
        └──────── یک کلید پایدار ────────┘
        ↓
  FieldHintTooltip (i) + Tour guide همان متن
```

**تعریف موفقیت:** View/Edit یک رکورد دامنه → اگر هلپ برای فرهنگ جاری هست، `i` کنار لیبل فیلد و عنوان سکشن → کلیک `i` مارک‌داون ساده را نشان می‌دهد → ADMIN/DEVELOPER همان‌جا تگ می‌بینند و با دیالوگ مارک‌داون می‌نویسند → همان متن از Data Studio Column Properties هم ویرایش می‌شود → Cultures → Translations همان کلید را نشان می‌دهد → `npm run test:critical` بدون رگرسیون.

---

## وضعیت فعلی (قفل واقعیت)

<table dir="rtl">
<thead><tr><th>سطح</th><th>امروز</th></tr></thead>
<tbody><tr><td><code dir="ltr" style="unicode-bidi: embed;">FieldHintTooltip</code></td><td>Lucide <code dir="ltr" style="unicode-bidi: embed;">Info</code> بعد از لیبل؛ بدنه <strong>متن ساده</strong>؛ Tour guide همان <code dir="ltr" style="unicode-bidi: embed;">hint</code> را می‌خواند</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">FormField</code> / <code dir="ltr" style="unicode-bidi: embed;">FormSection</code></td><td><code dir="ltr" style="unicode-bidi: embed;">hint</code> اختیاری؛ <code dir="ltr" style="unicode-bidi: embed;">labelExtra</code> برای اکشن کنار لیبل (EUA sparkle، آیکون History وقتی مدل ترک دارد)</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">RecordForm</code></td><td><code dir="ltr" style="unicode-bidi: embed;">hint</code> <strong>نمی‌فرستد</strong> — فیلدهای CRUD/Edit اصلاً <code dir="ltr" style="unicode-bidi: embed;">i</code> ندارند</td></tr>
<tr><td>studio-meta ستون/رابطه</td><td><code dir="ltr" style="unicode-bidi: embed;">interfaceNotes</code> = textarea تک‌زبانه «Operator-facing guidance»؛ <strong>به هیچ فرمی وایر نشده</strong></td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">developerNotes</code></td><td>یادداشت داخلی سازنده؛ نباید به اندیوزر برسد (درست است؛ دست نزن)</td></tr>
<tr><td>Story مدلر</td><td>مارک‌داون/HTML برای <strong>سازنده</strong> روی مدل؛ با هلپ اندیوزر قاطی نمی‌شود</td></tr>
<tr><td>گروه‌های ستون</td><td>نام + icon/color در <code dir="ltr" style="unicode-bidi: embed;">extensions</code>؛ <strong>هلپ سکشن ندارند</strong></td></tr>
<tr><td>Display name ستون</td><td>فرمول پیش‌فرض <code dir="ltr" style="unicode-bidi: embed;">translate(field_name)</code> یا override ثابت در studio-meta</td></tr>
<tr><td>Cultures</td><td>master bundle <code dir="ltr" style="unicode-bidi: embed;">us</code> + override per culture؛ ذخیره blob کنترل‌پلین؛ <code dir="ltr" style="unicode-bidi: embed;">PUT</code> کل جدول؛ الگوی seed کلید تکی: <code dir="ltr" style="unicode-bidi: embed;">upsertAttributeLabelTranslation</code></td></tr>
<tr><td>پکیج</td><td>قابلیت <code dir="ltr" style="unicode-bidi: embed;">culture_keys</code> کلید انگلیسی را با نصب می‌کارد</td></tr>
<tr><td>نقش</td><td><code dir="ltr" style="unicode-bidi: embed;">ADMIN</code> و <code dir="ltr" style="unicode-bidi: embed;">DEVELOPER</code> نقش‌های درجهٔ اول‌اند</td></tr>
</tbody></table>

`interfaceNotes` نیت درست دارد ولی قرارداد ناقص است: یک رشته در JSON مدلر، بدون فرهنگ، بدون مارک‌داون، بدون مصرف‌کنندهٔ فرم.

---

## یک منبع حقیقت

Greenfield: **بدنهٔ هلپ در Cultures زندگی می‌کند.** studio-meta کلید نمی‌سازد و متن را تکرار نمی‌کند.

کلید از هویت پایدار مدل مشتق می‌شود (بدون جدول اشاره):

<table dir="rtl">
<thead><tr><th>سوژه</th><th>کلید</th></tr></thead>
<tbody><tr><td>ستون</td><td><code dir="ltr" style="unicode-bidi: embed;">data.help.{objectName}.column.{columnName}</code></td></tr>
<tr><td>رابطه</td><td><code dir="ltr" style="unicode-bidi: embed;">data.help.{objectName}.relation.{relationKey}</code></td></tr>
<tr><td>گروه/سکشن فرم</td><td><code dir="ltr" style="unicode-bidi: embed;">data.help.{objectName}.group.{groupSlug}</code></td></tr>
</tbody></table>

`objectName` همان شناسهٔ لاتین اسکیما است (نه `edgeModelId` ناپایدار) — هم‌تراز شارد Data Studio (studio-meta روی `(dataSourceId, objectType, objectName)`).

`groupSlug` = `sanitizeLatinSlug` روی نام گروه. اگر نام گروه عوض شود، کلید هلپ باید با rename گروه جابه‌جا شود (مثل rename ستون در layout).

**Resolve (اندیوزر):** `t(key, { missing: 'silent' })` → اگر خروجی خالی یا خودِ کلید بود، `i` نیست. وگرنه همان متن برای فرهنگ جاری (fallback به master انگلیسی طبق `TranslationRuntime`).

**انگلیسی canonical** = مقدار master bundle. فرهنگ‌های دیگر = override. الگوی موجود attribute label: `t(key)` → fallback master → (اینجا fallback سوم نداریم؛ studio-meta متن هلپ نگه نمی‌دارد).

### `interfaceNotes` موجود

یک‌بار در شروع پیاده: مقدارهای غیرخالی را به کلید ستون/رابطه در master بنویس، بعد فیلد را از schema studio-meta **حذف** کن. Dual-read / `@deprecated` ممنوع.

`developerNotes` و Story دست‌نخورده می‌مانند.

### پکیج

Export مدل، کلیدهای `data.help.{objectName}.*` همان مدل را داخل `culture_keys` می‌گذارد (انگلیسی master). نصب پکیج همان overlay موجود را اجرا می‌کند. uninstall همان sidecar را برمی‌دارد. Override مستأجر روی آن کلیدها می‌ماند مگر uninstall صریح کلیدهای پکیج را پاک کند (رفتار فعلی `culture_keys`).

---

## دو نقش، دو کنترل، یک متن

```
لیبل فیلد / عنوان سکشن
  [Label]  (i)     [#order_date]
            │            │
         اندیوزر     فقط ADMIN / DEVELOPER
         اگر هلپ هست    همیشه (خالی یا پر)
```

<table dir="rtl">
<thead><tr><th>کنترل</th><th>چه کسی</th><th>ظاهر</th><th>کلیک</th></tr></thead>
<tbody><tr><td><code dir="ltr" style="unicode-bidi: embed;">i</code></td><td>همه، فقط وقتی هلپ برای فرهنگ جاری هست</td><td>Lucide <code dir="ltr" style="unicode-bidi: embed;">Info</code> موجود، <code dir="ltr" style="unicode-bidi: embed;">h-3 w-3</code>، <code dir="ltr" style="unicode-bidi: embed;">aria-label="About {label}"</code></td><td>toggle تولتیپ/پاپ‌اور با مارک‌داون ساده</td></tr>
<tr><td>اسمارت‌تگ</td><td><code dir="ltr" style="unicode-bidi: embed;">ADMIN</code> یا <code dir="ltr" style="unicode-bidi: embed;">DEVELOPER</code></td><td>چیپ فشرده بعد از <code dir="ltr" style="unicode-bidi: embed;">i</code>؛ متن = <code dir="ltr" style="unicode-bidi: embed;">columnName</code> / slug گروه (نه مسیر کامل کلید)</td><td>دیالوگ ویرایش هلپ</td></tr>
</tbody></table>

ترتیب روی لیبل (هم‌زیستی با آیکون History):

`label → i (اگر هلپ) → اسمارت‌تگ (نویسنده) → History (اگر ترک) → labelExtra دیگر (EUA)`

اندیوزر اسلات تگ را نمی‌بیند و رزرو خالی هم نمی‌گیرد (برخلاف `reserveHintSlot` برای `i`).

### حالت خالی / پر تگ

<table dir="rtl">
<thead><tr><th>حالت</th><th>چیپ</th></tr></thead>
<tbody><tr><td>هلپ master خالی</td><td>dashed slate، عنوان <code dir="ltr" style="unicode-bidi: embed;">Add help</code></td></tr>
<tr><td>هلپ هست</td><td>پر، hue فنی cyan (<code dir="ltr" style="unicode-bidi: embed;">text-cyan-700</code> / border cyan-200) — معنای «راهنما / فنی» طبق Color it</td></tr>
</tbody></table>

Hover تگ: کلید کامل + «Edit help». هرگز native `title=`.

---

## دیالوگ نویسندگی (شورتکات)

`CreateEditModalShell` **`md`** — نه `maximized` MarkdownEditDialog (آن برای Story/محتواست).

```
Help · {field or section label}
────────────────────────────────
Culture:  [US ▾]   (ستون‌های فرهنگ فعال، همان Cultures)
کلید (read-only mono): data.help.orders.column.order_date

[ مارک‌داون ساده — textarea + پیش‌نمایش فشرده ]

[ Cancel ]              [ Save ]
```

- مارک‌داون **ساده**: پاراگراف، `**bold**`، `*italic*`، لیست `-` / `1.`، لینک `[text](url)`. بدون تصویر، جدول، HTML خام، heading بزرگ.
- یک فرهنگ در هر لحظه؛ Save همان فرهنگ را می‌نویسد. انگلیسی خالی = حذف کلید از master (و در نتیجه `i` برای همه تا override جدا).
- API جراحی، نه `PUT` کل جدول ترجمه: الگوی `upsertAttributeLabelTranslation` — `upsertDataHelpTranslation(key, cultureId, markdown)`.
- ACL نوشتن: فقط `ADMIN` و `DEVELOPER`. بقیه ۴۰۳. خواندن هلپ: هر کاربر احرازشدهٔ فرم (همان GET ترجمه‌های boot).

پرش «Open in Cultures» به Settings → Cultures → Translations با فیلتر همان کلید — لینک انگلیسی در فوتر دیالوگ، نه مسیر اصلی.

---

## نمایش به اندیوزر

همان `FieldHintTooltip`. تغییر: بدنه اگر مارک‌داون باشد با `MarkdownPreview` فشرده (`text-[11px]`، `max-w-[20rem]`، بدون تصویر). کلیک‌برای‌باز ماندن موجود است.

Tour guide همان متن را می‌خواند؛ برای حباب همراه، مارک‌داون به متن ساده strip می‌شود (بدون syntax). Stop فقط وقتی هلپ غیرخالی است — فیلد بدون هلپ stop جعلی نمی‌سازد.

جای `i`:

<table dir="rtl">
<thead><tr><th>جا</th><th>اسلات</th></tr></thead>
<tbody><tr><td>فیلد View/Edit (<code dir="ltr" style="unicode-bidi: embed;">RecordForm</code>، Users اگر مدل هلپ دارد، sample mock)</td><td><code dir="ltr" style="unicode-bidi: embed;">FormField hint</code></td></tr>
<tr><td>سکشن فرم (گروه ستون → <code dir="ltr" style="unicode-bidi: embed;">FormSection</code>)</td><td><code dir="ltr" style="unicode-bidi: embed;">FormSection hint</code></td></tr>
<tr><td>فیلد association</td><td>همان لیبل فیلد</td></tr>
</tbody></table>

`i` **نمی‌آید** روی: Create وقتی هنوز سوژه/مدل هلپ ندارد — Create **دارد** اگر کلید هلپ هست (هلپ دربارهٔ فیلد است نه رکورد). مدلر Data Studio برای اندیوزر `i` نشان نمی‌دهد؛ آنجا نویسنده از Properties ویرایش می‌کند.

Placeholder و `developerNotes` هلپ اندیوزر نیستند.

---

## Data Studio (همان منبع، مسیر دوم)

Column Properties بخش Notes امروز دو textarea است. بعد از این پلن:

<table dir="rtl">
<thead><tr><th>فیلد مدلر</th><th>سرنوشت</th></tr></thead>
<tbody><tr><td>Developer Notes</td><td>همان textarea؛ داخلی؛ ترجمه نمی‌شود</td></tr>
<tr><td>Interface Notes</td><td><strong>حذف</strong>؛ جایش کنترل «End-user help» که <strong>همان دیالوگ/ادیتور شورتکات</strong> را باز می‌کند (نه textarea موازی)</td></tr>
<tr><td>گروه ستون</td><td>اکشن هلپ روی هدر گروه در Columns (icon/color از قبل هست)</td></tr>
<tr><td>Relation Properties</td><td>همان کنترل هلپ به‌جای Interface Notes</td></tr>
</tbody></table>

هیچ پیش‌نمایش اندیوزر داخل مدلر لازم نیست مگر `i` روی لیبل Display Name در خودِ دیالوگ Properties — همان متن resolve شده.

Story مدل جدا می‌ماند.

---

## سطوح داخل / خارج v1

<table dir="rtl">
<thead><tr><th>سطح</th><th>v1 این پلن</th></tr></thead>
<tbody><tr><td><code dir="ltr" style="unicode-bidi: embed;">RecordForm</code> Create/Edit/View وقتی ستون/گروه/رابطه کلید هلپ دارد</td><td><code dir="ltr" style="unicode-bidi: embed;">i</code> + تگ نویسنده</td></tr>
<tr><td>CRUD Set تولیدشده از مدل Edge / <code dir="ltr" style="unicode-bidi: embed;">base_*</code> با studio-meta</td><td>همان</td></tr>
<tr><td>Sample mock</td><td>living sample</td></tr>
<tr><td>Users / Roles / Base Info اگر فیلد به ستون مدل map می‌شود</td><td>همان الگو</td></tr>
<tr><td>Data Studio Column / Group / Relation</td><td>ادیتور هلپ</td></tr>
<tr><td>Cultures → Translations</td><td>کلیدها در گرید ظاهر می‌شوند (بدون UI جدید)</td></tr>
<tr><td>Package export <code dir="ltr" style="unicode-bidi: embed;">culture_keys</code></td><td>کلیدهای <code dir="ltr" style="unicode-bidi: embed;">data.help.{objectName}.*</code></td></tr>
<tr><td>Settings / فرم‌های کروم استودیو (hintهای <code dir="ltr" style="unicode-bidi: embed;">*En.ts</code>)</td><td><strong>نه</strong> — همان Cultures modal؛ تگ روی کروم محصول را با هلپ دامنه قاطی نکن</td></tr>
<tr><td>Component Designer <code dir="ltr" style="unicode-bidi: embed;">node.hint</code> دستی</td><td><strong>نه</strong> در v1 (sidecar تور صفحه جداست)</td></tr>
<tr><td>پاراگراف زیر فیلد / native <code dir="ltr" style="unicode-bidi: embed;">title=</code></td><td>هرگز</td></tr>
<tr><td>جدول Sequelize جدا برای هلپ</td><td>نه</td></tr>
<tr><td>ذخیرهٔ بدنه در <code dir="ltr" style="unicode-bidi: embed;">interfaceNotes</code></td><td>نه (مهاجرت یک‌باره بیرون)</td></tr>
</tbody></table>

---

## قرارداد فنی (برای پیاده، نه الان)

**UI (`shared/ui`):**

- `FieldHintTooltip` — رندر مارک‌داون ساده در content (subset).
- `FormHelpAuthorTag` — چیپ؛ فقط وقتی `canAuthorFormHelp`.
- `FormHelpEditDialog` — دیالوگ `md`.
- `FormField` / `FormSection` اختیاری `helpKey`؛ اگر `hint` صریح هم بیاید، `hint` می‌برد (فرم دست‌نویس استودیو دست‌نخورده می‌ماند).

**Resolve:** `shared/lib/dataHelpTranslations.ts` — `dataHelpColumnKey` / `group` / `relation` + `resolveDataHelp(t, key)`.

**RecordForm:** از `objectName` + `columns[].field` کلید می‌سازد؛ گروه‌ها اگر `formSection` از column groups بیاید `helpKey` گروه را به `FormSection` می‌دهد. امروز RecordForm فیلدها را بدون `FormSection` گروهی رندر می‌کند — v1: اگر ستون `group` دارد، فیلدهای اصلی را با `FormSection` per group بپیچ (عنوان = نام گروه). این تنها تغییر چیدمان فرم است؛ بدون گروه رفتار فعلی.

**نقش:** `req.auth.roles` شامل `ADMIN` یا `DEVELOPER`. کلاینت از `/api/auth/me`. تگ را با CSS برای بقیه hide نکن — اصلاً mount نکن.

**FSD:** `features/data-studio` و CRUD از `shared/ui` + `shared/api` می‌خوانند. `features/` همدیگر را import نمی‌کنند.

**Prisma:** هیچ.

---

## تصمیم‌های قفل‌شده (پیشنهاد جلسه)

<table dir="rtl">
<thead><tr><th>#</th><th>حکم</th></tr></thead>
<tbody><tr><td>D1</td><td>ذخیره = Cultures. فرم و Data Studio شورتکات. یک کلید مشتق‌شده.</td></tr>
<tr><td>D2</td><td><code dir="ltr" style="unicode-bidi: embed;">interfaceNotes</code> مهاجرت یک‌باره به master سپس حذف از schema.</td></tr>
<tr><td>D3</td><td><code dir="ltr" style="unicode-bidi: embed;">developerNotes</code> و Story جدا و بدون ترجمهٔ هلپ اندیوزر.</td></tr>
<tr><td>D4</td><td>نویسنده = ADMIN <strong>یا</strong> DEVELOPER. نقش دیگر حتی با Record Policy تگ نمی‌بیند.</td></tr>
<tr><td>D5</td><td>اندیوزر = <code dir="ltr" style="unicode-bidi: embed;">i</code> موجود. تگ نویسنده شکل جدا (چیپ نام فیلد)، نه <code dir="ltr" style="unicode-bidi: embed;">i</code> دوم.</td></tr>
<tr><td>D6</td><td>مارک‌داون ساده؛ تولتیپ <code dir="ltr" style="unicode-bidi: embed;">i</code> همان را render می‌کند.</td></tr>
<tr><td>D7</td><td>v1 دامنه = فرم‌های مدل‌محور (<code dir="ltr" style="unicode-bidi: embed;">RecordForm</code> / CRUD / مدلر). کروم Settings نه.</td></tr>
<tr><td>D8</td><td>Create هم <code dir="ltr" style="unicode-bidi: embed;">i</code> دارد (هلپ فیلد است).</td></tr>
<tr><td>D9</td><td>آیکون History و تگ هلپ هر دو روی لیبل؛ ترتیب ثابت بالا.</td></tr>
<tr><td>D10</td><td>API نوشتن = upsert تک‌کلید؛ نه بازنویسی کل bundle از شورتکات.</td></tr>
<tr><td>D11</td><td>کپی UI انگلیسی.</td></tr>
</tbody></table>

---

## فازها (بعد از «شروع کن»)

<table dir="rtl">
<thead><tr><th>فاز</th><th>کار</th></tr></thead>
<tbody><tr><td>HLP-0</td><td>شارد <code dir="ltr" style="unicode-bidi: embed;">form-help.md</code> + یک‌خط <code dir="ltr" style="unicode-bidi: embed;">projectStandards</code> + مهاجرت schema (<code dir="ltr" style="unicode-bidi: embed;">interfaceNotes</code> → master)</td></tr>
<tr><td>HLP-1</td><td><code dir="ltr" style="unicode-bidi: embed;">dataHelpTranslations</code> + upsert تک‌کلید + تست قرارداد کلید/resolve/ACL</td></tr>
<tr><td>HLP-2</td><td><code dir="ltr" style="unicode-bidi: embed;">FieldHintTooltip</code> مارک‌داون + <code dir="ltr" style="unicode-bidi: embed;">FormHelpAuthorTag</code> + <code dir="ltr" style="unicode-bidi: embed;">FormHelpEditDialog</code> + نمونه Base Components</td></tr>
<tr><td>HLP-3</td><td><code dir="ltr" style="unicode-bidi: embed;">RecordForm</code> / CRUD: <code dir="ltr" style="unicode-bidi: embed;">hint</code> از کلید + تگ نویسنده + <code dir="ltr" style="unicode-bidi: embed;">FormSection</code> برای گروه دارای ستون</td></tr>
<tr><td>HLP-4</td><td>Data Studio: جایگزینی Interface Notes + هلپ گروه + رابطه</td></tr>
<tr><td>HLP-5</td><td>Package <code dir="ltr" style="unicode-bidi: embed;">culture_keys</code> برای <code dir="ltr" style="unicode-bidi: embed;">data.help.*</code> مدل‌های export شده</td></tr>
<tr><td>HLP-6</td><td>تست + مرور مرورگر: sample-mock View با/بدون هلپ، نقش USER در برابر ADMIN، مدلر، Cultures grid</td></tr>
</tbody></table>

---

## MUST NOT

- جدول یا blob جدا برای هلپ
- نگه‌داشتن `interfaceNotes` به‌عنوان کپی دوم انگلیسی بعد از مهاجرت
- نشان دادن `developerNotes` یا Story به اندیوزر
- پاراگراف راهنما زیر فیلد یا `title=`
- اسمارت‌تگ برای نقش غیر ADMIN/DEVELOPER
- ویرایش hintهای کروم استودیو (`settings.*` / `pageGuide.*`) از روی فرم دامنه
- `MarkdownEditDialog` maximized برای این شورتکات
- Import `features/settings` از `features/data-studio` یا برعکس
- Prisma

---

## تست

- کلید مشتق پایدار است با rename ستون/گروه (هلپ جابه‌جا می‌شود نه orphan)
- USER: `i` فقط با هلپ؛ تگ نیست؛ Save هلپ ۴۰۳
- ADMIN: تگ خالی و پر؛ Save انگلیسی و یک override؛ Cultures همان کلید
- RecordForm بدون هلپ مثل امروز است (بدون `i`)
- مدلر دیگر `interfaceNotes` در PUT studio-meta نمی‌فرستد
- `test:critical` بدون رگرسیون

کپی UI انگلیسی.

---

## باز برای اپراتور

اگر خلاف پیشنهاد است بگو؛ وگرنه با «شروع کن» همین قفل‌ها اجرا می‌شوند.

<table dir="rtl">
<thead><tr><th>#</th><th>سؤال</th><th>پیشنهاد</th></tr></thead>
<tbody><tr><td>Q1</td><td>تگ روی فرم‌های Settings هم باشد؟</td><td>نه در v1 (D7)</td></tr>
<tr><td>Q2</td><td>هلپ سطح خودِ مدل (علاوه بر Story)؟</td><td>نه در v1 — Story سازنده است</td></tr>
<tr><td>Q3</td><td>RecordForm بدون گروه امروز تخت است؛ گروه‌بندی سکشن برای هلپ سکشن لازم است. قبول است؟</td><td>بله — فقط وقتی حداقل یک گروه نام‌دار هست</td></tr>
<tr><td>Q4</td><td>چیپ تگ نام ستون باشد یا آیکون <code dir="ltr" style="unicode-bidi: embed;">Tag</code> بدون متن؟</td><td>چیپ با نام ستون (اسکن سریع در فرم شلوغ)</td></tr>
</tbody></table>


</div>
