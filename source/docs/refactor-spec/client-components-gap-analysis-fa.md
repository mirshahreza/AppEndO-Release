# Client Components — تحلیل کامل شکاف (Gap Analysis) نسبت به App Builder / Form Builder / Dashboard Builder های معتبر

> **هدف سند:** بعد از بررسی دقیق دو فایل مرجع (`client-components-feature-guide-fa.md` و `client-components-toolbox-elements-fa.md`، جمعاً ~1100 + ~16800 خط) و سرچ میدانی روی Retool، Bubble.io، Webflow، Appsmith، Budibase، JotForm، Typeform، Metabase و استانداردهای Design Token/Accessibility در سال 2026، این سند **هر چیزی که فیچر شما کم دارد یا ناقص دارد** را فهرست می‌کند تا با تکمیل آن‌ها فیچر واقعاً به یک App Builder / Form Builder / Dashboard Builder کامل تبدیل شود.
> **روش تحلیل:** مقایسه معماری، کاتالوگ 123 المنت، سیستم Binding، Reducer/Action ها و API فعلی شما با قابلیت‌های تثبیت‌شده صنعت (2026).
> **تاریخ:** 2026-07-28
>
> **⚠️ نسخه ۴ — اصلاح‌شده بر اساس بررسی خط‌به‌خط کد واقعی (نه فقط سند مرجع):** این سند در ابتدا بر اساس دو فایل مرجع نوشته شد که خودشان تولیدشده از پارس یک اسنپ‌شات قدیمی‌تر کد بودند. یک بازبینی مستقل با ۴ ایجنت تحقیقاتی، **مستقیماً روی کد فعلی مخزن** (نه روی آن اسناد)، هر ادعای این سند را تک‌تک راستی‌آزمایی کرد. نتیجه: **۶ مورد از ادعاهای این سند اشتباه/منسوخ بودند** (قابلیت از قبل در کد وجود دارد) و **۵ مورد دیگر نیاز به تدقیق/محدودسازی دامنه** داشتند. همه‌ی این اصلاحات مستقیماً در بخش‌های مربوطه پایین اعمال شده‌اند (با برچسب «✅ اصلاح» یا «⚠️ تدقیق») و جمع‌بندی کامل + یافته‌های تکمیلی (بررسی صفحه واقعی Users) در **بخش ۲۰ (جدید)** آمده است. برای اجرا، فازهای دقیق در `21-DESIGNER-BUGFIX-EXECUTION-PHASES.md` (فاز ۲۴ به بعد) نوشته شده‌اند.

---

## فهرست

0. [جمع‌بندی مدیریتی](#0-جمع‌بندی-مدیریتی)
1. [چیزهایی که فیچر شما در حد بالای صنعت دارد (نقاط قوت)](#1-نقاط-قوت)
2. [شکاف‌های بحرانی (Critical) — بدون این‌ها «App Builder کامل» نیستید](#2-شکاف‌های-بحرانی)
3. [شکاف‌های سطح فرم‌ساز (Form Builder Parity)](#3-شکاف‌های-فرم‌ساز)
4. [شکاف‌های سطح داشبوردساز (Dashboard/BI Parity)](#4-شکاف‌های-داشبوردساز)
5. [شکاف‌های Design System / Theming](#5-شکاف‌های-design-system)
6. [شکاف‌های Layout و Responsive واقعی](#6-شکاف‌های-responsive)
7. [شکاف‌های Animation / Interaction](#7-شکاف‌های-انیمیشن)
8. [شکاف‌های Logic/Automation فراتر از صفحه](#8-شکاف‌های-automation)
9. [شکاف‌های Collaboration و Governance](#9-شکاف‌های-collaboration)
10. [شکاف‌های Extensibility (Custom Code / Plugin)](#10-شکاف‌های-extensibility)
11. [شکاف‌های Accessibility](#11-شکاف‌های-accessibility)
12. [شکاف‌های Import/Export و Data Onboarding](#12-شکاف‌های-import-export)
13. [شکاف‌های Mobile / Native / Offline](#13-شکاف‌های-mobile)
14. [شکاف‌های AI](#14-شکاف‌های-ai)
15. [جدول کامل خلاصه شکاف‌ها + اولویت + تخمین اثر](#15-جدول-خلاصه)
16. [نقشه‌راه پیشنهادی پیاده‌سازی (Roadmap)](#16-نقشه‌راه)
17. [تعریف «کامل بودن» — چک‌لیست پذیرش نهایی](#17-چک‌لیست-پذیرش)
18. [پاسخ صریح — آیا واقعاً «هرچیزی» قابل ساخت است؟ (Data Connectivity، Real-time، Session، المنت‌های غایب)](#18-پاسخ-صریح--آیا-بعد-از-این-تغییرات-واقعاً-هرچیزی-قابل-ساخت-است)
19. [بررسی عمیق و اصلاحی Data Binding چارت‌ها/جدول‌ها/گزارش‌ها](#19-بررسی-عمیق-و-اصلاحی--دقت-و-کامل‌بودن-data-binding-برای-چارت‌ها-جدول‌ها-و-گزارش‌ها)

---

## 0. جمع‌بندی مدیریتی

فیچر **Client Components** شما از نظر **عمق معماری** (5 لایه هر المنت: Catalog/Runtime/Codegen/Inspector/Binding)، **سیستم Binding** (API/Store/Region/Grid/Chart/Viz/Dynamic Actions)، **Publish/Version/Rollback**، و **یکپارچگی با AI/MCP** در سطح بسیار بالایی است — در واقع در برخی جنبه‌ها (مثل تولید TSX واقعی به‌جای رانتایم proprietary، و ACL سطح node) از Bubble و Webflow **جلوتر** است چون خروجی‌اش کد واقعی React است، نه یک runtime بسته.

اما برای اینکه واقعاً **«هر صفحه‌ای، هر اپلیکیشن کاملی، هر گزارش و داشبوردی»** با آن ساخته شود، در 4 حوزه اصلی شکاف جدی دارید:

| حوزه | وضعیت فعلی | شکاف اصلی |
|------|------------|-----------|
| **App Builder کامل** | صفحه‌ساز + Shell Designer قوی | فاقد state/متغیر سراسری مستقل از API، فاقد custom code escape hatch (نکته: Automation/Workflow پس‌زمینه‌ای **در محدوده این فیچر نیست** — شما فیچر Workflow جدا دارید؛ فقط نقطه اتصال/Trigger به آن لازم است، نه ساخت یک Workflow Engine داخل Client Components) |
| **Form Builder** | Binding فرم قوی (regionSubmit, DML خودکار) | فاقد Multi-step Wizard واقعی، Conditional Branching بصری، Validation Rule Engine، Payment، Signature، Save & Resume، CAPTCHA |
| **Dashboard Builder** | 12 نوع چارت + Grid پیشرفته | فاقد Global Filter Bar، Cross-filtering بین ویجت‌ها، Drill-down، Export (PDF/Excel)، Scheduled Report/Alert |
| **Design System** | Tailwind props + HeroUI | فاقد Design Token/Theme Editor مرکزی، Component Variants، Dark/Light/Brand Theme، Animation Timeline |

پایین‌تر هر شکاف با **راه‌حل دقیق مطابق معماری موجود شما** (کدام Action، کدام لایه، کدام فایل) توضیح داده شده تا مستقیماً قابل اجرا باشد.

---

## 1. نقاط قوت

قبل از شکاف‌ها، مهم است این‌ها ثبت شود چون **نباید در نقشه‌راه بازسازی شوند** — فقط باید تکمیل شوند:

- **Codegen واقعی به TSX** — بر خلاف Bubble/Webflow (runtime proprietary)، خروجی شما کد واقعی قابل مالکیت است؛ این دقیقاً همان چیزی است که Retool در 2026 به‌عنوان مزیت رقابتی «real React in your codebase, no lock-in» تبلیغ می‌کند — شما از قبل دارید.
- **Binding Registry چندلایه** (dataSources/lovs/storeSegments/definitions) قوی‌تر از اکثر رقباست.
- **ACL هم در سطح صفحه هم در سطح node** (`set-node-visibility-access`) — چیزی که حتی Retool/Bubble به این ظرافت ندارند (آن‌ها عمدتاً page/app-level).
- **Publish/Rollback/Staging Token** معادل «blue-green deploy» Retool.
- **AI-native از پایه** (`draft_component_layout`, `designer_insert_palette_item`, `designer_set_prop`) — هم‌راستا با جهت 2026 صنعت (Retool AppGen، Bubble AI Agent).
- **123 المنت با پوشش گسترده** شامل Data Viz، Forms، Navigation — از نظر تعداد با Retool (~90) و Appsmith (~50) رقابتی است.

---

## 2. شکاف‌های بحرانی

### 2.1 ~~نبود Automation/Workflow پس‌زمینه‌ای~~ — خارج از محدوده (فیچر جدا)

> **⛔ خارج از محدوده این سند.** طبق اعلام شما، Workflow (schedule/webhook/cron/retry/approval) یک **فیچر جداگانه** در پلتفرم شماست و قرار نیست داخل Client Components ساخته شود. بخش‌های قبلی این سند که به «Workflow Engine» ارجاع می‌دادند (بخش‌های ۸، ردیف ۱ جدول ۱۵، فاز ۴ نقشه‌راه بخش ۱۶) بر همین اساس **حذف/اصلاح شدند.**

**چیزی که همچنان در محدوده Client Components باقی می‌ماند — نقطه اتصال (Integration Point) نه ساخت خودِ Workflow:**
از آن‌جا که این دو فیچر باید با هم کار کنند (مثلاً یک فرم که submit می‌شود باید بتواند یک Workflow را trigger کند، یا یک صفحه باید بتواند نتیجه یک Workflow را نمایش دهد)، تنها چیزی که در Client Components لازم است یک **Dynamic Action جدید و سبک** برای فراخوانی فیچر Workflow شماست، نه بازسازی منطق آن:

- Dynamic Action جدید در `trueActions` (کنار `refreshDataSource`, `setValue`, `callMutation`, …): **`triggerWorkflow`** — با پارامترهای `{ workflowId, payloadMapping }` که صرفاً یک HTTP call به API فیچر Workflow جداگانه شما می‌زند (دقیقاً هم‌الگو با `callMutation` فعلی که یک data source mutation را صدا می‌زند).

> **✅ رفع شد — فاز ۵۱:** Dynamic Action `triggerWorkflow` با `{ workflowDefinitionId, payloadMapping }` اضافه شد؛ Preview/Export به `POST /api/workflow-runtime/definitions/:id/start` با body `{ input, startType: 'MANUAL_API' }` می‌زنند. Diagnostics برای id خالی/نامعتبر خطا می‌دهد (هرگز سکوت). تست: `triggerWorkflowAndCsvImportPhase51Fix.test.ts`.
- یک `sourceType` جدید یا استفاده از همان `apiRef` موجود برای این‌که یک node بتواند **نتیجه/وضعیت** یک Workflow را (که فیچر جدا برمی‌گرداند) نمایش دهد — نیازی به مدل‌سازی جدید نیست، همان الگوی `dataSourceRef` فعلی کافی است اگر فیچر Workflow شما یک REST endpoint برای status/history می‌دهد.

این یعنی از کل تحلیل بخش ۲.۱ قبلی، تنها **یک Dynamic Action ساده** باقی می‌ماند، نه یک «Workflow Designer» جدا — که مسئولیتش را به فیچر Workflow مستقل شما واگذار می‌کنیم.

> **⚠️ تدقیق (نسخه ۴ — بررسی کد واقعی):** بررسی مستقیم کد تأیید کرد که این آیتم واقعاً غایب است (`DesignerDynamicActionType` فعلی: `refreshDataSource | setValue | showHide | showToast | callMutation | resetForm | navigate` — هفت مقدار، بدون `triggerWorkflow`؛ `callMutation`/`navigate` که در این سند به‌عنوان پیشنهاد آینده مطرح بودند، **در فاصله‌ی نگارش این سند تا بازبینی، عملاً اضافه شده‌اند**). نکته‌ی مهمی که باید اضافه شود: یک موتور Workflow کامل و مستقل با endpoint آماده از قبل در ریپو وجود دارد (`src/server/domain/workflow/`, `src/features/workflows/`؛ endpoint واقعی: `POST /workflow-runtime/definitions/:definitionId/start` در `src/server/routes/workflow-runtime.routes.ts:24`، به‌همراه webhook binding adapters). یعنی این «یک Dynamic Action سبک» نه‌تنها معماری‌اش ساده است، بلکه **مقصد فراخوانی‌اش هم از قبل حاضر و تولیدی است** — این آیتم عملاً یک فاز کوچک و کم‌ریسک است، نه یک تصمیم معماری بزرگ.

---

### 2.2 نبود متغیر/State سراسری مستقل از API (App Variables / Custom States)

> **✅ اصلاح (نسخه ۴ — بررسی کد واقعی):** این ادعا **نادرست** بود. `DesignerStoreSegment` (`src/domain/component-designer/types.ts:151-156`) دقیقاً `{ id, initialValue?, hydrateFrom?, persist?: 'none'|'session'|'local' }` است و در `DesignerBindingDefinitions.storeSegments` نگه‌داری می‌شود؛ اکشن‌های `set-store-segment`/`remove-store-segment` هم در `state.ts:1117-1146` پیاده‌سازی شده‌اند. این **دقیقاً** معادل «Custom State» بابل است: یک متغیر document-scope با مقدار اولیه و پایداری اختیاری (session/local/none)، کاملاً مستقل از هر Data Source، قابل خواندن/نوشتن از هر جای سند. `sourceType: 'store'` هم از قبل در `DesignerSourceType` وجود دارد و دقیقاً همین را می‌خواند. **هیچ کد جدیدی برای این آیتم لازم نیست** — تنها شکاف واقعی باقی‌مانده «مستندسازی/کشف‌پذیری» است: آیا در Inspector یک پنل مستقل و قابل‌کشف («Variables»/«App State») برای مدیریت `storeSegments` در سطح سند وجود دارد یا کاربر باید از مسیرهای غیرمستقیم (Binding popover) به آن برسد؟ این یک آیتم UX کم‌هزینه است، نه یک شکاف معماری.
>
> ~~وضعیت فعلی شما: storeSegments ... اما این‌ها عمدتاً برای نگاشت به data source/binding طراحی شده‌اند~~ *(ادعای زیر منسوخ شد — برای تاریخچه نگه داشته شده)*

**راه‌حل باقی‌مانده (فقط UX/کشف‌پذیری، نه معماری جدید):**
- یک پنل Inspector مستقل «Variables/App State» (در سطح سند، نه per-node) که فهرست `storeSegments` موجود را نشان دهد و افزودن/حذف/تغییر `initialValue`/`persist` را بدون نیاز به رفتن از مسیر یک binding خاص ممکن کند.
- مستندسازی داخل‌برنامه‌ای که به‌صراحت بگوید این مکانیزم معادل Custom State است.

**اولویت:** 🟢 پایین (فقط کشف‌پذیری UI — قابلیت زیرین از قبل کامل است)

---

### 2.3 نبود Custom Code Escape Hatch (JS/Expression Editor سطح Node)

**وضعیت فعلی شما:** فقط `sourceType: 'expression'` در binding ذکر شده (بدون جزئیات زبان expression) و Monaco فقط برای **کل سند** (TSX/JSON) است، نه برای یک قطعه منطق مشخص.

**چیزی که همه رقبا دارند:** Retool (JavaScript Query)، Appsmith (JS Objects escape hatch)، Bubble (Toolbox plugin JS)، Budibase (Bindings + JS binding) — همه یک **"جای فرار به کد"** دارند تا وقتی UI کفایت نکرد، کاربر بتواند یک تابع کوچک JS/TS بنویسد که مقدار prop یا نتیجه یک اکشن را محاسبه کند.

**راه‌حل پیشنهادی:**
- `DesignerBindingDefinition.sourceType = 'expression'` را واقعاً غنی کنید: یک sandbox ایزوله (مثل `new Function` با whitelist از توابع/متغیرهای در دسترس: `node`, `store`, `variables`, `row`, helper libs مثل `dayjs`/`lodash` subset) اضافه کنید.
- یک Monaco Editor کوچک **inline** در همان popover binding toggle (`{ }`) باز شود، نه فقط یک input تک‌خطی.
- برای اکشن‌ها: نوع جدید Dynamic Action به نام `runScript` (کنار `callMutation`, `setValue`, ...).
- **نکته امنیتی:** چون خروجی TSX واقعی است، بهترین راه این است که expression در codegen مستقیماً به کد TS واقعی (تابع در فایل تولیدی) تبدیل شود، نه eval رانتایم — این با فلسفه «Live Runtime» فعلی شما هم‌خوان است.

**اولویت:** 🔴 بحرانی

> **✅ رفع شد — فاز ۴۷:** موتور مشترک `compileDesignerConditionExpression` برای مقدار prop عمومی‌سازی شد via `sourceType: 'formula'` + `bindingFormulaEngine.ts` (`evaluateDesignerFormulaValue` / `compileDesignerFormulaExpression` — Export به TS واقعی inline می‌شود، نه `evaluateDesignerCondition` string-eval). Monaco inline در Binding panel (حالت Formula) و Visible When (`InspectorConditionalsPanel`) با `DesignerCodeEditorField`. `sourceType: 'expression'` به‌عنوان Page-data path حفظ شد (backward-compatible). Dynamic Action `runScript` آگاهانه خارج از دامنه‌ی این فاز ماند. تست: `formulaBindingExpressionPhase47Fix.test.ts`.

---

### 2.4 نبود Global Filter Bar و Cross-Filtering بین ویجت‌ها (برای داشبورد)

**وضعیت فعلی شما:** هر ویجت (`gridListResource`, `chartDataResource`, `vizDataResource`) بایندینگ **مستقل** خودش را دارد. هیچ سازوکار سندی برای «یک فیلتر تاریخ در بالای صفحه که همزمان چند چارت/گرید را فیلتر کند» یا «کلیک روی یک بار چارت → فیلتر شدن گرید کنارش» دیده نمی‌شود.

**چیزی که Metabase/Retool دارند:**
- **Dashboard Filters**: ویجت فیلتر (تاریخ، select، متن) که به چند کارت همزمان وصل است.
- **Click behavior / Cross-filtering**: کلیک روی نمودار → آپدیت فیلتر داشبورد → رفرش خودکار سایر ویجت‌ها (بدون نوشتن کد).
- **Drill-through**: کلیک روی یک ردیف/بخش نمودار → رفتن به یک کارت/صفحه دیگر با پارامتر منتقل‌شده.

**راه‌حل پیشنهادی:**
- یک المنت جدید در Toolbox: `dashboard.filter-bar` (در Category جدید یا Data Visualization) که از `storeSegments` موجود (بخش 2.2 — که طبق اصلاح بالا از قبل کامل است) استفاده می‌کند: هر فیلتر یک `storeSegment` می‌سازد/می‌نویسد.
- هر binding چارت/گرید یک فیلد جدید بگیرد: `filterBindings: string[]` (لیست id متغیرهایی که در query params/payload آن ویجت اعمال می‌شوند).
- Dynamic Action جدید: `updateFilterFromClick` — روی event چارت (`onDataPointClick` که باید به Event Eligibility Matrix اضافه شود — تأیید شد که فعلاً هیچ چارتی این event را ندارد) مقدار کلیک‌شده را در یک `storeSegment` بنویسد.
- Wizard جدید یا افزودن step به `BindingChartWizardDialog`: «Connect to Dashboard Filter».

> **⚠️ تدقیق (نسخه ۴):** بخش Cross-filtering/Global Filter Bar واقعاً غایب است (تأیید شد) — این بخش صحیح می‌ماند. اما ارجاع به «متغیرهای جدید بخش ۲.۲» باید به `storeSegments` **موجود** اصلاح شود (نه یک مکانیزم جدید) — پایه‌ی داده‌ای این قابلیت از قبل حاضر است، فقط عنصر UI + اتصال کلیک-به-فیلتر باقی مانده.

**اولویت:** 🟠 بالا (برای این‌که «هر داشبوردی» بسازید ضروری است)

---

### 2.5 نبود Export (PDF/Excel/CSV/Image) برای گرید و داشبورد

> **✅ رفع شد — فاز ۴۸:** Dynamic Action جدید `exportData` (`format: csv|xlsx|pdf`, `source: gridListResource|chartDataResource`) + toolbar `showExportButton` / `export.enabled` روی `DesignerGridToolbarConfig`. CSV کاملاً client-side از ردیف‌های **فیلتر/سورت‌شده‌ی فعلی** (`filteredRows`)؛ Excel/PDF از `POST /api/component-designer/export`. رجیستری زنده‌ی `registerDesignerExportSource` پاریتی Preview/Export را حفظ می‌کند. تست: `dataExportPhase48Fix.test.tsx`.

**وضعیت فعلی شما:** ~~در فهرست 24 پراپرتی `heroui.app-table-grid` یا Dynamic Actions هیچ اکشن `exportData` دیده نشد.~~ ✅ رفع شد (فاز ۴۸).

**چیزی که صنعت دارد:** Metabase/Retool/هر گرید سازمانی → دکمه Export CSV/Excel/PDF روی جدول، و Subscription/Schedule برای PDF کل داشبورد.

**راه‌حل پیشنهادی:**
- Dynamic Action جدید: `exportData` با پارامترها: `format: 'csv'|'xlsx'|'pdf'`, `source: gridListResource | chartDataResource`.
- روی toolbar گرید (`grid toolbar config` که از قبل دارید — `set-grid-toolbar-config`) یک آیتم جدید `showExportButton: boolean` اضافه شود.
- سمت سرور: endpoint جدید `/api/component-designer/export` که با همان response mapping موجود در `DataSourceDefinition` کار کند.

**اولویت:** 🟠 بالا

---

## 3. شکاف‌های فرم‌ساز (Form Builder Parity)

فرم فعلی شما (`html.form` با `regionDataSource`, Auto DML, scenarios: createEdit/detail/search/create/edit/custom) از نظر **بایندینگ به API** بسیار قوی‌تر از JotForm/Typeform است (چون آن‌ها اصلاً به دیتابیس دلخواه شما بایند نمی‌شوند). اما از نظر **UX فرم‌سازی** این‌ها را کم دارید:

| قابلیت | JotForm/Typeform | شما | راه‌حل |
|--------|:---:|:---:|--------|
| **Multi-step Wizard واقعی با Progress Bar** | ✅ | ❌ (فقط `content.stepper` ویژوال، بدون اتصال به state فرم و بدون validation-per-step) | یک نوع جدید `html.form-wizard` بسازید که چند `html.form` region را به یک `wizardState` (از بخش 2.2) وصل کند؛ هر step قبل رفتن به بعدی validation کامل انجام دهد. `content.stepper` را به این wizard وصل کنید (الان مستقل است). |
| **Conditional Branching بصری (پرش بین سوال/صفحه)** | ✅ (Visual builder با AND/OR) | ⚠️ **تدقیق‌شده (نسخه ۴):** موتور زیرین قوی‌تر از تصور اولیه است — `compileDesignerConditionExpression` (`visibilityConditionEngine.ts:226-322`) یک expression engine واقعی با `new Function` است که به‌طور کامل از AND/OR/زنجیره‌های چندشرطی در یک رشته آزاد (`store.a === 1 && data.b !== 'x'`) پشتیبانی می‌کند — این «ناقص» نیست، فقط **بدون UI ساختاریافته** (Rule-Builder با دکمه‌های افزودن) است؛ کاربر باید عبارت را دستی تایپ کند. «رفتن به step N» چون هنوز هیچ Wizard واقعی وجود ندارد (نگاه کنید #6) بی‌معناست. | UI ساختاریافته (`ConditionalLogicBuilderDialog`) که پشت صحنه همان `compileDesignerConditionExpression` موجود را تولید کند — نه یک موتور ارزیابی جدید. اولویت اصلی این آیتم از «ساخت موتور» به «ساخت UI روی موتور موجود» تغییر کرد. |
| **Validation Rule Engine عمومی** | ✅ (required, regex, min/max, custom) | ⚠️ پراکنده — هر input رفرنس property خودش را دارد ولی «قانون اعتبارسنجی سفارشی چندفیلدی» (مثل «تاریخ پایان > تاریخ شروع») دیده نشد | فیلد جدید در `html.form`: `validationRules: ValidationRule[]` با `crossField` op؛ ارور با i18n key نمایش داده شود. |
| **Payment Field/Wizard (Stripe/PayPal)** | ✅ | ❌ | المنت جدید `form.payment` + `BindingPaymentWizardDialog` (Connect Gateway → Amount mapping → Success/Fail actions) |
| **E-Signature** | ✅ | ❌ | المنت جدید `form.signature-pad` (canvas امضا، خروجی base64/SVG) |
| **Save & Resume (فرم بلند)** | ✅ | ❌ | Dynamic Action جدید `saveDraftSubmission` + بارگذاری خودکار با توکن URL |
| **CAPTCHA / Spam Protection** | ✅ | ❌ (مهم چون بعد از Publish این فرم‌ها می‌توانند public باشند — `staging` هم public است) | المنت `form.captcha` (hCaptcha/Turnstile wrapper) در `regionSubmit` اجباری برای فرم‌های anonymous |
| **File Upload → Cloud با progress چندفایلی و preview گالری** | ⚠️ پایه (`html.file-upload`، 3 فیلد) | باید عمق داده شود: multiple, drag-drop reorder, per-file progress، preview thumbnail، محدودیت نوع/حجم با پیام i18n | افزودن props: `multiple`, `maxFileSizeMb`, `acceptedMimeTypes`, `previewMode` |
| **Calculated Fields عمومی (نه فقط ویجت Calculator)** | ✅ | ~~⚠️ `form.calculator` یک المنت جداست، اما نمی‌توان مقدار هر `input-text`/`number-input` را از فرمول محاسبه کرد~~ ✅ رفع شد (فاز ۴۷ — `formulaBindingExpressionPhase47Fix.test.ts`: `sourceType: 'formula'` روی هر prop قابل‌bind؛ وابستگی‌های `store.*`/`data.*` استخراج می‌شوند و Preview با تغییر store دوباره ارزیابی می‌کند؛ Export فرمول را به TS واقعی compile می‌کند) | به binding، `sourceType: 'formula'` اضافه شود که از expression engine بخش 2.3 استفاده کند و روی `onChange` سایر فیلدها rerun شود |

**اولویت کلی این بخش:** 🟠 بالا (برای پوشش کامل «فرم‌ساز» حیاتی است، چون در حال حاضر اگر کسی بخواهد یک فرم استخدام/نظرسنجی/سفارش با شاخه‌بندی بسازد، امکانش نیست)

---

## 4. شکاف‌های داشبوردساز (Dashboard/BI Parity)

علاوه بر بخش 2.4 و 2.5:

| قابلیت | Metabase/Retool | شما |
|--------|:---:|:---:|
| **Scheduled Report / Email-Slack Subscription** | ✅ | ⛔ **خارج از محدوده** — این باید توسط فیچر Workflow جداگانه شما انجام شود؛ تنها کاری که در Client Components لازم است این است که هر dataSource/چارت یک URL/endpoint قابل‌فراخوانی برای دریافت snapshot داشته باشد که فیچر Workflow بتواند از آن برای تولید گزارش زمان‌بندی‌شده استفاده کند |
| **Alert بر اساس Threshold** (مثلاً «وقتی فروش زیر X شد پیام بده») | ✅ | ⛔ **خارج از محدوده** — همین‌طور به فیچر Workflow واگذار می‌شود؛ Client Components فقط باید داده را در دسترس قرار دهد |
| **Annotation روی نمودار/Documents برای توضیح insight** | ✅ (Metabase Documents) | ❌ |
| **Real-time / Auto-refresh Interval روی هر ویجت** | ✅ | **✅ اصلاح (نسخه ۴):** از قبل موجود است — `DataSourceDefinition.pollingIntervalMs` (`types.ts:193`) در Inspector («Polling Interval (ms)»، `InspectorSharedComponentsPanel.tsx:252-263`) قابل تنظیم است و در Preview واقعاً با `window.setInterval` اجرا می‌شود (`designerRuntimePreview.tsx:1434-1444`) و در Export هم کدجن می‌شود. ادعای سند در این مورد نادرست بود. |
| **Comparison/Period-over-period در چارت** (این ماه vs ماه قبل) | ✅ | ❌ تأیید شد — واقعاً غایب است؛ باید به `viz.chart-line/bar` گزینه `comparisonSeries` اضافه شود |
| **Public Embed دقیق با پارامتر URL** (dashboard token با فیلتر پیش‌فرض از querystring) | ✅ | ⚠️ `staging` preview دارید ولی پارامتری‌سازی از URL برای فیلترها روشن نیست |

**اولویت:** 🟢 پایین برای refresh (طبق اصلاح بالا از قبل حل شده)، 🟡 متوسط برای comparison (تنها آیتم واقعاً باقی‌مانده این ردیف)؛ Scheduled Report/Alert از این سند حذف شدند چون در فیچر Workflow جداگانه شما پیاده می‌شوند.

---

## 5. شکاف‌های Design System

**وضعیت فعلی شما:** ✅ **رفع شد (فاز ۴۹)** — `DesignSystemRegistry` در سطح Workspace (`workspace/designer/design-system/registry.json`) با `{ colors, spacing, typography, radii, shadows }` → CSS vars `--dc-*`؛ `designTokenRefs` اختیاری روی نود؛ `DesignSystemEditorDialog` در Catalog/Toolbar؛ `ReusableComponentRef.variantKey` + `variants` روی draft. رگرسیون: `designSystemPhase49Fix.test.ts`. `surfaceToken` همچنان برای سطوح shell پلتفرم جدا می‌ماند.

| قابلیت | Webflow/Builder.io/UXPin | شما |
|--------|:---:|:---:|
| **Design Token Registry مرکزی** (رنگ/فاصله/تایپوگرافی به‌صورت متغیر نامگذاری‌شده، نه هاردکد) | ✅ | ✅ رفع شد (فاز ۴۹) |
| **Theme Switching (Light/Dark/Brand) بدون تغییر تک‌تک node ها** | ✅ | ✅ رفع شد (فاز ۴۹ — تغییر token در Theme Editor → همهٔ ارجاع‌ها از طریق CSS vars) |
| **Component Variants** (مثل Figma variants: Button/Primary, Button/Danger, Button/Ghost به‌عنوان یک المنت با state های از پیش تعریف‌شده) | ✅ (Builder.io Symbols، Figma-style) | ✅ رفع شد (فاز ۴۹ — `variantKey` + `variants`) |
| **Global Style Guide Panel** (فونت‌ها، اسکیل تایپوگرافی، پالت رنگ در یک UI متمرکز، نه در Inspector هر node) | ✅ | ✅ رفع شد (فاز ۴۹ — `DesignSystemEditorDialog`) |

**راه‌حل پیشنهادی:**
- یک سطح جدید بین Document و Node به نام `DesignSystemRegistry` در سطح Workspace (نه per-document) اضافه کنید: `{ colors, spacing, typography, radii, shadows }` که به CSS variables کامپایل می‌شود (`--dc-color-primary` و ...).
- `tw*` compiler فعلی (که به `className` کامپایل می‌شود) باید بتواند به‌جای مقدار خام Tailwind، به یک **token reference** اشاره کند.
- یک Dialog جدید: `DesignSystemEditorDialog` (رنگ‌ها، تایپوگرافی، فاصله‌ها) که در سطح Catalog list (نه per-draft) در دسترس باشد چون Token ها بین همه کامپوننت‌ها مشترک‌اند.
- برای Component Variants: به `ReusableComponentRef` یک فیلد `variantKey` و در تعریف reusable component یک بخش `variants: Record<string, PartialPropsOverride>` اضافه شود.

**اولویت:** 🟡 متوسط-بالا (برای برند سازمانی یکپارچه در همه صفحات لازم است، ولی فوریت آن کمتر از بخش 2 است)

---

## 6. شکاف‌های Responsive واقعی

> **✅ اصلاح کامل (نسخه ۴ — بررسی کد واقعی):** این کل بخش بر پایه‌ی فرضی نادرست بود. یک سیستم per-breakpoint واقعی و کامل از قبل وجود دارد:
> - `BreakpointPrefix = '' | 'md:' | 'lg:'` در `src/domain/component-designer/tailwindStyleCodec.ts:21`.
> - فایل اختصاصی `src/features/component-designer/lib/designerStyleBreakpoints.ts` با تب سه‌گانه‌ی Desktop(`lg:`)/Tablet(`md:`)/Mobile(base) — دقیقاً هماهنگ با پریست‌های Viewport کانواس.
> - `collapseResponsiveClassNameForBreakpoint`/`collapseResponsiveClassNameForWidth` برای شبیه‌سازی زنده‌ی کانواس بر اساس عرض viewport شبیه‌سازی‌شده.
> - وایرشده در `InspectorVisualStylePanel.tsx` واقعی و پوشش‌داده‌شده در تست‌های `inspectorVisualStyle.t1-11d.test.tsx`/`inspectorVisualStyleDisplayLayout.test.tsx`.
> - مکانیزم ذخیره‌سازی: یک رشته کلاس Tailwind با پیشوند چندمقداره در یک پراپ رشته‌ای (`text-sm md:text-lg lg:text-xl`) — نه یک آبجکت JSON جدا به‌ازای هر breakpoint، اما از دید کاربر و کد تولیدشده کاملاً معادل قابلیت Webflow/Retool است.
>
> **شکاف واقعی باقی‌مانده (محدودتر از ادعای اولیه):** باید بررسی موردی شود که آیا *همه‌ی* فیلدهای `tw*` (نه فقط تایپوگرافی/رنگ) این پشتیبانی breakpoint را در `TAILWIND_INSPECTOR_FIELDS` دارند یا برخی فیلدهای layout/structural هنوز تک‌مقداری‌اند — این یک ممیزی موردی کوچک است، نه یک بازسازی معماری.

~~وضعیت فعلی شما: Viewport فقط سه Preset ... هر پراپرتی tw* می‌تواند مقدار متفاوت به‌ازای هر breakpoint داشته باشد؟~~ *(بخش زیر برای تاریخچه نگه داشته شده — دیگر معتبر نیست)*

**راه‌حل باقی‌مانده (فقط ممیزی موردی، نه بازسازی):**
- یک پاس ممیزی روی `TAILWIND_INSPECTOR_FIELDS`/معادل آن که فهرست کند کدام فیلدهای `tw*` breakpoint-selector ندارند و آن‌ها را با همان الگوی `designerStyleBreakpoints.ts` تکمیل کند.

**اولویت:** 🟢 پایین (ممیزی موردی — زیرساخت اصلی از قبل کامل و در تولید است)

---

## 7. شکاف‌های انیمیشن

**وضعیت فعلی شما:** هیچ مفهوم Interaction/Animation (hover state transition، scroll-triggered reveal، page transition) در معماری دیده نشد — فقط رندر استاتیک HeroUI.

**چیزی که Webflow دارد (GSAP-powered از جولای 2025):** SplitText، ScrollTrigger، Staggered animations، reusable interaction presets، timeline-based hover/click/scroll effects.

**راه‌حل پیشنهادی (نسخه سبک، نه کامل GSAP):**
- یک بخش جدید در Inspector: «Interactions» (شبیه بخش موجود «Interactions panel» برای event binding، ولی برای visual transition):
  - `hoverTransition`: `{ property: 'scale'|'opacity'|'translateY', from, to, durationMs }`
  - `scrollReveal`: `{ enabled, direction, durationMs, delayMs }`
  - این‌ها در codegen به Tailwind transition classes یا یک هوک کوچک `useInViewAnimation` کامپایل شوند (بدون نیاز به کتابخانه سنگین GSAP، با CSS transitions/`IntersectionObserver` استاندارد کافی است).
- برای انیمیشن‌های پیچیده‌تر (Lottie)، یک المنت جدید `content.lottie-player` در Category «Content & Media» اضافه شود.

**اولویت:** 🟡 متوسط (برای صفحات لندینگ/مارکتینگ مهم است؛ برای پنل‌های ادمین داخلی اولویت پایین‌تر)

---

## 8. شکاف‌های Automation فراتر از صفحه — بازبینی‌شده (بخش زیادی خارج از محدوده)

> ⛔ **توجه:** طبق تعیین محدوده جدید، ساخت خودِ Workflow Engine (Retry، Approval Flow، Trigger زمان‌بندی‌شده) **در این فیچر انجام نمی‌شود** — این‌ها مسئولیت فیچر Workflow جداگانه شماست. آنچه در ادامه آمده، فقط مواردی است که **واقعاً در محدوده Client Components باقی می‌مانند** چون به UI/Binding مربوط‌اند، نه به orchestration پس‌زمینه:

- ~~Retry/Error handling per step~~ — ⛔ خارج از محدوده (مسئولیت فیچر Workflow)
- ~~Approval Flow~~ — ⛔ خارج از محدوده (مسئولیت فیچر Workflow)
- **Trigger از رویداد دیتابیس در سطح UI** (مثلاً یک گرید که وقتی رکورد جدید اضافه شد خودش رفرش شود) — این با شکاف #32 (Real-time/WebSocket سند بخش ۱۸.۲) پوشش داده می‌شود و به Workflow ربطی ندارد؛ صرفاً UI باید بتواند به یک event زنده گوش دهد، نه این‌که خودش orchestration انجام دهد.
- **Notification Center** (اعلان داخل پرتال به کاربران، نه فقط toast لحظه‌ای) — این یک المنت UI است (`platform-navigation.notification-bell`، طبق بخش ۱۸.۴)؛ منبع داده اعلان‌ها می‌تواند از فیچر Workflow یا هر بک‌اند دیگری بیاید — Client Components فقط مسئول **نمایش** آن است، نه تولیدش.

**اولویت:** 🟢 پایین — این بخش عملاً منحل شد؛ آیتم‌های باقی‌مانده آن (Real-time، Notification Bell UI) قبلاً در بخش ۱۸ سند تحت شماره‌های #32 و در جدول ۱۸.۴ پوشش داده شده‌اند.

---

## 9. شکاف‌های Collaboration و Governance

| قابلیت | Retool/Webflow (2026) | شما |
|--------|:---:|:---:|
| **ویرایش هم‌زمان چند طراح روی یک draft (Real-time Multiplayer)** | ✅ (Webflow real-time collab از 2026، Retool با محدودیت conflict) | ❌ — Reducer شما تک‌کاربره است (`state.ts` local undo/redo)؛ چند کاربر همزمان باعث overwrite می‌شود |
| **Comment/Annotation روی Canvas** (مثل Figma) | ✅ | ✅ رفع شد — فاز ۵۴ (`canvasCommentsAuditRbacPhase54Fix.test.ts`) |
| **Presence indicator** (کی الان دارد ویرایش می‌کند) | ✅ | ❌ — فقط `activeDraftId` نمایشی محلی |
| **RBAC فراتر از ADMIN-only برای کل فیچر** | Retool: per-app/per-resource permission | ✅ رفع شد — فاز ۵۴ (`folderPermissions` / `builderFolderPermissions.ts`؛ مجزا از `designerPageAccess.ts`) |
| **Audit Log برای اکشن‌های Designer** (نه فقط created/updated by) | ✅ (Retool audit logs) | ✅ رفع شد — فاز ۵۴ (`draftAuditLog.ts` روی `PUT /drafts/:id`) |

**راه‌حل پیشنهادی:**
- برای Real-time Collaboration: نیازمند تغییر معماری از "local reducer + optimistic PUT" به یک لایه sync (OT یا CRDT سبک مثل Yjs) روی `DesignerDocument`؛ این یک پروژه بزرگ است — پیشنهاد می‌شود در فاز اول فقط **file-locking نرم** (نمایش «این draft توسط X در حال ویرایش است» + هشدار پیش از overwrite) پیاده شود، نه multiplayer کامل.
- Comment: یک لایه داده جدید `workspace/designer/comments/{draftId}.json` + Action `add-canvas-comment` + رندر pin روی canvas مشابه align bar.
- Audit Log: جدول append-only در سرور (`draftAuditLog.ts`) که هر `PUT /drafts/:id` را diff کرده و ذخیره کند (از `DesignerPublishDiffDialog` موجود می‌توانید منطق diff را reuse کنید).
- Builder-level RBAC: `defaultRoles` را به فهرست قابل تنظیم در سطح folder تبدیل کنید (`folderPermissions: Record<folder, Role[]>`).

**اولویت:** 🟡 متوسط (Comment/Audit) تا 🟢 پایین (Real-time Multiplayer کامل — چون هزینه/فایده‌اش برای یک ابزار داخلی پایین‌تر است، مگر تیم طراحی شما بزرگ باشد)

> **✅ رفع شد — فاز ۵۴:** Comment/Annotation (`workspace/designer/comments/{draftId}.json` + `add-canvas-comment` + نوار pin روی canvas)، Audit Log append-only (`draftAuditLog.ts` با diff prop-level روی هر PUT)، Builder-level RBAC (`folderPermissions: Record<folder, Role[]>` در `builderFolderPermissions.ts`). `designerPageAccess.ts` دست‌نخورده ماند (RBAC مصرف‌کننده صفحه). تست: `canvasCommentsAuditRbacPhase54Fix.test.ts`.

---

## 10. شکاف‌های Extensibility (Custom Code / Plugin)

**وضعیت فعلی شما:** ✅ **رفع شد (فاز ۵۷ — گزینه الف)** — ماژول Workspace `custom-elements` با آپلود `.tsx` + JSON Schema برای Inspector؛ ذخیره در `workspace/designer/custom-elements/`؛ دسته پالت پویا `custom-elements`؛ هاست زنده `DesignerCustomElementHost` در Canvas/Preview/Export؛ دروازه امنیتی ADMIN/DEVELOPER + static-analysis اجباری قبل از پذیرش کد. رگرسیون: `customReactImportPhase57Fix.test.ts`.

**چیزی که Retool دارد:** «Custom Components — build your own using React and import them» — یک escape hatch نهایی وقتی 123 المنت کافی نیست (که همیشه برای برخی نیازهای خاص دامنه پیش می‌آید — مثلاً یک نقشه GIS خاص، یک ویجت 3D، یک ادیتور مالی خاص).

**راه‌حل پیشنهادی:**
- یک ماژول جدید «Custom Elements» در سطح Workspace (نه per-draft): کاربر یک فایل `.tsx` (با یک contract مشخص: `props`, `onChangeEvents`) آپلود می‌کند.
- سرور آن را در `workspace/designer/custom-elements/` ذخیره و در زمان build به `tsxComponentRegistry.ts` به‌صورت **پویا import** اضافه می‌کند (نیازمند یک لایه امنیتی: static analysis/sandboxing قبل از قبول کد، چون این کد در همان Node instance اجرا می‌شود طبق «اصل Live Runtime» شما در §1.5).
- در Catalog، این‌ها به‌عنوان یک دسته جدید dynamic palette اضافه شوند: `custom-elements` (کنار `platform-slots`, `reusable-components`).
- این چهار لایه (Catalog/Runtime/Codegen/Inspector) باید برای عناصر سفارشی هم رعایت شود — یعنی حداقل props schema باید توسط خود کاربر اعلام شود (یک JSON schema کوچک هنگام آپلود) تا Inspector بتواند فیلدها را بسازد.

**اولویت:** 🟡 متوسط-بالا (بدون این، همیشه یک درصد از نیازها خارج از 123 المنت باقی می‌ماند و کاربر گیر می‌کند)

---

## 11. شکاف‌های Accessibility

**وضعیت فعلی شما:** ✅ **رفع شد (فاز ۵۰)** — کدهای `a11y-*` در `DesignerDiagnostic`؛ قوانین در `a11yDiagnostics.ts` از طریق `validation.ts`؛ فیلتر Errors / Warnings / **Accessibility** در `DesignerDiagnosticsPanel`؛ Preview از همان منبع واحد استفاده می‌کند. رگرسیون: `accessibilityAuditingPhase50Fix.test.tsx`.

**چیزی که استاندارد 2026 است:** Design token layer با WCAG contrast ratio مشخص، بررسی خودکار focus-visible، ترتیب Tab منطقی، alt text اجباری روی تصاویر، و یک Accessibility Diagnostics Panel (مشابه Diagnostics badge موجود شما برای binding errors، ولی برای a11y).

**راه‌حل پیشنهادی:**
- `diagnosticsByNodeId` (که از قبل دارید برای binding errors) را توسعه دهید تا شامل قوانین a11y هم بشود: «این تصویر `alt` ندارد»، «کنتراست رنگ متن/پس‌زمینه کمتر از 4.5:1 است»، «این دکمه `ariaLabel` ندارد و متن قابل‌خواندن هم ندارد».
- این قوانین را در `validation.ts` (که از قبل دارید) به‌عنوان یک دسته جدید rule اضافه کنید: `a11y-*`.
- یک تب/فیلتر در Diagnostics: Errors / Warnings / **Accessibility**.

**اولویت:** 🟡 متوسط (به‌خصوص اگر خروجی این فیچر صفحات عمومی/portal مشتری‌محور تولید کند، در بسیاری کشورها الزام قانونی هم هست)

---

## 12. شکاف‌های Import/Export و Data Onboarding

| قابلیت | Retool (RetoolDB)/Bubble | شما |
|--------|:---:|:---:|
| **Import CSV/Excel → ساخت خودکار Data Source + Schema** | ✅ | ✅ رفع شد (فاز ۵۱ — `DesignerImportCsvExcelDialog` + `static-file` connector؛ تست: `triggerWorkflowAndCsvImportPhase51Fix.test.ts`) |
| **Import از Figma** | ⚠️ (Webflow/Builder.io دارند) | ❌ |
| **Export کل اپلیکیشن به یک پکیج قابل نصب در نمونه دیگر** | ✅ (شما `packageComponentExport.service.ts` دارید) | ✅ موجود است — نقطه قوت |

**راه‌حل پیشنهادی (فقط مورد اول اولویت دارد):**
- در `DesignerGenerateFromApiMenu` یک آیتم جدید: «Data Source from CSV/Excel» — فایل را parse کرده، schema حدس بزند (نوع هر ستون)، و یک `DataSourceDefinition` با `kind: 'custom'` بسازد که به یک جدول داخلی جدید (اگر دیتابیس داخلی دارید) یا یک فایل JSON static وصل شود.

> **✅ رفع شد — فاز ۵۱:** منوی Generate → «Data Source from CSV/Excel» (`DesignerImportCsvExcelDialog`) فایل را parse می‌کند، schema (نام/نوع) حدس می‌زند، connector `static-file` می‌سازد و `DataSourceDefinition` را به سند اضافه می‌کند. تست: `triggerWorkflowAndCsvImportPhase51Fix.test.ts` / `xlsxImportPhase51Fix.test.ts`.

**اولویت:** 🟢 پایین-متوسط (Nice-to-have، چون سیستم binding شما اصولاً API-first طراحی شده که برای یک پلتفرم سازمانی منطقی‌تر هم هست)

---

## 13. شکاف‌های Mobile / Native / Offline

**وضعیت فعلی شما:** `minViewport: desktop` — یعنی خودِ **Studio** (محیط طراحی) اصلاً روی موبایل باز نمی‌شود (منطقی، چون طراحی روی موبایل سخت است) — این مشکلی نیست. اما سؤال این است: **صفحات منتشرشده** (output) چقدر برای موبایل واقعی (نه فقط پیش‌نمایش ریسپانسیو در مرورگر) آماده‌اند؟

| قابلیت | Bubble/Retool | شما |
|--------|:---:|:---:|
| **PWA (نصب‌پذیر، آفلاین، Push Notification)** | ✅ | **✅ اصلاح (نسخه ۴):** از قبل کامل پیاده‌سازی شده — `src/components/PwaManager.tsx` (mount در `src/main.tsx`) با `registerSW` از `virtual:pwa-register`، مدیریت `beforeinstallprompt`، آفلاین‌ردی، بنر آپدیت، و پیکربندی از `usePwaConfigQuery`. چون این در سطح کل SPA است، صفحات منتشرشده‌ی Client Components هم از نصب/آفلاین بهره می‌برند. |
| **Native Mobile Wrapper (iOS/Android)** | ✅ (Bubble React Native beta، Retool native) | ❌ تأیید شد — هیچ اثری از Capacitor/React Native/Cordova/Expo نیست |

**راه‌حل باقی‌مانده:**
- PWA نیاز به کد جدید ندارد — طبق اصلاح بالا کامل است؛ فقط در صورت نیاز باید بررسی شود که آیا Push Notification (نه صرفاً نصب/آفلاین) هم در `PwaManager.tsx` پوشش داده شده یا نه (جزئیات بیشتر نیاز به بررسی موردی دارد، ولی زیرساخت اصلی PWA وجود دارد).
- Native App (iOS/Android واقعی) اولویت پایین است مگر نیاز کسب‌وکاری صریح وجود داشته باشد — هزینه بسیار بالا نسبت به ارزش برای اکثر سناریوهای «Client Components» (که بیشتر ادمین/پرتال داخلی به‌نظر می‌رسد).

**اولویت:** ⚪ اختیاری (Native) — PWA دیگر آیتم این نقشه‌راه نیست

---

## 14. شکاف‌های AI

**وضعیت فعلی شما:** ✅ **رفع شد (فاز ۵۶)** — ابزار `draft_application_scaffold` روی `draft_component_layout` orchestration می‌کند (Shell + N صفحه + menuEntry معادل DesignerAddToMenuButton). `contextAssembly.ts` / `pageContextPreload` ساختار فولدر/اپلیکیشن موجود را به‌عنوان context می‌دهند. تست: `draftApplicationScaffoldPhase56Fix.test.ts`.

**چیزی که Retool AppGen / Bubble AI Agent دارند:** تولید یک **اپلیکیشن چندصفحه‌ای کامل با data model** از یک پرامپت — یعنی AI باید بتواند هم‌زمان: چند صفحه بسازد، بین‌شان ناوبری (Add to menu) برقرار کند، Data Source تعریف کند، و Shell را انتخاب/بسازد — نه فقط یک `draft` تکی.

**راه‌حل پیاده‌سازی‌شده:**
- ابزار AI سطح بالاتر: `draft_application_scaffold` — آرایه‌ای از `draft_component_layout` + Shell (`app-shell`) + `menuEntry` خودکار برای هر صفحه (اعمال با `appendDesignerPageToPortalMenu` هنگام apply).
- Context Assembly (`formatDesignerApplicationStructure` / `buildDesignerApplicationStructureContext`) ساختار فولدر/اپلیکیشن موجود را در system prompt می‌گذارد.

**اولویت:** 🟡 متوسط — ✅ رفع شد

---

## 15. جدول خلاصه

> **جدول زیر با نتایج نسخه ۴ (بررسی کد واقعی) به‌روزرسانی شد** — ستون «وضعیت» اضافه شده؛ ردیف‌های ✅ نیازی به کار جدید ندارند.

| # | شکاف | حوزه | وضعیت (نسخه ۴) | اولویت | وابستگی |
|---|------|------|:---:|:---:|---------|
| 1 | Dynamic Action سبک `triggerWorkflow` | — | ✅ **رفع شد** (فاز ۵۱ — `triggerWorkflowAndCsvImportPhase51Fix.test.ts`) | 🟢 پایین-ارزان | فیچر جداگانه Workflow؛ فقط یک Action ساده لازم است |
| 2 | ~~Document/App Variables (Custom States)~~ | App Builder | ✅ **حل شده** (`DesignerStoreSegment`/`storeSegments`) | 🟢 فقط UX/پنل کشف‌پذیری | — |
| 3 | Custom Code / Expression Sandbox واقعی روی هر prop (نه فقط visibleCondition) | App Builder | ✅ **رفع شد** (فاز ۴۷ — `formulaBindingExpressionPhase47Fix.test.ts`؛ `sourceType: 'formula'` + Monaco؛ `expression` path حفظ شد) | 🔴 بحرانی | مستقل |
| 4 | Global Filter Bar + Cross-filtering بین ویجت‌ها | Dashboard | ✅ **رفع شد** (فاز ۳۹ — `globalFilterBarPhase39Fix.test.tsx`) | 🟠 بالا | از `storeSegments` موجود استفاده می‌کند |
| 5 | Export داده (CSV/Excel/PDF) از گرید/داشبورد | Dashboard | ✅ **رفع شد** (فاز ۴۸ — `dataExportPhase48Fix.test.tsx`) | 🟠 بالا | مستقل |
| 6 | Multi-step Form Wizard واقعی | Form | ❌ باز (`content.stepper` تزئینی است) | 🟠 بالا | مستقل |
| 7 | Conditional Branching بصری چندشرطی | Form | ⚠️ موتور AND/OR از قبل کار می‌کند؛ فقط UI ساختاریافته باقی مانده | 🟡 متوسط (کم‌ریسک‌تر شد) | UI روی موتور موجود |
| 8 | Validation Rule Engine (cross-field) | Form | ❌ باز | 🟠 بالا | مستقل |
| 9 | ~~Responsive per-breakpoint override~~ | Layout | ✅ **حل شده** (`designerStyleBreakpoints.ts`, `BreakpointPrefix`) | 🟢 فقط ممیزی موردی فیلدهای باقی‌مانده | — |
| 10 | Payment Field + Wizard | Form | ❌ باز | 🟡 متوسط | مستقل |
| 11 | E-Signature Element | Form | ❌ باز | 🟡 متوسط | مستقل |
| 12 | Calculated Fields عمومی (formula binding) | Form | ✅ **رفع شد** (فاز ۴۷ — `formulaBindingExpressionPhase47Fix.test.ts`) | 🟡 متوسط | نیازمند #3 |
| 13 | Save & Resume فرم | Form | ❌ باز | 🟡 متوسط | مستقل |
| 14 | CAPTCHA/Spam Protection | Form | ❌ باز | 🟠 بالا (امنیتی) | مستقل |
| 15 | Design Token Registry + Theme Editor | Design System | ✅ رفع شد (فاز ۴۹ — `designSystemPhase49Fix.test.ts`) | 🟡 متوسط | مستقل |
| 16 | Component Variants (Figma-style) | Design System | ✅ رفع شد (فاز ۴۹ — `variantKey` + `variants` روی draft؛ `designSystemPhase49Fix.test.ts`) | 🟡 متوسط | مستقل |
| 17 | Animation/Interaction (hover/scroll transitions) | Motion | ❌ باز | 🟡 متوسط | مستقل |
| 18 | Custom React Component Import (Escape Hatch) | Extensibility | ✅ رفع شد (فاز ۵۷ — گزینه الف؛ `customReactImportPhase57Fix.test.ts`) | 🟡 متوسط-بالا | مستقل |
| 19 | Accessibility Auditing در Diagnostics | Quality | ✅ رفع شد (فاز ۵۰ — `accessibilityAuditingPhase50Fix.test.tsx`) | 🟡 متوسط | مستقل (توسعه validation.ts) |
| 20 | Comment/Annotation روی Canvas | Collaboration | ✅ رفع شد (فاز ۵۴ — `canvasCommentsAuditRbacPhase54Fix.test.ts`) | 🟡 متوسط | مستقل |
| 21 | Audit Log کامل تغییرات Designer | Governance | ✅ رفع شد (فاز ۵۴ — `canvasCommentsAuditRbacPhase54Fix.test.ts`) | 🟡 متوسط | مستقل |
| 22 | Builder-level RBAC (فراتر از ADMIN سراسری) | Governance | ✅ رفع شد (فاز ۵۴ — `folderPermissions`؛ مجزا از `designerPageAccess.ts`) | 🟡 متوسط | مستقل |
| 23 | Import CSV/Excel → Data Source خودکار | Data Onboarding | ✅ **رفع شد** (فاز ۵۱ — `triggerWorkflowAndCsvImportPhase51Fix.test.ts` / `xlsxImportPhase51Fix.test.ts`) | 🟢 پایین-متوسط | مستقل |
| 24 | ~~Scheduled Report / Alert~~ | — | ⛔ خارج از محدوده | — | فیچر جداگانه Workflow — Client Components فقط باید داده/snapshot در دسترس بگذارد |
| 25 | Real-time Multiplayer Editing (کامل) | Collaboration | ❌ باز (تأیید شد: `state.ts` کاملاً single-user است) | 🟢 پایین (نرم‌لاک کافی است) | معماری سنگین |
| 26 | ~~PWA (نصب‌پذیر/آفلاین)~~ | Mobile | ✅ **حل شده** (`PwaManager.tsx`, `src/main.tsx`) | — | — |
| 27 | Native Mobile App | Mobile | ❌ باز | ⚪ اختیاری | بسیار سنگین |
| 28 | AI App Scaffold چندصفحه‌ای (نه فقط تک‌کامپوننت) | AI | ✅ **رفع شد** (فاز ۵۶ — `draftApplicationScaffoldPhase56Fix.test.ts`) | 🟡 متوسط | نیازمند بخش زیادی از بالا |
| 29 | ~~Auto-refresh Interval~~ + Period Comparison در چارت | Dashboard | Auto-refresh ✅ **حل شده** (`pollingIntervalMs`)؛ Period Comparison ✅ **رفع شد** (فاز ۳۹ — `comparisonSeries` در `bindingChartEngine.ts`) | 🟡 متوسط | مستقل |
| 30 | File Upload عمیق‌تر (multi-file, progress, preview) | Form | ❌ باز (تأیید شد: فقط ۲ فیلد `accept`/`multiple`) | 🟢 پایین-متوسط | مستقل |

**آیتم‌های تدقیق‌شده (فقط دامنه محدودتر شد، هنوز به کاری نیاز دارند):**
- **#3 / #12 (Expression Sandbox + Calculated Fields):** ✅ رفع شد — فاز ۴۷ (`formulaBindingExpressionPhase47Fix.test.ts`)؛ `sourceType: 'formula'` + Monaco؛ `runScript` Dynamic Action آگاهانه خارج از دامنه ماند.
- **#5 (Export CSV/Excel/PDF):** ✅ رفع شد — فاز ۴۸ (`dataExportPhase48Fix.test.tsx`)؛ CSV client-side از filtered/sorted rows؛ xlsx/pdf via `POST /api/component-designer/export`.
- **#19 (A11y Diagnostics):** ✅ رفع شد — فاز ۵۰ (`accessibilityAuditingPhase50Fix.test.tsx`)
- **#1 (triggerWorkflow):** ✅ رفع شد — فاز ۵۱ (`triggerWorkflowAndCsvImportPhase51Fix.test.ts`)
- **#23 (CSV/Excel → Data Source):** ✅ رفع شد — فاز ۵۱ (`triggerWorkflowAndCsvImportPhase51Fix.test.ts` / `xlsxImportPhase51Fix.test.ts`)
- **#31 (Data Connectivity بخش ۱۸.۱):** REST خارجی / GraphQL / static-file ✅ رفع شد — فاز ۴۶ (`dataConnectorsPhase46Fix.test.ts`)؛ Postgres/Mongo/Sheets عمداً deferred.
- **#32 (Real-time/WebSocket بخش ۱۸.۲):** Polling ✅ از قبل هست؛ SSE/WebSocket واقعی ✅ **رفع شد** — فاز ۵۵ (`livePushBindingPhase55Fix.test.tsx`).
- **#28 (AI App Scaffold):** ✅ رفع شد — فاز ۵۶ (`draftApplicationScaffoldPhase56Fix.test.ts`)؛ `draft_application_scaffold` = orchestration روی `draft_component_layout` + Shell + menuEntry؛ بدون مسیر تولید سند موازی.
- **#33 (Session Context بخش ۱۸.۳):** Principal برای access-control (`ManagedFunctionAccessPrincipal`) ✅ از قبل هست؛ `sourceType: 'session'` عمومی قابل‌bind ✅ رفع شد — فاز ۲۵ (`sessionBindingCurrentUserRowPhase25Fix.test.ts`).

---

## 16. نقشه‌راه پیشنهادی

برای اینکه با کمترین ریسک به «کامل بودن واقعی» برسید، پیشنهاد توالی زیر است (نه بر اساس شماره جدول، بلکه بر اساس **وابستگی فنی**):

### فاز 1 — پایه‌های مشترک (چون همه‌چیز دیگر روی این‌هاست)
1. **#2 Document/App Variables** — چون فرم چندمرحله‌ای، فیلتر داشبورد، و فرمول همگی به آن نیاز دارند.
2. **#3 Expression/Script Sandbox** — پایه فرمول، شرط چندگانه، و Dynamic Action سفارشی.
3. **#9 Responsive per-breakpoint props** — یک تغییر ساختاری در مدل داده که هرچه دیرتر انجام شود، migration سنگین‌تر می‌شود.

### فاز 2 — تکمیل Form Builder
4. #7 Conditional Branching، #6 Multi-step Wizard، #8 Validation Engine، #14 CAPTCHA، #10 Payment، #11 Signature.

### فاز 3 — تکمیل Dashboard Builder
5. #4 Global Filter/Cross-filter، #5 Export، #29 Auto-refresh/Comparison.

### فاز 4 — ~~Automation~~ (منحل شد — خارج از محدوده)
6. ~~#1 Workflow Engine~~ و ~~#24 Scheduled Report~~ از این نقشه‌راه حذف شدند (فیچر جداگانه Workflow شما مسئول آن‌هاست). تنها کار باقی‌مانده یک Dynamic Action سبک `triggerWorkflow` است که می‌تواند همراه فاز ۲ (Form) پیاده‌سازی شود، نه یک فاز جدا.

### فاز 5 — Design System و Extensibility
7. #15 Design Tokens، #16 Component Variants، #18 Custom Element Import، #17 Animation.

### فاز 6 — Governance/Quality/AI
8. #19 A11y Diagnostics، #20/21/22 Collaboration/Audit/RBAC، #28 AI App Scaffold.

### فاز 7 — Nice-to-have
9. #23 CSV Import، #26 PWA، #27 Native (فقط در صورت نیاز کسب‌وکاری صریح).

---

## 17. چک‌لیست پذیرش نهایی

فیچر را وقتی می‌توان **«کامل»** اعلام کرد که کاربر بتواند بدون خروج از Client Components موارد زیر را بسازد و این سند به‌روزرسانی/تیک بخورد:

- [ ] یک **فرم استخدامی 5 مرحله‌ای** با شاخه‌بندی سوالات، اعتبارسنجی، آپلود رزومه چندفایلی (نیازمند #2, #6, #7, #8) — و اگر «ایمیل خودکار تایید بعد از ثبت» هم بخواهید، آن قسمت توسط فیچر Workflow جداگانه شما انجام می‌شود؛ Client Components فقط با یک Dynamic Action سبک `triggerWorkflow` آن را صدا می‌زند
- [ ] یک **داشبورد فروش** با فیلتر تاریخ سراسری، کلیک روی نمودار برای فیلتر جدول، و دکمه Export Excel (نیازمند #4, #5, #29) — «گزارش هفتگی ایمیلی» هم به فیچر Workflow واگذار می‌شود
- [ ] یک **پرتال مشتری کامل** (چند صفحه + Shell + منو) با تم برند اختصاصی (رنگ/فونت) که فقط از یک پرامپت AI اسکلت اولیه‌اش ساخته شود (نیازمند #15, #16, #28)
- [ ] یک **فرم پرداخت آنلاین** با درگاه واقعی و امضای دیجیتال برای تایید قرارداد (نیازمند #10, #11)
- [x] یک **کامپوننت خیلی خاص دامنه** (مثلاً نقشه GIS یا ادیتور فرمول مالی) که در 123 المنت موجود نیست، توسط توسعه‌دهنده import شود و در Toolbox مثل بقیه استفاده شود (نیازمند #18 — ✅ فاز ۵۷)
- [x] ابزار Accessibility Auditing در Diagnostics آماده است (فاز ۵۰ / #19 — `accessibilityAuditingPhase50Fix.test.tsx`)
- [ ] تمام صفحات ساخته‌شده از نظر Accessibility بدون خطای بحرانی در Diagnostics باشند (ابزار #19 آماده است؛ پاک‌سازی محتوای صفحات جداست)

- [ ] دو طراح هم‌زمان بدون overwrite کردن کار یکدیگر روی یک draft کار کنند (حداقل نسخه نرم؛ نیازمند #20/#25 نسخه سبک)

وقتی همه این سناریوها بدون خروج از Client Components و بدون نوشتن کد دستی امکان‌پذیر باشند، ادعای **«با این فیچر می‌توان هر صفحه، هر اپلیکیشن، هر گزارش و هر داشبوردی ساخت»** واقعاً درست خواهد بود.

---

## 18. پاسخ صریح — آیا بعد از این تغییرات واقعاً «هرچیزی» قابل ساخت است؟

> این بخش در پاسخ به سؤال مستقیم شما اضافه شد: *«آیا با تغییراتی که گفتی، این دیزاینر همه صفحه/چارت/گزارش/داده‌ای را نشان می‌دهد و می‌شود هرچیزی ساخت؟»*

**پاسخ صادقانه: نه هنوز.** حتی بعد از پیاده‌سازی کامل ۳۰ مورد بالا و همه اصلاحات سند element-level (`client-components-per-element-gap-analysis-fa.md`)، **۳ شکاف معماری دیگر** باقی می‌ماند که در بررسی اول دیده نشده بود و بعد از بررسی دقیق‌تر و سرچ اضافه پیدا شد. این‌ها زیر همراه راه‌حل به سند اضافه شدند (شماره‌گذاری ادامه جدول بخش ۱۵):

### 18.1 شکاف #31 — لایه اتصال داده محدود به یک نوع API (Data Connectivity)

**بررسی دقیق:** در کل معماری (`DataSourceDefinition`)، فقط یک ساختار دیده می‌شود: `{ endpoint, operations: {list,detail,create,update,delete}, responseMapping }` — یعنی **همه بایندینگ‌ها فرض می‌کنند یک REST endpoint یکسان (بک‌اند AppEndO خودتان) وجود دارد.**

**مشکل برای ادعای «هرچیزی»:** اگر کاربر بخواهد مستقیماً به یک دیتابیس خارجی (Postgres/MongoDB مشتری)، یک GraphQL API، یک سرویس SaaS خارجی (Stripe/HubSpot/Google Sheets)، یا یک فایل استاتیک (CSV/JSON) وصل شود — **راهی در معماری فعلی دیده نمی‌شود**، مگر این‌که اول یک آداپتور دستی در بک‌اند خودتان بنویسید که آن API را به فرمت REST داخلی‌تان wrap کند. این یعنی «هر داده‌ای» فقط با **واسطه توسعه‌دهنده بک‌اند** ممکن است، نه مستقیماً از خود Studio — که با ادعای یک App Builder کامل (مثل Retool که به ۵۰+ منبع داده مستقیم وصل می‌شود) فاصله دارد.

**راه‌حل دقیق:**
- `DataSourceDefinition.kind` را از `'collection' | 'record' | 'lov' | 'custom'` گسترش دهید به شمول یک زیرساخت **Connector Plugin** در سمت سرور: `connectorType: 'internal-api' | 'rest-external' | 'graphql' | 'postgres' | 'mongodb' | 'google-sheets' | 'static-file'`.
- برای هرکدام یک آداپتور استاندارد در `src/server/domain/component-designer/connectors/` تعریف کنید که خروجی یکسان (`{data, total}`) برگرداند — همان‌طور که `responseMapping` فعلی‌تان `dataPath/arrayPath/totalPath` را دارد؛ فقط منبع ورودی را عمومی کنید.
- یک Dialog جدید در سطح Catalog: `DataConnectorManagerDialog` — «اتصالات» را یک‌بار در سطح Workspace تعریف کنید (شبیه Asset Manager)، بعد در هر `BindingFormWizardDialog`/`BindingGridWizardDialog` از این اتصالات به‌جای تایپ مستقیم endpoint انتخاب کنید.
- این تغییر **بزرگ‌ترین اثر را در «امکان ساخت هرچیزی» دارد** چون همه ۳۰ مورد قبلی روی این فرض بنا شده‌اند که «یک API قابل‌دسترس داریم» — اگر داده اصلاً از این مسیر قابل‌وصل نباشد، بقیه قابلیت‌ها بی‌فایده‌اند.

> **✅ رفع شد — فاز ۴۶:** `connectorType?: 'internal-api' | 'rest-external' | 'graphql' | 'static-file'` (پیش‌فرض `internal-api`؛ DB مستقیم عمداً deferred)؛ آداپتورهای سرور + پروکسی SSRF-safe؛ `DataConnectorManagerDialog`؛ انتخاب connector در Binding wizards. تست: `dataConnectorsPhase46Fix.test.ts` (domain + `connectors/__tests__`). Postgres/Mongo/Sheets در فازی جدا با تحلیل امنیتی.

### 18.2 شکاف #32 — نبود Real-time / Live Data Binding (WebSocket, SSE, Polling)

**بررسی دقیق:** در کل سیستم Binding (`sourceType: static, expression, apiRef, store, regionColumn`) هیچ مقداری برای **جریان داده زنده** دیده نشد. هر بایندینگ یا یک‌بار در load اجرا می‌شود، یا با یک Dynamic Action (`refreshDataSource`) دستی رفرش می‌شود.

**نکته مهم — این ضعف در خود صنعت هم رایج است:** حتی Retool (رهبر بازار در ۲۰۲۶) به‌صورت بومی WebSocket ندارد و کاربران مجبورند با یک JavaScript Query دستی و import کتابخانه، آن را hack کنند. یعنی اگر شما این را **به‌صورت بومی و از طریق UI** (بدون کد) حل کنید، از Retool هم جلوتر می‌افتید — این دقیقاً همان «نواقص ابزارهای دیگر که باید پوشش بدید» است.

> **⚠️ تدقیق (نسخه ۴):** بخش `polling` این راه‌حل **از قبل پیاده‌سازی شده** — `DataSourceDefinition.pollingIntervalMs` (`types.ts:193`) دقیقاً همین «تایمر خودکار به‌جای Dynamic Action دستی» است و در Inspector/Preview/Export کار می‌کند (نگاه کنید اصلاح بخش‌های ۲.۴/۴ بالا). شکاف واقعی باقی‌مانده **فقط SSE/WebSocket (push واقعی)** است، نه polling.

**راه‌حل دقیق (بازبینی‌شده):**
- `DataSourceDefinition` یک فیلد جدید بگیرد: `liveMode: { type: 'none' | 'sse' | 'websocket', channel? }` (مقدار `'polling'` دیگر لازم نیست چون `pollingIntervalMs` موجود همان نقش را ایفا می‌کند).
- ~~برای polling: از زیرساخت موجود refreshDataSource استفاده کنید~~ *(منسوخ — polling از قبل حل شده)*
- برای `sse`/`websocket`: یک لایه جدید در Runtime (`useLiveDataSource` هوک) که به یک endpoint خاص وصل شود و نتیجه را مستقیم در `gridListResource`/`chartDataResource`/`store` بنویسد — این برای «داشبورد فروش زنده»، «چت»، «اعلان بلادرنگ» ضروری است.
- این مستقیماً به المنت‌های جدید بخش 18.4 (Notification Bell, Chat) وابسته است.

> **✅ رفع شد — فاز ۵۵:** `DataSourceDefinition.liveMode` (`none`/`sse`/`websocket` + `channel`) در `types.ts` / `sanitizeDataSourceDefinition`؛ هوک `useLiveDataSource` + `subscribeLiveDataSource` در `liveDataSource.ts` (اتصال مرورگر مستقیم به `{endpoint}/stream` — بدون fan-out روی Node Live Runtime)؛ Preview در `designerRuntimePreview.tsx`؛ Export در `bindingApiCodegen.ts`/`bindingCodegen.ts`؛ Inspector (Live Mode / Channel)؛ `heroui.chat-widget` از stub به ویجت زنده ارتقا یافت. تست: `livePushBindingPhase55Fix.test.tsx`.

### 18.3 شکاف #33 — نبود مفهوم «کاربر جاری / Session Context» در Binding

**بررسی دقیق:** هیچ‌جا در `sourceType`ها یا در Binding Registry یک منبع ثابت برای «اطلاعات کاربر لاگین‌کرده فعلی» (`currentUser.id`, `currentUser.role`, `currentUser.name`) دیده نشد. برای شخصی‌سازی صفحه («سلام {نام کاربر}»)، برای فیلتر خودکار «فقط رکوردهای من»، یا برای شرط دسترسی سطح-node (که `set-node-visibility-access` از قبل دارید) — این‌ها همگی به یک منبع session نیاز دارند.

**راه‌حل دقیق:** یک `sourceType` جدید: `session` (کنار `static, expression, apiRef, store, regionColumn`) که به یک شیء ثابت `currentSession: { userId, role, displayName, locale, tenantId, ... }` که سرور در زمان رندر published page تزریق می‌کند، bind شود.

> **⚠️ تدقیق (نسخه ۴):** شکاف واقعی محدودتر از ادعای اولیه است. یک مکانیزم پایه‌ای از قبل وجود دارد که سند از قلم انداخته بود: `visibilityConditionEngine.ts` دارای `ManagedFunctionAccessPrincipal` (`inferPrincipalFromDesignerStore`, `designerStoreWithAccessPrincipal`, خطوط ۳۲-۱۱۲) است که هویت کاربر جاری (userId/email/role) را به‌صورت **ambient** داخل `designerStore` تزریق می‌کند تا عبارت‌های Visibility/Row-Disable بتوانند بر اساس کاربر لاگین‌شده تصمیم بگیرند (مثلاً `store.user.id === row.id` از نظر فنی همین الان کار می‌کند). آنچه واقعاً غایب است: (۱) این principal فقط برای access-control/expression در دسترس است، نه یک `sourceType` رسمی قابل‌bind به هر prop دلخواه (مثل نمایش «سلام {نام کاربر}» در یک Text)، و (۲) هیچ preset/UI کلیکی برای استفاده از آن نیست — فقط با نوشتن expression خام. این دقیقاً همان چیزی است که تحلیل عمیق صفحه Users (بخش ۲۰ همین سند) هم به‌عنوان یک نیاز واقعی و پرتکرار تأیید کرد.

> **✅ رفع شد — فاز ۲۵:** `sourceType: 'session'` + `sessionField` (`userId`/`email`/`role`/`displayName`) در `types.ts` / `bindingSessionEngine.ts`؛ Resolve در Canvas/Preview/Export روی همان `designerStore.user.*`؛ preset عمومی `current-user-row` در `designerGridRowDisableRules.ts`. تست: `sessionBindingCurrentUserRowPhase25Fix.test.ts`.

---

### 18.4 المنت‌های کاملاً غایب که باید اضافه شوند

بعد از تحلیل element-by-element (سند دوم)، این‌ها دسته‌های **کاملاً غایب از ۱۲۳ المنت** بودند (تایید شده با جست‌وجوی مستقیم در کل متن هر دو فایل — هیچ نتیجه‌ای برای map/نقشه، video/audio، QR/barcode، command palette، notification یافت نشد):

| دسته غایب | چرا حیاتی است | مرجع صنعت |
|-----------|----------------|-----------|
| **Map / Geo Visualization** | بدون این، هیچ داشبورد مبتنی بر موقعیت (فروش منطقه‌ای، ردیابی ناوگان، پوشش جغرافیایی) قابل‌ساخت نیست | ECharts/ nivo دارای Map series بومی هستند — ✅ فاز ۵۲ |
| **Media Player (Video/Audio)** | `content.split-media` فقط `mediaSrc` خام دارد، نه یک پلیر واقعی با کنترل‌ها (play/pause/seek/volume/caption) | ✅ رفع شد — فاز ۵۳ (`content.video-player` / `content.audio-player` + `mediaType` روی split-media؛ تست: `mediaQrPlatformChromePhase53Fix.test.tsx`) |
| **QR Code / Barcode Generator** | برای بلیط، پرداخت، ردیابی موجودی، احراز هویت دو‌مرحله‌ای پرکاربرد است | ✅ رفع شد — فاز ۵۳ (`content.qr-code` / `content.barcode`؛ تست: `mediaQrPlatformChromePhase53Fix.test.tsx`) |
| **Global Search / Command Palette (⌘K)** | الگوی استاندارد ناوبری سریع در همه اپ‌های مدرن ادمین (Linear, Notion, Retool) | ✅ رفع شد — فاز ۵۳ (`platform-navigation.command-palette`) |
| **Notification Bell / Center** | برای اعلان‌های داخل‌برنامه‌ای (نه فقط toast لحظه‌ای) — وابسته به شکاف #32 (Real-time) | ✅ رفع شد — فاز ۵۳ (UI) + فاز ۵۵ (live push روی Data Source) |
| **User/Account Menu (Avatar Dropdown)** | نمایش نام/آواتار/خروج کاربر جاری — وابسته به شکاف #33 (Session Context) | ✅ رفع شد — فاز ۵۳ (`platform-navigation.user-menu`) |
| **Chat / Messaging Widget** | برای پشتیبانی زنده یا چت داخلی تیمی — وابسته به شکاف #32 | ✅ رفع شد — فاز ۵۳ + فاز ۵۵ (`DesignerChatWidget` با liveUrl/liveType) |

**راه‌حل:** این‌ها به دسته‌های موجود اضافه شوند: Map به «Data Visualization» (سند دوم را ببینید برای گسترش این دسته)، Media Player و QR/Barcode به «Content & Media»، Command Palette/Notification Bell/User Menu به «HeroUI Navigation and Overlays» یا به Dynamic Platform Palette (`platform-navigation`) که از قبل معماری‌اش برای موارد سراسری پلتفرم آماده است.

> **✅ رفع شد — فاز ۵۳:** Media Player / QR / Barcode / Command Palette / Notification Bell / User Menu پیاده‌سازی شدند؛ Chat به‌صورت stub تا فاز ۵۵. تست: `mediaQrPlatformChromePhase53Fix.test.tsx`.

**جزئیات کامل props پیشنهادی هرکدام در سند element-level (`client-components-per-element-gap-analysis-fa.md`، بخش جدید ۱۵) اضافه شده است.**

### 18.5 شکاف بزرگ در تنوع نوع چارت (تایید شده با سرچ)

سرچ روی ECharts/Recharts/Nivo نشان داد کتابخانه‌های مرجع صنعت این نوع چارت‌ها را دارند: **Scatter, Radar, Heatmap, Funnel, Waterfall, Treemap, Sankey, Candlestick/OHLC, Boxplot, Sunburst, Gauge واقعی، Map/Choropleth.** فیچر شما در دسته Data Visualization (۱۲ آیتم) تنها **۴ نوع چارت واقعی** دارد (Bar, Line, Pie/Donut, Sparkline) — بقیه (Tree/Cascader/Timeline/Gantt/Sheet/Kanban) چارت به‌معنای آماری نیستند. جزئیات کامل در سند element-level بخش جدید ۱۵ اضافه شد.

> **✅ رفع شد — فاز ۵۲:** المنت واحد `viz.chart` با `chartType` برای ۹ نوع آماری پیشرفته (scatter/radar/heatmap/funnel/waterfall/treemap/sankey/candlestick/boxplot) + دو المنت `viz.map-pin` / `viz.map-choropleth` (OpenStreetMap/Leaflet، Mapbox اختیاری) اضافه شد. چهار چارت کلاسیک bar/line/pie/sparkline دست‌نخورده ماندند. تست: `advancedChartsMapGeoPhase52Fix.test.tsx`.

---

### 18.6 چک‌لیست نهایی — نسخه تکمیل‌شده

علاوه بر ۷ سناریوی چک‌لیست بخش ۱۷، این سناریوها هم باید ممکن باشند تا ادعای «هرچیزی» واقعاً درست باشد:

- [x] یک **داشبورد فروش منطقه‌ای روی نقشه ایران** با رنگ‌بندی استان‌ها بر اساس فروش (نیازمند #31، #34 Map) — ✅ فاز ۵۲ (`viz.map-choropleth` / `viz.map-pin`)
- [x] یک **پنل مانیتورینگ زنده** (سفارش‌های ورودی لحظه‌ای بدون رفرش دستی صفحه) (نیازمند #32 Real-time) — ✅ فاز ۵۵ (`liveMode` + `useLiveDataSource`)
- [ ] یک **صفحه پروفایل کاربر** با «سلام {نام}» و لیست «فقط سفارش‌های خودم» (نیازمند #33 Session Context)
- [x] یک **گزارش مالی** با نمودار Waterfall (تغییرات سود) و نمودار Candlestick (نوسان قیمت سهام) (نیازمند #35 چارت‌های پیشرفته) — ✅ فاز ۵۲ (`viz.chart` + chartType)
- [x] یک **پنل ادمین با ⌘K Command Palette** برای پرش سریع بین صفحات (نیازمند #34 Command Palette) — ✅ فاز ۵۳ (`platform-navigation.command-palette`)
- [x] اتصال مستقیم یک منبع داده **خارج از بک‌اند AppEndO** (مثلاً یک API عمومی / GraphQL / فایل استاتیک) بدون نیاز به نوشتن آداپتور بک‌اند سفارشی — ✅ فاز ۴۶ (Google Sheets/DB مستقیم هنوز deferred)

### 18.7 نکته پایانی درباره نواقص ابزارهای دیگر که نباید تکرار شوند

طبق سرچ‌های این بررسی و بررسی قبلی، این‌ها **ضعف‌های شناخته‌شده رقبا در ۲۰۲۶** هستند — توصیه می‌شود در طراحی راه‌حل‌های بالا **عمداً** از این اشتباهات پرهیز شود:

| ابزار | ضعف شناخته‌شده (طبق سرچ) | توصیه برای شما |
|-------|---------------------------|-----------------|
| Retool | فاقد WebSocket بومی؛ کاربران باید با JS دستی hack کنند؛ Real-time collaboration «occasional conflicts» دارد؛ چارت‌های پیشرفته محدود («Advanced charting is decent but limited») | WebSocket را بومی (#32) و کتابخانه چارت را کامل (#35) بسازید — این مستقیماً برتری رقابتی می‌دهد |
| Bubble.io | با concurrency بالا (real-time زیاد، هم‌زمانی زیاد) مشکل دارد؛ خروجی runtime proprietary (نه کد قابل‌مالکیت) | چون خروجی شما از قبل TSX واقعی است، این مشکل را از پایه ندارید — فقط مراقب باشید معماری Real-time (#32) با معماری «Live Runtime تک Node instance» فعلی‌تان (طبق §1.5 سند اول) از نظر مقیاس‌پذیری هم‌خوان بماند |
| Budibase | Version control بسیار محدود (بدون Git، بدون diff واقعی) | شما از قبل rollback/publish-diff دارید — فقط طبق سند اول (#20/21) Audit Log کامل را هم اضافه کنید تا از Budibase و حتی از Appsmith (که Git دارد ولی رابط پیچیده‌تری دارد) جلوتر باشید |
| Webflow | فاقد A/B testing بومی (باید Optimizely را لایه کنید) | اگر «صفحه لندینگ»/مارکتینگ هم هدف شماست، A/B testing واقعی (assignment/statistics) بهتر است به فیچر Workflow جداگانه شما واگذار شود؛ Client Components فقط باید بتواند بر اساس یک Document Variable (بخش ۲.۲) رندر متفاوت نشان دهد |
| همه (Retool/Bubble/Budibase) | هیچ‌کدام native Multi-Database + GraphQL + Real-time + کد قابل‌مالکیت را **هم‌زمان** ندارند — هرکدام یکی‌دو مورد را دارند نه همه | اگر #31 (Data Connectivity) + #32 (Real-time) را با معماری TSX-native فعلی‌تان ترکیب کنید، ترکیبی می‌سازید که **هیچ رقیبی امروز کامل ندارد** |

---

*این بخش (۱۸) در پاسخ به سؤال مستقیم کاربر «آیا با این تغییرات واقعاً می‌شود هرچیزی ساخت؟» اضافه شد؛ پاسخ این بود: با ۳۰ مورد قبلی به‌تنهایی **نه** — سه شکاف معماری دیگر (#31 اتصال داده، #32 Real-time، #33 Session Context) و چند دسته المنت کاملاً غایب (Map، Media Player، QR، Command Palette، Notification، چارت‌های پیشرفته) هم لازم بودند که اکنون به این سند اضافه شدند.*

---

## 19. بررسی عمیق و اصلاحی — دقت و کامل‌بودن Data Binding برای چارت‌ها، جدول‌ها و گزارش‌ها

> این بخش در پاسخ به سؤال مستقیم شما اضافه شد: *«می‌خوام data binding برای چارت‌ها و جدول‌ها دقیق و کامل باشه و بتونم تنظیمات رو دقیق اعمال کنم.»* برای این بررسی، **همه Wizard section های هر ۱۲۳ المنت** با اسکریپت استخراج و مقایسه شدند (نه فقط نمونه‌برداری) تا هیچ موردی جا نیفتد. نتیجه: سیستم Binding از نظر **معماری کلی** خوب طراحی شده، ولی از نظر **دقت مستندسازی/پیاده‌سازی per-widget-type** چند مشکل واقعی و جدی دارد که مستقیماً روی توانایی «تنظیم دقیق هر گزارش» اثر می‌گذارد.

### 19.1 مشکل #۱ (جدی) — Wizard چهار نوع چارت کاملاً یکسان مستند شده‌اند (بدون تمایز نوع)

> **✅ رفع شد (فاز ۳۷ — `chartFieldMappingPhase37Fix.test.tsx`):** `DesignerChartFieldMapping` الان discriminated union بر اساس `chartType` است (`bar|line` / `pie|donut|gauge` / `sparkline`)، ویزارد Step «Map fields» شرطی رندر می‌شود، Gauge از `gaugeMin`/`gaugeMax`/`gaugeThresholds` استفاده می‌کند، و `onDataPointClick` برای هر چهار نوع چارت در Event Matrix ثبت و در Canvas/Preview/Export سیم‌کشی شده. شکل قدیمی `{ categoryField, series }` همچنان migrate می‌شود.

با استخراج خودکار «### Wizard» هر ۴ چارت (`chart-bar`, `chart-line`, `chart-pie`, `chart-sparkline`) این خط **کلمه‌به‌کلمه یکسان** برای هر چهار تکرار شده:

```
Wizard: BindingChartWizardDialog — Connect → Field mapping → Filters → Done
Props: chartFieldMapping, chartToolbarConfig, seriesKeys, xAxisKey
```

**مشکل:** این چهار نوع چارت از نظر داده‌ای **کاملاً متفاوت‌اند**:
- `chart-pie` به یک `valueKey` (که در Properties هم واقعاً دارد) و یک `labelKey` نیاز دارد، نه `seriesKeys` چندتایی مثل bar/line.
- `chart-sparkline` به `showLegend`/`showGrid` اصلاً معنا ندارد (یک اسپارک‌لاین کوچک بدون محور و legend است) ولی همان Field Mapping عمومی برایش مستند شده.
- `chart-bar` با `grouped: true/false` نیاز به **چند سری هم‌زمان روی یک محور دسته‌بندی** دارد که با `chart-line` (که می‌تواند چند خط مستقل با محورهای متفاوت داشته باشد) قانون‌های نگاشت متفاوتی دارد.

این یعنی مستندسازی (و به‌احتمال بالا خود پیاده‌سازی wizard، چون مستندات از کد generate می‌شود طبق §13 سند اول) **از یک تمپلیت عمومی کپی شده و per-type تخصصی نشده است.**

**راه‌حل دقیق:** `chartFieldMapping` باید یک **discriminated union بر اساس نوع چارت** شود (نه یک شکل عمومی):

```typescript
type ChartFieldMapping =
  | { chartType: 'bar' | 'line'
      categoryField: string                                    // → xAxisKey
      valueFields: { field: string; label: string; color?: string; axis?: 'primary'|'secondary' }[]  // → seriesKeys، چندسری با محور اختیاری
      seriesGroupField?: string                                 // تبدیل ردیف‌های خام به سری‌های پویا (pivot) — مثلاً یک ستون "region" → هر مقدار یک سری شود
      sortBy?: { field: string; direction: 'asc'|'desc' }
      limitTopN?: { count: number; groupRestAsLabel: string }  // Top-N + "بقیه" }
  | { chartType: 'pie' | 'donut' | 'gauge'
      labelField: string
      valueField: string
      gaugeMin?: number; gaugeMax?: number; gaugeThresholds?: { value: number; color: string }[] }  // برای رفع باگ سند دوم ردیف ۱۱
  | { chartType: 'sparkline'
      valueField: string
      compareField?: string };  // برای نمایش روند نسبت به دوره قبل
```

### 19.2 مشکل #۲ — Wizard هر ۸ عنصر «Viz» — ✅ اصلاح: حل شده در کد فعلی

> **✅ اصلاح کامل (نسخه ۴ — بررسی کد واقعی):** این مشکل دیگر وجود ندارد. `src/domain/component-designer/visualizationDataTransform.ts` (خطوط ۱۰-۵۸) یک **discriminated union واقعی و مجزا به‌ازای هر نوع** پیاده‌سازی کرده: `DesignerVizTreeFieldMapping { idField, labelField, parentIdField? }` برای tree/cascader، `DesignerVizTimelineFieldMapping { titleField, startField, endField?, descriptionField?, progressField? }` برای timeline **و gantt** (با `progressField` مخصوص Gantt)، `DesignerVizKanbanFieldMapping { cardIdField, cardTitleField, cardDescriptionField?, cardColumnField, columnOrder? }`، و `DesignerVizSheetFieldMapping { columns: {header, field}[] }`. این دقیقاً معماری‌ای است که تحلیل زیر (بخش ادامه) به‌عنوان راه‌حل پیشنهاد می‌داد — دیگر لازم نیست پیاده‌سازی شود، فقط باید **کد Inspector هر ویجت واقعاً از این نوع‌های اختصاصی استفاده کند** (که طبق بررسی جدید، همین‌طور است). متن زیر (تحلیل اصلی) برای تاریخچه/شواهد نگه داشته شده، اما دیگر یک اقدام باز نیست.

~~### 19.2 مشکل #۲ (بحرانی) — Wizard هر ۸ عنصر «Viz» کاملاً یکسان مستند شده، با اینکه از نظر داده‌ای هیچ ربطی به هم ندارند~~

این یافته حتی جدی‌تر از مورد بالاست. `tree-view`, `tree-select`, `cascader`, `tree-combobox`, `timeline`, `gantt`, `sheet`, `kanban` — **هر ۸ تا** دقیقاً همین را دارند:

```
Wizard: BindingVizWizardDialog
Props: vizFieldMapping, vizToolbarConfig, data
```

حتی مستند خود یکی از آن‌ها (`viz.kanban`) با عبارت *«Kanban board MOCK/bound»* اشاره می‌کند که این المنت هنوز بین حالت داده mock و bind واقعی مشخص نیست.

**چرا این بحرانی است:** یک Gantt Chart نیاز به نگاشت `startDateField`, `endDateField`, `dependencyField`, `progressField` دارد. یک Kanban نیاز به `statusField` + نگاشت مقدار وضعیت به نام ستون دارد. یک Sheet نیاز به تعریف نوع هر ستون (متن/عدد/فرمول) دارد. یک Timeline نیاز به `dateField` + `laneField` دارد. **این چهار نیاز هیچ اشتراکی با هم ندارند**، ولی سند می‌گوید همه از یک `vizFieldMapping` عمومی استفاده می‌کنند — که یا این پراپرتی در عمل خالی/بی‌اثر است (یعنی این چهار المنت اصلاً field mapping واقعی ندارند، فقط `data` خام می‌گیرند)، یا مستندات به‌شدت ناقص است. **در هر دو حالت، این یعنی از Inspector نمی‌توان این المنت‌ها را به یک API واقعی با دقت وصل کرد** — دقیقاً برخلاف چیزی که شما خواستید.

**راه‌حل دقیق:** `vizFieldMapping` باید مثل بالا discriminated union شود:

```typescript
type VizFieldMapping =
  | { vizType: 'tree-view'|'tree-select'|'cascader'|'tree-combobox'
      idField: string; labelField: string
      parentIdField?: string          // برای داده flat با parent reference
      childrenField?: string          // برای داده nested (آرایه تودرتو)
      iconField?: string; lazyLoadChildrenEndpoint?: string }
  | { vizType: 'gantt'
      taskIdField: string; taskNameField: string
      startDateField: string; endDateField: string
      progressField?: string; dependencyField?: string          // آرایه ID تسک‌های پیش‌نیاز
      assigneeField?: string; milestoneFlagField?: string }
  | { vizType: 'kanban'
      cardIdField: string; titleField: string
      statusField: string
      statusToColumnMap: { statusValue: string; columnLabel: string; wipLimit?: number }[]
      swimlaneField?: string; orderField?: string
      onCardMoveAction: DynamicAction[] }               // برای ذخیره جابه‌جایی — رفع شکاف سند دوم بخش ۱۰.۲
  | { vizType: 'timeline'
      eventIdField: string; titleField: string; dateField: string
      laneField?: string; descriptionField?: string }
  | { vizType: 'sheet'
      columns: { field: string; label: string; type: 'text'|'number'|'select'|'formula'; formula?: string; validation?: string }[]
      onCellChangeAction: DynamicAction[] };
```

### 19.3 مشکل #۳ — ✅ اصلاح: این تناقض در کد فعلی وجود ندارد، قبلاً رفع شده

> **✅ اصلاح کامل (نسخه ۴ — بررسی کد واقعی):** این «تناقض» ادعای یک سند مرجع قدیمی‌تر بود که دیگر در ریپو موجود نیست؛ کد فعلی هیچ ابهامی ندارد. `resolveDataGridTotalCount`/`readResponseTotalCount` (`src/domain/component-designer/designerDataGridRuntime.ts:53-113`) نشان می‌دهد وقتی `gridQueryMode: 'server'` باشد، مقدار `total` واقعاً از `responseMapping.totalPath` پاسخ API خوانده می‌شود (نه literal ثابت)، و کدجن (`bindingCodegen.ts:1889-1960`) هم همین را با `readNestedContextValue(raw, totalPath)` تولید می‌کند. یک تست اختصاصی (`paginationPageTotalBindingFix.test.tsx`) دقیقاً همین باگ را قبلاً مستند و رفع کرده است. در حالت `client`-mode بدون API متصل، `page`/`total` به‌درستی literal طراحی می‌مانند (رفتار منطقی و مورد انتظار، نه باگ). راه‌حل پیشنهادی زیر (فلگ `runtimeOverridable`) دیگر لازم نیست.

~~### 19.3 مشکل #۳ — تناقض در فلگ «Data Binding» روی خود پراپرتی‌های Grid~~

روی `heroui.data-grid` و `heroui.app-table-grid`، پراپرتی‌های `page` و `total` **هر دو** این را دارند:

```
Data Binding: ❌ — فقط مقدار literal
```

ولی بلافاصله در خط «تحلیل» همان پراپرتی نوشته شده:

```
تحلیل: شماره صفحه فعلی (1-based). **Bindable** (pagination).
تحلیل: total records برای pagination. **Bindable**.
```

**این یک تناقض مستقیم در همان سند است** — یک خط می‌گوید بایند نمی‌شود، خط بعدی می‌گوید بایند می‌شود. برای کاربری که می‌خواهد «دقیق تنظیم کند»، این ابهام غیرقابل‌قبول است: آیا `page`/`total` را باید در Inspector دستی وارد کند (که در این صورت pagination واقعی کار نمی‌کند)، یا این‌ها به‌صورت خودکار توسط پاسخ API (`responseMapping.totalPath`) رونویسی می‌شوند در runtime؟

**راه‌حل دقیق:** این ابهام باید در سطح مدل داده حل شود، نه فقط مستندسازی: یک فلگ جدید در تعریف هر property به نام `runtimeOverridable: boolean` اضافه شود که صراحتاً بگوید «این مقدار literal فقط برای پیش‌نمایش Canvas است؛ وقتی node به یک dataSource بایند شود، این مقدار در Runtime به‌صورت خودکار از پاسخ API جایگزین می‌شود و دیگر توسط کاربر قابل‌ویرایش دستی نیست.» این باید در Inspector هم با یک نشانگر بصری («🔗 از API پر می‌شود») نمایش داده شود تا کاربر گیج نشود — این دقیقاً همان چیزی است که برای «دقیق اعمال کردن تنظیمات» لازم دارید.

### 19.4 مشکل #۴ (بحرانی برای گزارش‌سازی) — نبود کامل Aggregation / Group By / Subtotal / Pivot

جست‌وجوی مستقیم کلمات `aggregation`, `group by`, `pivot`, `summary row`, `totals row` در کل هر دو فایل (۱۷۹۲۶+ خط) **هیچ نتیجه‌ای نداشت.** یعنی در معماری فعلی، هیچ گریدی نمی‌تواند:
- ردیف‌ها را بر اساس یک ستون گروه‌بندی کند (مثلاً «فروش گروه‌بندی‌شده بر اساس استان»)
- یک ردیف Subtotal زیر هر گروه نشان دهد
- یک ردیف Grand Total در پایین جدول نشان دهد
- یک نمای Pivot Table بسازد (ردیف×ستون×مقدار تجمیعی — استاندارترین الگوی «گزارش مالی/فروش»)

**این بزرگ‌ترین شکاف باقی‌مانده برای ادعای «هر گزارشی» است** — چون تقریباً هر گزارش مدیریتی واقعی (فروش بر استان، هزینه بر دپارتمان، موجودی بر انبار) به Group By + Aggregation نیاز دارد، نه فقط یک لیست خام صفحه‌بندی‌شده.

**راه‌حل دقیق:** یک ساختار جدید `gridAggregationConfig` (به‌عنوان یک property جدید کنار `columns` در هر سه گرید، مخصوصاً `app-table-grid`):

```typescript
type GridAggregationConfig = {
  groupByFields?: string[];              // چند سطحی: مثلا ["region", "product"]
  aggregations: { field: string; fn: 'sum'|'avg'|'count'|'min'|'max'; label: string; format?: 'currency'|'percent'|'number' }[];
  showSubtotalPerGroup?: boolean;
  showGrandTotal?: boolean;
  collapsibleGroups?: boolean;           // گروه‌ها baز/بسته‌شدنی مثل Excel
  pivotMode?: { rowField: string; columnField: string; valueField: string; aggFn: 'sum'|'avg'|'count' };  // حالت Pivot کامل
};
```

سمت سرور: چون `gridQueryMode: 'server'` از قبل دارید، این تجمیع باید بتواند هم Client-side (روی داده صفحه فعلی) و هم Server-side (به‌صورت query param اضافه به API، مشابه الگوی `responseMapping` موجود) انجام شود.

### 19.5 مشکل #۵ — ✅ رفع شد: پشتیبانی «چند Data Source هم‌زمان روی یک چارت» (Combo Chart)

> **✅ رفع شد (فاز ۳۸):** `chartDataSources` prop (آرایه‌ی `{ dataSourceRef, fieldMapping }[]`) + `mergeMultiSourceChartData` در runtime/export. ویزارد Connect دکمه‌ی «Add another data source» دارد. تست: `comboChartMultiSourcePhase38Fix.test.ts`.

سیستم فعلی هر چارت را به **یک** `chartDataResource` وصل می‌کند. الگوی بسیار رایج گزارش‌سازی («نمودار ترکیبی» — ستون‌های فروش + خط نرخ رشد روی محور دوم، یا مقایسه دو دوره زمانی متفاوت از دو query جدا) با این معماری ممکن نیست.

**راه‌حل دقیق:** `chartDataResource` باید بتواند **آرایه‌ای از منابع** بگیرد (نه یک منبع تکی):

```typescript
chartDataResource: { dataSourceRef: string; fieldMapping: ChartFieldMapping }[]
```

و در Codegen (`bindingApiCodegen.ts`)، چند `useDataFetch` موازی اجرا و نتایج merge شوند.

### 19.6 مشکل #۶ — ✅ اصلاح: مرحله Filters کاملاً تعریف‌شده است

> **✅ اصلاح کامل (نسخه ۴ — بررسی کد واقعی):** این مرحله دیگر «جعبه سیاه» نیست. `src/domain/component-designer/designerChartToolbarConfig.ts` یک ساختار کاملاً تعریف‌شده دارد: `DesignerChartToolbarConfig { enabled, runtimeEnabled, search{enabled,placeholder,storePath,apiParam,debounceMs}, selectFilters[]{id,label,apiParam,storePath,options}, dateRange{fromApiParam,toApiParam,fromStorePath,toStorePath}, refresh{enabled} }` با توابع parse/normalize/serialize کامل، و `buildChartListQueryParamBindings` که این‌ها را واقعاً به query-param روی fetch متصل می‌کند. در `BindingChartWizardDialog.tsx` (خطوط ۳۸-۴۲, ۲۴۲-۲۵۱) این دقیقاً Step سوم است با کامپوننت اختصاصی `BindingChartFilterConfigStep`. راه‌حل پیشنهادی زیر دیگر لازم نیست — همان schema پیشنهادی تقریباً عیناً در کد موجود است.

~~### 19.6 مشکل #۶ — «Filters» در نام Wizard چارت (`Connect → Field mapping → Filters → Done`) هیچ‌جا تعریف نشده~~

این مرحله سوم در نام wizard چارت آمده ولی نه در Properties لیست‌شده (۹ فیلد `viz.chart-bar` هیچ فیلد فیلتری ندارد)، نه در جای دیگری از هر دو سند توضیح داده شده که این «Filters» به چه معناست: آیا این فیلترهای *ثابت* روی query (مثلاً `status=active`) است، یا کنترل‌های فیلتر *تعاملی* برای کاربر نهایی (مثل یک date-picker بالای چارت)؟

**راه‌حل دقیق:** این مرحله باید دقیقاً مستند/پیاده‌سازی شود به‌عنوان بخشی از `chartToolbarConfig`:

```typescript
type ChartToolbarConfig = {
  staticFilters?: { field: string; operator: 'eq'|'gt'|'lt'|'between'|'in'; value: any }[];   // فیلتر ثابت هنگام fetch
  interactiveFilters?: { field: string; label: string; type: 'select'|'dateRange'|'text'; paramName: string; bindToDocumentVariable?: string }[];  // کنترل قابل‌تغییر توسط کاربر نهایی — وابسته به شکاف #2 سند اول (Document Variables) و #4 (Global Filter Bar)
  showRefreshButton?: boolean;
  showExportImageButton?: boolean;
  refreshIntervalMs?: number;               // وابسته به #32 (Real-time)
};
```

### 19.7 جمع‌بندی این بخش — الزامات «دقیق و بدون‌نقص» برای Data Binding

برای این‌که سیستم Binding واقعاً «دقیق و کامل و بدون کم‌وکاست» شود (طبق درخواست شما)، این ۶ اصلاح **باید هم‌زمان** انجام شوند — انجام فقط بعضی از آن‌ها مشکل را نصفه حل می‌کند:

| # | اصلاح | وضعیت (نسخه ۴) | بدون آن چه اتفاقی می‌افتد |
|---|-------|:---:|------------------------------|
| 19.1 | Field Mapping type-specific برای چارت‌ها (bar/line/pie/sparkline) | ✅ رفع شد (فاز ۳۷ — `chartFieldMappingPhase37Fix.test.tsx`) | Discriminated `ChartFieldMapping` + wizard شرطی + Gauge واقعی + `onDataPointClick` |
| 19.2 | Field Mapping type-specific برای Viz (Gantt/Kanban/Sheet/Timeline/Tree) | ✅ حل شده (`visualizationDataTransform.ts`) | — |
| 19.3 | رفع تناقض `runtimeOverridable` در Grid | ✅ حل شده (`designerDataGridRuntime.ts` + تست `paginationPageTotalBindingFix.test.tsx`) | — |
| 19.4 | Aggregation/GroupBy/Pivot | ✅ رفع شد (فاز ۳۶ — `designerGridAggregation.ts` + `gridAggregationPhase36Fix.test.tsx`) | — |
| 19.5 | Combo Chart (چند dataSource) | ✅ رفع شد (فاز ۳۸ — `comboChartMultiSourcePhase38Fix.test.ts`) | — |
| 19.6 | تعریف دقیق `Filters` step چارت | ✅ حل شده (`designerChartToolbarConfig.ts` + `BindingChartFilterConfigStep`) | — |

**نتیجه‌ی نسخه ۴:** از ۶ مورد، **۴ مورد (۱۹.۲، ۱۹.۳، ۱۹.۵، ۱۹.۶) از قبل در کد فعلی حل شده‌اند** یا در فازهای ۳۶–۳۸ رفع شدند. تنها ۲ مورد باقی‌مانده که واقعاً باید ساخته شوند: **۱۹.۱ (Field Mapping type-specific چارت‌ها — ✅ فاز ۳۷)** و **۱۹.۴ (Aggregation/GroupBy/Pivot — ✅ فاز ۳۶)** — هر سه gap اصلی Data Binding اکنون بسته شده‌اند.

با اعمال این ۶ مورد (که مستقیماً روی معماری `DesignerBindingDefinition`، `chartDataResource`, `vizDataResource`, `gridListResource` سوار می‌شوند و نیاز به بازنویسی معماری کلی ندارند)، سیستم Binding به نقطه‌ای می‌رسد که هر چارت، هر گزارش تجمیعی، و هر ویجت پیشرفته (Gantt/Kanban/Sheet) با **دقت کامل و بدون ابهام** از Inspector قابل‌تنظیم خواهد بود.

---

## 20. نسخه ۴ — بازبینی کامل با کد واقعی + یافته‌های عمیق صفحه Users

> این بخش نتیجه‌ی یک بازبینی مستقل (۴ ایجنت تحقیقاتی موازی، هرکدام مستقیماً روی کد فعلی مخزن، نه روی اسناد مرجع) است که برای پاسخ به دو درخواست جدید کاربر انجام شد: (۱) آیا خودِ این سند درست است؟ (۲) صفحه واقعی Users چه قابلیت‌هایی از Designer می‌خواهد که فعلاً غایب است؟

### 20.1 خلاصه‌ی نتایج بازبینی صحت این سند

از ۳۵ گپ اصلی + ۶ مورد بخش ۱۹ (جمعاً ۴۱ ادعا)، نتیجه:

| نتیجه | تعداد | موارد |
|---|:---:|---|
| ✅ ادعای سند نادرست بود — قابلیت از قبل کامل در کد وجود دارد | ۶ | #2 (Document Variables)، #9 (Responsive breakpoints)، #26 (PWA)، §19.2 (Viz field mapping)، §19.3 (Grid page/total)، §19.6 (Chart Filters step) |
| ⚠️ ادعا نیمه‌درست بود — بخشی حل شده، دامنه باید محدودتر شود | ۵ | #1 (triggerWorkflow — فقط اتصال به موتور Workflow موجود لازم است)، #4/#29 (auto-refresh حل شده، فقط cross-filter/comparison باز است)، #7 (موتور expression قوی هست، فقط UI ساختاریافته نیست)، #32 (polling حل شده، فقط WS/SSE باز است)، #33 (principal دسترسی بود؛ `sourceType: 'session'` در فاز ۲۵ اضافه شد ✅) |
| ❌ ادعا کاملاً تأیید شد — گپ واقعی و بدون تغییر | ۳۰ | همه‌ی موارد باقی‌مانده (جدول بخش ۱۵ به‌روزرسانی شد) |

**نتیجه‌گیری کلی:** معماری زیرین شما (Store Segments، Responsive Breakpoints، Polling، Expression Engine، Viz Field Mapping، Chart Toolbar، PWA) **قوی‌تر از چیزی است که این سند در ابتدا تشخیص داده بود** — چون این سند بر پایه‌ی دو فایل مرجع نوشته شده بود که خودشان یک اسنپ‌شات، نه کد زنده، بودند. این خبر خوبی است: تعداد واقعی «کار باقی‌مانده» کمتر از تصور اولیه است.

### 20.2 یافته‌های تکمیلی — تحلیل عمیق صفحه واقعی Users در برابر Designer

طبق درخواست کاربر، صفحه واقعی و کاملاً دستی‌نویس Users (`src/features/users/` — همه‌ی ~۲۵ فایل) خط‌به‌خط خوانده و هر رفتارش (ستون‌های گرید، نوار ابزار، اکشن‌های ردیف، مودال‌ها، قواعد دسترسی) با قابلیت‌های فعلی Designer تطبیق داده شد تا مشخص شود دقیقاً چه چیزی کم است تا این صفحه با کلیک/ویزارد در Designer قابل‌بازسازی ۱۰۰٪ باشد (بدون هیچ‌چیز جاافتاده). نتیجه در ادامه — این‌ها **علاوه بر** ۳۰ گپ تأییدشده‌ی بالا هستند (بعضی هم‌پوشانی دارند که مشخص شده):

| # | قابلیت موردنیاز | هم‌پوشانی با گپ‌های بالا | چرا لازم است (شاهد از کد واقعی Users) |
|---|---|---|---|
| U1 | Dynamic Action برای فراخوانی یک Endpoint دلخواه **غیر-CRUD** با زنجیره موفقیت کامل (toast→close→refresh) | ✅ **رفع شد** — فاز ۲۴ (`21-DESIGNER-BUGFIX-EXECUTION-PHASES.md`)؛ تست: `customNamedRestOperationsPhase24Fix.test.ts` | `operations.custom` + `resolveCallMutationOperation`؛ `callMutation.mutationOperation` می‌تواند کلید نام‌گذاری‌شده (مثل `resetPassword`) باشد و همان زنجیره موفقیت create/update/delete را حفظ می‌کند |
| U2 | Action Type برای عملیات اپلیکیشنی خاص (session-swap + redirect) | ✅ **بسته شد** — فاز ۳۲.۱ گزینه الف (بدون کد جدید)؛ manual event binding موجود کافی است | `Login As` — تعویض session کاربر جاری + navigate؛ مکانیزم `InspectorEventBindingPanel` موجود برای وایر کردن endpoint session-swap کافی تشخیص داده شد |
| U3 | گسترش Auto CRUD Page Builder از ۳ اسلات ثابت (`{create,edit,delete}`) به N اسلات دلخواه | ✅ **رفع شد** — فاز ۲۹؛ تست: `autoCrudPageCustomActionsPhase29Fix.test.ts` | Users به ۷ اکشن ردیف نیاز دارد — `actions.custom[]` با `modalKind: form|confirm` همان الگوی Edit/Delete را پارامتری تکرار می‌کند |
| U4 | مکانیزم واقعی Multi-step Wizard Form | = گپ #6 | `UserCreateWizardModal.tsx` سه مرحله‌ای (Membership→Profile→Roles) با gating اعتبارسنجی هر مرحله دارد؛ `content.stepper` تزئینی این را پوشش نمی‌دهد |
| U5 | Preset عمومی «غیرفعال‌کردن اکشن وقتی ردیف = کاربر جاری» (نه هارد‌کد `users-*`) | ✅ **رفع شد** — فاز ۲۵؛ تست: `sessionBindingCurrentUserRowPhase25Fix.test.ts` | preset `current-user-row` + `matchField` در `designerGridRowDisableRules.ts` (بدون ارجاع به Entity «users») |
| U6 | `sourceType` رسمی برای کاربر جاری (نه فقط principal ambient در expression) | ✅ **رفع شد** — فاز ۲۵ / تدقیق #33؛ تست: `sessionBindingCurrentUserRowPhase25Fix.test.ts` | `sourceType: 'session'` + `sessionField`؛ Inspector «Current session»؛ Resolve روی `designerStore.user.*` |
| U7 | عنصر «Roles Assignment» (چک‌باکس‌گروه چندانتخابی با گزینه‌های داینامیک) | ✅ **رفع شد** — فاز ۲۸؛ تست: `rolesAssignmentCheckboxGroupPhase28Fix.test.tsx` | `heroui.checkbox-group` با `optionsSource: static/lov/apiRef`؛ export داینامیک items؛ submit آرایه‌ای `roleIds` |
| U8 | ~~فرم داینامیک بر اساس Attribute Schema (مثل `AttributeValuesForm`)~~ | ✅ **بسته شد — تأیید مستقیم کاربر: برای پاریتی Users لازم نیست، خارج از محدوده** | این یک زیرسیستم بسیار خاص (attribute schema + session preview) بود؛ کاربر صراحتاً تأیید کرد این مودال برای پاریتی صفحه Users لازم نیست — هیچ فاز اجرایی برایش نوشته نشده |
| U9 | تعمیم نوار ابزار گرید از `roleFilters` هارد‌کد به فیلتر عمومی چندگزینه‌ای/تک‌گزینه‌ای روی هر فیلد + `matchLogic` (AND/OR) | ✅ **رفع شد** — فاز ۲۶؛ تست: `gridToolbarFieldFiltersPhase26Fix.test.ts` | `fieldFilters` با `controlType` checkbox/radio + `matchLogic`؛ مهاجرت خودکار `roleFilters` → `field: 'roles'` |
| U10 | Rich Cell Kind جدید «icon-from-lookup» / «badge-with-tooltip» | ✅ **رفع شد** — فاز ۲۷؛ تست: `gridRichCellIconLookupChipsPhase27Fix.test.tsx` | کایند `icon-from-lookup` با `lookupSource`/`valueField`/`lookupEntries`/`showTooltip`/`fallbackIcon` + enrichment fallback؛ رندر با `BaseInfoUiIcon` |
| U11 | ارتقای دقت رندر Rich Cell `chips` | ✅ **رفع شد** — فاز ۲۷؛ تست: `gridRichCellIconLookupChipsPhase27Fix.test.tsx` | `colorMode: hash-palette\|fixed-two-tone`، `truncateLabelChars`، `showTooltipOnTruncate`، `overlapMode`؛ پالت مشترک در `hashChipPalette.ts` |
| U12 | مکانیزم Cross-field Validation در فرم/بایندینگ | ✅ **رفع شد** — فاز ۳۱؛ تست: `crossFieldValidationPhase31Fix.test.ts` | `CrossFieldRule[]` روی `html.form` با رول‌های `equals/notEquals/greaterThan/lessThan/expression`؛ اجرا در هر سه مسیر (Preview/Runtime + Export/Codegen) |
| U13 | ~~Widget معادل `EntityFunctionAccessModal` (Allow/Deny/None با فولدربندی)~~ | ✅ **بسته شد — تأیید مستقیم کاربر: برای پاریتی Users لازم نیست، خارج از محدوده** | نباید با «Node Visibility Access» (کنترل نمایش در اپ ساخته‌شده) اشتباه شود؛ کاربر صراحتاً تأیید کرد این مودال لازم نیست — هیچ فاز اجرایی برایش نوشته نشده (ریسک امنیتی RBAC هم این تصمیم را تقویت می‌کرد) |

**نکته مهم دیگر که این تحلیل کشف کرد:** تیم Designer از قبل presetهای **هارد‌کد و اختصاصی «users»** ساخته بود (`designerGridRichCellColumns.ts`, `designerGridRowDisableRules.ts`, `designerGridActionColumns.ts`) که تقریباً کپی صفحه واقعی Users هستند — این‌ها ثابت می‌کنند این نیاز شناخته‌شده بوده، اما راه‌حل فعلی («کپی هارد‌کد فقط برای Entity users») با هدف «ابزار عمومی که با آن هر Entity ای ساخته شود» در تضاد است. آیتم‌های U5/U9 دقیقاً همین هارد‌کدها را به مکانیزم عمومی تبدیل می‌کنند.

### 20.3 اولویت‌بندی نهایی برای فازهای اجرایی

بر اساس همه‌ی یافته‌های بالا (۳۰ گپ تأییدشده + ۱۳ نیاز Users-parity، با حذف هم‌پوشانی‌ها)، فازهای اجرای دقیق در **`21-DESIGNER-BUGFIX-EXECUTION-PHASES.md` (فاز ۲۴ به بعد)** نوشته شده‌اند، با این ترتیب اولویت کلی:
1. **مسیر بحرانی Users-Parity** (U1-U12؛ U8/U13 با تأیید مستقیم کاربر به‌طور کامل بسته و از محدوده خارج شدند — نه فقط به تعویق افتادند) — چون این مستقیماً هدف تعیین‌شده‌ی کاربر است.
2. **باگ‌های امنیتی/کم‌هزینه‌ی سطح-المنت** (html.link rel، html.iframe sandbox، html.heading level، heroui.tabs/breadcrumbs items، heroui.slider range).
3. **شکاف‌های گزارش‌سازی/داشبورد** (Aggregation/GroupBy/Pivot، Chart type-specific mapping، Combo Chart، Global Filter Bar).
4. **بقیه‌ی موارد تأییدشده‌ی این سند و سند element-level**، دسته‌بندی‌شده به فازهای مستقل با اولویت 🔴/🟠/🟡/🟢 مطابق جداول بالا.
5. **موارد آگاهانه به تعویق‌افتاده** (با ذکر دلیل محصولی، دقیقاً مثل تصمیم قبلی درباره‌ی Workflow): Payment/Signature/CAPTCHA/Save&Resume (فرم‌های عمومی/انتشار عمومی، نه ابزار ادمین داخلی)، Real-time Multiplayer کامل (نرم‌لاک کافی است)، Native Mobile (نیاز کسب‌وکاری صریح لازم دارد)، U8/U13 (زیرسیستم‌های بسیار خاص Users). **#18 Custom React Import** با گزینه الف (ADMIN/DEVELOPER + static-analysis) در فاز ۵۷ بسته شد.

---

*این سند بر اساس بررسی کامل `client-components-feature-guide-fa.md` (1100 خط) و `client-components-toolbox-elements-fa.md` (16826 خط، 123 المنت در 12 دسته) و سرچ میدانی 2026 روی Retool، Bubble.io، Webflow، Appsmith، Budibase، JotForm، Typeform، Metabase و ECharts/Recharts/Nivo تهیه شده است. نسخه ۴ — بازبینی کامل با کد واقعی مخزن (نه اسناد مرجع) + تحلیل عمیق صفحه Users (بخش ۲۰)، جایگزین نسخه ۳ که بر پایه‌ی اسنپ‌شات قدیمی‌تر بود.*
