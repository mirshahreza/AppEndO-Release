# تحلیل تطابق Preview/Export برای تک‌تک المنت‌های Component Designer (نسخه‌ی دوم — عمیق‌تر)

## ۰. روش‌شناسی این نسخه

این سند جایگزین کامل نسخه‌ی قبلی است. برخلاف نسخه‌ی اول (که پس از آن تقریباً همه‌ی موارد یافته‌شده رفع شدند)، این تحلیل با فرض «کدهای قبلی درست‌اند مگر خلافش دوباره از نو با شواهد مستقل ثابت شود» انجام شده — یعنی به هیچ کامنت `// Bug found` موجود در کد اعتماد نشده و هر ادعا از نو از روی کد واقعی، تست‌های موجود، و در موارد لازم تایپ‌های واقعی کامپوننت در `node_modules/@heroui/react` و `node_modules/@heroui/styles` بازبینی شده است.

بررسی به هفت خوشه‌ی مستقل تقسیم و هرکدام جداگانه و با جزییات کامل (فایل:خط دقیق، مقایسه‌ی رفتار Preview در برابر Export، و در موارد لازم اجرای واقعی تست/تولید کد) انجام شد:

1. HTML Primitives + Layout + Logic
2. HeroUI Forms & Inputs
3. HeroUI General + Navigation/Overlays
4. HeroUI Data Display + Tailwind UI Blocks
5. Universal widgets (Content/Feedback/Marketing/Form/Layout-Universal/Logic-Visibility)
6. Data Viz / Charts / Kanban / Gantt / Tree widgets
7. دسته‌های پویا: Shell Chrome، Platform Navigation، Platform Slots، Reusable Components

هر المنت در برابر دو (گاهی سه) مسیر رندر بررسی شده:
- **Preview زنده‌ی تعاملی** — همان چیزی که کاربر واقعی در صفحه‌ی منتشرشده می‌بیند (`designerRuntimePreview.tsx` و فایل‌های `DesignerRuntime*.tsx`).
- **کد Export/منتشرشده (`.tsx`)** — مسیر Codegen (`tsxNodeRenderer.ts`, `tsxParityPalette.ts`, `tsxPhase2Palette.ts`, `tsxUniversalPalette.ts`, `tsxVizPalette.ts`, `tsxPlatformPalette.ts`, هدایت‌شده توسط `bindingCodegen.ts`).
- **بوم طراحی زنده (Design canvas)** — `src/features/component-designer/canvas/canvasNodes.tsx`؛ فقط وقتی واگرایی‌اش از دو مسیر بالا واقعاً مهم است گزارش شده (چون این حالت عمداً شبیه‌سازی‌محور است).

---

## ۱. خلاصه‌ی اجرایی — فهرست کامل باگ‌های تازه‌یافته (اولویت‌بندی‌شده)

جدول زیر همه‌ی باگ‌های **تأییدشده‌ی جدید** این دور از بازبینی را نشان می‌دهد (باگ‌هایی که در دور قبل پیدا و رفع شدند اینجا تکرار نشده‌اند مگر این‌که وصله‌شان ناقص بوده باشد).

| # | المنت(ها) | مشکل | جهت |
|---|---|---|---|
| ۰ | نمودارها (`viz.chart-*`)، همه‌ی ویجت‌های `viz.*`، `heroui.data-grid`، `heroui.app-table-grid` | **ریشه‌ی معماری (بخش الف و ب هر دو رفع شد ✅):** بوم طراحی Hydration زنده دارد (`useDesignerHydratedRows` + `DesignerCanvasHydratedVizWidget`). بخش ب (صفحه‌ی Preview مجزا) هم **تأیید شد که از قبل کار می‌کرده** — `DesignerDocumentPreview` در `designerRuntimePreview.tsx` خودش `hydrationData`/`dynamicHydrationStoreKey`/`refreshDataSource` دارد؛ ادعای قبلی «deferred» بر اساس جست‌وجوی ناقص فقط در `src/features/` بود. جزییات در بخش ۷ب و ۱۰.۷.۳. | بوم طراحی ✅ رفع شد؛ صفحه‌ی Preview مجزا ✅ تأیید شد (قبلاً کار می‌کرده)؛ Export سالم |
| ۱ | ۱۰ عنصر ورودی فرم (select/autocomplete/entity-picker/date-picker/code-editor/html-editor/mask-input/calculator/color-control/tags-input) | اعتبارسنجی زنده‌ی هنگام تایپ/blur (`onPreviewFieldValidation`) در Preview تعاملی برای هیچ‌کدام وصل نیست | فقط Preview خراب |
| ۲ | تقریباً همه‌ی Universal widgets (۲۹ آیتم) | Property Binding روی فیلدهای اسکالر (title/message/label/...) در Preview تعاملی کاملاً بی‌اثر است | فقط Preview خراب |
| ۳ | ۴ اسلات عمومی پلتفرم (`core.sidebar.navigation`, `core.dashboard.widgets`, `core.settings.sections`, `core.toolbar.actions`) | محتوای واقعی `slotRegistry` هرگز در Preview زنده/صفحه‌ی منتشرشده نمایش داده نمی‌شود؛ فقط بوم طراحی و Export درست‌اند | فقط Preview/صفحه‌ی زنده خراب |
| ۴ | `platform.slot.core.shell.header` (و alias آن `shell.chrome.slot-header-actions`) | فیلدهای showLogo/showBreadcrumb/showActions در بوم طراحی و Export کاملاً نادیده گرفته می‌شوند؛ فقط در صفحه‌ی زنده‌ی منتشرشده اثر دارند | فقط Preview زنده درست، بقیه خراب |
| ۵ | `content.segmented-control` | **رفع شد ✅:** اتصال داده‌ی Dual-Mode (گزینه‌ها از API) در Preview تعاملی بی‌اثر بود؛ `DesignerRuntimeSegmentedControl` مستقیماً `node`/`options` خام می‌گرفت و از لایه‌ی `resolveBoundUniversalOverrides` عبور نمی‌کرد. با افزودن prop جدید `optionsOverride` رفع شد. | رفع شد؛ تست رگرسیون: `segmentedControlDualModeBindingFix.test.tsx` |
| ۶ | ۸ ویجت غیرنموداری Viz (tree-view/tree-select/cascader/tree-combobox/timeline/gantt/sheet/kanban) | **رفع شد ✅:** نوار ابزار فیلتر زمان‌اجرا («Connect to API») در Export کاملاً غایب بود؛ همچنین یک باگ مشابهِ نشناخته‌شده پیدا و رفع شد: `vizFieldMapping`/`vizToolbarConfig` به‌عنوان attribute خام JSON روی این ۸ کامپوننت نشت می‌کردند (خطای type-check واقعی در بسته‌ی Export). | رفع شد؛ تست رگرسیون: `vizNonChartToolbarCodegen.test.ts` |
| ۷ | `heroui.dropdown` | **رفع شد ✅:** باین‌دینگ Items (پویا/LOV) در Export بی‌اثر بود (فقط پارسر استاتیک `parseDesignerAutocompleteItems` صدا زده می‌شد)؛ در Preview درست کار می‌کند. | رفع شد؛ تست رگرسیون: `dropdownItemsBindingExportFix.test.ts` |
| ۸ | `heroui.tooltip-trigger` (حالت بدون href) | **رفع شد ✅:** Trigger واقعی و تعاملی در Preview، ولی در Export یک `&lt;span&gt;` ثابتِ غیرقابل‌کلیک بود. | رفع شد؛ تست رگرسیون در `herouiGeneralActions.t1-22.test.tsx` |
| ۹ | `viz.gantt` | **رفع شد ✅:** فیلد `progressField` در تبدیل داده‌ی Export (نسخه‌ی inline شده) حذف می‌شد؛ نوار پیشرفت در Gantt منتشرشده همیشه پر/خالی بود. **باگ ریشه‌ای بزرگ‌تر هم پیدا و رفع شد:** `data=` bound attribute برای هر چارت/ویجت Viz باین‌دشده در Export اصلاً صادر نمی‌شد (نه مقدار واقعی، نه fallback استاتیک) چون `resolveBoundAttributeForNodeProp` با کل آبجکت `node` به‌جای `node.id` صدا زده می‌شد. | رفع شد؛ تست‌های رگرسیون: `vizGanttProgressFieldExportFix.test.ts`, `chartVizBoundDataAttrRootCauseFix.test.ts` |
| ۱۰ | `viz.chart-bar/line/pie/sparkline` | **رفع شد ✅:** رنگ/برچسب سفارشی هر سری (از ویزارد Chart) در Export اعمال نمی‌شد. | رفع شد؛ تست رگرسیون: `chartSeriesColorsLabelsExportFix.test.ts` |
| ۱۱ | `html.form` | **بازبینی شد — باگ نیست ✅:** با بررسی مجدد کد فعلی، فیلد Target هم در بوم طراحی (`canvasNodes.tsx`) هم در Preview تعاملی (`designerRuntimePreview.tsx`) از قبل درست خوانده و به `target` واقعی روی `&lt;form&gt;` اعمال می‌شود. این مورد در ادیت اولیه‌ی گزارش اشتباه (یا بر اساس نسخه‌ی قدیمی کد) ثبت شده بود. | باگی وجود ندارد؛ تست قفل‌کننده‌ی رفتار: `htmlFormTargetFieldVerification.test.tsx` |
| ۱۲ | `heroui.data-grid` / `heroui.table` | **رفع شد ✅:** فیلدهای Loading/Empty Content/Error Content/Sticky Header در Export کاملاً بی‌اثر بودند. | رفع شد؛ تست رگرسیون: `dataGridLoadingEmptyErrorStickyExportFix.test.ts` |
| ۱۳ | `heroui.app-table-grid` | **رفع شد ✅:** فیلد «Default Sort Field» در Export هیچ اثری نداشت؛ گرید منتشرشده همیشه بدون مرتب‌سازی اولیه باز می‌شد. | رفع شد؛ تست رگرسیون: `appTableGridDefaultSortByExportFix.test.ts` |
| ۱۴ | `heroui.app-table-grid` | **رفع شد ✅:** جستجوی نوار ابزار در Export هیچ Debounce نداشت؛ هر کلیدفشاری یک درخواست شبکه‌ی جدا می‌فرستاد. | رفع شد؛ تست رگرسیون: `appTableGridSearchDebounceExportFix.test.ts` |
| ۱۵ | `html.text`/`html.heading`/`html.link`/`html.list-item` | **رفع شد ✅:** باین‌د کردن فیلد `text` در Export یک اتریبیوت `text=` تکراری و بی‌اثر تولید می‌کرد. | رفع شد؛ تست رگرسیون: `htmlTextDuplicateAttrExportFix.test.ts` |
| ۱۶ | `content.stepper`, `form.rating`, `form.otp-input`, `form.time-input`, `form.datetime-input` | **رفع شد ✅:** چند فیلد (activeStep/label/max/length) در Export به‌صورت اتریبیوت تکراری صادر می‌شدند و مقدار استاتیک همیشه برنده می‌شد. | رفع شد؛ تست رگرسیون: `universalWidgetsDuplicateAttrExportFix.test.ts` |
| ۱۷ | `html.file-upload` | **رفع شد ✅:** فیلد Multiple هم در Preview بی‌اثر بود هم وقتی Bind می‌شد در Export اتریبیوت مرده/بدجا تولید می‌کرد. | رفع شد؛ تست رگرسیون: `fileUploadMultipleBindingFix.test.tsx` |
| ۱۸ | `logic.visibility-container` داخل `logic.repeater` تودرتو | **رفع شد ✅:** شرط با scope مربوط به `item.` همیشه `item` را undefined می‌دید → همیشه مخفی، در هر دو مسیر. | رفع شد؛ تست رگرسیون: `visibilityContainerRepeaterScopeFix.test.tsx` |
| ۱۹ | `heroui.button-solid`/`heroui.button-outline` | **رفع شد ✅ (حذف فیلد):** فیلد Color روی کامپوننت واقعی اصلاً وجود نداشت. حذف شد + نشتی احتمالی در Export بسته شد. | رفع شد؛ تست: `deadFieldsRemovalItems19to26.test.tsx` |
| ۲۰ | `heroui.link` | **رفع شد ✅ (حذف فیلد):** فیلدهای Size و Color هردو کاملاً مرده بودند. هردو حذف شدند + نشتی احتمالی در Export بسته شد. | رفع شد؛ تست: `deadFieldsRemovalItems19to26.test.tsx` |
| ۲۱ | `heroui.avatar` | **رفع شد ✅ (حذف فیلد):** «Fallback Source» اصلاً propای روی `Avatar.Image` واقعی نبود. حذف شد + نشتی واقعی در Preview (کنسول React) و Export بسته شد. | رفع شد؛ تست: `deadFieldsRemovalItems19to26.test.tsx` |
| ۲۲ | `heroui.skeleton` | **رفع شد ✅ (جایگزینی فیلد):** «isLoaded» propای روی Skeleton واقعی نبود؛ با variant واقعی (`animationType`: none/pulse/shimmer) جایگزین شد. | رفع شد؛ تست: `deadFieldsRemovalItems19to26.test.tsx` |
| ۲۳ | `heroui.tooltip-trigger` | **رفع شد ✅ (حذف فیلد):** فیلد Aria Label (نسخه‌ی تکراری heroui-group) در هر دو مسیر کاملاً مرده بود. حذف شد + نشتی احتمالی روی `Tooltip.Root` در Export بسته شد. | رفع شد؛ تست: `deadFieldsRemovalItems19to26.test.tsx` |
| ۲۴ | `heroui.dropdown` | **رفع شد ✅:** باین‌د کردن Label هم در Export یک اتریبیوت مرده تولید می‌کرد. | رفع شد؛ تست: `deadFieldsRemovalItems19to26.test.tsx` |
| ۲۵ | `heroui.listbox` | **رفع شد ✅ (حذف فیلد):** فیلد Size هم در Preview هرگز خوانده نمی‌شد هم روی کامپوننت واقعی چنین variantی نبود. حذف شد + نشتی احتمالی در Export بسته شد. | رفع شد؛ تست: `deadFieldsRemovalItems19to26.test.tsx` |
| ۲۶ | `layout.split-pane` | **رفع شد ✅ (حذف فیلد):** فیلد isDisabled کاملاً مرده بود — هیچ تعامل drag-to-resize در هیچ مسیری پیاده نشده. حذف شد + نشتی احتمالی در Export بسته شد. | رفع شد؛ تست: `deadFieldsRemovalItems19to26.test.tsx` |
| ۲۷ | `heroui.entity-picker` | **رفع شد ✅:** propهای `entityRef`/`searchParam` مستقیماً و نامعتبر روی کامپوننت واقعی Autocomplete می‌نشستند (نه یک واگرایی، یک نقض قرارداد نوع در هر دو مسیر). | رفع شد؛ تست رگرسیون: `entityPickerInvalidPropsExportFix.test.tsx` |

**نکته‌ی مهم روش‌شناسی:** بخش زیادی از این باگ‌ها (مثل مورد ۱۹ تا ۲۶) دقیقاً همان الگویی هستند که در دور اول برای عناصر دیگر (dropdown's Size، heroui.card، heroui.tabs و...) پیدا و رفع شد، اما به این عناصر خواهر (button/link/avatar/skeleton/listbox/tooltip-trigger) اعمال نشده بود — یعنی فیکس‌های قبلی «موضعی» بودند، نه سیستماتیک روی کل خانواده.

---

## ۲. HTML Primitives + Layout + Logic

### وضعیت سالم (تأییدشده با شواهد مستقل)
`html.container`, `html.section`, `html.article`, `html.figure`, `html.table-wrap`, `html.image`, `html.iframe`, `html.list`, همه‌ی ۹ آیتم Layout بدون grid (flex-row/flex-column/center/stack-compact/stack-relaxed/wrapper/scroll/sticky-bar/sidebar)، `layout.grid-2`/`grid-3`/`columns`، `logic.repeater`.

هر دو مسیر (Preview و Export) برای این عناصر از **یک تابع/جدول مشترک** استفاده می‌کنند (`PALETTE_HTML_TAG_BY_ID` در `domProps.ts`، `resolveLayoutGridDomStyle`، `resolveRepeaterNodeConfig`)، پس واگرایی ساختاری اصلاً ممکن نیست.

### باگ‌های تازه‌یافته

**`html.form` — فیلد Target در Preview بی‌اثر (بازبینی شد — باگ نیست ✅)**
گزارش اولیه ادعا می‌کرد `designerRuntimePreview.tsx` فقط `action/method/encType/autoComplete/noValidate/name/className/style/onSubmit` را می‌خواند و `target` هرگز خوانده نمی‌شود. بازبینی مستقیم کد فعلی (هم `designerRuntimePreview.tsx` هم `canvasNodes.tsx`) نشان داد این ادعا نادرست است — هر دو مسیر از قبل خط `target={typeof node.props.target === 'string' && node.props.target.trim().length > 0 ? node.props.target : undefined}` را دارند و درست کار می‌کنند؛ به همراه Export که هم از قبل درست بود. تست قفل‌کننده‌ی رفتار (چون پوشش تست قبلی برای این فیلد وجود نداشت): `htmlFormTargetFieldVerification.test.tsx` (Preview + Export، هر دو تأیید شدند).

**`html.text`/`html.heading`/`html.link`/`html.list-item` — اتریبیوت تکراری `text=` در Export وقتی باین شود (رفع شد ✅)**
`text` به‌عنوان JSX children درست resolve می‌شود (`renderTranslatableJsxTextContent`)، اما حلقه‌ی عمومی bound-attribute در `buildNodeJsxAttributesWithBindings` (`tsxPropMapper.ts:361-367`) بدون توجه به `childrenPropKeys`، آن را هم به‌عنوان یک اتریبیوت `text={expr}` روی همان تگ اضافه می‌کرد. لیست استثنای `resolveBoundAttributeForNodeProp` (که `items`/`page`/`total`/`value` را قبلاً پوشش می‌دهد) شامل `text` نبود.
**رفع:** همان الگوی دقیق استثنای `items` در `resolveBoundAttributeForNodeProp` (`bindingCodegen.ts`) برای `targetProp === 'text'` روی این ۴ عنصر هم اضافه شد. تست رگرسیون: `htmlTextDuplicateAttrExportFix.test.ts` (هر ۴ عنصر — تأیید عدم نشت attribute و صحت باین‌دینگ در children؛ نکته‌ی جانبیِ کشف‌شده حین نوشتن تست: `html.list-item` فقط داخل والد `list` مجاز است، پس درج آن در ریشه به‌طور خودکار در یک `html.list` بسته‌بندی می‌شود — نود واقعیِ باین‌دشدنی یک سطح پایین‌تر است، نه فرزند مستقیم ریشه؛ این یک نکته‌ی تست‌نویسی بود، نه باگ محصول).

**`html.file-upload` — فیلد Multiple (رفع شد ✅)**
`accept` قبلاً رفع شده بود (Preview: `previewBindings.resolveTextProp`؛ Export: منتقل‌شده به `&lt;input&gt;` واقعی)، اما همان الگو برای **Multiple فراموش شده بود**:
- Preview: `multiple={node.props.multiple === true}` کاملاً استاتیک بود — باین‌دینگ اصلاً چک نمی‌شد.
- Export: در پاس استاتیک exclude شده بود، اما هیچ regex-stripی مشابه accept برای آن نبود — اگر Bind می‌شد، حلقه‌ی عمومی یک `multiple={expr}` مرده روی `&lt;label&gt;` می‌گذاشت، و `&lt;input&gt;` واقعی همچنان مقدار استاتیک را نگه می‌داشت.

**رفع:** دقیقاً همان الگوی `accept` برای `multiple` هم تکرار شد. Preview (`designerRuntimePreview.tsx`) از همان `previewBindings.resolveTextProp` استفاده می‌کند (چون `formatPreviewValue` مقدار boolean باین‌دشده را از قبل به `"true"`/`"false"` تبدیل می‌کند، نیازی به افزودن یک متد جدید boolean-specific به bridge نبود). Export (`tsxNodeRenderer.ts`) اکسپرشن باین‌دشده را از `&lt;label&gt;` wrapper پاک می‌کند و آن را روی `&lt;input&gt;` واقعی به‌صورت `multiple={Boolean(expr)}` می‌گذارد. تست رگرسیون: `fileUploadMultipleBindingFix.test.tsx` (Export باین‌د/استاتیک + Preview باین‌د/استاتیک، ۴ تست).

**`layout.split-pane` — فیلد isDisabled کاملاً مرده (رفع شد ✅ — حذف)**
`direction`/`defaultSplit` در هر سه مسیر (Preview/Canvas/Export) درست خوانده می‌شوند، اما **هیچ تعامل واقعی drag-to-resize پیاده نشده** — تقسیم‌کننده فقط یک `div` با `aria-hidden="true"` و بدون هیچ handler ماوس/pointer است، در هر سه مسیر. پس فیلد «Disabled» چیزی برای غیرفعال‌کردن نداشت و همیشه بی‌اثر بود. حذف شد از `inspectorPaletteFields.ts`؛ `isDisabled`/`disabled` هم به excludeKeys صادرکننده اضافه شد تا مقدار باقی‌مانده از سندهای قدیمی نشت نکند.

---

## ۳. HeroUI Forms & Inputs (۱۹ عنصر)

### وضعیت سالم (تأییدشده)
`heroui.field-container`, `heroui.input-text`, `heroui.textarea`, `heroui.number-input`, `heroui.select`, `heroui.autocomplete`, `form.date-range`, `form.code-editor`, `form.html-editor`, `form.mask-input`, `form.calculator`, `heroui.checkbox-group`, `heroui.radio-group`, `heroui.switch`, `heroui.slider`, `heroui.date-picker`, `heroui.tags-input`, `heroui.color-control` — فریز شدن مقدار (value/defaultValue)، باین‌دینگ‌های Items/selectedKeys، و منطق مشترک code-editor/html-editor/mask-input/calculator/color-control (که همگی از یک کامپوننت مشترک وارد‌شده به کد Export استفاده می‌کنند) با شواهد مستقل تأیید شدند.

### باگ‌های تازه‌یافته

**سیستماتیک — اعتبارسنجی زنده در Preview برای ۱۰ عنصر وصل نیست**
`options.onPreviewFieldValidation` (که pattern/minLength/maxLength/isRequired را هنگام تایپ/blur چک می‌کند و `isInvalid`/`errorMessage` را به‌روز می‌کند) **فقط** از `sharedFieldEventProps` در `runtimeRenderer.tsx:462-490` صدا زده می‌شود — که فقط توسط `heroui.input-text`/`number-input`/`textarea` استفاده می‌شود. عناصر زیر فیلدهای اعتبارسنجی را در Inspector دارند ولی هیچ‌کدام این مکانیزم را صدا نمی‌زنند: `heroui.select`, `heroui.autocomplete`, `heroui.entity-picker`, `heroui.date-picker`, `form.code-editor`, `form.html-editor`, `form.mask-input`, `form.calculator`, `heroui.color-control`, `heroui.tags-input`. (مسدودسازی ارسال فرم در Export که این سشن اضافه شد از این مشکل متأثر نیست — آن مکانیزم مستقل و palette-agnostic است.)

**`heroui.entity-picker` — propهای نامعتبر روی کامپوننت واقعی (رفع شد ✅)**
`entityRef`/`searchParam` مستقیماً روی `&lt;Autocomplete&gt;` واقعی نشانده می‌شدند (هم در Preview هم Export)، ولی طبق `AutocompleteRootProps` واقعی (`node_modules/@heroui/react/dist/components/autocomplete/autocomplete.d.ts`) چنین propهایی وجود نداشتند — به‌صورت اتریبیوت DOM ناشناخته/بی‌اثر ظاهر می‌شدند. هردو مسیر یکسان و به همین شکل اشتباه بودند (نه یک واگرایی، یک نقض قرارداد نوع مشترک).
**رفع:** هر دو مقدار از spread/reservedAttributes حذف شدند (`resolveEntityPickerProps` در `runtimeNodeProps.ts` برای Preview، `renderEntityPickerCustomJsx` در `tsxPhase2Palette.ts` برای Export) — بدون تغییر در منطق واقعیِ جست‌وجو، که از قبل مستقیماً از `node.props.entityRef`/`searchParam` می‌خواند (`bindingEntityPickerCodegen.ts`)، مستقل از این spread نامعتبر. تست رگرسیون: `entityPickerInvalidPropsExportFix.test.tsx` (عدم نشتی در Preview + عدم هشدار React در کنسول + عدم نشتی در Export، هر سه با مقدار label واقعی هنوز صحیح).

---

## ۴. HeroUI General + Navigation/Overlays (۱۵ عنصر)

### وضعیت سالم (تأییدشده)
`heroui.chip`, `heroui.spinner` (فقط یک گزینه‌ی واقعی `xl` در Inspector نیست، مشکل نیست)، `heroui.tabs`, `heroui.breadcrumbs`, `heroui.modal`, `heroui.alert-dialog`, `heroui.drawer`, `heroui.toolbar`.

### باگ‌های تازه‌یافته

**`heroui.button-solid`/`heroui.button-outline` — فیلد Color مرده (رفع شد ✅ — حذف)**
`buttonVariants` واقعی (`@heroui/styles/src/components/button/button.styles.ts`) فقط `variant`/`size`/`fullWidth`/`isIconOnly` دارد — **بدون color**. `resolveButtonVariant` فقط زمانی از Color استفاده می‌کند که Variant ست نشده باشد (که همیشه یک مقدار پیش‌فرض دارد، پس عملاً هرگز صدا زده نمی‌شد)، و نگاشت رنگ‌به‌واریانت اصلاً entryی برای گزینه‌ی «accent» نداشت. مقدار خام Color هم در هردو مسیر به‌عنوان اتریبیوت نامعتبر روی Button واقعی می‌نشست. حذف شد از `inspectorPaletteFields.ts` و از `tsxNodeRenderer.ts`'s reservedAttributes؛ excludeKeys هم برای جلوگیری از نشتی مقدار قدیمی اضافه شد.

**`heroui.link` — فیلدهای Size و Color هردو کاملاً مرده (رفع شد ✅ — حذف)**
`linkVariants` واقعی یک `variants: {}` کاملاً خالی دارد — Link واقعی هیچ size/color پشتیبانی نمی‌کند. هردو فیلد حذف شدند؛ excludeKeys هم در Export اضافه شد.

**`heroui.avatar` — «Fallback Source» propای واقعی نیست (رفع شد ✅ — حذف)**
`AvatarImage` واقعی فقط `className/crossOrigin/loading/onError/onLoad/sizes/src/srcSet` می‌پذیرد. مکانیزم fallback واقعی یک child جدا (`Avatar.Fallback`) است، نه یک URL جایگزین. فیلد و همه‌ی منطق مرتبط (در Preview و Export) حذف شدند. حین رفع، یک نشتی واقعیِ کشف‌نشده هم پیدا شد: مقدار باقی‌مانده از سندهای قدیمی از طریق مکانیزم عمومی `resolveRuntimeComponentProps`'s passthrough مستقیماً روی کامپوننت واقعی spread می‌شد و هشدار React در کنسول تولید می‌کرد («does not recognize the fallbackSrc prop») — با افزودن `fallbackSrc` به `LIBRARY_BLOCKED_PASSTHROUGH_KEYS` سراسری (`runtimeNodeProps.ts`) رفع شد.

**`heroui.skeleton` — «isLoaded» propای واقعی نیست (رفع شد ✅ — جایگزینی با animationType)**
`SkeletonRootProps` واقعی فقط `animationType` (none/pulse/shimmer) دارد. تنها فیلد Inspector این عنصر (`isLoaded`) به‌صورت شرطی روی کامپوننت واقعی spread می‌شد ولی هیچ اثر واقعی نداشت؛ variant واقعی هم اصلاً در Inspector expose نشده بود. `isLoaded` حذف و با فیلد select واقعی `animationType` جایگزین شد، در Preview و Export هردو.

**`heroui.tooltip-trigger` — واگرایی واقعی Preview/Export + فیلد مرده**
برای حالت بدون href، Preview یک `&lt;HButton variant="ghost" size="sm"&gt;` واقعی و تعاملی می‌سازد (`DesignerRuntimeParityPalette.tsx:617-627`)، اما Export دقیقاً همان مارک‌آپ placeholder حالت طراحی را هاردکد می‌کرد: یک `&lt;span&gt;` غیرقابل‌کلیک و بدون کیبورد (`tsxParityPalette.ts:468`). **(رفع شد ✅)** جدا از این، فیلد «Aria Label» در هر دو مسیر کاملاً مرده بود — روی `Tooltip.Root`/`TooltipTrigger` (یک wrapper منطقی react-aria بدون هیچ DOM) می‌نشست و هرگز به دکمه/لینک واقعی نمی‌رسید. **(رفع شد ✅ — حذف فیلد تکراری heroui-group + excludeKeys در Export)**
**رفع:** `tsxParityPalette.ts`'s `renderTooltipTriggerParityJsx` — شاخهٔ بدون-href حالا یک `&lt;Button variant="ghost" size="sm"&gt;` واقعی صادر می‌کند (با `isDisabled` وقتی نود غیرفعال باشد)، دقیقاً معادل `HButton` در Preview؛ `'Button'` به `importSymbols` مربوط به `heroui.tooltip-trigger` در `tsxComponentRegistry.ts` هم اضافه شد. تست رگرسیون: ۳ تست جدید در `herouiGeneralActions.t1-22.test.tsx` (Button واقعی برای حالت بدون href، isDisabled صحیح، و حالت href هنوز Link واقعی صادر می‌کند). تأیید کامل: تایپ‌چک تمیز، سوییت مرتبط سبز (۴۷ تست)، و اجرای کامل سوییت دقیقاً منطبق با baseline (۴۷/۴۷).

**`heroui.dropdown` — دو باگ (هردو رفع شدند ✅)**
۱) Label اگر Bind می‌شد در Export مرده بود — نه به‌عنوان محتوای trigger (که Preview درست resolve می‌کرد) و هم به‌عنوان یک اتریبیوت مرده روی `&lt;Dropdown&gt;` می‌نشست (چون در لیست استثنای `resolveBoundAttributeForNodeProp` نبود). **رفع:** `tsxNodeRenderer.ts`'s شاخهٔ `heroui.dropdown` حالا از `renderBoundJsxTextExpression` برای محتوای واقعی trigger استفاده می‌کند (دقیقاً معادل الگوی title/description روی card/modal/accordion)؛ `label` هم به لیست استثنای `resolveBoundAttributeForNodeProp` در `bindingCodegen.ts` اضافه شد. تست رگرسیون: `deadFieldsRemovalItems19to26.test.tsx`.
۲) Items پویا/LOV در Preview درست resolve می‌شود (`useDesignerOptionItems`) اما در Export کاملاً مرده بود — `renderDropdownMenuItems(node)` هیچ پارامتر `bindingContext` نمی‌گرفت و فقط JSON استاتیک را می‌خواند؛ برخلاف select/autocomplete/listbox که این دقیقاً همین الگو را قبلاً درست کرده بودند. **(رفع شد ✅)**
**رفع:** `tsxNodeRenderer.ts` — تابع جدید `renderDropdownMenuItemsAttrAndBody` (دقیقاً معادل الگوی `heroui.listbox`) اضافه شد که با `resolveNodeOptionItemsDataExpression`/`renderDesignerItemsMapperExpression` یک `items={...}` واقعی + render-prop روی `Dropdown.Menu` می‌سازد وقتی باین‌د باشد. حین رفع، یک نشتیِ دومِ اتریبیوت تکراری هم پیدا شد: باین‌دینگ Items هم‌زمان روی `&lt;Dropdown&gt;` بیرونی هم به‌صورت اتریبیوت خام نشت می‌کرد (چون `resolveBoundAttributeForNodeProp` فقط select/autocomplete/listbox را برای این استثنا می‌شناخت) — با افزودن `heroui.dropdown` به همان لیست استثنا در `bindingCodegen.ts` رفع شد. تست رگرسیون: `dropdownItemsBindingExportFix.test.ts` (باین‌د و غیر باین‌د، هر دو با تأیید تعداد دقیق attribute). تأیید کامل: تایپ‌چک تمیز، سوییت‌های مرتبط سبز (۱۸ تست)، و اجرای کامل سوییت دقیقاً منطبق با baseline (۴۷/۴۷).

---

## ۵. HeroUI Data Display + Tailwind UI Blocks (۱۷ عنصر)

### وضعیت سالم (تأییدشده)
`heroui.card`, `heroui.accordion-item`, `heroui.progress`, `heroui.pagination`, `heroui.typography-lead`، و هر ۸ آیتم `tailwind.*` (که همگی از مسیر عمومی container/text رندر می‌شوند و اصلاً caseی جدا ندارند).

### باگ‌های تازه‌یافته

**`heroui.data-grid` / `heroui.table` — چهار فیلد مرده در Export (رفع شد ✅)**
`renderDataGridCustomJsx` (`tsxPhase2Palette.ts`) فقط `gridQueryMode/pageSize/page/total/isStriped` را reserve می‌کرد و همیشه یک `&lt;Table&gt;` ساده و بدون شاخه‌ی loading/error/empty رندر می‌کرد. `isLoading`, `emptyContent`, `errorContent`, `isHeaderSticky` — که همگی در Preview کاملاً واقعی‌اند (پیام لودینگ، حالت خطا، پیام خالی، اسکرول چسبان) — هرگز در تابع export خوانده نمی‌شدند و چون از attrs عمومی exclude هم نشده بودند، به‌عنوان اتریبیوت بی‌اثر روی ریشه‌ی جدول واقعی می‌نشستند. `heroui.table` دقیقاً همین تابع را به اشتراک می‌گذارد، پس همین باگ را داشت.
**رفع:** بررسی type defs واقعی `@heroui/react` نشان داد این ۴ فیلد اصلاً prop روی خود `Table`/`Table.ScrollContainer` نیستند — Preview هم آن‌ها را با wrapper markup دستی پیاده می‌کند، نه پاس‌دادن مستقیم. همان الگو در `renderDataGridCustomJsx` تکرار شد: `isLoading` (مقدار استاتیک شناخته‌شده در زمان build) کل `&lt;Table&gt;` را با یک placeholder جایگزین می‌کند؛ برای گریدهای باین‌دشده، `errorContent` با شرط زمان‌اجرا `Boolean(error_&lt;dataVar&gt;)` (از همان هوک `useDataFetch` که برای grid list fetch از قبل ساخته می‌شود) کل جدول را با پنل خطا جایگزین می‌کند؛ `emptyContent` یک ردیف تک با colSpan داخل `Table.Body` نمایش می‌دهد وقتی آرایه‌ی سطرها (باین‌دشده یا استاتیک) طول صفر دارد؛ `isHeaderSticky` یک `style={{maxHeight:"20rem",overflowY:"auto"}}` روی `Table.ScrollContainer` اعمال می‌کند. هر ۴ فیلد از excludeKeys هم اضافه شدند تا دیگر نشت نکنند. تست رگرسیون: `dataGridLoadingEmptyErrorStickyExportFix.test.ts` (۶ تست — هرکدام از ۴ فیلد + حالت پیش‌فرض بدون‌نشتی + تأیید اینکه `heroui.table` هم همین رفع را به اشتراک می‌گذارد). تأیید کامل: تایپ‌چک تمیز، سوییت‌های مرتبط سبز.

**`heroui.app-table-grid` — سه مشکل جدید (خارج از بازسازی اصلی این سشن) + یک مشکل ریشه‌ای مشترک**
- **(ریشه‌ای، مشترک با نمودارها — جزییات کامل در بخش ۷ب؛ بخش ب بعداً در فاز ۱۰ تأیید شد ✅)** جستجو/فیلتر نوار ابزار در بوم طراحی قبلاً Hydration واکنش‌گرا نداشت (رفع شد با `useDesignerHydratedRows`). ادعای اولیه‌ی «صفحه‌ی Preview مجزا چون `refreshDataSource` پیاده نشده خراب است» نادرست بود — `DesignerDocumentPreview` از قبل hydration زنده‌ی کلاینت‌محور دارد (تست: `previewPageHydrationRefreshItem0bVerification.test.tsx`). Export از این مشکل مصون است.
- «Default Sort Field» (`defaultSortBy`) هیچ اثری در Export نداشت (رفع شد ✅) — Preview وضعیت اولیه‌ی مرتب‌سازی را از آن می‌سازد، اما هوک تولیدشده‌ی Export همیشه با `EMPTY_GRID_QUERY` (sort: null) شروع می‌شد و هیچ‌جا به `defaultSortBy` ارجاع نمی‌داد — گرید منتشرشده همیشه بدون مرتب‌سازی اولیه باز می‌شد. **رفع:** `renderAppTableGridStateHookLines` (`bindingCodegen.ts`) حالا همان زنجیره‌ی fallback دقیق Preview را در زمان build محاسبه می‌کند (`defaultSortBy` → اولین `sortOptions` → اولین ستون → `'id'`) و `useState` اولیه را با `sort` واقعی seed می‌کند. تست رگرسیون: `appTableGridDefaultSortByExportFix.test.ts`.
- جستجوی نوار ابزار در Preview یک Debounce واقعی دارد (پیش‌فرض ۳۰۰ میلی‌ثانیه، قابل تنظیم)، اما هندلر تولیدشده‌ی Export بدون هیچ تأخیری روی هر کلیدفشاری هم `setSearchInput` هم `patchStore` را صدا می‌زد — و آن patch مستقیماً URL فچ سرور را عوض می‌کند، یعنی در حالت سرور یک درخواست شبکه به‌ازای هر حرف تایپ‌شده. **(رفع شد ✅)** **رفع:** `renderAppTableGridStateHookLines` (`bindingCodegen.ts`) حالا یک `useRef` تایمر debounce اضافه می‌کند؛ `setSearchInput` هم‌چنان فوری اجرا می‌شود (کادر ورودی واکنش‌گرا می‌ماند)، ولی `patchDesignerStore` داخل `setTimeout` با `debounceMs` پیکربندی‌شده (یا پیش‌فرض ۳۰۰) با clear/reschedule واقعی روی هر تغییر اجرا می‌شود — دقیقاً معادل مکانیزم Preview. تست رگرسیون: `appTableGridSearchDebounceExportFix.test.ts` (پیش‌فرض ۳۰۰، مقدار سفارشی، و تأیید clearTimeout واقعی).
- (کیفیت، نه باگ عملکردی) مارک‌آپ نوار ابزار در Export دستی نوشته شده (input/button/label خام) به‌جای استفاده از کامپوننت مشترک `DesignerGridPageToolbar`ی که Preview استفاده می‌کند — ظاهر/آیکون‌ها متفاوت است. این احتمالاً عمدی است (آن کامپوننت به ماژول‌های داخلی Designer وابسته است که در باندل منتشرشده معنا ندارند) اما هیچ‌جا صریحاً به‌عنوان تصمیم طراحی مستند نشده.

**`heroui.listbox` — فیلد Size (رفع شد ✅ — حذف)**
هرگز در Preview خوانده نمی‌شد، و روی کامپوننت واقعی (`@heroui/styles`'s `listboxVariants` فقط `variant` دارد، نه `size`) هم چنین variantی وجود نداشت — دقیقاً همان الگوی dropdown's Size که قبلاً رفع شده بود، اما برای listbox انجام نشده بود. حذف شد از `inspectorPaletteFields.ts`؛ `size` هم به excludeKeys در Export اضافه شد.

---

## ۶. Universal Widgets — Content/Feedback/Marketing/Form/Layout-Universal/Logic-Visibility (۲۹ عنصر)

### معماری
هر دو مسیر (`designerUniversalRuntime.tsx` برای Preview، `tsxUniversalPalette.ts` برای Export) از همان کامپوننت‌های واقعی مشترک در `DesignerRuntimeUniversalWidgets.tsx` استفاده می‌کنند — پس واگرایی معمولاً یا در «کدام props پاس داده می‌شود» است، یا خودِ کامپوننت مشترک باگ دارد (که در هردو مسیر یکسان دیده می‌شود).

### وضعیت سالم (تأییدشده، جدا از دو باگ سیستماتیک زیر)
`content.blog-card`, `content.carousel`, `content.cta-banner`, `content.description-list`, `content.feature-grid`, `content.icon`, `content.split-media`, `content.stat-trend`, `content.team-member`, `feedback.alert`, `feedback.banner`, `feedback.empty-state`, `feedback.result`, `layout.aspect-ratio`, `layout.overlay`, `layout.separator`, `layout.spacer`, `layout.sticky`, `marketing.faq-accordion`, `marketing.hero-cta`, `marketing.newsletter-signup`, `marketing.pricing-table` (باین‌دینگ ساختاری این سشن به‌درستی هم فرم comma-string/checkbox-string جدید هم فرم آرایه/بولین قدیمی را می‌پذیرد)، `marketing.testimonial-carousel`.

### باگ‌های سیستماتیک (روی اکثر عناصر بالا هم اثر می‌گذارند)

**سیستماتیک ۱ — Property Binding روی فیلدهای اسکالر در Preview تعاملی کاملاً بی‌اثر است**
`resolveUniversalPropsFromNode`/دیسپچ preview هر مقدار را مستقیماً از `node.props` می‌خواند و هرگز `options.previewBindings?.resolveTextProp`/`resolveNumberProp` را صدا نمی‌زند — همان مکانیزمی که `runtimeRenderer.tsx` (برای card/accordion-item/modal/drawer) و Pagination برای دقیقاً همین کار استفاده می‌کنند. با تست واقعی تأیید شد: باین‌د کردن `title` روی `feedback.alert` و رندر Preview تعاملی همیشه مقدار استاتیک را نشان می‌دهد، هرگز مقدار Bind‌شده را. Export این مشکل را ندارد. این روی تقریباً همه‌ی فیلدهای اسکالر (title/message/description/label/placeholder/...) در همه‌ی ۲۹ عنصر این خوشه اثر دارد.

**سیستماتیک ۲ — چند فیلد در Export به‌صورت اتریبیوت تکراری صادر می‌شوند (رفع شد ✅)**
برخلاف فیلدهای خواهرشان روی همان عنصر که در `contentBoundOrLiteral`/`boundOrDefaultValueLiteral` پیچیده شده بودند، فیلدهای زیر به‌صورت یک لیترال خام نوشته می‌شدند — و چون حلقه‌ی عمومی bound-attribute بدون قید excludeKeys همچنان مقدار Bind‌شده را هم اضافه می‌کرد، **دو** اتریبیوت هم‌نام تولید می‌شد که طبق قواعد JS/JSX، لیترال استاتیک (که آخر می‌آمد) برنده بود و مقدار Bind‌شده بی‌صدا نادیده گرفته می‌شد:
- `content.stepper` → `activeStep`
- `form.rating` → `label` و `max`
- `form.otp-input` → `label` و `length`
- `form.time-input` → `label`
- `form.datetime-input` → `label`
(همه با تولید TSX واقعی تأیید شدند — مثلاً `activeStep={dataContext?.wizard?.step} ... activeStep={1}`.)
**رفع:** `tsxUniversalPalette.ts` — هر ۶ مورد در همان تابع عمومی `boundOrDefaultValueLiteral` پیچیده شدند (این تابع از قبل برای فیلد خواهر `value` روی همین عناصر درست کار می‌کرد؛ کاملاً prop-agnostic است، فقط برای `value`/`defaultValue` نام‌گذاری شده بود). تست رگرسیون: `universalWidgetsDuplicateAttrExportFix.test.ts` (۶ تست — هر فیلد باین‌دشده با تأیید تعداد دقیق attribute=۱ و صحت expression، به‌علاوه‌ی حالت استاتیک بدون تغییر).

### باگ‌های اختصاصی

**`content.segmented-control` — اتصال داده‌ی Dual-Mode در Preview بی‌اثر (رفع شد ✅)**
این ویجت از مکانیزم Dual-Mode content-binding استفاده می‌کند (گزینه‌ها از یک API)، و Export درست یک `options={...}` محاسبه‌شده صادر می‌کند. اما دیسپچ Preview مقدار override محاسبه‌شده را نادیده می‌گیرد و `node` خام را پاس می‌دهد — کامپوننت هرگز `contentRows`/`contentListBound` را نمی‌خواند. با تست واقعی (باین‌د کردن یک دیتاسورس و رندر با ردیف‌های hydrate‌شده) تأیید شد: مقدار پیش‌فرض استاتیک همیشه نمایش داده می‌شود، هرگز داده‌ی واقعی.
**رفع:** `designerUniversalRuntime.tsx`'s `case 'content.segmented-control'` حالا `optionsOverride={props.options}` را پاس می‌دهد (که از `resolveBoundUniversalOverrides` محاسبه شده)؛ `DesignerRuntimeSegmentedControl` (در `DesignerRuntimeUniversalWidgets.tsx`) prop جدید `optionsOverride?: string` می‌گیرد و آن را به‌جای `node.props.options` خام استفاده می‌کند. تست رگرسیون: `segmentedControlDualModeBindingFix.test.tsx` (حالت باین‌دشده + حالت استاتیک بدون تغییر). تأیید کامل: تایپ‌چک تمیز، ۴ سوییت مرتبط (۱۵۰ تست) سبز، و اجرای کامل سوییت `src/domain/component-designer` دقیقاً منطبق با baseline (۴۷/۴۷، صفر رگرسیون جدید).

**`logic.visibility-container` تودرتو در `logic.repeater` — همیشه مخفی (رفع شد ✅)**
`DesignerUniversalVisibilityContainer` شرط `visibleCondition` را با `evaluateDesignerCondition(designerStore, dataContext, {}, condition)` ارزیابی می‌کرد — آرگومان scope همیشه `{}` بود، هم در Preview هم Export، چون این کامپوننت اصلاً propای برای scope/item/index نداشت. از آن‌جا که `logic.visibility-container` می‌تواند فرزند `logic.repeater` باشد، هر شرطی با scope `item.<field>` روی یک visibility-container تودرتو همیشه `item` را undefined می‌دید، داخل evaluator با خطا مواجه و catch می‌شد، و همیشه `false` برمی‌گشت — یعنی محتوا **همیشه مخفی**، در هر دو مسیر یکسان. (این جدا از باگ قبلاً رفع‌شده‌ی `data.`-scoped در Preview بود؛ این یکی مربوط به scope تودرتوی repeater بود و در هیچ مسیری کار نمی‌کرد.)
**رفع:** `DesignerUniversalVisibilityContainer` یک prop جدید `scope?: {item, index}` می‌گیرد و آن را مستقیماً به `evaluateDesignerCondition` پاس می‌دهد. **Preview:** `RuntimeRenderOptions` یک فیلد جدید `repeaterScope` دارد که از `designerRuntimePreview.tsx`'s محلی `scope` (همان مکانیزمی که `logic.repeater` از قبل برای فرزندانش استفاده می‌کند) پر می‌شود و به `DesignerUniversalVisibilityContainer` می‌رسد. **Export:** `tsxUniversalPalette.ts`'s شاخه‌ی `logic.visibility-container` حالا از `buildRepeaterScopeExpression` (همان تابعی که مکانیزم عمومی show/hide از قبل برای همین دقیقاً همین سناریو استفاده می‌کرد) برای صادرکردن `scope={({ item, index })}` روی این نود استفاده می‌کند. تست رگرسیون: `visibilityContainerRepeaterScopeFix.test.tsx` (Preview با آیتم‌های واقعی true/false، Export با تأیید attribute واقعی، و تأیید حالت غیرتودرتو بدون تغییر).

---

## ۷. Data Viz / Charts / Kanban / Gantt / Tree Widgets (۱۲ عنصر)

### وضعیت سالم / گپ‌های شناخته‌شده‌ی بدون تغییر
`viz.sheet` (بدون persist — گپ شناخته‌شده و پذیرفته‌شده، در هر دو مسیر یکسان)، `viz.kanban` (بدون drag/move — گپ شناخته‌شده‌ی مشابه). ساختار پایه‌ی همه‌ی ۱۲ عنصر (فیلدهای ساده، انتخاب نوع) درست است.

### باگ‌های تازه‌یافته

**سیستماتیک — نوار ابزار «Connect to API» در Export برای ۸ ویجت غیرنموداری کاملاً غایب است (رفع شد ✅)**
`InspectorVizBindingPanel`/`BindingVizWizardDialog` به کاربر اجازه می‌دهند هر ویجت غیرنموداری Viz (`viz.tree-view`, `viz.tree-select`, `viz.cascader`, `viz.tree-combobox`, `viz.timeline`, `viz.gantt`, `viz.sheet`, `viz.kanban`) را به API وصل کنند و همان نوار ابزار جستجو/فیلتر/رفرش زمان‌اجرا را که Chart دارد فعال کنند. در Preview این کاملاً واقعی است (`buildVizWidgetToolbar` یک `DesignerChartRuntimeToolbar` واقعی می‌سازد). در Export، `renderVizPaletteJsx` **هیچ منطق ساخت نوار ابزار برای هیچ‌کدام از این ۸ عنصر ندارد** — فقط مسیر Chart این را دارد. `documentUsesChartToolbar` هم فقط `chartListFetches` را چک می‌کند، نه `vizListFetches`، پس حتی import کامپوننت نوار ابزار هم اگر فقط ویجت‌های غیرنموداری از آن استفاده کنند صادر نمی‌شود.
**رفع:** `tsxVizPalette.ts` — تابع جدید `renderVizToolbarAttr` (دقیقاً معادل `renderChartToolbarAttr`) به هر ۸ شاخهٔ سوییچ `renderVizPaletteJsx` اضافه شد؛ `documentUsesChartToolbar` هم برای چک‌کردن `vizPlan.vizListFetches` علاوه بر `chartPlan.chartListFetches` گسترش یافت. **باگ جانبیِ تازه‌یافته:** حین این رفع مشخص شد که `vizFieldMapping`/`vizToolbarConfig` (که `buildVizBindingWizardActions` روی هر نود Viz باین‌دشده تنظیم می‌کند) هرگز از excludeKeys این ۸ شاخه کنار گذاشته نشده بودند — دقیقاً همان کلاس باگی که قبلاً برای Chart رفع شده بود (`chartFieldMapping`/`chartToolbarConfig`) — یعنی هر ویجت غیرنموداری Viz باین‌دشده‌ای، صرف‌نظر از نوار ابزار، از قبل یک خطای واقعیِ type-check در بستهٔ Export تولید می‌کرد. هر دو با هم رفع شدند. تست رگرسیون: `vizNonChartToolbarCodegen.test.ts` (۱۶ تست — هر ۸ ویجت × ۲ سناریو: نوار ابزار فعال + بدون نوار ابزار، هر دو با تأیید نشتی صفر). تأیید کامل: تایپ‌چک تمیز، سوییت‌های مرتبط سبز (۱۳۲ تست)، و اجرای کامل سوییت `src/domain/component-designer` دقیقاً منطبق با baseline (۴۷/۴۷).

**`viz.chart-bar`/`chart-line`/`chart-pie`/`chart-sparkline` — رنگ/برچسب سفارشی هر سری در Export مرده (رفع شد ✅)**
ویزارد Chart یک ویرایشگر واقعی «Legend label» و «Color» به‌ازای هر سری دارد. Preview این‌ها را محاسبه و به کامپوننت نمودار پاس می‌دهد. Export این دو prop (`seriesColors`/`seriesLabels`) را **هرگز صادر نمی‌کرد** — چارت منتشرشده همیشه به رنگ پیش‌فرض بر اساس اندیس و برچسب خام نام فیلد برمی‌گشت، حتی اگر کاربر رنگ/برچسب سفارشی تنظیم کرده بود.
**رفع:** `tsxVizPalette.ts`'s `renderChartJsx` — چون field mapping کامل در زمان codegen شناخته‌شده است، `resolveChartSeriesColorsFromMapping`/`resolveChartSeriesLabelsFromMapping` (همان توابع خالصی که Preview هم استفاده می‌کند) مستقیماً در زمان build صدا زده می‌شوند و به‌صورت prop لیترال واقعی (`seriesColors={{...}}`/`seriesLabels={{...}}`) صادر می‌شوند — نیازی به منطق runtime اضافه نبود. تست رگرسیون: `chartSeriesColorsLabelsExportFix.test.ts` (رنگ/برچسب سفارشی صادر می‌شود، حالت بدون باین‌دینگ فاقد این attributeهاست، و `chartFieldMapping` خام هنوز نشت نمی‌کند). تأیید کامل: تایپ‌چک تمیز، سوییت‌های مرتبط سبز (۹۹ تست).

**`viz.gantt` — فیلد progressField در Export حذف می‌شود (رفع شد ✅)**
توابع تبدیل داده‌ی ویجت‌های غیرنموداری (tree/timeline/kanban/sheet) دو نسخه دارند: نسخه‌ی اصلی در `visualizationDataTransform.ts` (استفاده‌ی Preview) و یک بازنویسی دستیِ رشته‌ای در `bindingApiCodegen.ts` که داخل هر باندل صادرشده inline می‌شود. برای Timeline/Gantt، نسخه‌ی Preview فیلد `progress` را از `mapping.progressField` می‌سازد؛ نسخه‌ی inline‌شده‌ی Export اصلاً این فیلد را در نوع و در خروجی نداشت. نتیجه: نوار پیشرفت داخلی Gantt در نسخه‌ی زنده درست پر می‌شد، ولی در نسخه‌ی منتشرشده همیشه کامل یا خالی بود. (نکته‌ی جانبی: هارنس تست parity این پروژه مستقیماً تابع Preview را import می‌کند، نه رشته‌ی واقعی inline‌شده‌ی Export — به همین دلیل این واگرایی هرگز توسط تست‌ها گرفته نشده بود.)
**رفع:** `bindingApiCodegen.ts`'s `transformApiRowsToTimelineEvents` (نسخه‌ی inline‌شده) حالا `progressField` را در نوع `mapping` دارد و `progress` را با کمک هلپر جدید `readVizNumberField` محاسبه می‌کند، دقیقاً مطابق نسخه‌ی واقعی Preview.
**باگ ریشه‌ای بزرگ‌تر (کشف‌شده حین رفع این مورد، خیلی مهم‌تر از خود progressField):** هنگام نوشتن تست رگرسیون این مورد، مشخص شد که خروجی Export یک چارت/ویجت باین‌دشده اصلاً هیچ `data=` attribute‌ای نداشت — نه مقدار واقعی باین‌دشده، نه حتی fallback استاتیک mock! ریشه: در `tsxVizPalette.ts`، هم `renderChartJsx` هم `renderBoundVizDataAttr` تابع `resolveBoundAttributeForNodeProp` را با کل آبجکت `node` صدا می‌زدند نه `node.id` (که امضای تابع رشته می‌خواهد). در نتیجه مقایسه‌ی داخلی `item.nodeId === nodeId` همیشه `string === object` بود یعنی همیشه false، جستجوی باین‌دینگ همیشه شکست می‌خورد و رشته‌ی خالی `''` برمی‌گشت — و چون `''` نال/undefined نیست، `boundDataAttr ?? fallback` مقدار خالی را نگه می‌داشت به‌جای افتادن روی fallback استاتیک. یعنی **هر چارت و هر ویجت Viz باین‌دشده به یک API واقعی، در نسخه‌ی منتشرشده کاملاً بدون داده (نه حتی داده‌ی نمونه) رندر می‌شد** — این دقیقاً ریشه‌ی همان مشکلی است که کاربر از ابتدا گزارش داده بود («با چارت‌ها بتونم گزارش بسازم و دیتا رو bind کنم»). رفع: هر دو محل با `node.id` به‌جای `node` صدا زده می‌شوند. تست‌های رگرسیون: `chartVizBoundDataAttrRootCauseFix.test.ts` (chart-bar + tree-view، هر دو با تأیید واقعی expression باین‌دشده در tsx تولیدشده)، به‌علاوه‌ی `vizGanttProgressFieldExportFix.test.ts` که با `esbuild.transformSync` هلپر inline‌شده‌ی واقعی را strip-type کرده و اجرا می‌کند تا صحت رفتاری (نه فقط متنی) progressField را با ردیف‌های واقعی تأیید کند. تأیید کامل: تایپ‌چک تمیز، همه‌ی سوییت‌های viz/chart مرتبط سبز (بیش از ۲۰۰ تست در مجموع).

---

## ۷ب. بررسی تکمیلی و عمیق‌تر — توانمندی «ساخت گزارش/داشبورد با نمودار» و ریشه‌ی واقعیِ خرابیِ فیلتر/جستجو در Preview

این بخش پاسخ به یک بررسی مجدد و اختصاصی است: آیا با نمودارهای موجود می‌شود هر گزارشی ساخت، به داده‌ی واقعی Bind کرد، و فیلتر/جستجو/داشبورد واقعاً درست کار کند؟ نتیجه، پس از ردیابی کامل مسیر کد (نه فقط مقایسه‌ی Preview در برابر Export مثل بخش‌های قبلی، بلکه ردیابی این‌که «رفرش/فیلتر واقعاً چه کسی را صدا می‌زند» تا انتهای زنجیره): **یک باگ معماریِ واحد و ریشه‌ای پیدا شد که دقیقاً همان چیزی است که شما در Preview تجربه کرده‌اید، و روی هم نمودارها هم Data Grid/App Table Grid اثر می‌گذارد.**

### ریشه‌ی باگ (تأییدشده با ردیابی کامل زنجیره‌ی کد، نه حدس)

Designer دو محیط «Preview» جداگانه دارد که هردو از این باگ رنج می‌برند، به دو دلیل متفاوت:

**۱) بوم طراحی زنده (Live Editing Canvas) — نمودارها اصلاً هیچ داده‌ی واقعی‌ای دریافت نمی‌کنند**
`buildCanvasNodeRuntimeOptions` در `src/features/component-designer/canvas/canvasNodes.tsx` (خط ۳۶۷ به بعد) — تابعی که برای **هر** نودی که در بوم طراحی رندر می‌شود `RuntimeRenderOptions` می‌سازد — هرگز `chartRows`, `chartListBound`, `vizRows`, `vizListBound`, `onChartRefresh`, یا `onVizRefresh` را تنظیم نمی‌کند. برخلاف Grid/App Table Grid که یک مسیر اختصاصی و جداگانه برای Hydration زنده دارند (`DesignerCanvasHydratedDataGrid.tsx` + هوک `useDesignerGridListRows`)، **هیچ معادلی برای نمودار یا هر ویجت Viz دیگر وجود ندارد.** نتیجه: در بوم طراحی، `chartListBound`/`vizListBound` همیشه false می‌ماند، و `resolveChartPropsFromNode`/`resolveBoundVizDataValue` همیشه به داده‌ی استاتیک/mock برمی‌گردند (`designerVizRuntimeResolve.tsx:72-76`) — یعنی حتی اگر یک نمودار را به یک API واقعی Bind کنید، در بوم طراحی همیشه فقط داده‌ی نمونه (mock) نمایش داده می‌شود. طبیعی است که تایپ‌کردن در جعبه‌ی جستجو هیچ اثری نداشته باشد — چون اصلاً داده‌ی واقعی‌ای برای فیلتر کردن وجود ندارد.

**۲) صفحه‌ی Preview جداگانه («اجرای پیش‌نمایش») — داده یک عکس فوری ثابت است، نه یک جریان زنده**
صفحه‌ی Preview مجزا (`ComponentDesignerOutlinePreviewPage.tsx`) این‌طور کار می‌کند:
1. یک‌بار، هنگام باز شدن، یک mutation بک‌اندی (`useRunComponentDesignerPreviewMutation`, در `useDesignerPreview.ts:65-105`) همه‌ی Bindingهای سند را روی سرور اجرا می‌کند و یک آبجکت `results` ثابت برمی‌گرداند.
2. این نتیجه در یک session ذخیره می‌شود (`stashDesignerPreviewSession`) و صفحه‌ی Preview آن را می‌خواند (`sessionPayload?.previewResults`, خط ۱۷۹ همان فایل) و به‌عنوان `previewResults` به `DesignerPreviewViewport` پاس می‌دهد.
3. **در سراسر `src/features/component-designer/`، هیچ‌جا تابع واقعی `refreshDataSource` پیاده‌سازی و به `renderDesignerDocumentPreview` پاس داده نمی‌شود** (جست‌وجوی کامل انجام شد — فقط در فایل‌های تست/harness این پیاده‌سازی واقعی وجود دارد، نه در کد محصول). یعنی وقتی کاربر در نوار ابزار نمودار جستجو می‌کند یا فیلتری را عوض می‌کند:
   - `DesignerChartRuntimeToolbar` مقدار را در `designerStore` محلی پچ می‌کند — این بخش UI درست کار می‌کند (چیزی که تایپ می‌کنید در جعبه‌ی جستجو دیده می‌شود).
   - بعد `onFilterApplied` صدا زده می‌شود که باید رفرش واقعی داده را triggr کند (`designerVizRuntimeResolve.tsx:48-50`: `window.setTimeout(() => onRefresh?.(), 0)`).
   - اما `onRefresh` (که از `resolveChartRefresh`/`resolveVizRefresh` در `designerRuntimePreview.tsx:1033-1056` می‌آید) فقط زمانی یک تابع واقعی برمی‌گرداند که `options.refreshDataSource` موجود باشد — که هرگز نیست. پس `onRefresh` همیشه `undefined` است و کل زنجیره‌ی رفرش یک no-op بی‌صدا است.
   - نتیجه: داده‌ی نمایش‌داده‌شده همان عکس فوری اولیه‌ی گرفته‌شده در لحظه‌ی باز شدن صفحه باقی می‌ماند، برای همیشه — صرف‌نظر از هرچه در نوار جستجو/فیلتر تایپ یا انتخاب کنید.

**این دقیقاً همان چیزی است که «فیلتر و سرچ درست کار نمی‌کند» را توضیح می‌دهد — و منحصر به نمودار نیست.** با ردیابی مشابه، `useDesignerGridListRows` (هوک Hydration زنده‌ی Grid در بوم طراحی) هم همین مشکل را دارد: آرایه‌ی وابستگی `useEffect`ش فقط `[gridDataVar, hydrationPlanKey]` است — هیچ مقدار Store/جستجو/فیلتری در آن نیست — و حتی `designerStore` مصرفی‌اش را از صفر با `buildPreviewDesignerStore(bindingDefinitions)` می‌سازد، نه از `designerStore` زنده‌ی واقعی بوم طراحی. یعنی Grid هم در بوم طراحی فقط یک‌بار (در لحظه‌ی mount) فچ می‌شود و به تغییرات فیلتر/جستجوی کاربر هیچ واکنشی نشان نمی‌دهد.

### خبر خوب: کد Export/منتشرشده از این باگ در امان است (تأییدشده)

برخلاف هر دو محیط Preview، در کد Export یک هوک واقعی `useDataFetch` تولید می‌شود که URL آن مستقیماً و به‌صورت inline از `designerStore` ساخته می‌شود (`renderChartListFetchHookLines`, `bindingCodegen.ts:630-660`؛ همین الگو برای Grid/App Table Grid هم صادق است). وقتی مقدار جستجو در Store تغییر می‌کند، رشته‌ی URL محاسبه‌شده هم عوض می‌شود؛ `useDataFetch`ی که این سشن پیش‌تر بررسی و تست شده (وابستگی‌های `useEffect` آن شامل `url` است) این تغییر را می‌بیند و **خودکار و بدون نیاز به صدا زدن صریح refresh** دوباره فچ می‌کند. یعنی **در برنامه‌ی واقعی منتشرشده، جستجو/فیلتر روی نمودار/گرید/ویجت Viz درست کار می‌کند** — این باگ فقط داخل ابزار دیزاینر (چه بوم طراحی، چه صفحه‌ی Preview مجزا) وجود دارد، نه در محصول نهایی.

### نتیجه برای «ساخت گزارش/داشبورد»
- باین‌دینگ داده (نگاشت فیلد/سری، تبدیل API rows به شکل نمودار) خودش سالم و کامل است (تأییدشده در جدول‌های بالا).

### وضعیت رفع (به‌روزرسانی)

**✅ بخش (الف) — بوم طراحی زنده: رفع شد و تأیید شد.** یک هوک عمومی جدید `useDesignerHydratedRows` (در `useDesignerHydratedRows.ts`) نوشته شد که به‌جای ساختن یک `designerStore` تازه‌ی پیش‌فرض، `designerStore` زنده‌ی واقعی بوم طراحی را می‌پذیرد و URL/کلید کش را از روی آن (با `resolveHydrationTargetUrl`/`buildHydrationTargetCacheKey` که از قبل وجود داشتند) می‌سازد — یعنی با هر تغییر مقدار Store مرتبط (جستجو/فیلتر/تاریخ)، فچ دوباره واقعاً انجام می‌شود. کامپوننت جدید `DesignerCanvasHydratedVizWidget.tsx` (هم‌ارز `DesignerCanvasHydratedDataGrid.tsx`) برای Chart/Viz در `canvasNodes.tsx` سیم‌کشی شد، و `DesignerCanvasHydratedDataGrid.tsx` هم برای استفاده از همین هوک به‌روزرسانی شد. یک `refresh()` واقعی هم برای دکمه‌ی Refresh نوار ابزار اضافه شد. با تست‌های واقعی (`useDesignerHydratedRows.test.tsx`) تأیید شد: تغییر مقدار جستجو در Store واقعاً یک فچ جدید با query param درست تولید می‌کند، برای هم Chart هم Grid/App Table Grid.

**✅ بخش (ب) — صفحه‌ی Preview مجزا: رفع شد ✅ (تأیید شد که قبلاً کار می‌کرده، تست دائمی اضافه شد).** ادعای قبلی «deferred/خراب چون `refreshDataSource` هیچ‌جا پیاده نشده» نادرست بود — آن جست‌وجو فقط `src/features/component-designer/` را پوشش داده و مکانیزم داخلی `DesignerDocumentPreview` در `src/domain/component-designer/designerRuntimePreview.tsx` را از قلم انداخته بود. این کامپوننت خودش `hydrationTargets` را جمع می‌کند، با `dynamicHydrationStoreKey` به تغییرات Store (از جمله `gridToolbar.search`) واکنش نشان می‌دهد، و از `resolveHydrationTargetUrl` (نه `resolveBindingUrl`ی Export) URL واقعی با query param می‌سازد. تأیید مستقل فاز ۱۰: تست دائمی `previewPageHydrationRefreshItem0bVerification.test.tsx` با mock `fetch` + `fireEvent` تایپ در جستجو ثابت کرد فچ دوم با `search=alice` واقعاً ارسال می‌شود. نکته: مسیر جداگانه‌ی `previewResults` از mutation بک‌اند (`/api/component-designer/preview/runtime`) همچنان یک عکس فوری اولیه برای برخی فیلدهای unbound است، ولی hydration زنده‌ی گرید/چارت/ویجت‌های bound از مسیر کلاینت‌محور بالا مستقل و سالم است.

---

## ۸. دسته‌های پویا — Shell Chrome، Platform Navigation، Platform Slots، Reusable Components

### وضعیت سالم (تأییدشده)
۱۳ قالب ساختاری Shell Chrome (sidebar, header, header-region, sidebar-nav-tree/mega/drawer, top-nav-bar, footer-links, sticky-action-bar, route-outlet, app-layout) — همگی فقط درخت فرزند می‌کارند و فرزندانشان (platform-nav/system-slot) از مسیر واقعی مشترک رندر می‌شوند. `shell.chrome.slot-logo`, `shell.chrome.slot-portal-menu`, `shell.chrome.slot-sidebar-toggle`. هر ۵ آیتم Platform Navigation. ۷ از ۱۲ اسلات پلتفرم (route-outlet, nav-top/side/footer, logo, portal-menu, sidebar-toggle). `shell.error-page`/`shell.not-found` (فیکس لینک «Go to dashboard» این سشن درست تأیید شد؛ بقیه‌ی محتوای این دو قالب عمداً ثابت است، نه باگ). وضعیت deferred بودن `reusable.component.*` دوباره تأیید شد — هیچ پیاده‌سازی جزئی‌ای که وضعیتش عوض شده باشد پیدا نشد.

### باگ‌های تازه‌یافته

**`platform.slot.core.shell.header` (و alias آن `shell.chrome.slot-header-actions`) — تنظیمات هدر در بوم طراحی و Export نادیده گرفته می‌شوند**
فیلدهای `showLogo`/`showBreadcrumb`/`showActions` واقعاً در Inspector هستند. در **صفحه‌ی زنده‌ی منتشرشده** درست کار می‌کنند (`extractShellHeaderConfigFromDocument` این‌ها را می‌خواند و به `ShellHeaderChromeSlot` پاس می‌دهد). اما `DesignerSlotPreview.tsx` — همان کامپوننتی که هم بوم طراحی هم Export مستقیماً از آن استفاده می‌کنند — شاخه‌ی هدرش (`case SHELL_CHROME_HEADER`) هیچ config ای پاس نمی‌دهد (برخلاف شاخه‌ی logo‌ی درست بالای همان فایل که `resolveShellLogoConfigFromProps(slotProps)` را صدا می‌زند). یعنی هدر همیشه با هر سه پرچم روی true (پیش‌فرض) نمایش داده می‌شود، صرف‌نظر از تنظیمات Inspector — هم در بوم طراحی هم در کد منتشرشده.

**۴ اسلات عمومی پلتفرم (`core.sidebar.navigation`, `core.dashboard.widgets`, `core.settings.sections`, `core.toolbar.actions`) — محتوای واقعی هرگز در Preview زنده/صفحه‌ی منتشرشده نمایش داده نمی‌شود**
بوم طراحی و Export هردو از `DesignerSlotPreview.tsx` استفاده می‌کنند که واقعاً `slotRegistry.getComponents(slotId)` را می‌خواند و کامپوننت‌های ثبت‌شده‌ی واقعی را رندر می‌کند — درست. اما `designerRuntimePreview.tsx` (موتور رندر Preview تعاملی/صفحه‌ی منتشرشده) اصلاً هیچ ارجاعی به `slotRegistry` ندارد — فقط `context.runtimeSlots?.{routeOutlet,navRegions,chromeSlots}` را چک می‌کند که هیچ‌کدام این ۴ اسلات را در بر نمی‌گیرند. نتیجه: اگر کاربر «Dashboard Widgets» (یا Sidebar Navigation/Settings Sections/Toolbar Actions) را روی یک صفحه بکشد و منتشر کند، ویجت‌های واقعی ثبت‌شده‌ی پلاگین **هرگز** روی صفحه‌ی زنده نمایش داده نمی‌شوند — فقط جعبه‌ی بنفش placeholder، برای همیشه. جهت این باگ برعکس بقیه‌ی جدول است: بوم طراحی و Export درست‌اند، Preview زنده/صفحه‌ی منتشرشده خراب است.

---

## ۹. جمع‌بندی نهایی

- **تعداد کل باگ‌های تازه‌یافته و تأییدشده‌ی این دور:** ۲۷ مورد مجزا (که چند مورد روی چند عنصر خواهر همزمان اثر دارند) + یک باگ ریشه‌ایِ معماری (مورد ۰).
- **الگوی غالب:** بیش‌تر این باگ‌ها یا (الف) فیلدهای Inspector که روی کامپوننت واقعی `@heroui/react` هیچ variant متناظری ندارند (تأییدشده مستقیم از سورس `@heroui/styles`)، یا (ب) فیکس‌های موضعیِ دور قبل که به عناصر خواهرِ دارای همان الگو تعمیم داده نشده بودند، یا (پ) مسیر Preview تعاملی که برای برخی خانواده‌های ویجت (Universal widgets، اعتبارسنجی زنده‌ی فرم) اصلاً به مکانیزم عمومی باین‌دینگ preview وصل نشده.
- **بدون تغییر از دور قبل:** `reusable.component.*` هنوز نیازمند تصمیم محصول/زیرساخت جدید بک‌اند است (سند `19-REUSABLE-COMPONENT-RESOLUTION-ENGINE.md`)؛ اتصال واقعی `shell.error-page`/`shell.not-found` به مکانیزم واقعی ۴۰۴/خطای برنامه هنوز نیازمند رجیستری جدید و تصمیم محصول است.

### وضعیت رفع

**همه‌ی ۲۸ مورد دور اول (۰ تا ۲۷) رفع شدند و با رگرسیون کامل تأیید شدند ✅** — شامل بخش ب مورد ۰ (صفحه‌ی Preview مجزا) که در فاز ۱۰ **تأیید شد قبلاً کار می‌کرده** (مکانیزم `DesignerDocumentPreview` hydration؛ تست: `previewPageHydrationRefreshItem0bVerification.test.tsx`) — رجوع به ۱۰.۷.۳. تک‌تک این ۲۷ مورد + باگ ریشه‌ای، یک یا چند تست رگرسیون اختصاصی دارند (فایل‌های `*ExportFix.test.ts(x)`/`*BindingFix.test.tsx`/`deadFieldsRemovalItems19to26.test.tsx` و غیره در `src/domain/component-designer/__tests__/`)، و در حین رفع تأیید شد: `npx tsc --noEmit -p .` صفر خطا، و اجرای کامل سوییت `src/domain/component-designer` دقیقاً منطبق با baseline (صفر رگرسیون جدید).

**✅ دور دوم (بخش ۱۰) هم کامل شد.** همه‌ی ۷۲ آیتم نقشه‌ی فازها (۲۸–۹۹ + بازبینی ۰ب) در فازهای ۱–۱۲ رفع یا به‌عنوان تصمیم محصولی آگاهانه deferred شدند، و فاز ۱۳ تأیید سراسری + گواهی آمادگی Production را صادر کرد — رجوع به بخش‌های ۱۰.۱۰ و ۱۱.

---

## ۱۰. دور دوم ممیزی — بازبینی کامل خط‌به‌خط پیش از پرداکشن

### ۱۰.۰ روش‌شناسی این دور

به درخواست صریح کاربر برای اطمینان کامل از آماده‌بودن برای پرداکشن، این دور با **۱۲ ایجنت مستقل** (هرکدام یک خوشه یا زیرخوشه از المنت‌ها/زیرساخت) به‌صورت موازی اجرا شد. هر ایجنت مأمور بود:
1. هیچ ادعای قبلی (حتی ادعاهای «رفع شد ✅» همین سند) را بدون بازبینی مستقیم کد فعلی نپذیرد.
2. برای هر فیلد Inspector هر عنصر، مسیر خوانده‌شدن را در هر سه مسیر رندر (بوم طراحی، Preview تعاملی، Export) ردیابی کند.
3. برای فیلدهای متصل به کامپوننت واقعی `@heroui/react`، تعریف واقعی prop/variant را از سورس واقعی در `node_modules` بخواند — نه حدس بزند.
4. در موارد مبهم، یک probe test موقت بنویسد، اجرا کند، نتیجه را ثبت کند، و فایل را حذف کند (بدون تغییر دائمی در سورس).
5. سطح اطمینان هر یافته را صریحاً اعلام کند.

چند ایجنت (Forms & Inputs، HeroUI Data Display/Grid) خودشان کار را به زیرایجنت‌های موازی تقسیم کردند. چند تلاش به‌خاطر قطعی اتصال/محدودیت session میان‌راه شکست خورد و از نو (با context کامل) اجرا شد؛ نتایج نهایی همگی از اجرای کامل و موفق به‌دست آمده‌اند.

**نکته‌ی حیاتی روش‌شناسی که از این دور آموخته شد:** بسیاری از تست‌های رگرسیونِ دور اول (ازجمله تست‌های خودِ من) فقط **متن رشته‌ای کد تولیدشده** را با `toContain`/`toMatch` چک می‌کنند، نه **اجرای واقعی** آن کد را. این باعث شد حداقل یک باگ بسیار حیاتی (۱۰.۱، ردیف ۱) کاملاً زیر رادار دور اول بماند چون تست مربوطه سبز بود ولی تابع واقعی هنگام اجرا کاری که ادعا می‌شد را انجام نمی‌داد. برای رفع موارد این بخش، **تست‌ها باید تابع واقعی را اجرا کنند و خروجی واقعی (URL نهایی، مقدار state، DOM) را بررسی کنند**، نه فقط الگوی متنی کد تولیدی.

### ۱۰.۱ خلاصه‌ی مدیریتی — باگ‌های بحرانی (اولویت فوری، پیش از هر چیز دیگر)

| # | یافته | اثر | اطمینان |
|---|---|---|---|
| ۲۸ | **در Export، پارامترهای toolbar (جستجو/فیلتر/سورت/صفحه) هرگز به query string واقعی URL نمی‌رسند** — `resolveBindingUrl` فقط placeholder های `{name}` را جایگزین می‌کند، هیچ منطقی برای الحاق `?key=value` ندارد. روی **چارت‌ها، گریدها، و همه‌ی ویجت‌های Viz** در برنامه‌ی منتشرشده اثر می‌گذارد — یعنی همان مشکل اصلی کاربر («فیلتر/جستجو در پرداکشن کار نمی‌کند») بعد از انتشار همچنان پابرجاست، حتی بعد از رفع مورد ۹ (بخش الف) و مورد ۶. مسیر Preview/بوم طراحی درست است (از `resolveHydrationTargetUrl` با `URLSearchParams` واقعی استفاده می‌کند). **(رفع شد ✅)** | بحرانی‌ترین یافته‌ی کل ممیزی | خیلی بالا (تأیید مستقل با خواندن کد + دو ایجنت جدا) |
| ۲۹ | **Export: `heroui.input-text`/`heroui.number-input`/`heroui.textarea` مستقیماً پرایمیتیو خام `@heroui/react` (`Input`/`TextArea`) را import می‌کنند، نه wrapper غنی داخلی (`UiInput`/`UiTextarea`)** — label/description/validation/adornment کاملاً غایب‌اند در برنامه‌ی منتشرشده، و چون `defaultProps` همیشه `size:'sm'` دارد، **هر سند صادرشده‌ای که این سه عنصر پرکاربردترین را داشته باشد کامپایل TypeScript را می‌شکند** (تأیید با اجرای واقعی `tsc --noEmit`). **(رفع شد ✅)** | بحرانی — رایج‌ترین عناصر فرم در کل ابزار | خیلی بالا (تأیید با `tsc` واقعی) |
| ۳۰ | **`heroui.app-table-grid`: صفحه‌بندی سمت-سرور واقعی در صفحه‌ی ۲ به بعد ردیف خالی نشان می‌دهد** — `sliceDataGridRowsForDisplay` دو شاخه‌ی if/else کاملاً یکسان دارد (شرط مرده)؛ `start` بر اساس اندیس کل دیتاست محاسبه می‌شود در حالی‌که سرور فقط همان صفحه را برمی‌گرداند. **(رفع شد ✅)** | بحرانی برای هر گریدی که واقعاً به بک‌اند صفحه‌بندی‌شده وصل است | خیلی بالا (تجربی) |
| ۳۱ | **`heroui.autocomplete` واقعی HeroUI روی پرایمیتیو `Select` ساخته شده، نه `ComboBox`** — یعنی در هیچ‌یک از سه مسیر (نه فقط Export) هرگز امکان تایپ برای جست‌وجوی واقعی وجود نداشته، با وجود placeholder گمراه‌کننده‌ی «Search…». ریشه‌ی مستقیم مورد ۳۲. **(رفع شد ✅ — گزینه‌ی الف)** | معماری/بحرانی برای autocomplete و entity-picker | خیلی بالا (تأیید از سورس واقعی heroui) |
| ۳۲ | **`heroui.entity-picker`: جست‌وجوی زنده در هر سه مسیر کاملاً غیرفعال است** — Canvas/Preview فقط یک آیتم ثابت نمونه نشان می‌دهد؛ Export زیرساخت fetch واقعی دارد ولی آن را به رویدادی (`onInputChange`) وصل می‌کند که کامپوننت واقعی اصلاً صدا نمی‌زند. ترکیب با نبود UI برای remap فیلدهای پاسخ API (شناسه/برچسب هارد-کد) یعنی این عنصر برای اکثر APIهای واقعی عملاً کار نمی‌کند. **(رفع شد ✅ — گزینه‌ی الف + remap فیلد)** | بحرانی | خیلی بالا |
| ۳۳ | **`form.html-editor` هیچ `name` روی عنصر رندر نمی‌کند** — در فرم‌های متصل به Data Region، محتوای HTML هرگز در payload ارسالی گنجانده نمی‌شود (نه Preview نه Export). اعتبارسنجی زنده‌ی onBlur هم برای این عنصر کاملاً غیرفعال است (سیم‌کشیِ لایه‌ی مشترک به کامپوننت واقعی نمی‌رسد). **(رفع شد ✅)** | بحرانی برای هر فرم شامل rich-text | خیلی بالا (تجربی) |
| ۳۴ | **ویرایش «Store Write Path» در Inspector یک فرم Submit ساخته‌شده با ویزارد را بی‌صدا از زنجیره‌ی موفقیتش (رفرش/toast/reset/بستن مودال) خالی می‌کند** — `commitRegionSubmit` کل definition را با یک نسخه‌ی بدون `trueActions` جایگزین می‌کند، بدون هیچ هشدار. **(رفع شد ✅)** | بحرانی — یک تعامل کاملاً معمولی کاربر باعث از دست رفتن رفتار می‌شود | بالا |
| ۳۵ | **در Interactive Preview، زنجیره‌ی اکشن موفقیت حتی روی شکست واقعی mutation هم اجرا می‌شود** — `executeDesignerMutation` روی خطای HTTP فقط `onError` را صدا می‌زند و به‌طور عادی return می‌شود (نه throw)؛ `.then(...)` بدون قید همیشه اجرا می‌شود. کد Export این باگ را ندارد (throw واقعی دارد). **(رفع شد ✅)** | بحرانی — رفتار QA در Designer با رفتار واقعی پرداکشن فرق دارد | بالا |
| ۳۶ | **`refreshDataSource` در Export همیشه یک fetch شبح مستقل می‌سازد، نه رفرش گرید/ریجن واقعی** — نام‌گذاری متغیر رفرش کاملاً مستقل از نام‌گذاری fetch واقعی گرید است؛ دکمه‌ی «رفرش بعد از ذخیره» در پرداکشن گرید نمایان‌شده را رفرش نمی‌کند. تأیید تجربی با تولید TSX واقعی. **(رفع شد ✅)** | بحرانی برای هر صفحه‌ی List+Create/Edit | خیلی بالا (تجربی) |

**۲۸ — رفع:** Codegen قبلاً `queryParams` toolbar را درست به `resolveBindingUrl(..., paramPaths)` پاس می‌داد، ولی خودِ تابع (نسخه‌ی امبدشده در `bindingApiCodegen.ts` و نسخه‌ی runtime در `bindingMutationRuntime.ts`) فقط جایگزینی `{name}` را انجام می‌داد و کلیدهای باقی‌مانده را نادیده می‌گرفت. `resolveBindingUrl` حالا پس از resolve مسیر، کلیدهای استفاده‌نشده را با `URLSearchParams` به query string واقعی الحاق می‌کند (حذف `undefined`/`null`/خالی، و `&` وقتی URL از قبل `?` دارد) — هم‌ارز `resolveHydrationTargetUrl`. منطق query **عمداً فقط داخل `resolveBindingUrl`** است، نه `resolveBindingTemplateValue`، تا `resolveBindingHeaders` (که همان helper مسیر/placeholder را برای مقادیر header صدا می‌زند) هرگز پسوند `?key=value` نگیرد. تست رگرسیون رفتاری (اجرای واقعی helper با `esbuild.transformSync`، نه فقط `toContain` متنی): `bindingApiCodegenQueryStringRootCauseFix.test.ts`.

**۲۹ — رفع:** `tsxComponentRegistry.ts` این سه عنصر را مثل `heroui.select` به `UiInput`/`UiTextarea` از `@/shared/ui/HeroFieldControls` نگاشت می‌کند (به‌جای پرایمیتیو خام `Input`/`TextArea` از `@heroui/react`)، و `tsxNodeRenderer.ts` همان تگ‌ها را با `label`/validation/adornment/`min`/`max`/`step` امیت می‌کند. قرارداد `UiInput`/`UiTextarea` در `HeroFieldControls.tsx` برای `label` (برچسب مرئی label-over-input)، `min`/`max`/`step` (number-input)، و `maxRows` گسترش یافت تا با Preview هم‌ارز باشد و `size="sm"` دیگر خطای TS2322 ندهد. `jsxReverseParser.ts` تگ‌های جدید را برای reverse-parse می‌شناسد. تست رگرسیون (شامل `tsc --noEmit` واقعی روی JSX تولیدشده): `rawHeroPrimitiveExportFix.test.tsx`.

**۳۰ — رفع:** `sliceDataGridRowsForDisplay` (`designerDataGridRuntime.ts`) در حالت `server` دیگر با آفست `(page-1)*pageSize` روی payload صفحه‌ی جاری برش نمی‌زند — کل `rows` برگشتی سرور را همان‌طور که هست نمایش می‌دهد؛ برش کلاینتی فقط در `gridQueryMode === 'client'` باقی ماند. تست رگرسیون: `appTableGridPhase3ParityFix.test.ts` + به‌روزرسانی `designerDataGridRuntime.test.ts`.

**۳۴ — رفع:** `commitRegionSubmit` در `InspectorEventBindingPanel.tsx` دیگر با `createRegionSubmitEventBindingDefinition(targetEvent)` از صفر ساخته نمی‌شود؛ definition فعلی نود (شامل `trueActions`/`invalidateQueries`) spread می‌شود و فقط `storeWritePath` override می‌گردد. تست رگرسیون: `regionSubmitStoreWritePathPreservesActionsFix.test.ts`.

**۳۵ — رفع:** `executeDesignerMutation` روی HTTP/network failure بعد از `onError` واقعاً reject می‌کند و `Promise<boolean>` برمی‌گرداند؛ `bindingPreviewHandlers.ts` فقط وقتی mutation با `true` resolve شود `runDynamicActionsForBinding` را صدا می‌زند (`.catch` خطای از‌قبل‌گزارش‌شده را می‌بلعد). هم‌ارز Export که روی `!response.ok` throw می‌کند. تست رگرسیون: `mutationSuccessActionsOnlyOnOkFix.test.ts`.

**۳۶ — رفع:** `buildExistingDataSourceRefreshVarMap` + `resolveDynamicActions(..., existingRefreshVarByDataSourceId)` در `collectDocumentBindingPlan` باعث می‌شود `refreshDataSource` همان `refresh_<gridData|chartData|vizData|regionData>_…` زنده‌ی ویجت را صدا بزند؛ `collectDynamicActionDataSourceFetches` و `renderDynamicActionFetchHookLines` دیگر برای data sourceهای پوشش‌داده‌شده phantom hook نمی‌سازند. تست رگرسیون: `refreshDataSourceGhostFetchFix.test.ts` (+ `gridRefreshAfterMutationCodegen.test.ts` همچنان سبز).

**۳۳ — رفع:** `DesignerRichTextEditor` حالا `name`/`onBlur`/`onMouseEnter` را می‌پذیرد؛ یک `<input type="hidden" name={…} value={htmlValue}>` همیشه با آخرین HTML sanitize‌شده‌ی TipTap sync است (مثل Monaco/color/mask)، و blur/mouseEnter روی wrapper ادیتور به لایهٔ مشترک `resolveDesignerFormFieldBaseProps` می‌رسند. تست رگرسیون: `formFieldsFamilyPhase6Fix.test.tsx`.

### ۱۰.۲ HTML Primitives + Layout + Logic

**۳۷. Property Binding کاملاً مرده در Preview تعاملی برای فیلدهای «تگ»ِ ۴ عنصر HTML** — `html.form` (action/method/encType/target/autoComplete/noValidate/name)، `html.link` (href/target/rel/download/referrerPolicy)، `html.iframe` (src/title/width/height/allowFullScreen)، و بخشی از `html.image` (width/height/loading/decoding/srcSet/sizes). در `designerRuntimePreview.tsx` این فیلدها مستقیم از `node.props` خوانده می‌شوند، بدون عبور از `previewBindings`، درحالی‌که Export (`tsxNodeRenderer.ts`) این‌ها را درست از طریق `buildNodeJsxAttributesWithBindings` می‌سازد. یعنی Binding روی این فیلدها در Export کار می‌کند ولی در Preview بی‌اثر است — همان کلاس باگی که برای ~۱۰ عنصر دیگر در همین نشست رفع شد، اما این ۴ عنصر از قلم افتاده بودند. **اطمینان: بالا. (رفع شد ✅)**
**رفع:** شاخه‌های `form`/`link`/`iframe`/`image` در `designerRuntimePreview.tsx` حالا از `previewBindings.resolveTextProp` (الگوی file-upload accept/multiple) برای فیلدهای تگ استفاده می‌کنند؛ booleanها با مقایسه‌ی `"true"` حل می‌شوند. تست رگرسیون: `htmlTagFieldsPreviewBindingFix.test.tsx`.

**۳۸. `layout.split-pane`'s `direction`/`defaultSplit` — Binding در هر دو مسیر (Preview و Export) کاملاً مرده است** (نه فقط ناهماهنگی؛ یک قابلیت کاملاً غیرفعال). **اطمینان: بالا. (رفع شد ✅)**
**رفع:** Preview/Canvas از `resolveTextProp`/`resolveNumberProp` با پاس‌دادن `previewBindings` به `renderSplitPaneContainerNode` استفاده می‌کنند؛ Export وقتی bound است عبارت runtime برای `data-split-*`/className/style می‌سازد و نشتِ `direction=`/`defaultSplit=` مرده روی `<div>` در `resolveBoundAttributeForNodeProp` بسته شد. تست رگرسیون: `splitPaneDirectionBindingFix.test.tsx`.

**۳۹. `html.image`'s `fallbackSrc` در بوم طراحی (Canvas) اصلاً `onError` handler ندارد** — در Preview و Export درست کار می‌کند. شدت پایین (فقط محیط طراحی). **اطمینان: بالا. (رفع شد ✅)**
**رفع:** شاخه‌ی `case 'image'` در `canvasNodes.tsx` حالا همان `resolveMediaFallbackSrc` + `onError` swapِ Preview را دارد. تست رگرسیون: `htmlImageFallbackSrcCanvasFix.test.tsx`.

**۴۰. `logic.repeater`'s `itemAlias`/`indexAlias` بدون اعتبارسنجی شکل identifier** — فقط `.trim()` می‌شود؛ مقداری مثل `"my item"` یا `"1x"` یا کلمه‌ی رزرو‌شده می‌تواند کد TSX نامعتبر (خطای سینتکس esbuild) در Export تولید کند. Preview آسیب نمی‌بیند (فقط به‌عنوان کلید دسترسی به object استفاده می‌شود). **اطمینان: متوسط-بالا (edge case، نیاز به ورودی غیرمعمول کاربر). (رفع شد ✅)**
**رفع:** `sanitizeRepeaterAlias`/`isValidRepeaterAliasIdentifier` در `repeaterEngine.ts` مقدار نامعتبر را به `item`/`index` fallback می‌کند؛ `validation.ts` هشدار `invalid-repeater-alias` می‌دهد؛ placeholder Inspector محدودیت identifier را نشان می‌دهد؛ کد `ambiguous-repeater-alias` هم به یونین تشخیص اضافه شد. تست رگرسیون: `repeaterAliasIdentifierFix.test.ts`.

**تأیید موارد سالم:** `html.text`/`html.heading`/`html.link`/`html.list-item`'s فیلد `text` (بدون duplicate attribute)، `html.file-upload`'s `accept`/`multiple`، `html.form`'s `target` (مقدار استاتیک)، `logic.visibility-container`'s scope تودرتوی repeater (هر عمق)، `logic.repeater`'s `dataPath` با پیشوندهای `store./item.`، اتصال Repeater به Data Source واقعی — همگی با ردیابی کامل مسیر تأیید شدند سالم هستند.

### ۱۰.۳ HeroUI Forms & Inputs

#### گروه ورودی متنی (input-text/number-input/textarea/field-container/color-control)
- **مورد ۲۹ (بالا، بخش ۱۰.۱) — رفع شد ✅** — نشتِ پرایمیتیو خام در Export برای input-text/number-input/textarea؛ حالا `UiInput`/`UiTextarea`.
- **۴۱. `heroui.textarea` اصلاً اعتبارسنجی زنده‌ی onBlur/onChange ندارد** (نه کهنه — صفر؛ `runtimeRenderer.tsx`'s شاخه‌ی textarea از `resolveCanvasEventProps` خام استفاده می‌کند، نه `sharedFieldEventProps`). تأیید تجربی: `fireEvent.blur` هیچ فراخوانی‌ای تولید نمی‌کند. **اطمینان: خیلی بالا (تجربی). (رفع شد ✅)**
  **رفع:** شاخه‌ی `heroui.textarea` حالا مثل `input-text`/`number-input` از `sharedFieldEventProps` استفاده می‌کند (`event.target.value` زنده). تست: `formFieldsFamilyPhase6Fix.test.tsx`.
- **۴۲. `heroui.color-control`: مقدار کهنه (stale) در اعتبارسنجی onBlur** — `resolveDesignerFormFieldBaseProps`'s `resolvedValue` یک‌بار در هر رندر از `node.props.value` محاسبه می‌شود، نه از مقدار واقعی زمان blur؛ نتیجه: بعد از تایپ یک مقدار معتبر و blur، پیام خطای کاذب «الزامی است» نمایش داده می‌شود. تأیید تجربی. همین مکانیزم روی ۴ عنصر خواهر (code-editor/html-editor/mask-input/calculator) هم صدق می‌کند (بخش زیر). **(رفع شد ✅)**
  **رفع:** `resolveDesignerFormFieldBaseProps` یک live box دارد که با هر `onChange` آپدیت می‌شود و `onBlur` همان را validate می‌کند (نه `resolvedValue` بسته‌شده؛ و نه `event.target` — چون `type="color"` تو در تو مقدار پیش‌فرض غیرخالی می‌دهد). تست: `formFieldsFamilyPhase6Fix.test.tsx`.
- **۴۳. `heroui.color-control`: نشتِ ۱۰ فیلد Inspector (اعتبارسنجی + UX adornment) به‌صورت attribute نامعتبر در Export** — تأیید با اجرای واقعی `tsc --noEmit` (خطای `TS2322`). **(رفع شد ✅)**
  **رفع:** `renderDesignerFormFieldAttrs` کلیدهای `pattern/minLength/maxLength/validationRule/validationErrorMessage/startContent/endContent/isClearable/autoFocus/size/inputMode` را exclude می‌کند؛ برای html-editor کلیدهای toolbar هم exclude شدند تا با `renderDesignerRichTextToolbarJsxProps` تکراری نشوند. تست با `tsc` واقعی روی تگ‌های جداشده: `formFieldsFamilyPhase6Fix.test.tsx`.
- **۴۴. `heroui.color-control`: مقدار پیش‌فرض `value` در Export دوبار JSON-encode می‌شود** — خروجی واقعی `value={"\"#3B82F6\""}` به‌جای `value={"#3B82F6"}`؛ حتی بدون هیچ تنظیم دستی کاربر رخ می‌دهد (مقدار پیش‌فرض کاتالوگ). **اطمینان: خیلی بالا (تجربی، خروجی codegen واقعی بررسی شد). (رفع شد ✅)**
  **رفع:** `renderDesignerFormFieldAttrs` مقدار خام `staticValue` را به `reservedAttributes` می‌دهد تا مسیر عمومی یک‌بار encode کند (`value="#3B82F6"`). تست: `formFieldsFamilyPhase6Fix.test.tsx`.
- **۴۵. باینـدینگ روی `label`ی `heroui.field-container` هرگز resolve نمی‌شود** — در UI به‌عنوان bindable نشان داده می‌شود ولی در هر سه مسیر بی‌صدا نادیده گرفته می‌شود. **اطمینان: بالا (تحلیل کد). (رفع شد ✅)**
  **رفع:** Preview از `previewBindings.resolveTextProp(node, 'label', …)` استفاده می‌کند؛ Export عبارت Binding را داخل `<legend>` می‌گذارد و `label=` مرده را از `<fieldset>` strip می‌کند. تست: `formFieldsFamilyPhase6Fix.test.tsx`.

#### گروه select/autocomplete/entity-picker/tags-input
- **مورد ۳۱، ۳۲ (بالا، بخش ۱۰.۱) — رفع شد ✅ (گزینه‌ی الف):** واقعیت معماری پذیرفته شد — HeroUI Autocomplete روی `Select` است نه ComboBox. placeholderهای گمراه‌کننده به `Select…` / `Select entity…` تغییر کردند؛ `allowCustomValue` حذف شد (مورد ۹۲). Exportی `heroui.autocomplete` به `UiAutocomplete` مهاجرت کرد. برای entity-picker، fetch اولیه‌ی Export (بدون جست‌وجوی زنده) با `returnField`/`displayField` قابل remap حفظ شد. جست‌وجوی حقیقی ComboBox/Filter یک تغییر محصولی جداست و عمداً در این پاس انجام نشد.
- **۴۶. `heroui.entity-picker`: نگاشت فیلدهای LOV هارد-کد و بدون UI remap** (`record.id ?? record.value`, `record.textValue ?? record.label ?? record.name`) — برخلاف select/autocomplete/tags-input که از `bindingLovRegistry.ts`ی متمرکز و قابل‌تنظیم استفاده می‌کنند. اگر بک‌اند واقعی نام فیلد دیگری برگرداند، لیست همیشه بی‌صدا خالی می‌ماند. **(رفع شد ✅)**
  **رفع:** فیلدهای Inspectorی `returnField`/`displayField` اضافه شدند؛ `normalizeEntityPickerItems`/`useEntityPickerOptions` (نسخه‌ی inline Export) این نگاشت را می‌خوانند با fallback زنجیره‌ی قدیمی برای backward-compat. تست: `entityPickerLovFieldRemapPhase4Fix.test.ts` + `selectAutocompleteEntityPickerPhase4Fix.test.tsx`.
- **۴۷. `closeOnSelect` (select/autocomplete/entity-picker) — کاملاً مرده در هر سه مسیر، هر سه عنصر** — نام پراپ واقعی `shouldCloseOnSelect` است، نه `closeOnSelect`؛ همه‌جای کد (Inspector تا runtime تا Export) از نام غلط استفاده می‌کند. **(رفع شد ✅ — سپس بازبینی و تصحیح شد، به پایین مراجعه کنید)**
  **رفع (پاس اول، ناقص/غلط بود):** Inspector همچنان `closeOnSelect` را ذخیره می‌کرد؛ `resolveSelectMenuProps` و `JSX_ATTRIBUTE_NAME_OVERRIDES` و `HeroFieldControls` مقدار را به `shouldCloseOnSelect` نگاشت می‌کردند. تست: `selectAutocompleteEntityPickerPhase4Fix.test.tsx`.
  **بازبینی (Phase 4 verification pass) — یافته:** فرضِ «نام واقعی پراپ `shouldCloseOnSelect` است» برای `heroui.select`/`heroui.autocomplete`/`heroui.entity-picker` **غلط از آب درآمد**. با خواندن مستقیم `node_modules/@heroui/react/node_modules/react-aria-components` (نسخه‌ی ۱.۱۹.۰ که واقعاً نصب و استفاده می‌شود؛ نسخه‌ی ریشه‌ی `node_modules/react-aria-components` هم ۱.۱۷.۰ همین نتیجه را می‌دهد) تأیید شد: `shouldCloseOnSelect` **فقط** روی `Menu`/`MenuItem` و `DatePicker`/`DateRangePicker` واقعی است (`Menu.d.ts`, `DatePicker.d.ts`) — در `Select.d.ts`, `Autocomplete.d.ts`, و `ComboBox.d.ts` هیچ ردی از این پراپ نیست، و کد کامپایل‌شده‌ی `select.js`/`autocomplete.js` هم هیچ منطق «close» ای ندارد. `AutocompleteRoot` واقعی HeroUI مستقیماً `...props` را روی `Select` (از `react-aria-components/Select`) پخش می‌کند که همیشه popover را روی انتخاب می‌بندد، بدون هیچ override ممکن. یعنی رفع پاس اول فقط نام یک پراپ مرده را به نام یک پراپ مرده‌ی دیگر تغییر داد — هنوز کاملاً بی‌اثر بود روی کامپوننت واقعی، در هر سه مسیر. علاوه بر این، پیاده‌سازی حتی در جهت boolean هم ناهم‌راستا بود: `resolveSelectMenuProps` فقط مقدار `true` را forward می‌کرد (هرگز `false` را)، در حالی‌که `DesignerRuntimeSelect.tsx` (که مسیر Canvas/Preview select را با یک dropdown دستی/غیر-HeroUI پیاده می‌کند) هر دو جهت را درست مدیریت می‌کرد — و مسیر Export برای `heroui.entity-picker` (که `closeOnSelect` را exclude کرده و فقط با مقدار `true` دوباره اضافه می‌کرد) با مسیر عمومی Export برای `heroui.select`/`heroui.autocomplete` (که از طریق `JSX_ATTRIBUTE_NAME_OVERRIDES` هر دو جهت true/false را emit می‌کرد) ناهم‌راستا بود.
  **رفع نهایی:** فیلد «Close On Select» کاملاً از Inspector این سه عنصر حذف شد (دقیقاً هم‌الگو با حذف `allowCustomValue`، مورد ۹۲) — دیگر هیچ‌جا (`resolveSelectMenuProps`, `DesignerRuntimeSelect.tsx`, `propRegistry.ts`'s `JSX_ATTRIBUTE_NAME_OVERRIDES`, Export excludeKeys برای select/autocomplete/entity-picker) مقداری تحت هیچ‌کدام از دو نام (`closeOnSelect`/`shouldCloseOnSelect`) forward نمی‌شود؛ مقدار احتمالی از یک سند قدیمی هم دیگر به‌صورت attribute خام نشت نمی‌کند (exclude صریح در هر سه مسیر Export). `DesignerRuntimeSelect.tsx` حالا همیشه popover دستی‌اش را روی انتخاب می‌بندد (بدون شرط)، تا با آنچه واقعاً از Export قابل تولید است هماهنگ بماند. تست رگرسیون به‌روزشده: `selectAutocompleteEntityPickerPhase4Fix.test.tsx`, `runtimeNodeProps.test.ts`, `propRegistry.test.ts`, `inspectorPaletteCoverage.test.ts`.
- **۴۸. «Label»ی `heroui.select` کاملاً مرده در هر سه مسیر** — `DesignerRuntimeSelect.tsx` هرگز `node.props.label` را نمی‌خواند. **(رفع شد ✅)**
  **رفع:** Preview یک span label-over-input رندر می‌کند؛ `UiSelect` propی `label` گرفت؛ Export `label` را روی `<UiSelect>` امیت می‌کند.
- **۴۹. «Label»ی `heroui.autocomplete`/`heroui.entity-picker`: در Canvas/Preview نمایش داده می‌شود ولی در Export کاملاً ناپدید است** — نقض parity؛ Export مستقیم کامپوننت خام `Autocomplete` را (بدون هیچ برچسب مرئی) تولید می‌کند. **(رفع شد ✅)**
  **رفع:** autocomplete Export به `UiAutocomplete` (با label مرئی) مهاجرت کرد؛ entity-picker یک `<span className="ps-[4px]...">` قبل از `<Autocomplete>` امیت می‌کند (دیگر `label=` مرده روی Autocomplete نیست).
- **۵۰. `isInvalid`/`errorMessage`ی select و entity-picker: بدون بازخورد بصری در Preview، ولی در Export اثر واقعی دارد (جهت معکوس نسبت به بیشتر باگ‌های مشابه)** — برای entity-picker حتی به‌صورت attribute خام نامعتبر در Export نشت می‌کند. **(رفع شد ✅)**
  **رفع:** Preview برای هر دو عنصر پیام خطا + `aria-invalid`/border نشان می‌دهد؛ Export کلیدهای validation را از attrs خام entity-picker exclude می‌کند.
- **۵۱. «Loading» دستی در select/autocomplete: در Preview همیشه توسط state واقعی fetch بازنویسی می‌شود، در Export مقدار ایستا واقعاً اثر دارد** — باگ پاریتی جزئی. **(تأیید/رفع جزئی ✅)**
  **رفع:** Preview حالا `itemsLoading || manualLoading` را OR می‌کند تا flag دستی وقتی binding نیست اثر داشته باشد؛ وقتی fetch واقعی در جریان است، state واقعی همچنان اولویت دارد.
- **۵۲. `heroui.tags-input`: باینـدینگ مقدار اولیه (`value`) در Export نادیده گرفته می‌شود** — Preview درست resolve می‌کند، Export همیشه از مقدار استاتیک استفاده می‌کند. **(رفع شد ✅)**
  **رفع:** `renderTagsInputStatePreambleLines` وقتی `value` Bound است، `useState` اولیه را از عبارت Binding می‌سازد (CSV/JSON/array). تست: `selectAutocompleteEntityPickerPhase4Fix.test.tsx`.
- **تأیید سالم:** الگوی «مقدار کهنه در onBlur» برای این ۴ عنصر رد شد (همگی از مقدار تازه‌ی رویداد استفاده می‌کنند)؛ max-tags/allow-duplicates/separator اصلاً به‌عنوان فیلد Inspector وجود ندارند (فقدان قابلیت مستند، نه باگ)؛ چندانتخابی `select` اصلاً پیاده نشده اما هر سه مسیر هم‌راستا هستند (فقدان مستند، نه باگ پاریتی).

#### گروه checkbox/radio/switch/slider/date-picker/date-range
- **۵۳. `heroui.checkbox-group`/`heroui.radio-group`'s `size`/`color`: هیچ‌کدام پراپ واقعی متناظر در کامپوننت ندارند، کاملاً مرده در هر سه مسیر** — دقیقاً همان کلاس باگی که برای `heroui.dropdown` قبلاً رفع شد، اینجا از قلم افتاده. **(رفع شد ✅)**
  **رفع:** فیلدهای `size`/`color` از Inspector حذف شدند؛ `size={resolveSize(...)}` از Preview/Export برداشته شد؛ leftover روی اسناد قدیمی از passthrough و `excludeKeys` Export strip می‌شود. تست: `checkboxRadioSliderDateRangePhase12Fix.test.tsx`.
- **۵۴. `heroui.slider`'s `min`/`max`: نام پراپ واقعی `minValue`/`maxValue` است — کاملاً مرده در هر سه مسیر** (بدون نگاشت در `propRegistry.ts`). **(رفع شد ✅)**
  **رفع:** `PALETTE_JSX_ATTRIBUTE_NAME_OVERRIDES['heroui.slider']` نگاشت scoped اضافه شد (`min→minValue`, `max→maxValue`) تا `heroui.number-input` دست‌نخورده بماند؛ مصرف در `toJsxAttributeName`/`resolveRuntimeComponentProps`/`buildNodeJsxAttributes`. تست: `checkboxRadioSliderDateRangePhase12Fix.test.tsx` + `propRegistry.test.ts`.
- **۵۵. `heroui.slider`'s `size`: کاملاً مرده در هر سه مسیر** (Slider واقعی واریانت size ندارد). **(رفع شد ✅)**
  **رفع:** فیلد Size از Inspector حذف شد؛ leftover از Preview passthrough و Export exclude می‌شود. تست: `checkboxRadioSliderDateRangePhase12Fix.test.tsx`.
- **۵۶. `heroui.slider`'s `value` (وقتی در Inspector تنظیم شود): در Canvas/Preview هم‌زمان با `defaultValue` پاس داده می‌شود** → اسلایدر controlled می‌شود و thumb بعد از هر درگ فوراً به موقعیت اولیه‌ی ثابت برمی‌گردد؛ Export این مشکل را ندارد (به‌درستی exclude می‌کند). **اطمینان: بالا (بر پایه‌ی سورس react-stately)، توصیه به تأیید نهایی با تست UI واقعی. (رفع شد ✅)**
  **رفع:** `value`/`defaultValue`/`size` از `libraryPassthrough` قبل از اسپرد اسلایدر exclude می‌شوند؛ فقط `defaultValue={initialValue}` می‌ماند. تست UI واقعی با `ArrowRight` روی role=slider: `checkboxRadioSliderDateRangePhase12Fix.test.tsx`.
- **۵۷. `form.date-range`: بدون هیچ اعتبارسنجی زنده و بدون هیچ فیلد اعتبارسنجی در Inspector** — برخلاف `heroui.date-picker` که کامل است، `renderDateRangeLeafNode` هرگز `resolveDesignerFormFieldBaseProps`/`triggerPreviewFieldValidation` را صدا نمی‌زند، و اصلاً `isRequired`/`errorMessage` در تعریف فیلدهایش وجود ندارد. **(رفع شد ✅)**
  **رفع:** `isRequired` به Inspector اضافه شد؛ `renderDateRangeLeafNode` روی blur/onChange `triggerPreviewFieldValidation` را صدا می‌زند و پیام خطا را نشان می‌دهد. تست: `checkboxRadioSliderDateRangePhase12Fix.test.tsx`.
- **۵۸. `form.date-range`: بدون اعتبارسنجی end ≥ start** — هیچ‌جای کد این مقایسه انجام نمی‌شود. **(رفع شد ✅)**
  **رفع:** `validateDateRangeOrdering` در `runtimeNodeProps.ts`؛ قبل از required-check در Preview اعمال می‌شود. تست: `checkboxRadioSliderDateRangePhase12Fix.test.tsx`.
- **۵۹. `form.date-range`: باینـدینگ `startValue`/`endValue` در Preview تعاملی resolve نمی‌شود ولی در Export درست کار می‌کند** — نقض parity (`resolveDateRangeProps` هرگز `options.previewBindings` نمی‌گیرد). **(رفع شد ✅)**
  **رفع:** امضای `resolveDateRangeProps(node, options)` و خواندن از `previewBindings.resolveTextProp`. تست: `checkboxRadioSliderDateRangePhase12Fix.test.tsx` + `dateRangeValueBindingFix.test.tsx`.
- **۶۰. `form.date-range`: فیلدهای `minValue`/`maxValue`/`granularity`/`isReadOnly` که در کتابخانه واقعاً پشتیبانی می‌شوند، اصلاً در Inspector وجود ندارند** (فقدان قابلیت، نه باگ). **(رفع شد ✅)**
  **رفع:** فیلدها به `FORM_DATE_RANGE_FIELDS` اضافه شدند؛ Preview از `parseDesignerDatePickerValue` استفاده می‌کند؛ Export `minValue`/`maxValue` را با `parseDate(...)` امیت می‌کند. تست: `checkboxRadioSliderDateRangePhase12Fix.test.tsx`.
- **تأیید سالم:** ثبت فرم واقعی (submit end-to-end با payload صحیح) برای checkbox-group/radio-group/switch/slider با تست‌های موجود تأیید شد؛ تمام فیلدهای `heroui.date-picker` سالم و هم‌راستا در هر سه مسیرند؛ `heroui.switch`'s `isSelected` binding سالم و تست‌شده.

#### گروه code-editor/html-editor/mask-input/calculator
- **مورد ۳۳ (بالا، بخش ۱۰.۱) — رفع شد ✅** — html-editor بدون `name`، بدون اعتبارسنجی.
- **۶۱. هر ۴ عنصر: اعتبارسنجی onBlur مقدار کهنه را چک می‌کند** (همان مکانیزم مورد ۴۲ بالا؛ تأیید تجربی روی `form.calculator`). **(رفع شد ✅)**
  **رفع:** همان live box در `resolveDesignerFormFieldBaseProps` (مورد ۴۲) هر پنج عنصر مشترک را پوشش می‌دهد. تست: `formFieldsFamilyPhase6Fix.test.tsx`.
- **۶۲. هر ۴ عنصر: ۹ فیلد Inspector (۵ اعتبارسنجی + ۴ UX adornment) در Export به‌صورت attribute نامعتبر نشت می‌کنند** — می‌تواند build تایپ‌اسکریپت را بشکند وقتی کاربر این فیلدها را تنظیم کند. **(رفع شد ✅)**
  **رفع:** همان `DESIGNER_FORM_FIELD_UNSUPPORTED_EXPORT_KEYS` در `renderDesignerFormFieldAttrs` برای code/html/mask/calculator/color. تست: `formFieldsFamilyPhase6Fix.test.tsx`.
- **۶۳. `form.calculator`: هیچ مفهوم formula/فیلدهای محاسباتی متصل به سایر فیلدها وجود ندارد** — این یک ورودی عددی دستی + کیبورد ماشین‌حساب است، نه فیلد محاسبه‌ی خودکار (تصحیح فرض اولیه، نه باگ).
- **۶۴. `form.calculator`: `min`/`max` فقط از طریق دکمه‌ی کیبورد «=» اعمال می‌شوند، نه با تایپ مستقیم** — وقتی `showKeypad=false` باشد (رایج‌ترین حالت)، کاملاً بی‌اثرند؛ ضمناً چون `type="text"` است (نه `number`)، حتی attributeهای native مرورگر هم بی‌اثرند. **(رفع شد ✅)**
  **رفع:** `handleInputChange` لیترال‌های عددی کامل را clamp می‌کند؛ `onBlur` هم قبل از validation clamp می‌کند (`type="text"` ماند). تست: `formFieldsFamilyPhase6Fix.test.tsx`.
- **تأیید سالم:** `form.mask-input` کاملاً واقعی و صحیح در هر سه مسیر (از یک ماژول مشترک استفاده می‌کند، امکان واگرایی وجود ندارد)؛ `form.code-editor` (Monaco واقعی) و منطق محاسبه‌ی `form.calculator` واقعاً کار می‌کنند، نه دکوراتیو.

### ۱۰.۴ HeroUI General + Navigation/Overlays

- **۶۵. `heroui.avatar`: نشتِ `fallbackSrc` در Export وقتی Bind شود** — حلقه‌ی دستی strip فقط `['src','alt','text']` را پاک می‌کند، `fallbackSrc` را فراموش کرده؛ تست موجود این رفتار غلط را به‌اشتباه به‌عنوان درست assert کرده است. **(رفع شد ✅)**
  **رفع:** `fallbackSrc` به لیست strip در caseی `heroui.avatar` اضافه شد؛ تست غلط `avatarBoundPropsExport.test.ts` اصلاح شد تا عدم‌نشت را assert کند؛ `fallbackSrc` از `PALETTE_BINDABLE_PROP_KEYS` حذف شد. تست: `avatarBoundPropsExport.test.ts` + `herouiGeneralNavOverlaysPhase8Fix.test.tsx`.
- **۶۶. `heroui.typography-lead`'s فیلد Color کاملاً مرده در هر سه مسیر** — به یک `<p>` خام رندر می‌شود، نه کامپوننت واقعی Typography؛ همان کلاس باگی که برای Button/Link/Avatar/Skeleton رفع شد، اینجا جا افتاده. **(رفع شد ✅ — حذف فیلد، گزینه‌ی الف)**
  **رفع:** فیلد Color از Inspector حذف شد؛ leftover استاتیک/bound در Export (`structuralPropKeys` + `resolveBoundAttributeForNodeProp`) و Preview (`libraryPassthrough` exclude) strip می‌شود. تست: `herouiGeneralNavOverlaysPhase8Fix.test.tsx`.
- **۶۷. `heroui.breadcrumbs`: بعد از حذف فیلد Size از Inspector، هنوز `size="md"` به‌صورت غیرشرطی و مرده تزریق می‌شود** (باقی‌مانده‌ی حذف نیمه‌کاره؛ بدون تست رگرسیون، برخلاف Dropdown که دارد). **(رفع شد ✅)**
  **رفع:** `size={resolveSize(...)}` از `DesignerRuntimeBreadcrumbs` و `renderBreadcrumbsParityJsx` حذف شد؛ leftover `size` exclude می‌شود. تست: `navigationOverlaysDeadFieldsAndBugs.test.ts` + `herouiGeneralNavOverlaysPhase8Fix.test.tsx`.
- **۶۸. `heroui.dropdown`'s باینـدینگ روی «Label»: فقط در Export کار می‌کند، نه در Preview تعاملی** — `DesignerRuntimeDropdown.tsx` (که هم برای Canvas هم Preview استفاده می‌شود) هرگز `options.previewBindings?.resolveTextProp` را صدا نمی‌زند؛ خودِ Designer چیزی را که Export می‌کند preview نمی‌کند. **(رفع شد ✅)**
  **رفع:** `DesignerRuntimeDropdown` حالا `previewBindings.resolveTextProp(node, 'label', …)` را صدا می‌زند (الگوی Card/Modal/Accordion). تست: `herouiGeneralNavOverlaysPhase8Fix.test.tsx`.
- **۶۹. `heroui.listbox`'s باینـدینگ «Selected Keys»: در هیچ مسیری کار نمی‌کند** (Preview و Export هردو فقط `readString` استاتیک می‌خوانند). **(رفع شد ✅)**
  **رفع:** Preview از `resolveSelectSelectedKeys` (مثل Select) استفاده می‌کند؛ Export عبارت bound را به `defaultSelectedKeys` به‌صورت split/trim array تبدیل می‌کند و نشتِ `selectedKeys={expr}` در `resolveBoundAttributeForNodeProp` بسته شد. تست: `herouiGeneralNavOverlaysPhase8Fix.test.tsx`.
- **تأیید کامل ۸ حذف/رفع دور اول** (Button Color، Link Size+Color، Avatar Fallback Source بخش استاتیک، Skeleton isLoaded→animationType، Tooltip Trigger Aria Label تکراری + حالت بدون-href، Dropdown Items+Label بدون duplicate در Export، isDisabled placement، Listbox Size حذف + Items binding در Export) — همگی سالم تأیید شدند، **به‌جز استثناهای بند ۶۵/۶۸/۶۹ بالا که اکنون رفع شدند**.
- Modal/Alert Dialog/Drawer/Tabs/Toolbar/Pagination/Spinner/Progress/Chip: بدون باگ جدید؛ همگی با سورس واقعی `@heroui/react`/`@heroui/styles` مطابقت داده شدند.

### ۱۰.۵ HeroUI Data Display + App Table Grid

- **مورد ۲۸، ۳۰، ۳۶ (بالا، بخش ۱۰.۱).**
- **۷۰. `cellClickBehavior` روی سلول‌های rich (link/chips/lock-status) کاملاً بی‌اثر در Export** — `bindingCodegen.ts` همیشه `cellClickHandlerRef: { current: undefined }` هاردکد می‌کند؛ سلول ظاهراً کلیک‌پذیر است ولی هیچ اتفاقی نمی‌افتد. تأیید تجربی با تولید TSX واقعی. **(رفع شد ✅)**
  **رفع:** `renderAppTableGridCellClickHandlerLines` در `bindingCodegen.ts` یک handler واقعی per-column تولید می‌کند (open-modal / detail-flow / cellClickActionId→row-action) و آن را به `cellClickHandlerRef` پاس می‌دهد — هم‌ارز Preview's `executeDesignerGridCellClick`. تست: `appTableGridPhase3ParityFix.test.ts`.
- **۷۱. Row action با `behavior.kind: 'detail-flow'` وقتی `actionId`اش با `rowActionId` گرید فرق دارد، در Export بی‌صدا no-op می‌شود** — در Preview درست کار می‌کند (منطق fallback هوشمند دارد)؛ Export فقط یک `case` برای دقیقاً `flow.config.rowActionId` تولید می‌کند. تأیید تجربی. **(رفع شد ✅)**
  **رفع:** `renderAppTableGridRowActionHandlerLines` برای هر action با `behavior.kind === 'detail-flow'` یک `case` جدا با منطق flow (با `rowActionId` واقعی flow) امیت می‌کند — هم‌ارز `executeConfiguredBehavior`. تست: `appTableGridPhase3ParityFix.test.ts`.
- **۷۲. سه فیلد Inspector دیگر در Export مرده‌اند: `cardBelow`, `showSortControls`, `showListModeControls`, `visibleInfiniteCount`** — تأیید تجربی با تولید TSX واقعی؛ برای دو مورد آخر، رفتار واقعی Export **برعکس** تنظیم Inspector است (کنترل‌ها همیشه نمایش داده می‌شوند حتی وقتی غیرفعال شده باشند). **(رفع شد ✅)**
  **رفع:** `renderAppTableGridCustomJsx` (`tsxPhase2Palette.ts`) مثل `presentation`، `cardBelow` را از طریق `reservedAttributes` امیت می‌کند؛ `showSortControls` را با شرط `sortOptions.length > 0` روی `GridPagingFooter` می‌گذارد؛ وقتی `showListModeControls === false`، `listMode`/`onListModeChange` امیت نمی‌شوند؛ `visibleInfiniteCount` از `paging.displayRows.length` در infinite-mode پر می‌شود. تست: `appTableGridPhase3ParityFix.test.ts`.
- **۷۳. `gridQueryMode` پیش‌فرض App Table Grid روی `'server'` است، ولی fallback کلاینتی بدون تنظیم صریح دیگری کاملاً بی‌اثر است** — سورت/فیلتر هدر ستون آیکون نشان می‌دهد ولی هیچ اثری ندارد مگر کاربر چند سوییچ مستقل (`gridQueryMode`، «Sync filters to API»، بک‌اند واقعی) را هم‌راستا کند. **(رفع شد ✅)**
- **۷۴. جستجو و چک‌باکس role-filter تولبار: بدون فعال‌بودن سوییچ جداگانه‌ی «Sync filters to API»، هیچ اثری ندارند — نه fetch سروری، نه فیلتر کلاینتی، بدون هیچ خطا یا نشانه‌ای به کاربر.** **(رفع شد ✅)**
  **رفع (۷۳/۷۴):** `resolveEffectiveAppTableGridQueryMode` + `applyDesignerGridToolbarClientFilters` — وقتی Sync خاموش است، سورت/فیلتر ستون و search/role روی دیتای بارگذاری‌شده کلاینتی اعمال می‌شوند؛ Inspector هنگام روشن‌کردن Search/Role-Filter به‌طور خودکار Sync را هم فعال می‌کند. Preview (`DesignerRuntimeAppTableGrid.tsx`) و Export (`bindingCodegen.ts`) هر دو هم‌راستا شدند. تست: `appTableGridPhase3ParityFix.test.ts`.
- **۷۵. سورت دستی تعاملی با هر ویرایش تعریف ستون (نه فقط تنظیمات Style) بازنشانی می‌شود** — تست موجود فقط ویرایش‌های Style را پوشش می‌دهد، نه Column Editor. تأیید تجربی. **(رفع شد ✅)**
  **رفع:** افکت reseeding سورت در Preview فقط به `sortableColumnsSignature` (`columnId`های sortable مرتب‌شده) وابسته است؛ ویرایش label/width/cellKind دیگر سورت دستی را به `defaultSortBy` برنمی‌گرداند.
- **۷۶. تغییر جستجو/role-filter صفحه را به ۱ بازنشانی نمی‌کند (تغییر سورت این کار را می‌کند)** — ناسازگاری رفتاری. **(رفع شد ✅)**
  **رفع:** `debouncedSearch` و `roleFiltersSignature` به وابستگی‌های `setLocalPage(1)` در Preview اضافه شدند؛ Export هم در debounce جستجو و handler نقش صفحه را به ۱ برمی‌گرداند.
- **۷۷. حالت اولیه‌ی چک‌باکس‌های role-filter بین Canvas/Preview (همه false) و Export (همه true) برای دقیقاً همان تنظیمات معکوس است.** **(رفع شد ✅)**
  **رفع:** Export مثل Preview با `false` اولیه seed می‌شود. تست: `appTableGridPhase3ParityFix.test.ts`.
- **۷۸. «Total Records» یک عدد استاتیک طراحی‌زمان است، هرگز از پاسخ واقعی API استخراج نمی‌شود** — اگر خالی بماند، دکمه‌ی Next همیشه غیرفعال می‌ماند صرف‌نظر از تعداد واقعی رکورد. **(رفع شد ✅)**
  **رفع:** زیرساخت موجود `responseMapping.totalPath` در Export از `raw_*` خوانده می‌شود؛ `resolveDataGridTotalCount` وقتی total صفر/تنظیم‌نشده و صفحه پر است، حداقل یک صفحه‌ی بعدی فرض می‌کند تا Next زود غیرفعال نشود. placeholder فیلد Inspector هم به‌روز شد. تست: `appTableGridPhase3ParityFix.test.ts`.
- **۹۷. `documentAppTableGridUsesStore` قوانین سطح-سلول `cellDisabledWhen`/`actionDisabledWhen` با `preset:'expression'` و ارجاع `store.`/`designerStore.` را اسکن نمی‌کرد.** **(رفع شد ✅)**
  **رفع:** اسکن expression در `bindingStoreCodegen.ts` اضافه شد تا `designerStoreRef` واقعی به `buildAppTableGridColumns` برسد. تست: `appTableGridPhase3ParityFix.test.ts`.
- **تأیید سالم:** ستون‌های داده/اکشن/آیکون، رندر ۶ نوع cellKind، قانون‌های غیرفعال‌سازی (builtin-field/has-role/expression)، رفتار `open-modal`، محافظت race-condition در hydration، debounce جستجو (۳۰۰ms، trailing-edge درست)، `defaultSortBy` seed اولیه، تست‌های Style-edit موجود — همگی با شواهد مستقیم (و بخشی تجربی) سالم تأیید شدند.

### ۱۰.۶ Universal Widgets (۲۸ عنصر)

- **۷۹. `content.segmented-control`'s فیلد `selected` (bindable): در Canvas و Preview کاملاً مرده است** — از هلپر مشترک `text()` عبور نمی‌کند (مستقیم `readString(node.props.selected)`)؛ در Export درست کار می‌کند. نشان می‌دهد رفع سیستمی مورد ۲ کامل نبوده. **(رفع شد ✅)**
  **رفع:** `resolveUniversalPropsFromNode` حالا `selected` را از `text()` می‌خواند؛ `DesignerRuntimeSegmentedControl` prop جدید `selectedOverride` می‌گیرد (از `designerUniversalRuntime.tsx`) تا مقدار resolve‌شده را مصرف کند نه `node.props.selected` خام. تست: `universalWidgetsPhase9ParityFix.test.tsx`.
- **۸۰. همان عنصر، فیلد `options` (حالت غیر Dual-Mode/legacy CSV) هم در Canvas/Preview مرده است.** **(رفع شد ✅)**
  **رفع:** `options` هم از `text()` عبور می‌کند و همچنان از طریق `optionsOverride` به کامپوننت می‌رسد — Dual-Mode (`resolveBoundUniversalOverrides`) و Property Binding هم‌زمان کار می‌کنند. تست: `universalWidgetsPhase9ParityFix.test.tsx`.
- **۸۱. `logic.visibility-container`'s خودِ فیلد `visibleCondition` هم از همین الگو مستثنا نیست** — bindable در UI ولی در Canvas/Preview بی‌اثر (اولویت پایین‌تر، سناریوی نامتعارف). **(رفع شد ✅)**
  **رفع:** `visibleCondition` از `text()` عبور می‌کند؛ خروجی همچنان یک رشته‌ی عبارت شرطی است که `evaluateDesignerCondition` parse می‌کند (سناریوی Bind به path حاوی expression string تأیید شد). تست: `universalWidgetsPhase9ParityFix.test.tsx`.
- **۸۲. ناهماهنگی اولویت انتخاب برچسب CSV در حالت Dual-Mode بین Preview (`label→name→title→heading→id`) و Export (`label→title→name→id`)** — برای ردیف‌های API با فیلدهای چندگانه، نتیجه‌ی نمایشی می‌تواند بین دو مسیر متفاوت باشد. اثر روی `content.stepper`/`content.segmented-control`. **(رفع شد ✅)**
  **رفع:** `CONTENT_CSV_LABEL_FIELD_PRIORITY` مشترک؛ `resolveContentCsvLabelFromRow` و `resolveContentCsvExpression` هر دو دقیقاً `label→name→title→heading→id` (با skip رشته‌ی خالی) را اعمال می‌کنند. تست: `universalWidgetsPhase9ParityFix.test.tsx`.
- **۸۳. `content.icon`'s فیلد `size` هرگز از داده‌ی API در حالت Dual-Mode پر نمی‌شود** — هر دو مسیر یکسان نادیده می‌گیرند (نه واگرایی، یک نقص کامل‌نشده‌ی احتمالاً عمدی). **(تصمیم محصولی — عمداً رفع نشد در فاز ۹)**
- **۸۴. هیچ‌کدام از ۱۶ ویجت Dual-Mode در بوم طراحی داده‌ی زنده‌ی API نمایش نمی‌دهند** (برخلاف Grid/Viz که این‌بار Hydration زنده گرفتند) — تصمیم محصولی لازم دارد، نه لزوماً باگ. **(رفع شد ✅ در فاز ۱۴ / مورد ۱۰۰)**
  **رفع:** `DesignerCanvasHydratedContentWidget` + `shouldHydrateCanvasContentWidget` در `canvasNodes.tsx`؛ تست: `dualModeContentCanvasHydrationPhase14Fix.test.tsx`.
- **تأیید کامل** رفع سیستمی «Property Binding مرده» برای هر ۲۸ عنصر (شامل ۷۹-۸۱)، رفع Dual-Mode segmented-control، رفع کامل duplicate-attribute در Export برای هر ۲۸ عنصر، رفع کامل `repeaterScope` برای visibility-container تودرتو، و parity اولویت CSV Dual-Mode Preview/Export (مورد ۸۲).

### ۱۰.۷ Data Viz / Charts / Kanban / Gantt / Tree Widgets (۱۲ عنصر)

**۱۰.۷.۱ تأیید کامل رفع باگ ریشه‌ای `node`/`node.id`:** برای هر ۱۲ عنصر و برای *همه‌ی* فراخوان‌های `resolveBoundAttributeForNodeProp` در کل پروژه (نه فقط دو محل مستندشده)، به‌درستی رفع شده. زنجیره‌ی کامل `data={...}` هم ردیابی و سالم تأیید شد.

**۱۰.۷.۲ باگ جدید — واگرایی Tree Export/Preview در ردیف‌های ناقص (رفع شد ✅):** نسخه‌ی inline‌شده‌ی Export (`bindingApiCodegen.ts`) گارد «ردیف با `idField` خالی حذف شود» را (که نسخه‌ی canonical در `visualizationDataTransform.ts` دارد) نداشت — ردیف‌های ناقص با `id:''` وارد درخت می‌شدند و می‌توانستند با هم تصادم کنند. فقط برای `viz.tree-view`/`tree-select`/`cascader`/`tree-combobox` با `parentIdField` تنظیم‌شده و کیفیت داده‌ی نامناسب رخ می‌دهد. **اطمینان: بالا (تجربی، با اجرای واقعی هر دو تابع).**
  **رفع:** در شاخه‌ی hierarchical نسخه‌ی inline‌شده‌ی `transformApiRowsToTreeNodes` (`bindingApiCodegen.ts`) همان گارد `if (!id) return` قبل از `nodeMap.set` اضافه شد — دقیقاً هم‌ارز canonical. حالت flat (بدون `parentIdField`) همچنان fallback مصنوعی `node-${index+1}` را برای null/undefined نگه می‌دارد (عمدی). تست رگرسیون: `vizTreeEmptyIdFieldExportParityFix.test.ts` (اجرای واقعی helper با esbuild + مقایسه با Preview).

**۱۰.۷.۳ تصحیح مهم به مورد ۰ (بخش ب) — رفع شد ✅ (تأیید شد که قبلاً کار می‌کرده، تست دائمی اضافه شد):** تأیید مستقل فاز ۱۰ از صفر (خواندن کامل `DesignerDocumentPreview` در `designerRuntimePreview.tsx` + تست دائمی با mock `fetch`) ثابت کرد صفحه‌ی Preview مجزا **از قبل کار می‌کند**: خودش `hydrationData`/`refreshDataSource`/`dynamicHydrationStoreKey` دارد (مستقل از ادعای قدیمی «هیچ‌جا refreshDataSource واقعی پیاده نشده» که فقط `src/features/component-designer/` را جست‌وجو کرده بود). تایپ در جعبه‌ی جستجوی گرید واقعاً فچ دوم با query param درست ارسال می‌کند. مسیر Preview از `resolveHydrationTargetUrl` استفاده می‌کند — تحت تأثیر مورد ۲۸ (`resolveBindingUrl`ی Export) نیست. تست دائمی: `previewPageHydrationRefreshItem0bVerification.test.tsx`.

**تأیید کامل سایر جنبه‌ها:** hydration زنده‌ی بوم طراحی برای هر ۱۲ عنصر؛ نوار ابزار ۸ ویجت غیرنموداری (مورد ۶)؛ همه‌ی فیلدهای دیگر تبدیل داده (Chart/Timeline/Kanban/Sheet — بدون استثنا)؛ ویزارد Chart field-mapping؛ رنگ/برچسب سفارشی سری‌ها.

### ۱۰.۸ دسته‌های پویا — Shell Chrome / Platform Nav / Platform Slots / Reusable

- **۸۵. فیلدهای هدر (`showLogo`/`showBreadcrumb`/`showActions`) در تب اصلی Preview دیزاینر (نه بوم طراحی، نه Export، نه صفحه‌ی زنده‌ی منتشرشده — که هر سه قبلاً رفع شده بودند) همچنان مرده‌اند** — `useDesignerShellRuntimeSlots` (`src/features/component-designer/lib/designerShellRuntimeSlots.tsx`) یک پیاده‌سازی **سوم و کاملاً مستقل** از chrome-slots دارد که هرگز `extractShellHeaderConfigFromDocument` را import/صدا نمی‌زند (`headerSlot = <ShellHeaderChromeSlot />` بدون config). این هوک فقط توسط `DesignerPreviewViewport.tsx` استفاده می‌شود که خودِ تب Preview اصلی دیزاینر را می‌سازد — یعنی سناریوی رایج «ویرایش سند Shell Layout، تنظیم Breadcrumb=false، کلیک روی Preview» هنوز نتیجه‌ی غلط نشان می‌دهد. علت ریشه‌ای: سه پیاده‌سازی مستقل و کپی‌شده‌ی chrome-slots (`useDesignerShellRuntimeSlots`, `DesignerPreviewPortalShell.tsx`, `DesignerPublishedShell.tsx`) به‌جای یک تابع مشترک — رفع دور اول فقط ۲ از ۳ را پوشش داده بود. **(رفع شد ✅)**
  **رفع:** تابع مشترک `buildShellRuntimeSlotsFromDocument` در `src/app/platform/buildShellRuntimeSlots.tsx` اضافه شد؛ هر سه مصرف‌کننده (`useDesignerShellRuntimeSlots`، `DesignerPreviewPortalShell`، `DesignerPublishedShell`) از همان منبع واحد برای logo/header/nav chrome slots استفاده می‌کنند و `config={extractShellHeaderConfigFromDocument(...)}` همیشه پاس داده می‌شود. تست رگرسیون (DOM واقعی روی `DesignerPreviewViewport`): `shellPreviewTabHeaderConfigItem85Fix.test.tsx`.
- **۸۶. نشتِ attribute در Export برای Logo/Nav-Region: `logoSrc`/`logoAlt`/`logoHref`/`navigationRef` هم به‌درستی در `slotProps` هم (به‌اشتباه) به‌صورت attribute مسطح روی `<DesignerSlotPreview>` نشت می‌کنند** — چون `excludeKeys` در `tsxPlatformPalette.ts` فقط کلیدهای هدر را پوشش می‌دهد، نه لوگو/ناوبری را. اثر صرفاً cosmetic/HTML نامعتبر است (نمایش بصری درست باقی می‌ماند چون مقدار درست هم از طریق `slotProps` می‌رسد)، نه یک شکست عملکردی. **(رفع شد ✅)**
  **رفع:** `excludeKeys` در `tsxPlatformPalette.ts` با `logoSrc`/`logoAlt`/`logoHref`/`navigationRef` (از ثابت‌های `shellLogoProps`/`shellNavSlotProps`) گسترش یافت؛ مقادیر فقط داخل `slotProps` می‌مانند. تست رگرسیون: `shellLogoNavExportAttrLeakItem86Fix.test.ts`.
- **تأیید کامل:** هر ۴ اسلات عمومی پلتفرم در Preview تعاملی (نه فقط ۲ موردی که تست مستقیم دارند)؛ اسلات‌های nav-region و Route Outlet؛ Platform Navigation (۵ مورد) در هر سه مسیر (از یک hook مشترک، بدون امکان واگرایی)؛ تشخیص empty-state پورتال‌منو (بدون stale state)؛ Sidebar-Toggle/Logo بدون فیلد مرده؛ سند gap مربوط به Reusable Components دقیق و به‌روز است؛ نمایش/عدم‌نمایش شرطی Dynamic Actions روی اسلات‌های shell بدون باگ خاص.

### ۱۰.۹ زیرساخت Binding و Dynamic Actions (Cross-Cutting)

- **موارد ۳۴، ۳۵، ۳۶ (بالا، بخش ۱۰.۱) — رفع شد ✅.**
- **۸۷. ویرایشگر عمومی Dynamic Actions (`InspectorDynamicActionsField.tsx`) فقط ۴ از ۶ نوع اکشن را قابل‌انتخاب می‌کند** — `refreshDataSource` و `resetForm` در dropdown نیستند و فقط از طریق ویزاردهای خودکار (Create/Edit Form) وارد سند می‌شوند؛ کاربر نمی‌تواند یک زنجیره‌ی دلخواه با این دو نوع بسازد. **(رفع شد ✅)**
  **رفع:** هر دو نوع به `ACTION_TYPE_OPTIONS` اضافه شدند؛ `resetForm` بلوک «Target Node» گرفت (picker Data Source برای `refreshDataSource` از قبل موجود بود). تست: `dynamicActionsEditorMissingTypesFix.test.ts`.
- **۸۸. گزینه‌های موفقیت ویزارد فرم (refresh/toast/reset/close) متقابلاً انحصاری‌اند** — نمی‌توان هم toast نشان داد هم گرید را رفرش کرد هم مودال را بست؛ حالت `close` بدون overlay ancestor بی‌صدا هیچ اکشنی نمی‌سازد. **(رفع شد ✅)**
  **رفع:** `successBehaviors[]` ترکیبی با ترتیب canonical (toast → refresh → reset → close)؛ UI ویزارد Binding به چک‌باکس چندانتخابی تبدیل شد؛ `close` بدون overlay دیگر `console.warn` می‌دهد. تست: `formWizardCombinableSuccessBehaviorsFix.test.ts`.
- **۸۹. هیچ نوع اکشن `navigate` در کل موتور Dynamic Actions وجود ندارد** — «بعد از ذخیره به صفحه‌ی دیگر برو» به‌صورت پویا ممکن نیست. **(رفع شد ✅ — فاز ۱۵ / مورد ۱۰۱)**
  **رفع:** نوع `navigate` + فیلدهای `navigateTarget`/`navigateReplace`؛ Inspector/Preview/Export هم‌راستا؛ تست: `dynamicActionNavigatePhase15Fix.test.tsx`.
- **۹۰. `heroui.entity-picker` از رجیستری LOV مشترک مستقل است** (تکرار مورد ۴۶، از زاویه‌ی زیرساخت). **(رفع شد ✅ — هم‌زمان با مورد ۴۶ در فاز ۴)**
- **۹۱. ریسک امنیتی/صحت خفیف در موتور condition (`new Function`)** — بدون sandbox (مدل اعتماد رایج ابزارهای low-code، نیازمند تأیید محصولی که فقط کاربران معتمد به Designer دسترسی دارند)؛ و جایگزینی regex-based (نه parser واقعی) برای `store.`/`data.` می‌تواند رشته‌های literal حاوی این پیشوندها را به‌اشتباه rewrite کند (edge case کم‌احتمال). **(تصمیم محصولی — عمداً رفع نشد در فاز ۵؛ نیاز به تأیید صریح کاربر)**
- **تأیید کامل سالم بودن:** `callMutation` (شامل Delete واقعی) در Preview و Export کاملاً هم‌راستا و صحیح — تنها راه واقعی DELETE، بدون preset آماده برای ردیف گرید اما با الگوی معتبر (open-modal + callMutation)؛ `mutationError` در هر دو مسیر رندر می‌شود؛ زیرساخت کامل ارسال فرم (validation→payload→fetch)؛ سازگاری مسیرهای store-path (بررسی نقطه‌ای، نه صددرصد جامع)؛ مدیریت حالات مرزی condition expression (خالی→true، نامعتبر→false، fail-closed).

### ۱۰.۱۰ جمع‌بندی دور دوم

- **تعداد کل یافته‌های تازه‌ی این دور: ۷۱ آیتم شماره‌دار (۲۸–۹۸) + ۱ آیتم ۹۹ (Tree empty-id) + بازبینی ۰ب = ۷۲ واحد کاری نقشه‌ی فازها.** همه‌ی باگ‌های قابل‌رفع مکانیکی در فازهای ۱–۱۲ رفع و با تست رگرسیون قفل شدند؛ موارد تصمیم محصولی (۸۳، ۸۴، ۸۹، ۹۱ و مشابه) عمداً deferred ماندند.
- **الگوهای غالب این دور:** (۱) تست‌های رگرسیونِ فقط-متنی که رفتار واقعی runtime را نمی‌گیرند (مورد ۲۸)؛ (۲) کامپوننت‌های Export که به پرایمیتیو خام کتابخانه به‌جای wrapper داخلی وصل شده‌اند (مورد ۲۹)؛ (۳) رفع‌های دور اول که به تمام عناصر خواهرِ دارای همان الگو تعمیم داده نشده بودند؛ (۴) عناصر با پیاده‌سازی کاملاً مستقل که سیم‌کشی مشترک عمومی را دریافت نکرده‌اند؛ (۵) کدهای تکراری/کپی‌شده به‌جای تابع مشترک (chrome-slots مورد ۸۵).
- **یافته‌ی جانبی فاز ۱۳ (تقویت مورد ۳۶):** وقتی Region form و Grid هم‌زمان به یک `dataSource` وصل‌اند، `buildExistingDataSourceRefreshVarMap` قبلاً Region را اول ثبت می‌کرد و «رفرش بعد از ذخیره» فقط `regionData_*` را صدا می‌زد — گرید نمایان stale می‌ماند. ترتیب ثبت به ترجیح list widgets (grid/chart/viz/repeater) تغییر کرد؛ Preview هم همه‌ی hydration targetهای همان dataSource را refresh می‌کند. تست: `refreshDataSourceGhostFetchFix.test.ts` + `phase13CrossPhaseIntegrationCertification.test.tsx`.
- **نیازمند بررسی/تصمیم محصولی (عمداً رفع‌نشده):** موارد ۸۳، ۸۴، ۸۹، ۹۱ — جزئیات در بخش ۱۱.
- **بدون تغییر از دور اول:** `reusable.component.*` و `shell.error-page`/`shell.not-found` هنوز نیازمند تصمیم محصول/زیرساخت بک‌اند هستند.

**وضعیت نهایی دور دوم: ✅ همه‌ی ۷۲ آیتم نقشه‌ی اجرا (به‌علاوه‌ی ۲۸ آیتم دور اول) رفع یا آگاهانه deferred شدند و با تأیید سراسری فاز ۱۳ گواهی شدند.**

### ۱۰.۱۱ یافته‌های جزئی / اطمینان پایین‌تر (برای کامل‌بودن سند — از همان ۱۲ گزارش، ولی شدت/اطمینان کمتر از ۲۸-۹۱)

این موارد عمداً از خلاصه‌های بالا کنار گذاشته شده بودند چون یا شدت بسیار پایینی دارند، یا اطمینان ایجنت مربوطه پایین بود، یا اساساً «فقدان قابلیت» هستند نه «باگ». برای رعایت کامل درخواست ممیزیِ خط‌به‌خط، همگی این‌جا ثبت می‌شوند:

- **۹۲. `heroui.autocomplete`'s فیلد `allowCustomValue` کاملاً تزئینی است** — نتیجه‌ی مستقیم یافته‌ی ۳۱ (کامپوننت واقعی هیچ ورودی متنی ندارد)؛ ضمناً نام پراپ هم با استاندارد کتابخانه یکی نیست (`allowsCustomValue` با s، فقط مختص `ComboBox`). یکنواخت در هر سه مسیر، بدون باگ پاریتی. اطمینان: بالا. **(رفع شد ✅ — حذف فیلد)**
  **رفع:** فیلد از Inspector حذف شد؛ `resolveAutocompleteMenuProps` دیگر آن را امیت نمی‌کند؛ مقدار باقی‌مانده‌ی سندهای قدیمی strip می‌شود. تست: `selectAutocompleteEntityPickerPhase4Fix.test.tsx`.
- **۹۳. `heroui.switch`: کامپوننت واقعی `@heroui/react` واریانت `size: sm/md/lg` دارد ولی هیچ فیلد Size در Inspector این عنصر expose نشده** — قابلیت واقعی کتابخانه در دسترس کاربر نیست (معکوس اکثر باگ‌های این سند: نه فیلد مرده، بلکه قابلیت پنهان). فقدان قابلیت، نه باگ. اطمینان: متوسط-بالا. **(رفع شد ✅)**
  **رفع:** فیلد Size به Inspector اضافه شد؛ Preview و Export `size={resolveSize(...)}` را روی Switch پاس می‌دهند. تست: `checkboxRadioSliderDateRangePhase12Fix.test.tsx`.
- **۹۴. `heroui.button-solid`/`heroui.button-outline`: داده‌ی Property Binding قدیمی/باقی‌مانده روی فیلد حذف‌شده‌ی `color` می‌تواند در هر دو مسیر Preview و Export نشت کند** — Export مقدار استاتیک قدیمی را strip می‌کند ولی مقدار Bound را نه؛ Preview (`libraryPassthrough` بدون `excludeKeys`) اصلاً چیزی را strip نمی‌کند. چون Button واقعی از `react-aria-components` است (معمولاً `filterDOMProps` دارد)، احتمال بروز مشکل بصری/کنسولی کم است، اما دو مسیر از نظر رفتار strip هم‌راستا نیستند. اطمینان: پایین (رفتار runtime تأیید نشد). **(رفع شد ✅)**
  **رفع:** بررسی شد و نشت bound در Export تکرارپذیر بود — `resolveBoundAttributeForNodeProp` حالا `color` را برای button-solid/outline suppress می‌کند؛ Preview با `libraryPassthrough(..., excludeKeys: color/text)` هم‌راستا شد. تست: `herouiGeneralNavOverlaysPhase8Fix.test.tsx`.
- **۹۵. `heroui.tooltip-trigger`: فیلد سراسری `ariaLabel` (که عمداً حفظ شده) اگر Bind شود، می‌تواند به‌صورت `ariaLabel={...}` خام روی `<Tooltip.Root>` در Export نشت کند** — چون `renderTooltipTriggerParityJsx` فقط پاس استاتیک را exclude می‌کند نه حلقه‌ی bound-props را. چون `TooltipRoot` این پراپ را روی منطق react-aria (نه DOM مستقیم) اسپرد می‌کند، احتمالاً بی‌اثر/بی‌خطر است. اطمینان: پایین (تأیید runtime نشد). **(رفع شد ✅)**
  **رفع:** نشت bound تکرارپذیر بود — `resolveBoundAttributeForNodeProp` برای `ariaLabel` روی `heroui.tooltip-trigger` خالی برمی‌گرداند. تست: `herouiGeneralNavOverlaysPhase8Fix.test.tsx`.
- **۹۶. کد مرده (نه باگ عملکردی): `renderEntityPickerSearchHandlerLines` در `tsxPhase2Palette.ts` هیچ‌جا import/صدا زده نمی‌شود** — منطق مشابهش به‌صورت تکراری و مستقیم داخل `bindingCodegen.ts` بازنویسی شده. ریسک نگهداری آینده (دو نسخه که می‌توانند از هم واگرا شوند)، نه یک باگ فعلی. **(رفع شد ✅ — پاکیزگی کد)**
  **رفع:** helper به `bindingEntityPickerCodegen.ts` منتقل و از `bindingCodegen.ts` صدا زده می‌شود؛ نسخه‌ی مرده در `tsxPhase2Palette.ts` حذف شد (خروجی TSX بدون تغییر رفتاری). تست: `herouiGeneralNavOverlaysPhase8Fix.test.tsx` + تست‌های موجود entity-picker.
- **۹۷. `heroui.app-table-grid`: `documentAppTableGridUsesStore` می‌تواند نیاز به declare کردن `designerStore` را برای یک قانون غیرفعال‌سازی سطح-سلول (`cellDisabledWhen`/`actionDisabledWhen` با `preset:'expression'`) کمتر از واقع تشخیص دهد** — اگر تنها منطق وابسته به store در کل سند دقیقاً همین یک قانون سطح-سلول باشد (بدون toolbar، بدون detail-flow، بدون ستون اکشن، و هیچ‌جای دیگر صفحه به store وابسته نباشد)، Export مقدار `designerStoreRef: { current: undefined }` پاس می‌دهد و عبارت همیشه با `{}` ارزیابی و `false` می‌شود، درحالی‌که Preview با store واقعی درست ارزیابی می‌کند. سناریوی بسیار محدود (نیاز به عدم‌استفاده‌ی store در کل بقیه‌ی سند). اطمینان: متوسط. **(رفع شد ✅)** — اسکن expression در `documentAppTableGridUsesStore` اضافه شد؛ تست: `appTableGridPhase3ParityFix.test.ts`.
- **۹۸. یادداشت ساختاری بدون بررسی عمیق:** از نظر ساختاری می‌توان یک اسلات shell (`system-slot`/`platform-nav`/`reusable-slot`) را داخل `logic.repeater` قرار داد (هردو `nodeType: 'container'` دارند) — رفتار عملی این ترکیب غیرمعمول بررسی نشده؛ به‌احتمال زیاد کاربردی بی‌معنا و بعید است کاربر واقعی به آن برسد. صرفاً برای کامل‌بودن ثبت می‌شود، نه یک باگ تأییدشده.

**جمع نهایی یافته‌های این دور: ۹۸ − ۲۷ = ۷۱ آیتم جدید (شماره‌های ۲۸ تا ۹۸)، شامل ۹ مورد بحرانی (۲۸-۳۶)، ~۵۵ باگ با اطمینان بالا/خیلی‌بالا، و ۷ یادداشت با اطمینان پایین‌تر یا فقدان قابلیت (نه باگ) که صرفاً برای شفافیت کامل ثبت شدند.**

---

## ۱۱. گواهی آمادگی Production

**تاریخ تأیید نهایی:** ۲۵ ژوئیه ۲۰۲۶ — **بازبینی مستقل دوم** (۱۲ ایجنت موازی، یکی به‌ازای هر فاز، هرکدام کد فعلی و تست‌های واقعی را از صفر و بدون اعتماد به ادعای سند بررسی کردند؛ سپس یک اجرای نهایی توسط ناظر ارشد).

### نتیجه‌ی بازبینی مستقل ۱۲ فاز

از ۱۲ فاز، **۹ فاز کاملاً و بدون هیچ نقصی تأیید شدند** (فازهای ۱، ۲، ۶، ۷، ۸، ۹، ۱۰، ۱۱ — بدون نیاز به هیچ تغییر کد؛ فاز ۶ فقط یک تست تجربی اضافه گرفت). **۳ فاز یک نقص واقعی داشتند که در همین بازبینی پیدا و رفع شد:**
- **فاز ۳ (App Table Grid):** فایل تست `designerRuntimeGridPreview.test.tsx` به‌خاطر نبود wrapper `CultureProvider` در ۱۰ از ۱۴ تست silent throw می‌کرد — یعنی این ۱۰ تست هرگز واقعاً چیزی را تست نمی‌کردند (شکستشان در شمارش «شکست‌های preexisting» گم شده بود). رفع شد؛ حالا هر ۱۴ تست با DOM واقعی سبزند.
- **فاز ۴ (Select/Autocomplete/Entity-Picker):** رفع اولیه‌ی مورد ۴۷ (`closeOnSelect`) نام پراپ را به `shouldCloseOnSelect` تغییر داده بود با این فرض که این نام واقعی کتابخانه است — بازبینی با خواندن مستقیم سورس نصب‌شده‌ی `react-aria-components` ثابت کرد این نام هم روی `Select`/`Autocomplete` وجود ندارد (فقط روی `Menu`/`DatePicker`). فیلد کاملاً از Inspector حذف شد (مثل `allowCustomValue`).
- **فاز ۵ (Dynamic Actions):** تست مورد ۸۷ فقط regex روی متن سورس بود (دقیقاً همان کلاس ضعف تست که خودِ این سند در بخش ۱۰.۰ هشدار داده بود)؛ با یک تست رفتاری واقعی (render+fireEvent روی select واقعی) جایگزین شد.

**یک رگرسیون واقعی هم توسط ناظر ارشد (نه ایجنت‌های فاز) در اجرای نهایی پیدا و رفع شد:** تست قدیمی‌تر `bindingParityEdgeCases.test.ts` هنوز انتظار داشت Export یک `<Input>` خام تولید کند (رفتار *قبل از* رفع مورد ۲۹)؛ به‌روزرسانی شد تا با `<UiInput>` (رفتار درست و فعلی) مطابقت داشته باشد.

### نتیجه‌ی تایپ‌چک (تأیید مستقل، نه فقط ادعای فاز ۱۳)

`node --max-old-space-size=8192 --stack-size=8000 tsc.js --noEmit -p .` کامل اجرا شد: **۱۵۲۸ خطا در کل مخزن**. با `git diff --unified=0` روی هر فایلی که این ۷۲ آیتم لمس کرده‌اند، تک‌تک محدوده‌ی خطوط تغییریافته را با محل دقیق خطاهای گزارش‌شده مقایسه کردم — **هیچ‌کدام از ۱۵۲۸ خطا داخل محدوده‌ی خطوط تغییریافته‌ی این ۷۲ آیتم نیست** (شامل فایل‌های پرخطای `designerRuntimePreview.tsx`/`runtimeRenderer.tsx` که هرچند این نشست تغییر کرده‌اند، خطاهایشان همگی در بخش‌های دست‌نخورده‌ی همان فایل‌اند). بزرگ‌ترین خوشه‌های خطا (`appendoo/engineeringPipeline.service.ts`, `file-manager.service.ts`, `presetMiniPreviews.tsx`, `ComponentDesignerView.tsx`, `BindingVizFieldMappingStep.tsx`, تست‌های سرور) در فایل‌هایی هستند که اصلاً در `git status` این نشست ظاهر نمی‌شوند — یعنی کاملاً پیش‌موجود و نامرتبط. **بدهی typing واقعی است ولی هیچ‌کدام رگرسیون این ۷۲ آیتم نیست.**

### نتیجه‌ی رگرسیون (اجرای مستقل نهایی)

- **Domain (`src/domain/component-designer`)**: **۱۸۵۰ موفق / ۳۷ ناموفق preexisting / ۱۸۸۷ کل** (بعد از رفع رگرسیون `bindingParityEdgeCases.test.ts`). فهرست ۳۷ شکست به‌طور کامل استخراج و دسته‌بندی شد: ۲۴ مورد `useCulture must be used within CultureProvider` (در ۵ فایل تست grid که خارج از دامنه‌ی ۷۲ آیتم‌اند و عمداً دست‌نخورده ماندند)، ۳ اسنپ‌شات با id تصادفی react-aria، ۲ مورد fireEvent.click/pointerDown روی کامپوننت‌های react-aria بدون polyfill `hasPointerCapture` (زیرساخت تست، نه محصول)، و بقیه در همین دو خوشه. **صفر مورد از این ۳۷ به هیچ‌کدام از ۷۲ آیتم مربوط است.**
- **Features (`src/features/component-designer`)**: **۲۶۰ موفق / ۲۶ ناموفق preexisting** (همان دو الگوی بالا).
- در مجموع بیش از ۵۰ فایل `*Fix*.test.*`/`*ParityFix*.test.*` جدید در این ۱۳ فاز نوشته شده‌اند که اکثر قریب‌به‌اتفاق‌شان (بعد از تقویت مورد ۸۷) رفتار واقعی (render+fireEvent DOM، یا تولید+اجرای واقعی کد Export با `tsc`/`esbuild`) را می‌سنجند، نه صرفاً تطبیق رشته.

**شکاف‌های شناخته‌شده‌ی عمداً رفع‌نشده (تصمیم محصولی — با «باگ فراموش‌شده» اشتباه گرفته نشوند):**

| # | موضوع | دلیل defer |
|---|---|---|
| ۸۳ | `content.icon` size از Dual-Mode API پر نمی‌شود | یکسان در هر دو مسیر؛ احتمالاً عمدی (اندازه‌ی آیکون معمولاً از API معنی ندارد) |
| ۸۴ | ۱۶ ویجت Dual-Mode بدون hydration زنده‌ی API در Canvas | **رفع شد ✅** در فاز ۱۴ / مورد ۱۰۰ |
| ۸۹ | نبود اکشن `navigate` در Dynamic Actions | **رفع شد ✅** در فاز ۱۵ / مورد ۱۰۱ |
| ۹۱ | `evaluateDesignerCondition` با `new Function` بدون sandbox | مدل اعتماد low-code؛ نیاز به تأیید صریح امنیتی محصول |
| — | `reusable.component.*` | نیازمند موتور resolution بک‌اند (سند ۱۹) |
| — | `shell.error-page` / `shell.not-found` به‌جز لینک dashboard | **رفع شد ✅** برای `shell.not-found` در فاز ۱۶ / مورد ۱۰۲ (`notFoundPageRef` روی پرتال). `shell.error-page` عمداً deferred (نیازمند ErrorBoundary سفارشی) |
| — | بدهی typing Export روی سندهای بسیار پیچیده (totalPath/series label/…) | جدا از parity سه مسیر؛ کاندید فاز typing جدا |

**حکم گواهی (پس از بازبینی مستقل دوم):** Component Designer از نظر **پاریتی فیلدهای Inspector بین Canvas / Preview / Export** و رفع باگ‌های تأییدشده‌ی دور اول+دوم برای سناریوهای اصلی کاربر (گرید/چارت با toolbar واقعی و query string واقعی در Export، فرم‌ها، refresh بعد از ذخیره، Shell chrome) **آماده‌ی Production است** — این ادعا این‌بار نه فقط بر مبنای ادعای خودِ فازها، بلکه با یک دور کامل بازبینی مستقل (۱۲ ایجنت + یک اجرای نهایی) که سه نقص واقعی (۲ باگ کد + ۱ تست سطحی) پیدا و رفع کرد، تأیید شده. مشروط به پذیرش شکاف‌های محصولی جدول بالا و بدهی typing از‌قبل‌موجود (نامرتبط با این کار) در بخش‌های دیگر مخزن.

---

## ۱۲. دور سوم — قابلیت‌های تصمیم‌گرفته‌شده (بعد از گواهی Production)

بعد از گواهی بخش ۱۱، ۴ مورد از جدول «شکاف‌های عمداً رفع‌نشده» بازبینی و برایشان تصمیم گرفته شد. این بخش هرکدام را با شواهد کد فعلی مستند می‌کند؛ فاز اجرای دقیق هرکدام (به‌جز مورد ۹۱ که بسته شد) در `docs/refactor-spec/21-DESIGNER-BUGFIX-EXECUTION-PHASES.md` فازهای ۱۴-۱۶ نوشته شده است.

### ۱۰۰. Hydration زنده در بوم طراحی برای ۱۶ ویجت Dual-Mode (تصمیم: انجام شود ✅) **(رفع شد ✅)**

**وضعیت فعلی (تأییدشده با خواندن کد):** `DUAL_MODE_CONTENT_PALETTE_IDS` (`bindingContentEngine.ts:30-47`) دقیقاً این ۱۶ عنصر را دارد: `content.stepper`, `content.carousel`, `content.icon`, `content.description-list`, `content.stat-trend`, `content.segmented-control`, `content.feature-grid`, `content.blog-card`, `content.team-member`, `content.split-media`, `content.cta-banner`, `marketing.hero-cta`, `marketing.faq-accordion`, `marketing.testimonial-carousel`, `marketing.pricing-table`, `marketing.newsletter-signup`. Grid (`DesignerCanvasHydratedDataGrid.tsx`) و Chart/Viz (`DesignerCanvasHydratedVizWidget.tsx`) در بوم طراحی از هوک عمومی `useDesignerHydratedRows` برای دیدن داده‌ی زنده‌ی API استفاده می‌کنند؛ این ۱۶ عنصر چنین مسیری ندارند — `canvasNodes.tsx` هیچ چک/wrapper مشابهی برایشان قبل از رسیدن به `renderHeroUiRealNode` ندارد، پس همیشه فقط `RuntimeRenderOptions.contentRows`/`contentListBound` تنظیم‌نشده می‌مانند و `resolveBoundUniversalOverrides` (`designerUniversalRuntime.tsx:64-68`) به داده‌ی استاتیک fallback می‌کند.

**تصمیم:** انجام شود. زیرساخت (`useDesignerHydratedRows`, `resolveContentListDataVarName`, `isDualModeContentNode`/`isContentDataBoundNode`) از قبل عمومی و آماده است؛ کار فقط تعمیم یک الگوی اثبات‌شده (`DesignerCanvasHydratedVizWidget.tsx`) به این خانواده است. جزئیات اجرا: فاز ۱۴.
**رفع:** فایل جدید `DesignerCanvasHydratedContentWidget.tsx` همان الگوی Viz را برای Dual-Mode Content اعمال می‌کند (`contentRows`/`contentListBound` از `useDesignerHydratedRows` + `resolveContentListDataVarName`)؛ `canvasNodes.tsx` قبل از `renderHeroUiRealNode` شاخه‌ی `shouldHydrateCanvasContentWidget` را اضافه کرد. گزینه‌ی ساده‌ی loading (بدون اسپینر/refresh بصری) انتخاب شد — `rows ?? []` در `resolveBoundUniversalOverrides` امن است. Preview/Export دست‌نخورده ماندند. تست رگرسیون: `dualModeContentCanvasHydrationPhase14Fix.test.tsx` (۵۳ تست: gate برای هر ۱۶ عنصر bound/unbound، hydration واقعی blog-card/carousel/segmented-control/cta-banner، static بدون تغییر، و smoke بدون کرش برای هر ۱۶).

### ۱۰۱. اکشن `navigate` در Dynamic Actions (تصمیم: انجام شود ✅) **(رفع شد ✅)**

**وضعیت فعلی (تأییدشده با خواندن کد):** `DesignerDynamicActionType` (`types.ts`) فقط `'setValue' | 'showHide' | 'showToast' | 'callMutation' | 'refreshDataSource' | 'resetForm'` دارد — هیچ راهی برای ناوبری برنامه‌ای (مثلاً بعد از Create موفق، برو به صفحه‌ی جزئیات همان رکورد) وجود ندارد. کتابخانه‌ی روتینگ واقعی پروژه `react-router-dom` است و از قبل در چند جای پلتفرم (`DesignerPublishedShellChrome.tsx`، `PortalHost.tsx`، `ExperienceHost.tsx`) با `useNavigate`/`useLocation`/`Navigate` استفاده می‌شود — یعنی یک وابستگی از‌پیش‌موجود و امن است، نه یک کتابخانه‌ی جدید.

**تصمیم:** انجام شود. افزایشی و کم‌ریسک (فقط یک نوع اکشن جدید در همان سوییچ‌های موجود). جزئیات اجرا: فاز ۱۵.
**رفع:** نوع `navigate` به `DesignerDynamicActionType` + فیلدهای `navigateTarget`/`navigateReplace` اضافه شد؛ Inspector گزینه‌ی Navigate + Target path + Replace history گرفت؛ Preview از طریق `useNavigate` (با پل امن وقتی Router نیست) به `executeDynamicAction` تزریق می‌شود؛ Export فقط وقتی سند حداقل یک navigate دارد `import { useNavigate }` و `navigate(resolved, { replace })` صادر می‌کند. Placeholderهای `{selection.id}`/`{store.x}` در Preview و Export یکسان resolve می‌شوند. تست رگرسیون: `dynamicActionNavigatePhase15Fix.test.tsx`.

### ۱۰۲. اتصال واقعی `shell.error-page` / `shell.not-found` به مکانیزم ۴۰۴ برنامه (تصمیم: انجام شود، با دامنه‌ی محدود ✅) **(رفع شد ✅ — فقط not-found)**

**وضعیت فعلی (تأییدشده با خواندن کد):** مکانیزم واقعی ۴۰۴ در سطح کل برنامه، کاملاً مستقل از Designer و هاردکد است: `src/app/platform/PlatformAppRoutes.tsx:48` یک روت catch-all دارد — `<Route path="*" element={<RouteNotFoundPage variant="fullscreen" />} />` — که `src/pages/RouteNotFoundPage.tsx` را رندر می‌کند (یک کامپوننت ثابت React، نه چیزی که از سند Designer بیاید). عناصر پالت `shell.error-page`/`shell.not-found` (طبق سند دور اول) فقط بلوک‌های محتوایی ثابت روی بوم هستند — هیچ ثبت/رجیستری‌ای بین آن‌ها و این روت catch-all وجود ندارد؛ گذاشتن این عنصر روی یک صفحه هیچ اثری روی ۴۰۴ واقعی برنامه ندارد.

**تصمیم:** انجام شود، اما با دامنه‌ی محدودتر از دو مورد بالا — چون خودِ تغییر مسیر تصمیم‌گیری (کدام صفحه‌ی منتشرشده‌ی Designer به‌عنوان ۴۰۴/خطای یک پرتال خاص عمل کند) نیازمند یک لایه‌ی تنظیمات/ثبت (حتی در حد یک فیلد ساده روی تنظیمات پرتال) است که فراتر از خودِ Designer است. فاز ۱۶ این را با یک قدم تحقیق اول (بررسی این‌که آیا مکانیزم تنظیمات پرتال موجود اصلاً چنین فیلدی را به‌سادگی می‌پذیرد) شروع می‌کند تا دامنه‌ی واقعی روشن شود، سپس با fallback امن (اگر چیزی ثبت نشده بود، دقیقاً همان `RouteNotFoundPage` فعلی بدون تغییر رندر شود) پیاده می‌شود.
**رفع:** فیلد `notFoundPageRef` به `PlatformShell` و `ExperienceManifestPortal` اضافه شد و از طریق `shellRepository` / `portal.service` / `compileExperienceManifest` persist و round-trip می‌شود. UI تنظیمات پرتال یک انتخاب‌گر «Custom 404 page» دارد. مسیر واقعی ۴۰۴ داخل پرتال (`MountRouteFallback` / `PortalAwareNotFoundPage`) وقتی ref تنظیم شده باشد `DesignerPublishedPage` را رندر می‌کند؛ در غیر این صورت دقیقاً همان `RouteNotFoundPage` پیش‌فرض. catch-all سطح بالای `PlatformAppRoutes` (بدون PortalContext) دست‌نخورده ماند. **`shell.error-page` در این فاز عمداً deferred شد** — `ErrorBoundary` فعلی fallback سفارشی ندارد و ریسک حلقه‌ی خطا دارد. تست رگرسیون: `shellNotFoundErrorPagePhase16Fix.test.tsx`.

### مورد ۹۱ — موتور Condition (`new Function` بدون Sandbox): بسته شد، بدون تغییر کد

**تصمیم نهایی محصول (تأییدشده توسط کاربر):** دسترسی به ویرایش/طراحی در Component Designer فقط به کاربران داخلی معتمد/توسعه‌دهنده داده می‌شود — کاربران نهایی برنامه‌ی منتشرشده هرگز به خودِ Designer دسترسی ندارند. این دقیقاً همان مدل اعتمادی است که ابزارهای شناخته‌شده‌ی مشابه (Retool، Bubble و…) هم استفاده می‌کنند: کد سازنده با اعتماد کامل اجرا می‌شود، چون سازنده و کاربر نهایی دو نقش کاملاً جدا با سطح اعتماد متفاوت هستند. **نتیجه: ریسک پذیرفته‌شد؛ هیچ تغییر کدی لازم/انجام نشد.** اگر در آینده سیاست دسترسی Designer تغییر کند (مثلاً باز شدن به مشتریان self-service)، این تصمیم باید دوباره از صفر ارزیابی شود.

---

## ۱۳. Auto Form Builder — باگ‌های بحرانی (فاز ۱۷) ✅

تحقیق جداگانه‌ی ویزارد «From API» چهار شکاف بحرانی را نشان داد که در فاز ۱۷ رفع شدند. جزئیات اجرا: `21-DESIGNER-BUGFIX-EXECUTION-PHASES.md` فاز ۱۷. تست رگرسیون: `autoFormBuilderCriticalFixesPhase17.test.tsx`.

| # | موضوع | وضعیت |
|---|---|---|
| ۱۰۳ | گزینه‌های Reset/Close در ویزارد قابل‌انتخاب ولی بی‌اثر (`buildSubmitBinding` فقط toast/refresh) | **(رفع شد ✅)** |
| ۱۰۴ | نقطه‌ی ورود «From API» فقط در فهرست خالی؛ مسیر ادغام در Form/Modal موجود از UI غیرقابل‌فراخوانی | **(رفع شد ✅)** |
| ۱۰۵ | فرم بدون API غیرممکن؛ فرم Edit تنها همیشه به `selection.id` خالی وابسته | **(رفع شد ✅)** — دو بخش |

- **مورد ۱۰۳ — رفع شد ✅**
  **رفع:** منطق موفقیت فرم در `buildFormSuccessTrueActions` (`bindingResourceModel.ts`) یکی شد و Binding Form wizard هم از همان helper استفاده می‌کند. `autoFormTemplateBuilder` بعد از clone نودها با `finalizeAutoFormSubmitSuccess` اکشن‌های `resetForm`/`showHide(hide)` را روی دکمه‌ی Submit واقعی می‌نویسد (با `targetNodeId` فرم و Modal والد). تست: `autoFormBuilderCriticalFixesPhase17.test.tsx` (تولید + `generateDesignerTsx` برای هر ۴ رفتار).

- **مورد ۱۰۴ — رفع شد ✅**
  **رفع:** دکمه‌ی «From API» در نوار ابزار Canvas ادیتور (`data-testid="canvas-auto-form-from-api"`) اضافه شد؛ `openAutoFormWizard({ entryMode: 'canvas' })` هدف ادغام را از انتخاب فعلی resolve می‌کند و `applyAutoFormResult` وقتی هدف صریح باشد همیشه `mergeAutoFormIntoDocument` را صدا می‌زند. نقطه‌ی ورود فهرست خالی دست‌نخورده ماند. تست: ادغام Modal بدون پاک کردن siblingها در همان فایل تست فاز ۱۷.

- **مورد ۱۰۵ — رفع شد ✅**
  **رفع:** (۱) گزینه‌ی «Static form (no API)» در مرحله‌ی API؛ `staticForm: true` فرم بدون data source و بدون `regionSubmit` می‌سازد. (۲) هشدار «Record selection required» در مرحله‌ی Layout برای ورود catalog + سناریوی edit/detail/createEdit؛ گزینه‌ی «Read id from URL param» با `detailIdSource: 'urlParam'` → `params.<pk>` (هم‌راستا با `buildPreviewDesignerStore` که `params`/`urlParams` را از query پر می‌کند). تست: static + urlParam + UI warning در `autoFormBuilderCriticalFixesPhase17.test.tsx`.

---

## ۱۴. Auto Form Builder — پوشش فیلد + Validation از OpenAPI (فاز ۱۸) ✅

دو بهبود مستقل روی همان ویزارد Auto Form Builder. جزئیات اجرا: `21-DESIGNER-BUGFIX-EXECUTION-PHASES.md` فاز ۱۸. تست رگرسیون: `autoFormFieldCoveragePhase18Fix.test.ts`.

| # | موضوع | وضعیت |
|---|---|---|
| ۱۰۶ | `pattern`/`minLength`/`maxLength`/`minimum`/`maximum` هرگز از OpenAPI استخراج/اعمال نمی‌شدند | **(رفع شد ✅)** |
| ۱۰۷ | پوشش ناقص کنترل‌ها (۱۲ از ~۱۹) — file-upload/checkbox-group/radio-group/slider/autocomplete/entity-picker/date-range غایب | **(رفع شد ✅)** |

- **مورد ۱۰۶ — رفع شد ✅**
  **رفع:** `ApiFormField` و `schemaPropertyToFieldParts` (`apiFieldSchema.ts`) کلیدهای OpenAPI `pattern`/`minLength`/`maxLength`/`minimum`/`maximum` را استخراج می‌کنند. `buildControlProps` آن‌ها را روی `heroui.input-text`/`textarea`/`number-input` (و `min`/`max` روی `heroui.slider`) می‌گذارد — زیرساختی که Runtime از قبل در `runtimeNodeProps.ts` داشت. تست: استخراج schema + `generateDesignerTsx` + `tsc --noEmit` واقعی روی تگ‌های `UiInput`/`UiTextarea` در `autoFormFieldCoveragePhase18Fix.test.ts`.

- **مورد ۱۰۷ — رفع شد ✅**
  **رفع:** `AUTO_FORM_CONTROL_PALETTE_ITEM_IDS` با ۷ کنترل جدید گسترش یافت. `html.file-upload` برای `format: binary|byte` یا نام شامل file/attachment/upload به‌صورت پیش‌فرض پیشنهاد می‌شود. `checkbox-group`/`radio-group`/`slider`/`autocomplete`/`entity-picker`/`form.date-range` به‌عنوان گزینه‌ی دستی در dropdown (بدون تغییر پیش‌فرضهای موجود مثل boolean→switch). تست: پیشنهاد پیش‌فرض + alternatives + تولید نود واقعی با `paletteItemId`/props درست در همان فایل تست فاز ۱۸.

**بدهی فنی شناخته‌شده (عمداً خارج از دامنه):** `baseInfoFieldInference.ts` هنوز whitelist سخت‌کدشده‌ی فقط ۳ نام (`gender_code`/`person_type_code`/`topic_code`) دارد — نیاز به فاز جداگانه برای تعمیم.

---

## ۱۵. Auto Table/Grid Builder (فاز ۱۹) ✅

قابلیت جدید بزرگ: ویزارد «Table from API» که یک `heroui.app-table-grid` کامل (ستون‌ها، `gridListResource`، toolbar با `serverQuery` واقعی) را از schema پاسخ OpenAPI می‌سازد — هم‌ارز مفهومی Auto Form Builder برای گرید. جزئیات اجرا: `21-DESIGNER-BUGFIX-EXECUTION-PHASES.md` فاز ۱۹. تست رگرسیون: `autoTableBuilder.test.ts`، `autoTableRuntimeSubmit.test.tsx`.

| # | موضوع | وضعیت |
|---|---|---|
| ۱۰۸ | نبود ویزارد ساخت خودکار جدول از API روی Canvas خالی / درج در کانتینر | **(رفع شد ✅)** |

- **مورد ۱۰۸ — رفع شد ✅**
  **رفع:** `autoTableTemplateBuilder.ts` + `AutoTableWizardDialog.tsx`؛ ستون‌ها از `resolveEndpointResponseFormFieldsFromOpenApi` (response row، نه request body)؛ `suggestCellKindForField`؛ toolbar با `serverQuery.enabled` + `buildGridListBindingWithToolbarQueryParams` (قرارداد فاز ۱ برای query string در Export)؛ نقطه‌ی ورود دوگانه از روز اول (`catalog-auto-table-from-api` + `canvas-auto-table-from-api`) بدون تکرار اشتباه Auto Form. تست: schema→columns→toolbar→`generateDesignerTsx` queryParams + رندر Preview با hydration در همان فایل‌های تست فاز ۱۹.

---

## ۱۶. Auto CRUD Page Builder (فاز ۲۰) ✅

قابلیت جدید بزرگ: ویزارد «CRUD from API» که List (`heroui.app-table-grid`) + Create/Edit modal forms + Delete confirm (`callMutation` + `refreshDataSource`) را از یک data source واحد می‌سازد — ترکیب یکپارچه‌ی فازهای ۱۷ و ۱۹ با wiring واقعی `open-modal`. جزئیات اجرا: `21-DESIGNER-BUGFIX-EXECUTION-PHASES.md` فاز ۲۰. تست رگرسیون: `autoCrudPageBuilder.test.ts`، `autoCrudPageRuntimeE2E.test.tsx`.

| # | موضوع | وضعیت |
|---|---|---|
| ۱۰۹ | نبود ویزارد ساخت صفحه‌ی کامل List+Create+Edit+Delete از یک collection API | **(رفع شد ✅)** |

- **مورد ۱۰۹ — رفع شد ✅**
  **رفع:** `autoCrudPageBuilder.ts` + `AutoCrudWizardDialog.tsx`؛ ترکیب `buildAutoTableSeeds`/`mergeAutoFormIntoDocument`؛ Create/Edit با `open-modal` روی toolbar/row action و `selection.id`؛ Delete با `heroui.alert-dialog` + `callMutation`/`refreshDataSource`/`showHide`؛ نقطه‌ی ورود دوگانه (`catalog-auto-crud-from-api` + `canvas-auto-crud-from-api`). فیکس جانبی codegen: اعلام `dataContext` وقتی modal `visibleCondition` با Grid+Region هم‌زمان است (`bindingCodegen.ts`) تا Export به `TS2304` نخورد. تست: ساختار سند + Export queryParams/DELETE + Preview Create POST + Delete mutation/refresh.

---

## ۱۷. Built-in Components — حذف موکاپ‌های ادمین + زنده‌کردن drag-insert (فاز ۲۱) ✅

تحقیق جداگانه‌ی فهرست Built-in Components دو یافته‌ی محصولی را نشان داد. تصمیم کاربر: **هر دو آیتم گزینه‌ی الف**. جزئیات اجرا: `21-DESIGNER-BUGFIX-EXECUTION-PHASES.md` فاز ۲۱. تست رگرسیون: `builtInAdminPagesRemovalPhase21Fix.test.ts`، `builtInTemplateDragInsertPhase21Fix.test.tsx`.

| # | موضوع | وضعیت |
|---|---|---|
| ۱۱۰ | ۱۱ صفحه‌ی ادمین Built-in موکاپ ایستا و تکراریِ صفحات واقعی برنامه | **(رفع شد ✅)** — گزینه‌ی الف: حذف |
| ۱۱۱ | مکانیزم drag-insert Built-in (`resolve`/`clone`) سالم ولی بدون UI زنده | **(رفع شد ✅)** — گزینه‌ی الف: فعال‌سازی |

- **مورد ۱۱۰ — رفع شد ✅ (تصمیم محصولی: گزینه‌ی الف)**
  **رفع:** فایل `adminPageTemplates.ts` و همه‌ی `builtin-page-*` از `listBuiltInComponentSummaries`/`mergeComponentsCatalog`/`resolveBuiltInTemplateSeeds` حذف شدند. شاخه‌ی `templateId` ادمین در `draftComponentLayout` به layout-preset واقعی مهاجرت کرد. نگاشت ناوبری دیگر `getBuiltInAdminPageId` را صدا نمی‌زند. تست: `builtInAdminPagesRemovalPhase21Fix.test.ts`.

- **مورد ۱۱۱ — رفع شد ✅ (تصمیم محصولی: گزینه‌ی الف)**
  **رفع:** `BuiltInComponentCard` با `useDraggable` و `source: 'built-in-template'` بازنویسی شد و در بخش «Built-in Templates» داخل `DesignerToolbox` (داخل `DndContext` حالت ادیت) قرار گرفت — کاتالوگ فهرست خارج از DnD است و برای drag مناسب نبود. کلیک روی کارت‌های Built-in در فهرست کاتالوگ همچنان کل سند را بار می‌کند. تست: ثبت drag data + رندر Toolbox + `insert-built-in-template` واقعی در `builtInTemplateDragInsertPhase21Fix.test.tsx`.

---

## ۱۸. Built-in Components — ارتقای موکاپ‌های سطح-۳ + Built-inهای جدید (فاز ۲۲) ✅

تحقیق Built-in Components نشان داد چند preset مهم هنوز موکاپ متنی/container خام بودند، `dashboard-kpi` با `kpi-metrics-grid` هم‌پوشانی داشت، و شکاف‌های مهمی (CRUD binding-ready، Master-Detail کامل، ۴۰۴/Error، جست‌وجوی پیشرفته، تب‌بندی پروفایل/تنظیمات) پر نشده بودند. جزئیات اجرا: `21-DESIGNER-BUGFIX-EXECUTION-PHASES.md` فاز ۲۲. تست رگرسیون: `builtInTemplatesPhase22UpgradeFix.test.ts`.

| # | موضوع | وضعیت |
|---|---|---|
| ۱۱۲ | موکاپ‌های سطح-۳ (`kanban-board` / `analytics-detail` / `metrics-sidebar` / `comparison-table` / `dashboard-kpi`) بدون ویجت واقعی کاتالوگ | **(رفع شد ✅)** |
| ۱۱۳ | نبود Built-inهای پرکاربرد CRUD / Master-Detail کامل / ۴۰۴+Error / Advanced Search / تب‌بندی Settings | **(رفع شد ✅)** |

- **مورد ۱۱۲ — رفع شد ✅**
  **رفع:** در `presetExtendedTemplates.ts`، `kanban-board` → `viz.kanban`، `analytics-detail` → `viz.chart-line` + `content.stat-trend`، `metrics-sidebar` → `viz.chart-bar`، `comparison-table` → `marketing.pricing-table` (هم‌راستا با `PRESET_WIDGET_PARITY_CHECKLIST`). در `newLayoutPresets.tsx`، `dashboard-kpi` به alias ساده روی `kpi-metrics-grid` تبدیل شد (چهار `content.stat-trend` واقعی). تست: `builtInTemplatesPhase22UpgradeFix.test.ts` + به‌روزرسانی `tailwindUiBlocks.t1-26.test.tsx`.

- **مورد ۱۱۳ — رفع شد ✅**
  **رفع:** سه preset جدید در `phase22BuiltInTemplates.ts` ثبت شد: `crud-collection-page` (`heroui.app-table-grid` + modal Create + `apiRef` binding-ready)، `not-found-error-pages` (جفت `shell.not-found`/`shell.error-page` از `shellChromeTemplates.ts`)، `advanced-search-results` (`heroui.entity-picker` + فیلترها + `heroui.data-grid`). `master-detail-header` به صفحه‌ی کامل (هدر + فرم جزئیات + گرید مرتبط) گسترش یافت؛ `profile-overview` و `user-account-settings` با `heroui.tabs` واقعی تب‌بندی شدند. همه‌ی آیتم‌های جدید در `NEW_LAYOUT_PRESETS` / `mergeComponentsCatalog` / دسته‌ی `app` ظاهر می‌شوند. تست: resolve/clone/`generateDesignerTsx`+`assertValidTsxSyntax` + عدم استفاده از فیلدهای حذف‌شده‌ی ممیزی در `builtInTemplatesPhase22UpgradeFix.test.ts`.

## ۱۹. باگ گزارش‌شده‌ی کاربر — آدرس/endpoint نادرست در Form/Table/CRUD from API (فاز ۲۳) ✅

کاربر پس از تست دستی هر سه ویزارد «from API» (فازهای ۱۷/۱۹/۲۰) گزارش داد که آدرس API درست ساخته نمی‌شود. جزئیات اجرا: `21-DESIGNER-BUGFIX-EXECUTION-PHASES.md` فاز ۲۳. تست رگرسیون: `apiWizardColonPathParamExportFix.test.ts` + به‌روزرسانی تست‌های Auto Form/Table/CRUD موجود.

| # | موضوع | وضعیت |
|---|---|---|
| ۱۱۴ | `resolveBindingUrl` (runtime مشترک + Export) فقط placeholder سبک `{id}` را resolve می‌کرد، نه کانوانسیون `:id` که `buildDefaultRestOperations` واقعاً تولید می‌کند | **(رفع شد ✅)** |
| ۱۱۵ | فرم Create-only بدون `loadOperation` صریح، به‌خاطر استنتاج «detail» از روی `primaryKey`، یک GET پس‌زمینه با placeholder کاملاً resolve‌نشده می‌فرستاد | **(رفع شد ✅)** |

- **مورد ۱۱۴ — رفع شد ✅**
  **رفع:** در `bindingMutationRuntime.ts` (`resolveBindingUrl`) و معادل صادرشده‌اش در `bindingApiCodegen.ts`، بعد از جایگزینی `{name}`، یک پاس دوم برای `:name` هم اضافه شد — هماهنگ با `resolveOperationUrl`/`resolveMutationRuntimeUrl` که از قبل درست بودند.

- **مورد ۱۱۵ — رفع شد ✅**
  **رفع:** `resolveRegionLoadConfig` (`bindingResourceModel.ts`) اکنون `urlParams` را هر وقت `primaryKey` وجود دارد و endpoint واقعاً path-param متناظر دارد پر می‌کند — نه فقط وقتی `loadOperation === 'detail'` صریح ست شده. (یک رویکرد اول با `loadOperation: 'none'` صریح امتحان و رد شد چون زیرساخت binding فیلدهای فرم Create به وجود ساختاری region-fetch وابسته بود؛ رویکرد نهایی فقط شرط پرشدن urlParams را گسترش داد، بدون دست‌زدن به تشخیص endpoint یا زیرساخت binding.)
