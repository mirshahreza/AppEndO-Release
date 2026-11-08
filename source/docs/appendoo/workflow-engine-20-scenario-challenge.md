# راهنمای فنی: ۲۰ سناریوی تست موتور Workflow (AppEndWorkflowEngine)

> **نوع سند:** راهنمای فنی/چالش تیمی — قابل تحویل مستقیم به تیم مهندسی
> **وضعیت:** هر ۲۰ سناریو **واقعاً** به‌صورت `WorkflowModel` ساخته، در دیتابیس زندهٔ Workflow (MSSQL) `publish` و در بیشتر موارد `start`/`dispatch` شده‌اند — هیچ‌کدام از JSONهای این سند فرضی نیستند؛ همه از خروجی واقعی اجرای [`scripts/build-workflow-20-scenarios.ts`](../../scripts/build-workflow-20-scenarios.ts) گرفته شده‌اند.
> **Remaining AI/workflow items:** [`plans/core/next/p-72-ai-backlog.md`](../../plans/core/next/p-72-ai-backlog.md) §۴
> **پیش‌نیاز حذف‌شده:** پیش از ساخت این ۲۰ سناریو، ۴ تعریف Workflow نمونهٔ قبلی (`Test`, `employee-leave-request`, `process-refund-payment`, `ai-assisted-refund-review`) و تمام نمونه‌های زنده‌شان از دیتابیس حذف شدند (`npx tsx scripts/reset-all-workflows.ts`).

## روش‌شناسی

هر سناریو با ابزارهای واقعی موتور ساخته شد: `createWorkflowDefinition` → `publishWorkflowDefinition` → `startWorkflowInstance` → `dispatchNode`/`runOneEngineWorkerTick` (همان Worker پس‌زمینه‌ای که سرور زنده استفاده می‌کند). هیچ Mock ساختگی در سطح موتور استفاده نشد — «Mock» در این سند یعنی **استفاده از قابلیت واقعی Sandbox موتور** (Simulation نبود؛ اجرای واقعی روی دیتابیس بود، دقیقاً مثل یک محیط dev واقعی).

**راهنمای وضعیت هر سناریو:**
- ✅ **کاملاً موفق** — publish شد، اجرا شد، به نتیجهٔ درست رسید.
- ⚠️ **جزئی/محدود** — publish و اجرا موفق شد، اما نتیجه محدودیت واقعی موتور را آشکار کرد (نه شکست تست، بلکه *خودِ هدف* این سناریو).
- ❌ **گپ** — یا publish/binding رد شد، یا رفتار موتور به‌طور بنیادین اجازهٔ این سناریو را نمی‌دهد.

| # | سناریو | حوزه | وضعیت | گپ مرتبط |
|---|--------|------|-------|----------|
| S01 | فیلتر لیست کاربران | Data & Logic | ⚠️ | F-2 |
| S02 | ادغام دو منبع داده | Data & Logic | ⚠️ | F-2 |
| S03 | حلقه با شرط خروج | Data & Logic | ⚠️ | F-1, F-5, F-9 |
| S04 | تشخیص رکورد تکراری | Data & Logic | ⚠️ | F-2 |
| S05 | تقسیم به دسته‌های کوچک | Data & Logic | ⚠️ | F-1, F-5, F-9 |
| S06 | تایید دستی (Resume) | Human-in-the-Loop | ✅ | F-4 (نکته) |
| S07 | تایید دومرحله‌ای | Human-in-the-Loop | ✅ | — |
| S08 | Timeout و Fallback | Human-in-the-Loop | ✅ | — |
| S09 | ویرایش داده توسط انسان | Human-in-the-Loop | ✅ | — |
| S10 | Retry با تاخیر افزایشی | Error Handling | ⚠️ | — (railguard تأیید شد) |
| S11 | مسیر جایگزین در خطا | Error Handling | ❌ | F-3 |
| S12 | Rollback / Saga | Error Handling | ❌ | F-6 |
| S13 | CSV به JSON | File System | ⚠️ | F-2, F-7 |
| S14 | پایش پوشهٔ محلی | File System | ❌ | F-4, F-7 |
| S15 | گزارش متنی پویا | File System | ✅ | F-8 (نکته) |
| S16 | کرون‌جاب دوره‌ای | Scheduling | ❌ | F-4 |
| S17 | تاخیر پویا | Scheduling | ⚠️ | F-1 |
| S18 | اجرای موازی/Race | Scheduling | ⚠️ | F-1 |
| S19 | زمان‌بندی تاریخ خاص | Scheduling | ⚠️ | F-1 |
| S20 | پاکسازی حجمی DB | Scheduling | ❌ | F-4, F-10 |

---

# بخش ۱: پردازش داده، حلقه‌ها و توابع داخلی

## S01 — فیلتر و اصلاح لیست کاربران (Data Filtering)

**حوزه تست:** State Management در سطح Expression؛ توانایی موتور در پیمایش/فیلتر یک آرایهٔ ورودی.

**شرح جریان داده (گام‌به‌گام):**
1. `MANUAL_API` شروع با ورودی یک آرایهٔ `users`.
2. نود `DECISION` تلاش می‌کند وضعیت `active` بودن کاربر را بررسی کند — اما فقط می‌تواند به `users[0]` (اندیس ثابت) نگاه کند.
3. بسته به نتیجه، یکی از دو نود `ACTION` (`text.template`) پیام توضیحی تولید می‌کند.
4. نود `ACTION` سوم (`data.set`) کل آرایه را بدون تغییر (passthrough) به بیرون می‌دهد — چون امکان فیلتر واقعی نیست.
5. `END` خروجی نهایی را برمی‌گرداند.

**ورودی واقعی (Workflow Input):**
```json
{
  "users": [
    { "name": "Ali", "age": 30, "active": true },
    { "name": "Sara", "age": 17, "active": false },
    { "name": "Reza", "age": 41, "active": true }
  ]
}
```

**خروجی واقعیِ نود `END` (مشاهده‌شده، نه فرضی):**
```json
{
  "totalUsersInspectedIndividually": 1,
  "note": "No data.filter / per-item predicate exists — the whole array could only be passed through unfiltered.",
  "passthroughUsers": [
    { "name": "Ali", "age": 30, "active": true },
    { "name": "Sara", "age": 17, "active": false },
    { "name": "Reza", "age": 41, "active": true }
  ]
}
```

**چالش فنی اصلی:** موتور هیچ عملگر `MAP`/`FILTER` در زبان Expression خودش (`CanonicalExpression`) و هیچ Action ثبت‌شده‌ای برای پردازش‌تک‌به‌تک آرایه ندارد. تنها راه دسترسی به عناصر آرایه، اندیس‌دهی **ثابت و از پیش‌نوشته‌شده در زمان طراحی** است (`users[0]`, `users[1]`, ...) — نه پیمایش پویا روی یک آرایه با طول نامعلوم در زمان اجرا. جزئیات کامل: `F-2` در سند گپ.

---

## S02 — ادغام دو منبع داده محلی (Data Merging)

**حوزه تست:** ترکیب دو ساختار داده مستقل؛ توانایی Join/Merge پویا.

**شرح جریان داده:**
1. شروع با دو آرایهٔ مستقل `sourceA` و `sourceB`.
2. دو نود `ACTION` موازی-منطقی (`data.aggregate`, op=`COUNT`) تعداد رکوردهای هرکدام را می‌شمارند.
3. نود `DECISION` بررسی می‌کند آیا `sourceA[0].id == sourceB[0].id` (فقط دو رکورد اول، نه همهٔ رکوردها).
4. نود `ACTION` نهایی (`data.set`) یک آرایهٔ **با طول ثابت ۴ عضوی** از اندیس‌های مشخص هر دو منبع می‌سازد (نه ادغام واقعی و پویا).
5. `END`.

**ورودی:**
```json
{
  "sourceA": [{ "id": 1, "name": "A1" }, { "id": 2, "name": "A2" }, { "id": 3, "name": "A3" }],
  "sourceB": [{ "id": 1, "note": "B1" }, { "id": 4, "note": "B4" }]
}
```

**خروجی واقعی نود `END` (پس از اصلاح یک باگ authoring خودمان — لبهٔ گم‌شده از `merged-fixed-size` به `end-1`؛ Validation موتور این باگ را به‌درستی شکار کرد):**
```json
{
  "countA": 3,
  "countB": 2,
  "mergedFixedFourItemsOnly": [
    { "id": 1, "name": "A1" },
    { "id": 2, "name": "A2" },
    { "id": 1, "note": "B1" },
    { "id": 4, "note": "B4" }
  ]
}
```

**چالش فنی اصلی:** `CONCAT` در موتور فقط برای رشته‌ها کار می‌کند (نه آرایه)، و مقدار `ARRAY` در `CanonicalMapping` یک لیست با طول ثابت و از‌پیش‌معلوم است — هیچ راهی برای «تمام آرایهٔ B را به انتهای آرایهٔ A بچسبان» یا «بر اساس کلید `id` ادغام کن» وجود ندارد. `F-2`.

---

## S03 — حلقه تکرار با شرط خروج (Loop with Break Condition)

**حوزه تست:** State Management، امکان بازگشت/تکرار در گراف اجرا.

**شرح جریان داده:**
1. یک تعریف Workflow (`scn-03-loop-counter`) با ورودی `{count, max}`.
2. `DECISION`: اگر `count < max` → به نود بعدی برو؛ در غیر این صورت → `END(BREAK_REACHED)`.
3. نود `ACTION` (`data.set`) مقدار `count+1` را محاسبه می‌کند.
4. نود `SUBFLOW` **همین تعریف را دوباره صدا می‌زند** (خودارجاعی) با `count` جدید — این تنها راه واقعی برای «حلقه» در این موتور است، چون گراف‌های منتشرشده اجباراً بدون‌چرخه‌اند (DAG-only؛ چرخه در `publish` رد می‌شود).
5. هر لایهٔ تکرار یک نمونهٔ (`WorkflowInstance`) فرزند کاملاً durable و مستقل است.

**ورودی شروع:**
```json
{ "count": 0, "max": 3 }
```

**زنجیرهٔ واقعی نمونه‌ها (مشاهده‌شده در DB):**
```json
[
  { "instanceId": 12, "input": { "count": 0, "max": 3 }, "status": "RUNNING (گیر کرده — نگاه کن F-1)" },
  { "instanceId": 13, "input": { "count": 1, "max": 3 }, "status": "RUNNING (نودِ sf-recurse خودش گیر کرد)" }
]
```

**چالش فنی اصلی:** موتور **هیچ نود Loop بومی ندارد** — گراف منتشرشده باید همیشه بدون‌چرخه (Acyclic) باشد. تنها راه کار «حلقهٔ خودارجاع از طریق SUBFLOW» است که سنگین (هر تکرار = یک نمونهٔ کامل جدید) و بدون سقف عمق تعریف‌شده است (`F-5`, `F-9`). به‌علاوه، در حین اجرای این سناریو دقیقاً به باگ بحرانی `F-1` برخوردیم: لایهٔ دوم بازگشت، نودِ `SUBFLOW` خودش برای همیشه در `RUNNING` گیر کرد (بدون این‌که هرگز `WAITING` شود) — این‌جا مستند شده چون **مستقیماً حین اجرای این سناریو کشف شد**.

---

## S04 — تشخیص رکورد تکراری و ادغام (Deduplication)

**حوزه تست:** مقایسه و ادغام رکوردهای تکراری.

**شرح جریان داده:**
1. ورودی: آرایهٔ `records`.
2. `DECISION`: آیا `records[0].key == records[1].key`؟ (فقط دو رکورد اول).
3. اگر بله → `ACTION` (`data.set`) رکورد ادغام‌شده (کلید + جدیدترین مقدار) می‌سازد.
4. اگر نه → شاخهٔ «هر دو نگه‌داشته شوند».
5. `END`.

**ورودی:**
```json
{
  "records": [
    { "key": "CUST-1", "value": "old" },
    { "key": "CUST-1", "value": "new" },
    { "key": "CUST-2", "value": "other" }
  ]
}
```

**خروجی واقعی (نمونه SUCCEEDED شد):**
```json
{
  "note": "Duplicate detection compared exactly 2 hardcoded records (records[0] vs records[1]); an arbitrary-length list cannot be scanned for duplicates natively."
}
```
(رکورد سوم `CUST-2` هرگز بررسی نشد — چون چیزی فراتر از اندیس ۰ و ۱ در دسترس نبود.)

**چالش فنی اصلی:** Dedup واقعی روی N رکورد نیازمند یک اسکن O(N) با مقایسهٔ زوجی/کلید است — که بدون پیمایش تک‌به‌تک آرایه (همان ریشهٔ `F-2`) ممکن نیست. فقط مقایسهٔ دستی و ثابتِ دو اندیس مشخص قابل بیان است.

---

## S05 — تقسیم یک تسک بزرگ به تسک‌های کوچک (Batch Queueing)

**حوزه تست:** Memory/State در پردازش دسته‌ای؛ الگوی Split-in-Batches.

**شرح جریان داده:**
1. ورودی `{index, total}`.
2. `DECISION`: اگر `index <= total` → پردازش آیتم فعلی (`ACTION` با `text.template`، پیام «در حال پردازش آیتم #index»).
3. `ACTION` بعدی، `index+1` را محاسبه می‌کند.
4. `SUBFLOW` خودارجاع، لایهٔ بعدی صف را با `index` جدید صدا می‌زند (دقیقاً همان الگوی S03).
5. وقتی `index > total` → `END(QUEUE_DRAINED)`.

**ورودی شروع:**
```json
{ "index": 1, "total": 4 }
```

**خروجی مشاهده‌شده نود `process-item` در لایهٔ اول:**
```json
{ "text": "Processing batch item #1 of 4" }
```

**چالش فنی اصلی:** مثل S03، هیچ سازهٔ بومی «تقسیم یک آرایه به دسته‌های N‌تایی» وجود ندارد؛ تنها راه، همان بازگشت SUBFLOW خودارجاع است — یعنی برای صف‌بندی N آیتم، N نمونهٔ کامل Workflow لازم است (نه یک سازوکار سبک صف). این سناریو هم به همان باگ `F-1` (نود `sf-next-batch` برای همیشه در `RUNNING` گیر کرد) برخورد کرد.

---

# بخش ۲: تعامل انسان و ماشین در محیط تست (Human-in-the-Loop)

## S06 — تایید دستی تراکنش (Manual Resume via Webhook)

**حوزه تست:** Suspend/Resume با دخالت انسان؛ نقطهٔ ورود خارجی.

**شرح جریان داده:**
1. شروع با `{txId, amount}` → نود `WORK_ITEM` نوع `APPROVAL` با تخصیص نقش `ADMIN` و خروجی‌های مجاز `APPROVE`/`REJECT` ساخته و READY می‌شود.
2. Worker پس‌زمینه آن را Dispatch می‌کند → وضعیت `WAITING_HUMAN` (یک `WorkItem` با وضعیت `OPEN` ساخته می‌شود).
3. «Resume» با فراخوانی واقعی همان سرویسی که HTTP endpoint `POST /api/workflow-work-items/:id/complete` را پیاده می‌کند (`claimWorkItem` سپس `completeWorkItem`) انجام شد.
4. بسته به `outcome`، به نود `ACTION` (اعلان) و سپس `END` مربوطه می‌رود.

**ورودی WORK_ITEM:**
```json
{ "txId": "TX-1001", "amount": 4500000 }
```

**تکمیل واقعی (شبیه‌سازی «webhook»، از طریق API داخلی):**
```json
{ "workItemId": 6, "actorUserId": 1, "outcome": "APPROVE", "output": null }
```

**خروجی نهایی `END`:**
```json
{ "outcome": "APPROVED" }
```

**چالش فنی اصلی:** موتور **هیچ Webhook عمومی/بدون‌احراز‌هویت** برای Resume ندارد (`F-4`) — «Resume via Webhook» در عمل یعنی «تکمیل یک Work Item از طریق API داخلیِ احرازهویت‌شدهٔ همین پلتفرم»، نه یک دریافت‌کنندهٔ webhook عمومی. این تمایز باید در مستندسازی محصول شفاف باشد.

---

## S07 — تایید دو مرحله‌ای متوالی (Multi-Stage Approval)

**حوزه تست:** زنجیرهٔ چند نود `WORK_ITEM` متوالی؛ State Management در طول یک مسیر طولانی انسانی.

**شرح جریان داده:**
1. `WORK_ITEM` اول («تایید مدیر»)؛ در صورت `APPROVE` → `WORK_ITEM` دوم («تایید مالی»)؛ در صورت `REJECT` → پایان زودهنگام.
2. `WORK_ITEM` دوم هم به همین ترتیب شاخه‌بندی می‌شود.

**ورودی:**
```json
{ "amount": 12000000 }
```

**خروجی نهایی واقعی (هر دو تایید با `APPROVE` تکمیل شدند):**
```json
{ "outcome": "DOUBLE_APPROVED" }
```

**چالش فنی اصلی:** این سناریو ✅ **کاملاً و بدون هیچ محدودیتی کار کرد** — زنجیرهٔ `WORK_ITEM → WORK_ITEM_OUTCOME edge → WORK_ITEM` یک الگوی کاملاً بومی و پشتیبانی‌شده است. هیچ گپی کشف نشد.

---

## S08 — تایید دستی با مهلت زمانی (Timeout & Fallback)

**حوزه تست:** ترکیب Human-in-the-Loop و Escalation Policy مبتنی‌بر زمان.

**شرح جریان داده:**
1. `WORK_ITEM` با `escalationPolicy.steps[0]`: بعد از `afterMs` مشخص (در این تست ۱۵۰۰ میلی‌ثانیه)، اکشن `COMPLETE_WITH_OUTCOME` با کلید خروجی `AUTO_REJECTED_TIMEOUT` اجرا می‌شود.
2. کسی Work Item را تکمیل نمی‌کند (عمداً) → پس از گذشت SLA، اسکنر Escalation (`scanAndRunDueEscalations`) آن را به‌صورت خودکار می‌بندد.

**تعریف Escalation واقعی:**
```json
{
  "steps": [
    {
      "key": "auto-reject-on-timeout",
      "trigger": { "type": "AFTER_OPEN_MS", "afterMs": 1500 },
      "action": {
        "type": "COMPLETE_WITH_OUTCOME",
        "outcomeKey": "AUTO_REJECTED_TIMEOUT",
        "output": { "reason": "No human responded within SLA" }
      },
      "maxExecutions": 1
    }
  ]
}
```

**خروجی نهایی واقعی:**
```json
{ "outcome": "TIMED_OUT_FALLBACK" }
```

**چالش فنی اصلی:** این هم ✅ کاملاً کار کرد. نکتهٔ مهم برای مستندسازی تیم: تنها اکشن Escalation که واقعاً یک «مهلت و مسیر جایگزین» می‌سازد `COMPLETE_WITH_OUTCOME` است؛ نه یک نوع لبهٔ Timeout مجزا روی WORK_ITEM (آن نوع لبه فقط برای `WAIT_EVENT`/`DELAY` با `WAIT_TIMEOUT` وجود دارد).

---

## S09 — ویرایش داده توسط انسان در میانه راه (Human Data Injection)

**حوزه تست:** تزریق دادهٔ خارجی (انسانی) به Context یک نمونهٔ در حال اجرا.

**شرح جریان داده:**
1. `WORK_ITEM` نوع `DATA_ENTRY` مقدار OCR-استخراج‌شده را نمایش می‌دهد.
2. انسان با outcome=`CORRECTED` و `output={amount: 150000}` تکمیل می‌کند.
3. `outputAssignments` مقدار را در متغیر Context (`correctedAmount`) می‌نویسد.
4. نود بعدی (`text.template`) از همان متغیر Context استفاده می‌کند — نه از ورودی اولیهٔ اشتباه.

**ورودی اولیه:**
```json
{ "ocrExtractedAmount": 105000 }
```

**تکمیل انسانی:**
```json
{ "outcome": "CORRECTED", "output": { "amount": 150000 } }
```

**خروجی نهایی واقعی:**
```json
{
  "finalAmount": 150000,
  "confirmationText": "Human-corrected amount accepted downstream: 150000"
}
```

**چالش فنی اصلی:** این هم ✅ کاملاً کار کرد. نکتهٔ authoring مهم: `WorkItemType` یک enum بسته است — فقط `APPROVAL | REVIEW | DATA_ENTRY | DECISION | CONFIRMATION | EXCEPTION | AI_REVIEW` مجازند (هر مقدار دیگری در Publish رد می‌شود؛ خود ما این را با تلاش اول این سناریو کشف کردیم).

---

# بخش ۳: مدیریت خطا و بازپخش (Error Handling & Retries)

## S10 — تلاش مجدد خودکار با تاخیر افزایشی (Exponential Backoff Retry)

**حوزه تست:** Retry Policy، زمان‌بندی Backoff، و قوانین Idempotency.

**شرح جریان داده (بخش الف — اثبات زمان‌بندی Backoff):**
1. یک `ACTION` با شکست قطعی و تکرارپذیر (`data.aggregate` روی آرایه‌ای با یک عضو غیرعددی — همیشه `VALIDATION` fail می‌شود).
2. `retryPolicy`: `{maxAttempts: 3, strategy: "EXPONENTIAL", initialDelayMs: 400, multiplier: 2}`.

**پیشروی واقعی Attemptها (مشاهده‌شده در DB):**
```json
[
  { "tick": 0, "attemptCount": 1, "nodeStatus": "RETRYING" },
  { "tick": 1, "attemptCount": 2, "nodeStatus": "RETRYING" },
  { "tick": 2, "attemptCount": 3, "nodeStatus": "FAILED" }
]
```
```json
"attemptTimestamps": [
  "2026-07-16T23:11:48.606Z",
  "2026-07-16T23:11:49.402Z",
  "2026-07-16T23:11:50.520Z"
]
```

**شرح جریان داده (بخش ب — اثبات Guardrail Idempotency):**
تلاش برای publish یک `ACTION` (`integration.http-request`، تماس خارجی *غیر-Idempotent*) با `retryPolicy.maxAttempts=3`:

**نتیجهٔ واقعی publish:** موتور این تعریف را **رد کرد** (طبق طراحی، نه باگ) چون یک Action با `idempotency.guarantee=NONE` و `sideEffectClass≠PURE` هرگز اجازهٔ `maxAttempts>1` ندارد (`WF_ACTION_IDEMPOTENCY_INCOMPATIBLE`).

**چالش فنی اصلی:** زمان‌بندی Backoff (فاصلهٔ رشدیابندهٔ بین تلاش‌ها) **درست کار می‌کند**. اما چون هیچ Action داخلی «شکست می‌خورد و بعد موفق می‌شود» ندارد، این تست فقط می‌تواند خودِ زمان‌بندی را اثبات کند، نه بازیابی واقعی از یک خطای موقتی. مهم‌تر: این تست تأیید کرد که موتور به‌درستی جلوی Retry خودکار روی فراخوانی‌های خارجی غیر-Idempotent (مثل درگاه پرداخت) را می‌گیرد — یک railguard درست، نه یک محدودیت ناخواسته.

---

## S11 — مسیر جایگزین در صورت خطا (Error Branching / Catch Block)

**حوزه تست:** آیا موتور یک لبهٔ «On Error» بومی دارد؟

**شرح جریان داده:**
1. یک `ACTION` (`integration.http-request`) به یک دامنهٔ تضمین‌شده‌غیرقابل‌حل (`*.invalid`، طبق RFC 2606 هرگز resolve نمی‌شود — بدون وابستگی شبکهٔ واقعی).
2. تنها یک لبهٔ خروجی (`UNCONDITIONAL`) به یک `END` موفقیت وجود دارد — چون **هیچ نوع لبهٔ دیگری از یک نود ACTION مجاز نیست**.

**خطای واقعی رخ‌داده:**
```json
{
  "status": "FAILED",
  "errorClass": "SSRF_BLOCKED",
  "errorCode": "HTTP_URL_BLOCKED",
  "errorMessage": "getaddrinfo ENOTFOUND this-domain-will-never-resolve.invalid"
}
```

**نتیجهٔ نهایی نمونه:** `INSTANCE_FAILED` — بدون هیچ مسیر جایگزین.

**چالش فنی اصلی (❌ گپ):** `WorkflowEdgeSelector` یک union بسته است: `UNCONDITIONAL | DECISION | DECISION_DEFAULT | SWITCH_CASE | SWITCH_DEFAULT | WORK_ITEM_OUTCOME | WAIT_TIMEOUT`. **هیچ `ON_ERROR`/`CATCH` وجود ندارد.** یک شکست بدون‌بازیابی ACTION همیشه مستقیم به شکست کل نمونه می‌رود؛ تنها اهرم بازیابی سطح‌نود، تلاش‌مجدد **همان نود** است، نه مسیریابی به نودی دیگر. جزئیات کامل: `F-3`.

---

## S12 — لغو ایمن فرآیندها در صورت خطا (Rollback / Saga Pattern)

**حوزه تست:** Compensating Transaction هنگام شکست یک شاخهٔ موازی.

**شرح جریان داده:**
1. `PARALLEL_SPLIT` با دو شاخه: «رزرو انبار» (`ACTION` موفق، `text.template`) و «شارژ پرداخت» (`ACTION` با شکست قطعی، `integration.http-request` به دامنهٔ `*.invalid`).
2. `PARALLEL_JOIN` با mode=`ALL`.

**وضعیت واقعی نودها هنگام شکست (مشاهده‌شده):**
```json
[
  { "key": "reserve-inventory", "status": "SUCCEEDED" },
  { "key": "charge-payment", "status": "FAILED" },
  { "key": "pj-both-done", "status": "CANCELLED" },
  { "key": "end-1", "status": "CANCELLED" }
]
```
نمونهٔ نهایی: `INSTANCE_FAILED`.

**چالش فنی اصلی (❌ گپ):** شاخهٔ «رزرو انبار» قبلاً با موفقیت اثر جانبی واقعی خودش را اعمال کرده بود (`SUCCEEDED`، با ردیف Trace/Attempt واقعی) — اما وقتی شاخهٔ خواهرش شکست خورد و کل نمونه `FAILED` شد، **هیچ فراخوانی جبرانی/Undo روی رزرو انبار انجام نشد**. لغو خواهر-وخواهرها فقط شاخه‌های *هنوز کامل‌نشده* را لغو می‌کند؛ توانایی معکوس‌کردن یک شاخهٔ از قبل موفق در موتور وجود ندارد. جزئیات: `F-6`.

---

# بخش ۴: کار با فایل‌ها و مستندات محلی

## S13 — تبدیل فایل CSV به JSON بدون نوشتن روی دیسک (In-Memory Processing)

**حوزه تست:** پردازش رشته‌ای در حافظه؛ محدودیت پیمایش سطر‌به‌سطر.

**شرح جریان داده:**
1. ورودی یک رشتهٔ CSV چندسطری.
2. `text.split` با جداکنندهٔ `\n` → لیست خطوط.
3. `text.split` روی خط اول (هدر) و خط دوم (اولین رکورد، اندیس ثابت `1`) با جداکنندهٔ `,`.
4. `data.set` یک شیء JSON از فیلدهای رکورد اول می‌سازد.

**ورودی:**
```json
{ "csvText": "name,age,city\nAli,30,Tehran\nSara,25,Isfahan" }
```

**خروجی نهایی واقعی:**
```json
{
  "header": ["name", "age", "city"],
  "record": { "name": "Ali", "age": "30", "city": "Tehran" },
  "note": "Only row[1] (a fixed index) was parsed into JSON — an N-row CSV needs per-row iteration, which is unavailable."
}
```
(سطر دوم، `Sara,25,Isfahan`، هرگز پردازش نشد.)

**چالش فنی اصلی:** هیچ Action تخصصی CSV در موتور وجود ندارد (`F-7`)؛ و حتی با ترکیب `text.split`، فقط یک سطر ثابت قابل تبدیل است — تبدیل کل فایل (تعداد سطر نامعلوم) به همان محدودیت پیمایش آرایه برمی‌گردد (`F-2`).

---

## S14 — پایش پوشه محلی (Local Folder Watcher Trigger)

**حوزه تست:** Trigger مبتنی‌بر رویداد فایل‌سیستم.

**شرح جریان داده (تلاش‌شده):**
1. تعریف با `start: {type: "EVENT", eventName: "local.folder.file-created"}`.
2. `publish` **ساختاری** موفق شد (Validation ایرادی نگرفت).
3. اما فعال‌سازی Binding با کد واقعی زیر رد شد:

```json
{
  "publicationStatus": "ACTIVATING_BINDING",
  "bindingStatus": "FAILED",
  "code": "WF_DEF_MISSING_CANONICAL_PLATFORM_CONTRACT",
  "message": "EVENT start binding requires a canonical AppEndO event-bus primitive that does not exist in this repository yet."
}
```

**چالش فنی اصلی (❌ گپ مضاعف):** حتی اگر Event Bus وجود داشت، **هیچ Action یا Trigger پایش فایل‌سیستم محلی در سراسر پلتفرم وجود ندارد** (نه فقط در Workflow) — هیچ‌کس نمی‌تواند رویداد «فایل ساخته شد» را تولید کند. `F-4` + `F-7`.

---

## S15 — تولید گزارش متنی پویا (Template Engine)

**حوزه تست:** رندر متن پویا از داده‌های محاسبه‌شده.

**شرح جریان داده:**
1. `data.aggregate` (op=`SUM`) روی آرایهٔ `amounts`.
2. `text.template` با متغیرهای `{{date}}`, `{{count}}`, `{{total}}`.

**ورودی:**
```json
{ "date": "2026-07-17", "transactionCount": 42, "amounts": [10000, 25000, 7000] }
```

**خروجی نهایی واقعی:**
```json
{ "report": "Daily report for 2026-07-17: 42 transactions, total = 42000 IRR." }
```

**چالش فنی اصلی:** ✅ کاملاً کار کرد. نکتهٔ مهم برای تیم: `text.template` فقط جایگزینی تخت `{{key}}` است (regex: `/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g`) — **بدون** `{{#each}}`/`{{#if}}`/مسیر تودرتو (`{{user.name}}` کار نمی‌کند). فهرست‌کردن N سفارش داخل یک گزارش، به همان محدودیت پیمایش آرایه برمی‌گردد (`F-8`).

---

# بخش ۵: زمان‌بندی، کرون‌جاب و سناریوهای پویای زمانی

## S16 — کرون‌جاب دوره‌ای با بررسی وضعیت (Periodic Health Check)

**حوزه تست:** Trigger زمان‌بندی‌شده (Cron/Schedule).

**شرح جریان داده (تلاش‌شده):**
1. تعریف با `start: {type: "SCHEDULE", scheduledTaskBinding: {bindingType: "SCHEDULED_TASK", bindingId: "..."}}`.
2. `publish` ساختاری موفق شد.
3. فعال‌سازی Binding رد شد:

```json
{
  "publicationStatus": "ACTIVATING_BINDING",
  "bindingStatus": "FAILED",
  "code": "WF_DEF_MISSING_CANONICAL_PLATFORM_CONTRACT",
  "message": "SCHEDULE start binding requires the reserved managed function \"workflow-engine.scheduled-start\" ... which is not registered in this environment yet."
}
```

**راه دور: فراخوانی دستی همان منطق (اثبات این‌که خودِ منطق سالم است):**
```json
{ "status": "SUCCEEDED", "output": { "outcome": "HEALTHY" } }
```

**چالش فنی اصلی (❌ گپ):** زیرساخت واقعی (`SchedulerService`) برای «ثبت‌نام غیرفعال + فعال‌سازی بعدی» زنده و تست‌شده است — فقط **نقطهٔ ورود مخصوص Workflow** (یک Managed Function رزروشده به نام `workflow-engine.scheduled-start`) هرگز ثبت نشده. این کم‌هزینه‌ترین گپ برای بستن در کل این سند است. `F-4`.

---

## S17 — تاخیر پویا بر اساس دیتای ورودی (Dynamic Delay/Wait)

**حوزه تست:** آیا مقدار `DELAY` می‌تواند از دادهٔ ورودی محاسبه شود؟

**شرح جریان داده:**
1. `ACTION` (`data.set`) مقدار میلی‌ثانیه را از `delaySeconds × 1000` محاسبه می‌کند.
2. `DELAY` با `value` = خروجی همان نود (نه یک عدد ثابت).

**ورودی:**
```json
{ "delaySeconds": 2 }
```

**چالش فنی اصلی:** طراحی زیرساخت **درست** است — `DELAY.delay.value` هر `CanonicalExpression`ای می‌تواند باشد، نه فقط literal، و در Runtime به‌درستی در برابر `maxDelayMs` محدود می‌شود (حتی اگر Validation در زمان Publish فقط مقدار literal را چک کند). **اما** در اجرای زنده، این سناریو دقیقاً به باگ بحرانی `F-1` برخورد کرد: نود `dynamic-wait` هرگز به `WAITING` نرسید و برای همیشه در `RUNNING` باقی ماند — با وجود این‌که طراحی خودِ قابلیت سالم است.

---

## S18 — اجرای موازی با زمان‌بندی‌های مختلف (Race Condition & Concurrency Test)

**حوزه تست:** صحت Join همزمان چند شاخهٔ موازی (Concurrency Correctness).

**شرح جریان داده:**
1. `PARALLEL_SPLIT` با سه شاخه، هرکدام یک `DELAY` با مدت متفاوت (۳۰۰، ۹۰۰، ۱۵۰۰ میلی‌ثانیه).
2. `PARALLEL_JOIN` با mode=`ALL` — باید هر سه ورود را (به‌صورت اتمیک، حتی اگر هم‌زمان برسند) بشمارد.

**وضعیت واقعی مشاهده‌شده:**
```json
[
  { "key": "branch-fast", "status": "RUNNING" },
  { "key": "branch-medium", "status": "RUNNING" },
  { "key": "branch-slow", "status": "RUNNING" }
]
```

**چالش فنی اصلی:** این دقیقاً سناریویی بود که قرار بود منطق Join همزمان (که در تست‌های داخلی موتور با قفل ردیف Postgres تأیید شده بود) را زیر فشار واقعی بسنجد — اما هر سه شاخه به باگ `F-1` برخوردند و هرگز حتی به مرحلهٔ `WAITING` نرسیدند، پس امکان مشاهدهٔ رفتار واقعی Join در این اجرا فراهم نشد. **توصیه:** این سناریو دقیقاً همان تستی است که باید بعد از رفع `F-1` دوباره اجرا شود؛ طراحی گراف آن (سه `DELAY` موازی → `PARALLEL_JOIN(ALL)`) بدون تغییر قابل استفادهٔ مجدد است.

---

## S19 — زمان‌بندی تاریخ خاص (Date-Specific Execution)

**حوزه تست:** `DELAY` از نوع `UNTIL` (لحظهٔ مطلق تقویمی، نه مدت نسبی).

**شرح جریان داده:**
1. `DELAY` با `{type: "UNTIL", value: "<لحظهٔ دقیق ۲ ثانیه بعد>"}`.

**مقدار واقعی هدف:**
```json
{ "targetInstant": "2026-07-16T23:12:26.900Z" }
```

**چالش فنی اصلی:** طراحی `UNTIL` درست است (بدون سقف `maxDelayMs`، چون یک لحظهٔ مطلق است نه یک مدت). اما این سناریو هم به همان باگ `F-1` برخورد کرد — نود `wait-until-instant` هرگز `WAITING` نشد.

---

## S20 — پاکسازی زمان‌بندی شده دیتابیس با شرط حجم فایل (Sized-based DB Cleanup)

**حوزه تست:** ترکیب Schedule Trigger + شرط داده‌محور + Action داخلی برای اندازه‌گیری منبع.

**شرح جریان داده (تلاش‌شده):**
1. تعریف با `start: SCHEDULE` (مثل S16) → همان شکست Binding.
2. نسخهٔ دستی: `DECISION` بررسی `currentSizeMb >= thresholdMb`؛ اگر بله → `ACTION` پاکسازی؛ در غیر این صورت → رد شدن.

**ورودی نسخهٔ دستی:**
```json
{ "currentSizeMb": 5200, "thresholdMb": 4000 }
```

**خروجی واقعی نسخهٔ دستی:**
```json
{ "outcome": "CLEANED" }
```

**چالش فنی اصلی (❌ گپ مضاعف، «کاپیتان» گپ‌های این سند):**
1. همان مشکل Trigger زمان‌بندی‌شدهٔ `F-4` — یک Cron واقعیِ شبانه ممکن نیست.
2. حتی اگر Trigger کار می‌کرد، **هیچ Action داخلی برای اندازه‌گیری واقعی حجم DB/فایل‌سیستم** وجود ندارد — عدد `currentSizeMb` همیشه باید از بیرون به Workflow تزریق شود، که هدف اصلی یک Job پاک‌سازی *خودمختار* را زیر سؤال می‌برد. `F-4` + `F-10`.

---

## جمع‌بندی برای تیم مهندسی

از ۲۰ سناریو: **۶ مورد کاملاً موفق** (S06, S07, S08, S09, S10-الف، S15)، **۱۰ مورد جزئی/محدود** (منطق کار کرد اما محدودیت واقعی موتور را آشکار کرد)، **۴ مورد گپ کامل** (S11, S12, S14, S16/S20). بحرانی‌ترین یافته (`F-1`، در سند گپ) یک باگ concurrency واقعی است که هیچ ربطی به «طراحی محدود V1» ندارد و باید مستقل و فوری بررسی شود. برای شرح کامل هر یافته با کد دقیق و توصیهٔ رفع، به [`p-72-ai-backlog.md`](../../plans/core/next/p-72-ai-backlog.md) §۴ مراجعه کنید.
