# Client Components — تحلیل Element-by-Element (هر ۱۲۳ المنت Toolbox)

> **⚠️ نسخه ۲ — اصلاح‌شده بر اساس بررسی خط‌به‌خط کد واقعی:** یک ایجنت تحقیقاتی مستقل، مستقیماً روی کاتالوگ/اینسپکتور/رانتایم فعلی (نه روی این سند یا فایل‌های مرجع قدیمی)، تک‌تک ادعاهای بخش‌های ۱۴/۱۵/بخش‌های cross-cutting را راستی‌آزمایی کرد. نتیجه: **تقریباً همه‌ی ادعاهای بحرانی (۱۸ مورد از ۱۹ مورد جدول §۱۴) هنوز عیناً واقعی‌اند** — فازهای رفع‌باگ قبلی (۱-۲۲) روی حذف فیلدهای مرده/رفع باگ‌های binding تمرکز داشتند، نه افزودن این قابلیت‌های جدید. فقط **۱ مورد نادرست** (`marketing.hero-cta` واقعاً `title` دارد) و **۱ مورد نیازمند تلطیف لحن** (`content.segmented-control` دوگانگی `items`/`options` عمدی و مستند است، نه باگ) پیدا شد؛ همچنین در بخش گرید‌ها (§۶) باید تفکیک شود که Resize/Reorder/Multi-select **از قبل پیاده‌سازی شده‌اند** — فقط Pin/Bulk-Actions/Inline-Edit/Grouping واقعاً غایب‌اند. این اصلاحات مستقیماً در بخش‌های مربوطه پایین اعمال شده‌اند (برچسب «✅ اصلاح»/«⚠️ تدقیق»).

> **این سند مکمل** [`client-components-gap-analysis-fa.md`](./client-components-gap-analysis-fa.md) **است.** آن سند شکاف‌های سطح پلتفرم (Variables، Design Token، Data Connectivity، Real-time و…) را پوشش داد؛ این سند وارد **جزئیات هر المنت** می‌شود: کدام property را کم دارد، کدام property اشتباه/ناقص تعریف شده، و دقیقاً چه چیزی باید اضافه شود تا با آن المنت **بدون محدودیت** بشود ساخت.
>
> **توجه:** طبق تصمیم شما، Workflow/Automation پس‌زمینه‌ای **خارج از محدوده این دو سند** است (فیچر جداگانه‌ای در پلتفرم شما دارد آن را پوشش می‌دهد) — در سند اول، بخش ۲.۱ اصلاح شده و فقط یک نقطه اتصال سبک (Dynamic Action با نام `triggerWorkflow`) برای فراخوانی آن فیچر پیشنهاد شده است.
>
> **روش کار:** تک‌تک ۱۲۳ المنت از `client-components-toolbox-elements-fa.md` استخراج و لیست کامل Property هر کدام (اسکریپت پارس روی خود فایل) با کتابخانه‌های مرجع صنعت مقایسه شد: HeroUI v3 (خود پایه UI شما — بررسی شد که چه چیزی HeroUI native پشتیبانی می‌کند ولی در Inspector شما expose نشده)، TanStack Table / AG Grid (برای Data Grid)، React Aria (Date/Time)، TipTap (Rich Text)، IMask (Mask Input)، Recharts/ECharts (Chart)، dhtmlx-gantt (Gantt)، و الگوهای متداول Kanban/Sheet.
>
> **یافته کلیدی سطح بالا:** بسیاری از شکاف‌های زیر **باگ نیستند بلکه «Property Exposure ناقص»** هستند — یعنی خودِ HeroUI (کتابخانه پایه شما) قابلیت را دارد، ولی در لایه Catalog/Inspector شما آن prop تعریف نشده و در نتیجه از Inspector قابل تنظیم نیست. این‌ها **کم‌هزینه‌ترین و پراثرترین** اصلاحات هستند چون فقط لایه Catalog+Inspector+Runtime نیاز به آپدیت دارد، نه بازنویسی کامپوننت.

---

## فهرست

1. [یافته‌های Cross-Cutting (روی همه/اکثر المنت‌ها)](#1-cross-cutting)
2. [HTML Primitives (14)](#2-html-primitives)
3. [Layout (18)](#3-layout)
4. [Tailwind UI Blocks (8)](#4-tailwind-blocks)
5. [HeroUI General (8)](#5-heroui-general)
6. [HeroUI Data Display (9)](#6-heroui-data-display)
7. [HeroUI Forms and Inputs (23)](#7-heroui-forms)
8. [HeroUI Navigation and Overlays (7)](#8-heroui-nav)
9. [Logic (2)](#9-logic)
10. [Data Visualization (12)](#10-data-viz)
11. [Feedback & Status (4)](#11-feedback)
12. [Content & Media (11)](#12-content-media)
13. [Marketing (6)](#13-marketing)
14. [جدول اولویت‌بندی نهایی همه المنت‌ها](#14-جدول-نهایی)
15. [المنت‌های کاملاً غایب — باید از صفر اضافه شوند (Map، چارت‌های پیشرفته، Media Player، QR، Command Palette، …)](#15-المنت‌های-کاملاً-غایب--باید-از-صفر-اضافه-شوند)

---

## 1. Cross-Cutting

قبل از رفتن element-by-element، چند الگوی تکرارشونده در **همه یا اکثر المنت‌ها** دیده شد که باید یک‌بار در سطح معماری (Global §1/§2) حل شوند، نه تک‌تک:

### 1.1 عدم Debounce روی Binding رویدادهای پرتکرار

> **⚠️ تدقیق (نسخه ۲ — بررسی کد واقعی):** این ادعا نیمه‌درست است. `debounceMs` در سطح **تایپ و Codegen** از قبل وجود دارد: `DesignerGridToolbarSearchConfig.debounceMs` (`designerGridToolbarConfig.ts:14`) و معادلش در `designerChartToolbarConfig.ts` — هر دو واقعاً در `codegen.ts`/`bindingCodegen.ts` مصرف می‌شوند (پیش‌فرض ۳۰۰ms). اما **هیچ فیلد UI برای ویرایش این مقدار توسط کاربر در Inspector نیست** — نه در `InspectorGridToolbarField.tsx` (فقط چک‌باکس فعال‌سازی) و نه در `BindingChartFilterConfigStep.tsx` (مقدار همیشه هارد‌کد `?? 300`). یعنی منطق/زیرساخت هست، فقط UI کاربر برای شخصی‌سازی آن نیست — این یک آیتم کوچک (افزودن یک `NumberInput` به دو فایل Inspector بالا)، نه یک قابلیت کاملاً غایب.

~~هیچ‌کدام از inputها ... فیلد debounceMs ندارند~~ *(ادعای اصلی نادرست بود — فقط UI کاربر برایش نیست، نه خودِ زیرساخت)*

### 1.2 عدم Loading/Error/Empty State استاندارد روی همه المنت‌های داده‌محور
فقط `heroui.table` / `data-grid` / `app-table-grid` دارای `isLoading`, `emptyContent`, `errorContent` هستند. اما `viz.chart-*`, `viz.tree-*`, `viz.kanban`, `viz.gantt`, `viz.sheet`, `heroui.listbox`, `heroui.autocomplete` (که `isLoading` دارد ولی نه emptyContent) **فاقد این سه‌گانه استاندارد** هستند — یعنی وقتی API کند باشد یا خالی برگرداند یا خطا بدهد، این المنت‌ها چیزی نمایش نمی‌دهند یا کرش می‌کنند. **راه‌حل:** یک "Data-bound Element Contract" تعریف کنید که هر المنتی که `*DataResource` binding دارد باید این سه پراپرتی را داشته باشد — این را در سطح Catalog به‌عنوان یک mixin اجباری اعمال کنید.

### 1.3 عدم `disabledReason` / Tooltip روی حالت Disabled
در `isDisabled` همه‌جا فقط boolean است؛ هیچ‌جا نمی‌توان توضیح داد **چرا** غیرفعال است (مهم برای UX دکمه‌های submit غیرفعال به دلیل نقص فرم). پیشنهاد: `disabledReason?: string` کنار `isDisabled` در همه فرم‌المنت‌ها و دکمه‌ها.

### 1.4 ناهماهنگی نام‌گذاری بین المنت‌های مشابه
- `content.segmented-control` هم `items` و هم `options` دارد — به‌احتمال باگ کپی/رگرسیون (دو منبع داده برای یک هدف). باید یکی حذف/تجمیع شود.
- برخی المنت‌ها فقط `data` دارند (بدون schema مستند) — `content.feature-grid`, `content.blog-card`, `content.team-member`, `marketing.faq-accordion`, `marketing.testimonial-carousel`, `marketing.pricing-table`, `viz.timeline`, `viz.gantt`, `viz.sheet`, `viz.kanban` — یعنی shape داده هر کدام فقط در کد مشخص است، در Inspector مستند/type-safe نیست. برای AI-generation و کاربر غیرفنی این «جعبه سیاه» مشکل‌ساز است.

### 1.5 عدم Icon Prop مستقل از HeroUI عناصر تعاملی
~~`button-solid/outline`, `chip`, `dropdown` فاقد `startIcon`/`endIcon` صریح هستند~~ ✅ رفع شد (فاز ۳۴): فیلدهای `startIcon`/`endIcon` (icon-picker از Lucide) به `heroui.button-solid`, `heroui.button-outline`, `heroui.chip`, `heroui.dropdown` اضافه شد؛ برای دکمه `isIconOnly` هم اضافه شد. تست: `propertyExposurePhase34Fix.test.tsx`.

### 1.6 عدم Cross-Field Validation در همه فرم‌المنت‌ها
`validationRule` روی هر input **تک‌فیلدی** است (مطابق سند تحلیل قبلی، بخش ۲.۳). این روی input-text/textarea/number-input/select/… تکرار شده ولی هیچ‌کدام امکان ارجاع به مقدار فیلد دیگر ندارند (`endDate >= startDate`).

---

## 2. HTML Primitives

| المنت | مشکل/کمبود | شدت | راه‌حل دقیق |
|-------|------------|:---:|--------------|
| `html.heading` | ~~**باگ واقعی:** فقط `textContentMode, text, translationKey` دارد — **هیچ فیلد `level` (h1–h6) وجود ندارد!**~~ | 🔴 | ✅ رفع شد (فاز ۳۴): فیلد `level: 'h1'|'h2'|'h3'|'h4'|'h5'|'h6'` (پیش‌فرض `h2`) به Inspector/catalog اضافه شد؛ در Canvas/Preview/Export به تگ متناظر map می‌شود. تست: `propertyExposurePhase34Fix.test.tsx`. |
| `html.link` | `target=_blank` بدون auto-safety: هیچ‌جا اشاره نشده `rel="noopener noreferrer"` خودکار اضافه می‌شود. اگر نشود، یک حفره امنیتی کلاسیک (Reverse Tabnabbing) روی همه لینک‌های خروجی سایت است. | 🔴 (امنیتی) | ✅ رفع شد (فاز ۳۳): در Preview و Codegen هر دو، اگر `target === '_blank'` و `rel` خالی باشد، `rel="noopener noreferrer"` خودکار inject می‌شود؛ مقدار صریح کاربر محترم شمرده می‌شود. تست: `securityLinkIframePhase33Fix.test.tsx` |
| `html.image` | خوب و نسبتاً کامل (`srcSet`, `sizes`, `loading`, `objectFit`, `fallbackSrc`) ولی فاقد **caption** رسمی (باید با `html.figure` هماهنگ شود)، فاقد `blurDataUrl`/placeholder برای lazy load نرم، فاقد **art direction** (`<picture>` با چند source برای موبایل/دسکتاپ). | 🟡 | فیلدهای `placeholderBlur`, و یک حالت `responsiveSources: {breakpoint, src}[]` اضافه شود. |
| `html.iframe` | **حفره امنیتی:** فاقد `sandbox` attribute کاملاً — یعنی iframe جاسازی‌شده بدون محدودیت sandbox رندر می‌شود (خطر XSS/clickjacking اگر src از منبع نامعتبر باشد). فاقد `loading="lazy"` هم هست. | 🔴 (امنیتی) | ✅ رفع شد (فاز ۳۳): فیلد `sandbox` (پیش‌فرض `allow-scripts allow-same-origin`) و `loading` (پیش‌فرض `lazy`) به catalog، Inspector، Preview و Export اضافه شد. تست: `securityLinkIframePhase33Fix.test.tsx` |
| `html.file-upload` | فقط ۳ فیلد (`accept, multiple, htmlExtraAttrs`) — کاملاً پایه‌ای. فاقد: `maxFileSizeMb`, `maxFiles`, `showPreview`, `dragDropZone`, `uploadDestination` (کجا آپلود شود؟ فعلاً هیچ binding مشخصی به Asset Manager/Cloud Storage ندارد)، `progressIndicator`, پیام خطای i18n برای نوع/حجم نامعتبر. | 🔴 | این المنت باید بازطراحی عمقی شود؛ به بخش ۳.۳۰ سند قبلی («File Upload عمیق‌تر») مراجعه شود — این‌جا اولویت بالاتر است چون فرم بدون آپلود واقعی کاربردی نیست. |
| `html.list` / `html.list-item` | برای لیست **استاتیک** خوب است (`_listItems`)؛ اما هیچ اتصال به `logic.repeater` برای حالت پویا در همین المنت نیست — کاربر باید بین دو المنت متفاوت (List استاتیک vs Repeater پویا) جابه‌جا شود که UX را گیج‌کننده می‌کند. | 🟡 | یک toggle `sourceMode: 'static'|'dynamic'` روی `html.list` اضافه شود که با انتخاب dynamic، مستقیماً `dataPath` (مثل Repeater) باز کند — بدون نیاز به المنت جدا. |
| `html.section` / `html.article` / `html.figure` / `html.table-wrap` | این‌ها صرفاً wrapper معنایی با پراپرتی‌های عمومی هستند — قابل قبول. `html.figure` باید یک فیلد `caption`/`captionText` صریح داشته باشد (الان ندارد، فقط generic props) که به تگ `<figcaption>` معنایی متصل شود. | 🟢 | فیلد `captionText` (bindable) اضافه شود. |
| `html.form` | native attrs (`action/method/enctype`) قدیمی‌اند و در عمل جایگزین `regionDataSource` می‌شوند — تناقض نیست ولی مستندسازی باید روشن کند این‌ها فقط برای fallback بدون-JS هستند. کمبود واقعی: فیلد `isMultiStep`/`wizardMode` ندارد (به سند قبلی #6 مراجعه شود). | 🟠 | — |

---

## 3. Layout

| المنت | مشکل/کمبود | شدت | راه‌حل دقیق |
|-------|------------|:---:|--------------|
| `layout.grid-2` / `layout.grid-3` | دو المنت جدا برای ۲ و ۳ ستون — به‌جای این‌که یک المنت با prop عددی `columnCount` باشد. یعنی برای ۴، ۵، ۶ ستون کاربر باید از `layout.columns` (که `twGridCols` عمومی دارد) استفاده کند — ناهماهنگی: چرا ۲ و ۳ المنت جدا دارند ولی ۴+ ندارند؟ | 🟡 (طراحی ناهمگون) | `grid-2`/`grid-3` را deprecate کنید و تبدیل به یک `layout.grid` با `columnCount: number` (۱ تا ۱۲) + Responsive per-breakpoint (مطابق سند قبلی #9) کنید. |
| همه Grid/Flex layout ها | فاقد **CSS Grid پیشرفته**: `auto-fit`/`auto-fill` (کارت‌هایی که خودکار based on عرض کانتینر می‌چینند — پرکاربردترین الگوی مدرن کارت‌گرید)، فاقد `gridTemplateAreas` نام‌گذاری‌شده (Layout پیچیده Dashboard). | 🟠 | فیلد `gridAutoFlow: 'fit'|'fill'|'fixed'` + `minItemWidth` (برای auto-fit/fill) اضافه شود. |
| `layout.split-pane` | `direction, defaultSplit` دارد ولی فاقد `minSize`/`maxSize` per pane، فاقد `collapsible` (جمع‌کردن یک پنل با یک کلیک — الگوی خیلی رایج در IDEها/dashboardها)، فاقد persist کردن اندازه split در localStorage/store. | 🟡 | فیلدهای بالا اضافه و به `store` بخش قبلی (Document Variables) وصل شود تا اندازه split بین session ها حفظ شود. |
| `layout.sticky` / `layout.sticky-bar` | `offset` دارند ولی `zIndex` صریح ندارند (اگر چند sticky روی هم بیفتند، ترتیب نامشخص است چون فقط از className عمومی می‌آید نه یک فیلد اختصاصی که Inspector آسان بسازد). | 🟢 | فیلد عددی `stickyZIndex` اضافه شود. |
| `layout.overlay` | فقط `overlayLabel` — کاملاً مبهم؛ مشخص نیست backdrop opacity/blur, dismiss-on-click-outside, z-index از کجا می‌آید. | 🟠 | باید مثل `heroui.modal` غنی شود: `backdrop`, `isDismissable`, `zIndex`. |
| فقدان **Masonry Layout** | هیچ المنتی برای چیدمان Masonry (کارت‌های با ارتفاع نامساوی مثل Pinterest — پرکاربرد برای گالری/بلاگ) وجود ندارد. | 🟡 | المنت جدید `layout.masonry` با `columnCount`, `gap`. |
| فقدان **Responsive Visibility per breakpoint** مستقل از `visibleCondition` منطقی | `layout.visibleCondition` (در Logic) یک expression شرطی است، ولی «این المنت فقط روی موبایل مخفی شود» باید بدون نوشتن شرط، یک toggle ساده (`hideOn: ['mobile']`) باشد. | 🟠 | فیلد `hideOnBreakpoints: Breakpoint[]` سراسری (§1 Global) اضافه شود — این جدا از visibleCondition منطقی است و باید UX سریع‌تری داشته باشد. |

---

## 4. Tailwind UI Blocks

**یافته کلی این دسته:** همه ۸ المنت (`card`, `card-glass`, `hero`, `badge-pill`, `alert`, `stat-block`, `pricing`, `image-overlay`) — **به‌جز `badge-pill`** — تنها همان ۷ پراپرتی عمومی (`tw*` + `surfaceToken` + `htmlExtraAttrs`) را دارند و **هیچ Property اختصاصی معنایی ندارند**. ✅ **رفع شد (فاز ۴۱):** هفت بلوک container-like حالا props محتوایی + defaultProps + Inspector + Preview/Canvas/Export دارند؛ `tailwind.badge-pill` از قبل `text` داشت. **دو ورودی معتبر با props یکسان** (نه ادغام): `tailwind.stat-block` ↔ `content.stat-trend`، `tailwind.pricing` ↔ `marketing.pricing-table`، `tailwind.alert` ↔ `feedback.alert`، `tailwind.hero` ↔ `marketing.hero-cta` — بلوک‌های Tailwind برای استایل/چیدمان سریع، ویجت‌های Content/Marketing برای data-binding پیشرفته.

| المنت | مشکل | راه‌حل |
|-------|------|--------|
| `tailwind.stat-block` | ~~فاقد `label`/`value`/`trend`~~ | ✅ رفع شد (فاز ۴۱): props هم‌شکل `content.stat-trend` — دو ورودی معتبر (استایل Tailwind vs data-bound widget). |
| `tailwind.pricing` | ~~فاقد props پلن~~ | ✅ رفع شد (فاز ۴۱): `planName, price, billingPeriod, features, isHighlighted, ctaLabel` — معادل ساختاری `marketing.pricing-table`. |
| `tailwind.alert` | ~~فاقد `title, message, variant, dismissible`~~ | ✅ رفع شد (فاز ۴۱): props هم‌شکل `feedback.alert` + `dismissible`. |
| `tailwind.hero` | ~~فاقد hero props~~ | ✅ رفع شد (فاز ۴۱): `heading, subheading, primaryCta, secondaryCta, backgroundImage`. |
| `tailwind.image-overlay` | ~~فاقد `imageSrc, overlayText, overlayOpacity`~~ | ✅ رفع شد (فاز ۴۱). |
| `tailwind.card-glass` | ~~فاقد `title, description, imageSrc`~~ | ✅ رفع شد (فاز ۴۱). |
| `tailwind.card` | فاقد props محتوایی (فقط className) | ✅ رفع شد (فاز ۴۱): `title, description`. |
| `tailwind.badge-pill` | این یکی خوب است (`text, translationKey`) — تنها موردی از این ۸ تا که واقعاً محتوا دارد. | ✅ بدون تغییر |

**نتیجه‌گیری این بخش:** ✅ فاز ۴۱ props محتوایی و defaultProps را به هفت بلوک اضافه کرد — drag از Toolbox دیگر تهی نیست. ویجت‌های Content/Marketing برای سناریوهای data-bound پیشرفته باقی می‌مانند؛ بلوک‌های Tailwind برای چیدمان/استایل سریع با همان نام فیلدهای متناظر.

---

## 5. HeroUI General

| المنت | مشکل/کمبود | شدت | راه‌حل |
|-------|------------|:---:|--------|
| `heroui.button-solid` / `button-outline` | ~~فاقد `startIcon`/`endIcon` صریح~~؛ ~~فاقد `iconOnly` mode~~؛ فاقد `fullWidth`؛ فاقد `loadingText` هنگام `isLoading`. | 🟠 | ✅ بخشی رفع شد (فاز ۳۴): `startIcon`/`endIcon`/`isIconOnly` اضافه شد. `fullWidth`/`loadingText` هنوز بازند. تست: `propertyExposurePhase34Fix.test.tsx` |
| `heroui.chip` | فاقد `onClose`/`isRemovable` (چیپ‌های قابل حذف — الگوی رایج در Tag list/Filter chips)، ~~فاقد `icon`~~. | 🟠 | ✅ `startIcon`/`endIcon` اضافه شد (فاز ۳۴). `onClose`/`isRemovable` هنوز بازند. |
| `heroui.avatar` | فاقد `fallbackInitials` خودکار (وقتی `src` load نشود چه نمایش داده شود؟)، فاقد `statusIndicator` (نقطه آنلاین/آفلاین — پرکاربرد در چت/تیم)، و **کلاً `heroui.avatar-group` به‌عنوان یک المنت جدا در Toolbox وجود ندارد** (نمایش پشته‌ای چند آواتار با "+N بیشتر" — الگوی استاندارد). | 🟠 | فیلدهای بالا + المنت جدید `heroui.avatar-group`. |
| `heroui.tooltip-trigger` | فاقد `placement` (top/bottom/left/right)، فاقد `delay`/`closeDelay`، محتوای Tooltip فقط `text` ساده است نه محتوای غنی (نمی‌توان تصویر/چند خط در Tooltip گذاشت). | 🟡 | — |
| `heroui.progress` | فقط نوار خطی — HeroUI native هم `ProgressCircle` و `Meter` دارد که در Toolbox شما expose نشده. فاقد `indeterminate` state، فاقد `colorThresholds` (مثلاً قرمز شدن بالای ۹۰٪). | 🟠 | فیلد `variant: 'linear'|'circular'|'meter'` اضافه شود (مستقیماً قابلیت موجود HeroUI را expose می‌کند، هزینه پیاده‌سازی کم است). |
| `heroui.skeleton` | `animationType` دارد ولی `shape` (text/circle/rect/card) ندارد — یعنی هر جا Skeleton بگذارید یک شکل عمومی است، نه متناسب با نوع محتوای در حال بارگذاری. | 🟢 | — |
| `heroui.spinner` | خوب و ساده، بدون کمبود مهم. | ✅ | — |

---

## 6. HeroUI Data Display

این دسته **حیاتی‌ترین بخش برای «App Builder کامل»** است چون هر پنل ادمین حول جدول داده می‌چرخد. سه المنت (`table`, `data-grid`, `app-table-grid`) با overlap قابل توجه وجود دارد.

| المنت | مشکل/کمبود مشترک هر سه گرید | شدت |
|-------|------------------------------|:---:|
| `heroui.table`, `heroui.data-grid`, `heroui.app-table-grid` | **⚠️ تدقیق (نسخه ۲):** Resize/Reorder ✅؛ Multi-select فیلد داشت ولی بدون سیم‌کشی واقعی. ✅ **رفع شد (فاز ۳۵):** `layoutPinned` + sticky pin در `AppTableGrid`/`DesignerDataGridTable`؛ `selectionMode` + `onSelectionChange` روی هر سه گرید در Event Matrix؛ `bulkActions` روی toolbar + نوار Bulk هنگام انتخاب؛ `editable`/`cellEditorPaletteItemId`/`onCellChangeActions` + `onCellChange` event. تست: `gridPinBulkInlineEditPhase35Fix.test.tsx`. ✅ **رفع شد (فاز ۳۶):** `gridAggregationConfig` — GroupBy چندسطحی، Subtotal/Grand Total، Pivot، گروه‌های تاشو + client/server query params. تست: `gridAggregationPhase36Fix.test.tsx`. باقی‌مانده: expandable row، virtualization flag صریح. | 🟠 → 🟡 (Grouping رفع شد) |

**راه‌حل ساختاری پیشنهادی:** به‌جای افزودن پراکنده به هر سه، این‌ها را در یک لایه مشترک `gridCapabilities` تجمیع کنید (چون `app-table-grid` ظاهراً قرار است ابرمجموعه دو تای دیگر باشد):

```
gridCapabilities: {
  resizableColumns: boolean       // ✅ از قبل هست (layoutResizable) — فقط باید زیر یک namespace مشترک بیاید
  reorderableColumns: boolean     // ✅ از قبل هست (layoutReorderable)
  rowSelection: 'none' | 'single' | 'multiple'  // ✅ از قبل هست (selectionMode)
  pinnedColumns: { left: string[], right: string[] }  // ❌ واقعاً باید ساخته شود
  bulkActions: DynamicAction[]    // ❌ واقعاً باید ساخته شود (+ سیم‌کشی onSelectionChange)
  inlineEdit: boolean             // ❌ واقعاً باید ساخته شود
  expandableRows: { enabled, detailNodeRef }  // ❌ واقعاً باید ساخته شود
  grouping: { groupByField, aggregations: {field, fn}[] }  // ❌ واقعاً باید ساخته شود
  columnFilters: boolean          // ❌ واقعاً باید ساخته شود
  virtualized: boolean            // ❌ واقعاً باید ساخته شود
}
```

سپس در Inspector این‌ها زیر یک تب جدید «Grid Capabilities» قرار بگیرند تا Inspector شلوغ نشود.

> **⚠️ اصلاح/تدقیق بعد از بررسی عمیق‌تر Data Binding (بررسی سوم):** یک تناقض مستقیم در خود سند منبع پیدا شد — پراپرتی‌های `page` و `total` روی `heroui.data-grid`/`app-table-grid` هم‌زمان «Data Binding: ❌ فقط literal» **و** در متن تحلیل همان پراپرتی «**Bindable**» علامت خورده‌اند. این یعنی مشخص نیست این دو مقدار وقتی گرید به یک API واقعی وصل می‌شود، خودکار از پاسخ سرور (`responseMapping.totalPath`) پر می‌شوند یا کاربر باید دستی در Inspector مقدار بدهد. **این نوع ابهام دقیقاً همان چیزی است که با هدف «تنظیمات دقیق و بدون‌نقص» در تضاد است** — تحلیل کامل این مشکل + ۵ مشکل مشابه دیگر (Field Mapping چارت/Viz به‌صورت عمومی و type-agnostic مستند شده، نبود کامل Aggregation/GroupBy/Pivot، نبود Combo Chart، نامشخص‌بودن مرحله «Filters» در Wizard چارت) در سند اول، **بخش جدید ۱۹** به‌طور کامل با schema دقیق TypeScript برای هرکدام مستند شده است — پیشنهاد می‌شود قبل از هر پیاده‌سازی گرید/چارت جدید، آن بخش خوانده شود.

**پیشنهاد اضافه:** روشن کنید که آیا `heroui.table` (ساده) و `heroui.data-grid` (متوسط) واقعاً باید ۲ المنت جدا باشند یا صرفاً presets مختلف از `app-table-grid` هستند — سه المنت با overlap زیاد گیج‌کننده است (چه زمانی کدام را استفاده کنم؟ این باید در Toolbox tooltip/doc روشن شود).

| المنت | کمبود اختصاصی | شدت |
|-------|----------------|:---:|
| `heroui.listbox` | فقط `items, selectedKeys, isDisabled` — فاقد search box داخلی، فاقد multi-select صریح، فاقد virtualization برای لیست بلند. | 🟡 |
| `heroui.pagination` | فاقد `showControls` (دکمه‌های اول/آخر)، فاقد `boundaries/siblings` (چند شماره صفحه اطراف صفحه فعلی نشان داده شود)، فاقد `simpleMode` (فقط قبلی/بعدی برای موبایل). | 🟢 |
| `heroui.accordion-item` | فاقد `title`/`isDisabled` صریح در لیست props (فقط generic tw*) — یعنی محتوای Accordion هم کاملاً به children وابسته است؛ حداقل `title` باید فیلد مستقیم باشد. | 🟡 |
| `heroui.typography-lead` | ساده و بدون کمبود مهم. | ✅ |

---

## 7. HeroUI Forms and Inputs

بزرگ‌ترین و مهم‌ترین دسته (۲۳ المنت). خبر خوب: `input-text`, `textarea`, `number-input`, `date-picker`, `form.mask-input` **بسیار غنی** هستند (۲۵–۴۶ پراپرتی). خبر بد: چند المنت به‌شدت **ناهماهنگ ضعیف‌تر** از بقیه‌اند — انگار فراموش شده‌اند.

### 7.1 المنت‌های به‌شدت ناقص (نیاز فوری به تکمیل)

| المنت | props فعلی | مشکل | راه‌حل |
|-------|-----------|------|--------|
| `form.time-input` | فقط `label, value, htmlExtraAttrs` (۳ فیلد!) | در مقایسه با `heroui.date-picker` (۳۳ فیلد) این یک **افت کیفیت شدید** است. فاقد `min`, `max`, `step` (فاصله دقیقه — ۵/۱۰/۱۵ دقیقه‌ای)، فاقد `hourCycle` (12/24 ساعته)، فاقد `granularity` (ساعت:دقیقه:ثانیه)، فاقد `isRequired/isDisabled/isInvalid/errorMessage` (حتی validation پایه هم ندارد!) | باید هم‌تراز `date-picker` (که از همان React Aria primitives ساخته شده طبق تحقیق HeroUI) غنی شود — این‌ها احتمالاً به‌راحتی از TimeField موجود HeroUI native قابل expose هستند. |
| `form.datetime-input` | فقط `label, value, htmlExtraAttrs` (۳ فیلد!) | همان مشکل بالا؛ حتی `min/max` هم ندارد که برای «تاریخ تحویل باید بعد از امروز باشد» حیاتی است. | هم‌تراز `date-picker` (که `minValue/maxValue/timeZone/granularity` دارد) کامل شود. |
| `form.rating` | فقط `label, value, max` (۴ فیلد) | فاقد `allowHalf` (نیم‌ستاره)، فاقد `icon` سفارشی (قلب به‌جای ستاره)، فاقد `readOnly`، فاقد validation. | تکمیل شود. |
| `form.otp-input` | فقط `label, value, length` (۴ فیلد) | فاقد `numericOnly`, `autoSubmitOnComplete`, `resendTimerSeconds`/`onResend` binding (بدون این، سناریوی «کد تایید پیامکی» که باید resend داشته باشد ساخته نمی‌شود)، فاقد `mask` (نمایش bullet به‌جای عدد). | تکمیل شود — این المنت برای OTP احراز هویت حیاتی است. |

### 7.2 المنت‌های نسبتاً کامل با کمبودهای مشخص

| المنت | کمبود | شدت |
|-------|-------|:---:|
| `heroui.select` / `heroui.autocomplete` | مشخص نیست **multi-select** یک mode صریح دارد یا نه (فقط `selectedKeys` پیچی است که می‌تواند تک یا چند باشد ولی هیچ toggle واضحی برای «آیا چندتایی مجاز است» در فهرست props دیده نشد)؛ فاقد `groupBy` (گروه‌بندی آپشن‌ها زیر یک عنوان)؛ `autocomplete` فاقد `allowCustomValue` (اجازه واردکردن مقداری خارج از لیست) و فاقد `searchDelayMs`. | 🟠 |
| `heroui.entity-picker` | فاقد `extraFilters` (فیلتر ثابت اضافه روی سرچ، مثلاً «فقط کاربران فعال»)، فاقد حالت **چندانتخابی**، فاقد «افزودن سریع» (quick-create اگر آیتم موردنظر در لیست نبود). | 🟠 |
| `form.date-range` | فاقد **Presets** (امروز/۷ روز اخیر/این ماه/بازه سفارشی — پرکاربردترین الگوی فیلتر تاریخ در داشبورد!) و فاقد `timeZone`. با توجه به این‌که HeroUI native خودش `DateRangePicker` دارد، شاید بهتر باشد `form.date-range` مستقیماً از آن استفاده کند تا از تکرار منطق و ناهماهنگی با `date-picker` جلوگیری شود. | 🔴 (برای Dashboard حیاتی) |
| `heroui.tags-input` | فاقد `maxTags`, `allowDuplicates`, `separatorKeys` (کاما/اینتر/تب)، فاقد منبع suggestion (autocomplete روی تگ‌ها). | 🟡 |
| `heroui.color-control` | فاقد `outputFormat` (hex/rgb/hsl)، فاقد eyedropper، فاقد gradient. | 🟢 |
| `heroui.slider` | ~~**فقط تک‌مقداره** (`value` تکی)~~ — ✅ رفع شد (فاز ۳۴): `sliderMode: 'single'|'range'`, `minValue`/`maxValue`, `showTooltip` اضافه شد؛ در Canvas/Preview/Export دو Thumb رندر می‌شود. `marks` هنوز باز است. تست: `propertyExposurePhase34Fix.test.tsx` | 🔴 (فرصت کم‌هزینه با اثر بالا) |
| `heroui.switch` | فاقد `onLabel`/`offLabel` (متن کنار سوییچ)، فاقد `isLoading` (برای toggle که async است، مثلاً تغییر وضعیت با یک API call). | 🟡 |
| `heroui.checkbox-group` / `radio-group` | فاقد `orientation` صریح (افقی/عمودی)، `checkbox-group` فاقد «انتخاب همه» (Select All)، فاقد امکان غیرفعال‌کردن یک آیتم خاص به‌صورت مستقل. | 🟡 |
| `form.calculator` | این المنت درواقع یک "Numeric Input with Keypad" است، نه یک "Calculated Field" واقعی — نام‌گذاری گمراه‌کننده است. ~~اما محاسبه‌ی فرمول بین فیلدها غایب بود~~ ✅ رفع شد در سطح binding (فاز ۴۷ — `sourceType: 'formula'` روی هر prop؛ تست: `formulaBindingExpressionPhase47Fix.test.ts`). تغییر نام keypad به `form.numeric-keypad-input` اختیاری/خارج از دامنه ماند. | 🟠 | باید یا نامش به `form.numeric-keypad-input` تغییر کند، یا یک المنت واقعاً جدید `form.formula-field` (که از Expression Engine سند قبلی استفاده کند) اضافه شود. |
| `form.html-editor` | بسیار غنی (۴۶ فیلد) اما فاقد: اتصال آپلود تصویر به Asset Manager (فیلد `enableImage` هست ولی مقصد آپلود مشخص نیست)، فاقد `wordCountDisplay`، فاقد Markdown import/export toggle، فاقد @mention. | 🟡 |
| `form.code-editor` | غنی و خوب؛ فاقد فقط `jsonSchemaRef` (اعتبارسنجی زنده JSON در برابر schema) و `diffMode`. | 🟢 |
| `heroui.field-container` | فقط `label` — این wrapper است، منطقی است که ساده باشد. | ✅ |
| `form.mask-input` | بسیار کامل (۴۲ فیلد) — کمبود مهمی دیده نشد. | ✅ |

---

## 8. HeroUI Navigation and Overlays

| المنت | مشکل/کمبود | شدت |
|-------|------------|:---:|
| `heroui.tabs` | ~~**مشکل جدی:** پراپرتی‌های اختصاصی این المنت **فقط** `tw*` + `surfaceToken` + `htmlExtraAttrs` است — یعنی **هیچ فیلدی برای تعریف خودِ تب‌ها وجود ندارد**~~ ✅ رفع شد (فاز ۳۴): فیلد ساختاریافته `items: { key, label }[]` به Inspector اضافه شد؛ وقتی خالی باشد رفتار child-based قبلی حفظ می‌شود. تست: `propertyExposurePhase34Fix.test.tsx` | 🔴 |
| `heroui.breadcrumbs` | ~~همان مشکل: فقط generic props، **بدون فیلد `items` (مسیر breadcrumb)**~~ ✅ رفع شد (فاز ۳۴): فیلد `items: { label, href?, isCurrent? }[]` اضافه شد. تست: `propertyExposurePhase34Fix.test.tsx` | 🔴 |
| `heroui.toolbar` | مشابه — فقط generic props، بدون `items`/`actions` ساختاریافته؛ کاملاً به children وابسته. برای این‌که AI بتواند «یک Toolbar با دکمه‌های ذخیره/چاپ/خروجی» بسازد، نیاز به یک آرایه `actions: {icon, label, actionRef}[]` دارد. | 🟠 |
| `heroui.dropdown` | `label, items, isDisabled` — فاقد `triggerType` (click/hover)، فاقد `closeOnSelect`، فاقد آیتم‌های چک‌باکسی (multi-select menu)، فاقد آیکون/شورت‌کات per item. | 🟡 |
| `heroui.modal` / `alert-dialog` / `drawer` | پوشش خوب (`isOpen, size, placement, isDismissable, backdrop, scrollBehavior`)؛ `alert-dialog` باید فیلدهای ساختاریافته `confirmLabel`, `cancelLabel`, `onConfirmAction` مستقیم داشته باشد (به‌جای این‌که کاربر مجبور شود دستی دکمه‌های داخلش را با Dynamic Action ست کند) — چون این یک الگوی بسیار پرتکرار (Confirm Delete) است که باید یک‌کلیکی باشد. | 🟡 |

**نتیجه‌گیری این بخش:** الگوی «فقط generic tw* props، بدون فیلد ساختاریافته محتوا» که در بخش Tailwind UI Blocks هم دیدیم، این‌جا در `tabs`, `breadcrumbs`, `toolbar` هم تکرار شده. **این یک الگوی سیستماتیک در کدبیس است** — به نظر می‌رسد این المنت‌ها اخیراً اضافه شده‌اند و هنوز به مرحله «تعریف props ساختاریافته» نرسیده‌اند (فقط اسکلت container گرفته‌اند). توصیه می‌شود یک ممیزی کامل روی *همه* المنت‌هایی که تنها generic props دارند انجام شود (این‌ها را می‌توان با اسکریپت مشابه اسکریپت پارس این سند به‌سرعت شناسایی کرد — هر المنتی که فقط زیرمجموعه‌ای از `{twFlexDirection, twItems, twJustify, twGap, twGridCols, surfaceToken, htmlExtraAttrs}` را دارد، مشکوک است).

---

## 9. Logic

| المنت | مشکل/کمبود | شدت |
|-------|------------|:---:|
| `logic.repeater` | `dataPath, itemAlias, indexAlias` — فاقد `keyField` صریح (React reconciliation درست بدون key منحصربه‌فرد دچار مشکل رندر می‌شود)، فاقد `emptyState`/`loadingState` (سه‌گانه استاندارد بخش ۱.۲)، فاقد `virtualScroll` برای لیست‌های بزرگ (مثلاً ۱۰۰۰ آیتم)، فاقد `maxItems`/`pagination`. | 🟠 |
| `logic.visibility-container` | ساده و تک‌منظوره — بدون کمبود مهم به‌جز این‌که `visibleCondition` (طبق سند قبلی) فقط تک‌شرطی است نه چندشرطی AND/OR. | 🟡 (وابسته به شکاف سطح پلتفرم) |
| **کمبود کلی این دسته** | فقط ۲ المنت! فاقد `logic.switch-case` (رندر شرطی چندحالته — مثل switch/case، نه فقط visible/hidden دوحالته)، فاقد `logic.error-boundary` (مدیریت خطای رندر یک زیردرخت بدون کرش کل صفحه). | 🟡 |

---

## 10. Data Visualization

این دسته **بیشترین شکاف نسبی به تعداد پراپرتی** را دارد — به‌خصوص ۴ المنت آخر که عملاً **فقط یک پراپرتی `data`** دارند.

> **⚠️ یافته بحرانی جدید (بررسی سوم — دقت Data Binding):** با استخراج خودکار بخش «### Wizard» **همه** ۱۲ المنت این دسته، مشخص شد که متن Wizard هر ۴ چارت (`chart-bar/line/pie/sparkline`) **کلمه‌به‌کلمه یکسان** است (`chartFieldMapping, chartToolbarConfig, seriesKeys, xAxisKey`) و متن Wizard هر ۸ عنصر Viz (`tree-view, tree-select, cascader, tree-combobox, timeline, gantt, sheet, kanban`) هم **کلمه‌به‌کلمه یکسان** است (`vizFieldMapping, vizToolbarConfig, data`) — با اینکه این المنت‌ها از نظر داده‌ای هیچ اشتراکی ندارند (Gantt به start/end/dependency نیاز دارد، Kanban به status/column-map، Sheet به تعریف نوع هر ستون). این یعنی **فعلاً این ۸ ویجت Viz به‌صورت type-specific و دقیق قابل‌اتصال به یک API واقعی نیستند** — Wizard یک شکل عمومی به همه می‌دهد. schema دقیق پیشنهادی (discriminated union کامل TypeScript برای هرکدام) در سند اول (`client-components-gap-analysis-fa.md`)، **بخش ۱۹.۱ و ۱۹.۲** آمده است — پیشنهاد قوی می‌شود قبل از توسعه بیشتر این دسته، آن بخش دیده شود چون مستقیماً به دقت binding (خواسته اصلی شما) مربوط است.

### 10.1 چارت‌ها (bar/line/pie/sparkline)

| مشکل مشترک | شدت |
|------------|:---:|
| فاقد `colorPalette` سفارشی (رنگ‌بندی سری‌ها فقط پیش‌فرض است) | 🟡 |
| فاقد `tooltipFormatter`/`valueFormat` (نمایش عدد به‌صورت درصد/ارز/هزارگان) | 🟠 |
| فاقد `referenceLine`/`annotation` (خط هدف/آستانه روی چارت) | 🟡 |
| فاقد `onDataPointClick` در Event Eligibility Matrix — یعنی **Drill-down/Cross-filter** (شکاف #4 سند قبلی) از ریشه در سطح المنت هم امکان‌پذیر نیست چون رویداد کلیک روی نقطه داده اصلاً تعریف نشده ✅ رفع شد (فاز ۳۷ — `onDataPointClick` + تست `chartFieldMappingPhase37Fix.test.tsx`) | 🔴 |
| فاقد `secondaryYAxis` (چند مقیاس هم‌زمان، مثلاً تعداد + درصد) | 🟡 |
| فاقد دکمه `exportAsImage` (PNG/SVG) | 🟢 |
| **`viz.chart-bar`**: فقط `grouped: boolean` دارد — یعنی «Stacked» به‌صورت درصدی (`percent-stacked`) پشتیبانی نمی‌شود، فقط grouped/stacked ساده. | 🟡 |
| **`viz.chart-pie`**: نام المنت **«Pie / Donut / Gauge»** است ولی props آن (`data, seriesKeys, xAxisKey, showLegend, showGrid, height, chartVariant, valueKey`) **هیچ فیلد مخصوص Gauge ندارد** (`min`, `max`, `thresholds`, `needleValue` لازم برای یک Gauge واقعی). این یک **باگ واقعی نامگذاری/پیاده‌سازی** است — یا Gauge باید یک المنت جدا با props خودش شود، یا این props اضافه شوند. ✅ رفع شد (فاز ۳۷ — `gaugeMin`/`gaugeMax`/`gaugeThresholds` در Inspector وقتی `chartVariant=gauge` + رندر واقعی در `UiChartGauge`) | 🔴 |

### 10.2 المنت‌های «فقط `data`» (بحرانی‌ترین بخش این دسته)

| المنت | چه چیزی کاملاً غایب است | شدت |
|-------|---------------------------|:---:|
| `viz.gantt` | ~~فاقد `viewMode` (روز/هفته/ماه)، فاقد `taskDependencies`، فاقد `milestones`، فاقد `onTaskDrag`~~ ✅ رفع شد (فاز ۴۲ — `vizTimelineGanttBinding.test.tsx`): `viewMode`/`dependencies`/`milestones` در Inspector + Preview + Export اضافه شد، پیکان وابستگی بین barها رندر می‌شود، milestone marker نمایش داده می‌شود، و drag اولیه‌ی task با رویداد `onTaskDrag` در runtime/export فعال است. `criticalPath` / `resourceAssignment` / `onTaskResize` هنوز آگاهانه خارج از این فاز مانده‌اند. | 🔴 |
| `viz.kanban` | ~~فاقد تعریف `columns`~~ ✅ رفع شد (فاز ۴۳: از `DesignerVizKanbanFieldMapping` + `columnOrder` موجود در wizard/type system واقعاً در runtime استفاده می‌شود)، ~~فاقد `onCardMove` event~~ ✅ رفع شد (فاز ۴۳ — `vizKanbanCardMovePhase43Fix.test.tsx`: رویداد bindable `onCardMove` در Preview/Export + Drag-and-Drop واقعی بین ستون‌ها). `wipLimit` per column و `swimlanes` هنوز بازند و آگاهانه خارج از دامنه‌ی این فاز مانده‌اند. | 🟠 |
| `viz.sheet` | ~~فاقد تعریف `columns` (نوع هر ستون: متن/عدد/فرمول/dropdown)، فاقد `formulas`~~ ✅ رفع شد (فاز ۴۴ — `vizSheetPhase44Fix.test.tsx`: `DesignerVizSheetFieldMapping` حالا ستون‌های typed (`text`/`number`/`select`/`formula`) را حمل می‌کند، Runtime/Export داده‌ی API را به ستون‌های ساختاریافته map می‌کنند، و فرمول‌ها با همان Expression Engine مشترک (بدون `eval` جدید) روی context همان ردیف محاسبه می‌شوند)، ~~فاقد `onCellChange` event~~ ✅ رفع شد (فاز ۴۴ — همان تست: `onCellChangeAction` واقعاً در Runtime اجرا می‌شود). `cellValidation` و copy/paste اکسل هنوز بازند و آگاهانه خارج از دامنه‌ی این فاز مانده‌اند. | 🔴 |
| `viz.timeline` | فاقد `groupByLane` (چند ردیف موازی زمانی)، فاقد `zoomLevel`، فاقد `onEventClick`. | 🟠 |

**نتیجه‌گیری این بخش:** این ۴ المنت (`gantt`, `kanban`, `sheet`, `timeline`) با تنها ۲ پراپرتی هرکدام (`data` + `htmlExtraAttrs`) **از نظر عملکردی placeholder-level هستند** — اسمشان قابلیت‌های پیشرفته را وعده می‌دهد ولی props پشت آن‌ها برای ساخت یک نسخه واقعاً کاربردی (نه فقط نمایشی) کافی نیست. اگر ادعای «هر داشبوردی» شامل مدیریت پروژه (Gantt/Kanban) است، **این ۴ المنت باید در اولویت اول بازطراحی عمقی قرار بگیرند** — حتی بالاتر از خیلی از موارد سند قبلی، چون این‌ها مستقیماً «المنت موجود ولی ناقص» هستند نه «قابلیت کاملاً غایب».

### 10.3 Tree/Cascader

| المنت | کمبود | شدت |
|-------|-------|:---:|
| `viz.tree-view` / `tree-select` / `cascader` / `tree-combobox` | فاقد `searchable` (فیلتر زنده روی درخت بزرگ)، فاقد `lazyLoad` (بارگذاری async فرزندان هنگام باز کردن یک node — برای درخت‌های بسیار بزرگ سازمانی حیاتی)، فاقد `dragToReorder`. | 🟠 |

---

## 11. Feedback & Status

| المنت | کمبود | شدت |
|-------|-------|:---:|
| `feedback.alert` / `feedback.banner` | فقط `message, variant` — فاقد `title` جدا از `message`، فاقد `dismissible`/`onDismiss`، فاقد `actions` (دکمه‌های داخل بنر، مثل «بازخوانی» در بنر خطای شبکه)، فاقد `autoDismissMs`. | 🟠 |
| `feedback.empty-state` | فاقد `illustrationIcon`/`imageSrc`، فاقد `secondaryActionLabel`. | 🟡 |
| `feedback.result` | فاقد `title` (فقط `description, status` — نتیجه یک عملیات معمولاً هم عنوان هم توضیح نیاز دارد)، فاقد `extraActions` لیست. | 🟡 |

---

## 12. Content & Media

| المنت | کمبود | شدت |
|-------|-------|:---:|
| `content.stepper` | `steps, activeStep` — این المنت باید موتور اصلی Multi-step Form باشد (شکاف بزرگ سند قبلی #6) ولی فعلاً کاملاً **تزئینی** است: فاقد `onStepChange`, فاقد `linearMode` (اجبار ترتیب)، فاقد per-step validation gate، و **هیچ اتصالی به `html.form`** ندارد. | 🔴 |
| `content.carousel` | فقط `slides` — فاقد `autoplay`, `intervalMs`, `loop`, `showIndicators`, `showArrows`, `swipeGesture`. | 🟠 |
| `content.icon` | `iconName, size` — فاقد `color` مستقل (وابسته به className)، فاقد `strokeWidth`، فاقد انیمیشن spin (برای iconهای loading). | 🟢 |
| `content.segmented-control` | **⚠️ تدقیق (نسخه ۲):** دوگانگی `items`/`options` واقعاً در کد هست (`inspectorPaletteFields.ts:1313-1317`: هم `HEROUI_OPTION_ITEMS_FIELD` هم `options` جدا) اما **این یک باگ ناخواسته نیست** — کامنت‌های کد صراحتاً به «parity audit items 79/80» ارجاع می‌دهند: `options` مسیر CSV استاتیک/legacy است و `items` مسیر LOV/API-bound جدید؛ هر دو در `DesignerRuntimeSegmentedControl` واقعاً مصرف می‌شوند (نه یکی مرده). پیشنهاد می‌شود در نقشه‌راه به‌جای «رفع باگ» با عنوان «ادغام/ساده‌سازی دو مسیر موازی» ذکر شود. فاقد per-item disable همچنان یک گپ واقعی کوچک است. | 🟡 (طراحی عمدی dual-mode، نه باگ) |
| `content.stat-trend` | خوب و ساختاریافته؛ فاقد `icon`, `format` (currency/percent/number formatting), `comparisonPeriodLabel` ("نسبت به ماه قبل"). | 🟡 |
| `content.feature-grid` / `blog-card` / `team-member` | فقط `data` — فاقد `columnsCount` (چند ستون در هر breakpoint)، فاقد `cardVariant`. Schema این `data` هم مستند نیست (بخش Cross-Cutting §1.4). | 🟡 |
| `content.split-media` | `mediaSide, mediaSrc` — فاقد `mediaType` (image/video/lottie/iframe) — یعنی اگر بخواهید ویدیو بگذارید معلوم نیست چطور رندر می‌شود. | 🟡 |
| `content.description-list` | فقط `data` — فاقد `columnsCount` (۲/۳ ستونه) و `labelWidth`. | 🟢 |
| `content.cta-banner` | فاقد `title` (فقط `description, actionLabel` — دقیقاً همان مشکل `marketing.hero-cta`)، فاقد `secondaryAction`. | 🟡 |

---

## 13. Marketing

| المنت | کمبود | شدت |
|-------|-------|:---:|
| `marketing.hero-cta` | **✅ اصلاح (نسخه ۲ — بررسی کد واقعی): ادعای «فاقد title» نادرست است.** `title` واقعاً وجود دارد — `designerUniversalPalette.ts:280-286` مقدار پیش‌فرض `title: 'Build apps visually'` دارد و `inspectorPaletteFields.ts:1319` فیلد «Title» را صریحاً تعریف کرده (همراه `subtitle, primaryCta, secondaryCta`). آنچه واقعاً غایب می‌ماند: `backgroundImage`/`backgroundVideo`، `alignment`. | 🟡 (فقط دو فیلد ثانویه، نه یک باگ) |
| `marketing.newsletter-signup` | `placeholder, buttonLabel` — فاقد `successMessage`/`errorMessage`، فاقد چک‌باکس رضایت (GDPR/قوانین حریم خصوصی — در بسیاری کشورها الزام قانونی)، و مشخص نیست به کدام `dataSource`/email service وصل می‌شود (به نظر باید از `regionDataSource` عمومی استفاده کند ولی مستند نشده این المنت خاص چطور). | 🟠 |
| `marketing.testimonial-carousel` | فقط `data` — دقیقاً منطق `content.carousel` را باید داشته باشد (autoplay/interval/loop) ولی چون المنت جدایی است این منطق کپی/جدا پیاده شده و ممکن است ناهماهنگ باشد. | 🟡 |
| `marketing.pricing-table` | فقط `data` — نیازمند مستندسازی schema (`planName, price, billingPeriod, features, isHighlighted, ctaLabel`)، فاقد `billingToggle` (ماهانه/سالانه با تبدیل خودکار قیمت — الگوی استاندارد صفحات Pricing). | 🟠 |
| `marketing.faq-accordion` | فقط `data` — فاقد `allowMultipleOpen` (چند سوال هم‌زمان باز باشند یا فقط یکی). | 🟢 |

---

## 14. جدول نهایی

خلاصه تمام موارد 🔴 بحرانی (که باید **فوری** اصلاح شوند چون یا **باگ واقعی** هستند یا مانع اصلی «ساخت هرچیزی بدون محدودیت»اند):

| # | المنت | مشکل | نوع |
|---|-------|------|-----|
| 1 | `html.heading` | فاقد فیلد `level` (h1–h6) | باگ | ✅ رفع شد (فاز ۳۴ — `propertyExposurePhase34Fix.test.tsx`) |
| 2 | `html.link` (و هرجا `target=_blank`) | فاقد auto `rel=noopener noreferrer` | امنیتی | ✅ رفع شد (فاز ۳۳ — `securityLinkIframePhase33Fix.test.tsx`) |
| 3 | `html.iframe` | فاقد `sandbox` attribute | امنیتی | ✅ رفع شد (فاز ۳۳ — `securityLinkIframePhase33Fix.test.tsx`) |
| 4 | `html.file-upload` | فقط ۳ فیلد، فاقد اتصال واقعی به storage | کمبود عمیق |
| 5 | `heroui.table` / `data-grid` / `app-table-grid` (هرسه) | ~~فاقد pin/bulk/inline~~ ✅ رفع شد (فاز ۳۵ — `gridPinBulkInlineEditPhase35Fix.test.tsx`)؛ ~~Grouping~~ ✅ رفع شد (فاز ۳۶ — `gridAggregationPhase36Fix.test.tsx`) | کمبود جزئی (expandable row / virtualization flag) |
| 6 | `heroui.tabs` | فاقد فیلد `items` برای تعریف تب‌ها | کمبود شدید/شبه‌باگ | ✅ رفع شد (فاز ۳۴ — `propertyExposurePhase34Fix.test.tsx`) |
| 7 | `heroui.breadcrumbs` | فاقد فیلد `items` | کمبود شدید/شبه‌باگ | ✅ رفع شد (فاز ۳۴ — `propertyExposurePhase34Fix.test.tsx`) |
| 8 | `heroui.slider` | فاقد range/dual-thumb با این‌که HeroUI native دارد | Exposure ناقص (کم‌هزینه، اثر بالا) | ✅ رفع شد (فاز ۳۴ — `propertyExposurePhase34Fix.test.tsx`) |
| 9 | `form.time-input` / `form.datetime-input` | فقط ۳ فیلد در برابر ۳۳ فیلد `date-picker` | ناهماهنگی شدید | ✅ رفع شد (فاز ۴۰ — `timeDateRangeEnrichmentPhase40Fix.test.tsx`) |
| 10 | `form.date-range` | فاقد Presets (امروز/۷ روز/این ماه) | کمبود برای Dashboard | ✅ رفع شد (فاز ۴۰ — `timeDateRangeEnrichmentPhase40Fix.test.tsx`) |
| 11 | `viz.chart-pie` (Gauge mode) | فاقد `min/max/thresholds` با این‌که Gauge در نام المنت وعده داده شده | باگ نام‌گذاری/پیاده‌سازی | ✅ رفع شد (فاز ۳۷ — `chartFieldMappingPhase37Fix.test.tsx`) |
| 12 | `viz.chart-*` (همه) | فاقد `onDataPointClick` در Event Matrix | مانع Drill-down | ✅ رفع شد (فاز ۳۷ — `chartFieldMappingPhase37Fix.test.tsx`) |
| 13 | `viz.gantt` | ~~فاقد dependencies/viewMode/drag-resize~~ | Placeholder-level | ✅ رفع شد (فاز ۴۲ — `vizTimelineGanttBinding.test.tsx`) |
| 14 | `viz.kanban` | ~~فاقد columns تعریف‌شده و `onCardMove`~~ | Placeholder-level | ✅ رفع شد (فاز ۴۳ — `vizKanbanCardMovePhase43Fix.test.tsx`) |
| 15 | `viz.sheet` | ~~فاقد columns/formula engine~~ | ✅ رفع شد (فاز ۴۴ — `vizSheetPhase44Fix.test.tsx`) |
| 16 | `content.stepper` | بدون اتصال واقعی به `html.form` برای Wizard | مانع Multi-step Form |
| 17 | `content.segmented-control` | ~~هم `items` هم `options` — منبع دوگانه مشکوک~~ (نسخه ۲: طراحی عمدی dual-mode، مستند در کد — پیشنهاد ادغام، نه رفع باگ) | طراحی قابل‌ساده‌سازی، نه باگ |
| 18 | ~~`marketing.hero-cta`~~ | ~~فاقد فیلد `title`~~ (نسخه ۲: **ادعا نادرست بود** — `title` از قبل وجود دارد) | ✅ نیازی به اقدام نیست |
| 19 | تمام «Tailwind UI Blocks» (بجز badge-pill) | فاقد props محتوایی، صرفاً container خالی | ✅ رفع شد (فاز ۴۱ — `tailwindUiBlocksPhase41Fix.test.tsx`) |

---

## 15. المنت‌های کاملاً غایب — باید از صفر اضافه شوند

> این بخش در پاسخ به سؤال شما اضافه شد: *«آیا با این تغییرات دیگر می‌شود هر چارت/گزارش/داده‌ای را نشان داد؟»* — جواب این بود که نه، چون این‌ها با جست‌وجوی مستقیم در کل متن هر دو فایل (۱۶۸۲۶+۱۱۰۰ خط) **صفر نتیجه** داشتند؛ یعنی در حال حاضر هیچ راهی برای ساخت‌شان با ۱۲۳ المنت موجود وجود ندارد، مگر با کد دستی خارج از Toolbox. برای هرکدام Property کامل پیشنهاد شده تا مستقیم قابل پیاده‌سازی باشد (هم‌راستا با الگوی 4-لایه‌ای سند اول: Catalog/Runtime/Codegen/Inspector).

### 15.1 گسترش دسته Data Visualization — چارت‌های آماری پیشرفته

> **✅ رفع شد — فاز ۵۲:** به‌جای ۱۰+ المنت جدا، یک المنت واحد `viz.chart` با پراپرتی `chartType` (scatter/radar/heatmap/funnel/waterfall/treemap/sankey/candlestick/boxplot) اضافه شد؛ فیلدهای اختصاصی هر نوع در Inspector شرطی‌اند. Gauge از قبل روی `viz.chart-pie` (فاز ۳۷) موجود بود. Map به بخش ۱۵.۲ منتقل شد (`viz.map-choropleth`). تست: `advancedChartsMapGeoPhase52Fix.test.tsx`.

سرچ روی ECharts/Recharts/Nivo (کتابخانه‌های مرجع React) تایید کرد این نوع چارت‌ها استاندارد صنعت‌اند؛ پیش از فاز ۵۲ فقط Bar/Line/Pie/Sparkline موجود بودند:

| المنت جدید پیشنهادی | Props کلیدی | چرا لازم است |
|----------------------|-------------|----------------|
| `viz.chart` + `chartType:'scatter'` | `data, xKey, yKey, seriesKeys, sizeKey (bubble), colorKey, showTrendline, height` | همبستگی بین دو متغیر (مثلاً قیمت vs فروش) |
| `viz.chart` + `chartType:'radar'` | `data, metrics[], seriesKeys, showLegend, height, maxValue` | مقایسه چندبعدی |
| `viz.chart` + `chartType:'heatmap'` | `data, xKey, yKey, valueKey, colorScale, height` | نمایش تراکم/شدت روی دو محور |
| `viz.chart` + `chartType:'funnel'` | `data, stageKey, valueKey, showConversionRate, height` | قیف فروش/تبدیل کاربر |
| `viz.chart` + `chartType:'waterfall'` | `data, categoryKey, valueKey, showConnectors, height` | تحلیل تغییرات تجمعی |
| `viz.chart` + `chartType:'treemap'` | `data (hierarchical), valueKey, colorKey, height` | سهم/وزن نسبی سلسله‌مراتبی |
| `viz.chart` + `chartType:'sankey'` | `data (nodes+links), height` | نمایش جریان/گردش |
| `viz.chart` + `chartType:'candlestick'` | `data (OHLC), height, showVolume` | گزارش‌های مالی/سهام |
| `viz.chart` + `chartType:'boxplot'` | `data, groupKey, valueKey, height` | تحلیل آماری توزیع/پرت‌ها |
| `viz.chart-pie` + `chartVariant:'gauge'` | `value, min, max, thresholds[]` | ✅ از فاز ۳۷ |
| `viz.map-choropleth` | `data (region+value), colorScale, geoJsonSource` | ✅ فاز ۵۲ — بخش ۱۵.۲ |

**راه‌حل معماری (اجرا شد):** یک المنت واحد `viz.chart` با `chartType` برای انواع پیشرفته؛ چهار چارت کلاسیک (`viz.chart-bar/line/pie/sparkline`) به‌عنوان aliasهای تخصصی دست‌نخورده ماندند؛ فیلدهای اختصاصی هر نوع به‌صورت conditional در Inspector.

### 15.2 Map / Geo Visualization

> **✅ رفع شد — فاز ۵۲:** `viz.map-pin` و `viz.map-choropleth` با پیش‌فرض OpenStreetMap/Leaflet و provider اختیاری Mapbox/Google اضافه شدند. تست: `advancedChartsMapGeoPhase52Fix.test.tsx`.

| المنت جدید | Props پیشنهادی | نکته پیاده‌سازی |
|------------|------------------|-------------------|
| `viz.map-pin` | `data (lat,lng,label)[], defaultCenter, defaultZoom, clusterMarkers, tileProvider` | نقشه با پین‌های نقطه‌ای (فروشگاه‌ها، مشتریان، ناوگان) |
| `viz.map-choropleth` | `data (regionCode,value)[], regionLevel: 'country'|'province'|'city', colorScale, geoJsonSource` | نقشه رنگی بر اساس مقدار (مثل نمونه ECharts Map series) |

**نکته فنی:** پیش‌فرض روی **OpenStreetMap/Leaflet** (رایگان، open-source) است و Mapbox/Google به‌عنوان provider اختیاری در Inspector اضافه شده‌اند.

### 15.3 دسته Content & Media — Media Player واقعی

> **✅ رفع شد — فاز ۵۳:** `content.video-player` و `content.audio-player` با کنترل‌های واقعی HTML5 اضافه شدند؛ `content.split-media` پراپرتی `mediaType: 'image'|'video'|'audio'|'lottie'` گرفت (پیش‌فرض `image` — رفتار قبلی حفظ می‌شود). تست: `mediaQrPlatformChromePhase53Fix.test.tsx`.

| المنت جدید | Props پیشنهادی |
|------------|------------------|
| `content.video-player` | `src, poster, autoplay, loop, muted, controls, showCaptions (vtt track), aspectRatio` |
| `content.audio-player` | `src, autoplay, loop, showWaveform, playbackSpeedControl` |

`content.split-media` فعلی (که فقط `mediaSrc` خام دارد) باید یا به این‌ها ارجاع دهد یا `mediaType: 'image'|'video'|'audio'|'lottie'` بگیرد و بسته به نوع، پلیر مناسب را رندر کند (طبق بخش ۱۲ همین سند).

### 15.4 دسته Content & Media — QR/Barcode

> **✅ رفع شد — فاز ۵۳:** `content.qr-code` (qrcode.react) و `content.barcode` (JsBarcode — CODE128/EAN13/UPC) با value bindable اضافه شدند. تست: `mediaQrPlatformChromePhase53Fix.test.tsx`.

| المنت جدید | Props پیشنهادی |
|------------|------------------|
| `content.qr-code` | `value (bindable — می‌تواند به یک فیلد داده وصل شود)، size, errorCorrectionLevel, logoOverlay, downloadable` |
| `content.barcode` | `value, format: 'CODE128'|'EAN13'|'UPC', showValue, size` |

### 15.5 دسته HeroUI Navigation and Overlays — ابزارهای سطح پلتفرم

> **✅ رفع شد — فاز ۵۳:** `platform-navigation.command-palette` / `notification-bell` / `user-menu` از کاتالوگ دینامیک `PLATFORM_CHROME_COMPONENT_CATALOG` تغذیه می‌شوند؛ `heroui.chat-widget` به‌صورت stub (نیازمند فاز ۵۵ برای live push) اضافه شد. تست: `mediaQrPlatformChromePhase53Fix.test.tsx`.

این‌ها به شکاف‌های #32/#33 سند اول (Real-time، Session Context) وابسته‌اند و بهتر است مثل `platform-slots`/`platform-navigation` موجود شما، از Dynamic Platform Palette تغذیه شوند نه Local Catalog ثابت:

| المنت جدید | Props پیشنهادی | وابستگی |
|------------|------------------|----------|
| `platform-navigation.command-palette` | `hotkey (پیش‌فرض Cmd/Ctrl+K), searchScopes: ['pages','records','actions'], recentItemsCount` | مستقل |
| `platform-navigation.notification-bell` | `unreadCountSource (binding), maxItemsShown, markAllReadAction` | نیازمند #32 (Real-time) سند اول |
| `platform-navigation.user-menu` | `avatarSource: session.avatarUrl, displayNameSource: session.displayName, menuItems[] (Profile/Settings/Logout)` | نیازمند #33 (Session Context) سند اول |
| `heroui.chat-widget` | `channelRef, messagesDataSource, onSendMessage (Dynamic Action), showTypingIndicator` | نیازمند #32 (Real-time) سند اول |

### 15.6 دسته Logic — تکمیل منطق شرطی

| المنت جدید | Props پیشنهادی |
|------------|------------------|
| `logic.switch-case` | `switchValue (expression/variable)، cases: {matchValue, childRef}[], defaultChildRef` — رندر شرطی چندحالته واقعی (نه فقط دوحالته visible/hidden) |
| `logic.error-boundary` | `fallbackContent, onError (Dynamic Action برای لاگ خطا)` — جلوگیری از کرش کل صفحه به خاطر خطای رندر یک زیردرخت |

---

## جمع‌بندی

بین این سند و سند سطح پلتفرم قبلی، **سه لایه شکاف** شناسایی شد:

1. **باگ‌های واقعی/امنیتی** (بخش ۱۴، ردیف‌های ۱–۳، ۱۱، ۱۷، ۱۸) — این‌ها باید **فوری و مستقل از هر برنامه‌ریزی بزرگ‌تر** اصلاح شوند؛ هزینه پایین، ریسک بالا اگر نادیده گرفته شوند (خصوصاً امنیت `iframe`/`link`).
2. **Property Exposure ناقص** (مثل Slider، Progress circular، Avatar Group) — قابلیت در HeroUI هست، فقط باید در Catalog+Inspector شما expose شود. این‌ها **کم‌هزینه‌ترین و سریع‌ترین** راه برای «حس کامل‌تر شدن» فیچر هستند.
3. **المنت‌های Placeholder-level** (Gantt, Kanban, Sheet, Tailwind Blocks خالی، Tabs/Breadcrumbs بدون items) — این‌ها نیازمند **کار طراحی/توسعه واقعی** هستند، نه فقط expose کردن یک prop موجود؛ اولویت این‌ها باید بعد از رفع بخش ۱ و ۲ باشد.

**لایه چهارم** (اضافه‌شده در بازبینی دوم، بخش ۱۵): المنت‌هایی که **اصلاً وجود ندارند** — Map، ۱۰+ نوع چارت آماری پیشرفته (Scatter/Radar/Heatmap/Funnel/Waterfall/Treemap/Sankey/Candlestick/Boxplot)، Media Player واقعی، QR/Barcode، Command Palette، Notification Bell، User Menu، Chat Widget. این‌ها با جست‌وجوی مستقیم در کل متن هر دو فایل تایید شدند که صفر وجود دارند و باید از صفر ساخته شوند — این‌ها بیشترین اثر مستقیم را روی جواب سؤال «آیا می‌شود هر چارت/گزارش/داده‌ای را نشان داد؟» دارند.

**لایه پنجم** (اضافه‌شده در بازبینی سوم — دقت Data Binding): مشکلات معماری در خود سیستم Binding چارت/گرید/Viz — Wizard چارت‌ها و Viz به‌صورت type-agnostic و یکسان مستند شده (بدون تمایز Gantt از Kanban از Sheet)، تناقض علامت‌گذاری Bindable روی `page`/`total` گرید، و **نبود کامل Aggregation/GroupBy/Pivot/Subtotal** در کل سیستم — که برای ساخت هر گزارش مدیریتی واقعی (نه فقط لیست خام) حیاتی است. جزئیات کامل + schema دقیق TypeScript پیشنهادی برای هرکدام در سند اول، **بخش ۱۹** آمده است.

با اصلاح این ۱۹ مورد بحرانی + تکمیل کمبودهای 🟠/🟡 هر بخش + افزودن المنت‌های کاملاً غایب بخش ۱۵ + رفع مشکلات دقت Binding بخش ۱۹ سند اول (طبق جداول بالا)، همراه با شکاف‌های سطح پلتفرم سند قبلی (Variables، Expression Engine، Responsive per-breakpoint، Data Connectivity، Real-time، Session Context — **بدون Workflow، که خارج از محدوده این دو سند است**)، فیچر Client Components واقعاً به نقطه‌ای می‌رسد که هیچ نوع صفحه، فرم، داشبورد، گزارش یا اپلیکیشنی بیرون از توانش نمی‌ماند — و مهم‌تر برای درخواست اخیر شما: تنظیمات هر چارت/جدول/گزارش با **دقت کامل و بدون ابهام** از Inspector قابل‌اعمال خواهد بود.

---

## نسخه ۲ — نتیجه‌ی بازبینی با کد واقعی + ارجاع به تحلیل صفحه Users

یک بازبینی مستقل (بررسی مستقیم کاتالوگ/اینسپکتور/رانتایم فعلی، نه اسناد مرجع) تک‌تک ۱۹ ردیف جدول §۱۴ + ادعاهای cross-cutting §۱ + غیاب کامل بخش §۱۵ را راستی‌آزمایی کرد. نتیجه:

- **۱۶ مورد از ۱۹ ردیف §۱۴ بدون تغییر تأیید شدند** — واقعاً هنوز باگ/کمبود هستند، دقیقاً همان‌طور که این سند مستند کرده بود.
- **۱ مورد نادرست بود** (#۱۸ `marketing.hero-cta` — `title` واقعاً وجود دارد؛ اصلاح شد در بخش ۱۳ و جدول ۱۴).
- **۱ مورد نیازمند تلطیف لحن بود** (#۱۷ `content.segmented-control` — دوگانگی واقعی است ولی طراحی عمدی مستند در کد است، نه باگ رفع‌نشده؛ اصلاح شد در بخش ۱ و ۴ و جدول ۱۴).
- **ردیف #۵ (گرید‌ها):** Resize/Reorder از قبل؛ ✅ Pin/Bulk/Inline رفع شد (فاز ۳۵)؛ ✅ Grouping/Aggregation/Pivot رفع شد (فاز ۳۶).
- تمام ۱۰ گروه کاملاً غایب بخش ۱۵ (Map، ویدیو/صدای واقعی، QR/Barcode، Command Palette، Notification/User-menu/Chat، ۹ نوع چارت پیشرفته) **کاملاً تأیید شدند** — صفر وجود در کل کاتالوگ فعلی.
- `debounceMs` (بخش ۱.۱): نیمه‌درست — زیرساخت/تایپ/Codegen موجود است، فقط فیلد UI کاربر در Inspector نیست (اصلاح شد).

**ارتباط با تحلیل صفحه Users:** بخش ۲۰ سند `client-components-gap-analysis-fa.md` یک تحلیل عمیق و خط‌به‌خط صفحه‌ی واقعی `src/features/users/` را با قابلیت‌های فعلی Designer تطبیق داد و ۱۳ نیاز مشخص (U1-U13) استخراج کرد که مستقیماً به چند ردیف همین سند مرتبط‌اند — به‌خصوص: Rich Cell جدید «icon-from-lookup» (مرتبط با نبود چنین کایندی در هیچ‌جای این سند)، دقت رندر «chips» (فراتر از آنچه این سند مستند کرده بود)، و نیاز به فیلتر عمومی چندگزینه‌ای در نوار ابزار گرید (این سند فقط به نبود کلی aggregation/grouping اشاره کرده بود، نه نبود فیلتر عمومی toolbar). فازهای اجرای دقیق همه‌ی این‌ها (هم موارد این سند، هم موارد Users-parity) در `21-DESIGNER-BUGFIX-EXECUTION-PHASES.md` (فاز ۲۴ به بعد) نوشته شده‌اند.

---

*این سند از پارس خودکار (Python/regex) کل فایل ۱۶۸۲۶ خطی `client-components-toolbox-elements-fa.md` برای استخراج دقیق props و **همه بخش‌های Wizard/Binding** هر ۱۲۱–۱۲۳ المنت + مقایسه با مستندات رسمی HeroUI v3 (2026) و ECharts/Recharts/Nivo تهیه شده است. نسخه ۳ — تکمیل‌شده با بخش ۱۵ (المنت‌های کاملاً غایب) و بررسی دقت Data Binding چارت/گرید/Viz (ارجاع به بخش ۱۹ سند اول).*
