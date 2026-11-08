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

<p><strong>خلاصه برای operatore:</strong> این سند جزو <strong>plans</strong> است (p-bases-phase-1-database-and-meta). ستون وضعیت در <a href="../p-00-packages-index.md">index مربوطه</a> مرجع «شروع شده / design / تمام» است.</p>
<p><strong>راهنمای خواندن:</strong> بخش‌های انگلیسی برای agent/dev هستند؛ جداول وضعیت و یادداشت‌های فارسی را اول بخوانید.</p>


# Bases — فاز ۱: دیتابیس، Base Info، studio-meta

> **Package:** Bases (#117) — [p-packages-bases.md](./p-packages-bases.md)  
> **فاز:** ۱ از ۳ (بدون API · بدون UI)  
> **وضعیت:** ⬜ design only — پیاده‌سازی نشده  
> **آخرین به‌روزرسانی:** ۲۰۲۶-۰۹-۱۷  
> **پیش‌نیاز:** Data Studio + Edge data source (PostgreSQL یا SQL Server) · `base_info` · `base_users` روی control plane  
> **بعدی:** [p-bases-phase-2-server-api.md](./p-bases-phase-2-server-api.md)

---

## هدف فاز

تحویل **چهار جدول متادیتای `bs_*`** با associations کامل، **ریشهٔ Base Info «Bases»** (دو دستهٔ enum بسته)، و **studio-meta کامل** برای هر مدل — طوری که در Data Studio هر بند پذیرش بصری §۸ سند اصلی سبز باشد.

**یک جمله:** مثل NocoDB که روی DB موجود می‌نشیند، AppEndO اسکیمای فیزیکی را در Data Studio می‌سازد؛ فاز ۱ فقط **ظرف متادیتا** را می‌سازد، نه رکورد دامنهٔ Edge را کپی نمی‌کند.

### تحقیق بازار → تصمیم فاز ۱

<table dir="rtl">
<thead><tr><th>منبع</th><th>درس</th><th>اعمال در فاز ۱</th></tr></thead>
<tbody><tr><td><a href="https://support.airtable.com/articles/5256670301-structuring-airtable-bases">Airtable — structuring bases</a></td><td>یک entity = یک جدول؛ view جداگانه نه جدول تکراری</td><td><code dir="ltr" style="unicode-bidi: embed;">bs_views</code> = config ذخیره‌شده، <strong>بدون</strong> <code dir="ltr" style="unicode-bidi: embed;">bs_records</code></td></tr>
<tr><td><a href="https://nocodb.com/docs/product/tables/views">NocoDB — Views</a></td><td>هر view فیلتر/sort/visibility مستقل؛ داده یک منبع</td><td><code dir="ltr" style="unicode-bidi: embed;">config_json</code> schema-versioned (تعریف در فاز ۲؛ ستون در فاز ۱)</td></tr>
<tr><td>Baserow</td><td>اسکیمای داخلی خودش</td><td><strong>رد:</strong> ما Edge model موجود را reference می‌کنیم (<code dir="ltr" style="unicode-bidi: embed;">edge_object_name</code>)</td></tr>
</tbody></table>

---

## دامنه IN / OUT

### داخل فاز ۱

- DDL `bs_bases` · `bs_collections` · `bs_views` · `bs_view_favorites` (PostgreSQL + SQL Server install/uninstall SQL)
- ثبت Edge models + associations طبق جدول کاننیکال سند اصلی
- Base Info: روت `Bases` → Base Status · View Kind (آیتم‌ها با Lucide در `ui_html`)
- studio-meta: Story · `columnGroupOrder` · `columnMeta` · `associationMeta` · tags/labels برای هر چهار مدل
- اسکریپت idempotent: `scripts/bases-phase1/` (الگو: `scripts/cms-phase1/`)

### خارج فاز ۱ (سخت)

- هر Server Function / route `/api/bs/*`
- nav · Client Components · designer drafts
- seed در `controlPlaneSeed` · Package Manager zip · `src/core/packages/bases/`
- `db.query` · Prisma models جدید برای `bs_*`
- دادهٔ نمونهٔ روی جداول Edge (اختیاری در فاز ۳b با `tsk_tasks`)

---

## مدل داده (مرجع اجرا)

جزئیات ستون‌ها و قواعد در [p-packages-bases.md §مدل دامنه](./p-packages-bases.md). خلاصهٔ اجرایی:

<table dir="rtl">
<thead><tr><th>جدول</th><th>نقش</th><th>قیود کلیدی</th></tr></thead>
<tbody><tr><td><code dir="ltr" style="unicode-bidi: embed;">bs_bases</code></td><td>workspace اپراتور</td><td><code dir="ltr" style="unicode-bidi: embed;">slug</code> UNIQUE · <code dir="ltr" style="unicode-bidi: embed;">status_code</code> → Base Status</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">bs_collections</code></td><td>ثبت <code dir="ltr" style="unicode-bidi: embed;">edge_object_name</code> در Base</td><td>UNIQUE (<code dir="ltr" style="unicode-bidi: embed;">base_id</code>, <code dir="ltr" style="unicode-bidi: embed;">edge_object_name</code>)</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">bs_views</code></td><td>نمای ذخیره‌شده</td><td>UNIQUE (<code dir="ltr" style="unicode-bidi: embed;">collection_id</code>, <code dir="ltr" style="unicode-bidi: embed;">slug</code>) · <code dir="ltr" style="unicode-bidi: embed;">config_json</code> NOT NULL</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">bs_view_favorites</code></td><td>پین per-user</td><td>PK (<code dir="ltr" style="unicode-bidi: embed;">user_id</code>, <code dir="ltr" style="unicode-bidi: embed;">view_id</code>)</td></tr>
</tbody></table>

**ممنوع:** `bs_fields` · `bs_records` · FK جعلی از `edge_object_name` به Edge (فقط string + runtime resolve).

### Associations (باید در Data Studio Relations تب کامل باشد)

همان جدول «Edge model associations — کاننیکال» در سند اصلی — بدون belongsToMany معکوس اضافی.

---

## Base Info — seed specification

```
Base Info
└── Bases                              ← root (create on install)
    ├── Base Status                    ← status_code on bs_bases
    │   ├── Active      (shortName: active,    Lucide: Database)
    │   └── Archived    (shortName: archived, Lucide: Archive)
    └── View Kind                      ← view_kind_code on bs_views (badge only)
        ├── Grid        (grid)
        ├── Kanban      (kanban)
        ├── Calendar    (calendar)
        └── Gallery     (gallery)
```

- `targetFilter` / `root=` با id واقعی category پس از insert
- **بدون** صفحه Settings برای این دو دسته (enum بسته)

فایل‌های پیشنهادی در اسکریپت:

- `scripts/bases-phase1/seed/basesBaseInfoCatalog.ts`
- `scripts/bases-phase1/seed/seedBasesBaseInfo.ts`
- `scripts/bases-phase1/seed/seedBasesStudioMeta.ts`

---

## studio-meta — چک‌لیست per model

برای **هر** `bs_*` مدل:

1. Story انگلیسی (Purpose · Lifecycle · Rules) — متن‌های سند اصلی §۸
2. گروه‌های ستون بدون Ungrouped معنادار
3. `columnMeta`: required · `searchRole` روی slug/title · LOV روی association `*_code`
4. `associationMeta`: نام `as` مطابق wiring
5. `labels`: title · icon · color · tags (جدول هویت سند اصلی)

### formWidget hints (برای فاز ۳)

<table dir="rtl">
<thead><tr><th>ستون</th><th>widget</th></tr></thead>
<tbody><tr><td><code dir="ltr" style="unicode-bidi: embed;">bs_views.config_json</code></td><td>json editor + schema hint (v1)</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">bs_bases.icon</code></td><td>text (Lucide name)</td></tr>
<tr><td>associations <code dir="ltr" style="unicode-bidi: embed;">status</code> / <code dir="ltr" style="unicode-bidi: embed;">view_kind</code></td><td>choice از Base Info</td></tr>
</tbody></table>

---

## اسکریپت نصب / رولبک

```
scripts/bases-phase1/
  install-bases-phase1.ts
  index.ts                    ← exports table names, seed fns
  db/install/bases_schema.sql
  db/install/bases_schema.sqlserver.sql
  db/uninstall/...
  seed/...
```

**package.json** (هنگام پیاده‌سازی):

```json
"bases:phase1": "tsx scripts/bases-phase1/install-bases-phase1.ts",
"bases:phase1:rollback": "tsx scripts/bases-phase1/install-bases-phase1.ts --rollback"
```

رفتار:

- Opt-in only — **نه** bootstrap
- پس از DDL: sync Edge models · wire associations · seed Base Info · seed studio-meta
- Rollback: uninstall SQL · unseed Base Info subtree · حذف edge models + studio-meta (نه حذف جداول Edge دامنهٔ ثبت‌شده در collection)

---

## پذیرش فاز ۱

<table dir="rtl">
<thead><tr><th>#</th><th>معیار</th><th>روش</th></tr></thead>
<tbody><tr><td>A1</td><td>چهار مدل در Data Studio با Story + groups</td><td>باز کردن هر مدل</td></tr>
<tr><td>A2</td><td>Relations = جدول associations</td><td>تب Relations</td></tr>
<tr><td>A3</td><td>LOV روی <code dir="ltr" style="unicode-bidi: embed;">status_code</code> / <code dir="ltr" style="unicode-bidi: embed;">view_kind_code</code></td><td>picker association</td></tr>
<tr><td>A4</td><td>Rollback model → studio-meta حذف</td><td>rollback تک‌مدل در DS</td></tr>
<tr><td>A5</td><td>Base Info subtree «Bases» با ۲ دسته + ۶ آیتم</td><td>Base Info UI</td></tr>
<tr><td>A6</td><td><code dir="ltr" style="unicode-bidi: embed;">npm run bases:phase1</code> idempotent دومین بار</td><td>لاگ بدون خطا</td></tr>
<tr><td>A7</td><td><strong>ممنوع:</strong> هیچ route <code dir="ltr" style="unicode-bidi: embed;">/api/bs</code> در repo پس از فاز ۱</td><td>grep</td></tr>
</tbody></table>

---

## ریسک‌ها و mitigation

<table dir="rtl">
<thead><tr><th>ریسک</th><th>mitigation</th></tr></thead>
<tbody><tr><td>SQL Server vs PostgreSQL نوع <code dir="ltr" style="unicode-bidi: embed;">jsonb</code></td><td>دو فایل install مثل CMS</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">edge_object_name</code> بدون مدل</td><td>validation فقط فاز ۲؛ فاز ۱ ستون varchar</td></tr>
<tr><td>studio-meta sparse نشود</td><td>کپی ساختار از <code dir="ltr" style="unicode-bidi: embed;">seedCmsStudioMeta</code></td></tr>
</tbody></table>

---

## پرامپت عامل (فاز ۱)

```
@plans/packages/todo/bases-package/p-bases-phase-1-database-and-meta.md را اجرا کن

فقط فاز ۱: scripts/bases-phase1/ (idempotent) · DDL چهار جدول bs_* · associations ·
Base Info روت Bases · studio-meta کامل. الگو: scripts/cms-phase1/.
ممنوع: API، UI، nav، bootstrap seed، db.query، package zip.
پذیرش A1–A7 را گزارش کن.
```

</div>
