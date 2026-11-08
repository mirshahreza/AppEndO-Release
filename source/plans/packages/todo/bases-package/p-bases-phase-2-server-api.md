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

<p><strong>خلاصه برای operatore:</strong> این سند جزو <strong>plans</strong> است (p-bases-phase-2-server-api). ستون وضعیت در <a href="../p-00-packages-index.md">index مربوطه</a> مرجع «شروع شده / design / تمام» است.</p>
<p><strong>راهنمای خواندن:</strong> بخش‌های انگلیسی برای agent/dev هستند؛ جداول وضعیت و یادداشت‌های فارسی را اول بخوانید.</p>


# Bases — فاز ۲: Server API (Sequelize)

> **Package:** Bases (#117) — [p-packages-bases.md](./p-packages-bases.md)  
> **فاز:** ۲ از ۳  
> **وضعیت:** ⬜ design only  
> **آخرین به‌روزرسانی:** ۲۰۲۶-۰۹-۱۷  
> **پیش‌نیاز:** فاز ۱ ✅ ([p-bases-phase-1-database-and-meta.md](./p-bases-phase-1-database-and-meta.md))  
> **بعدی:** [p-bases-phase-3a-nav-and-bases.md](./p-bases-phase-3a-nav-and-bases.md)

---

## هدف فاز

CRUD کامل روی `bs_*` · **`resolve-view`** (merge studio-meta + `config_json` → column spec برای UI) · اعتبارسنجی **`register-collection`** · **`duplicate-view`** · **`set-default-view`** · **favorites toggle** · **related counts** — همه با Sequelize Edge و Server Functions، **بدون** `db.query`.

رکوردهای collection: **پروکسی** به همان `/api/{edgeObjectName}` — این فاز handler جدا برای list رکورد نمی‌سازد مگر helper داخلی برای count.

### تحقیق → قرارداد resolve

<table dir="rtl">
<thead><tr><th>محصول</th><th>الگو</th><th>Bases</th></tr></thead>
<tbody><tr><td>NocoDB</td><td>filter/sort/visibility per view؛ یک منبع داده</td><td><code dir="ltr" style="unicode-bidi: embed;">config_json</code> + query string Data API</td></tr>
<tr><td>Grist</td><td>sort/filter در metadata view</td><td><code dir="ltr" style="unicode-bidi: embed;">resolve</code> خروجی <code dir="ltr" style="unicode-bidi: embed;">sort[]</code> + <code dir="ltr" style="unicode-bidi: embed;">filter</code> + <code dir="ltr" style="unicode-bidi: embed;">columns[]</code></td></tr>
<tr><td>Airtable</td><td>همه viewها یک table</td><td><code dir="ltr" style="unicode-bidi: embed;">edge_object_name</code> ثابت؛ view فقط presentation</td></tr>
</tbody></table>

---

## `config_json` — schema v1 (canonical)

```typescript
/** Stored in bs_views.config_json — NOT record payloads */
type BasesViewConfigV1 = {
  schemaVersion: 1;
  /** Data API filter DSL — optional */
  filter?: Record<string, unknown>;
  sort?: Array<{ field: string; direction: 'asc' | 'desc' }>;
  /** Column ids / field names from Edge model; empty = all default visible per studio-meta */
  visibleColumns?: string[];
  /** Grid: quick search fields */
  search?: { fields: string[] };
  kanban?: {
    statusColumn: string; // must be *_code or LOV-backed column on target
    titleColumn?: string;
    /** optional WIP column colors — v1 plain buckets */
  };
  calendar?: {
    startColumn: string; // date | datetime on target
    endColumn?: string;
    titleColumn?: string;
  };
  gallery?: {
    titleColumn: string;
    imageColumn: string; // file FK or url column
    subtitleColumn?: string;
  };
};
```

**اعتبارسنجی سرور (هر PATCH/POST view):**

1. `schemaVersion === 1`
2. `view_kind_code` با بلوک config (grid → بدون اجبار kanban؛ kanban → `statusColumn` required و ستون روی target وجود دارد)
3. calendar → `startColumn` نوع date/datetime در studio-meta
4. gallery → `titleColumn` + `imageColumn` required
5. `visibleColumns[]` ⊆ ستون‌های published target model
6. sort fields موجود و sortable (v1: همه scalar غیر-json)

پس از **p-127**: فیلد اختیاری `querySurfaceId?: string` — اگر set شد، `filter` در resolve از predefined query می‌آید (مصرف فقط؛ پیاده‌سازی p-127 خارج این فاز).

---

## `GET /api/bs/views/:id/resolve` — الگوریتم

**ورودی:** `viewId` · session user (برای favorites flag)

**خروجی (نمونه):**

```json
{
  "view": { "id", "title", "slug", "view_kind_code", "is_default", "collection_id" },
  "collection": { "id", "title", "edge_object_name", "primary_column" },
  "base": { "id", "title", "slug" },
  "edge": {
    "objectName": "tsk_tasks",
    "labels": {},
    "columns": [ /* merged: meta + visible + display order */ ],
    "associations": [ /* for link cells */ ]
  },
  "runtime": {
    "config": { /* validated config_json */ },
    "listQuery": { "filter", "sort", "search" },
    "primaryColumn": "title",
    "isFavorite": true
  }
}
```

**مراحل:**

1. Load `bs_views` + `bs_collections` + `bs_bases` (reject archived base برای runtime open — 404 یا 403 طبق Record Policy)
2. Load Edge model + studio-meta برای `edge_object_name`
3. `primary_column` = collection override ?? `labels.title` از meta
4. Merge columns: ترتیب `visibleColumns` اگر set؛ else همه non-audit با `defaultVisible` از meta (v1: همه به جز audit group)
5. Attach `formWidget` / inline eligibility per column
6. Build `listQuery` برای کلاینت (فیلتر view + sort؛ کلاینت به `/api/{objectName}` می‌فرستد)

---

## API surface (headless)

همان جدول‌های [p-packages-bases.md §شکل API](./p-packages-bases.md). رفتارهای اضافی اجرایی:

### Bases

<table dir="rtl">
<thead><tr><th>Endpoint</th><th>قواعد</th></tr></thead>
<tbody><tr><td><code dir="ltr" style="unicode-bidi: embed;">PATCH</code></td><td><strong>رد</strong> <code dir="ltr" style="unicode-bidi: embed;">slug</code> · archive فقط <code dir="ltr" style="unicode-bidi: embed;">POST .../archive</code></td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">GET :id</code></td><td>include <code dir="ltr" style="unicode-bidi: embed;">collectionCount</code> (COUNT collections)</td></tr>
</tbody></table>

### Collections

<table dir="rtl">
<thead><tr><th>Endpoint</th><th>قواعد</th></tr></thead>
<tbody><tr><td><code dir="ltr" style="unicode-bidi: embed;">POST</code></td><td><code dir="ltr" style="unicode-bidi: embed;">register-collection</code>: Edge model must exist + published؛ UNIQUE base+objectName</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">PATCH</code></td><td><strong>رد</strong> <code dir="ltr" style="unicode-bidi: embed;">edge_object_name</code> · <strong>رد</strong> <code dir="ltr" style="unicode-bidi: embed;">base_id</code></td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">DELETE</code></td><td>cascade views + favorites؛ <strong>نه</strong> حذف جدول Edge</td></tr>
</tbody></table>

### Views

<table dir="rtl">
<thead><tr><th>Endpoint</th><th>قواعد</th></tr></thead>
<tbody><tr><td><code dir="ltr" style="unicode-bidi: embed;">POST</code></td><td>kind + slug + <code dir="ltr" style="unicode-bidi: embed;">config_json</code> defaults per kind</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">PATCH</code></td><td><strong>رد</strong> <code dir="ltr" style="unicode-bidi: embed;">view_kind_code</code> · <code dir="ltr" style="unicode-bidi: embed;">slug</code> · <code dir="ltr" style="unicode-bidi: embed;">collection_id</code></td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">duplicate</code></td><td>slug <code dir="ltr" style="unicode-bidi: embed;">-copy</code> / <code dir="ltr" style="unicode-bidi: embed;">-copy-2</code> · <code dir="ltr" style="unicode-bidi: embed;">is_default: false</code></td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">set-default</code></td><td>transaction: unset siblings · set one</td></tr>
</tbody></table>

### Favorites

`POST /api/bs/views/:id/favorite` → toggle · user از session

### Record count

`GET /api/bs/collections/:id/record-count` → `SELECT COUNT(*)` via Sequelize روی target model (با Record Policy scope اگر اعمال شد)

---

## Server Functions layout

```
scripts/bases-phase2/
  install-bases-phase2.ts
  basesViewConfigSchema.ts      ← zod/ajv validation v1
  basesResolveView.ts
  basesRegisterCollection.ts
  __tests__/
    basesResolveView.test.ts
    basesViewsDefault.test.ts
    basesArchive.test.ts
```

Mount pattern: همان `cms-phase2` — ثبت routes روی Data API / server function registry (بدون built-in core package).

**ممنوع:** `db.query` · duplicate row storage در `bs_*` · proxy layer دوم روی Edge

---

## تست‌های پذیرش (contract)

<table dir="rtl">
<thead><tr><th>#</th><th>سناریو</th><th>انتظار</th></tr></thead>
<tbody><tr><td>T1</td><td>POST base · PATCH slug → 4xx</td><td>slug immutable</td></tr>
<tr><td>T2</td><td>POST collection با objectName نامعتبر → 4xx</td><td></td></tr>
<tr><td>T3</td><td>POST view kanban بدون statusColumn → 4xx</td><td></td></tr>
<tr><td>T4</td><td>resolve-view grid → columns order = visibleColumns</td><td></td></tr>
<tr><td>T5</td><td>set-default دو بار → یک default</td><td></td></tr>
<tr><td>T6</td><td>duplicate-view → slug جدید · config کپی</td><td></td></tr>
<tr><td>T7</td><td>archive base → GET list default فقط active</td><td></td></tr>
<tr><td>T8</td><td>favorite toggle · دومین POST حذف</td><td></td></tr>
<tr><td>T9</td><td>record-count ≥ واقعیت (insert روی edge demo)</td><td></td></tr>
<tr><td>T10</td><td>gallery config بدون imageColumn → 4xx</td><td></td></tr>
</tbody></table>

`npm run test:critical` + تست‌های ماژول phase2 سبز.

---

## رولبک فاز ۲

- `npm run bases:phase2:rollback` — حذف server functions / route registrations · state.json
- جداول و Base Info فاز ۱ **می‌مانند** تا `bases:phase1:rollback` صریح

---

## پرامپت عامل (فاز ۲)

```
@plans/packages/todo/bases-package/p-bases-phase-2-server-api.md را اجرا کن

فقط بعد از فاز ۱ ✅. Server Functions + validation config_json v1 + resolve-view +
APIهای جدول سند اصلی. تست‌های T1–T10. scripts/bases-phase2/ الگوی cms-phase2.
ممنوع: UI، db.query. خروجی تست را نشان بده.
```

</div>
