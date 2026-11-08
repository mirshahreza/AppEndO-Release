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

<p><strong>خلاصه برای operatore:</strong> این سند جزو <strong>plans</strong> است (p-bases-phase-3d-calendar-favorites). ستون وضعیت در <a href="../p-00-packages-index.md">index مربوطه</a> مرجع «شروع شده / design / تمام» است.</p>
<p><strong>راهنمای خواندن:</strong> بخش‌های انگلیسی برای agent/dev هستند؛ جداول وضعیت و یادداشت‌های فارسی را اول بخوانید.</p>


# Bases — زیر‌فاز 3d: Calendar runtime + favorites

> **Package:** Bases (#117)  
> **زیر‌فاز:** 3d (بستن v1 UI)  
> **وضعیت:** ⬜ design only  
> **آخرین به‌روزرسانی:** ۲۰۲۶-۰۹-۱۷  
> **پیش‌نیاز:** 3c ✅  
> **مرجع:** [p-packages-bases.md](./p-packages-bases.md)

---

## هدف 3d

**Calendar view** روی ستون date/datetime موجود (نه package Calendar) · **ستارهٔ favorite** per-user روی view · ورود سریع از Base home به viewهای پین‌شده.

---

## Calendar view

### Config (editor)

<table dir="rtl">
<thead><tr><th>فیلد</th><th>نقش</th></tr></thead>
<tbody><tr><td><code dir="ltr" style="unicode-bidi: embed;">startColumn</code></td><td>required — date یا datetime</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">endColumn</code></td><td>optional — برای بازه</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">titleColumn</code></td><td>optional — label رویداد</td></tr>
</tbody></table>

اعتبارسنجی: نوع ستون از studio-meta — **رد** ساخت فیلد event مجازی.

### Runtime layout

**الگو:** Calendar month shell (Core) + side list — نه resource timeline (خارج v1).

```
┌─ Toolbar: Back · title · Today · prev/next month · Filter ──────────────────────────┐
├─ Month grid (events from list query) │ Side panel: selected day records (dense list) ┤
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### داده

1. resolve-view → `calendar` block
2. Fetch records: filter view + **عرض بازهٔ ماه** روی `startColumn` (server-side filter در query string Data API)
3. کلیک روز → side panel لیست همان روز
4. کلیک رکورد → Open editor

**ممنوع:** duplicate رکورد calendar table · sync دوطرفه با Google Calendar

---

## Favorites

### API

`POST /api/bs/views/:id/favorite` — toggle (فاز ۲).

### UI surfaces

<table dir="rtl">
<thead><tr><th>محل</th><th>رفتار</th></tr></thead>
<tbody><tr><td>View editor rail</td><td>badge <code dir="ltr" style="unicode-bidi: embed;">favoritesCount</code> · star در action bar runtime</td></tr>
<tr><td>Runtime toolbar</td><td>star toggle · toast</td></tr>
<tr><td>Base editor / Base list</td><td>بخش «Pinned views» — لیست viewهای favorite کاربر جاری برای این base</td></tr>
</tbody></table>

### مدل

`bs_view_favorites` — composite PK · cascade on view delete.

**نه:** personal view duplicate · permission type NocoDB (locked/collaborative) — v2.

---

## Base home — pinned views (UX v1)

روی `bases/edit/{id}` یا کارت Base در list:

- اگر user ≥1 favorite در views متعلق به collections این base → لینک مستقیم `bases/open/{viewId}`
- ترتیب: `created_at` favorite desc

---

## پذیرش 3d + بستن پکیج v1

<table dir="rtl">
<thead><tr><th>#</th><th>معیار</th></tr></thead>
<tbody><tr><td>C1</td><td>Calendar view روی مدل با <code dir="ltr" style="unicode-bidi: embed;">due_at</code> / date column — events در ماه</td></tr>
<tr><td>C2</td><td>Side panel روز با paging اگر &gt; N</td></tr>
<tr><td>C3</td><td>Star toggle — refresh <code dir="ltr" style="unicode-bidi: embed;">isFavorite</code> در resolve</td></tr>
<tr><td>C4</td><td>Pinned section روی base با ۲ view</td></tr>
<tr><td>C5</td><td>Live-verify کامل: bases list → base → collection → grid + kanban + gallery + calendar</td></tr>
<tr><td>C6</td><td><code dir="ltr" style="unicode-bidi: embed;">package-ui.md</code> checklist generalized + screenshot مسیر open grid</td></tr>
<tr><td>C7</td><td>Workbooks <strong>در nav Bases نیست</strong></td></tr>
</tbody></table>

### Live-verify نهایی (کل فاز ۳)

```
bases · bases/edit/{id} · bases/{id}/collections · bases/open/{gridViewId}
bases/open/{kanbanViewId} · bases/open/{galleryViewId} · bases/open/{calendarViewId}
```

همهٔ `GET/POST/PATCH` مرتبط 200 یا 4xx عمدی (lock).

---

## رولبک 3d

`--only=3d` یا rollback کامل phase3 — calendar component wiring در drafts حذف؛ favorites API در فاز ۲ می‌ماند.

---

## پرامپت عامل (3d)

```
@plans/packages/todo/bases-package/p-bases-phase-3d-calendar-favorites.md را بساز

بعد از 3c ✅. Calendar month + favorites + pinned on base. --only=3d.
Live-verify نهایی فاز ۳. پذیرش C1–C7.
```

</div>
