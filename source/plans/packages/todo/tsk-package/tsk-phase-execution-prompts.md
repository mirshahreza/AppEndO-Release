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


# پرامپت‌های آماده-اجرا — Task Management (برای Claude Code / Cursor)

> هر پرامپت را جدا و به‌ترتیب، به‌همراه `@plans/packages/todo/tsk-package` paste کن. بعد از هر فاز/زیر‌فاز، منتظر پاسخ کوتاه عامل (کدام ردیف، پیش‌نیازها سبز؟، کدام استانداردها بار شد) بمان، سپس ادامه بده.

---

## فاز ۱ — دیتابیس و اطلاعات

```
@plans/packages/todo/tsk-package فاز ۱ بساز

قبل از شروع: کل سند را بخوان (شامل §بازبینی ریسک و ابهام R1–R11). فقط فاز ۱ را بساز:
پنج جدول tsk_* + associations (شامل خودارجاع parent/subtasks) + Base Info روت Task Management
با ۵ دسته/آیتم‌ها + studio-meta کامل (Story/columnGroupOrder/columnMeta/associationMeta برای هر ۵ مدل).
پذیرش بصری هر ۶ بند را در Data Studio تأیید کن. FKها طبق R9. ترجیحاً اسکریپت
scripts/task-management-phase1/ (idempotent) بساز یا از الگوی cms-phase1 تقلید کن.
ممنوع: package zip، src/core/packages/task-management/، seed در bootstrap.
در پایان بگو: کدام ردیف ساختی، پذیرش بصری سبز است یا نه.
```

## فاز ۲ — Server Functions

```
@plans/packages/todo/tsk-package فاز ۲ بساز

فقط بعد از فاز ۱ ✅. منطق دامنه را با Server Functions سفارشی روی Sequelize Edge بساز — بدون db.query،
بدون mountTaskRoutes، بدون built-in. حتماً این سناریوهای پذیرش را به‌صورت تست خودکار بنویس:
۱) POST project · PATCH رد slug · archive
۲) POST task → task_number اتمیک per-project؛ تست concurrency صریح: N درخواست هم‌زمان روی یک پروژه
   → N شمارهٔ یکتای متوالی بدون تکرار/gap
۳) PATCH رد project_id و status_code خام
۴) change-status می‌نویسد تاریخچه؛ done → completed_at؛ reopen پاک می‌کند
۵) parent_id تو در تو → 4xx
۶) related-counts عدد واقعی
۷) comments append-only با author_id کاربر جاری
۸) search: الگوی slug-number (R10) و title
دسترسی طبق R4 (بدون RBAC per-action در v1). ترجیحاً scripts/task-management-phase2/.
بعد از اتمام: خروجی تست‌ها را نشان بده.
```

## زیر‌فاز 3a — Nav + Settings + واژگان

```
@plans/packages/todo/tsk-package زیر‌فاز 3a بساز

فقط بعد از فاز ۲ ✅. قبل از هر خط کد: package-ui.md کامل + Base Components (/studio/base-components)
را باز کن و بخش‌های مربوط را نام ببر. R11: page-modules + route-bindings + tskStudioNav.ts (الگوی cmsStudioNav).
گروه ناوبری مستقل Tasks (nav.group.tasks) بساز؛ tasks/settings با فقط Task Labels (بدون General خالی).
پذیرش: CRUD واژگان زنده؛ enum بسته صفحه ندارد؛ culture درست؛ گروه Tasks جدا از Records/Operations/Development.
```

## زیر‌فاز 3b — Projects (کاتالوگ طلایی)

```
@plans/packages/todo/tsk-package زیر‌فاز 3b بساز

این صفحه «طلایی» است — الگوی مرجعش را عیناً کپی کن (Data Studio object cards / CMS vocab catalog)،
بازطراحی نکن. قبل از شروع بخش‌های BC (grid cardVariant=catalog، create-edit، buttons) را نام ببر.
بساز: Projects list (catalog cards) + create dialog + editor main/rail + Archive + related-counts + Open board.
پذیرش: package-ui.md کامل + T6/T7/T8 + مرتب‌سازی پیش‌فرض updated_at نزولی (R1) + browser
روی tasks/projects و edit/{id} + contract test. توقف کن و منتظر تأیید قبل از رفتن به 3c-pre.
```

## زیر‌فاز 3c-pre — تکمیل BC مشترک Kanban (پیش‌نیاز 3c، مشترک با CRM)

```
@plans/packages/todo/tsk-package زیر‌فاز 3c-pre بساز

اول تست src/domain/component-designer/__tests__/vizKanbanCancelRevert.test.tsx و UiKanbanCard غنی را اجرا کن.
اگر از قبل سبزند: فقط گزارش تأیید بده؛ کار تکراری روی BC ممنوع (مگر wipLimit روی UiKanbanColumn هنوز نباشد — آن اختیاری v1).

اگر تست قرمز است: خارج از scripts/task-management-phase3/ همان fix پلتفرمی را بزن (revertSignal در DesignerVizKanban +
UiKanbanBoard). R7: تست باید بعد از fix سبز شود.

پذیرش: رندر legacy title/description نشکند؛ coloredColumns از Designer کار کند.
```

## زیر‌فاز 3c — Tasks (کانبان + ادیتور طلایی + bulk actions)

```
@plans/packages/todo/tsk-package زیر‌فاز 3c بساز

فقط بعد از 3c-pre ✅. قید Designer: Kanban = palette viz.kanban → UiKanbanBoard (کارت غنی از 3c-pre).
ادیتور Task را عیناً از الگوی «modeler main+rail» کپی کن. بساز: Kanban + grid toggle + bulk action bar
(Status/Assignee/Label روی چند ردیف انتخاب‌شده، T11) + create identity dialog + editor.

قواعد صریح این بازبینی که باید رعایت شوند:
- Hide completed: پیش‌فرض on در جدول، off در کانبان (R2)
- مرتب‌سازی پیش‌فرض جدول: updated_at نزولی (R1)
- Bulk action: Promise.allSettled + toast «N/M بروزرسانی شد» + گرید همیشه رفرش (R3)
- بدون endpoint حذف سخت تسک؛ فقط change-status→cancelled (R5)
- Kanban: لیست تخت GET + bucket در کلاینت (R8)؛ map کارت غنی به UiKanbanCard

پذیرش: T1–T5 · T9–T12؛ live-verify change-status + Cancelled confirm با revert صحیح (تست 3c-pre) +
computed key؛ footer sort روی جدول؛ bulk روی چند ردیف انتخاب‌شده.
```

## Live-verify نهایی فاز ۳

```
مرورگر واقعی باز کن و این مسیرها را چک کن: tasks/projects ، tasks/projects/edit/{id} ،
tasks/tasks (drag بین ستون‌ها + toggle به grid + bulk action) ، tasks/tasks/edit/{id} ، tasks/settings.
همهٔ درخواست‌های HTTP فاز ۲ باید ۲۰۰ باشند (یا ۴xx عمدی برای lockها). نتیجه را با اسکرین‌شات یا
لاگ کنسول نشان بده، نه فقط ادعای «انجام شد».
```

</div>
