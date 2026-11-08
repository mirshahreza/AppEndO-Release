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

<p><strong>خلاصه برای operatore:</strong> این سند جزو <strong>plans</strong> است (p-42-marketplace). ستون وضعیت در <a href="./p-00-next-index.md">index مربوطه</a> مرجع «شروع شده / design / تمام» است.</p>
<p><strong>راهنمای خواندن:</strong> بخش‌های انگلیسی برای agent/dev هستند؛ جداول وضعیت و یادداشت‌های فارسی را اول بخوانید.</p>


# p-42 — Marketplace

> **فاز:** M8 · **موکول** (next)  
> **اولویت:** — — لایه توزیع additive · reuse install محلی · بدون تغییر هسته  
> **وضعیت:** ⬜ — کنترل: [p-00-next-index.md](p-00-next-index.md) (موکول)  
> **شماره آرشیو:** p-15 · p-next-15 · p-22  
> **وابستگی:** p-08 ✅ · p-11 ✅ · p-07 ✅

---

## هدف

کاتالوگ مرکزی artifactها (plugin · theme): browse، install از remote یا offline ZIP، signing، و سیاست نسخه.

---

## پیش‌نیازها

- p-08: extension runtime پایدار
- p-11: vertical-app install
- p-07: theme runtime
- contract manifest + integrity hash

---

## محدوده

### Scope IN

<table dir="rtl">
<thead><tr><th>قابلیت</th><th>شرح</th></tr></thead>
<tbody><tr><td>Catalog</td><td>لیست plugin/theme با metadata</td></tr>
<tr><td>Remote install</td><td>download ZIP · validate · همان lifecycle محلی</td></tr>
<tr><td>Offline ZIP</td><td>upload از فایل (موجود — گسترش UX)</td></tr>
<tr><td>Signing</td><td>verify publisher signature (optional v1)</td></tr>
<tr><td>Version policy</td><td><code dir="ltr" style="unicode-bidi: embed;">requiredAppVersion</code> enforce</td></tr>
<tr><td>Admin UI</td><td>browse · install · update notice</td></tr>
</tbody></table>

### Scope OUT

- payment/billing
- public anonymous catalog (v1: authenticated admin)

---

## Install flow (remote)

```
browse catalog → select artifact → download → integrity check
  → existing packageLifecycle / verticalAppInstall / theme install
```

---

## امنیت

- HTTPS only برای remote URL
- hash mismatch → reject
- SSRF guard روی catalog URL config (اگر proxy)
- signing optional: trusted keys در settings

---

## معیار خروج

- [ ] catalog با حداقل reference artifacts از p-14
- [ ] remote install end-to-end
- [ ] offline ZIP همچنان کار کند
- [ ] `requiredAppVersion` block install ناسازگار
- [ ] uninstall/update بدون orphan

---

## تخمین

۸–۱۰ هفته

---

*سند پیاده‌سازی — Marketplace · M8 · p-42*


</div>
