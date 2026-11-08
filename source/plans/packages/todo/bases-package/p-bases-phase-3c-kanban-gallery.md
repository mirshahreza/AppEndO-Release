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

<p><strong>خلاصه برای operatore:</strong> این سند جزو <strong>plans</strong> است (p-bases-phase-3c-kanban-gallery). ستون وضعیت در <a href="../p-00-packages-index.md">index مربوطه</a> مرجع «شروع شده / design / تمام» است.</p>
<p><strong>راهنمای خواندن:</strong> بخش‌های انگلیسی برای agent/dev هستند؛ جداول وضعیت و یادداشت‌های فارسی را اول بخوانید.</p>


# Bases — زیر‌فاز 3c: Kanban + Gallery runtime

> **Package:** Bases (#117)  
> **زیر‌فاز:** 3c  
> **وضعیت:** ⬜ design only  
> **آخرین به‌روزرسانی:** ۲۰۲۶-۰۹-۱۷  
> **پیش‌نیاز:** 3b ✅ (grid golden path)  
> **بعدی:** [p-bases-phase-3d-calendar-favorites.md](./p-bases-phase-3d-calendar-favorites.md)

---

## هدف 3c

دو **view kind** دیگر روی همان collection: **Kanban** (drag status روی ستون `*_code` واقعی) و **Gallery** (cards با title + image). همان `bases/open/{viewId}` با branch روی `view_kind_code`.

### بنچمارک

<table dir="rtl">
<thead><tr><th>محصول</th><th>Kanban</th><th>Gallery</th></tr></thead>
<tbody><tr><td>Airtable</td><td>stack روی single-select</td><td>تصویر attachment</td></tr>
<tr><td>NocoDB</td><td>همان رکوردها، view جدا</td><td>Gallery view مستقل</td></tr>
<tr><td>Bases v1</td><td><code dir="ltr" style="unicode-bidi: embed;">UiKanbanBoard</code> · PATCH status</td><td><code dir="ltr" style="unicode-bidi: embed;">imageColumn</code> اجباری</td></tr>
</tbody></table>

**خارج v1:** Gantt · Timeline · Map · فرم builder داخل view.

---

## پیش‌نیاز پلتفرم

- `UiKanbanBoard` + BC section `kanban` (الگوی `tsk` 3c-pre اگر تست‌ها قرمز بودند — fix پلتفرمی قبل از Bases)
- Designer `viz.kanban` — فقط اگر runtime از همان primitive استفاده کند

---

## View editor — kind-specific (create dialog)

<table dir="rtl">
<thead><tr><th>Kind</th><th>فیلدهای Config (main)</th><th>validation</th></tr></thead>
<tbody><tr><td>Kanban</td><td><code dir="ltr" style="unicode-bidi: embed;">statusColumn</code> picker (فقط LOV/status columns) · optional <code dir="ltr" style="unicode-bidi: embed;">titleColumn</code></td><td>statusColumn required</td></tr>
<tr><td>Gallery</td><td><code dir="ltr" style="unicode-bidi: embed;">titleColumn</code> · <code dir="ltr" style="unicode-bidi: embed;">imageColumn</code> · optional <code dir="ltr" style="unicode-bidi: embed;">subtitleColumn</code></td><td>image required</td></tr>
</tbody></table>

`view_kind_code` **قفل** بعد از create — تغییر kind = delete + create.

---

## Runtime Kanban

**الگو:** `tsk` Tasks board · `UiKanbanBoard`.

```
┌─ Toolbar: Back · title · Filter · Search · History ─────────────────────────────────┐
├─ UiKanbanBoard full height ────────────────────────────────────────────────────────┤
│  columns = distinct values of statusColumn (from Base Info order if available)      │
│  drag card → PATCH statusColumn on record                                           │
└───────────────────────────────────────────────────────────────────────────────────┘
```

### داده

- v1: **لیست تخت** `GET /api/{objectName}` با filter view (مثل tsk R8) · bucket در کلاینت
- Drag: PATCH تک‌فیلد `statusColumn` · toast · revert on 4xx (الگوی `vizKanbanCancelRevert`)

### کارت

- Title از `titleColumn` یا `primary_column`
- فیلدهای ثانویه از studio-meta (حداکثر ۲ خط — v1)

**ممنوع:** ستون Kanban مصنوعی جدا از مدل CRM/Task

---

## Runtime Gallery

**الگو:** CMS catalog cards · `cardVariant="catalog"`.

```
┌─ Toolbar: Back · title · Search · Filter ───────────────────────────────────────────┐
├─ catalog card grid — image · title · subtitle ──────────────────────────────────────┤
└─ paging footer اگر لیست بزرگ ─────────────────────────────────────────────────────┘
```

- `imageColumn`: file FK → thumbnail URL از File Manager contract · یا url column
- اگر `imageColumn` null در config → **block** با پیام انگلیسی راهنما (نه grid خالی)

Click card → **Open** record (CrudSet / designer) — v1 read-only gallery **نیست**؛ کارت lead به editor.

---

## پذیرش 3c

<table dir="rtl">
<thead><tr><th>#</th><th>سناریو</th></tr></thead>
<tbody><tr><td>K1</td><td>Kanban view روی <code dir="ltr" style="unicode-bidi: embed;">tsk_tasks</code> + <code dir="ltr" style="unicode-bidi: embed;">status_code</code> — drag بین ستون‌ها</td></tr>
<tr><td>K2</td><td>PATCH ناموفق → revert UI</td></tr>
<tr><td>K3</td><td>Gallery با <code dir="ltr" style="unicode-bidi: embed;">cover</code>/<code dir="ltr" style="unicode-bidi: embed;">image</code> FK — کارت با تصویر</td></tr>
<tr><td>K4</td><td>Gallery بدون imageColumn در config → editor block در save</td></tr>
<tr><td>K5</td><td>همان رکورد در grid و kanban بعد از refresh یکسان</td></tr>
<tr><td>K6</td><td><code dir="ltr" style="unicode-bidi: embed;">npm run test:critical</code></td></tr>
</tbody></table>

---

## پرامپت عامل (3c)

```
@plans/packages/todo/bases-package/p-bases-phase-3c-kanban-gallery.md را بساز

بعد از 3b ✅ و grid live-verify. Kanban = UiKanbanBoard. Gallery = catalog cards.
--only=3c. پذیرش K1–K6.
```

</div>
