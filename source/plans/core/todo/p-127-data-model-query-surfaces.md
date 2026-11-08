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

<p><strong>خلاصه برای operatore:</strong> این سند جزو <strong>plans</strong> است (p-127-data-model-query-surfaces). ستون وضعیت در <a href="./p-00-todo-index.md">index مربوطه</a> مرجع «شروع شده / design / تمام» است.</p>
<p><strong>راهنمای خواندن:</strong> بخش‌های انگلیسی برای agent/dev هستند؛ جداول وضعیت و یادداشت‌های فارسی را اول بخوانید.</p>


# p-127 — Data Model Query Surfaces (جستجو · Where Builder · کوئری‌های ازپیش‌تعریف)

> **فاز:** DMQ · **ریلیز:** todo (موج ۶)  
> **اولویت پیاده‌سازی:** DMQ-1…3 ✅ سرور + seed · DMQ-4 🟡 binding API · DMQ-5 ⬜ export پکیج  
> **وضعیت:** 🟡 **در حال پیاده‌سازی** — کنترل: [p-00-todo-index.md](p-00-todo-index.md)  
> **وابستگی:** Data Studio modeler · studio-meta · Data API list · `UiWhereBuilder` / `useListFilter` · CrudSet / Designer grid toolbar · Record Policy (مکمل) · Bases (مصرف‌کنندهٔ بعدی)  
> **شارد هدف (هنگام پیاده):** [`docs/standards/data-model.md`](../../../docs/standards/data-model.md) · [`docs/standards/data-studio-modeler.md`](../../../docs/standards/data-studio-modeler.md) · [`docs/standards/data-studio.md`](../../../docs/standards/data-studio.md) · [`docs/standards/ui-grid.md`](../../../docs/standards/ui-grid.md) · [`docs/standards/crud-set.md`](../../../docs/standards/crud-set.md)

<div dir="rtl" lang="fa">

---

## خلاصهٔ یک‌صفحه‌ای (برای اپراتور)

**مشکل:** هر لیست / صفحهٔ دامنه برای «جستجوی ساده»، «فیلتر پیشرفته»، و «وضعیت‌های کسب‌وکاری» (مثلاً فقط منتشرشده · فقط پیش‌نویس · صف کار تأیید) امروز **دستی** در کد یا spec صفحه تعریف می‌شود. همان منطق در CMS، HWY، CRM و Bases دوباره نوشته می‌شود.

**راه‌حل:** **یک لایهٔ متادیتا روی Edge model (studio-meta)** که چهار **سطح پرس** را توصیف کند؛ runtime (Data API + لیست‌های متصل) همان قرارداد را بخواند — **greenfield**، بدون dual parser.

<table dir="rtl">
<thead><tr><th>سطح</th><th>کاربر نهایی چه می‌بیند؟</th><th>متادیتا (خلاصه)</th></tr></thead>
<tbody><tr><td><strong>A — جستجوی سریع</strong></td><td>Omnibox / <code dir="ltr" style="unicode-bidi: embed;">ToolbarSearchInput</code> روی لیست</td><td><code dir="ltr" style="unicode-bidi: embed;">columnMeta[].searchRole</code> — <strong>قرارداد موجود</strong></td></tr>
<tr><td><strong>B — جستجوی گسترده</strong></td><td>فیلترهای «بیشتر» / پنل ثانویه (در صورت وجود UI)</td><td>همان <code dir="ltr" style="unicode-bidi: embed;">searchRole: advanced</code></td></tr>
<tr><td><strong>C — List Where</strong></td><td><code dir="ltr" style="unicode-bidi: embed;">ListFilterDialog</code> + <code dir="ltr" style="unicode-bidi: embed;">UiWhereBuilder</code></td><td><code dir="ltr" style="unicode-bidi: embed;">columnMeta[].filterRole</code> (<strong>پیشنهاد</strong>)</td></tr>
<tr><td><strong>D — کوئری‌های نام‌دار</strong></td><td>تب / chip / منوی «نما» (Drafts · Published · …)</td><td><code dir="ltr" style="unicode-bidi: embed;">extensions.queryPresets[]</code> (<strong>پیشنهاد</strong>)</td></tr>
</tbody></table>

**وضعیت‌های مختلف روی انتیتی** (lifecycle، editorial، LOV وضعیت) عمدتاً در **سطح D** مدل می‌شوند: هر وضعیت = یک **preset** با درخت `WhereGroupNode` (همان AST لیست‌فیلتر)، نه کد TypeScript جدید per صفحه. ستون وضعیت معمولاً در **A/B/C** هم نقش دارد (جستجو / فیلتر دستی).

**تفکیک از Record Policy:** Record Policy = **مجوز ردیف** (چه کسی بعد از اجازهٔ API). Query Surfaces = **معنای محصول / برش دادهٔ UI** (چه زیرمجموعه‌ای نشان داده شود). ادغام سرور: `policyWhere AND mandatoryPresets AND optionalPresets (انتخاب کاربر) AND listWhere AND search`.

**تفکیک از Access Assistant:** Access Assistant = **Allowed روی function صفحه**. تخصیص preset/ستون محدود = **binding جدا** (`workspace/query-surface-bindings/`) با **همان UX ویزارد** (Subject نقش/کاربر + allowlist) — نه merge در manifest function.

---

## اصل طراحی

1. **منبع حقیقت:** `workspace/edge-model-studio-meta/` + bindingهای runtime (مثل Record Policy) — publish با Edge export/install.
2. **AST واحد:** presetها و List Where از **`WhereGroupNode`** / IR موجود (`listWhereFilter`) — نه SQL آزاد، نه fragment جدا.
3. **پیش‌فرض امن و ساده:** ستون جدید در جستجو **نیست** (`searchRole: none` — امروز هم default است). در Where Builder **عمومی** (`filterRole: public`) مگر دولوپر `none` یا `restricted` بزند.
4. **مصرف‌کننده‌ها یک قرارداد:** Data API list · CrudSet (وقتی به Edge وصل است) · Designer `AppTableGrid` · Bases View (ارجاع به `presetId` بعد از p-127).

---

## دسته‌بندی متادیتا

### ۱) سطح ستون (`columnMeta[]`)

<table dir="rtl">
<thead><tr><th>فیلد</th><th>وضعیت</th><th>مقادیر</th><th>مصرف</th></tr></thead>
<tbody><tr><td><code dir="ltr" style="unicode-bidi: embed;">searchRole</code></td><td><strong>موجود در Zod + مدلر</strong></td><td><code dir="ltr" style="unicode-bidi: embed;">basic</code> · <code dir="ltr" style="unicode-bidi: embed;">advanced</code> · <code dir="ltr" style="unicode-bidi: embed;">none</code></td><td>پارامتر <code dir="ltr" style="unicode-bidi: embed;">search</code> در Data API؛ toolbar search</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">filterRole</code></td><td><strong>پیشنهاد (DMQ-2)</strong></td><td><code dir="ltr" style="unicode-bidi: embed;">public</code> · <code dir="ltr" style="unicode-bidi: embed;">restricted</code> · <code dir="ltr" style="unicode-bidi: embed;">none</code></td><td>فیلدهای <code dir="ltr" style="unicode-bidi: embed;">UiWhereBuilder</code> در List Filter</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">targetFilter</code> (روی relation)</td><td><strong>موجود</strong></td><td>آرایهٔ شرط AND</td><td>فقط picker/lookup — الگوی فیلتر ثابت</td></tr>
</tbody></table>

**قوانین پیشنهادی `filterRole`:**

- `public` — هر principal که لیست را صدا می‌زند، فیلد را در builder می‌بیند (پیش‌فرض).
- `restricted` — فقط نقش‌های (یا کاربران) listed در binding؛ بقیه فیلد در UI و در compile `where` کاربر **نادیده** (sanitize).
- `none` — ستون در List Where نیست (ستون‌های حساس / binary / JSON سنگین).

**نوع داده در جستجو (`searchRole`):**

<table dir="rtl">
<thead><tr><th>نوع ستون</th><th><code dir="ltr" style="unicode-bidi: embed;">basic</code></th><th><code dir="ltr" style="unicode-bidi: embed;">advanced</code></th><th>یادداشت</th></tr></thead>
<tbody><tr><td>text-like</td><td>✅ contains OR</td><td>✅</td><td>FK display via enrichment اگر در basic باشد</td></tr>
<tr><td>number / date / bool</td><td>❌ پیش‌فرض</td><td>✅ با اپراتور مناسب</td><td>جستجوی سریع فقط متن</td></tr>
<tr><td>culture / چندزبانه</td><td>✅ روی ستون canonical + مسیر ترجمه در enrichment</td><td>✅</td><td>DMQ-1 با <code dir="ltr" style="unicode-bidi: embed;">dataApiFieldEnrichment</code></td></tr>
<tr><td>JSON</td><td>❌</td><td>optional فاز بعد</td><td>خارج از v1</td></tr>
</tbody></table>

### ۲) سطح آبجکت — `extensions.querySurfaces` (پیشنهاد)

```json
{
  "querySurfaces": {
    "schemaVersion": "1.0.0",
    "presets": [
      {
        "id": "published-only",
        "label": "Published",
        "description": "Editorial status is published.",
        "where": { /* WhereGroupNode root */ },
        "application": "optional",
        "defaultSelected": true,
        "visibility": "public",
        "sortOrder": 10,
        "icon": "lucide:check-circle"
      },
      {
        "id": "drafts-queue",
        "label": "Drafts",
        "where": { /* ... */ },
        "application": "optional",
        "visibility": "restricted",
        "sortOrder": 20
      }
    ]
  }
}
```

**فیلد `application` (preset):**

<table dir="rtl">
<thead><tr><th>مقدار</th><th>معنی UX</th><th>معنی API</th></tr></thead>
<tbody><tr><td><code dir="ltr" style="unicode-bidi: embed;">mandatory</code></td><td>کاربر نمی‌تواند خاموش کند؛ ممکن است chip فقط‌خواندنی</td><td>همیشه AND در سرور</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">optional</code></td><td>chip / toggle / تب</td><td>فقط اگر کاربر انتخاب کرده یا <code dir="ltr" style="unicode-bidi: embed;">defaultSelected</code></td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">default-on</code></td><td>روشن اول بار؛ کاربر می‌تواند خاموش کند</td><td>مثل optional با default</td></tr>
</tbody></table>

چند `mandatory` → همه با AND. ترتیب: `sortOrder` فقط برای UI.

**دسته‌های معمول preset (برای seed پکیج‌ها — نه enum سخت):**

<table dir="rtl">
<thead><tr><th>دسته</th><th>مثال</th><th>معمولاً</th></tr></thead>
<tbody><tr><td><strong>Editorial / lifecycle</strong></td><td>Published · Draft · Archived</td><td><code dir="ltr" style="unicode-bidi: embed;">optional</code> + یکی <code dir="ltr" style="unicode-bidi: embed;">default-on</code></td></tr>
<tr><td><strong>صف کار</strong></td><td>Pending approval · Assigned to me</td><td><code dir="ltr" style="unicode-bidi: embed;">optional</code>؛ بعضی <code dir="ltr" style="unicode-bidi: embed;">mandatory</code> در portal</td></tr>
<tr><td><strong>سیاست نمایش</strong></td><td>Active only · Non-deleted</td><td>اغلب <code dir="ltr" style="unicode-bidi: embed;">mandatory</code> در API عمومی</td></tr>
<tr><td><strong>تحلیل</strong></td><td>Last 30 days</td><td><code dir="ltr" style="unicode-bidi: embed;">optional</code></td></tr>
</tbody></table>

ستون وضعیت (`status_code`, `lifecycle_status`, …) در مدل **FK/LOV** می‌ماند؛ preset فقط **عبارت where** روی آن ستون (و شاید تاریخ) است.

### ۳) تخصیص دسترسی — `workspace/query-surface-bindings/{edgeModelId}.json`

```json
{
  "edgeModelId": "em_…",
  "columnWhereGrants": {
    "national_id": { "mode": "roles", "roleIds": ["…"] }
  },
  "presetGrants": {
    "drafts-queue": { "mode": "roles", "roleIds": ["…"] }
  }
}
```

- `mode: public` — پیش‌فرض؛ نیازی به ردیف نیست.
- UI تخصیص: **همان الگوی ویزارد** Access Assistant (Subject + allowlist) با entityKind جدید `query-surface` — **نه** toggle function صفحه.
- Membership در DB control-plane در v1 **نیست** (فایل workspace مثل record-policy bindings).

---

## نقشهٔ مصرف در UI (پاسخ سؤالات محور ۱–۳)

<table dir="rtl">
<thead><tr><th>Surface</th><th>منبع فیلدها / preset</th><th>یادداشت</th></tr></thead>
<tbody><tr><td>Data API <code dir="ltr" style="unicode-bidi: embed;">GET list</code></td><td>studio-meta + bindings + query params</td><td><code dir="ltr" style="unicode-bidi: embed;">search</code>, <code dir="ltr" style="unicode-bidi: embed;">where</code>, <code dir="ltr" style="unicode-bidi: embed;">presets</code> (نام پارامتر در spec)</td></tr>
<tr><td>CrudSet toolbar search</td><td><code dir="ltr" style="unicode-bidi: embed;">searchRole: basic</code></td><td>اگر list به Edge model bind است؛ else همان رفتار spec</td></tr>
<tr><td>CrudSet List Filter</td><td><code dir="ltr" style="unicode-bidi: embed;">filterRole</code> + preset chips</td><td>فیلدهای صفحه فقط وقتی override صریح در spec</td></tr>
<tr><td>Designer grid toolbar</td><td>همان CrudSet/Data API path</td><td><code dir="ltr" style="unicode-bidi: embed;">listWhereFilter</code> + search از مدل</td></tr>
<tr><td>Data API <code dir="ltr" style="unicode-bidi: embed;">q</code> legacy</td><td><strong>نداریم</strong> — فقط <code dir="ltr" style="unicode-bidi: embed;">search</code> + <code dir="ltr" style="unicode-bidi: embed;">where</code> tree</td><td>greenfield</td></tr>
<tr><td>Record Policy builder</td><td><strong>جدا</strong> — predicate scope</td><td>فیلدها از مدل؛ معنی متفاوت</td></tr>
</tbody></table>

---

## وضعیت فعلی کد (برای تحلیل)

<table dir="rtl">
<thead><tr><th>لایه</th><th>امروز</th><th>شکاف</th></tr></thead>
<tbody><tr><td><code dir="ltr" style="unicode-bidi: embed;">columnMeta.searchRole</code></td><td>Zod · مدلر Column Properties · seedهای CMS/HWY/CRM</td><td>Data API هنوز <code dir="ltr" style="unicode-bidi: embed;">resolveSearchableFields</code> از <strong>نوع text</strong> می‌خواند، نه studio-meta</td></tr>
<tr><td>List Where fields</td><td><code dir="ltr" style="unicode-bidi: embed;">edgeModelListWhereColumns</code> = <strong>همهٔ ستون‌ها</strong></td><td>بدون allowlist / <code dir="ltr" style="unicode-bidi: embed;">filterRole</code></td></tr>
<tr><td>Predefined queries</td><td>—</td><td>فقط <code dir="ltr" style="unicode-bidi: embed;">associationMeta.targetFilter</code> برای lookup</td></tr>
<tr><td>Record Policy</td><td><code dir="ltr" style="unicode-bidi: embed;">policyWhere</code> در executor</td><td>مکمل؛ جایگزین preset نیست</td></tr>
<tr><td>CrudSet <code dir="ltr" style="unicode-bidi: embed;">filterBar</code></td><td>spec محلی per page</td><td>باید به preset id ارجاع دهد وقتی Edge-bound</td></tr>
<tr><td>Package export</td><td>studio-meta در zip</td><td>extensions + bindings باید در DMQ-5 تعریف شود</td></tr>
</tbody></table>

---

## تصمیم‌های پیشنهادی (قفل پس از ریویو اپراتور)

<table dir="rtl">
<thead><tr><th>#</th><th>موضوع</th><th>پیشنهاد</th></tr></thead>
<tbody><tr><td>D-1</td><td>جستجوی ساده = کدام UI؟</td><td><strong>همهٔ لیست‌های Edge-bound:</strong> toolbar <code dir="ltr" style="unicode-bidi: embed;">search</code> + Data API؛ «advanced» = فیلدهای اضافه در همان جستجو یا پنل ثانویهٔ آینده — نه ستون جدا در v1</td></tr>
<tr><td>D-2</td><td>ذخیرهٔ searchable</td><td><strong><code dir="ltr" style="unicode-bidi: embed;">columnMeta.searchRole</code> فقط</strong> — بدون آرایهٔ تکراری روی آبجکت</td></tr>
<tr><td>D-3</td><td>builder vs API filter</td><td><strong>یک allowlist</strong> (<code dir="ltr" style="unicode-bidi: embed;">filterRole</code>); API لیست همان ستون‌ها را در <code dir="ltr" style="unicode-bidi: embed;">where</code> tree می‌پذیرد (sanitize)</td></tr>
<tr><td>D-4</td><td>public/role روی ستون vs preset</td><td><strong>ستون:</strong> <code dir="ltr" style="unicode-bidi: embed;">filterRole</code> + grants · <strong>preset:</strong> <code dir="ltr" style="unicode-bidi: embed;">visibility</code> + <code dir="ltr" style="unicode-bidi: embed;">presetGrants</code></td></tr>
<tr><td>D-5</td><td>Record Policy</td><td><strong>مکمل</strong> — policy اول؛ presetها بعد؛ هرگز policy را دور نزن</td></tr>
<tr><td>D-6</td><td>دیالوگ استاندارد</td><td><strong>ویزارد Access Assistant</strong> (Subject + rows) روی binding جدید — نه merge در function manifest</td></tr>
<tr><td>D-7</td><td>شکل preset</td><td><strong><code dir="ltr" style="unicode-bidi: embed;">WhereGroupNode</code> JSON</strong> در extensions — همان serializer لیست</td></tr>
<tr><td>D-8</td><td>mandatory</td><td>سرور همیشه AND؛ UI قفل یا chip غیرقابل حذف</td></tr>
<tr><td>D-9</td><td>publish</td><td>نسخه در <code dir="ltr" style="unicode-bidi: embed;">querySurfaces.schemaVersion</code>؛ export/import با edge studio-meta</td></tr>
<tr><td>D-10</td><td>آبجکت جدید</td><td>search: همه <code dir="ltr" style="unicode-bidi: embed;">none</code> · where: همه <code dir="ltr" style="unicode-bidi: embed;">public</code> به‌جز PK/audit اختیاری <code dir="ltr" style="unicode-bidi: embed;">none</code></td></tr>
</tbody></table>

**سؤالات باز (کم‌مانده):**

<table dir="rtl">
<thead><tr><th>#</th><th>سؤال</th><th>جهت ترجیحی</th></tr></thead>
<tbody><tr><td>O-1</td><td>پارامتر چند preset: <code dir="ltr" style="unicode-bidi: embed;">presets=id1,id2</code> یا body؟</td><td>query string برای GET list</td></tr>
<tr><td>O-2</td><td>آیا CrudSet بدون Edge binding اصلاً query surfaces می‌خواند؟</td><td>خیر — فقط Edge-bound</td></tr>
<tr><td>O-3</td><td>فرهنگ / چند ستون ترجمه در یک <code dir="ltr" style="unicode-bidi: embed;">basic</code> search</td><td>OR روی ستون‌های canonical + resolved culture path در DMQ-1</td></tr>
</tbody></table>

**تحلیل اپراتور:** _(پس از خواندن خلاصه — تأیید/رد D-1…D-10 و O-1…O-3)_

---

## تعریف موفقیت

1. دولوپر در مدلر `searchRole` و `filterRole` را تنظیم می‌کند؛ لیست‌های متصل بدون کد صفحه همان را می‌گیرند.
2. دولوپر preset می‌سازد (mandatory/optional) برای وضعیت‌های کسب‌وکاری؛ seed پکیج (CMS، HWY، …) از preset id استفاده می‌کند نه where دستی در scaffold.
3. تخصیص نقش برای preset/ستون restricted از binding + ویزارد استاندارد.
4. `policyWhere AND presets AND user where AND search` در Data API تست‌شده؛ out-of-scope sanitize برای فیلدهای غیرمجاز.
5. `npm run test:critical` بدون رگرسیون.

---

## ادغام UI: List & access (یک ورودی مدلر)

<div dir="rtl" lang="fa">

**هدف اپراتور:** به‌جای دو دکمهٔ جدا، یک سطح برای «برش دادهٔ لیست» + لینک به «محدودهٔ رکورد».

<table dir="rtl">
<thead><tr><th>نیاز</th><th>محل در محصول</th><th>قرارداد</th></tr></thead>
<tbody><tr><td>ساخت predefined query با نام/لیبل</td><td>مدلر → <strong>List &amp; access</strong> → Definitions</td><td><code dir="ltr" style="unicode-bidi: embed;">extensions.querySurfaces.presets[]</code> · <code dir="ltr" style="unicode-bidi: embed;">label</code> + <code dir="ltr" style="unicode-bidi: embed;">labelKey</code> (فرهنگ)</td></tr>
<tr><td>فورس روی متد list</td><td><strong>Configure Data API</strong> → Query</td><td><code dir="ltr" style="unicode-bidi: embed;">operation.query.forcedPresetIds[]</code></td></tr>
<tr><td>کومبو اختیاری در کلاینت</td><td>Designer grid: chips یا <code dir="ltr" style="unicode-bidi: embed;">QueryPresetPicker</code></td><td><code dir="ltr" style="unicode-bidi: embed;">?presets=</code> · manifest · <code dir="ltr" style="unicode-bidi: embed;">clientPresetIds</code> روی API</td></tr>
<tr><td>نقش/کاربر روی فیلتر اختیاری حساس</td><td>Definitions → visibility <code dir="ltr" style="unicode-bidi: embed;">restricted</code> + تب Role access</td><td><code dir="ltr" style="unicode-bidi: embed;">query-surface-bindings</code> (بعداً: ویزارد Access Assistant مثل D-6)</td></tr>
<tr><td>سیاست رکورد</td><td>تب Record scope → ویرایشگر Record Policies</td><td><code dir="ltr" style="unicode-bidi: embed;">recordPolicyId</code> / bypass روی همان API · <strong>بعد از</strong> preset WHERE</td></tr>
</tbody></table>

**پشتهٔ سرور (ثابت):** `defaultWhere ∧ forcedPresets ∧ mandatoryPresets ∧ userPresets ∧ listWhere ∧ search` → سپس **Record Policy**.

</div>

---

## فازهای پیاده‌سازی (پس از تأیید)

<table dir="rtl">
<thead><tr><th>فاز</th><th>محتوا</th><th>خروجی</th></tr></thead>
<tbody><tr><td><strong>DMQ-1</strong></td><td><code dir="ltr" style="unicode-bidi: embed;">searchRole</code> → <code dir="ltr" style="unicode-bidi: embed;">resolveSearchableFields</code> + toolbar/designer/CrudSet</td><td>spec کوچک + تست executor</td></tr>
<tr><td><strong>DMQ-2</strong></td><td><code dir="ltr" style="unicode-bidi: embed;">filterRole</code> + Zod + مدلر + <code dir="ltr" style="unicode-bidi: embed;">edgeModelListWhere</code> allowlist + sanitize</td><td>shard modeler</td></tr>
<tr><td><strong>DMQ-3</strong></td><td><code dir="ltr" style="unicode-bidi: embed;">extensions.querySurfaces</code> + بخش Presets در مدلر + merge executor</td><td>seed نمونه CMS editorial</td></tr>
<tr><td><strong>DMQ-4</strong></td><td><code dir="ltr" style="unicode-bidi: embed;">query-surface-bindings</code> + UI ویزارد تخصیص</td><td>shard access-pattern</td></tr>
<tr><td><strong>DMQ-5</strong></td><td>export/install package · Bases ارجاع <code dir="ltr" style="unicode-bidi: embed;">presetId</code> · مهاجرت seedهای سخت‌کد</td><td>به‌روز p-packages-bases</td></tr>
</tbody></table>

---

## خروجی‌های بعد از تأیید تحلیل

- [ ] `specs/data-model-query-surfaces/` (قرارداد Zod + نمونه JSON)
- [ ] به‌روزرسانی `data-studio-modeler.md` · `data-studio.md` · `data-model.md`
- [ ] `projectStandards.ts` یک‌خطی‌ها
- [ ] الگوی binding + (در صورت نیاز) ردیف docs برای ویزارد تخصیص
- [ ] execution prompts DMQ-1 … در همین فایل یا `plans/core/todo/p-127-dmq-*.md`

---

## لاگ

<table dir="rtl">
<thead><tr><th>تاریخ</th><th>خلاصه</th></tr></thead>
<tbody><tr><td>۲۰۲۶-۰۹-۱۶</td><td>ایجاد سند خام از سه محور جستجو · where builder · predefined queries</td></tr>
<tr><td>۲۰۲۶-۰۹-۱۷</td><td>دسته‌بندی چهار سطح (A–D) · قرارداد preset برای وضعیت انتیتی · تفکیک Policy/Access · تصمیم‌های D-1…D-10 · فاز DMQ-1…5 · وضعیت «design draft»</td></tr>
</tbody></table>

</div>


</div>
