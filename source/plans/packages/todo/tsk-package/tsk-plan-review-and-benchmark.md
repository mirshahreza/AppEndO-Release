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

<p><strong>خلاصه برای operatore:</strong> مقایسه با بازار/OSS — برای تصمیم scope، نه وضعیت پیاده‌سازی روزانه.</p>


# بازبینی و بنچمارک — Task Management (مرجع سریع)

> تصمیم‌های قطعی در [p-packages-task-management.md](./p-packages-task-management.md) هستند. این فایل برای مرور یک‌صفحه‌ای است؛ اگر با سند اصلی اختلاف دیدی، **سند اصلی** را مبنا بگیر.

## بازبینی ۲۰۲۶-۰۹-۱۵ — چه عوض شد؟

1. **کانبان پلتفرم:** `UiKanbanCard` غنی، `coloredColumns`، `revertSignal`، و تست `vizKanbanCancelRevert` از قبل در کد هستند — ۳c-pre بیشتر «تأیید و wiring» است، نه ساخت BC از صفر.
2. **وایرفریم:** لینک‌های PNG حذف شدند تا تصویر شکسته نماند؛ ASCII و جداول UX معیار چیدمان‌اند تا `assets/wireframes/` اضافه شود.
3. **شکاف‌های اجرایی:** R8–R11 (شکل لیست Kanban، FK، جستجوی key، ثبت nav در platform-registry).
4. **اسکریپت‌ها:** توصیهٔ `scripts/task-management-phase1|2|3` مثل CMS برای نصب/رولبک repeatable.
5. **بک‌لاگ v2:** جدول کوتاه ایده‌های عمداً بعد از v1.
6. **p-70 بازنشسته:** پلن تکراری `plans/core/next/p-70-task-management.md` حذف شد. تفکیک Work Item / Scheduled Task / jobs / feedback و هوک‌های بعد از v1 (Home widget · Ask AppEndO · اعلان) به سند اصلی آمد — نه معماری `core:Tasks`.

## ریسک و ابهام (R1–R11)

<table dir="rtl">
<thead><tr><th>#</th><th>موضوع</th><th>تصمیم نهایی</th></tr></thead>
<tbody><tr><td>R1</td><td>مرتب‌سازی پیش‌فرض</td><td><code dir="ltr" style="unicode-bidi: embed;">updated_at</code> نزولی (Projects catalog · Tasks table)</td></tr>
<tr><td>R2</td><td>Hide completed</td><td>جدول: پیش‌فرض on؛ کانبان: off</td></tr>
<tr><td>R3</td><td>bulk جزئی</td><td><code dir="ltr" style="unicode-bidi: embed;">Promise.allSettled</code> + toast N/M + رفرش گرید</td></tr>
<tr><td>R4</td><td>RBAC</td><td>فقط دسترسی سطح پکیج در v1</td></tr>
<tr><td>R5</td><td>حذف تسک</td><td>نداریم؛ Cancelled</td></tr>
<tr><td>R6</td><td>owner پروژه</td><td>بدون محدودیت نقش در v1</td></tr>
<tr><td>R7</td><td>revert کانبان بعد از Cancel confirm</td><td>تست خودکار — <code dir="ltr" style="unicode-bidi: embed;">vizKanbanCancelRevert.test.tsx</code></td></tr>
<tr><td>R8</td><td>payload Kanban</td><td>لیست تخت؛ ستون‌ها در کلاینت</td></tr>
<tr><td>R9</td><td>FK / حذف</td><td>RESTRICT پروژه/والد؛ CASCADE فرزندان تسک</td></tr>
<tr><td>R10</td><td>search</td><td><code dir="ltr" style="unicode-bidi: embed;">{slug}-{n}</code> یا title</td></tr>
<tr><td>R11</td><td>nav/pages</td><td>platform-registry + <code dir="ltr" style="unicode-bidi: embed;">tskStudioNav.ts</code>؛ بدون zip</td></tr>
</tbody></table>

## بنچمارک (خلاصه)

مرزها در §دردهای کلاسیک و §خارج از اسکوپ سند اصلی است. برای v1 فقط **bulk**، **کارت غنی**، و **overdue** روی UX اثر دارند. کارت غنی در BC مشترک با CRM آماده است؛ Task Management باید فیلدهای دامنه را به `badges` / `avatar` / `meta` / `accent` map کند.

## یادآوری کیفیت UI (از تجربهٔ CRM)

۱. هر زیر‌فاز ۳ = یک صفحه، نه کل UI یک‌جا.  
۲. قبل از scaffold، بخش‌های BC را در `/studio/base-components` باز کن و در پاسخ نام ببر.  
۳. صفحهٔ طلایی = کپی از مرجع (Users · CMS catalog · modeler rail)، نه redesign.  
۴. قبل از «تمام شد»، خودت را به T1–T12 و چک‌لیست `package-ui` مقید کن.

</div>
