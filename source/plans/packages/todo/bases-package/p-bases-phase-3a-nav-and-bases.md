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

<p><strong>خلاصه برای operatore:</strong> این سند جزو <strong>plans</strong> است (p-bases-phase-3a-nav-and-bases). ستون وضعیت در <a href="../p-00-packages-index.md">index مربوطه</a> مرجع «شروع شده / design / تمام» است.</p>
<p><strong>راهنمای خواندن:</strong> بخش‌های انگلیسی برای agent/dev هستند؛ جداول وضعیت و یادداشت‌های فارسی را اول بخوانید.</p>


# Bases — زیر‌فاز 3a: Nav، کاتالوگ Base، ادیتور Base

> **Package:** Bases (#117)  
> **زیر‌فاز:** 3a (اول UI)  
> **وضعیت:** ⬜ design only  
> **آخرین به‌روزرسانی:** ۲۰۲۶-۰۹-۱۷  
> **پیش‌نیاز:** فاز ۲ ✅  
> **بعدی:** [p-bases-phase-3b-grid-runtime.md](./p-bases-phase-3b-grid-runtime.md)  
> **مرجع UX:** [p-packages-bases.md §UX ادمین](./p-packages-bases.md) · [package-ui.md](../../../../docs/standards/package-ui.md) · [ui-inspector-rail.md](../../../../docs/standards/ui-inspector-rail.md)

---

## هدف 3a

گروه ناوبری **`Bases`** · صفحهٔ **کاتالوگ Baseها** (cards) · **ادیتور Base** (main سفید + inspector rail) · مسیر **`bases/settings`** خالی (enum بسته) · culture keys · HTTP smoke.

**عمداً خارج 3a:** Collection register · View editor · runtime grid (3b+).

---

## Scaffold

```
scripts/bases-phase3/
  install-bases-phase3.ts          ← sub-phase flags: --only=3a
  basesStudioNav.ts              ← الگو: cmsStudioNav.ts
  basesPagesScaffold.ts
  basesDesignerScaffold.ts
  basesBaseInfoLovs.ts           ← فقط اگر patch رنگ/HTML لازم شد
```

**npm (پیشنهادی):**

```json
"bases:phase3": "tsx scripts/bases-phase3/install-bases-phase3.ts",
"bases:phase3:rollback": "tsx scripts/bases-phase3/install-bases-phase3.ts --rollback",
"bases:phase3:3a": "tsx scripts/bases-phase3/install-bases-phase3.ts --only=3a"
```

---

## مسیرها و culture

<table dir="rtl">
<thead><tr><th>Route</th><th>pageKey / نقش</th></tr></thead>
<tbody><tr><td><code dir="ltr" style="unicode-bidi: embed;">bases</code></td><td>لیست Base — catalog cards</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">bases/edit/{id}</code></td><td>ادیتور + create از dialog</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">bases/settings</code></td><td>shell خالی یا «No package settings» (بدون vocab page)</td></tr>
</tbody></table>

Culture (حداقل):

- `nav.group.bases`
- `nav.bases`
- `nav.bases-settings` (اگر لینک sidebar)

`publishedFormAssist: false` روی همهٔ صفحات Bases.

---

## صفحه: Bases list (catalog cards)

**الگوی مرجع:** CMS Libraries cards · `DevelopmentCatalogCardGrid` / `presentation="cards"` `cardVariant="catalog"`.

<table dir="rtl">
<thead><tr><th>عنصر</th><th>Base Components</th></tr></thead>
<tbody><tr><td>Toolbar</td><td><code dir="ltr" style="unicode-bidi: embed;">toolbar</code> — New Base · Refresh</td></tr>
<tr><td>Body</td><td><code dir="ltr" style="unicode-bidi: embed;">grid</code> catalog — title · status badge · <strong>collection count</strong> (API)</td></tr>
<tr><td>Archive</td><td><code dir="ltr" style="unicode-bidi: embed;">confirm</code> — action به <code dir="ltr" style="unicode-bidi: embed;">POST .../archive</code></td></tr>
</tbody></table>

**فیلتر پیش‌فرض:** فقط `status_code=active` (Archived از action).

**مرتب‌سازی:** `updated_at` desc — اگر paging: footer sort طبق package-ui.

### Create flow

1. Dialog: `title` · `slug` (create only) · optional `icon`
2. POST → navigate `bases/edit/{id}`
3. Toast + refresh list

---

## صفحه: Base editor (inspector rail)

**الگو:** Idea Foundry rail ([ui-inspector-rail.md](../../../../docs/standards/ui-inspector-rail.md)).

```
┌─ Action bar: Back · title · Save · Archive (if active) ─────────────────────────────┐
├─ Main (white)                              │ Inspector (~370px)                    │
│  FormSection Identity                      │ Status chip (Base Status)             │
│    title · icon                            │ Slug (locked after create)            │
│  FormSection Documentation                 │ collectionCount badge → modal list    │
│    note (textarea)                         │ Audit KV                              │
└──────────────────────────────────────────┴───────────────────────────────────────┘
```

<table dir="rtl">
<thead><tr><th>فیلد</th><th>محل</th><th>قفل</th></tr></thead>
<tbody><tr><td>slug</td><td>rail</td><td>بعد از create</td></tr>
<tr><td>status_code</td><td>rail chip</td><td>archive action نه picker آزاد</td></tr>
<tr><td>title, icon, note</td><td>main</td><td>editable</td></tr>
</tbody></table>

**Related:** دکمه «Collections» → `bases/{baseId}/collections` (در 3a می‌تواند placeholder «0 collections» تا 3b wire شود).

---

## نگاشت BC (اجباری قبل از کد)

عامل باید در PR نام ببرد: `toolbar` · `text-fields` · `choice-fields` · `toast` · `confirm` · `grid` (catalog).

**ممنوع:** raw `<input>` · Auto-CRUD designer · duplicate Base Info edit modal

---

## پذیرش 3a

<table dir="rtl">
<thead><tr><th>#</th><th>معیار</th></tr></thead>
<tbody><tr><td>U1</td><td>Sidebar گروه <strong>Bases</strong> جدا از Records/Development</td></tr>
<tr><td>U2</td><td><code dir="ltr" style="unicode-bidi: embed;">GET /api/bs/bases</code> از UI → 200</td></tr>
<tr><td>U3</td><td>Create base → edit rail slug locked</td></tr>
<tr><td>U4</td><td>Archive → کارت از لیست پیش‌فرض حذف</td></tr>
<tr><td>U5</td><td>Base Info enum — <strong>بدون</strong> صفحه vocab برای Status/View Kind</td></tr>
<tr><td>U6</td><td><code dir="ltr" style="unicode-bidi: embed;">npm run test:critical</code> سبز</td></tr>
<tr><td>U7</td><td>Rollback <code dir="ltr" style="unicode-bidi: embed;">--only=3a</code> nav/pages را برمی‌دارد؛ API فاز ۲ می‌ماند</td></tr>
</tbody></table>

---

## پرامپت عامل (3a)

```
@plans/packages/todo/bases-package/p-bases-phase-3a-nav-and-bases.md را بساز

فقط بعد از فاز ۲ ✅. قبل از کد: package-ui.md + /studio/base-components (بخش‌های نام‌برده).
scripts/bases-phase3/ --only=3a. ممنوع: Collection/View/runtime. پذیرش U1–U7.
```

</div>
