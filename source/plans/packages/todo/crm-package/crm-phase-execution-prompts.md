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


# پرامپت‌های آمادهٔ اجرا — پکیج CRM & Support (v2)

> این‌ها را مستقیم در Claude Code یا Cursor، **پشت سر هم و به ترتیب**، به‌همراه `@plans/packages/todo/crm-package` کپی/پیست کن. هر پرامپت یک واحد کوچیک از کاره — عمداً از «برو جلو»ی خیلی کلی خودداری شده تا فیکس تجمعی در فرم‌ها اتفاق نیفته (دلیلش در `crm-plan-review-and-benchmark.md`).

پیش از شروع، دو تغییر کوچک از فایل بررسی را در خود سند اعمال کن (اختیاری ولی توصیه‌شده):
- R2: خط «پیش‌فرض مرتب‌سازی = `updated_at` نزولی» به هر سه صفحهٔ لیست اضافه کن.
- R6: هشدار duplicate نرم در دیالوگ Create Customer.

---

## فاز ۱ — دیتابیس و اطلاعات پایه

```
@plans/packages/todo/crm-package فاز ۱ بساز

قبل از نوشتن هر مدل:
1. هفت جدول crm_* + associations را دقیقاً طبق §مدل دامنه و §Edge model associations بساز — نه یک ستون کم، نه یک ستون اضافه.
2. Base Info روت CRM + ۸ دسته را طبق §اطلاعات پایه seed کن.
3. studio-meta (groups, story, columnMeta, associationMeta) را طبق بخش‌های جدول‌به‌جدول همین سند بساز.

بعد از اتمام، خودت §پذیرش بصری در Data Studio (۶ بند) را یکی‌یکی چک کن و برای هرکدام بگو کجای کار همان بند را برآورده می‌کند. اگر یک بند را برآورده نمی‌کند، آن را قبل از گزارش «تمام شد» درست کن.
```

## فاز ۲ — Server Functions

```
@plans/packages/todo/crm-package فاز ۲ بساز

هر ۶ سناریوی پذیرش §فاز ۲ را به‌عنوان تست بنویس، نه فقط پیاده‌سازی کن — به‌خصوص #۲ (merge اتمیک با row lock) و #۴ (دو change-stage هم‌زمان روی یک فرصت). این دو سناریو race condition هستند و بدون تست صریح معمولاً به‌ظاهر درست به‌نظر می‌رسند ولی زیر بار واقعی می‌شکنند.

قبل از گزارش اتمام: تست‌ها را واقعاً اجرا کن و خروجی سبز را نشان بده.
```

## زیرفاز 3a — Nav + Settings + واژگان

```
@plans/packages/todo/crm-package زیر‌فاز 3a بساز

قبل از هر خط کد: package-ui.md و بخش §UX ادمین همین سند را کامل بخوان.

خروجی: گروه ناوبری CRM + culture keys + crm/settings با ۴ صفحهٔ واژگان.
پذیرش: زنده در مرورگر برو به crm/settings و هر ۴ بخش واژگان را CRUD کن؛ enum بسته (Lifecycle/Pipeline/Activity Type/Ticket Status) نباید صفحه داشته باشد.
```

## زیرفاز 3b — Customers (طلایی)

```
@plans/packages/todo/crm-package زیر‌فاز 3b بساز

این صفحه «طلایی» است — الگوی مرجع همهٔ صفحات بعدی. مراحل را جدا انجام بده، نه یک‌جا:

مرحله ۱ — قبل از هر کد: پراپ‌های واقعی این Base Componentها را از سورس باز کن و در پاسخت کپی کن (نه فقط اسمشان را بیار): FormSection، FormField، UiInput، UiSelect/combobox، CreateEditModalShell، AppTableGrid، ConfirmDialogShell. اگر یکی از این‌ها را قبلاً برای پکیج دیگری استفاده کرده‌ای (مثلاً Task Management)، همان امضا را اینجا هم به‌کار ببر.

مرحله ۲ — لیست Customers (toolbar + grid + Add Individual/Company) را بساز. توقف کن و به من گزارش بده چه ساختی.

مرحله ۳ — بعد از تأیید من، ادیتور main+rail را طبق §صفحهٔ ویرایش Customer بساز — یک FormSection در هر نوبت (Profile → CRM note → Identity rail → Ownership → Audit trail → Tags → Related).

مرحله ۴ — Merge از لیست.

بعد از هر مرحله، چک‌لیست مربوطه از C1/C4–C8 و package-ui.md را ردیف‌به‌ردیف با ارجاع فایل/خط کد ثابت کن.
```

## زیرفاز 3c-pre — تکمیل BC مشترک Kanban

```
@plans/packages/todo/crm-package زیر‌فاز 3c-pre بساز

اگر این کار قبلاً برای Task Management انجام شده، فقط تأیید کن و رد شو — کار تکراری نکن.

اگر نشده: قبل از هر چیز یک تست بنویس که مسیر «drag یک کارت → drop روی ستون Won/Lost → Cancel در ConfirmDialogShell → برد باید دقیقاً به آرایش قبل از drag برگردد» را چک می‌کند. این تست باید ابتدا قرمز باشد (چون DesignerVizKanban الان optimistic local state دارد که با Cancel درست sync نمی‌شود)، سپس UiKanbanCard/UiKanbanBoardProps/DesignerRuntimeKanban را طبق §کار پایه‌ای Base Components تکمیل کن تا تست سبز شود.
```

## زیرفاز 3c — Opportunities

```
@plans/packages/todo/crm-package زیر‌فاز 3c بساز

ساختار فایل را دقیقاً از صفحات Customers (زیرفاز 3b) کپی کن — همان شل، همان الگوی toolbar/grid/modal — فقط فیلدها و BCهای مخصوص Opportunity را جایگزین کن. یک صفحهٔ جدید از صفر طراحی نکن.

Kanban را طبق §کار پایه‌ای Base Components (کارت غنی: customer avatar · amount badge · days-in-stage · close-date accent) با UiKanbanBoard بساز — نه CSS دست‌نویس.

بعد از اتمام: C2، C10، C11 را ردیف‌به‌ردیف با ارجاع فایل/خط ثابت کن. Live-verify: در مرورگر یک فرصت را از New به Won درگ کن و confirm/lock را ببین؛ سپس Cancel یک drag دیگر را تست کن (باید برگردد).
```

## زیرفاز 3d — Tickets

```
@plans/packages/todo/crm-package زیر‌فاز 3d بساز

ساختار فایل را از الگوی Customers/Opportunities کپی کن.

قرارداد ردیف پیام را دقیق رعایت کن: لیست زمانی ساده با DirectionalText — نه حباب چت. Reply فقط UiTextarea + Send.

بعد از اتمام: C3، C10، C11 را ردیف‌به‌ردیف با ارجاع فایل/خط ثابت کن.
```

## Live-verify نهایی فاز ۳

```
مرورگر را باز کن و به‌ترتیب برو به: crm/customers، …/edit/{userId} یک رکورد واقعی، crm/opportunities (هم Kanban هم toggle به grid)، crm/tickets، crm/settings + هر ۴ بخش واژگان. هر مسیر HTTP فاز ۲ که این صفحات صدا می‌زنند باید ۲۰۰ برگرداند. هر مغایرتی که دیدی همین‌جا لیست کن و قبل از گزارش پایان فاز ۳ فیکس کن.
```

</div>
