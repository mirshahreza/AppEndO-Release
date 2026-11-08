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

<p><strong>خلاصه برای operatore:</strong> هر سند در <code dir="ltr">plans/</code> باید برای شما <strong>قابل skim</strong> باشد: RTL، جدول HTML، و بالای فایل «خلاصه برای operatore». شکاف legacy هویتی: استاندارد تخصصی‌تر در <a href="packages/todo/hawiety-package/hwy-operator-parity-doc-standard.md">hwy-operator-parity-doc-standard</a>.</p>

# استاندارد اسناد plans برای operatore

> **مخاطب:** agent و operatore · **دامنه:** همهٔ `plans/**/*.md`  
> **الگوی gap/parity هویتی:** [hwy-legacy-vs-appendo-feature-parity.md](packages/todo/hawiety-package/hwy-legacy-vs-appendo-feature-parity.md)

## قالب فنی (همهٔ فایل‌ها)

<table dir="rtl">
<thead><tr><th>قاعده</th><th>توضیح</th></tr></thead>
<tbody>
<tr><td>Wrapper</td><td><code dir="ltr">&lt;div dir="rtl" lang="fa" class="hwy-parity-doc"&gt;</code> + بلوک <code dir="ltr">&lt;style&gt;</code> (مثل parity)</td></tr>
<tr><td>جداول</td><td>فقط <code dir="ltr">&lt;table dir="rtl"&gt;</code> — نه pipe Markdown (Cursor LTR می‌کند)</td></tr>
<tr><td>کد و مسیر</td><td><code dir="ltr">dir="ltr"</code> روی <code dir="ltr">code</code> / بلوک‌های pre</td></tr>
<tr><td>Intro</td><td>بلافاصله بعد از style: <strong>خلاصه برای operatore</strong> + <strong>راهنمای خواندن</strong></td></tr>
</tbody></table>

## محتوا

<table dir="rtl">
<thead><tr><th>نوع سند</th><th>operatore چه می‌خواند</th></tr></thead>
<tbody>
<tr><td><code dir="ltr">p-00-*-index.md</code></td><td>وضعیت ریلیز · جدول پیشرفت · لینk فعال</td></tr>
<tr><td>پلن feature (p-12x …)</td><td>یادداشت وضعیت در index · بدنه ممکن است انگلیسی برای agent باشد</td></tr>
<tr><td>پکیج (design / phase)</td><td>README پوشه + packages index</td></tr>
<tr><td>parity / gap هویتی</td><td>§۰ فقط شکاف واقعی — [استاندارد هویتی](packages/todo/hawiety-package/hwy-operator-parity-doc-standard.md)</td></tr>
</tbody></table>

## ابزار

```bash
node scripts/plans/normalize-plan-docs-rtl.mjs
node scripts/plans/normalize-plan-docs-rtl.mjs --intros
```

اسکریپت قدیمی هویتی: `node scripts/hawiety-pack/normalize-hawiety-plan-docs-rtl.mjs` (همان منطق، فقط یک پوشه).

## برای agent

- سند جدید در `plans/`: از ابتدا همین قالب.
- به‌روزرسانی index بعد از تغییر وضعیت پلن.
- فارسی روان برای operatore؛ انگلیسی در بدنهٔ execution prompt مجاز است.

</div>
