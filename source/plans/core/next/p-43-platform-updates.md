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

<p><strong>خلاصه برای operatore:</strong> این سند جزو <strong>plans</strong> است (p-43-platform-updates). ستون وضعیت در <a href="./p-00-next-index.md">index مربوطه</a> مرجع «شروع شده / design / تمام» است.</p>
<p><strong>راهنمای خواندن:</strong> بخش‌های انگلیسی برای agent/dev هستند؛ جداول وضعیت و یادداشت‌های فارسی را اول بخوانید.</p>


# p-43 — Platform Updates

> **فاز:** M7 · **موکول** (next)  
> **اولویت:** — — سایدافکت lifecycle/rollback · v1 تک‌نود ممکن  
> **وضعیت:** ⬜ — کنترل: [p-00-next-index.md](p-00-next-index.md) (موکول)  
> **شماره آرشیو:** p-21 · p-next-21 · p-24  
> **وابستگی:** p-08 ✅ · p-11 ✅ · p-07 ✅ · [multi-node deployment](../../docs/architecture/multi-node-deployment.md) ✅ (manual rolling)

---

## هدف

به‌روزرسانی امن اپ و artifactها: app update · plugin/theme update · rollback · enforce `requiredAppVersion`.

---

## پیش‌نیازها

- [multi-node deployment](../../docs/architecture/multi-node-deployment.md) ✅: multi-node ops و readiness — rolling خودکار اختیاری v1
- p-08/p-11/p-07: install lifecycle
- manifest `requiredAppVersion` · `version` semver

---

## محدوده

### Scope IN

<table dir="rtl">
<thead><tr><th>حوزه</th><th>کار</th></tr></thead>
<tbody><tr><td>App update</td><td>package/version check · guided upgrade</td></tr>
<tr><td>Plugin update</td><td>ZIP جدید · uninstall نسخه قدیم یا in-place upgrade path</td></tr>
<tr><td>Theme update</td><td>همان الگو</td></tr>
<tr><td>Rollback</td><td>بازگشت به نسخه قبلی artifact</td></tr>
<tr><td>Version gate</td><td>reject install اگر <code dir="ltr" style="unicode-bidi: embed;">requiredAppVersion</code> ناسازگار</td></tr>
<tr><td>Dependency</td><td><code dir="ltr" style="unicode-bidi: embed;">dependencies[]</code> در plugin manifest</td></tr>
</tbody></table>

### Scope OUT

- auto-update بدون admin confirm
- Marketplace auto-pull (→ [p-42](../next/p-42-marketplace.md))

---

## Update flow (plugin)

```
check installed version vs uploaded
  → preflight conflicts + requiredAppVersion
  → backup state (installed manifest)
  → uninstall old OR upgrade path
  → install new
  → smoke
  → on failure: rollback from backup
```

---

## App rolling (multi-node)

- sequential node drain (مستند در [multi-node deployment](../../docs/architecture/multi-node-deployment.md) · خودکار در p-43)
- health check بین waves

---

## معیار خروج

- [ ] plugin update با rollback
- [ ] theme update
- [ ] `requiredAppVersion` block
- [ ] app version bump documented
- [ ] (optional) rolling update دو نود

---

## تخمین

۴–۶ هفته

---

*سند پیاده‌سازی — Platform updates · M7 · p-43*


</div>
