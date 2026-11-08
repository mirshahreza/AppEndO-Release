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

<p><strong>خلاصه برای operatore:</strong> این سند جزو <strong>plans</strong> است (p-bases-phase-3b-grid-runtime). ستون وضعیت در <a href="../p-00-packages-index.md">index مربوطه</a> مرجع «شروع شده / design / تمام» است.</p>
<p><strong>راهنمای خواندن:</strong> بخش‌های انگلیسی برای agent/dev هستند؛ جداول وضعیت و یادداشت‌های فارسی را اول بخوانید.</p>


# Bases — زیر‌فاز 3b: Collection، View editor، Grid runtime (مسیر طلایی)

> **Package:** Bases (#117)  
> **زیر‌فاز:** 3b — **golden path** پکیج  
> **وضعیت:** ⬜ design only  
> **آخرین به‌روزرسانی:** ۲۰۲۶-۰۹-۱۷  
> **پیش‌نیاز:** 3a ✅  
> **بعدی:** [p-bases-phase-3c-kanban-gallery.md](./p-bases-phase-3c-kanban-gallery.md)

---

## هدف 3b

اپراتور بتواند: **Base → ثبت Collection روی Edge model → ساخت View Grid → باز کردن runtime → inline edit یک سلول → toast → refresh**.

**دموی پیشنهادی:** `tsk_tasks` (پس از نصب Task package یا هر Edge model published با ستون‌های قابل inline-edit).

الگوی بازار: [Airtable grid + view toolbar](https://www.airtable.com/guides/build/create-custom-views-of-data) — فیلتر/sort روی **همان رکوردها**؛ ما با `resolve` + Data API همان را می‌دهیم بدون snapshot.

---

## مسیرهای جدید

<table dir="rtl">
<thead><tr><th>Route</th><th>نقش</th></tr></thead>
<tbody><tr><td><code dir="ltr" style="unicode-bidi: embed;">bases/{baseId}/collections</code></td><td>catalog cards</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">bases/collections/edit/{id}</code></td><td>ثبت/ویرایش collection</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">bases/views/edit/{id}</code></td><td>ادیتور view (grid kind)</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">bases/open/{viewId}</code></td><td><strong>runtime grid</strong> full-height</td></tr>
</tbody></table>

---

## Collections list (cards)

کارت: `title` · `edge_object_name` (mono) · **view count** · updated.

Toolbar: Register collection · Back to base.

---

## Collection editor

```
┌─ Action bar: Back · Save · Delete (confirm cascade views) ──────────────────────────┐
├─ Main                                      │ Inspector                              │
│  FormSection Target                        │ Base (locked)                          │
│    edge_object_name — picker Edge models  │ edge_object_name locked after create   │
│  FormSection Identity                     │ viewCount · record-count badge         │
│    title · primary_column (optional)      │ Audit                                  │
│    sort_order                             │                                        │
└──────────────────────────────────────────┴────────────────────────────────────────┘
```

**Picker:** فقط models published — `selection-fields` / model picker موجود پلتفرم.

**قفل:** `edge_object_name` بعد از create.

---

## Views list (روی collection editor)

**Presentation:** table (Users grid) — kind · default · slug · `updated_at`.

Footer: `GridPagingFooter` + sort `updated_at` desc.

Actions: New view (dialog) · Open editor · Open runtime.

### Pre-create View dialog

1. Kind = **Grid** (3b فقط grid؛ kanban در 3c)
2. title · slug
3. POST → `bases/views/edit/{id}`

---

## View editor (grid)

```
┌─ Action bar: Back · Save · Open runtime · Duplicate · Set default ──────────────────┐
├─ Main                                      │ Inspector                              │
│  FormSection View — title                  │ Collection + Base locked               │
│  FormSection Config                        │ Kind = Grid (locked)                   │
│    filter builder (v1 ساده)                │ is_default switch                      │
│    sort field + direction                  │ record count · favorites count (0)   │
│  FormSection Columns                       │ Audit                                  │
│    visible column multi-picker از resolve  │                                        │
│  Advanced: config_json JSON editor         │                                        │
└──────────────────────────────────────────┴────────────────────────────────────────┘
```

`config_json` sync با فرم ساده + advanced JSON (یک منبع حقیقت پس از Save).

---

## Runtime grid — `bases/open/{viewId}`

```
┌─ Toolbar: Back · View title · Filter · Search · Add record · History (event log) ───┐
├─ AppTableGrid — inline edit · paging ───────────────────────────────────────────────┤
├─ Footer: sort field + direction (package-ui) ─────────────────────────────────────┤
└───────────────────────────────────────────────────────────────────────────────────┘
```

### داده

1. `GET /api/bs/views/:id/resolve`
2. List: `GET /api/{edgeObjectName}?...` با filter/sort از resolve
3. Inline PATCH تک‌فیلد → toast → refresh region (نه full page)

### Inline edit rules

- فقط ستون‌هایی که studio-meta `formWidget` اجازهٔ inline دارد
- بقیه: row action **Open** → CrudSet/designer edit اگر route ثبت شده
- Record Policy همان Data API

### Add record

POST minimal به Edge model · optional navigate به editor دامنه.

### History

لینک به record event log پلتفرم — **بدون** `bs_comments`.

**مرجع چگالی:** Data Studio dense list · `DesignerRuntimeAppTableGrid` اگر در designer reuse شد.

---

## پذیرش 3b (browser اجباری)

<table dir="rtl">
<thead><tr><th>#</th><th>مسیر</th><th>انتظار</th></tr></thead>
<tbody><tr><td>G1</td><td>create base → register <code dir="ltr" style="unicode-bidi: embed;">tsk_tasks</code></td><td>collection row</td></tr>
<tr><td>G2</td><td>create grid view → open runtime</td><td>ستون‌ها از resolve</td></tr>
<tr><td>G3</td><td>edit one cell inline</td><td>toast · مقدار در refresh</td></tr>
<tr><td>G4</td><td>record-count badge ≠ page length</td><td></td></tr>
<tr><td>G5</td><td>set-default · duplicate view</td><td>API 200</td></tr>
<tr><td>G6</td><td>delete collection</td><td>views cascade · Edge table intact</td></tr>
<tr><td>G7</td><td>contract test صفحات scaffold</td><td></td></tr>
</tbody></table>

**توقف:** تا G3 سبز نشود به 3c نرو.

---

## پرامپت عامل (3b)

```
@plans/packages/todo/bases-package/p-bases-phase-3b-grid-runtime.md را بساز

بعد از 3a ✅. مسیر طلایی grid. الگو: Users footer sort · Idea Foundry rail · Data Studio grid.
Demo: tsk_tasks. Live-verify G1–G3 در مرورگر. --only=3b.
```

</div>
