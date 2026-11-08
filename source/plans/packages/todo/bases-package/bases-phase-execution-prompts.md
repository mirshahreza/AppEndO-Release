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

<p><strong>خلاصه برای operatore:</strong> دستور copy-paste برای <strong>agent</strong> تا فازهای npm را اجرا کند — شما معمولاً فقط دستور و «done criteria» را می‌بینید.</p>


# Bases — پرامپت‌های آماده‌اجرا

> **سند مرجع:** [p-packages-bases.md](./p-packages-bases.md)  
> **فازها:** [README.md](./README.md)

بعد از هر فاز، عامل باید گزارش دهد: پیش‌نیاز سبز · فایل‌های touched · پذیرش (A/U/G/K/C) · `test:critical`.

---

## فاز ۱

```
@plans/packages/todo/bases-package/p-bases-phase-1-database-and-meta.md را اجرا کن

فقط فاز ۱. scripts/bases-phase1/ idempotent (الگو cms-phase1). چهار جدول bs_* +
associations + Base Info روت Bases + studio-meta کامل §۸ سند اصلی.
ممنوع: API، UI، nav، bootstrap، db.query، package zip.
پذیرش A1–A7.
```

```bash
npm run bases:phase1
npm run bases:phase1:rollback   # در صورت نیاز
```

---

## فاز ۲

```
@plans/packages/todo/bases-package/p-bases-phase-2-server-api.md را اجرا کن

فقط بعد از فاز ۱ ✅. config_json v1 validation · resolve-view · API کامل §شکل API.
تست T1–T10. scripts/bases-phase2/. ممنوع: UI، db.query.
```

```bash
npm run bases:phase2
```

---

## زیر‌فاز 3a

```
@plans/packages/todo/bases-package/p-bases-phase-3a-nav-and-bases.md را اجرا کن

بعد از فاز ۲ ✅. package-ui.md + /studio/base-components قبل از scaffold.
basesStudioNav · bases list cards · base editor rail. --only=3a.
ممنوع: collection/view/runtime. پذیرش U1–U7.
```

---

## زیر‌فاز 3b (طلایی)

```
@plans/packages/todo/bases-package/p-bases-phase-3b-grid-runtime.md را اجرا کن

بعد از 3a ✅. collection register · view editor grid · bases/open inline edit.
Demo tsk_tasks. مرورگر: G1–G3 اجباری. توقف قبل از 3c.
```

---

## زیر‌فاز 3c

```
@plans/packages/todo/bases-package/p-bases-phase-3c-kanban-gallery.md را اجرا کن

بعد از 3b ✅ و grid live-verify. UiKanbanBoard + gallery catalog. K1–K6.
```

---

## زیر‌فاز 3d

```
@plans/packages/todo/bases-package/p-bases-phase-3d-calendar-favorites.md را اجرا کن

بعد از 3c ✅. Calendar month + favorites + pinned views. Live-verify کامل فاز ۳. C1–C7.
```

---

## رولبک

```
@plans/packages/todo/bases-package/p-packages-bases.md فاز N را رولبک کن
@plans/packages/todo/bases-package/p-packages-bases.md از فاز N به بعد را رولبک کن
```

ترتیب رولبک: UI (3d→3a) قبل از API (۲) قبل از DDL (۱) — لایهٔ وابسته‌تر اول.

</div>
