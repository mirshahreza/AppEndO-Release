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

<p><strong>خلاصه برای operatore:</strong> این سند جزو <strong>plans</strong> است (p-129-operator-direct-message-compose). ستون وضعیت در <a href="./p-00-next-index.md">index مربوطه</a> مرجع «شروع شده / design / تمام» است.</p>
<p><strong>راهنمای خواندن:</strong> بخش‌های انگلیسی برای agent/dev هستند؛ جداول وضعیت و یادداشت‌های فارسی را اول بخوانید.</p>


# p-129 — Operator direct message compose (ارسال پیام به کاربر)

> **فاز:** MSGI-F · **موکول** (next)  
> **وضعیت:** ⬜ — فقط ثبت نیاز محصول · **deferred ۲۰۲۶-۱۰-۳۱**  
> **ورود:** `@plans/core/next/p-129-operator-direct-message-compose.md`  
> **وابستگی:** MSGI v1 ✅ ([`docs/standards/user-message-inbox.md`](../../../docs/standards/user-message-inbox.md)) · unified inbox ✅ (`my-inbox`) · [`dispatchNotification`](../../../src/server/services/notifications/notificationDispatch.ts)

---

## نیاز (اپراتور — ۲۰۲۶-۱۰-۳۱)

در استودیو **جایی برای ارسال پیام به هر کاربر دلخواه** وجود ندارد. صندوق ورودی و **سجل الإرسال** فقط **دریافت / تاریخچهٔ dispatch به خود کاربر** را پوشش می‌دهند؛ composer UI و API نوشتن دستی پیام به گیرندهٔ دیگر **پیاده نشده**.

---

## وضعیت فعلی (کد)

<table dir="rtl">
<thead><tr><th>موجود</th><th>نیست</th></tr></thead>
<tbody><tr><td><code dir="ltr" style="unicode-bidi: embed;">GET /api/user-message-dispatches</code> (گیرنده = خود کاربر)</td><td><code dir="ltr" style="unicode-bidi: embed;">POST</code> ارسال دستی به userId دلخواه</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">dispatchNotification</code> از workflow / escalation / …</td><td>دکمه/دیالوگ «ارسال پیام» در UI</td></tr>
<tr><td>فیلتر <code dir="ltr" style="unicode-bidi: embed;">kind=message_dispatch</code> روی <code dir="ltr" style="unicode-bidi: embed;">my-inbox</code></td><td>picker گیرنده + عنوان + متن در استودیو</td></tr>
</tbody></table>

---

## رابطه با p-63

<table dir="rtl">
<thead><tr><th></th><th><strong>p-129 (این سند)</strong></th><th><strong>p-63 Internal Chat</strong></th></tr></thead>
<tbody><tr><td>هدف</td><td>ارسال <strong>یک‌طرفه / broadcast</strong> توسط اپرator (یا نقش مجاز) به یک user</td><td><strong>گفتگو</strong> DM/کانال، تاریخچه دوطرفه، unread</td></tr>
<tr><td>عمق</td><td>MVP کوچک روی MSGI موجود</td><td>محصول چت کامل (۵–۸ هفته)</td></tr>
<tr><td>مسیر پیشنهادی</td><td>اگر فقط «به فلانی notify کن» کافی است → p-129 اول</td><td>اگر «چت همکاران» لازم است → p-63؛ p-129 می‌توان پیش‌درآمد باشد</td></tr>
</tbody></table>

---

## پیشنهاد MVP (وقتی شروع شد)

1. **API:** `POST /api/user-message-dispatches/send` (یا `/api/notifications/send`) — body: `userId`, `title`, `body`, `channels?: ('IN_APP'|'EMAIL')[]`, `href?`.
2. **سرور:** فقط نقش مجاز (پیش‌فرض پیشنهادی: **ADMIN**) · فراخوانی **`dispatchNotification`** · `eventType` ثابت greenfield (مثلاً `operator.direct`).
3. **UI:** دکمه **Send message** در toolbar **`my-inbox`** و/یا **Users** · `CreateEditModalShell` · user picker · `UiTextarea` · Base Components.
4. **Culture:** EN production keys · IQ/IR/US در bundleها.
5. **تست:** route auth · یک dispatch E2E · ledger + in-app row برای گیرنده.

---

## تصمیم‌های باز (قبل از کد)

- [ ] چه کسانی مجاز به ارسال؟ (ADMIN فقط · DEVELOPER · …)
- [ ] محل دکمه: inbox · Users · هر دو
- [ ] کانال‌ها: فقط IN_APP · EMAIL هم · digest؟
- [ ] آیا گیرنده در **سجل إرسال فرستنده** هم ردیف می‌بیند یا فقط inbox گیرنده؟

---

## ارجاع

- Inbox یکپارچه: [`specs/unified-personal-inbox/`](../../../specs/unified-personal-inbox/)
- MSGI decisions: [`specs/user-message-inbox/02-decisions.md`](../../../specs/user-message-inbox/02-decisions.md)
- چت داخلی (بعداً): [`p-63-internal-chat-system.md`](p-63-internal-chat-system.md)

---

*Control — AppEndO · parked for later implementation*


</div>
