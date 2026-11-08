# نقشه‌ی اجرای رفع باگ‌های دور دوم — فازبندی مستقل برای اجرا توسط Agent

## نحوه‌ی استفاده از این سند

این سند، اجرای رفع **۷۳ باگ/یافته‌ی تأییدشده‌ی دور دوم ممیزی** (مستندشده در `docs/refactor-spec/20-DESIGNER-ELEMENT-PARITY-AUDIT.md`, بخش ۱۰) را به **۱۳ فاز مستقل** تقسیم می‌کند. هر فاز طوری طراحی شده که:

- یک واحد کاری منسجم و **قابل‌اجرا در یک چت کاملاً جدید** باشد — بدون نیاز به حافظه یا context از این گفتگو یا از فازهای دیگر.
- فایل‌هایی که لمس می‌کند تا حد امکان از فازهای دیگر جدا باشد (همپوشانی‌های اجتناب‌ناپذیر صریحاً زیر عنوان «⚠️ همپوشانی فایل» در همان فاز اعلام شده‌اند).
- شامل مکانیزم خود-تأیید (self-verification) کامل باشد که تضمین کند هیچ‌چیز فراموش، خراب، یا نیمه‌کاره نمانده.

**دستورالعمل برای شروع هر فاز:** کل همین فایل را به Agent بدهید و دقیقاً بگویید «فاز شماره‌ی N را از این فایل اجرا کن». Agent باید **بخش «۰. زمینه‌ی معماری مشترک» و «۱. متدولوژی و پروتکل تأیید مشترک» را همیشه کامل بخواند**، سپس فقط بخش فاز درخواستی را اجرا کند. ترتیب فازها اهمیت دارد فقط در جایی که صریحاً «وابستگی» اعلام شده (فاز ۱۳ همیشه آخرین فاز است).

**قانون طلایی برای Agent مجری هر فاز:** هیچ ادعای این سند (حتی شماره‌ی خط‌ها) را کورکورانه نپذیر. کد فعلی مخزن، تنها منبع حقیقت است — چون بین نوشتن این سند و اجرای واقعی فاز، ممکن است کد تغییر کرده باشد. قبل از هر تغییر، وضعیت فعلی را با `grep`/`Read` مستقیماً تأیید کن. اگر چیزی که این سند توصیف می‌کند در کد فعلی پیدا نشد یا فرق داشت، **متوقف نشو** — کد واقعی را بخوان، مشکل واقعی مشابه را پیدا کن، و بر اساس *مکانیزم* توصیف‌شده (نه صرفاً شماره‌خط) رفع کن. اگر واقعاً چیزی که توصیف شده دیگر در کد وجود ندارد (قبلاً رفع شده)، آن را در گزارش پایانی فاز به‌عنوان «قبلاً رفع بوده، نیازی به تغییر نبود» ثبت کن و رد شو — دلیل مختصر بیاور.

---

## ۰. زمینه‌ی معماری مشترک (پیش‌نیاز خواندن برای همه‌ی فازها)

پروژه یک ابزار طراحی بصری کشیدن‌و‌رهاکردن (drag-and-drop) به نام «Component Designer» است، در Vite+React+TypeScript، در مسیر `d:\Project\AppEndO`.

هر «المنت» (عنصر) این ابزار — یعنی هر آیتمی که کاربر می‌تواند از پالت به بوم بکشد (دکمه، ورودی متن، جدول، نمودار، و...) — از **سه مسیر رندر کاملاً مستقل** عبور می‌کند که باید رفتار یکسانی برای هر فیلد قابل‌تنظیم در Inspector داشته باشند:

1. **بوم طراحی زنده (Design Canvas)** — جایی که کاربر واقعاً عناصر را می‌کشد و تنظیم می‌کند. کد اصلی: `src/features/component-designer/canvas/canvasNodes.tsx`.
2. **Preview تعاملی/زنده (منتشرشده)** — چیزی که کاربر نهایی برنامه در صفحه‌ی زنده می‌بیند وقتی از داخل خود Designer اجرا می‌شود (نه export شده). کد اصلی: `src/domain/component-designer/designerRuntimePreview.tsx` (تابع `renderDesignerDocumentPreview`) + فایل‌های `DesignerRuntime*.tsx`/`runtime*.tsx` در همان پوشه.
3. **Export/کد منتشرشده (`.tsx`)** — یک فایل `.tsx` واقعی و مستقل که از سند طراحی تولید می‌شود (قابلیت «Export Component» در محصول). کد اصلی: `src/domain/component-designer/codegen.ts` (نقطه‌ی ورود `generateDesignerTsx`) که به `tsxNodeRenderer.ts`, `tsxPropMapper.ts`, `bindingCodegen.ts`, و فایل‌های `tsx*Palette.ts` (هرکدام برای یک خوشه از عناصر) هدایت می‌کند.

بیشتر باگ‌های این پروژه از این جنس‌اند: یک فیلد Inspector در یک مسیر درست کار می‌کند ولی در مسیر(های) دیگر نادیده گرفته می‌شود («فیلد مرده»)، یا یک مقدار هم به‌صورت Binding واقعی و هم به‌صورت لیترال استاتیک تکراری صادر می‌شود («attribute تکراری/نشتی»)، یا یک prop اصلاً روی کامپوننت واقعی زیرین (`@heroui/react`) وجود ندارد.

**فایل‌های کلیدی که در چند فاز تکرار می‌شوند (برای آشنایی اولیه):**
- `src/domain/component-designer/inspectorPaletteFields.ts` — تعریف فیلدهای Inspector هر عنصر.
- `src/domain/component-designer/propRegistry.ts` — نگاشت نام فیلد Designer به نام prop واقعی کتابخانه (وقتی فرق دارند) + کدام فیلدها اصلاً Bindable هستند.
- `src/domain/component-designer/runtimeRenderer.tsx` — رندرر اصلی مشترک بین Canvas (design mode) و Preview (runtime mode) برای اکثر عناصر HeroUI (تمایز با `options.mode`).
- `src/domain/component-designer/bindingCodegen.ts` — قلب Codegen؛ می‌سازد `TsxBindingRenderContext`، حل می‌کند Bindingها به عبارت‌های TSX واقعی.
- `src/domain/component-designer/tsxPropMapper.ts` — رندر عمومی attributeهای JSX (شامل `renderNodeJsxAttributes`/`buildNodeJsxAttributesWithBindings`).
- `node_modules/@heroui/react/dist/components/<name>/*.d.ts` و `node_modules/@heroui/styles/dist/components/<name>/*.styles.js` — تعریف واقعی prop/variant کامپوننت‌های کتابخانه (مرجع نهایی برای «آیا این prop واقعاً وجود دارد؟»).

**قرارداد نام‌گذاری تست‌های این پروژه:** فایل تست جدید در `src/domain/component-designer/__tests__/`، با نام‌گذاری `<موضوع><ItemXX>Fix.test.ts(x)` (مثلاً `gridPaginationServerModeFix.test.ts`)، با یک کامنت JSDoc در بالای فایل به سبک زیر (این سبک را دقیقاً از تست‌های موجود کپی کن، مثلاً `chartToolbarCodegen.test.ts` یا `deadFieldsRemovalItems19to26.test.tsx` را باز کن و الگو را ببین):

```ts
/**
 * Bug found (parity audit item NN): <توضیح دقیق مکانیزم باگ>.
 * Fixed in <فایل(ها)>: <خلاصه‌ی رفع>.
 */
```

---

## ۱. متدولوژی و پروتکل تأیید مشترک (برای همه‌ی فازها، بدون استثنا)

### ۱.۱ درس حیاتی از دور قبل (این را حتماً رعایت کن)

در دور قبل، حداقل یک باگ بسیار حیاتی (مورد ۲۸) کاملاً از دید تست‌های موجود پنهان ماند چون آن تست‌ها فقط **متن رشته‌ای** کد تولیدشده را با `toContain`/`toMatch` چک می‌کردند، نه رفتار واقعی زمان اجرا. برای همه‌ی تست‌های جدیدی که در این فازها می‌نویسی:

- برای باگ‌های Codegen/Export: کافی نیست فقط چک کنی که رشته‌ی تولیدشده «شکل درستی» دارد. در حد امکان، تابع runtime واقعی (کمکی‌هایی که در باندل export امبد می‌شوند، مثل توابع در `bindingApiCodegen.ts`/`bindingCodegen.ts`) را مستقیماً import/اجرا کن و خروجی واقعی (رشته‌ی URL نهایی، مقدار state، و...) را assert کن. اگر تابع کمکی به‌صورت رشته‌ی متنی امبد می‌شود (نه export مستقیم TS)، از الگوی موجود در `vizGanttProgressFieldExportFix.test.ts` استفاده کن (`esbuild.transformSync` برای strip-type کردن و اجرای واقعی رشته‌ی امبدشده).
- برای باگ‌های Preview/Canvas: از `@testing-library/react`'s `render`/`fireEvent` برای شبیه‌سازی تعامل واقعی کاربر (تایپ، کلیک، blur) استفاده کن و DOM/callback واقعی را assert کن — نه فقط این‌که پراپ درست پاس داده شده.

### ۱.۲ پروتکل اجباری برای هر فاز (دقیقاً به همین ترتیب)

**قدم ۱ — Baseline اولیه (پیش از هر تغییری):**
```
npx tsc --noEmit -p .
```
اگر `tsc` معمولی روی این مخزن با `Maximum call stack size exceeded`/OOM کرش کرد (این مخزن به‌قدری بزرگ است که پیش می‌آید)، از این معادل استفاده کن:
```
node --max-old-space-size=8192 --stack-size=8000 ./node_modules/typescript/lib/tsc.js --noEmit -p .
```
**نکته‌ی مهم (از بازبینی مستقل دور دوم):** این مخزن الان (بازبینی ۲۶ جولای ۲۰۲۶) **~۱۵۲۸ خطای preexisting و کاملاً نامرتبط** با کار Component Designer دارد (در `scripts/`, `src/server/services/appendoo/**`, `src/core/ai/**`, و چند فایل دیگر از یک زیرسیستم موازی). این باعث نمی‌شود قدم ۱ رد شود — **فقط خطاهای مربوط به فایل‌هایی که همین فاز قرار است لمس کند را باید صفر نگه داری**؛ قبل از شروع، با `grep` روی خروجی `tsc` تأیید کن فایل‌های این فاز الان تمیزند، و بعد از فیکس هم دوباره همین فایل‌ها را چک کن (نه کل خروجی را) — مقایسه‌ی «صفر خطای جدید **در فایل‌های این فاز**» است، نه «صفر خطای مطلق در کل مخزن».

سپس کل سوییت تست دامنه را یک‌بار اجرا کن و نتیجه را ذخیره کن (این baseline توست، نه فایل قدیمی این نشست که دیگر وجود ندارد):
```
npx vitest run src/domain/component-designer --pool=forks --no-file-parallelism
```
(این دستور معمولاً ۵ تا ۸ دقیقه طول می‌کشد؛ `--pool=forks --no-file-parallelism` را حتماً نگه دار — اجرای موازی پیش‌فرض در این پروژه گاهی با خطای `FATAL ERROR: Zone Allocation failed - process out of memory` کرش می‌کند؛ این محیطی است نه ناشی از کد، اگر رخ داد فقط دوباره با همین دستور sequential اجرا کن.)

خروجی این اجرا معمولاً شامل چند تست ناموفقِ **از پیش موجود و نامرتبط** با کار تو خواهد بود (مشکلات محیطی preexisting، نه چیزی که این فاز خراب کرده). فهرست دقیق تست‌های ناموفق (نام کامل `فایل > describe > it`) را در یک فایل موقت در پوشه‌ی scratchpad خودت ذخیره کن — این baseline توست.

**قدم ۲ — پیاده‌سازی فیکس‌های این فاز.**

**قدم ۳ — بعد از هر آیتم مجزا (نه فقط در آخر فاز)، تایپ‌چک کن:**
```
npx tsc --noEmit -p .
```
باید صفر خطا بماند.

**قدم ۴ — تست رگرسیون جدید بنویس و اجرا کن** (طبق ۱.۱ بالا) + تست‌های موجود مرتبط با همان عنصر/فایل را هم اجرا کن تا مطمئن شوی رگرسیون فوری ایجاد نکرده‌ای.

**قدم ۵ — بعد از اتمام کل فاز، دوباره کل سوییت را اجرا کن:**
```
npx vitest run src/domain/component-designer --pool=forks --no-file-parallelism
```
فهرست تست‌های ناموفق را با baseline قدم ۱ مقایسه کن:
- هر تست ناموفقِ **جدید** که در baseline نبود = رگرسیون واقعی. **باید رفع شود** قبل از این‌که فاز را تمام‌شده اعلام کنی.
- تست‌هایی که در baseline ناموفق بودند و حالا موفق‌اند: طبیعی است *فقط* اگر دقیقاً یکی از تست‌های همین فاز باشند (چیزی که خودت الان درست کردی). اگر یک تست کاملاً بی‌ربط به‌طور تصادفی سبز شد، این مشکوک است — بررسی کن چرا (احتمالاً یک باگ دیگر را هم به‌طور جانبی رفع کرده‌ای؛ اگر واقعاً همین‌طور است، در گزارش پایانی ذکرش کن).
- تست‌هایی که در baseline ناموفق بودند و هنوز ناموفق‌اند و به کار این فاز ربطی ندارند: قابل‌قبول، دست نزن.

**قدم ۶ — Self-Audit پایانی فاز (اجباری، طبق درخواست صریح کارفرما):**
برای **هر آیتمی** که در این فاز رفع کردی:
1. فایل(های) تغییریافته را از نو، کامل، بخوان (نه فقط diff) — مطمئن شو منطق نهایی منسجم است و parity بین سه مسیر واقعاً برقرار است (نه فقط این‌که تست سبز شد).
2. برای هر سه مسیر رندر (Canvas/Preview/Export) که آن آیتم به آن‌ها مربوط بود، دوباره صریحاً تأیید کن که رفتار درست و یکسان است — با ارجاع دقیق به کد، نه حدس.
3. چک کن هیچ فایل احتمالی (probe test موقت، فایل دیباگ) از قلم نیفتاده و پاک نشده باشد: `git status`.
4. چک کن `git diff` فقط فایل‌هایی را نشان می‌دهد که واقعاً باید تغییر می‌کردند (بدون تغییر ناخواسته در فایل‌های دیگر).
5. برای المنت‌های **خواهر** که در همین فاز رفع نشدند ولی از همان کامپوننت/تابع مشترک استفاده می‌کنند، سریع بررسی کن که فیکس تو به‌طور ناخواسته رفتارشان را خراب نکرده باشد (مثلاً اگر یک `excludeKeys` عمومی را عوض کردی، چک کن المنت‌های دیگری که از همان لیست استفاده می‌کنند هنوز درست کار می‌کنند).

**قدم ۷ — به‌روزرسانی سند مرجع درست (بسته به شماره‌ی فاز):**
- **فازهای ۱ تا ۱۳:** در `docs/refactor-spec/20-DESIGNER-ELEMENT-PARITY-AUDIT.md`، بخش ۱۰، برای هر آیتمی که رفع کردی، دقیقاً به سبک آیتم‌های ۰-۲۷ (بخش‌های قبلی همان سند) یک خط «**رفع:**» با توضیح فنی دقیق و نام فایل تست رگرسیون اضافه کن، و در جدول خلاصه‌ی ابتدای بخش مربوطه، عبارت «(رفع شد ✅)» را به‌سطر آن مورد اضافه کن.
- **فازهای ۱۴ تا ۲۳:** در همان سند ممیزی، بخش‌های ۱۲ تا ۱۹ (که مستقیماً به این فازها اختصاص دارند)، به همان سبک بالا.
- **فازهای ۲۴ تا ۵۷ («بخش سوم» همین سند):** این‌ها به دو سند دیگر ارجاع می‌دهند (`docs/refactor-spec/client-components-gap-analysis-fa.md` و `client-components-per-element-gap-analysis-fa.md`) — هر فاز در خط «**می‌پوشاند:**» خودش دقیقاً می‌گوید کدام شماره‌گپ (#n)، کدام بخش (§n.n)، یا کدام کد Un را می‌پوشاند. در همان سند/بخش مرجع‌شده، ردیف/آیتم مربوطه را با «✅ رفع شد» + ارجاع به این فاز و نام فایل تست رگرسیون علامت بزن (دقیقاً همان الگویی که در فاز ۲۳ برای آیتم‌های ۱۱۴/۱۱۵ انجام شد). **همچنین** جدول «فهرست فازها» در ابتدای همین فایل را برای ردیف فاز اجراشده از «⏳ نوشته شد» به «✅ انجام شد» به‌روزرسانی کن.

**قدم ۸ — گزارش پایانی فاز به کاربر (فارسی):**
- فهرست آیتم‌هایی که رفع شدند + فایل‌های تست رگرسیون.
- هرچیزی که طبق «قانون طلایی» بالا قبلاً رفع بوده و نیازی به تغییر نداشت.
- نتیجه‌ی نهایی تایپ‌چک و رگرسیون کامل (باید: صفر خطای تایپ، صفر رگرسیون جدید).
- هر یافته‌ی جانبی/غیرمنتظره‌ای که حین کار کشف شد.

---

## فهرست فازها (خلاصه، برای مرور سریع)

| فاز | عنوان | اولویت | تعداد آیتم |
|---|---|---|---|
| ۱ | ریشه‌ی Codegen — Query String در URL صادرشده | 🔴 بحرانی | ۱ | ✅ انجام شد |
| ۲ | خانواده‌ی ورودی متنی خام در Export (input-text/number-input/textarea) | 🔴 بحرانی | ۱ | ✅ انجام شد |
| ۳ | App Table Grid — زنجیره‌ی کامل داده/کوئری/اکشن/صفحه‌بندی | 🔴 بحرانی+بالا | ۱۱ | ✅ انجام شد |
| ۴ | خانواده‌ی Select/Autocomplete/Entity-Picker/Tags-Input | 🔴 بحرانی | ۱۱ | ✅ انجام شد |
| ۵ | زیرساخت Dynamic Actions و زنجیره‌ی موفقیت فرم | 🔴 بحرانی | ۶ | ✅ انجام شد |
| ۶ | خانواده‌ی فیلدهای فرم مشترک (html-editor/code-editor/mask-input/calculator/color-control/textarea/field-container) | 🔴 بحرانی | ۱۰ | ✅ انجام شد |
| ۷ | HTML Primitives + Layout + Logic | 🟡 متوسط-بالا | ۴ | ✅ انجام شد |
| ۸ | HeroUI General + Navigation/Overlays | 🟡 متوسط-بالا | ۸ | ✅ انجام شد |
| ۹ | Universal Widgets | 🟡 متوسط | ۶ | ✅ انجام شد |
| ۱۰ | Data Viz/Charts — باقیمانده + تأیید مجدد مورد ۰ب | 🟡 متوسط | ۲ | ✅ انجام شد |
| ۱۱ | دسته‌های پویا — Shell Chrome در تب Preview اصلی | 🟠 بالا | ۲ | ✅ انجام شد |
| ۱۲ | خانواده‌ی Checkbox/Radio/Switch/Slider/Date-Picker/Date-Range | 🟡 متوسط | ۹ | ✅ انجام شد |
| ۱۳ | **تأیید نهایی سراسری و صدور گواهی آمادگی Production** | — | (آخرین فاز، بعد از همه) | ✅ انجام شد |
| ۱۴ | Hydration زنده در بوم طراحی برای ۱۶ ویجت Dual-Mode (مورد ۱۰۰) | 🟢 قابلیت جدید | ۱ | ✅ انجام شد |
| ۱۵ | اکشن `navigate` در Dynamic Actions (مورد ۱۰۱) | 🟢 قابلیت جدید | ۱ | ✅ انجام شد |
| ۱۶ | اتصال واقعی `shell.error-page`/`shell.not-found` به مکانیزم ۴۰۴ (مورد ۱۰۲) | 🟢 قابلیت جدید | ۱ | ✅ انجام شد (فقط not-found؛ error-page deferred) |
| ۱۷ | Auto Form Builder — رفع باگ‌های بحرانی (ناسازگاری UI/رفتار Reset/Close، دسترس‌ناپذیری مسیر ادغام، فرم Edit تنها) | 🔴 بحرانی | ۴ | ✅ انجام شد |
| ۱۸ | Auto Form Builder — گسترش پوشش فیلد + استخراج Validation از OpenAPI | 🟡 متوسط-بالا | ۲ | ✅ انجام شد |
| ۱۹ | **قابلیت جدید بزرگ: Auto Table/Grid Builder** (ویزارد ساخت خودکار گرید از API، از صفر) | 🟢 قابلیت جدید بزرگ | ۱ | ✅ انجام شد |
| ۲۰ | **قابلیت جدید بزرگ: Auto CRUD Page Builder** (List+Create+Edit+Delete در یک ویزارد) | 🟢 قابلیت جدید بزرگ | ۱ | ✅ انجام شد |
| ۲۱ | Built-in Components — حذف موکاپ‌های تکراری صفحات ادمین + تصمیم درباره‌ی مکانیزم drag-insert مرده | 🟠 بالا | ۲ | ✅ انجام شد |
| ۲۲ | Built-in Components — ارتقای موکاپ‌های سطح-۳ به ویجت واقعی + افزودن Built-inهای جدید مهم | 🟡 متوسط | ۲ | ✅ انجام شد |
| ۲۳ | رفع باگ گزارش‌شده‌ی کاربر: آدرس/endpoint نادرست در ویزاردهای Form/Table/CRUD from API | 🔴 بحرانی | ۲ | ✅ انجام شد |
| — | **# بخش سوم — پاریتی صفحه Users + گپ‌های تأییدشده‌ی اسناد Gap Analysis (نسخه ۴)** | | | |
| ۲۴ | Custom Named REST Operations + تعمیم `callMutation` | 🔴 بحرانی (بزرگ‌ترین مانع پاریتی Users) | ۱ | ✅ انجام شد |
| ۲۵ | Session/Current-User Binding + پریست عمومی «ردیف کاربر جاری» | 🔴 بحرانی | ۲ | ✅ انجام شد |
| ۲۶ | فیلترهای عمومی نوار ابزار گرید (چک‌باکس/رادیو روی هر فیلد + AND/OR) | 🟠 بالا | ۱ | ✅ انجام شد |
| ۲۷ | Rich Cell جدید icon-from-lookup + ارتقای دقت رندر chips | 🟠 بالا | ۲ | ✅ انجام شد |
| ۲۸ | عنصر Roles-Assignment (چک‌باکس‌گروه چندانتخابی داینامیک) | 🟠 بالا | ۱ | ✅ انجام شد |
| ۲۹ | Auto CRUD Page Builder — اسلات‌های مودال دلخواه (N به‌جای ۳ ثابت) | 🔴 بحرانی | ۱ | ✅ انجام شد |
| ۳۰ | مکانیزم واقعی Multi-step Wizard Form (+ اتصال content.stepper) | 🟠 بالا | ۲ | ✅ انجام شد |
| ۳۱ | موتور Cross-Field Validation | 🟠 بالا | ۱ | ✅ انجام شد |
| ۳۲ | تصمیم‌های محصولی پاریتی Users: Login-As (✅ بسته — گزینه الف) + فرم اتریبیوت/Function-Access (✅ بسته، خارج از محدوده) | — | ۰ باز از ۳ | ✅ انجام شد |
| ۳۳ | رفع امنیتی: `html.link` rel=noopener + `html.iframe` sandbox | 🔴 بحرانی (امنیتی) | ۲ | ✅ انجام شد |
| ۳۴ | Property Exposure سریع: heading level، tabs/breadcrumbs items، slider range، button/chip/dropdown icon | 🟠 بالا | ۵ | ✅ انجام شد |
| ۳۵ | گسترش گرید: Pin ستون، Bulk Actions Toolbar، Inline Cell Edit | 🔴 بحرانی | ۳ | ✅ انجام شد |
| ۳۶ | Aggregation/GroupBy/Pivot/Subtotal گرید | 🔴 بحرانی (برای «هر گزارشی») | ۱ | ✅ انجام شد |
| ۳۷ | Field Mapping اختصاصی نوع چارت + Gauge واقعی + onDataPointClick | 🟠 بالا | ۱ | ✅ انجام شد |
| ۳۸ | Combo Chart — چند Data Source روی یک چارت | 🟡 متوسط | ۱ | ✅ انجام شد |
| ۳۹ | Global Filter Bar + Cross-filtering + Period Comparison چارت | 🟠 بالا | ۱ | ✅ انجام شد |
| ۴۰ | غنی‌سازی Time/DateTime/Date-Range Input | 🟡 متوسط | ۱ | ✅ انجام شد |
| ۴۱ | Tailwind UI Blocks — افزودن Props محتوایی واقعی | 🟡 متوسط | ۱ | ✅ انجام شد |
| ۴۲ | `viz.gantt` — قابلیت‌های واقعی (dependencies/viewMode/drag) | 🟡 متوسط | ۱ | ✅ انجام شد |
| ۴۳ | `viz.kanban` — Drag-and-Drop واقعی + ستون‌های ساختاریافته | 🟡 متوسط | ۱ | ✅ انجام شد |
| ۴۴ | `viz.sheet` — ستون‌های ساختاریافته + موتور فرمول | 🟡 متوسط | ۱ | ✅ انجام شد |
| ۴۵ | غنی‌سازی File Upload + نمایش UI برای debounceMs + سه‌گانه Loading/Empty/Error روی Viz | 🟡 متوسط | ۱ | ⏳ نوشته شد |
| ۴۶ | Data Connectivity — انواع Connector (GraphQL/REST خارجی/فایل استاتیک) | 🟡 متوسط | ۱ | ✅ انجام شد |
| ۴۷ | تعمیم Expression/Formula sourceType + ادیتور Monaco | 🔴 بحرانی | ۱ | ✅ انجام شد |
| ۴۸ | Export داده (CSV/Excel/PDF) از گرید/داشبورد | 🟠 بالا | ۱ | ✅ انجام شد |
| ۴۹ | Design Token Registry + Theme Editor + Component Variants | 🟡 متوسط | ۱ | ✅ انجام شد |
| ۵۰ | Accessibility Auditing در Diagnostics | 🟡 متوسط | ۱ | ✅ انجام شد |
| ۵۱ | `triggerWorkflow` Action + Import CSV/Excel → Data Source | 🟢 پایین-ارزان | ۲ | ✅ انجام شد |
| ۵۲ | چارت‌های آماری پیشرفته (Scatter/Radar/Heatmap/…) + Map/Geo | 🟡 متوسط | ۱ | ✅ انجام شد |
| ۵۳ | المنت‌های غایب: Media Player واقعی، QR/Barcode، Command Palette، Notification/User-Menu/Chat | 🟡 متوسط | ۱ | ✅ انجام شد |
| ۵۴ | Canvas Comments + Audit Log + Builder-level RBAC | 🟡 متوسط | ۱ | ✅ انجام شد |
| ۵۵ | Real-time Push Binding (WebSocket/SSE) | 🟢 پایین | ۱ | ✅ انجام شد |
| ۵۶ | ابزار AI برای Scaffold چندصفحه‌ای اپلیکیشن | 🟡 متوسط | ۱ | ✅ انجام شد |
| ۵۷ | Custom React Component Import (Escape Hatch) | 🟡 متوسط (نیازمند تصمیم امنیتی) | ۱ | ✅ انجام شد |

جمع (فازهای ۱-۱۳): ۷۲ آیتم مجزا (۷۱ آیتم شماره‌دار ۲۸-۹۸ + ۱ آیتم بدون‌شماره‌ی جدید کشف‌شده در بخش ۱۰.۷.۲ سند ممیزی که این‌جا شماره‌ی ۹۹ به آن داده شده) + ۱ وظیفه‌ی تأیید مستقل (بازبینی مورد «۰ب»). همه‌ی این ۱۳ فاز اجرا و با یک دور بازبینی مستقل دوم (۱۲ ایجنت + یک اجرای نهایی) تأیید شدند — رجوع کنید به `20-DESIGNER-ELEMENT-PARITY-AUDIT.md` بخش ۱۱.

فازهای ۱۴-۱۶ (قابلیت‌های بعد از گواهی Production) هم اجرا و با یک دور بازبینی مستقل جداگانه (۳ ایجنت) تأیید شدند — هر سه بدون نیاز به هیچ اصلاحی، کاملاً درست بودند (فاز ۱۶ فقط `shell.not-found` را پوشش داد؛ `shell.error-page` طبق دستور خودِ فاز آگاهانه و شفاف deferred ماند).

فازهای ۱۷-۲۲ نتیجه‌ی دو تحقیق عمیق جداگانه‌اند (نه ادامه‌ی ممیزی پاریتی قبلی): یکی روی ویزارد «Auto Form Builder» (دکمه‌ی «From API» در پالت) و یکی روی فهرست «Built-in Components» در پالت. جزئیات کامل یافته‌های این دو تحقیق (که مبنای دقیق فازهای زیر است) در ذهن نویسنده‌ی این فازها موجود است؛ اگر Agent مجری فاز به جزئیات بیشتری نیاز داشت، باید خودش کد را از نو بخواند (طبق «قانون طلایی» ابتدای این سند) — این فازها فقط خلاصه‌ی اقدام لازم را می‌آورند، نه کل گزارش تحقیق را.

فازهای ۱۴-۱۶ (مجموعاً ۳ آیتم — ۱۰۰، ۱۰۱، ۱۰۲) قابلیت‌های جدیدی هستند که *بعد از* گواهی Production بخش ۱۱ تصمیم‌گیری شدند (رجوع به `20-DESIGNER-ELEMENT-PARITY-AUDIT.md` بخش ۱۲) — این‌ها باگ نیستند، افزودن قابلیت‌اند، ولی از همان متدولوژی و پروتکل تأیید بالا پیروی می‌کنند. مورد ۹۱ (امنیت condition) با تصمیم صریح محصول **بسته شد بدون نیاز به فاز اجرایی** — کاربران Designer فقط داخلی/معتمد/توسعه‌دهنده‌اند؛ جزئیات در بخش ۱۲ سند ممیزی.

---

## فاز ۱ — ریشه‌ی معماری: Query String هرگز در URL صادرشده‌ی Export ساخته نمی‌شود

**اولویت: 🔴 بحرانی‌ترین فاز کل این نقشه. این فاز را اول از همه اجرا کن.**
**وضعیت: ✅ تکمیل شد (آیتم ۲۸)**

### دامنه
- آیتم ۲۸ (سند ممیزی، بخش ۱۰.۱).

### زمینه‌ی دقیق باگ

فایل: `src/domain/component-designer/bindingApiCodegen.ts`

تابع `resolveBindingTemplateValue` (که `resolveBindingUrl` هم مستقیماً آن را صدا می‌زند) این‌طور تعریف شده (این کد **در رشته‌ی متنی امبدشده در باندل export** زندگی می‌کند، نه به‌صورت تابع TS معمولی — دقت کن هنگام ویرایش):

```ts
const resolveBindingTemplateValue = (
  template: string,
  context: Record<string, unknown> | null | undefined,
  paramPaths: Record<string, string>,
): string =>
  template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, paramName: string) => {
    const dataPath = paramPaths[paramName];
    if (!dataPath) return "";
    const segments = dataPath.split(".").map((segment) => segment.trim()).filter(Boolean);
    let cursor: unknown = context;
    for (const segment of segments) {
      if (cursor && typeof cursor === "object" && segment in (cursor as Record<string, unknown>)) {
        cursor = (cursor as Record<string, unknown>)[segment];
      } else {
        cursor = undefined;
        break;
      }
    }
    return cursor === undefined || cursor === null ? "" : String(cursor);
  });
```

این تابع **فقط** جایگزینی placeholder های `{name}` که به‌صورت لفظی داخل رشته‌ی `template` نوشته شده باشند انجام می‌دهد (برای الگوهای مسیر مثل `/api/users/{id}`). **هیچ منطقی برای الحاق `?key=value&...` به انتهای URL برای پارامترهایی که در template حضور ندارند وجود ندارد.**

هر جای Codegen که چارت/گرید/ویجت Viz دارای toolbar (جستجو/فیلتر/سورت/صفحه) باشد، این پارامترها را به‌صورت یک آبجکت `queryParams: Record<string, string>` (نگاشت `apiParam → storePath`) جمع می‌کند و همراه با `endpointTemplate` خام (مثلاً `/api/orders` — بدون هیچ `{search}`ای در متن) به `renderFetchUrlExpression` می‌دهد که نهایتاً این را تولید می‌کند:

```ts
resolveBindingUrl("/api/orders", bindingContext, { "search": "gridToolbar.search", "sortBy": "gridQuery.sortBy" })
```

چون `/api/orders` هیچ `{search}`/`{sortBy}`ای در متن ندارد، regex هیچ تطبیقی پیدا نمی‌کند، `paramPaths` کاملاً نادیده گرفته می‌شود، و تابع دقیقاً همان `/api/orders` بدون تغییر را برمی‌گرداند. **نتیجه: در هر برنامه‌ی Export/منتشرشده، تغییر جستجو/فیلتر/سورت/صفحه در نوار ابزار هیچ اثری روی درخواست واقعی به بک‌اند ندارد.**

**تناقض با مسیر Preview:** در `src/domain/component-designer/designerPreviewHydration.ts`، تابع `resolveHydrationTargetUrl` (که مسیر بوم طراحی و Preview تعاملی از آن استفاده می‌کنند) این‌طور کار می‌کند:

```ts
const searchParams = new URLSearchParams();
for (const [paramName, dataPath] of Object.entries(queryParams)) {
  const value = readNestedContextValue(designerStore, dataPath);
  if (value === undefined || value === null) continue;
  const text = String(value).trim();
  if (text.length === 0) continue;
  searchParams.set(paramName, text);
}
const queryString = searchParams.toString();
```

این نسخه **درست** است — واقعاً `?search=alice&sortBy=email` می‌سازد. باید همین منطق (یا معادل دقیقش) به نسخه‌ی Export هم اضافه شود.

### چرا تست‌های موجود این را نگرفته‌اند

فایل‌های تستی مثل `gridToolbarQueryParamsCodegen.test.ts` و `chartToolbarCodegen.test.ts` فقط این را چک می‌کنند که رشته‌ی کد تولیدشده حاوی الگوی `resolveBindingUrl("/api/orders", ..., {"search":"..."})` باشد — یعنی چک می‌کنند که Codegen **پارامترهای درست را به تابع پاس داده**، نه این‌که خودِ تابع در زمان اجرا کاری با آن‌ها می‌کند یا نه. این یک شکاف متدولوژیک است که باید در تست جدید این فاز اصلاح شود (طبق بخش ۱.۱ بالا).

### دستور فیکس دقیق

در `bindingApiCodegen.ts`، تابع `resolveBindingTemplateValue` را طوری بازنویسی کن که:

1. رفتار فعلی (جایگزینی placeholder های `{name}` داخل مسیر) را برای هر پارامتری که واقعاً در `template` به‌صورت `{name}` حاضر است حفظ کند (backward-compatible — چند جای دیگر کد از این تابع برای الگوهای مسیر مثل `/api/users/{id}` استفاده می‌کنند، این رفتار نباید بشکند).
2. برای پارامترهایی که در `paramPaths` هستند ولی به‌صورت `{name}` در `template` حضور ندارند، مقدارشان را (از همان مسیر resolve دیتای موجود در تابع فعلی — `context`/`dataPath` traversal) بخواند و با `URLSearchParams` به انتهای URL (بعد از `?`، یا بعد از `&` اگر URL از قبل query داشت) اضافه کند — دقیقاً همان رفتار `resolveHydrationTargetUrl`.
3. مقادیر `undefined`/`null`/رشته‌ی خالی را از query string حذف کند (مثل نسخه‌ی Preview).

**نکته‌ی پیاده‌سازی مهم:** این کد به‌صورت رشته‌ی متنی چندخطی (آرایه‌ای از رشته‌ها) در `renderBindingApiRuntimeHelpers` تعریف شده، نه یک تابع TS معمولی — باید دقیقاً همان الگوی نوشتن (رشته‌های جداگانه در آرایه، بدون خطای escape) را حفظ کنی. بعد از تغییر، حتماً یک تست بنویس که این رشته را با `esbuild.transformSync` (دقیقاً مثل الگوی `vizGanttProgressFieldExportFix.test.ts`) واقعاً اجرا می‌کند و خروجی نهایی URL را برای چند سناریو (فقط path-placeholder، فقط query-param، ترکیب هردو، چند query-param با هم) assert می‌کند.

**همچنین بررسی کن:** آیا نسخه‌ی مشابهی از این منطق (نه از طریق همین تابع، بلکه به‌صورت جدا) در جای دیگری از `bindingApiCodegen.ts` یا `bindingCodegen.ts` تکرار شده که باید هماهنگ شود؟ (`resolveBindingHeaders` هم از `resolveBindingTemplateValue` استفاده می‌کند — چک کن رفتار header ها را خراب نکنی؛ headerها معمولاً فقط از الگوی path-placeholder استفاده می‌کنند، نه query-string، پس رفتارشان نباید عوض شود، فقط مطمئن شو.)

### تست‌های موجود که باید (فقط اجرا شوند تا رگرسیون نگیرند)
`gridToolbarQueryParamsCodegen.test.ts`, `chartToolbarCodegen.test.ts`, `vizNonChartToolbarCodegen.test.ts`, هر تست دیگری که `resolveBindingUrl`/`renderFetchUrlExpression` را در متن چک می‌کند.

### تست جدید موردنیاز
یک فایل تست جدید (مثلاً `bindingApiCodegenQueryStringRootCauseFix.test.ts`) که:
- رشته‌ی واقعی `resolveBindingTemplateValue` (از `renderBindingApiRuntimeHelpers()`) را با esbuild اجرا می‌کند.
- سناریوهای زیر را با URL نهایی واقعی assert می‌کند: (الف) فقط path placeholder (`/api/users/{id}` با `{id:'params.id'}`) — رفتار قدیمی باید حفظ شود؛ (ب) فقط query param روی endpoint بدون placeholder (`/api/orders` با `{search:'store.search'}`) → باید `/api/orders?search=<value>` بدهد؛ (پ) ترکیب هردو در یک template؛ (ت) چند query param هم‌زمان؛ (ث) مقدار `undefined`/خالی باید از query string حذف شود، نه این‌که `key=` خالی اضافه کند.
- یک تست end-to-end با `generateDesignerTsx` واقعی (چارت/گرید bound با toolbar) که TSX را تولید کند، رشته‌ی تابع کمکی امبدشده را از خروجی استخراج کند (یا مستقیماً از `renderBindingApiRuntimeHelpers` بگیرد)، و کل زنجیره را تا URL نهایی تأیید کند.

---

## فاز ۲ — خانواده‌ی ورودی متنی خام در Export (`heroui.input-text` / `heroui.number-input` / `heroui.textarea`)

**اولویت: 🔴 بحرانی. رایج‌ترین ۳ عنصر فرم در کل ابزار — هر سند Export‌شده‌ای که این‌ها را داشته باشد کامپایل TypeScript را می‌شکند.**
**وضعیت: ✅ تکمیل شد (آیتم ۲۹)**

### دامنه
- آیتم ۲۹ (سند ممیزی، بخش ۱۰.۱).

### زمینه‌ی دقیق باگ

فایل: `src/domain/component-designer/tsxComponentRegistry.ts`، حدود خط ۱۳۸-۱۴۰:

```ts
'heroui.input-text': { reactTag: 'Input', importSymbols: ['Input'] },
'heroui.number-input': { reactTag: 'Input', importSymbols: ['Input'] },
'heroui.textarea': { reactTag: 'TextArea', importSymbols: ['TextArea'] },
```

چون `importFrom` روی این سه تعریف نشده، پیش‌فرض `HEROUI_IMPORT_SOURCE = '@heroui/react'` اعمال می‌شود — یعنی کد Export‌شده مستقیماً `import { Input } from '@heroui/react'` صادر می‌کند (پرایمیتیو خام کتابخانه)، درحالی‌که مسیر Preview/Canvas (`runtimeRenderer.tsx`) از `UiInput`/`UiTextarea` — دو wrapper غنی در `src/shared/ui/HeroFieldControls.tsx` — استفاده می‌کند که خودشان propهای `label/description/isRequired/isInvalid/errorMessage/startContent/endContent/isClearable/size/...` را می‌پذیرند و بین پرایمیتیو خام (`HeroInput`، که فقط propهای بسیار محدود HTML/react-aria را می‌شناسد) و پوسته‌ی بصری (`FieldFeedbackShell`) به‌درستی تفکیک می‌کنند.

پرایمیتیو خام `Input`/`TextArea` از `@heroui/react` (`node_modules/@heroui/react/dist/components/input/input.d.ts`) این پراپ‌ها را **اصلاً نمی‌شناسد** — از جمله `size` که در `catalog.ts`، `defaultProps` هر سه عنصر (`heroui.input-text`/`number-input`/`textarea`) همیشه `size: 'sm'` است، و روی `InputHTMLAttributes` واقعی، `size` یک عدد است نه رشته → بدون هیچ تنظیم دستی کاربر، فقط با کشیدن یکی از این سه عنصر روی بوم، کد صادرشده کامپایل TypeScript را می‌شکند (`error TS2322: Type 'string' is not assignable to type 'number'`).

مقایسه کن با `heroui.select` که این الگو قبلاً درست شده (`tsxComponentRegistry.ts`، حدود خط ۱۴۱): `{ reactTag: 'UiSelect', importSymbols: ['UiSelect'], importFrom: '@/shared/ui/HeroFieldControls' }`.

### دستور فیکس دقیق

1. باز کن `src/shared/ui/HeroFieldControls.tsx` و تابع‌های `UiInput`/`UiTextarea` (یا معادل نامشان — نام دقیق را با `grep -n "export const Ui" src/shared/ui/HeroFieldControls.tsx` تأیید کن) را کامل بخوان: چه propهایی می‌گیرند؟ اسم‌های prop دقیقاً چیست؟ آیا با نام‌هایی که Codegen فعلاً برای `heroui.input-text`/`number-input`/`textarea` تولید می‌کند (`label`, `description`, `isRequired`, `isInvalid`, `errorMessage`, `pattern`, `minLength`, `maxLength`, `startContent`, `endContent`, `isClearable`, `autoFocus`, `size`, `placeholder`, `type`, `min`, `max`, `step`, `rows`/`maxRows`) یک‌به‌یک تطبیق دارند؟
2. در `tsxComponentRegistry.ts`، سه ورودی را دقیقاً مثل الگوی `heroui.select` اصلاح کن:
   ```ts
   'heroui.input-text': { reactTag: 'UiInput', importSymbols: ['UiInput'], importFrom: '@/shared/ui/HeroFieldControls' },
   'heroui.number-input': { reactTag: 'UiInput', importSymbols: ['UiInput'], importFrom: '@/shared/ui/HeroFieldControls' },
   'heroui.textarea': { reactTag: 'UiTextarea', importSymbols: ['UiTextarea'], importFrom: '@/shared/ui/HeroFieldControls' },
   ```
   (نام دقیق export شده از `HeroFieldControls.tsx` را در قدم ۱ تأیید کن — اگر متفاوت بود، همان نام واقعی را استفاده کن، نه فرض این‌جا را.)
3. بعد از این تغییر، جایی که JSX این سه عنصر واقعاً ساخته می‌شود (به‌احتمال زیاد `tsxNodeRenderer.ts`، بخش عمومی که از `tsxComponentRegistry` می‌خواند) را بررسی کن — آیا لیست `excludeKeys`/attribute mapping فعلی (که برای پرایمیتیو خام نوشته شده بود) هنوز با contract جدید `UiInput`/`UiTextarea` سازگار است؟ چون این wrapperها احتمالاً **بیشتر** propها را می‌پذیرند (نه کمتر)، به‌احتمال زیاد نیازی به exclude کردن چیز اضافه‌ای نیست، ولی حتماً چک کن `number-input`ی خاص (`type="number"`, `min`, `max`, `step`) هنوز درست به `UiInput` می‌رسد — این wrapper باید این propها را هم پشتیبانی کند یا از طریق `...rest`/`inputProps` عبور دهد؛ اگر نه، باید کوچک‌ترین تغییر ممکن به خودِ `UiInput` اضافه شود (نه یک مسیر Export جدا).
4. اگر `UiInput`/`UiTextarea` مسیر `onChange`/`onBlur`/ref متفاوتی نسبت به پرایمیتیو خام دارند، بررسی کن Event binding تولیدشده‌ی Codegen (`onChange={...}`, `onBlur={...}`) هنوز با امضای این wrapper سازگار است.

### تأیید تجربی اجباری (این باگ فقط با اجرای واقعی کامپایلر کشف شد — همین‌طور باید رفعش تأیید شود)

بعد از فیکس، یک سند طراحی نمونه با هر سه عنصر (شامل `isRequired`, `isInvalid`, `errorMessage`, `startContent`, `pattern`, `minLength`, `maxLength` روی حداقل یکی) بساز، `generateDesignerTsx` را روی آن اجرا کن، خروجی TSX واقعی را در یک فایل موقت بنویس، و **واقعاً `tsc --noEmit` روی آن فایل با tsconfig واقعی پروژه اجرا کن** (دقیقاً همان روشی که در گزارش کشف این باگ استفاده شد) — باید صفر خطا بدهد. این فایل موقت را بعد از تست حذف کن.

### تست جدید موردنیاز
`rawHeroPrimitiveExportFix.test.ts` (یا نام مشابه): تولید TSX واقعی برای هر سه عنصر (با/بدون تنظیمات validation/adornment)، assert کردن import از `@/shared/ui/HeroFieldControls`، عدم وجود `size="sm"` نامعتبر، و — مهم‌ترین بخش — یک مرحله‌ی واقعی type-check (`tsc --noEmit`) روی فایل تولیدشده به‌عنوان بخشی از خودِ تست (نه صرفاً یک قدم دستی).

---

## فاز ۳ — App Table Grid: زنجیره‌ی کامل داده/کوئری/اکشن/صفحه‌بندی

**اولویت: 🔴 بحرانی (چند مورد) + 🟠 بالا (بقیه). این بزرگ‌ترین فاز است (۱۱ آیتم) چون همه روی همان کلاستر فایل‌ها اثر می‌گذارند و تفکیک‌شان ریسک تداخل ایجاد می‌کرد.**
**وضعیت: ✅ تکمیل شد (آیتم‌های ۳۰، ۷۰، ۷۱، ۷۲، ۷۳، ۷۴، ۷۵، ۷۶، ۷۷، ۷۸، ۹۷)**

### دامنه
آیتم‌های ۳۰، ۷۰، ۷۱، ۷۲، ۷۳، ۷۴، ۷۵، ۷۶، ۷۷، ۷۸، ۹۷ (سند ممیزی، بخش‌های ۱۰.۱ و ۱۰.۵).

### فایل‌های اصلی این فاز
`src/domain/component-designer/designerDataGridRuntime.ts`، `src/domain/component-designer/DesignerRuntimeAppTableGrid.tsx`، `src/domain/component-designer/bindingCodegen.ts` (بخش‌های مربوط به grid state hooks و row-action handler)، `src/domain/component-designer/tsxPhase2Palette.ts` (`renderAppTableGridCustomJsx`)، `src/domain/component-designer/designerGridToolbarConfig.ts`، `src/domain/component-designer/bindingStoreCodegen.ts` (`documentAppTableGridUsesStore`)، `src/domain/component-designer/bindingGridDetailEngine.ts`.

**⚠️ همپوشانی فایل با فاز ۱:** این فاز به `bindingApiCodegen.ts` کاری ندارد مستقیماً، ولی از همان زیرساخت fetch/query که فاز ۱ اصلاح می‌کند استفاده می‌کند. **توصیه: فاز ۱ را قبل از این فاز اجرا کن** (اگر امکانش هست) — اگرچه تکنیکی مستقل‌اند (فاز ۳ مشکلات دیگری غیر از خودِ query-string dispatch را رفع می‌کند)، تست‌های end-to-end این فاز (مخصوصاً برای آیتم ۷۴) منطقی‌تر است بعد از این باشد که فاز ۱ واقعاً query string را در URL می‌سازد.

### آیتم ۳۰ — صفحه‌بندی سمت‌سرور در صفحه‌ی ۲+ ردیف خالی نشان می‌دهد

**مکانیزم:** در `designerDataGridRuntime.ts`، تابع `sliceDataGridRowsForDisplay` یک شرط `if/else` دارد که هر دو شاخه‌اش دقیقاً یک کد را اجرا می‌کنند (شرط عملاً مرده):
```ts
if (gridQueryMode === 'server' && totalCount > rows.length) {
  return { displayRows: rows.slice(start, start + pageSize), ... };
}
return { displayRows: rows.slice(start, start + pageSize), ... };
```
وقتی بک‌اند واقعاً صفحه‌بندی می‌کند (یعنی `rows` فقط همان چند آیتم صفحه‌ی جاری را دارد، نه کل دیتاست)، `start = (page-1)*pageSize` بر مبنای اندیس کل دیتاست محاسبه می‌شود، درحالی‌که `rows` فقط ۵-۲۰ آیتم دارد → `rows.slice(start, ...)` برای `page > 1` یک آرایه‌ی خالی برمی‌گرداند.

**فیکس:** وقتی `gridQueryMode === 'server'` (یعنی سرور مسئول صفحه‌بندی است)، تابع باید **کل `rows` را همان‌طور که هست برگرداند** (بدون `slice` دوباره — چون سرور از قبل فقط همان صفحه را فرستاده)، نه این‌که با فرمول client-side دوباره برش بزند. فقط وقتی `gridQueryMode === 'client'` باشد باید `rows.slice(start, start+pageSize)` روی کل دیتاست محلی اعمال شود. بازنویسی منطق شرط را طوری انجام بده که این دو حالت واقعاً رفتار متفاوت داشته باشند.

### آیتم ۷۸ — «Total Records» یک عدد استاتیک طراحی‌زمان است

**مکانیزم:** `bindingCodegen.ts` (حدود خط ۱۷۴۹) این خط را دارد: `const total = readNumber(node.props.total, 0);` — یک لیترال ثابت در کد تولیدی، هرگز از پاسخ واقعی API استخراج نمی‌شود. اگر خالی بماند (پیش‌فرض ۰)، `resolveDataGridTotalCount` به `rows.length` (طول همان صفحه) سقوط می‌کند و دکمه‌ی Next همیشه غیرفعال می‌ماند.

**فیکس:** بررسی کن آیا پاسخ‌های واقعی API که این گرید‌ها به آن‌ها متصل می‌شوند، معمولاً یک فیلد total-count در پاسخ دارند (چک کن `DesignerResponseMapping`/`responseMapping` در `types.ts` و ببین آیا از قبل یک مسیر برای «مسیر شمارش کل» در response mapping وجود دارد که استفاده نشده). اگر چنین زیرساختی وجود دارد، از آن استفاده کن تا `total` واقعی از پاسخ resolve شود. اگر وجود ندارد، حداقل باید: (الف) این محدودیت را در Inspector (توضیح/placeholder فیلد Total Records) واضح‌تر مستند کنی که «اگر این خالی بماند و سرور صفحه‌بندی می‌کند، Next ممکن است زودتر از موعد غیرفعال شود»، و (ب) اگر گرید `gridQueryMode==='server'` است و `total` صفر/تنظیم‌نشده است، فرض منطقی‌تری به‌کار ببر (مثلاً اگر تعداد ردیف‌های برگشتی دقیقاً برابر `pageSize` بود، فرض کن حداقل یک صفحه‌ی دیگر هم هست، تا Next را بی‌جهت غیرفعال نکند) — این را با دقت پیاده‌سازی کن و در گزارش پایانی توضیح بده کدام رویکرد را انتخاب کردی و چرا.

### آیتم ۷۳ و ۷۴ — `gridQueryMode` و فیلترهای toolbar بدون اثر

**مکانیزم مشترک:** پیش‌فرض کاتالوگ برای `heroui.app-table-grid` این است: `gridQueryMode: 'server'` (`catalog.ts`، حدود خط ۶۳۰). فیلتر/سورت کلاینتی (`applyClientGridQuery`) هر ستونی با mode سروری را نادیده می‌گیرد. جستجو/فیلتر role در toolbar (`searchInput`/`debouncedSearch`/`roleFilters` در `DesignerRuntimeAppTableGrid.tsx`) فقط داخل تابع `syncServerQueryToStore` مصرف می‌شوند که پشت شرط `gridQueryMode==='server' && serverQuery?.enabled===true` قفل است. یعنی اگر کاربر «Search» toolbar را فعال کند ولی سوییچ جدای «Sync filters to API (server mode)» را نزند، تایپ در جعبه‌ی جستجو **هیچ اثری ندارد** — نه fetch سروری (چون سوییچ خاموش است)، نه فیلتر کلاینتی (چون mode سروری است) — بدون هیچ خطا یا نشانه‌ای به کاربر.

**فیکس (رویکرد پیشنهادی، ولی خودت با بررسی UX فعلی تصمیم نهایی بگیر و در گزارش توضیح بده):**
گزینه‌ی ساده‌تر و کم‌ریسک‌تر: وقتی toolbar's Search/Role-Filter فعال است ولی «Sync filters to API» خاموش است **و** `gridQueryMode==='server'` است، این یک پیکربندی متناقض کاربر است. یا باید:
(الف) در Inspector هنگام فعال‌کردن Search/Role-Filter، اگر mode سروری است، به‌طور خودکار «Sync filters to API» را هم فعال کنی (یا حداقل یک پیام/badge هشدار در UI نشان بدهی)، یا
(ب) اگر «Sync filters to API» خاموش است، رفتار fallback منطقی این باشد که این فیلترها را **کلاینتی** اعمال کنی صرف‌نظر از `gridQueryMode` (یعنی جستجو/فیلتر همیشه حداقل روی دیتای فعلاً بارگذاری‌شده اثر داشته باشد، حتی اگر کامل نباشد).
این تصمیم UX را با دقت بررسی کن (به کد Inspector فعلی — `InspectorGridToolbarField.tsx` — نگاه کن ببین «Sync filters to API» چطور توضیح داده شده) و ساده‌ترین راهی که تناقض فعلی «بدون خطا، بدون اثر» را از بین می‌برد را پیاده‌سازی کن. حداقل کاری که باید انجام شود: **این حالت دیگر نباید کاملاً بی‌صدا و بی‌اثر باشد.**

### آیتم ۷۶ — تغییر جستجو/role-filter صفحه را به ۱ بازنشانی نمی‌کند

**مکانیزم:** افکت بازنشانی صفحه در `DesignerRuntimeAppTableGrid.tsx`: `useEffect(() => setLocalPage(1), [querySignature, localPageSize])` — `querySignature` فقط سورت/فیلتر ستونی را شامل می‌شود، نه `debouncedSearch` یا `roleFiltersSignature`.

**فیکس:** `debouncedSearch` و یک signature پایدار از `roleFilters` (مثلاً `JSON.stringify` مرتب‌شده‌ی کلیدهای فعال) را هم به آرایه‌ی وابستگی این `useEffect` اضافه کن، تا تغییر جستجو/role-filter هم دقیقاً مثل تغییر سورت صفحه را به ۱ برگرداند.

### آیتم ۷۷ — حالت اولیه‌ی چک‌باکس‌های role-filter بین مسیرها معکوس است

**مکانیزم:** `DesignerRuntimeAppTableGrid.tsx`'s `buildInitialRoleFilters`: همه `false`. `bindingCodegen.ts`'s `renderAppTableGridStateHookLines` (حدود خط ۱۸۳۰): همه `true` (`initialRoleFilters = ...map(role => [role, true])`).

**فیکس:** یکی از این دو را انتخاب کن (به نظر می‌رسد `false` — یعنی همه غیرفعال — رفتار امن‌تر و رایج‌تری برای فیلتر است، ولی این را با بررسی این‌که کدام رفتار در `InspectorGridToolbarField.tsx` مستند/مورد‌انتظار است تأیید کن) و مسیر دیگر را با آن هماهنگ کن تا دقیقاً یکسان باشند.

### آیتم ۷۵ — سورت دستی با هر ویرایش تعریف ستون بازنشانی می‌شود

**مکانیزم:** افکت resync سورت در `DesignerRuntimeAppTableGrid.tsx` (حدود خط ۶۴۴-۶۵۲) به شیء کامل `gridColumns` وابسته است (نه یک signature پایدار مبتنی بر `columnId`+`sortable`) — با **هر** تغییر `node.props.columns` (حتی فقط ویرایش label) دوباره ساخته می‌شود و بدون قید، انتخاب سورت دستی کاربر را به `defaultSortBy` برمی‌گرداند.

**فیکس:** این افکت باید فقط وقتی سورت را بازنشانی کند که مجموعه‌ی `columnId`های sortable واقعاً عوض شده باشد (ستونی اضافه/حذف شده یا sortable-بودنش عوض شده)، نه با هر ویرایش دیگر (مثل تغییر label/width/cellKind). یک `useMemo`/signature پایدار (مثلاً رشته‌ای از `columnId:sortable` مرتب‌شده) بساز و آرایه‌ی وابستگی افکت را به آن signature تغییر بده، نه به کل شیء `gridColumns`. مطمئن شو تست موجود `inspectorVisualStyleComplexNodeState.t1-16.test.tsx` (که تأیید می‌کند ویرایش‌های Style سورت را خراب نمی‌کنند) همچنان سبز می‌ماند.

### آیتم ۷۰ — `cellClickBehavior` روی سلول‌های rich (link/chips/lock-status) بی‌اثر در Export

**مکانیزم:** `bindingCodegen.ts` همیشه `cellClickHandlerRef: { current: undefined }` را هاردکد می‌کند در فراخوانی `buildAppTableGridColumns(...)` تولیدشده — سلول ظاهراً کلیک‌پذیر است (`canInvokeCellClick` مبتنی بر وجود `cellClickBehavior` محاسبه می‌شود) ولی کلیک هیچ اثری ندارد.

**فیکس:** باید یک handler واقعی تولید شود که با کلیک روی سلول، `column.cellClickBehavior` را بخواند و رفتار متناظر (`open-modal`/`detail-flow`/`none`) را اجرا کند — دقیقاً هم‌ارز با آنچه Preview's `executeDesignerGridCellClick` (`bindingGridRowActionRuntime.ts`) انجام می‌دهد. بخش Codegen را طوری گسترش بده که یک تابع handler واقعی (مشابه الگوی موجود برای row-action handlerها در همین فایل) برای `cellClickHandlerRef` تولید و پاس دهد، به‌جای `{ current: undefined }` ثابت.

### آیتم ۷۱ — Row action با `behavior.kind:'detail-flow'` وقتی `actionId` با `rowActionId` گرید فرق دارد، در Export بی‌صدا no-op می‌شود

**مکانیزم:** در Preview، `executeConfiguredBehavior` (`bindingGridRowActionRuntime.ts`) این حالت را عمداً special-case می‌کند: هر اکشنی با `behavior.kind==='detail-flow'` جریان تشخیص جزئیات را با `rowActionId` **خودِ flow** صدا می‌زند (نه با `actionId` خودِ دکمه) — یعنی هر دکمه‌ای با این behavior کار می‌کند صرف‌نظر از `actionId`اش. در Export (`renderAppTableGridRowActionHandlerLines`، `bindingCodegen.ts`)، فقط یک `case` دقیقاً برای رشته‌ی لفظی `flow.config.rowActionId` تولید می‌شود — یعنی دکمه‌ای با `actionId` متفاوت (که `behavior.kind==='detail-flow'` هم دارد) به `default: return;` می‌افتد.

**فیکس:** منطق تولید switch/case در Codegen را طوری تغییر بده که برای **هر** action با `behavior?.kind === 'detail-flow'` (صرف‌نظر از `actionId` خودش)، همان کد اجرای detail-flow (با `rowActionId` واقعی flow) تولید شود — یعنی یا یک `case` جدا برای هر چنین actionId ای اضافه کن که به همان منطق detail-flow می‌رود، یا منطق سوییچ را طوری بازطراحی کن که ابتدا چک کند آیا action's behavior detail-flow است (صرف‌نظر از این‌که کدام actionId زد) و اگر بله، مستقیم منطق flow را صدا بزند — دقیقاً هم‌ارز با `executeConfiguredBehavior` در Preview.

### آیتم ۷۲ — چهار فیلد Inspector مرده در Export: `cardBelow`, `showSortControls`, `showListModeControls`, `visibleInfiniteCount`

**مکانیزم:** در `tsxPhase2Palette.ts`'s `renderAppTableGridCustomJsx`، این چهار کلید یا اصلاً exclude/re-add نمی‌شوند، یا exclude می‌شوند بدون این‌که دوباره به‌صورت prop واقعی روی `<AppTableGrid>`/`<GridPagingFooter>` امیت شوند. برای `showSortControls`/`showListModeControls`، چون کامپوننت واقعی (`GridPagingFooter`) پیش‌فرض‌شان `true`/نمایش‌همیشگی است، نتیجه بدتر از «مرده» است — این کنترل‌ها همیشه نمایش داده می‌شوند حتی وقتی کاربر آن‌ها را در Inspector غیرفعال کرده.

**فیکس:** برای هر ۴ فیلد، دقیقاً مثل سیبلینگ سالمش `presentation` (که در همین تابع به‌درستی exclude و دوباره از طریق `reservedAttributes` امیت می‌شود — این را به‌عنوان الگوی مرجع بخوان) عمل کن:
- `cardBelow` → روی `<AppTableGrid cardBelow={...}>` امیت شود.
- `showSortControls` → روی `<GridPagingFooter showSortControls={...}>` امیت شود (Preview: `showSortControls={showSortControls && sortOptions.length > 0}` — همین شرط را در Export هم رعایت کن).
- `showListModeControls` → روی `<GridPagingFooter>` امیت شود؛ Preview این را با `listMode`/`onListModeChange` هم‌زمان گیت می‌کند (`DesignerRuntimeAppTableGrid.tsx` حدود خط ۹۲۹-۹۳۰) — همان شرط را در Export تکرار کن (وقتی false است، `listMode`/`onListModeChange` هم نباید امیت شوند، وگرنه `GridPagingFooter` صرفاً با حضورشان کنترل را نشان می‌دهد).
- `visibleInfiniteCount` → باید مقدار واقعی (`keyedRows.length` معادل زمان اجرا، نه یک لیترال) به `GridPagingFooter` پاس داده شود در حالت infinite-mode.

### آیتم ۹۷ — تشخیص نیاز به `designerStore` برای قانون غیرفعال‌سازی سطح-سلول

**مکانیزم:** `documentAppTableGridUsesStore` (`bindingStoreCodegen.ts`) فقط toolbar/detail-flow/ستون‌های اکشن را چک می‌کند، هرگز قوانین سطح-سلول (`cellDisabledWhen`/`actionDisabledWhen` با `preset:'expression'`) را برای الگوی `store.`/`designerStore.` اسکن نمی‌کند.

**فیکس:** در `documentAppTableGridUsesStore`، یک اسکن اضافه کن که همه‌ی ستون‌های گرید را می‌گردد و اگر هرکدام `cellDisabledWhen`/`actionDisabledWhen` با `preset==='expression'` دارد که عبارتش شامل الگوی `store.`/`designerStore.` است، `true` برگرداند. این باعث می‌شود `designerStoreRef` واقعی (نه `{current: undefined}`) در چنین سناریوهایی به `buildAppTableGridColumns` پاس داده شود.

### Self-Audit ویژه‌ی این فاز
بعد از رفع همه‌ی ۱۱ مورد، یک سند طراحی نمونه با یک گرید bound به یک دیتاسورس واقعی بساز که: toolbar کامل (search+role-filter+sort+refresh) فعال باشد، `gridQueryMode='server'` و `serverQuery.enabled=true` باشد، حداقل یک ستون rich (`link`) با `cellClickBehavior` داشته باشد، حداقل یک row-action با `behavior.kind:'detail-flow'` و `actionId` متفاوت از `rowActionId` اصلی گرید داشته باشد، و `defaultSortBy` تنظیم باشد. TSX را تولید کن و **کل زنجیره را دستی در متن کد تولیدشده ردیابی کن** تا مطمئن شوی همه‌ی ۱۱ رفع واقعاً هم‌زمان و بدون تداخل کار می‌کنند (نه فقط تک‌تک در انزوا).

---

## فاز ۴ — خانواده‌ی Select / Autocomplete / Entity-Picker / Tags-Input

**اولویت: 🔴 بحرانی (بخشی) + 🟡 متوسط (بقیه).**
**وضعیت: ✅ تکمیل شد (آیتم‌های ۳۱، ۳۲، ۴۶، ۴۷، ۴۸، ۴۹، ۵۰، ۵۱، ۵۲، ۹۰، ۹۲ — گزینه‌ی الف)**

**یادداشت بازبینی (Verification pass):** مورد ۴۷ در پاس اول این فاز غلط رفع شده بود — فرض «نام واقعی پراپ `shouldCloseOnSelect` است» برای select/autocomplete/entity-picker با خواندن مستقیم `node_modules/@heroui/react/node_modules/react-aria-components` رد شد (این پراپ فقط روی Menu/DatePicker واقعی است). در بازبینی، فیلد «Close On Select» کاملاً از هر سه عنصر حذف شد (مثل حذف `allowCustomValue`، مورد ۹۲) به‌جای این‌که با نام غلط دیگری decorative بماند. جزئیات کامل در `docs/refactor-spec/20-DESIGNER-ELEMENT-PARITY-AUDIT.md`، بخش ۱۰.۳، مورد ۴۷.

### دامنه
آیتم‌های ۳۱، ۳۲، ۴۶، ۴۷، ۴۸، ۴۹، ۵۰، ۵۱، ۵۲، ۹۰ (=تکرار ۴۶، جدا رفع نکن)، ۹۲ (سند ممیزی، بخش‌های ۱۰.۱ و ۱۰.۳).

### فایل‌های اصلی این فاز
`src/domain/component-designer/DesignerRuntimeSelect.tsx`، `src/domain/component-designer/DesignerRuntimeAutocomplete.tsx`، `src/domain/component-designer/runtimePhase2Palette.tsx` (entity-picker)، `src/domain/component-designer/DesignerRuntimeParityPalette.tsx` (tags-input)، `src/domain/component-designer/bindingEntityPickerCodegen.ts`، `src/domain/component-designer/tsxNodeRenderer.ts`، `src/domain/component-designer/tsxPhase2Palette.ts`، `src/domain/component-designer/runtimeNodeProps.ts`، `src/domain/component-designer/propRegistry.ts`، `src/domain/component-designer/bindingLovRegistry.ts`، `src/domain/component-designer/tsxParityPalette.ts`.

### یافته‌ی معماری پایه (بخوان قبل از هر فیکسی در این فاز)

با خواندن `node_modules/@heroui/react/dist/components/autocomplete/autocomplete.js` تأیید شد: `AutocompleteRoot` واقعی HeroUI یک wrapper نازک روی پرایمیتیو **`Select`** از `react-aria-components` است (**نه** `ComboBox`) — بدون هیچ `<input>` متنی داخلی. تنها راه فیلتر واقعی، ساب‌کامپوننت `Autocomplete.Filter` است که در هیچ‌کدام از Canvas/Preview/Export این پروژه استفاده نشده. یعنی **هیچ‌گاه** امکان تایپ برای جست‌وجوی واقعی در `heroui.autocomplete`/`heroui.entity-picker` وجود نداشته — این یک محدودیت معماری پایه است، نه یک رگرسیون.

**تصمیمی که باید بگیری (و در گزارش پایانی مستند کنی):** برای این فاز، دو گزینه داری:
- **گزینه‌ی الف (پیشنهادی، دامنه‌ی محدودتر و کم‌ریسک‌تر):** واقعیت را بپذیر — `heroui.autocomplete`/`heroui.entity-picker` را به یک Select با گزینه‌های از پیش بارگذاری‌شده تبدیل کن (placeholder را از «Search…» به چیزی صادقانه‌تر مثل «Select…» تغییر بده)، و روی رفع بقیه‌ی فیلدهای مرده (Label/closeOnSelect/isInvalid/Loading/tags-input value) تمرکز کن. برای `entity-picker`، حداقل زیرساخت fetch اولیه (بدون جست‌وجوی زنده) باید درست کار کند.
- **گزینه‌ی ب (دامنه‌ی گسترده‌تر، ریسک بیشتر، فقط اگر وقت/بودجه اجازه می‌دهد):** واقعاً از `Autocomplete.Filter` واقعی (`react-aria-components`) برای پیاده‌سازی جست‌وجوی حقیقی استفاده کن.

اگر مطمئن نیستی، **گزینه‌ی الف را انتخاب کن** — این فاز را کوچک و قابل تأیید نگه‌دار؛ افزودن جست‌وجوی واقعی یک تغییر رفتاری بزرگ‌تر است که باید جدا و با تأیید محصول انجام شود (این را به‌صراحت در گزارش پایانی بنویس تا کاربر بداند این یک تصمیم آگاهانه‌ی محدودکردن دامنه بوده، نه فراموشی).

### آیتم ۴۷ — `closeOnSelect` مرده در هر سه مسیر، هر سه عنصر (select/autocomplete/entity-picker)

**مکانیزم:** نام واقعی prop در `react-stately` **`shouldCloseOnSelect`** است، نه `closeOnSelect`. همه‌جای کد (`inspectorPaletteFields.ts`'s `HEROUI_MENU_ASYNC_FIELDS`، `runtimeNodeProps.ts`'s `resolveSelectMenuProps`، `HeroFieldControls.tsx`'s `HeroSelect`/`HeroAutocomplete` usages، مسیر Export عمومی برای هر سه عنصر) از نام غلط استفاده می‌کنند.

**فیکس:** تصمیم بگیر: آیا نام را در همه‌جا از `closeOnSelect` به `shouldCloseOnSelect` تغییر می‌دهی (و در `propRegistry.ts` یک نگاشت نام اضافه می‌کنی تا کاربر همچنان می‌تواند در Inspector آن را «Close On Select» ببیند ولی prop واقعی درست امیت شود)، یا مستقیماً همه‌جا `resolveSelectMenuProps` (و معادل‌هایش) را طوری تغییر می‌دهی که مقدار `node.props.closeOnSelect` را بخواند ولی prop را با نام `shouldCloseOnSelect` به کامپوننت واقعی پاس دهد. رویکرد دوم کم‌ریسک‌تر است (نیازی به تغییر Inspector schema/نام فیلد ذخیره‌شده در سند نیست). این تبدیل نام را در **همه‌ی** محل‌های مصرف (Canvas/Preview `runtimeNodeProps.ts` + Export مسیر عمومی برای هر سه عنصر) یکسان اعمال کن.

### آیتم ۴۸ — «Label»ی `heroui.select` کاملاً مرده در هر سه مسیر

**مکانیزم:** `DesignerRuntimeSelect.tsx` هرگز `node.props.label` را نمی‌خواند — نه به‌عنوان متن مرئی، نه حتی fallback برای `ariaLabel`.

**فیکس:** بررسی کن کامپوننت واقعی مصرف‌شده در Canvas/Preview برای select (`UiSelect` از `HeroFieldControls.tsx`، یا معادل) اصلاً prop به نام `label` می‌پذیرد؟ اگر بله (احتمالاً بله چون سیبلینگ‌هایش مثل `UiInput` دارند)، مقدار `node.props.label` را (از طریق همان الگوی binding-aware که برای فیلدهای مشابه استفاده می‌شود — چک کن `options.previewBindings?.resolveTextProp` الگوی مرجع باشد) به آن prop پاس بده. اگر Export از قبل `label` را درست امیت می‌کند (طبق سند، ادعا نشده Export هم مرده باشد برای select — فقط چک کن)، مطمئن شو Preview/Canvas را با همان رفتار هماهنگ می‌کنی.

### آیتم ۴۹ — «Label»ی autocomplete/entity-picker در Canvas/Preview هست ولی در Export ناپدید می‌شود

**مکانیزم:** Canvas/Preview یک `<span>` جدا برای label رندر می‌کند. Export مستقیم کامپوننت خام `<Autocomplete>` را تولید می‌کند و `label` را (اگر اصلاً امیت شود) به‌صورت یک prop نامعتبر روی آن می‌گذارد که هیچ span/متنی تولید نمی‌کند (چون `AutocompleteRootProps` واقعی چنین propای ندارد).

**فیکس:** در `tsxNodeRenderer.ts` (برای autocomplete) و `tsxPhase2Palette.ts` (برای entity-picker، تابع `renderEntityPickerCustomJsx`)، به‌جای پاس‌دادن `label` به‌عنوان prop نامعتبر، یک `<span>`/`<label>` واقعی — دقیقاً با همان کلاس/ساختار HTML که Canvas/Preview تولید می‌کند — قبل از تگ `<Autocomplete>` در JSX تولیدی اضافه کن (بپیچ هردو را در یک `<div>` اگر لازم است ساختار DOM حفظ شود). مطمئن شو مقدار label می‌تواند از Binding هم بیاید (اگر bindable است) با همان الگوی `resolveBoundAttributeForNodeProp`/`renderBoundJsxTextExpression` که برای متن سایر عناصر استفاده می‌شود.

### آیتم ۵۰ — `isInvalid`/`errorMessage` روی select/entity-picker: بدون بازخورد بصری در Preview

**مکانیزم:** `DesignerRuntimeSelect.tsx` و `resolveEntityPickerProps` (`runtimeNodeProps.ts`) هرگز `isInvalid`/`errorMessage` را نمی‌خوانند/رندر نمی‌کنند. برای entity-picker، این کلیدها در Export هم exclude نشده‌اند و به‌صورت attribute خام نامعتبر نشت می‌کنند.

**فیکس:** برای select: بررسی کن آیا `triggerPreviewFieldValidation` (که طبق سند از قبل در `handleOptionClick` صدا زده می‌شود) نتیجه‌اش (`previewFieldErrors[node.id]`) جایی مصرف می‌شود برای نمایش بصری — اگر نه، یک بازخورد بصری حداقلی (مثل border قرمز/متن خطا زیر select، مطابق الگوی مشابه در سایر فیلدهای فرم) اضافه کن. برای entity-picker: هم بازخورد بصری در Preview اضافه کن، هم `errorMessage`/`pattern`/`minLength`/`maxLength`/`validationRule`/`validationErrorMessage` را از excludeKeys مسیر Export (`renderEntityPickerCustomJsx`) حذف کن تا دیگر به‌صورت خام نشت نکنند — یا این مقادیر را به‌درستی به prop واقعی نگاشت بده (اگر کامپوننت واقعی آن‌ها را می‌شناسد)، یا کاملاً از attrs pass مستثنی کن (اگر بی‌معنی‌اند برای این کامپوننت).

### آیتم ۵۱ — «Loading» دستی در select/autocomplete: بی‌اثر/ناهماهنگ

**مکانیزم:** `useDesignerOptionItems`'s مقدار `isLoading` واقعی همیشه مقدار دستی `node.props.isLoading` را در `DesignerRuntimeAutocomplete.tsx` بلافاصله override می‌کند (`isPending={isLoading}` از هوک، بعد از `resolveAutocompleteMenuProps`).

**فیکس:** این رفتار (اولویت با state واقعی fetch) در Preview احتمالاً **درست** است (چون یک fetch واقعی در حال انجام مهم‌تر از یک flag دستی است) — پس شاید نیازی به تغییر Preview نباشد. اما باید تصمیم بگیری: آیا فیلد «Loading» دستی در Inspector اصلاً معنی دارد وقتی هیچ Binding‌ای وصل نیست (یعنی فقط برای نمایش دمو در حالت استاتیک کاربرد دارد)؟ اگر بله، مطمئن شو وقتی `hasBinding===false`، مقدار دستی واقعاً اثر می‌گذارد (به نظر می‌رسد `isLoading` هوک وقتی binding نیست `false` است، پس این حالت باید کار کند — تأیید کن). فقط اگر واقعاً یک حالت متناقض پیدا کردی (Loading دستی حتی بدون binding نادیده گرفته می‌شود)، آن را رفع کن؛ در غیر این صورت این را در گزارش به‌عنوان «تأیید شد، رفتار درست است» ثبت کن نه یک فیکس اجباری.

### آیتم ۵۲ — باینـدینگ مقدار اولیه‌ی `heroui.tags-input` در Export نادیده گرفته می‌شود

**مکانیزم:** `renderTagsInputStatePreambleLines` (`tsxParityPalette.ts`) مقدار اولیه‌ی state را فقط از `readString(node.props.value)` می‌سازد؛ پارامتر `bindingContext` که دریافت می‌کند فقط برای هندلر `onChange` استفاده می‌شود، نه برای resolve کردن Binding روی خودِ `value`.

**فیکس:** در `renderTagsInputStatePreambleLines`، اگر `value` روی این نود Bind شده باشد (چک با `isNodePropBound(node.id, 'value', bindingContext)` یا معادل)، مقدار اولیه‌ی state باید از عبارت Binding واقعی (نه لیترال استاتیک) ساخته شود — با همان الگوی `resolveBoundAttributeForNodeProp`/`resolveNodePropertyBindingExpression` که در Codegen سایر عناصر برای همین منظور استفاده می‌شود.

### آیتم ۴۶ (و ۹۰) — نگاشت فیلدهای LOV در `heroui.entity-picker` هارد-کد است، بدون UI remap

**مکانیزم:** `bindingEntityPickerCodegen.ts`'s `normalizeEntityPickerItems` نام فیلدهای پاسخ API را هاردکد کرده (`record.id ?? record.value`, `record.textValue ?? record.label ?? record.name ?? id`)، برخلاف select/autocomplete/tags-input که از `bindingLovRegistry.ts`ی متمرکز و قابل‌تنظیم (`returnColumn`/`displayColumn`) استفاده می‌کنند. هیچ فیلد Inspector برای remap کردن این نام‌ها روی entity-picker وجود ندارد.

**فیکس:** یک راه‌حل کامل (افزودن دو فیلد جدید Inspector مثل `returnField`/`displayField` روی `heroui.entity-picker` که با `bindingEntityPickerCodegen.ts`'s `normalizeEntityPickerItems` و معادل Preview‌اش هماهنگ شوند) پیاده‌سازی کن — دقیقاً با الگوی `returnColumn`/`displayColumn` در `bindingLovRegistry.ts` هماهنگ کن تا از یک زیرساخت واحد (نه یک کپی جدید) استفاده شود، اگر ادغام مستقیم امکان‌پذیر است. اگر ادغام کامل با `bindingLovRegistry.ts` در بودجه‌ی این فاز نمی‌گنجد، حداقل دو فیلد Inspector ساده (با پیش‌فرض دقیقاً همان مقادیر فعلی `id`/`value` و `textValue`/`label`/`name`، برای backward-compat) اضافه کن که کاربر بتواند نام واقعی فیلدهای بک‌اندش را وارد کند، و `normalizeEntityPickerItems` (و معادل هر مسیر دیگری که همین منطق را دارد) را طوری تغییر بده که این دو فیلد را بخواند به‌جای زنجیره‌ی هاردکد.

### آیتم ۹۲ — `allowCustomValue` تزئینی

**مکانیزم:** نتیجه‌ی مستقیم معماری بالا (autocomplete = Select). نام پراپ هم اشتباه است (`allowsCustomValue` با s، فقط مختص ComboBox).

**فیکس:** اگر گزینه‌ی الف بالا (Select-based، بدون جست‌وجوی واقعی) را انتخاب کردی، این فیلد را از Inspector حذف کن (دقیقاً با الگوی حذف فیلدهای مرده‌ی دیگر در این پروژه — `deadFieldsRemovalItems19to26.test.tsx` را به‌عنوان الگوی تست ببین) چون هیچ معنایی در این معماری ندارد.

### Self-Audit ویژه‌ی این فاز
بعد از فیکس‌ها، برای هر ۴ عنصر (select/autocomplete/entity-picker/tags-input) یک بار کامل مرور کن: آیا Label/Items/Selected-Value/Validation/closeOnSelect همگی حالا در هر سه مسیر (که برای هرکدام واقعاً اعمال‌پذیر است) به‌طور یکسان کار می‌کنند؟ مطمئن شو تغییر `closeOnSelect` روی `heroui.listbox` (که در همان لیست الگوی نام‌گذاری غلط ممکن است باشد — چک کن) به‌طور جانبی خراب/فراموش نشده باشد.

---

## فاز ۵ — زیرساخت Dynamic Actions و زنجیره‌ی موفقیت فرم

**اولویت: 🔴 بحرانی.**
**وضعیت: ✅ تکمیل شد (آیتم‌های ۳۴، ۳۵، ۳۶، ۸۷، ۸۸ — ۹۱ و ۸۹ فقط گزارش/تصمیم محصولی)**

### دامنه
آیتم‌های ۳۴، ۳۵، ۳۶، ۸۷، ۸۸، ۸۹ (سند ممیزی، بخش‌های ۱۰.۱ و ۱۰.۹). آیتم ۹۱ (امنیت condition compiler) را در این فاز به‌عنوان یک **یادداشت برای تصمیم محصولی**، نه یک فیکس اجباری، بررسی و گزارش کن (رجوع به پایین).

### فایل‌های اصلی این فاز
`src/domain/component-designer/bindingDynamicActionsEngine.ts`، `src/domain/component-designer/bindingDynamicActionsCodegen.ts`، `src/domain/component-designer/bindingCodegen.ts`، `src/domain/component-designer/bindingPreviewHandlers.ts`، `src/domain/component-designer/bindingMutationRuntime.ts`، `src/domain/component-designer/bindingResourceModel.ts`، `src/features/component-designer/components/InspectorEventBindingPanel.tsx`، `src/features/component-designer/components/InspectorDynamicActionsField.tsx`.

### آیتم ۳۶ — `refreshDataSource` در Export همیشه یک fetch شبح مستقل می‌سازد

**مکانیزم:** `resolveDataSourceRefreshVar`/`resolveDynamicActionDataSourceFetch` (`bindingDynamicActionsEngine.ts`) نام متغیر رفرش را همیشه با `resolveRegionDataVarName(dataSourceRef)` می‌سازد (`refresh_regionData_<dataSourceId>`). گرید با `resolveGridListDataVarName(node.id)` نام‌گذاری می‌شود — کاملاً مستقل از `dataSourceId`. `renderDynamicActionFetchHookLines` (`bindingCodegen.ts`) فقط `regionPlan.regionFetches` را برای dedupe چک می‌کند، هرگز `gridPlan`/`chartPlan`/`vizPlan` را — یعنی یک fetch شبح کاملاً جدا و بی‌مصرف همیشه ساخته و صدا زده می‌شود، به‌جای رفرش واقعیِ گرید/چارت نمایان‌شده.

**فیکس:** در `createTsxBindingRenderContext`/محل ساخت `fetchRefreshVarByKey` (`bindingCodegen.ts`، همان جایی که برای region/grid از قبل `fetchRefreshVarByKey.set(\`region:${dataSourceId}\`, ...)` را می‌سازد — این را به‌عنوان الگوی مرجع بخوان)، مطمئن شو که **گرید‌ها، چارت‌ها، و ویجت‌های Viz** هم دقیقاً با همان کلید فضای نام (`region:${dataSourceId}` یا معادلش) در `fetchRefreshVarByKey` ثبت می‌شوند — نه فقط region. سپس در `resolveDynamicActionDataSourceFetch`، قبل از ساختن یک fetch شبح جدید، همیشه اول این نگاشت مشترک را چک کن: اگر یک گرید/ریجن/چارت/ویجت‌Viz از قبل روی همان `dataSourceId` یک fetch واقعی دارد، از `refreshVar` **همان** fetch موجود استفاده کن (dedupe واقعی)، و فقط اگر هیچ‌کدام موجود نبود، fetch شبح مستقل بساز.

### آیتم ۳۴ — ویرایش «Store Write Path» در Inspector زنجیره‌ی موفقیت ویزارد را بی‌صدا پاک می‌کند

**مکانیزم:** `commitRegionSubmit` (`InspectorEventBindingPanel.tsx`) این‌طور است:
```ts
const commitRegionSubmit = (nextStoreWritePath = storeWritePath) => {
  dispatch({ ..., definition: {
    ...createRegionSubmitEventBindingDefinition(targetEvent), // بدون آرگومان دوم!
    storeWritePath: ...,
  }});
};
```
`createRegionSubmitEventBindingDefinition(targetEvent)` بدون آرگومان دوم صدا زده می‌شود، پس `trueActions`/`invalidateQueries` همیشه `undefined` می‌شوند و کل definition (شامل زنجیره‌ی موفقیت auto-generated ویزارد فرم) با یک نسخه‌ی خالی جایگزین می‌شود — با هر بار که کاربر در فیلد Store Write Path چیزی تایپ می‌کند.

**فیکس:** `commitRegionSubmit` باید `trueActions`/`invalidateQueries` **فعلی** (از state موجود binding definition، نه از صفر) را حفظ کند. تابع را طوری تغییر بده که definition جدید را با spread کردن مقدار فعلی definition (نه ساختن از صفر با `createRegionSubmitEventBindingDefinition`) بسازد، فقط `storeWritePath` را override کند:
```ts
const commitRegionSubmit = (nextStoreWritePath = storeWritePath) => {
  dispatch({ ..., definition: {
    ...currentDefinition, // یا هرچه که متغیر معادل definition موجود در این کامپوننت است
    storeWritePath: nextStoreWritePath,
  }});
};
```
مطمئن شو `currentDefinition` واقعاً شامل `trueActions`/`invalidateQueries` فعلی است (نه یک مقدار پیش‌فرض خالی) — این را با خواندن کامل کامپوننت (نه فقط این تابع) تأیید کن.

### آیتم ۳۵ — در Preview، زنجیره‌ی موفقیت حتی روی شکست mutation هم اجرا می‌شود

**مکانیزم:** `executeDesignerMutation` (`bindingMutationRuntime.ts`) روی خطای HTTP فقط `callbacks.onError(...)` را صدا می‌زند و به‌طور عادی `return` می‌شود (بدون throw). `bindingPreviewHandlers.ts` این‌طور صدا می‌زند: `void executeDesignerFormSubmit(...).then(() => runDynamicActionsForBinding(...))` — چون Promise همیشه resolve می‌شود (حتی روی خطای HTTP)، `.then(...)` بدون قید موفقیت همیشه اجرا می‌شود. کد Export این باگ را ندارد (`renderRegionSubmitFetchLines` روی `!response.ok` واقعاً `throw` می‌کند).

**فیکس:** `executeDesignerMutation`/`executeDesignerFormSubmit`/`executeDesignerRegionSubmit` (هرکدام که مستقیماً مسئول است) باید یک مقدار بازگشتی صریح (مثلاً `{ success: boolean }` یا throw واقعی روی خطا) داشته باشند که caller در `bindingPreviewHandlers.ts` بتواند قبل از صدا زدن `runDynamicActionsForBinding` چک کند. رویکرد پیشنهادی: تابع را طوری تغییر بده که روی شکست، به‌جای فقط صدازدن `onError`، یک Promise reject/throw واقعی هم داشته باشد (مثل نسخه‌ی Export)، و `.then(...)` در `bindingPreviewHandlers.ts` را به `.then(onSuccess).catch(onFailureNoOp)` تبدیل کن — طوری که `runDynamicActionsForBinding` فقط داخل `.then` (روی موفقیت واقعی) صدا زده شود. دقت کن: چون `onError` از قبل برای نمایش toast/بنر خطا استفاده می‌شود، مطمئن شو با اضافه‌کردن throw، آن مسیر callback خطا هنوز درست کار می‌کند (شکسته نشود) — شاید نیاز باشد throw را *بعد* از صدا زدن `onError` انجام دهی، نه به‌جایش.

### آیتم ۸۸ — گزینه‌های موفقیت ویزارد (refresh/toast/reset/close) متقابلاً انحصاری‌اند

**مکانیزم:** `buildFormBindingWizardActions` (`bindingResourceModel.ts`) برای هر یک از ۴ گزینه فقط دقیقاً یک اکشن می‌سازد (`if/else if` زنجیره‌ای، نه ترکیبی). حالت `close` بدون یک overlay ancestor پیدا‌شده، `trueActions` را اصلاً تنظیم نمی‌کند (سکوت کامل).

**فیکس:** ساختار `successBehavior` را از یک مقدار تکی (`'refresh'|'toast'|'reset'|'close'`) به چند‌انتخابی تبدیل کن (اگر تغییر type مدل داده در بودجه‌ی این فاز است) یا حداقل منطق `buildFormBindingWizardActions` را طوری تغییر بده که به‌جای `if/else if`، یک آرایه‌ی `trueActions` بسازد که هرکدام از گزینه‌های فعال (اگر بیش از یکی به‌صورت آرایه انتخاب شده باشند) را به‌ترتیب منطقی (معمولاً: toast → refresh → reset/close) اضافه کند. برای حالت `close` بدون overlay، به‌جای سکوت، حداقل یک warning در کنسول توسعه (نه در UI کاربر نهایی) یا در Inspector (پیام کمکی/badge) نشان بده که «این فرم داخل هیچ مودال/overlayای نیست، گزینه‌ی Close اثر نخواهد داشت».

### آیتم ۸۷ — ویرایشگر عمومی Dynamic Actions فقط ۴ از ۶ نوع اکشن را نشان می‌دهد

**مکانیزم:** `ACTION_TYPE_OPTIONS` در `InspectorDynamicActionsField.tsx` فقط `setValue`/`showHide`/`showToast`/`callMutation` را دارد؛ `refreshDataSource`/`resetForm` غایب‌اند (`resetForm` حتی هیچ بلوک رندر فیلد هم ندارد).

**فیکس:** دو مورد را به `ACTION_TYPE_OPTIONS` اضافه کن + یک بلوک ویرایش فیلد برای هرکدام:
- `refreshDataSource`: نیاز به یک انتخاب‌گر Data Source (همان الگوی موجود در بخش «Refresh data» جدای `InspectorEventBindingPanel.tsx` را به‌عنوان مرجع کپی کن).
- `resetForm`: نیاز به یک فیلد «Target Node» (انتخاب‌گر نود Region/Form مقصد).

### یادداشت درباره‌ی آیتم ۹۱ (بدون فیکس اجباری، فقط تصمیم/گزارش)
موتور `evaluateDesignerCondition` از `new Function(...)` بدون sandbox استفاده می‌کند، و جایگزینی regex-based برای `store.`/`data.` می‌تواند رشته‌های literal حاوی این پیشوندها را به‌اشتباه rewrite کند. **این را رفع نکن** مگر این‌که کاربر صریحاً بخواهد — این یک تصمیم معماری/امنیتی بزرگ‌تر است (آیا Designer فقط برای کاربران معتمد است؟). فقط در گزارش پایانی این فاز، این یافته را به‌وضوح به کاربر گزارش بده تا خودش تصمیم بگیرد.

### Self-Audit ویژه‌ی این فاز
یک سناریوی end-to-end واقعی بساز: یک گرید bound به دیتاسورس، یک دکمه‌ی «Create» با فرم Region که بعد از موفقیت `refreshDataSource` روی همان دیتاسورس گرید را صدا می‌زند. TSX تولید کن و **دستی ردیابی کن** که آیا واقعاً همان تابع `refresh_` گرید صدا زده می‌شود، نه یک fetch شبح دیگر. همچنین یک سناریوی شکست mutation در Preview تعاملی را با `render`/`fireEvent` واقعی تست کن (mock کردن fetch برای برگرداندن ۴۰۰) و مطمئن شو دیگر toast موفقیت/بستن مودال اجرا نمی‌شود.

---

## فاز ۶ — خانواده‌ی فیلدهای فرم مشترک (html-editor/code-editor/mask-input/calculator/color-control/textarea/field-container)

**اولویت: 🔴 بحرانی (بخشی، مخصوصاً html-editor) + 🟡 متوسط (بقیه).**
**وضعیت: ✅ تکمیل شد (آیتم‌های ۳۳، ۴۱، ۴۲، ۴۳، ۴۴، ۴۵، ۶۱، ۶۲، ۶۴؛ آیتم ۶۳ فقط تصحیح مستندسازی)**

### دامنه
آیتم‌های ۳۳، ۴۱، ۴۲، ۴۳، ۴۴، ۴۵، ۶۱، ۶۲، ۶۴ (سند ممیزی، بخش‌های ۱۰.۱ و ۱۰.۳). آیتم ۶۳ فقط یک تصحیح مستندسازی است (نه کد) — در گزارش پایانی ذکر کن که `form.calculator` هیچ مفهوم فرمول/فیلد محاسباتی متصل ندارد؛ یک ورودی عددی دستی + کیبورد ماشین‌حساب است.

### فایل‌های اصلی این فاز
`src/domain/component-designer/designerFormFieldRuntime.ts`، `src/shared/ui/DesignerFormFields.tsx`، `src/shared/ui/DesignerRichTextEditor.tsx`، `src/domain/component-designer/tsxPhase2Palette.ts`، `src/domain/component-designer/runtimeRenderer.tsx` (شاخه‌ی textarea)، `src/domain/component-designer/bindingCanvasResolver.ts`، `src/domain/component-designer/previewFieldValidation.ts`.

### آیتم ۴۲ و ۶۱ — «مقدار کهنه» در اعتبارسنجی onBlur (color-control + code-editor + mask-input + calculator)

**مکانیزم:** `resolveDesignerFormFieldBaseProps` (`designerFormFieldRuntime.ts`) این‌طور است:
```ts
const canvasValue = resolveCanvasInputValue(node);
const staticValue = typeof node.props.value === 'string' ? node.props.value : undefined;
const resolvedValue = canvasValue ?? staticValue; // یک‌بار در هر رندر
...
onBlur: (event) => {
  baseOnBlur?.(event);
  triggerPreviewFieldValidation(node.id, node.props, resolvedValue ?? '', options.onPreviewFieldValidation, options.designerStore); // event نادیده گرفته می‌شود!
},
```
`resolvedValue` هرگز مقدار واقعی‌ای که کاربر همین الان در فیلد تایپ کرده را منعکس نمی‌کند (چون تایپ‌کردن در Preview تعاملی هرگز `node.props.value` را آپدیت نمی‌کند — فقط state محلی داخل کامپوننت). نتیجه: بعد از تایپ یک مقدار کاملاً معتبر و blur، سیستم دوباره خطای «الزامی است» (یا هر قانون دیگری که با مقدار خالی/کهنه نقض می‌شود) نشان می‌دهد.

**فیکس:** `onBlur` باید مقدار واقعی و زنده‌ی فیلد را در لحظه‌ی blur بخواند، نه `resolvedValue` بسته‌شده (closure) از زمان رندر. برای `color-control`/`code-editor`/`mask-input`/`calculator`، بررسی کن هرکدام چگونه مقدار فعلی‌شان را نگه می‌دارند (بیشتر این کامپوننت‌ها یک state محلی کنترل‌شده دارند که با `onChange` آپدیت می‌شود). راه‌حل مطمئن‌ترین: مقدار زنده را یا از طریق `event`ای که خودِ کامپوننت زیرین در `onBlur` واقعی‌اش پاس می‌دهد بخوان (اگر کامپوننت زیرین چنین eventای با `target.value` می‌دهد)، یا یک `ref` نگه‌دار که با هر `onChange` مقدار جاری را ذخیره کند و `onBlur` از همان `ref.current` (نه از `resolvedValue` بسته‌شده در closure رندر) بخواند. الگوی مرجع درست را از `sharedFieldEventProps` در `runtimeRenderer.tsx` (که برای `heroui.input-text`/`number-input` قبلاً درست پیاده‌سازی شده و از `event.target.value` واقعی استفاده می‌کند) کپی/تطبیق بده.

**نکته‌ی خیلی مهم:** این فیکس روی تابع مشترک `resolveDesignerFormFieldBaseProps` است — یعنی همزمان هر ۵ عنصر (color-control, code-editor, html-editor, mask-input, calculator) را تحت تأثیر قرار می‌دهد. برای `html-editor` این کافی نیست (رجوع به آیتم ۳۳ پایین — آن عنصر اصلاً `onBlur` را دریافت/مصرف نمی‌کند، مشکل عمیق‌تر است).

### آیتم ۳۳ — `form.html-editor`: بدون `name` + بدون اعتبارسنجی زنده

**مکانیزم دوگانه:**
1. **بدون اعتبارسنجی:** `DesignerRichTextEditorProps` (`DesignerRichTextEditor.tsx`) اصلاً `onBlur`/`onMouseEnter` را در type تعریف نمی‌کند و بدنه‌ی کامپوننت هرگز این دو prop را destructure/مصرف نمی‌کند — حتی اگر لایه‌ی base (`resolveDesignerFormFieldBaseProps`) آن‌ها را می‌سازد و پاس می‌دهد، در این کامپوننت مشخص گم می‌شوند.
2. **بدون `name`:** برخلاف خواهرانش (`DesignerMonacoField`, `DesignerColorEditorField`, `DesignerMaskInputField` که همگی `{name ? <input type="hidden" name={name} .../> : null}` دارند)، `DesignerRichTextEditor` اصلاً prop `name` ندارد و هیچ `<input name=.../>` رندر نمی‌کند. نتیجه: در فرم‌های Region-bound، محتوای HTML این فیلد **هرگز** در `FormData`ی submit شده گنجانده نمی‌شود — نه در Preview (`readRegionFormFieldValueFromContainer` که با `[name="..."]` جستجو می‌کند)، نه در Export (چون همان کامپوننت واقعی import می‌شود).

**فیکس:**
1. `DesignerRichTextEditorProps` را با `name?: string`, `onBlur?: (event) => void`, `onMouseEnter?: (event) => void` گسترش بده.
2. داخل کامپوننت، دقیقاً مثل `DesignerMaskInputField`/`DesignerColorEditorField`، یک `<input type="hidden" name={name} value={sanitizedHtmlValue} />` اضافه کن که همیشه با آخرین محتوای HTML sync باشد (این باید هر بار `onUpdate`ی TipTap صدا زده می‌شود آپدیت شود).
3. `onBlur`/`onMouseEnter` را به یک wrapper مناسب در DOM کامپوننت (مثلاً روی wrapper اصلی/`EditorContent`) وصل کن تا واقعاً از `resolveDesignerFormFieldBaseProps` تا کاربر برسند.
4. بعد از این تغییر، آیتم ۴۲/۶۱ (مقدار کهنه) را هم برای html-editor چک/رفع کن — چون تا این‌جا اصلاً `onBlur` اجرا نمی‌شد، اول باید مطمئن شوی حالا اجرا می‌شود، بعد چک کنی که با مقدار زنده (نه کهنه) اجرا می‌شود.

### آیتم ۴۳ و ۶۲ — نشتِ ۹-۱۰ فیلد Inspector به‌صورت attribute نامعتبر در Export

**مکانیزم:** `FORM_COLOR_EDITOR_FIELDS`/معادل‌های سایر عناصر شامل `HEROUI_INPUT_VALIDATION_FIELDS` (pattern/minLength/maxLength/validationRule/validationErrorMessage) و `HEROUI_INPUT_ADORNMENT_UX_FIELDS` (startContent/endContent/isClearable/autoFocus) + `size` هستند. توابع `render*CustomJsx` مربوطه در `tsxPhase2Palette.ts` (برای `renderColorEditorCustomJsx`, `renderCodeEditorCustomJsx`, `renderMaskInputCustomJsx`/معادل، `renderCalculatorCustomJsx`/معادل) این کلیدها را در `excludeKeys` نمی‌گذارند، و type واقعی کامپوننت‌های زیرین (`DesignerColorEditorFieldProps` و غیره) این propها را نمی‌شناسند. نتیجه: هر بار کاربر این فیلدها را در Inspector تنظیم کند، کد Export‌شده کامپایل TypeScript را می‌شکند (تأیید شد با اجرای واقعی `tsc`).

**فیکس:** برای هر یک از ۴-۵ تابع `render*CustomJsx` مربوطه (`grep -n "renderColorEditorCustomJsx\|renderCodeEditorCustomJsx\|renderMaskInputCustomJsx\|renderCalculatorCustomJsx" src/domain/component-designer/tsxPhase2Palette.ts` را اجرا کن تا نام‌های دقیق را پیدا کنی)، لیست `excludeKeys`/آرگومان دوم `renderDesignerFormFieldAttrs` را با این ۹-۱۰ کلید گسترش بده: `pattern, minLength, maxLength, validationRule, validationErrorMessage, startContent, endContent, isClearable, autoFocus, size`. بعد از این تغییر، **حتماً با اجرای واقعی `tsc --noEmit` روی TSX تولیدشده‌ی یک سند نمونه با همه‌ی این فیلدها تنظیم‌شده** تأیید کن که دیگر خطایی نیست (دقیقاً مثل روش تأیید فاز ۲).

### آیتم ۴۴ — Double-JSON-encoding مقدار پیش‌فرض `value` روی color-control در Export

**مکانیزم:** `renderDesignerFormFieldAttrs` (`tsxPhase2Palette.ts`) این خط را دارد: `...(staticValue.length > 0 && !valueBinding ? { value: toJsxString(staticValue) } : {})` — `toJsxString` = `JSON.stringify`. این مقدار از قبل JSON-رشته‌شده وارد `reservedAttributes.value` می‌شود، و بعد از مسیر عمومی `claimJsxAttribute`/`jsxAttributeStringValue` رد می‌شود که **دوباره** `JSON.stringify` می‌زند. نتیجه‌ی واقعی: `value={"\"#3B82F6\""}` — یعنی مقدار runtime واقعی literally `"#3B82F6"` (با کوتیشن‌های اضافه به‌عنوان بخشی از رشته) است، نه `#3B82F6`. حتی با پیش‌فرض کاتالوگ (بدون هیچ تنظیم دستی)، هر `color-control` صادرشده این مشکل را دارد.

**فیکس:** یکی از این دو خط را (نه هردو) حذف کن — یا `toJsxString(staticValue)` را در `renderDesignerFormFieldAttrs` حذف کن و مقدار خام `staticValue` را در `reservedAttributes.value` بگذار (تا مسیر عمومی خودش یک‌بار encode کند)، یا اگر `renderDesignerFormFieldAttrs` باید مقدار از‌پیش‌رشته‌شده تولید کند (به دلایلی که باید بررسی کنی)، مسیر عمومی attrs باید تشخیص دهد این مقدار از قبل رشته شده و دوباره encode نکند. راه‌حل ساده‌تر و کم‌ریسک‌تر معمولاً حذف `toJsxString` اضافه در `renderDesignerFormFieldAttrs` است — مقایسه کن با `heroui.input-text`'s معادل در `tsxNodeRenderer.ts` (`{ [staticValueAttrKey]: staticValue }` — بدون `toJsxString` از پیش) که این مشکل را ندارد و به‌عنوان الگوی درست عمل می‌کند.

### آیتم ۴۵ — باینـدینگ روی `label`ی `heroui.field-container` هرگز resolve نمی‌شود

**مکانیزم:** `runtimeRenderer.tsx` (حدود خط ۱۰۸۸): `const legend = readString(node.props.label, ...)` — مستقیم و استاتیک، بدون عبور از `options.previewBindings`. `tsxNodeRenderer.ts` (حدود خط ۹۵۶-۹۶۵): همان — بدون چک `isNodePropBound`.

**فیکس:** در هر دو مسیر (Preview و Export)، دقیقاً مثل الگوی موجود برای `heroui.avatar`'s فیلد `text` (که `previewTextContent(node, ..., options.previewBindings)` در Preview و `isTextBound` چک در Export دارد)، همان الگو را برای `label`ی field-container پیاده کن.

### آیتم ۴۱ — `heroui.textarea`: صفر اعتبارسنجی زنده (نه کهنه — کاملاً غایب)

**مکانیزم:** در `runtimeRenderer.tsx`، شاخه‌ی `case 'heroui.textarea'` از `resolveCanvasEventProps(node, options)` خام استفاده می‌کند (نه `sharedFieldEventProps` که سیبلینگ‌هایش `heroui.input-text`/`number-input` استفاده می‌کنند) — یعنی `onChange`/`onBlur` هرگز `triggerPreviewFieldValidation`/`onPreviewFieldValidation` را صدا نمی‌زنند.

**فیکس:** شاخه‌ی `heroui.textarea` را طوری تغییر بده که مثل `heroui.input-text`/`number-input` از `sharedFieldEventProps` (یا معادل دقیقش برای textarea) استفاده کند — با همان مکانیزم `event.target.value` زنده (نه stale) که در آن‌ها از قبل درست پیاده‌سازی شده. مطمئن شو `rows`/`maxRows`/سایر propهای خاص textarea که از قبل درست کار می‌کنند دست‌نخورده می‌مانند.

### آیتم ۶۴ — `form.calculator`: `min`/`max` فقط از طریق کیبورد «=»

**مکانیزم:** `clampCalculatorValue` (`DesignerFormFields.tsx`) فقط در `commitValue` صدا زده می‌شود که فقط از دکمه‌ی `=`/`C` کیبورد صدا زده می‌شود. `handleInputChange` (تایپ دستی) هرگز `clampCalculatorValue` را صدا نمی‌زند. ضمناً `<input type="text" min={min} max={max}>` — چون `type="text"` است، حتی attributeهای native مرورگر هم بی‌اثرند.

**فیکس:** `handleInputChange` را طوری تغییر بده که هنگام تایپ مستقیم هم (نه فقط با دکمه‌ی `=`) اگر مقدار عددی معتبری تایپ شده، `min`/`max` را چک/اعمال کند (یا حداقل هنگام blur، اگر خارج از محدوده بود clamp کند — با دقت که این با فیکس آیتم ۴۲/۶۱ (مقدار زنده در blur) هماهنگ باشد، نه در تضاد). اگر تصمیم داری `type` را به `number` تغییر دهی برای استفاده از native validation مرورگر، بررسی کن این با فرمت‌دهی/کیبورد سفارشی ماشین‌حساب (که ممکن است کاراکترهای غیرعددی موقت در حال تایپ نمایش دهد) تداخل ایجاد نمی‌کند — احتمالاً امن‌تر این است که `type="text"` بماند و clamp دستی در `handleInputChange`/`onBlur` انجام شود.

### Self-Audit ویژه‌ی این فاز
برای هر ۵ عنصر مشترک این فاز (color-control, code-editor, html-editor, mask-input, calculator) + textarea، یک probe test دستی (نوشتن، اجرا، حذف) با سناریوی «تایپ مقدار معتبر → blur» بساز و مطمئن شو **هیچ‌کدام** دیگر false-positive «الزامی است» نمی‌دهند. این دقیقاً همان الگوی probeای است که این باگ را کشف کرد — از آن به‌عنوان تست پذیرش نهایی استفاده کن.

---

## فاز ۷ — HTML Primitives + Layout + Logic

**اولویت: 🟡 متوسط-بالا.**
**وضعیت: ✅ تکمیل شد (آیتم‌های ۳۷، ۳۸، ۳۹، ۴۰)**

### دامنه
آیتم‌های ۳۷، ۳۸، ۳۹، ۴۰ (سند ممیزی، بخش ۱۰.۲).

### آیتم ۳۷ — Binding کاملاً مرده در Preview برای فیلدهای «تگ»ِ `html.form`/`html.link`/`html.iframe`/بخشی از `html.image`

**فایل:** `src/domain/component-designer/designerRuntimePreview.tsx`.

**مکانیزم:** در شاخه‌های رندر این عناصر، فیلدها مستقیماً از `node.props` خوانده می‌شوند بدون عبور از `previewBindings`:
- `html.form` (شاخه‌ی `htmlTag === 'form'`، حدود خط ۵۵۸-۵۷۹): `action`, `method`, `encType`, `target`, `autoComplete`, `noValidate`, `name`.
- `html.link` (حدود خط ۶۳۵-۶۵۴): `href`, `target`, `rel`, `download`, `referrerPolicy`.
- `html.iframe` (حدود خط ۶۸۱-۶۹۳): `src`, `title`, `width`, `height`, `allowFullScreen`.
- `html.image` (حدود خط ۶۵۶-۶۷۹): فقط `src`/`alt` درست هستند؛ `width`, `height`, `loading`, `decoding`, `srcSet`, `sizes` مستقیم از `node.props`.

Export (`tsxNodeRenderer.ts`) این فیلدها را درست از طریق `buildNodeJsxAttributesWithBindings` می‌سازد — یعنی این فقط در Preview مرده است.

**فیکس:** برای هر یک از این فیلدها، در `designerRuntimePreview.tsx`، به‌جای `typeof node.props.X === 'string' ? node.props.X : undefined`، از الگوی مشابه فیلدهایی که در همین فایل درست پیاده‌سازی شده‌اند استفاده کن (`previewBindings.resolveTextProp(node, 'X', fallback)` — دقیقاً همان متدی که برای `file-upload`'s `accept`/`multiple` قبلاً استفاده شده، طبق کامنت موجود در کد). برای فیلدهای boolean مثل `noValidate`/`allowFullScreen`، بررسی کن آیا `resolveTextProp` مقدار را به رشته تبدیل می‌کند (`"true"`/`"false"`) و در محل مصرف باید `=== 'true'` مقایسه شود — دقیقاً مثل الگوی موجود `multiple` روی `file-upload`.

### آیتم ۳۸ — `layout.split-pane`'s `direction`/`defaultSplit`: Binding کاملاً مرده در هر دو مسیر

**فایل‌ها:** `src/domain/component-designer/runtimePhase2Palette.tsx` (حدود خط ۲۹۶-۲۹۷) و `src/domain/component-designer/tsxPhase2Palette.ts` (حدود خط ۷۰۱-۷۰۲، ۷۱۷).

**فیکس:** برای Preview، از `options.previewBindings?.resolveTextProp`/`resolveNumberProp` استفاده کن (دقیقاً مثل الگوی سیبلینگ‌های سالمش `layout.aspect-ratio`/`layout.sticky`/`layout.overlay` که از `resolveUniversalPropsFromNode`'s `text()`/`number()` هلپر عبور می‌کنند — این فایل الگوی مرجع خوبی است). برای Export، فیلدها را از `excludeKeys` حذف کن و به‌جایش عبارت Binding واقعی (اگر bound است) یا لیترال استاتیک (اگر نه) را از طریق `contentBoundOrLiteral`/`boundOrDefaultValueLiteral` یا معادلش امیت کن.

### آیتم ۳۹ — `html.image`'s `fallbackSrc` بدون `onError` در بوم طراحی

**فایل:** `src/features/component-designer/canvas/canvasNodes.tsx` (شاخه‌ی `case 'image':`).

**فیکس:** یک `onError` handler اضافه کن که `resolveMediaFallbackSrc(node)` را صدا بزند و `src` تصویر را در صورت خطا عوض کند — دقیقاً همان منطقی که در `designerRuntimePreview.tsx` (خط ۶۵۶-۶۷۹) و Export از قبل درست پیاده‌سازی شده؛ کد را از آن‌جا کپی/تطبیق بده.

### آیتم ۴۰ — `logic.repeater`'s `itemAlias`/`indexAlias`: بدون اعتبارسنجی identifier

**فایل:** `src/domain/component-designer/repeaterEngine.ts`.

**فیکس:** در `resolveRepeaterNodeConfig`، بعد از `.trim()`، یک اعتبارسنجی اضافه کن که مقدار یک identifier معتبر جاوااسکریپت باشد (regex استاندارد مثل `/^[a-zA-Z_$][a-zA-Z0-9_$]*$/`، و بررسی این‌که کلمه‌ی رزرو‌شده‌ی JS نباشد — یک لیست کوتاه از کلمات رزرو‌شده‌ی رایج کافی است، نیازی به لیست کامل ES-spec نیست). اگر نامعتبر بود، به یک مقدار پیش‌فرض امن (`item`/`index`) fallback کن، **و** این محدودیت را در Inspector (متن راهنما/placeholder فیلد `itemAlias`/`indexAlias`) مستند کن. همچنین بررسی کن آیا باید یک پیام خطای Validation در `validation.ts` (کنار `pushRepeaterDiagnostics` موجود که فقط تکراری‌بودن alias را چک می‌کند) هم اضافه شود تا کاربر در خودِ Inspector هشدار ببیند، نه فقط silent fallback.

### Self-Audit ویژه‌ی این فاز
برای `html.form`/`html.link`/`html.iframe`، یک سند نمونه با هر فیلد Bind‌شده به یک مسیر Store بساز و در Preview تعاملی واقعی (`render`+`fireEvent` تغییر مقدار store) تأیید کن که DOM attribute واقعی (نه فقط prop پاس‌داده‌شده) عوض می‌شود.

---

## فاز ۸ — HeroUI General + Navigation/Overlays

**اولویت: 🟡 متوسط-بالا.**
**وضعیت: ✅ تکمیل شد (آیتم‌های ۶۵، ۶۶، ۶۷، ۶۸، ۶۹، ۹۴، ۹۵، ۹۶)**

### دامنه
آیتم‌های ۶۵، ۶۶، ۶۷، ۶۸، ۶۹، ۹۴، ۹۵، ۹۶ (سند ممیزی، بخش‌های ۱۰.۴ و ۱۰.۱۱).

### آیتم ۶۵ — `heroui.avatar`: نشتِ `fallbackSrc` در Export وقتی Bind شود

**فایل:** `src/domain/component-designer/tsxNodeRenderer.ts` (case `'heroui.avatar'`، حدود خط ۶۵۳-۶۹۸).

**مکانیزم:** حلقه‌ی دستی strip مقادیر Bound فقط `['src', 'alt', 'text']` را پاک می‌کند (خط ۶۸۶)، `fallbackSrc` را فراموش کرده — با این‌که کامنت بالای همان case ادعا می‌کند «fallbackSrc کاملاً حذف شده».

**فیکس:** `fallbackSrc` را به لیست کلیدهای strip‌شونده اضافه کن. **همچنین:** تست موجود `avatarBoundPropsExport.test.ts` (خط ۶۴-۷۶) این رفتار اشتباه را به‌اشتباه به‌عنوان رفتار درست assert کرده — این تست را هم اصلاح کن (باید بعد از فیکس، assert کند که `fallbackSrc` **دیگر** نشت نمی‌کند، نه که نشت می‌کند). جانبی: `catalog.ts` (خط ۱۱۸۹) هنوز `'heroui.avatar': ['src','alt','fallbackSrc','text']` در `PALETTE_BINDABLE_PROP_KEYS` دارد — چون این ثابت در جای دیگری از src مصرف نمی‌شود (dead code)، فقط برای پاکیزگی `fallbackSrc` را از آن حذف کن (بدون اثر رفتاری).

### آیتم ۶۶ — `heroui.typography-lead`'s فیلد Color کاملاً مرده

**فایل:** `src/domain/component-designer/tsxComponentRegistry.ts` (تعریف فعلی: `{ reactTag: 'p', importSymbols: [] }`) و `src/domain/component-designer/runtimeRenderer.tsx` (حدود خط ۶۰۷-۶۱۶).

**مکانیزم:** به یک `<p>` خام رندر می‌شود، نه کامپوننت واقعی Typography؛ `className` ثابت است و به `node.props.color` وابسته نیست. طبق `node_modules/@heroui/styles/.../typography.styles.js`، `typographyVariants.color` فقط `default`/`muted` را می‌شناسد، ولی Inspector هفت مقدار (`default/primary/secondary/success/warning/danger/accent`) ارائه می‌دهد.

**فیکس (دو گزینه، تصمیم بگیر و مستند کن):**
- گزینه‌ی الف (ساده‌تر): فیلد Color را از Inspector حذف کن — دقیقاً با الگوی حذف فیلدهای مرده‌ی دیگر (`deadFieldsRemovalItems19to26.test.tsx`).
- گزینه‌ی ب (اگر واقعاً می‌خواهی رنگ اثر داشته باشد): به‌جای `<p>` خام، از کامپوننت واقعی Typography کتابخانه استفاده کن (اگر export می‌شود) و مقدار `node.props.color` را (محدود به دو مقدار واقعی `default`/`muted`، یا نگاشت هفت‌مقداری فعلی Inspector به این دو — شبیه الگوی `resolveChipColor` که رنگ‌های غیرواقعی را به نزدیک‌ترین واقعی نگاشت می‌دهد) به آن پاس بده.
پیشنهاد: گزینه‌ی الف مگر این‌که مشخص شود کاربران واقعاً به تنوع رنگی روی این عنصر نیاز دارند.

### آیتم ۶۷ — `heroui.breadcrumbs`: `size="md"` مرده بعد از حذف فیلد

**فایل‌ها:** `src/domain/component-designer/DesignerRuntimeParityPalette.tsx` (حدود خط ۲۳۳: `size={resolveSize(node.props.size)}`) و `src/domain/component-designer/tsxParityPalette.ts` (حدود خط ۸۷-۹۲: `reservedAttributes: { size: resolveSize(node.props.size) }`).

**فیکس:** هر دو خط را حذف کن (فیلد `size` دیگر در Inspector این عنصر وجود ندارد، و کامپوننت واقعی `Breadcrumbs` هیچ variant اندازه‌ای ندارد — تأیید مجدد از `node_modules/@heroui/styles/.../breadcrumbs.styles.js`). یک تست رگرسیون مشابه الگوی `navigationOverlaysDeadFieldsAndBugs.test.ts:72-81` (که برای Dropdown همین را چک می‌کند) برای Breadcrumbs اضافه کن.

### آیتم ۶۸ — `heroui.dropdown`'s باینـدینگ Label: فقط در Export کار می‌کند

**فایل:** `src/domain/component-designer/DesignerRuntimeDropdown.tsx` (خط ۵۰: `readString(node.props.label, 'Actions')`).

**فیکس:** این خط را طوری تغییر بده که `options.previewBindings?.resolveTextProp?.(node, 'label', fallback)` را هم در نظر بگیرد — دقیقاً با الگوی مشابه که در `runtimeRenderer.tsx` برای Card/Modal/Accordion استفاده شده (خطوط ۸۷۲-۸۷۷، ۹۲۷-۹۲۹، ۹۵۰-۹۵۳ همان فایل — این‌ها را به‌عنوان الگوی مرجع بخوان). دقت کن این کامپوننت هم برای Canvas (`design` mode) هم Preview (`runtime` mode) استفاده می‌شود؛ مطمئن شو تغییر روی هردو حالت درست کار می‌کند.

### آیتم ۶۹ — `heroui.listbox`'s باینـدینگ «Selected Keys»: مرده در هر دو مسیر

**فایل‌ها:** فایلی که `DesignerRuntimeListbox`/معادلش را دارد (پیدا کن با `grep -rn "Selected Keys\|selectedKeys" src/domain/component-designer/*.tsx | grep -i listbox`) — خط حدودی ۴۶ — و مسیر Export معادل در `tsxNodeRenderer.ts` (حدود خط ۸۵۷).

**فیکس:** هر دو مسیر باید Binding واقعی را resolve کنند. برای Preview، الگوی درست `DesignerRuntimeSelect.tsx` (خط ۴۰: `options.previewBindings?.resolveSelectSelectedKeys?.(node)`) را کپی کن. برای Export، عبارت Binding واقعی (به‌جای `readString` استاتیک) را با همان الگوی سایر propهای bound این فایل امیت کن.

### آیتم ۹۴ و ۹۵ — نشتِ احتمالی Property Binding قدیمی/سراسری (اطمینان پایین — بررسی کن، فقط اگر واقعاً تکرارپذیر بود رفع کن)

**۹۴:** `heroui.button-solid`/`heroui.button-outline`: چک کن آیا `libraryPassthrough(node)` در `runtimeRenderer.tsx` (خط ۵۵۵) واقعاً بدون `excludeKeys` صدا زده می‌شود، و آیا این باعث نشت یک Binding قدیمی روی فیلد حذف‌شده‌ی `color` می‌شود. اگر بله، یک `excludeKeys`/strip مشابه سایر عناصر اضافه کن.

**۹۵:** `heroui.tooltip-trigger`: چک کن آیا `renderTooltipTriggerParityJsx` (`tsxParityPalette.ts`) حلقه‌ی bound-props را برای `ariaLabel` هم exclude می‌کند یا نه. اگر یک Binding روی `ariaLabel` می‌تواند به‌صورت خام نشت کند، آن را هم به excludeKeys اضافه کن (یا مسیر درست Binding را برایش بساز، مثل بقیه).

هردو این موارد اطمینان پایینی دارند (ممکن است در عمل بی‌اثر باشند چون کامپوننت‌های react-aria این propها را داخلی مصرف می‌کنند نه روی DOM). فقط اگر با بررسی مستقیم واقعاً یک نشت تکرارپذیر پیدا کردی، رفع کن؛ در غیر این صورت در گزارش پایانی بنویس «بررسی شد، ریسک واقعی پیدا نشد».

### آیتم ۹۶ — کد مرده: `renderEntityPickerSearchHandlerLines`

**فیکس (پاکیزگی کد، نه رفتار):** `tsxPhase2Palette.ts`'s تابع `renderEntityPickerSearchHandlerLines` (حدود خط ۷۳۷-۷۵۱) هیچ‌جا import/صدا زده نمی‌شود؛ منطق مشابهش مستقیم در `bindingCodegen.ts` (حدود خط ۲۰۳۱-۲۰۳۸) تکرار شده. یا این تابع مرده را حذف کن، یا (بهتر) محل مصرف در `bindingCodegen.ts` را طوری تغییر بده که واقعاً همین تابع مشترک را صدا بزند (حذف تکرار کد، کاهش ریسک واگرایی آینده). این تغییر باید کاملاً بدون اثر رفتاری باشد — بعد از تغییر، دقیقاً همان TSX قبلی باید تولید شود (تست‌های موجود entity-picker را اجرا کن تا تأیید شود).

### Self-Audit ویژه‌ی این فاز
بعد از فیکس آیتم ۶۵ (avatar strip list)، حتماً چک کن آیا سایر عناصری که از همان الگوی «حلقه‌ی دستی strip» استفاده می‌کنند (اگر وجود دارد) هم به‌طور مشابه یک کلید فراموش‌شده ندارند — این یک الگوی خطای تکرارشونده در این پروژه است.

---

## فاز ۹ — Universal Widgets

**اولویت: 🟡 متوسط.**
**وضعیت: ✅ تکمیل شد (آیتم‌های ۷۹، ۸۰، ۸۱، ۸۲؛ آیتم‌های ۸۳ و ۸۴ فقط گزارش/تصمیم محصولی)**

### دامنه
آیتم‌های ۷۹، ۸۰، ۸۱، ۸۲، ۸۳ (سند ممیزی، بخش ۱۰.۶). آیتم ۸۴ را **فیکس نکن** — فقط در گزارش پایانی به‌عنوان یک یادداشت برای تصمیم محصولی گزارش بده (رجوع پایین).

### فایل‌های اصلی این فاز
`src/domain/component-designer/DesignerRuntimeUniversalWidgets.tsx`، `src/domain/component-designer/designerUniversalRuntime.tsx`، `src/domain/component-designer/bindingContentEngine.ts`.

### آیتم ۷۹ و ۸۰ — `content.segmented-control`'s فیلدهای `selected` و `options` (legacy) در Canvas/Preview مرده‌اند

**مکانیزم:** `DesignerRuntimeUniversalWidgets.tsx` خط ۸۶۴-۸۶۵ (تقریبی):
```ts
options: readString(node.props.options),
selected: readString(node.props.selected, items[0]?.label ?? 'Week'),
```
این دو خط از هلپر مشترک `text()` (که `previewBindings.resolveTextProp` را صدا می‌زند و بقیه‌ی فیلدهای این کامپوننت از آن عبور می‌کنند) استفاده نمی‌کنند — مستقیم `readString(node.props.X)` خام.

**فیکس:** این دو خط را طوری تغییر بده که از همان هلپر `text()` (که در بالای همان تابع تعریف شده و به بقیه‌ی فیلدهای این resolveUniversalPropsFromNode پاس داده می‌شود) عبور کنند: `options: text('options', ''), selected: text('selected', items[0]?.label ?? 'Week')`. **دقت کن:** فیلد `selected` باید همچنان به‌درستی با override دور دوم Dual-Mode (`optionsOverride` که در فاز رفع‌شده‌ی قبلی این پروژه اضافه شد) هماهنگ بماند — بعد از این تغییر، هم Property-Binding عمومی هم Dual-Mode باید همزمان درست کار کنند؛ هر دو سناریو را جدا تست کن.

### آیتم ۸۱ — `logic.visibility-container`'s فیلد `visibleCondition` هم bindable است ولی در Canvas/Preview مرده

**فایل:** همان `DesignerRuntimeUniversalWidgets.tsx`، حدود خط ۸۶۹: `visibleCondition: readString(node.props.visibleCondition)`.

**فیکس:** همان الگو — از `text()` عبور بده. **توجه ویژه:** این فیلد از یک نوع خاص است (یک رشته‌ی عبارت شرطی، نه یک متن نمایشی معمولی) — بعد از افزودن قابلیت Binding، مطمئن شو اگر کاربر این فیلد را Bind کند، خروجی نهایی هنوز یک رشته‌ی عبارت شرطی معتبر است که `evaluateDesignerCondition` می‌تواند parse کند (نه یک مقدار دلخواه دیگر). این یک سناریوی لبه‌ای/نامتعارف است — اولویتش از ۷۹/۸۰ پایین‌تر است.

### آیتم ۸۲ — ناهماهنگی اولویت انتخاب برچسب CSV بین Preview و Export در حالت Dual-Mode

**فایل‌ها:** `src/domain/component-designer/bindingContentEngine.ts` — `resolveContentCsvLabelFromRow`/`pickContentScalarField` (Preview، اولویت مؤثر: `label → name → title → heading → id`) در برابر `resolveContentCsvExpression` (Export، اولویت: `label → title → name → id`، بدون `heading` اصلاً).

**فیکس:** یکی از این دو را با دیگری هماهنگ کن — پیشنهاد: عبارت رشته‌ای در `resolveContentCsvExpression` (که در Export امبد می‌شود) را طوری بازنویسی کن که دقیقاً همان ترتیب اولویت (`label → name → title → heading → id`) را داشته باشد، تا با Preview یکسان شود (تغییر دادن Export برای match کردن Preview، نه برعکس، چون Preview منطق کامل‌تری با `heading` دارد). این عبارت به‌صورت رشته‌ی template literal امبدشده در کد Export است — دقت کن سینتکس آن را نشکنی.

### یادداشت آیتم ۸۳ (بدون فیکس، فقط تأیید/گزارش)
`content.icon`'s فیلد `size` هرگز از داده‌ی API در Dual-Mode پر نمی‌شود — این در **هر دو** مسیر یکسان است (نه یک واگرایی). این احتمالاً عمدی است (اندازه‌ی آیکون معمولاً از API معنی ندارد). **فیکس نکن**، فقط در گزارش پایانی این را به‌عنوان یک یادداشت برای تصمیم محصولی ذکر کن.

### یادداشت آیتم ۸۴ (بدون فیکس، فقط تصمیم محصولی)
هیچ‌کدام از ۱۶ ویجت Dual-Mode در بوم طراحی (Canvas) داده‌ی زنده‌ی API نمایش نمی‌دهند (برخلاف Grid/Viz که Hydration زنده گرفتند). این یک تصمیم بزرگ‌تر معماری/محصول است (آیا ارزش پیاده‌سازی زیرساخت hydration مشابه Grid/Viz برای این ۱۶ ویجت هم هست؟). **این فاز را درگیرش نکن** — فقط در گزارش پایانی به‌وضوح مطرح کن که این یک شکاف شناخته‌شده و آگاهانه است، نه یک باگ رفع‌نشده.

### Self-Audit ویژه‌ی این فاز
بعد از فیکس ۷۹/۸۰/۸۱، تست‌های موجود `universalWidgetsPreviewBindingFix.test.tsx` (که رفع سیستمی قبلی را پوشش می‌دهد) را اجرا کن — باید هنوز سبز باشند؛ سپس تست‌های جدید مخصوص `selected`/`options`/`visibleCondition` را اضافه کن.

---

## فاز ۱۰ — Data Viz/Charts: باقیمانده + تأیید مستقل مورد «۰ب»

**اولویت: 🟡 متوسط (آیتم تری) + بازبینی حیاتی مستندسازی (مورد ۰ب).**
**وضعیت: ✅ تکمیل شد (آیتم ۹۹؛ مورد ۰ب تأیید شد که قبلاً کار می‌کرده)**

### دامنه
- آیتم ۹۹ (بدون شماره در سند اصلی — بخش ۱۰.۷.۲، «واگرایی Tree Export/Preview در ردیف‌های ناقص»).
- وظیفه‌ی تأیید مستقل: بخش ۱۰.۷.۳ سند ممیزی («تصحیح مهم به مورد ۰ب»).

**⚠️ همپوشانی فایل با فاز ۱:** این فاز هم `bindingApiCodegen.ts` را لمس می‌کند (تابع دیگری — `transformApiRowsToTreeNodes` نسخه‌ی inline‌شده — نه `resolveBindingUrl`). ریسک تداخل کم است چون توابع کاملاً جدا هستند، ولی برای احتیاط، این فاز را بعد از فاز ۱ اجرا کن.

### آیتم ۹۹ — واگرایی Tree Export/Preview در ردیف‌های ناقص (idField خالی)

**مکانیزم:** `visualizationDataTransform.ts` (نسخه‌ی canonical، مسیر Preview/Canvas) این گارد را دارد:
```ts
for (const row of rows) {
  const id = readStringField(row, mapping.idField);
  if (!id) { continue; } // ردیف با idField خالی/نامعتبر کاملاً حذف می‌شود
  nodeMap.set(id, {...});
}
```
`bindingApiCodegen.ts` (نسخه‌ی inline‌شده‌ی Export)، تابع `transformApiRowsToTreeNodes`، این گارد را ندارد:
```ts
rows.forEach((row, index) => {
  const id = readVizStringField(row, mapping.idField, `node-${index + 1}`);
  nodeMap.set(id, { id, label: ..., children: [] }); // بدون فیلتر روی id خالی
});
```
فقط برای `viz.tree-view`/`tree-select`/`cascader`/`tree-combobox` با `parentIdField` تنظیم‌شده و کیفیت داده‌ی نامناسب (idField خالی در پاسخ API واقعی) رخ می‌دهد؛ ردیف‌های ناقص می‌توانند روی کلید `id=""` با هم تصادم کنند.

**فیکس:** در `bindingApiCodegen.ts`'s نسخه‌ی inline‌شده‌ی `transformApiRowsToTreeNodes` (رشته‌ی متنی امبدشده، دقت مشابه فاز ۱ در ویرایش)، همان گارد `if (!id) continue/return` را قبل از `nodeMap.set` اضافه کن — دقیقاً هم‌ارز با نسخه‌ی canonical. توجه: نسخه‌ی Export فعلاً یک fallback `node-${index+1}` برای idField خالی تولید می‌کند (برخلاف canonical که کلاً حذف می‌کند) — این فرق رفتاری عمدی-به‌نظر می‌رسد برای حالت flat (بدون parentIdField)؛ فقط برای حالت **hierarchical** (parentIdField تنظیم‌شده) باید رفتار حذف‌کامل canonical را کپی کنی، نه برای حالت flat.

### وظیفه‌ی تأیید مستقل — مورد «۰ب» (رفرش دیتا در صفحه‌ی Preview مجزا)

سند ممیزی (`20-DESIGNER-ELEMENT-PARITY-AUDIT.md`، بخش‌های ۰ (بخش ب) و ۷ب) ادعا می‌کند صفحه‌ی Preview مجزا (`ComponentDesignerOutlinePreviewPage.tsx`) رفرش دیتا/فیلتر ندارد و عمداً «deferred» نگه داشته شده — نیاز به هماهنگی بک‌اند. اما یک بررسی مستقل بعدی (بخش ۱۰.۷.۳ همان سند) با نوشتن و اجرای یک probe test واقعی (mock کردن `fetch`، رندر `DesignerDocumentPreview`، شبیه‌سازی تایپ در جعبه‌ی جستجو) شواهد قوی پیدا کرد که این مکانیزم (`hydrationData`/`refreshDataSource` داخل خودِ `designerRuntimePreview.tsx`) از قبل به‌درستی کار می‌کند — و ادعای قبلی «deferred» ظاهراً بر اساس جست‌وجوی ناقص (فقط `src/features/component-designer/`، نه `src/domain/component-designer/`) نوشته شده بوده.

**وظیفه‌ی تو در این فاز:**
1. این ادعا را **خودت مستقل، از صفر** بررسی کن — به سند اعتماد نکن (نه ادعای اول «deferred»، نه ادعای دوم «احتمالاً کار می‌کند»). کد فعلی `designerRuntimePreview.tsx` (حدود خط ۹۸۳-۹۸۹ و ۱۲۲۴-۱۳۴۲ و ۱۴۴۶ طبق آخرین بررسی — شماره‌خط‌ها را با کد فعلی تطبیق بده) را کامل بخوان.
2. یک تست **دائمی** (نه probe موقت) بنویس که یک `viz.tree-view` یا `heroui.app-table-grid` را به یک دیتاسورس واقعی Bind می‌کند، toolbar جستجو را فعال می‌کند، `DesignerDocumentPreview`/`renderDesignerDocumentPreview` را با `interactive: true` رندر می‌کند، `fetch` سراسری را mock می‌کند، و با `fireEvent` تایپ در جستجو را شبیه‌سازی می‌کند — و assert می‌کند که یک فچ **دوم** با query param درست واقعاً ارسال می‌شود.
3. اگر این تست موفق شد (یعنی ادعای «قبلاً کار می‌کند» تأیید شد): سند ممیزی را در بخش‌های مربوطه (خلاصه‌ی اجرایی ردیف ۰، بخش ۷ب «وضعیت رفع»، بخش ۱۰.۷.۳) به‌روزرسانی کن تا این بخش را از «deferred/خراب» به «رفع شد ✅ (تأیید شد که قبلاً کار می‌کرده، تست دائمی اضافه شد)» تغییر دهد.
4. اگر این تست شکست خورد (یعنی ادعای اول درست بود): سند را دست‌نخورده نگه‌دار (همچنان deferred)، ولی حالا حداقل یک تست دائمی داری که این وضعیت شناخته‌شده را قفل می‌کند (`it.skip` یا `it.todo` با توضیح چرا، اگر واقعاً نمی‌خواهی این را در این فاز رفع کنی چون به هماهنگی بک‌اند نیاز دارد).
5. **مهم:** یادت باشد این آیتم مستقل از فاز ۱ (باگ `resolveBindingUrl`) است — چون مسیر Preview از `resolveHydrationTargetUrl` استفاده می‌کند نه `resolveBindingUrl`. پس نتیجه‌ی این تست نباید به این بستگی داشته باشد که فاز ۱ اجرا شده یا نه؛ اگر تست این فاز شکست خورد ولی مشکوک شدی که واقعاً به خاطر باگ فاز ۱ است، این را در گزارش صریحاً بنویس تا بررسی مجدد شود (اما بعید است، چون مسیرها جدا هستند).

### Self-Audit ویژه‌ی این فاز
برای آیتم ۹۹، یک ردیف واقعی با `idField` خالی در یک دیتاسورس تست بساز و هم نسخه‌ی canonical هم نسخه‌ی Export را (با اجرای واقعی، مثل الگوی `vizGanttProgressFieldExportFix.test.ts`) روی همان ردیف‌ها اجرا کن و مطمئن شو حالا رفتار یکسانی برای حالت hierarchical دارند.

---

## فاز ۱۱ — دسته‌های پویا: Shell Chrome در تب اصلی Preview دیزاینر

**اولویت: 🟠 بالا.**
**وضعیت: ✅ تکمیل شد (آیتم‌های ۸۵، ۸۶)**

### دامنه
آیتم‌های ۸۵، ۸۶ (سند ممیزی، بخش ۱۰.۸).

### آیتم ۸۵ — فیلدهای هدر شل هنوز در تب اصلی Preview دیزاینر مرده‌اند (سومین پیاده‌سازی مستقل و فراموش‌شده)

**مکانیزم:** این پروژه **سه** پیاده‌سازی کاملاً مستقل و کپی‌شده از منطق «ساخت chromeSlots» دارد:
1. `src/features/component-designer/components/DesignerPreviewPortalShell.tsx` — درست (خط ۷۲-۷۶: `extractShellHeaderConfigFromDocument(preparedDocument)` را صدا می‌زند).
2. `src/app/platform/DesignerPublishedShell.tsx` — درست (خط ۱۱۶-۱۲۰: همین‌طور صدا می‌زند).
3. `src/features/component-designer/lib/designerShellRuntimeSlots.tsx` (هوک `useDesignerShellRuntimeSlots`) — **خراب**: خط ۴۰ (تقریبی): `const headerSlot = React.useMemo(() => <ShellHeaderChromeSlot />, []);` — بدون `config`! این فایل هرگز `extractShellHeaderConfigFromDocument`/`resolveShellHeaderConfigFromProps` را import نمی‌کند (تأیید با `grep`)، درحالی‌که چند خط بالاتر همان فایل، لوگو را درست resolve می‌کند (`logoConfig = extractShellLogoConfigFromDocument(document)`).

این هوک فقط توسط `src/features/component-designer/components/DesignerPreviewViewport.tsx` استفاده می‌شود که خودِ تب اصلی «Preview» دیزاینر را می‌سازد (تأیید در `ComponentDesignerOutlinePreviewPage.tsx`). سناریوی رایج: کاربر سند Shell Layout را ویرایش می‌کند، `showBreadcrumb=false` تنظیم می‌کند، روی Preview کلیک می‌کند — breadcrumb همچنان نمایش داده می‌شود.

**فیکس:**
1. در `designerShellRuntimeSlots.tsx`، import کن `extractShellHeaderConfigFromDocument` (از همان مسیری که `DesignerPreviewPortalShell.tsx`/`DesignerPublishedShell.tsx` استفاده می‌کنند).
2. خط `headerSlot` را طوری تغییر بده که `config={extractShellHeaderConfigFromDocument(document)}` را پاس بدهد — دقیقاً مثل `logoSlot` که چند خط بالاتر همین کار را برای لوگو انجام می‌دهد.
3. **بهبود ساختاری قوی (پیشنهادی، اگر بودجه‌ی فاز اجازه می‌دهد):** چون این کلاس باگ («سه پیاده‌سازی مستقل، رفع نیمه‌کاره») علت ریشه‌ای مستند‌شده در سند است، در نظر بگیر یک تابع مشترک واحد (مثلاً `buildShellChromeSlotsFromDocument(document)`) بسازی که هر سه فایل از آن استفاده کنند — این ریسک بازگشت این کلاس باگ را در آینده حذف می‌کند. اگر وقت این فاز کافی نیست، حداقل فیکس نقطه‌ای (قدم ۱-۲ بالا) را انجام بده و این پیشنهاد ساختاری را در گزارش پایانی برای تصمیم بعدی ثبت کن.

### آیتم ۸۶ — نشتِ attribute در Export برای Logo/Nav-Region

**فایل:** `src/domain/component-designer/tsxPlatformPalette.ts`.

**مکانیزم:** `excludeKeys` فقط کلیدهای هدر (`showLogo`/`showBreadcrumb`/`showActions`) را پوشش می‌دهد. اسلات لوگو (`logoSrc`/`logoAlt`/`logoHref` — طبق `src/shared/lib/shellLogoProps.ts`) و اسلات‌های ناوبری (`navigationRef` — طبق `src/shared/lib/shellNavSlotProps.ts`) در این لیست نیستند — نشت می‌کنند به‌صورت attribute مسطح تکراری روی `<DesignerSlotPreview>` (علاوه بر حضور صحیح‌شان در `slotProps`). اثر صرفاً cosmetic/HTML نامعتبر است (نمایش بصری درست می‌ماند)، نه شکست عملکردی.

**فیکس:** `excludeKeys` را با این ۴ کلید هم گسترش بده: `logoSrc, logoAlt, logoHref, navigationRef`.

### Self-Audit ویژه‌ی این فاز
بعد از فیکس آیتم ۸۵، هر سه پیاده‌سازی (`DesignerPreviewPortalShell.tsx`, `DesignerPublishedShell.tsx`, `designerShellRuntimeSlots.tsx`) را کنار هم بگذار و مقایسه کن که حالا واقعاً یکسان رفتار می‌کنند (نه فقط این‌که هرکدام جدا تست شده). یک تست end-to-end با `render`ی `DesignerPreviewViewport` (یا نزدیک‌ترین نقطه‌ی ورودی قابل‌تست) با `showBreadcrumb=false` بنویس و assert کن breadcrumb واقعاً در DOM غایب است.

---

## فاز ۱۲ — خانواده‌ی Checkbox/Radio/Switch/Slider/Date-Picker/Date-Range

**اولویت: 🟡 متوسط.**
**وضعیت: ✅ تکمیل شد (آیتم‌های ۵۳، ۵۴، ۵۵، ۵۶، ۵۷، ۵۸، ۵۹، ۶۰، ۹۳)**

### دامنه
آیتم‌های ۵۳، ۵۴، ۵۵، ۵۶، ۵۷، ۵۸، ۵۹، ۶۰، ۹۳ (سند ممیزی، بخش‌های ۱۰.۳ و ۱۰.۱۱).

### فایل‌های اصلی این فاز
`src/domain/component-designer/DesignerRuntimeParityPalette.tsx`، `src/domain/component-designer/runtimePhase2Palette.tsx` (date-range)، `src/domain/component-designer/runtimeNodeProps.ts`، `src/domain/component-designer/propRegistry.ts`، `src/domain/component-designer/tsxParityPalette.ts`، `src/domain/component-designer/tsxPhase2Palette.ts`، `src/domain/component-designer/inspectorPaletteFields.ts`.

### آیتم ۵۳ — `heroui.checkbox-group`/`heroui.radio-group`'s `size`/`color`: مرده در هر سه مسیر

**مکانیزم:** طبق `node_modules/@heroui/styles/.../checkbox.styles.ts`/`checkbox-group.styles.ts`/`radio.styles.ts`/`radio-group.styles.ts`، فقط `variant: primary/secondary` برای گروه‌ها وجود دارد؛ هیچ‌کدام `size` ندارند و Radio تکی هیچ variantی ندارد. `DesignerRuntimeParityPalette.tsx` (حدود خط ۴۰۹) صراحتاً `size={resolveSize(node.props.size)}` پاس می‌دهد؛ `color` هم exclude نشده و خام نشت می‌کند.

**فیکس:** دقیقاً با الگوی حذف فیلدهای مشابه (Button Color, Link Size+Color, Listbox Size — `deadFieldsRemovalItems19to26.test.tsx` را الگو بگیر): فیلدهای `size`/`color` را از Inspector این دو عنصر حذف کن، پاس‌دادن `size` را از `DesignerRuntimeParityPalette.tsx` حذف کن، و مطمئن شو `color` هرگز به‌صورت خام نشت نمی‌کند (excludeKeys در Export).

### آیتم ۵۴ و ۵۵ — `heroui.slider`'s `min`/`max`/`size`: مرده در هر سه مسیر

**مکانیزم:** نام واقعی prop در `react-stately` (`RangeInputBase`) `minValue`/`maxValue` است، نه `min`/`max`. `propRegistry.ts`'s `JSX_ATTRIBUTE_NAME_OVERRIDES` این دو را ندارد. `size` هم چون Slider واقعی (`slider.styles.ts`) هیچ `variants` ندارد (فقط `slots`)، همیشه بی‌اثر است.

**فیکس برای min/max:** در `propRegistry.ts`، به `JSX_ATTRIBUTE_NAME_OVERRIDES` دو نگاشت اضافه کن: `min → minValue`, `max → maxValue` (مخصوص `heroui.slider`؛ دقت کن این نگاشت را global نکنی چون `min`/`max` روی `heroui.number-input` معنای متفاوتی دارند و باید دست‌نخورده بمانند — این نگاشت باید scoped به عنصر یا نوع کامپوننت باشد، نه یک نگاشت سراسری نام). این فیکس باید در هر سه مسیر (Canvas/Preview از طریق `runtimeNodeProps.ts` یا معادل، و Export از طریق `tsxNodeRenderer.ts`) به‌طور یکسان اعمال شود — یعنی محل واقعی که این نگاشت را می‌خواند را پیدا کن (`grep -rn "JSX_ATTRIBUTE_NAME_OVERRIDES" src/domain/component-designer/`) و مطمئن شو همه‌ی مصرف‌کننده‌ها از یک منبع واحد می‌خوانند.

**فیکس برای size:** فیلد را از Inspector حذف کن (الگوی استاندارد حذف فیلد مرده).

### آیتم ۵۶ — `heroui.slider`'s `value`: تناقض controlled/uncontrolled در Canvas/Preview

**فایل:** `src/domain/component-designer/runtimeRenderer.tsx` (خط ۵۵۵: `passthrough = libraryPassthrough(node)` بدون excludeKeys، بعد اسپرد قبل از `defaultValue={initialValue}` در JSX اسلایدر خط ۴۱۷-۴۶۰).

**مکانیزم:** وقتی کاربر مقدار «Value» را در Inspector تنظیم کند، `passthrough` شامل `value` خام است که **هم‌زمان** با `defaultValue` پاس داده می‌شود — طبق منطق `useControlledState` در `react-stately`، حضور `value !== undefined` اسلایدر را کاملاً controlled می‌کند و مقدار همیشه به همان عدد ثابت قفل می‌ماند (thumb بعد از هر درگ فوراً برمی‌گردد).

**فیکس:** `value` را از `passthrough`/`libraryPassthrough(node)` مستثنی کن (excludeKeys) قبل از اسپرد کردن در JSX اسلایدر — دقیقاً مثل چیزی که Export از قبل درست انجام می‌دهد (`tsxNodeRenderer.ts` خط ۷۳۶-۷۴۳ که `value` را exclude می‌کند و فقط `defaultValue` تولید می‌کند). فقط `defaultValue={initialValue}` باید باقی بماند، هرگز هم‌زمان `value` هم پاس داده نشود.

**تأیید تجربی توصیه‌شده:** بعد از فیکس، یک تست UI واقعی بنویس که اسلایدر را با `fireEvent`ی درگ/تغییر مقدار شبیه‌سازی می‌کند و مطمئن می‌شود مقدار نمایشی بعد از تعامل کاربر واقعاً تغییر می‌کند (نه به مقدار اولیه برمی‌گردد).

### آیتم ۵۷، ۵۸، ۵۹، ۶۰ — `form.date-range`: مجموعه مشکلات

**فایل:** `src/domain/component-designer/runtimePhase2Palette.tsx` (رندر) و `src/domain/component-designer/runtimeNodeProps.ts` (تابع `resolveDateRangeProps`) و `src/domain/component-designer/inspectorPaletteFields.ts` (`FORM_DATE_RANGE_FIELDS`).

**۵۷ — بدون اعتبارسنجی زنده و بدون فیلد اعتبارسنجی:** `renderDateRangeLeafNode` هرگز `resolveDesignerFormFieldBaseProps`/`triggerPreviewFieldValidation` را صدا نمی‌زند؛ `FORM_DATE_RANGE_FIELDS` هیچ‌کدام از `isRequired`/`errorMessage`/... را ندارد.

**فیکس:** به `FORM_DATE_RANGE_FIELDS` حداقل `isRequired` اضافه کن (احتمالاً هم‌راستا با `heroui.date-picker`'s معادل، اما دامنه را به همین حداقل محدود نگه‌دار مگر بخواهی کل ست اعتبارسنجی را هم اضافه کنی — رجوع به ۶۰ پایین). در `renderDateRangeLeafNode`، فراخوانی اعتبارسنجی زنده (`onBlur`) را دقیقاً با الگوی سایر فیلدهای فرم (مثلاً `entity-picker`'s `triggerPreviewFieldValidation` در `onSelectionChange`، یا الگوی `resolveDesignerFormFieldBaseProps` اگر برای date-range هم قابل‌استفاده است) اضافه کن.

**۵۸ — بدون اعتبارسنجی end ≥ start:** یک چک اضافه کن (در همان مسیر اعتبارسنجی که در ۵۷ اضافه کردی، یا در `validation.ts` اگر منطقی‌تر است) که اگر `endValue < startValue` باشد یک پیام خطا («تاریخ پایان باید بعد یا مساوی تاریخ شروع باشد» یا مشابه) نشان دهد — هم در Preview هم به‌عنوان یک قانون validation قابل export (اگر معماری validation کنونی اجازه می‌دهد قوانین cross-field تعریف شوند؛ اگر معماری فعلی فقط per-field است، این ممکن است نیاز به کمی گسترش زیرساخت validation داشته باشد — دامنه‌اش را واقع‌بینانه در بودجه‌ی این فاز نگه‌دار؛ حداقل قابل‌قبول: چک را در خودِ کامپوننت date-range به‌عنوان یک قانون داخلی پیاده کن، نه لزوماً یکپارچه با موتور عمومی validation).

**۵۹ — باینـدینگ `startValue`/`endValue` در Preview مرده (Export درست است):** `resolveDateRangeProps(node)` فقط `node` می‌گیرد، هرگز `options`/`options.previewBindings` را دریافت نمی‌کند.

**فیکس:** امضای `resolveDateRangeProps` را به `resolveDateRangeProps(node, options)` تغییر بده، و مقدار `startValue`/`endValue` را با همان الگوی `previewBindings.resolveTextProp` بساز — دقیقاً مثل الگوی رفع‌شده‌ی مشابه برای `heroui.card`/`heroui.accordion-item` (کامنت مرجع در `designerPreviewResolvers.ts` خط ۳۶۵-۳۷۰). مطمئن شو محل صدازدن `resolveDateRangeProps` در `runtimePhase2Palette.tsx` هم آپدیت شود تا `options` را پاس بدهد.

**۶۰ — فیلدهای `minValue`/`maxValue`/`granularity`/`isReadOnly` اصلاً در Inspector نیستند (فقدان قابلیت، نه باگ):** این‌ها در کتابخانه واقعاً پشتیبانی می‌شوند (چون `DateRangePicker` هم از همان `DateRangePickerStateOptions` مشتق شده). به `FORM_DATE_RANGE_FIELDS` اضافه کن، دقیقاً با همان الگوی این ۴ فیلد روی `heroui.date-picker` (`resolveDesignerDatePickerFieldProps` را به‌عنوان الگوی مرجع بخوان) — نام prop، نوع فیلد Inspector، و نحوه‌ی رندر را کپی/تطبیق بده برای date-range.

### آیتم ۹۳ — `heroui.switch`: فیلد Size اضافه کن (اختیاری، قابلیت جدید نه باگ)

**این آیتم اختیاری است.** کامپوننت واقعی `Switch` واریانت `size: sm/md/lg` دارد ولی در Inspector این عنصر expose نشده. اگر وقت این فاز اجازه می‌دهد، یک فیلد Size ساده (با گزینه‌های `sm/md/lg`) به Inspector اضافه کن و در هر سه مسیر (Canvas/Preview/Export) به prop واقعی `size` روی Switch پاس بده. اگر وقت کافی نیست، این را رد کن و در گزارش پایانی به‌عنوان «یک قابلیت اختیاری که رفع نشد، فرصت آینده» ذکر کن — این یک باگ نیست، اولویتش پایین است.

### Self-Audit ویژه‌ی این فاز
برای `form.date-range`، تست‌های موجود `dateRangeValueBindingFix.test.tsx` را اجرا کن و مطمئن شو با تغییرات این فاز (خصوصاً آیتم ۵۹) هنوز سبزند و پوشش تست را برای سناریوی «Preview تعاملی با رکورد بارگذاری‌شده» (که طبق سند قبلاً پوشش نداشت) گسترش بده.

---

## فاز ۱۳ — تأیید نهایی سراسری و صدور گواهی آمادگی Production

**این فاز را فقط بعد از اتمام و تأیید موفق تمام فازهای ۱ تا ۱۲ اجرا کن.**
**وضعیت: ✅ تکمیل شد (تأیید سراسری + گواهی Production در بخش ۱۱ سند ممیزی؛ یافته‌ی جانبی: تقویت اولویت refresh گرید روی Region در مورد ۳۶)**

### هدف
یک تأیید کامل و مستقل، سراسر کل پروژه‌ی Component Designer، که ثابت کند: (الف) همه‌ی ۷۲ آیتم این نقشه واقعاً و به‌طور کامل رفع شده‌اند، (ب) هیچ رگرسیونی — نه از تک‌تک فازها، نه از تعامل فازها با هم — باقی نمانده، (پ) سیستم واقعاً آماده‌ی Production است.

### قدم‌های اجباری

**۱. تایپ‌چک کامل:**
```
npx tsc --noEmit -p .
```
باید صفر خطا بدهد.

**۲. اجرای کامل سوییت (دو بار، برای اطمینان از عدم flakiness):**
```
npx vitest run src/domain/component-designer --pool=forks --no-file-parallelism
```
نتیجه را با آخرین baseline شناخته‌شده (که هر فاز باید در گزارش پایانی‌اش ثبت کرده باشد) مقایسه کن. اگر هرکدام از ۱۳ فاز یک تست ناموفقِ preexisting را در گزارشش ذکر کرده، اینجا دوباره بررسی کن که آیا هنوز preexisting/بی‌ربط است یا این‌که یکی از فازها ناخواسته آن را درست کرده (که خبر خوبی است، فقط مستندش کن) یا بدتر کرده (که باید ریشه‌یابی و رفع شود).

**۳. اجرای کامل سوییت `src/features/component-designer` هم (اگر تست‌هایی آن‌جا هست که این فازها لمس کرده‌اند — مثلاً Inspector UI):**
```
npx vitest run src/features/component-designer --pool=forks --no-file-parallelism
```

**۴. Cross-Phase Integration Check (بسیار مهم — تک‌تک فازها را جدا تست کردند، این‌جا باید تعامل‌شان را تست کنی):**
یک سند طراحی «آزمایشی جامع» بساز که تا حد امکان از عناصر و سناریوهای هر ۱۳ فاز همزمان استفاده کند: یک صفحه با یک `heroui.app-table-grid` کامل (toolbar+sort+pagination+rich cells+row actions، از فاز ۳)، یک `viz.chart-bar` و یک `viz.tree-view` bound به API واقعی با toolbar (فاز ۱+۱۰)، یک فرم Create/Edit با `heroui.input-text`/`heroui.select`/`heroui.date-picker`/`form.html-editor`/`heroui.tags-input` (فازهای ۲، ۴، ۶، ۱۲) که بعد از submit موفق گرید را رفرش می‌کند (فاز ۵)، یک `content.segmented-control` Dual-Mode (فاز ۹)، و یک اسلات هدر Shell با `showBreadcrumb=false` (فاز ۱۱). `generateDesignerTsx` را روی این سند اجرا کن و:
   - کل خروجی TSX را واقعاً با `tsc --noEmit` تایپ‌چک کن (نه فقط پروژه‌ی اصلی — خودِ فایل تولیدشده را جدا هم چک کن، دقیقاً مثل روش تأیید فاز ۲).
   - رندر Preview تعاملی همین سند را با `render`/`fireEvent` واقعی امتحان کن: جستجو در toolbar گرید، تغییر صفحه، submit فرم، رفرش گرید بعد از submit — همه باید واقعاً کار کنند.

**۵. بازبینی git diff کامل:**
```
git status
git diff --stat
```
مطمئن شو: (الف) هیچ فایل probe/موقت باقی نمانده، (ب) فهرست فایل‌های تغییریافته منطقی و قابل‌توضیح است (هر فایل باید به حداقل یکی از ۷۲ آیتم مرتبط باشد — اگر فایلی تغییر کرده که نمی‌دانی چرا، بررسی کن).

**۶. به‌روزرسانی نهایی سند ممیزی:**
در `docs/refactor-spec/20-DESIGNER-ELEMENT-PARITY-AUDIT.md`:
- بخش ۹ (جمع‌بندی نهایی دور اول) و بخش ۱۰.۱۰ (جمع‌بندی دور دوم) را به‌روزرسانی کن تا صریحاً بگوید «همه‌ی ۷۲ آیتم دور دوم (به‌علاوه‌ی ۲۸ آیتم دور اول) رفع و با تأیید سراسری کامل شدند».
- یک بخش جدید «۱۱. گواهی آمادگی Production» اضافه کن که: تاریخ تأیید نهایی، نتیجه‌ی تایپ‌چک، نتیجه‌ی رگرسیون کامل (تعداد تست کل/موفق/ناموفق preexisting)، و فهرست هرگونه شکاف شناخته‌شده و **عمداً رفع‌نشده** (مثل آیتم ۸۴ — بدون hydration زنده در Canvas برای Dual-Mode widgets، آیتم ۹۱ — امنیت condition compiler، یا هر تصمیم محصولی دیگری که در طول این ۱۳ فاز آگاهانه به تعویق افتاد) را با دلیل صریح فهرست کند، تا این‌ها با «باگ فراموش‌شده» اشتباه گرفته نشوند.

**۷. گزارش پایانی به کاربر (فارسی، صریح و بدون اغراق):**
- تأیید صریح: سیستم آماده‌ی Production است / نیست (اگر نیست، دقیقاً چرا و چه چیزی مانده).
- فهرست کامل ۷۲ آیتم با وضعیت نهایی هرکدام.
- فهرست شکاف‌های شناخته‌شده‌ی عمداً رفع‌نشده (تصمیمات محصولی که در طول فازها به کاربر واگذار شد).
- عدد نهایی: تعداد کل تست‌های رگرسیون جدید نوشته‌شده در این ۱۳ فاز.

---

## فاز ۱۴ — Hydration زنده در بوم طراحی برای ۱۶ ویجت Dual-Mode (مورد ۱۰۰)

**اولویت: 🟢 قابلیت جدید (نه باگ پاریتی) — تصمیم محصولی که گرفته شده و آماده‌ی اجراست.**
**وضعیت: ✅ تکمیل شد (آیتم ۱۰۰)**

### دامنه
مورد ۱۰۰ (سند ممیزی، بخش ۱۲). این فاز مستقل از فازهای ۱-۱۳ است — هیچ فایلی که این فاز لمس می‌کند در آن ۱۳ فاز تغییر نکرده بود (به‌جز فایل‌های خودِ hydration که از قبل عمومی/پایدار بودند).

### زمینه — چرا این کار لازم است و چطور باید انجام شود

بوم طراحی (Canvas) برای دو خانواده‌ی دیگر از عناصر (Grid، و Chart/Viz) از قبل یک الگوی کامل و تست‌شده برای نمایش داده‌ی زنده‌ی API دارد:
- `src/features/component-designer/canvas/DesignerCanvasHydratedDataGrid.tsx` — برای Grid.
- `src/features/component-designer/canvas/DesignerCanvasHydratedVizWidget.tsx` — برای Chart/Viz (فایل مرجع اصلی این فاز — آن را کامل بخوان قبل از شروع).

هر دو از هوک عمومی و کاملاً بدون فرض خاص `src/domain/component-designer/useDesignerHydratedRows.ts` استفاده می‌کنند: امضای آن `useDesignerHydratedRows(document, bindingDefinitions, dataVar, designerStore)` است و فقط یک `dataVar` (نام متغیر داده) و مسیر hydration‌اش را resolve می‌کند — هیچ‌چیز grid/chart-specific در خودِ هوک نیست.

اما ۱۶ ویجت محتوایی Dual-Mode (فهرست دقیق در سند ممیزی بخش ۱۲ / `bindingContentEngine.ts:30-47`) هیچ مسیر مشابهی ندارند — `src/features/component-designer/canvas/canvasNodes.tsx` هیچ چک/wrapperای شبیه `shouldHydrateCanvasVizWidget`/`DesignerCanvasHydratedVizWidget` برایشان قبل از رسیدن به `renderHeroUiRealNode` (خط ۸۹۸ به بعد در نسخه‌ی فعلی — با `grep` شماره‌خط دقیق فعلی را تأیید کن) ندارد. نتیجه: `RuntimeRenderOptions.contentRows`/`contentListBound` (این دو فیلد از قبل در `runtimeTypes.ts` تعریف شده‌اند و `resolveBoundUniversalOverrides` در `designerUniversalRuntime.tsx` از قبل آماده‌ی خواندنشان است) هرگز در بوم طراحی تنظیم نمی‌شوند و همیشه به داده‌ی استاتیک/mock سقوط می‌کنند.

### دستور فیکس دقیق (کاملاً موازی با `DesignerCanvasHydratedVizWidget.tsx`)

1. **فایل جدید** `src/features/component-designer/canvas/DesignerCanvasHydratedContentWidget.tsx` بساز، دقیقاً با همان ساختار `DesignerCanvasHydratedVizWidget.tsx`:
   ```ts
   import * as React from 'react';
   import {
     isDualModeContentNode,
     isContentDataBoundNode,
     resolveContentListDataVarName,
   } from '../../../domain/component-designer/bindingContentEngine';
   import { renderHeroUiRealNode } from '../../../domain/component-designer/runtimeRenderer';
   import { useDesignerHydratedRows } from '../../../domain/component-designer/useDesignerHydratedRows';
   import type { DesignerBindingDefinitions, DesignerDocument, DesignerNode } from '../../../domain/component-designer/types';
   import type { RuntimeRenderOptions } from '../../../domain/component-designer/runtimeTypes';
   import type { DesignerCanvasRuntimeContext } from '../hooks/useDesignerCanvasRuntime';

   export type DesignerCanvasHydratedContentWidgetProps = {
     node: DesignerNode;
     document: DesignerDocument;
     bindingDefinitions: DesignerBindingDefinitions;
     canvasRuntime?: DesignerCanvasRuntimeContext;
     style?: React.CSSProperties;
   };

   export const DesignerCanvasHydratedContentWidget: React.FC<DesignerCanvasHydratedContentWidgetProps> = ({
     node, document, bindingDefinitions, canvasRuntime, style,
   }) => {
     const dataVar = resolveContentListDataVarName(node.id);
     const { rows, isLoading, refresh } = useDesignerHydratedRows(
       document, bindingDefinitions, dataVar, canvasRuntime?.designerStore,
     );

     const options: RuntimeRenderOptions = {
       mode: 'design',
       style,
       bindingDefinitions,
       previewBindings: canvasRuntime?.previewBindings,
       previewEvents: canvasRuntime?.previewEvents,
       designerStore: canvasRuntime?.designerStore,
       designerDocument: document as DesignerDocument,
       contentRows: rows,
       contentListBound: isContentDataBoundNode(node),
       // contentListLoading/onContentRefresh: فقط اگر تصمیم گرفتی یک وضعیت loading/refresh
       // بصری برای این خانواده اضافه کنی (بند ۲ پایین)، این دو فیلد را هم به RuntimeRenderOptions
       // (runtimeTypes.ts) و به‌کارگیرنده‌شان در Universal Widgets اضافه کن؛ در غیر این صورت
       // نادیده بگیر — رفتار فعلی resolveBoundUniversalOverrides با rows خالی هم درست کار می‌کند
       // (fallback به آرایه‌ی خالی، نه کرش).
     };

     return <>{renderHeroUiRealNode(node, options)}</>;
   };

   export const shouldHydrateCanvasContentWidget = (node: DesignerNode): boolean =>
     isDualModeContentNode(node) && isContentDataBoundNode(node);
   ```
   **نکته‌ی مهم:** برخلاف Viz (که `isChartNode`/دو شاخه دارد)، این‌جا فقط یک شاخه‌ی واحد لازم است چون هر ۱۶ عنصر از یک مکانیزم Dual-Mode یکسان استفاده می‌کنند.

2. در `canvasNodes.tsx`: import کن `DesignerCanvasHydratedContentWidget, shouldHydrateCanvasContentWidget` و **درست قبل از** چک موجود `shouldHydrateCanvasVizWidget` (یا بلافاصله بعدش، ترتیب مهم نیست چون این دو چک هرگز هم‌زمان روی یک نود true نمی‌شوند)، یک شاخه‌ی مشابه اضافه کن:
   ```tsx
   if (shouldHydrateCanvasContentWidget(node)) {
     return (
       <DesignerCanvasHydratedContentWidget
         node={node}
         document={canvasDocument as DesignerDocument}
         bindingDefinitions={bindingDefinitions}
         canvasRuntime={canvasRuntime}
         style={sharedNodeStyle}
       />
     );
   }
   ```

3. **بند مهم — وضعیت Loading/Refresh (تصمیم بگیر، مستند کن):** Grid/Chart/Viz یک toolbar واقعی با دکمه‌ی Refresh/نشانگر Loading دارند. این ۱۶ ویجت محتوایی معمولاً چنین toolbarای ندارند (فقط محتوا نمایش می‌دهند). دو گزینه داری:
   - **گزینه‌ی ساده (پیشنهادی):** فقط `contentRows`/`contentListBound` را وایر کن؛ در حالت loading (قبل از رسیدن اولین پاسخ)، `rows` مقدار `undefined`/آرایه‌ی خالی خواهد بود که `resolveBoundUniversalOverrides` از قبل با `rows ?? []` بی‌خطر مدیریت می‌کند (یعنی محتوای موقتاً خالی/placeholder، نه کرش) — کافی است.
   - **گزینه‌ی کامل‌تر:** یک نشانگر بصری «در حال بارگذاری…» کوچک روی این ویجت‌ها در بوم طراحی اضافه کن (مشابه اسپینر گرید). این نیازمند افزودن `contentListLoading`/`onContentRefresh` به `RuntimeRenderOptions` (`runtimeTypes.ts`) و مصرف‌شان در `DesignerRuntimeUniversalWidgets.tsx` است.
   توصیه: با گزینه‌ی ساده شروع کن؛ اگر در تست‌های دستی (بند Self-Audit پایین) حالت خالی/placeholder در حین fetch بصری آزاردهنده بود، گزینه‌ی کامل‌تر را در همین فاز اضافه کن.

### تست‌های موردنیاز

فایل جدید `src/domain/component-designer/__tests__/dualModeContentCanvasHydrationPhase14Fix.test.tsx`:
- برای حداقل ۴-۵ عنصر نماینده از هر دسته‌ی فرمت داده (یک `JSON_DATA_PROP_IDS` مثل `content.blog-card`، یک `SLIDES_PROP_IDS` یعنی `content.carousel`، یک `CSV_LIST_PROP_IDS` مثل `content.segmented-control`، یک عنصر ساده‌ی scalar-mapping مثل `content.cta-banner`)، یک سند بساز که آن عنصر را به یک دیتاسورس واقعی Bind کند (با همان کمکی‌های `buildContentDualModeEnableActions`/`buildContentBindingConnectActions` که تست‌های موجود `dualModeContent.t1-9.test.tsx` استفاده می‌کنند).
- بوم طراحی را با `render` واقعی رندر کن (نه Preview) — از الگوی رندر canvas موجود در تست‌های `canvasNodes`/`DesignerCanvasHydratedDataGrid` تست‌های موجود پیروی کن، با `fetch` mock‌شده که یک پاسخ واقعی برمی‌گرداند.
- assert کن محتوای رندرشده در بوم طراحی واقعاً از پاسخ mock شده می‌آید، نه از JSON استاتیک پیش‌فرض کاتالوگ.
- یک تست هم برای حالت **unbound/static** (بدون تغییر) بنویس تا مطمئن شوی این فیکس چیزی را برای عناصر Bind‌نشده خراب نکرده.
- تست‌های موجود `dualModeContent.t1-9.test.tsx`, `contentItems.t1-29.test.tsx`, `universalWidgetsPhase9ParityFix.test.tsx` را هم اجرا کن تا رگرسیون نگیرد.

### Self-Audit ویژه‌ی این فاز
برای هر یک از ۱۶ عنصر (نه فقط ۴-۵ نماینده‌ی تست‌شده)، حداقل یک‌بار دستی (یا با یک حلقه‌ی تست پارامتریک مثل الگوی `vizNonChartToolbarCodegen.test.ts`) تأیید کن که `shouldHydrateCanvasContentWidget` برایش `true` می‌شود وقتی Bind است، و رندر نهایی کرش نمی‌کند. مطمئن شو Preview/Export (که این فاز دست نمی‌زند) هنوز دقیقاً همان رفتار قبلی را دارند — این فاز فقط بوم طراحی را تغییر می‌دهد.

---

## فاز ۱۵ — اکشن `navigate` در Dynamic Actions (مورد ۱۰۱)

**اولویت: 🟢 قابلیت جدید — تصمیم محصولی که گرفته شده و آماده‌ی اجراست.**
**وضعیت: ✅ تکمیل شد (آیتم ۱۰۱)**

### دامنه
مورد ۱۰۱ (سند ممیزی، بخش ۱۲).

### زمینه — تأییدشده با خواندن کد

`src/domain/component-designer/types.ts`'s `DesignerDynamicActionType` فعلاً: `'setValue' | 'showHide' | 'showToast' | 'callMutation' | 'refreshDataSource' | 'resetForm'`. کتابخانه‌ی روتینگ واقعی پروژه `react-router-dom` است و از قبل در چند فایل پلتفرم (`src/app/platform/DesignerPublishedShellChrome.tsx`, `PortalHost.tsx`, `ExperienceHost.tsx`) با `useNavigate`/`useLocation`/`Navigate` استفاده می‌شود — این یک وابستگی از‌پیش‌تثبیت‌شده است، نیازی به بررسی/افزودن کتابخانه‌ی جدید نیست.

### دستور فیکس دقیق

**۱. مدل داده (`types.ts`):**
```ts
export type DesignerDynamicActionType =
  | 'setValue' | 'showHide' | 'showToast' | 'callMutation'
  | 'refreshDataSource' | 'resetForm' | 'navigate';
```
به `DesignerDynamicAction` این دو فیلد اختیاری جدید اضافه کن:
```ts
navigateTarget?: string;   // یک قالب رشته‌ای مسیر، مثل "/orders/{selection.id}" یا "/dashboard"
navigateReplace?: boolean; // اختیاری — استفاده از history.replace به‌جای push (پیش‌فرض false)
```
از همان قرارداد resolve کردن template که در سایر اکشن‌ها/URLها استفاده می‌شود پیروی کن (چک کن آیا `resolveBindingTemplateValue`/معادل عمومی‌تری برای resolve کردن `{store.x}`/`{item.x}` روی یک رشته‌ی دلخواه (نه فقط URL API) از قبل وجود دارد؛ اگر نه، از همان الگوی substitution که برای فیلدهای دیگر رشته‌ای استفاده می‌شود کپی کن).

**۲. Inspector UI (`InspectorDynamicActionsField.tsx`):**
`ACTION_TYPE_OPTIONS` را با `{ value: 'navigate', label: 'Navigate' }` گسترش بده؛ یک بلوک ویرایش فیلد جدید اضافه کن با: یک ورودی متنی برای `navigateTarget` (با راهنمای «پشتیبانی از `{store.x}`/`{item.x}`»)، و یک چک‌باکس برای `navigateReplace`.

**۳. اجرای Preview (`bindingDynamicActionsRuntime.ts` یا هرجایی که سایر انواع اکشن runtime اجرا می‌شوند):**
یک `case 'navigate':` جدید اضافه کن که مسیر را resolve می‌کند و از یک `navigate` تزریق‌شده (باید بررسی کنی چطور کامپوننت‌های اجراکننده‌ی Dynamic Actions در Preview به `useNavigate()` دسترسی پیدا می‌کنند — چون `bindingDynamicActionsRuntime.ts` احتمالاً یک ماژول غیر-React (بدون hook) است، باید `navigate` به‌عنوان یک callback از بالای درخت (جایی که واقعاً `useNavigate()` صدا زده می‌شود، مثلاً `designerRuntimePreview.tsx`) پاس داده شود — دقیقاً با همان الگوی `mutationCallbacks`/`previewEvents` که سایر callbackهای بیرونی از React به این لایه‌ی غیر-React منتقل می‌شوند. این را با خواندن دقیق چگونگی پاس‌دادن callbackهای مشابه (`onError`, `patchStore`) تأیید و همان الگو را تکرار کن) صدا می‌زند.

**۴. Export codegen (`bindingCodegen.ts`، تابع تولید اجرای Dynamic Action):**
یک `case action.type === 'navigate'` جدید اضافه کن که:
- در بالای import های فایل تولیدشده، اگر سند حداقل یک اکشن navigate دارد، `import { useNavigate } from 'react-router-dom';` را اضافه کن (با همان مکانیزم conditional-import موجود برای import‌های دیگر، مثل `documentUsesChartToolbar`).
- در بدنه‌ی کامپوننت تولیدشده، `const navigate = useNavigate();` را (یک‌بار، اگر لازم است) اضافه کن.
- در handler تولیدشده، `navigate(${resolvedPathExpression}, { replace: ${navigateReplace} })` را صدا بزند.

### تست‌های موردنیاز

فایل جدید `src/domain/component-designer/__tests__/dynamicActionNavigatePhase15Fix.test.ts(x)`:
- **Preview:** یک سند با یک دکمه که اکشن `navigate` دارد (مسیر شامل `{store.selection.id}`) بساز، `DesignerDocumentPreview` را داخل `MemoryRouter` (با یک روت مقصد ساختگی که فقط `pathname` را نمایش می‌دهد) رندر کن، دکمه را کلیک کن، و با `fireEvent`/`screen` تأیید کن ناوبری واقعی به مسیر resolve‌شده‌ی درست اتفاق افتاده.
- **Export:** `generateDesignerTsx` را روی همان سند اجرا کن، assert کن `import { useNavigate }` و فراخوانی `navigate(...)` واقعی با expression درست resolve‌شده در خروجی هست، و `assertValidTsxSyntax` را روی خروجی اجرا کن.
- **Inspector:** یک تست رفتاری (render + fireEvent، نه فقط regex متنی — طبق درس فاز ۵) که تأیید کند گزینه‌ی «Navigate» واقعاً در dropdown قابل‌انتخاب است و فیلد Target واقعاً ظاهر و قابل‌تایپ است.

### Self-Audit ویژه‌ی این فاز
مطمئن شو افزودن `useNavigate()`/import شرطی به کد Export، برای اسنادی که هیچ اکشن navigate ندارند، **هیچ تغییری** در خروجی تولید نمی‌کند (تست رگرسیون: یک سند بدون navigate، خروجی TSX را قبل/بعد این فاز مقایسه کن — باید بایت‌به‌بایت یکسان بماند).

---

## فاز ۱۶ — اتصال واقعی `shell.error-page`/`shell.not-found` به مکانیزم ۴۰۴ برنامه (مورد ۱۰۲)

**اولویت: 🟢 قابلیت جدید، دامنه‌ی محدودتر — با یک قدم تحقیق اجباری در ابتدا.**
**وضعیت: ✅ تکمیل شد (آیتم ۱۰۲ — فقط `shell.not-found`؛ `shell.error-page` آگاهانه deferred)**

### دامنه
مورد ۱۰۲ (سند ممیزی، بخش ۱۲).

### زمینه — تأییدشده با خواندن کد (وضعیت فعلی دقیق)

مکانیزم واقعی ۴۰۴ در سطح کل برنامه کاملاً مستقل از Designer و هاردکد است:
- `src/app/platform/PlatformAppRoutes.tsx:48`: `<Route path="*" element={<RouteNotFoundPage variant="fullscreen" />} />`
- `src/pages/RouteNotFoundPage.tsx`: یک کامپوننت ثابت React با پراپ‌های `variant`/`homeTo`/`homeLabel` — هیچ ارتباطی با سند Designer ندارد.

عناصر پالت `shell.error-page`/`shell.not-found` (طبق سند دور اول) فقط بلوک‌های محتوایی ثابت (heading/text/button) روی بوم هستند که کاربر می‌تواند روی هر صفحه‌ی Designer بگذارد — ولی **هیچ رجیستری/ثبتی وجود ندارد** که به روت catch-all بالا بگوید «این صفحه‌ی منتشرشده‌ی خاص را به‌جای `RouteNotFoundPage` هاردکد نشان بده».

### قدم ۰ — تحقیق اجباری (قبل از نوشتن هر کدی)

این فاز، برخلاف ۱۴/۱۵، به یک لایه‌ی تنظیمات/ثبت خارج از خودِ Designer نیاز دارد که من (نویسنده‌ی این سند) از جزئیات دقیقش مطمئن نیستم. قبل از پیاده‌سازی، این‌ها را بررسی کن:
1. آیا مفهوم «پرتال» (Portal) در این پلتفرم یک جدول/رکورد تنظیمات دارد که بشود یک فیلد جدید (مثلاً `notFoundPageId`/`errorPageId`) به آن اضافه کرد؟ (`grep -rn "portal" src/server/`، `PortalHost.tsx`، `ExperienceHost.tsx` را بگرد.)
2. آیا صفحات منتشرشده‌ی Designer (خارج از این فیچر) یک شناسه‌ی پایدار و یک مسیر resolve مشخص برای «این صفحه را با ID بده، محتوایش را رندر کن» از قبل دارند؟ (این باید از قبل وجود داشته باشد — همان مکانیزمی که صفحات معمولی منتشرشده را serve می‌کند.)
3. آیا می‌شود بدون تغییر دادن خودِ `PlatformAppRoutes.tsx` (که یک فایل ثابت غیر-Designer است) این ویژگی را اضافه کرد — مثلاً با اینکه `RouteNotFoundPage`/معادلش خودش یک هوک بزند که چک کند آیا برای این پرتال یک صفحه‌ی سفارشی ثبت شده، و اگر بله آن را رندر کند، وگرنه به محتوای پیش‌فرض فعلی سقوط کند؟ این کم‌ریسک‌ترین مسیر است چون به تغییر ساختار روت اصلی نیاز ندارد.

اگر بعد از این تحقیق مشخص شد این ویژگی نیازمند تغییرات بک‌اند/دیتابیس غیرمنطقی‌بزرگ است (مثلاً هیچ مکانیزم تنظیمات پرتال موجود نیست و باید از صفر ساخته شود)، **متوقف شو و به کاربر گزارش بده** که این فاز به دامنه‌ی بزرگ‌تری نیاز دارد — پیش نرو و حدس نزن.

### دستور فیکس دقیق (در صورت مثبت‌بودن نتیجه‌ی قدم ۰)

1. یک فیلد ساده (مثلاً `notFoundPageRef: string | null`) به تنظیمات پرتال اضافه کن (محل دقیق را قدم ۰ مشخص کرده).
2. یک UI کوچک برای تنظیم این مقدار (احتمالاً در تنظیمات پرتال موجود، نه در خودِ Designer) اضافه کن — یا حداقل، اگر `shell.not-found` روی یک صفحه‌ی Designer گذاشته شود، صفحه‌ی حاوی آن به‌طور خودکار به‌عنوان کاندید ۴۰۴ آن پرتال ثبت شود (تصمیم UX را خودت بر اساس آنچه در قدم ۰ درباره‌ی الگوهای مشابه یاد گرفتی بگیر).
3. در `RouteNotFoundPage.tsx` (یا یک wrapper جدید که `PlatformAppRoutes.tsx` به‌جایش استفاده می‌کند)، قبل از رندر محتوای هاردکد فعلی، چک کن آیا یک صفحه‌ی سفارشی برای این پرتال ثبت شده — اگر بله، آن صفحه‌ی منتشرشده‌ی Designer را (از طریق همان مسیر رندر صفحات عادی) رندر کن؛ اگر نه، **دقیقاً همان `RouteNotFoundPage` فعلی بدون هیچ تغییری** رندر شود (fallback امن — هیچ پرتالی که این ویژگی را تنظیم نکرده نباید تحت تأثیر قرار بگیرد).
4. همین الگو (با احتیاط بیشتر، چون «خطا» می‌تواند در میانه‌ی رندر رخ دهد نه فقط در یک روت مشخص) برای `shell.error-page` بررسی و در صورت امکان مشابه پیاده کن؛ اگر معماری error-boundary فعلی برنامه این را به‌سادگی اجازه نمی‌دهد، این بخش را جدا مستند کن و فقط `shell.not-found` را در این فاز کامل کن.

### تست‌های موردنیاز
فایل جدید `src/domain/component-designer/__tests__/shellNotFoundErrorPagePhase16Fix.test.tsx` (یا مسیر مناسب‌تر بسته به این‌که منطق کجا قرار گرفت):
- سناریوی «پرتال بدون تنظیم» → دقیقاً `RouteNotFoundPage` پیش‌فرض رندر می‌شود (رگرسیون صفر برای پرتال‌های موجود).
- سناریوی «پرتال با صفحه‌ی سفارشی ثبت‌شده» → محتوای واقعی صفحه‌ی Designer (نه پیش‌فرض هاردکد) رندر می‌شود.

### Self-Audit ویژه‌ی این فاز
مطمئن شو fallback امن (بند ۳) واقعاً امن است — یک تست صریح بنویس که کل مسیر روتینگ فعلی (`PlatformAppRoutes.tsx`'s catch-all) را برای یک پرتال بدون هیچ تنظیمی رندر می‌کند و تأیید می‌کند خروجی *دقیقاً* با رفتار پیش از این فاز یکسان است (بدون حتی یک پراپ متفاوت).

---

# بخش دوم — ویزارد Auto Form Builder و Built-in Components

این بخش نتیجه‌ی دو تحقیق عمیق و مستقل (نه ادامه‌ی ممیزی پاریتی سه‌مسیره‌ی بخش اول) است. برخلاف فازهای ۱-۱۶ که همگی «رفع باگ پاریتی یک فیلد/عنصر موجود» بودند، فازهای ۱۷-۲۲ ترکیبی از رفع باگ واقعی، تکمیل قابلیت ناقص، و **ساخت قابلیت کاملاً جدید** (فازهای ۱۹-۲۰) هستند. همان «زمینه‌ی معماری مشترک» و «متدولوژی و پروتکل تأیید مشترک» (بخش‌های ۰ و ۱ همین سند) بدون استثنا روی این فازها هم اعمال می‌شود.

## فاز ۱۷ — Auto Form Builder: رفع باگ‌های بحرانی

**اولویت: 🔴 بحرانی.**
**وضعیت: ✅ تکمیل شد (آیتم‌های ۱–۳ / چهار شکاف بحرانی)**

### دامنه
۴ باگ/شکاف بحرانی در ویزارد «Auto Form Builder» (دکمه‌ی «From API» در `src/features/component-designer/components/DesignerPaletteSidebar.tsx`، منطق اصلی در `src/domain/component-designer/autoFormTemplateBuilder.ts` و `src/features/component-designer/components/AutoFormWizardDialog.tsx`).

### فایل‌های اصلی این فاز
`src/features/component-designer/components/AutoFormWizardDialog.tsx`، `src/domain/component-designer/autoFormTemplateBuilder.ts`، `src/domain/component-designer/bindingResourceModel.ts`، `src/features/component-designer/hooks/useDesignerVersions.ts`، `src/features/component-designer/components/ComponentDesignerView.tsx`/`ComponentDesignerWorkspace.tsx`.

### آیتم ۱ — ناسازگاری واقعی بین UI و رفتار: گزینه‌های «Reset form» و «Close dialog» در ویزارد قابل‌انتخاب‌اند ولی هیچ اثری ندارند

**مکانیزم (تأییدشده با خواندن کد):** `autoFormTemplateBuilder.ts`'s `buildSubmitBinding` (خطوط ۳۹۸-۴۴۱) یک پیاده‌سازی **جداگانه و ناقص‌تر** از `buildFormBindingWizardActions` (`bindingResourceModel.ts:899-1009` — همان تابعی که «ویزارد Binding Form» دیگر و فاز ۵ همین سند برایش گزینه‌های موفقیت را ترکیب‌پذیر کردند) است. `buildSubmitBinding` فقط `toast`/`refresh` را واقعاً پیاده می‌کند؛ برای `reset`/`close` فقط یک `console.warn` می‌نویسد (خط ۴۲۰-۴۳۰) و هیچ اکشنی نمی‌سازد. اما `AutoFormWizardDialog.tsx`'s `SUCCESS_OPTIONS` (خط ۶۴-۶۹) هر ۴ گزینه را به‌صورت چک‌باکس کاملاً فعال نشان می‌دهد، و صفحه‌ی Review (خط ۶۶۹) `successBehaviors.join(' + ')` را بدون فیلتر نمایش می‌دهد — یعنی کاربر گزینه‌ای را تیک می‌زند که در سکوت کامل بی‌اثر می‌ماند (فقط یک جمله‌ی خاکستری کم‌رنگ زیر چک‌باکس‌ها، خط ۶۱۵-۶۱۷، هشدار می‌دهد که به‌سختی دیده می‌شود).

**فیکس (رویکرد پیشنهادی — یکی‌سازی به‌جای دوباره‌نویسی):** به‌جای نگه‌داشتن دو پیاده‌سازی موازی، `buildSubmitBinding` در `autoFormTemplateBuilder.ts` را طوری بازنویسی کن که **مستقیماً `buildFormBindingWizardActions` را صدا بزند** (با نگاشت پارامترهای ویزارد Auto-Form به همان امضای تابع — `regionNodeId`, `successBehaviors[]`, `toastMessage`, و غیره). این کار: (الف) ناسازگاری را کاملاً از بین می‌برد (یک منبع حقیقت)، (ب) به‌صورت خودکار reset/close را هم واقعی می‌کند، (پ) هر بهبود آینده‌ی مشترک (مثل چیزی که فاز ۵ برای ترتیب canonical توالی success actions اضافه کرد) را بدون تغییر اضافه در این فایل هم به Auto-Form-Builder می‌رساند. اگر ادغام کامل به‌دلایل فنی (مثلاً تفاوت shape ورودی) در بودجه‌ی این فاز نمی‌گنجد، حداقل: (۱) خودِ `buildSubmitBinding` را طوری تغییر بده که واقعاً `resetForm`/`closeModal`-معادل اکشن‌ها را بسازد (کپی مستقیم منطق از `buildFormBindingWizardActions` خطوط ۹۶۹-۹۹۰)، (۲) یا اگر تصمیم گرفتی این محدودیت باقی بماند، حداقل UI را با واقعیت هماهنگ کن: چک‌باکس‌های `reset`/`close` را غیرفعال (disabled) کن با یک tooltip واضح («فقط از طریق ویرایش دستی در Inspector بعد از تولید فرم در دسترس است»)، نه این‌که ظاهراً فعال و بی‌اثر بمانند. **ترجیح قوی: گزینه‌ی ادغام کامل، نه محدودسازی UI.**

### آیتم ۲ — نقطه‌ی ورود ویزارد فقط در «حالت فهرست خالی» در دسترس است؛ مسیر «ادغام در Form/Modal موجود» که در دامنه پیاده و تست شده، از UI عملاً غیرقابل‌فراخوانی است

**مکانیزم (تأییدشده با خواندن کد):** دکمه‌ی «From API» فقط وقتی `isCatalogListMode` باشد رندر می‌شود (`ComponentDesignerView.tsx:369`)، و `isCatalogListMode` (`ComponentDesignerWorkspace.tsx:177`) یعنی «هیچ Draftای در حال ویرایش نیست» — یعنی این دکمه فقط زمانی در دسترس است که اصلاً هیچ سندی باز نیست. اما `prepareAutoFormWizardOpen`/`applyAutoFormResult` (`useDesignerVersions.ts:387-399, 487-526`) و `mergeAutoFormIntoDocument` (`autoFormTemplateBuilder.ts:314-348`) یک مسیر کامل برای «تزریق فرم تولیدی داخل یک Form/Modal که کاربر روی Canvas انتخاب کرده» دارند (تست‌شده در `autoFormBuilder.test.ts:376-397`) — ولی چون تنها راه رسیدن به دکمه، بودن در یک سند *خالی* است، `documentHasDesignedContent` همیشه `false` است و `applyAutoFormResult` همیشه مسیر «ساخت سند کاملاً تازه» را می‌رود، هرگز مسیر ادغام را. اگر (در یک سناریوی نظری) کاربر با محتوای موجود به این حالت برسد، `prepareAutoFormWizardOpen` صراحتاً ویزارد را باز نمی‌کند و فقط پیام «ابتدا Form/Modal مقصد را روی Canvas انتخاب کنید» می‌دهد — پیامی که در همان صفحه (که فقط فهرست است، نه Canvas) قابل‌عمل نیست؛ بن‌بست UX واقعی.

**فیکس:** دکمه‌ی «From API» باید **همچنین داخل خودِ ادیتور فعال (Canvas)** در دسترس باشد، نه فقط در فهرست خالی — مثلاً در نوار ابزار Canvas یا در منوی راست‌کلیک روی یک نود `html.form`/`heroui.modal` انتخاب‌شده، با برچسبی مثل «Generate fields from API». وقتی از این نقطه‌ی ورود جدید صدا زده می‌شود:
1. `state.selectedNodeId` واقعی (نود انتخاب‌شده در Canvas) را به‌عنوان `insertTarget` صریح به ویزارد پاس بده (نه این‌که به تشخیص خودکار `documentHasDesignedContent` وابسته باشی).
2. `resolveAutoFormInsertTarget` (`autoFormTemplateBuilder.ts:191-239`) را با این هدف صریح صدا بزن.
3. `applyAutoFormResult` را طوری تغییر بده که وقتی یک هدف صریح پاس داده شده، همیشه از `mergeAutoFormIntoDocument` استفاده کند (نه اینکه از سر `documentHasDesignedContent` حدس بزند).
4. دکمه‌ی موجود در فهرست خالی (`ComponentDesignerView.tsx:369`) را دست‌نخورده نگه‌دار — آن مسیر («ساخت سند تازه») هنوز معتبر و مفید است؛ این یک نقطه‌ی ورود **اضافه**، نه جایگزین.

### آیتم ۳ — فرم بدون API اصلاً ممکن نیست؛ فرم Edit تولیدشده به‌تنهایی معمولاً بی‌اثر است

**مکانیزم (تأییدشده):** `validateStep` مرحله‌ی ۰ (`AutoFormWizardDialog.tsx:277-278`) endpoint را همیشه اجباری می‌کند — هیچ مسیر «فرم استاتیک بدون داده» وجود ندارد. جدا از این، برای سناریوی `edit`/`detail`: `resolveLoadConfig` (`autoFormTemplateBuilder.ts:355-366`) همیشه `urlParams` را از `buildDefaultDetailUrlParams` (`bindingResourceModel.ts:574-587`) می‌سازد که به مسیر ثابت `selection.<primaryKey>` در Store اشاره می‌کند؛ اما **هیچ‌جای خودِ ویزارد این مقدار را می‌نویسد** — فقط جریان‌های دیگر (مثل Grid Detail Flow) آن را پر می‌کنند. یعنی یک فرم Edit که به‌تنهایی (بدون یک Grid کنارش که ردیف انتخاب کند) ساخته شود، همیشه با `selection.id` خالی مواجه می‌شود و هرگز داده‌ی واقعی لود نمی‌کند.

**فیکس (دو بخش، هرکدام مستقل):**
1. **فرم بدون API:** به مرحله‌ی ۰ یک گزینه‌ی صریح «Static form (no API)» اضافه کن که با انتخابش، بقیه‌ی مرحله‌ی ۰ (endpoint picker) غیرفعال/رد می‌شود و کاربر مستقیم به مرحله‌ی ۱ («Fields») با فهرست خالی (فقط دکمه‌ی «افزودن دستی») می‌رود. `buildAutoFormSeeds`/`buildAutoFormDocument` باید بتوانند بدون هیچ `dataSourceRef`ای هم یک `html.form` ساده (بدون submit binding خودکار — کاربر بعداً دستی سیم‌کشی می‌کند، یا فقط یک اکشن `showToast`/`navigate` ساده پیشنهاد بده) تولید کنند.
2. **فرم Edit تنها:** اگر سناریوی `edit`/`detail`/`createEdit` انتخاب شده و ویزارد از نقطه‌ی ورود «فهرست خالی» (نه از داخل یک Grid Detail Flow) صدا زده می‌شود، یک هشدار واضح در مرحله‌ی ۲ («Layout») نشان بده: «این فرم برای نمایش/ویرایش یک رکورد به یک مکانیزم انتخاب رکورد (مثلاً یک Grid با ستون Detail) نیاز دارد؛ در غیر این صورت همیشه خالی خواهد بود» — به‌علاوه، در صورت امکان، یک گزینه‌ی جایگزین «Read id from URL param» (به‌جای `selection.id`) اضافه کن برای سناریوی صفحه‌ی مستقل با `:id` در مسیر (چک کن آیا زیرساخت خواندن URL param در جای دیگری از پروژه از قبل وجود دارد — مثل مسیرهای React Router با `useParams` — و از همان الگو استفاده کن).

### تست‌های موردنیاز
`src/domain/component-designer/__tests__/autoFormBuilderCriticalFixesPhase17.test.ts(x)`:
- آیتم ۱: یک فرم Create با `successBehaviors: ['toast', 'refresh', 'reset', 'close']` (هر ۴ همزمان) تولید کن، سند را با `generateDesignerTsx` بساز، و تأیید کن هر ۴ اکشن واقعاً در خروجی حاضرند (نه فقط toast/refresh).
- آیتم ۲: یک تست UI رفتاری (render+fireEvent) که نقطه‌ی ورود جدید (داخل Canvas، روی یک Modal موجود) را باز می‌کند، فیلدهایی تولید می‌کند، و تأیید می‌کند فیلدهای تولیدشده *داخل* همان Modal ظاهر شدند، نه در یک سند تازه که محتوای Modal را پاک کرده.
- آیتم ۳: یک تست برای «Static form (no API)» که مرحله‌ی ۰ را رد می‌کند و یک فرم بدون هیچ data source ای تولید می‌کند؛ یک تست جدا که تأیید می‌کند هشدار «نیاز به مکانیزم انتخاب رکورد» در سناریوی edit-تنها ظاهر می‌شود.

### Self-Audit ویژه‌ی این فاز
بعد از فیکس آیتم ۲، مطمئن شو نقطه‌ی ورود قدیمی (فهرست خالی) هنوز دقیقاً مثل قبل کار می‌کند — این یک نقطه‌ی ورود *اضافه* است، جایگزین نیست. `autoFormBuilder.test.ts` و `autoFormRuntimeSubmit.test.tsx` موجود را کامل اجرا کن تا مطمئن شوی هیچ رگرسیونی در مسیرهای قبلاً-کارکننده ایجاد نکرده‌ای.

---

## فاز ۱۸ — Auto Form Builder: گسترش پوشش فیلد + استخراج Validation از OpenAPI

**اولویت: 🟡 متوسط-بالا.**
**وضعیت: ✅ تکمیل شد (آیتم‌های ۱۰۶–۱۰۷)**

### دامنه
دو بهبود مستقل روی همان ویزارد.

### آیتم ۱ — `pattern`/`minLength`/`maxLength`/`minimum`/`maximum` هرگز از OpenAPI استخراج/اعمال نمی‌شوند، با این‌که Runtime کاملاً آماده است

**مکانیزم:** `ApiFormField` (`apiFieldSchema.ts:7-22`) و `schemaPropertyToFieldParts` (خط ۶۸-۹۱) فقط `required`/`type`/`format`/`enum` را می‌خوانند — این ۵ کلید اعتبارسنجی اصلاً استخراج نمی‌شوند. `buildControlProps` (`apiFieldToControl.ts:164-166`) فقط `isRequired` را روی props می‌گذارد. اما `runtimeNodeProps.ts:151-163` (و فیکس فاز ۶ همین سند) کاملاً از `pattern`/`maxLength`/`minLength` روی فیلدهای فرم پشتیبانی می‌کند — یعنی زیرساخت آماده است، فقط ویزارد از آن استفاده نمی‌کند.

**فیکس:**
1. `ApiFormField` (`apiFieldSchema.ts`) را با فیلدهای اختیاری `pattern?: string`, `minLength?: number`, `maxLength?: number`, `minimum?: number`, `maximum?: number` گسترش بده.
2. `schemaPropertyToFieldParts` را طوری تغییر بده که این کلیدها را از OpenAPI schema property (که همین نام‌ها را استاندارد استفاده می‌کند) بخواند.
3. `buildControlProps` (`apiFieldToControl.ts`) را طوری گسترش بده که این مقادیر (اگر موجود بودند) را روی `props.pattern`/`props.minLength`/`props.maxLength`/`props.min`/`props.max` نودهای تولیدی بگذارد — فقط برای کنترل‌هایی که این propها را واقعاً می‌شناسند (`heroui.input-text`, `heroui.number-input`, `heroui.textarea` — چک کن هرکدام از این پراپ‌ها روی کدام کنترل‌ها معنی دارند، از `inspectorPaletteFields.ts` مطمئن شو).

### آیتم ۲ — پوشش ناقص کنترل‌ها (۱۲ از ۱۸-۱۹ کنترل واقعی فرم) + نبود پشتیبانی nested/repeating/conditional/file-upload

**مکانیزم:** `AUTO_FORM_CONTROL_PALETTE_ITEM_IDS` (`apiFieldToControl.ts:11-24`) فاقد `heroui.autocomplete`, `heroui.entity-picker`, `form.date-range`, `heroui.checkbox-group`, `heroui.radio-group`, `heroui.slider`, `html.file-upload` است.

**فیکس (دامنه‌ی این فاز را به موارد ساده محدود کن؛ nested/repeating/conditional فیلدها را به یک فاز جداگانه‌ی آینده واگذار کن چون نیاز به طراحی UX جدید در خودِ ویزارد دارند، نه فقط افزودن یک آیتم به یک لیست):**
1. `html.file-upload`: به `suggestControlForField` (`apiFieldToControl.ts:73-103`) یک شاخه اضافه کن که اگر `format` در `{binary, byte}` بود یا نام فیلد شامل `file`/`attachment`/`upload` بود، `html.file-upload` پیشنهاد شود.
2. `heroui.checkbox-group`/`heroui.radio-group`: برای `array` با `enum` (که فعلاً به `select` چندانتخابی می‌رود — تأیید کن آیا select چندانتخابی واقعاً پشتیبانی می‌شود یا این‌جا هم یک محدودیت پنهان است)، یک گزینه‌ی جایگزین `checkbox-group` اضافه کن؛ برای `enum` تکی با تعداد گزینه‌ی کم (مثلاً ≤۴)، `radio-group` را به‌عنوان جایگزین بصری `select` در dropdown انتخاب کنترل (مرحله‌ی ۱ ویزارد) اضافه کن — کاربر انتخاب کند، نه اتوماتیک اجباری.
3. `heroui.slider`: برای `number`/`integer` با `minimum`/`maximum` هر دو تعریف‌شده (بعد از فیکس آیتم ۱ بالا)، `slider` را به‌عنوان جایگزین `number-input` در dropdown انتخاب کنترل اضافه کن.
4. `heroui.autocomplete`/`heroui.entity-picker`: برای فیلدهایی که نام یا `format`شان یک الگوی foreign-key/reference را نشان می‌دهد (مثلاً `*_id` با یک entity ref شناخته‌شده)، این‌ها را به‌عنوان گزینه اضافه کن — با توجه به این‌که تحقیق این فاز نشان داد `heroui.autocomplete` عملاً یک Select است (نه جست‌وجوی زنده)، این فقط یک گزینه‌ی نمایشی متفاوت است، نه قابلیت جدید.
5. `form.date-range`: برای یک زوج فیلد شناسایی‌شده با نام مشابه (`start_date`/`end_date`، `from`/`to`) یک شناسایی الگو اضافه کن که پیشنهاد بدهد این دو را با یک `form.date-range` تکی جایگزین کند (این پیچیده‌تر از بقیه است چون دو فیلد API را به یک نود تبدیل می‌کند — اگر پیچیدگی‌اش از بودجه‌ی این فاز بیشتر بود، فقط `form.date-range` را به‌عنوان یک گزینه‌ی دستی در dropdown انتخاب کنترل اضافه کن، بدون تشخیص خودکار جفت).

**مستندسازی heuristic شکننده‌ی موجود:** `baseInfoFieldInference.ts:5-9` یک whitelist سخت‌کدشده‌ی فقط ۳ نام فیلد (`gender_code`, `person_type_code`, `topic_code`) دارد. این فاز را درگیرش نکن (دامنه‌اش جدا و بزرگ‌تر است)، ولی در گزارش پایانی فاز به‌عنوان یک بدهی فنی شناخته‌شده ذکرش کن.

### تست‌های موردنیاز
`src/domain/component-designer/__tests__/autoFormFieldCoveragePhase18Fix.test.ts`: برای هر کنترل جدید، یک سناریوی OpenAPI واقعی بساز که آن کنترل باید پیشنهاد شود، تولید کن، و تأیید کن نود واقعی با `paletteItemId` درست و propهای درست تولید شده. برای آیتم ۱ (validation)، یک فیلد با `pattern`/`maxLength` در schema بساز، تولید کن، `generateDesignerTsx` را اجرا کن، و — طبق درس همیشگی این سند — **واقعاً `tsc --noEmit` روی خروجی اجرا کن** تا مطمئن شوی این propهای جدید هیچ نشتی/خطای تایپ در Export ایجاد نمی‌کنند (این دقیقاً همان کلاس ریسکی است که آیتم ۴۳/۶۲ فاز ۶ رویش بود).

### Self-Audit ویژه‌ی این فاز
تست‌های موجود `autoFormBuilder.test.ts` را کامل اجرا کن — مطمئن شو افزودن کنترل‌های جدید، پیشنهاد پیش‌فرض کنترل‌های موجود (مثل boolean→switch) را به‌طور ناخواسته عوض نکرده.

---

## فاز ۱۹ — قابلیت جدید بزرگ: Auto Table/Grid Builder

**اولویت: 🟢 قابلیت جدید بزرگ — بزرگ‌ترین شکاف شناسایی‌شده نسبت به هدف «ساخت هر جدولی در چند کلیک».**
**وضعیت: ✅ تکمیل شد (آیتم ۱۰۸)**

### دامنه
تحقیق این سند نشان داد **هیچ ویزاردی که یک Grid کامل (ستون‌ها، صفحه‌بندی، جست‌وجو) را از صفر روی یک Canvas خالی بسازد وجود ندارد** — تمام ویزاردهای Grid موجود (`BindingGridWizardDialog.tsx` و غیره) فقط «اتصال یک Grid که کاربر با درگ‌ودراپ دستی از پالت آورده» را انجام می‌دهند. این فاز یک قابلیت **کاملاً جدید** می‌سازد: «Auto Table Builder» — دقیقاً هم‌ارز مفهومی «Auto Form Builder» ولی برای `heroui.app-table-grid`.

### فایل‌های مرجع (الگوبرداری مستقیم از Auto Form Builder، نه اختراع از صفر)
`src/domain/component-designer/autoFormTemplateBuilder.ts` (کل معماری: resolve schema → build seeds → build document/merge)، `src/features/component-designer/components/AutoFormWizardDialog.tsx` (ساختار StepWizardShell)، `src/domain/component-designer/apiFieldSchema.ts`/`apiFieldToControl.ts` (تشخیص نوع از OpenAPI) — این فاز باید **همین زیرساخت schema-detection را دوباره استفاده کند**، نه یک نسخه‌ی جدید بسازد.

### طراحی پیشنهادی (تصمیم نهایی معماری را خودت موقع اجرا، با توجه به کد واقعی، نهایی کن)

**فایل جدید** `src/domain/component-designer/autoTableTemplateBuilder.ts` با ساختار موازی:

1. **مرحله‌ی API:** دقیقاً مثل Auto Form — انتخاب یک endpoint لیست (`method: 'GET'`) با `BindingApiEndpointPicker` موجود. تشخیص OpenAPI response schema (نه request body schema — اینجا فرق مهمی با Auto Form دارد: باید از **آرایه‌ی آیتم‌های پاسخ**، نه از request body، ستون‌ها را استخراج کنی. چک کن `useApiEndpointSchemaQuery` آیا از قبل schema پاسخ (نه فقط پارامتر) را هم برمی‌گرداند؛ اگر نه، این بخشی است که باید اضافه شود).
2. **مرحله‌ی Columns:** جدولی از ستون‌های شناسایی‌شده (شبیه مرحله‌ی «Fields» ولی برای ستون‌های Grid) — هرکدام: چک‌باکس فعال/غیرفعال، برچسب ستون، نوع نمایش (`cellKind`: plain/avatar/chips/link/lock-status — با استنتاج مشابه `suggestControlForField` ولی برای نمایش نه ورودی)، و آیا sortable/filterable باشد.
3. **مرحله‌ی Toolbar:** فعال‌سازی جستجو (`search`)، فیلترهای dropdown (برای ستون‌های enum/boolean شناسایی‌شده)، Refresh — دقیقاً با استفاده از `designerGridToolbarConfig.ts`ی موجود (**فیکس بحرانی فاز ۱ همین سند — query string واقعی در Export — این‌جا مستقیماً سود می‌برد؛ این ویزارد جدید باید از روز اول toolbar واقعی و کارکننده تولید کند، نه یک نسخه‌ی دیگر که باید بعداً کشف شود که خراب است**).
4. **مرحله‌ی Actions (اختیاری):** آیا یک ستون Action «Details»/«Edit»/«Delete» اضافه شود؟ اگر «Edit» انتخاب شد، این دقیقاً نقطه‌ای است که باید **فاز ۲۰ (Auto CRUD Page Builder)** را با فراخوانی هردو ویزارد (Table + Form) به هم وصل کند — طراحی این فاز را طوری کن که خروجی‌اش (`buildAutoTableSeeds`) بتواند به‌تنهایی هم استفاده شود (بدون Actions) هم به‌عنوان یک بلوک سازنده در فاز ۲۰.
5. **مرحله�ی Review:** خلاصه + (برخلاف Auto Form که پیش‌نمایش ندارد — طبق یافته‌ی UX تحقیق قبلی، این نقص را در این ویزارد جدید از همان ابتدا تکرار نکن) در حد امکان یک پیش‌نمایش کوچک از جدول ستون‌ها (حتی فقط یک جدول HTML ساده‌ی نمایشی با ستون‌های انتخاب‌شده، نه رندر کامل Designer) نشان بده.

**Codegen خروجی (`buildAutoTableSeeds`):** یک نود `heroui.app-table-grid` با `columns` تنظیم‌شده (فرمت دقیق را از `designerDataGridColumns.ts`/`InspectorGridActionColumnFields.tsx` موجود بگیر)، `gridDataSource` binding واقعی به endpoint انتخاب‌شده، `toolbarConfig` طبق مرحله‌ی ۳، و `defaultSortBy` روی اولین ستون sortable.

### نقطه‌ی ورود UI
دقیقاً مثل فیکس‌شده‌ی فاز ۱۷ آیتم ۲ برای Auto Form: هم در فهرست خالی («ساخت سند تازه با یک جدول») هم داخل Canvas فعال (وقتی هیچ نودی خاصی انتخاب نشده، جدول را در ریشه/کانتینر انتخاب‌شده درج کن). **این ویزارد را از همان اول با نقطه‌ی ورود دوگانه بساز — تکرار نکن اشتباهی که Auto Form Builder داشت (که نقطه‌ی ورود دومش را باید در یک فاز جدا اضافه می‌کردیم).**

### تست‌های موردنیاز
`src/domain/component-designer/__tests__/autoTableBuilder.test.ts` (الگو از `autoFormBuilder.test.ts` کپی کن): تشخیص schema پاسخ آرایه‌ای، تولید ستون‌ها با نوع درست، تولید toolbar واقعی، و — حیاتی — یک تست end-to-end که سند تولیدشده را `generateDesignerTsx` می‌کند و تأیید می‌کند toolbar واقعاً query string درست تولید می‌کند (استفاده از تست‌های فاز ۱ به‌عنوان مرجع الگو). یک تست `autoTableRuntimeSubmit.test.tsx` (الگو از `autoFormRuntimeSubmit.test.tsx`) که رندر واقعی + fetch mock را تأیید می‌کند.

### Self-Audit ویژه‌ی این فاز
مطمئن شو این ویزارد از تمام فیکس‌های فاز ۱-۱۳ (query string، pagination، toolbar، defaultSortBy) درست و از روز اول بهره می‌برد — این دقیقاً نقطه‌ای است که باگ‌های قدیمی می‌توانند دوباره از طریق یک مسیر تولید جدید ظاهر شوند اگر این ویزارد کورکورانه یک node ساده بسازد به‌جای استفاده‌ی کامل از قراردادهای فعلی `heroui.app-table-grid`.

---

## فاز ۲۰ — قابلیت جدید بزرگ: Auto CRUD Page Builder

**اولویت: 🟢 قابلیت جدید بزرگ — این فاز دقیقاً همان چیزی است که کاربر با عبارت «ساخت هر صفحه‌ای با چند کلیک» توصیف کرده. وابسته به فاز ۱۹ (باید بعد از آن اجرا شود).**
**وضعیت: ✅ تکمیل شد (آیتم ۱۰۹)**

### دامنه
یک ویزارد سطح‌بالاتر («Auto CRUD Page») که فازهای ۱۷ (Auto Form، رفع‌شده)، ۱۹ (Auto Table)، و زیرساخت‌های موجود (Grid Detail Flow در `bindingGridDetailEngine.ts`) را در **یک جریان تصمیم واحد** برای کاربر ترکیب می‌کند، تا نتیجه‌ی نهایی یک صفحه‌ی کامل List+Create+Edit+Delete باشد — نه فقط List+Detail-فقط‌خواندنی که ترکیب دستی امروز آن هم به آن می‌رسد.

### چرا این فاز جدا از فاز ۱۹ است
این یک «wizard of wizards» است، نه یک زیرساخت جدید دیگر — منطق تولید واقعی را از فاز ۱۹ (Grid) و فاز ۱۷ (Form) قرض می‌گیرد. اگر فاز ۱۹ کامل نشده باشد، این فاز غیرقابل‌اجراست — این وابستگی صریح را در گزارش پایانی فاز اگر لازم شد ذکر کن.

### طراحی پیشنهادی

**فایل جدید** `src/domain/component-designer/autoCrudPageBuilder.ts`:

1. **مرحله‌ی API:** انتخاب یک data source واحد (نه یک endpoint تکی — این‌جا باید هر دو عملیات `list` و `create`/`update`/`delete` از همان data source resolve شوند؛ چک کن `DataSourceDefinition`/`dataSourceToResource` در `bindingResourceModel.ts` operations متعدد را از یک تعریف واحد resolve می‌کند — این زیرساخت باید از قبل موجود باشد چون Grid/Form هرکدام جدا از همین مکانیزم استفاده می‌کنند).
2. **مرحله‌ی Columns/Fields (ترکیبی):** یک UI که هم ستون‌های نمایشی جدول هم فیلدهای فرم Create/Edit را هم‌زمان از همان schema پیشنهاد می‌دهد — کاربر برای هرکدام (نمایش در جدول / قابل‌ویرایش در فرم / هردو) تیک می‌زند؛ به‌جای دو ویزارد کاملاً جدا با انتخاب فیلد تکراری.
3. **مرحله‌ی Actions:** چک‌باکس‌های «Create button»، «Edit action»، «Delete action» (با تأیید مودال — استفاده از الگوی `callMutation` که فاز ۵ همین سند برای Delete واقعی اضافه کرد، به‌علاوه‌ی `open-modal` behavior موجود در Row Actions).
4. **تولید نهایی:** یک صفحه با: یک `heroui.app-table-grid` (از منطق فاز ۱۹) + یک دکمه‌ی «Create» که یک `heroui.modal` با فرم Create (از منطق فاز ۱۷، سناریوی `create`) باز می‌کند + یک ستون Action «Edit» که یک modal مشابه با سناریوی `edit` باز می‌کند (با `selection.id` که این‌بار **درست** پر می‌شود چون از همان Grid که ردیف را کلیک کرده می‌آید — دقیقاً حل‌کننده‌ی مشکل فاز ۱۷ آیتم ۳ چون این‌جا Grid و Form هم‌زمان و به هم متصل تولید می‌شوند) + یک اکشن «Delete» با `callMutation` + `refreshDataSource` (از فاز ۵ همین سند، حالا با فیکس فاز ۵ که رفرش واقعی گرید را صدا می‌زند، نه یک فچ شبح).

### نکته‌ی حیاتی معماری
این فاز باید **صریحاً و آگاهانه** از تمام زیرساخت‌های تازه فیکس‌شده در فازهای ۱-۱۸ استفاده کند: `refreshDataSource` واقعی (فاز ۵)، `callMutation` برای Delete (زیرساخت موجود، فاز ۵ گزارش تأیید کرد سالم است)، query string واقعی toolbar (فاز ۱)، UiInput/UiTextarea درست (فاز ۲). این دقیقاً همان لحظه‌ای است که همه‌ی این فیکس‌های جداگانه باید در یک سناریوی واقعی end-to-end کاربر با هم دیده شوند — اگر یکی از آن‌ها در این ترکیب کار نکرد، این نشانه‌ی یک تداخل بین فازهای قبلی است که باید بازگردی و بررسی شود (نه یک باگ جدید این فاز).

### تست‌های موردنیاز
`src/domain/component-designer/__tests__/autoCrudPageBuilder.test.ts` + یک تست runtime کامل (`autoCrudPageRuntimeE2E.test.tsx`) که یک سناریوی کامل کاربر را شبیه‌سازی می‌کند: رندر صفحه‌ی تولیدشده با fetch mock واقعی → کلیک «Create» → پر کردن فرم → submit → تأیید POST واقعی + تأیید این‌که گرید لیست واقعاً رفرش شد (نه فچ شبح) → کلیک روی یک ردیف → «Edit» → تأیید فرم با داده‌ی همان ردیف پر شد → کلیک «Delete» → تأیید مودال تأیید + `callMutation` DELETE واقعی + رفرش گرید.

### Self-Audit ویژه‌ی این فاز
این تنها فازی در کل این سند است که باید صریحاً «مصرف‌کننده‌ی یکپارچه‌ی همه‌ی فازهای قبلی» باشد — بعد از تولید یک سند نمونه با این ویزارد، `generateDesignerTsx` را اجرا کن و **کل خروجی TSX را با `tsc --noEmit` واقعی چک کن** (دقیقاً مثل روش تأیید فاز ۲/۱۳) تا مطمئن شوی ترکیب سه مکانیزم مستقل (Grid+Form+Delete) هیچ تداخل نوع/نام متغیر (مثل دو `useDataFetch` با نام یکسان) تولید نمی‌کند.

---

## فاز ۲۱ — Built-in Components: حذف موکاپ‌های تکراری صفحات ادمین + تصمیم درباره‌ی مکانیزم drag-insert مرده

**اولویت: 🟠 بالا.**
**وضعیت: ✅ تکمیل شد (آیتم‌های ۱۱۰–۱۱۱) — تصمیم کاربر: هر دو گزینه‌ی الف**

### دامنه
دو یافته‌ی مجزا از تحقیق Built-in Components.

### آیتم ۱ — ۱۱ «صفحه‌ی ادمین» Built-in موکاپ ایستا و بی‌فایده‌ای از صفحاتی هستند که همین پروژه از قبل به‌صورت واقعی و کدنویسی‌شده دارد

**مکانیزم (تأییدشده با تحقیق):** `adminPageTemplates.ts` (۱۱ آیتم) فقط `container`/`text` خام با دیتای هاردکد بودند — معادل واقعی‌شان از قبل در فیچرهای برنامه وجود داشت.

**تصمیم نهایی (تأیید کاربر):** گزینه‌ی الف — حذف کامل.

**رفع:** `adminPageTemplates.ts` حذف شد؛ `builtInComponents.ts` / `builtInTemplateResolver.ts` فقط layout-presetها را نگه می‌دارند؛ `draftComponentLayout` و ناوبری هم‌راستا شدند. تست: `builtInAdminPagesRemovalPhase21Fix.test.ts`.

### آیتم ۲ — مکانیزم «کشیدن یک Built-in Component به داخل بوم» (resolve/clone) کاملاً سالم و تست‌شده است ولی هیچ UI زنده‌ای آن را صدا نمی‌زند

**مکانیزم (تأییدشده با تحقیق):** resolve/clone سالم بود ولی هیچ UIای `source: 'built-in-template'` تولید نمی‌کرد؛ `BuiltInComponentCard` کد مرده بود.

**تصمیم نهایی (تأیید کاربر):** گزینه‌ی الف — فعال‌سازی drag-insert.

**رفع معماری:** کاتالوگ فهرست خارج از `DndContext` است؛ پس drag روی `DevelopmentCatalogCard` بی‌اثر بود. `BuiltInComponentCard` با `useDraggable` بازنویسی و در بخش «Built-in Templates» داخل `DesignerToolbox` (داخل `DndContext` حالت ادیت) قرار گرفت. تست: `builtInTemplateDragInsertPhase21Fix.test.tsx`.

### تست‌های موردنیاز
✅ نوشته و سبز: حذف ۱۱ آیتم از کاتالوگ + ثبت drag data + insert واقعی از طریق reducer.

### Self-Audit ویژه‌ی این فاز
تصمیمات محصولی در `20-DESIGNER-ELEMENT-PARITY-AUDIT.md` بخش ۱۷ (موارد ۱۱۰–۱۱۱) ثبت شد.

---

## فاز ۲۲ — Built-in Components: ارتقای موکاپ‌های سطح-۳ به ویجت واقعی + افزودن Built-inهای جدید مهم

**اولویت: 🟡 متوسط.**
**وضعیت: ✅ تکمیل شد (آیتم‌های ۱۱۲–۱۱۳)**

### دامنه
ارتقای کیفیت تمپلیت‌های موجود (نه حذف) + افزودن built-inهای جدید برای پرکردن شکاف‌های شناسایی‌شده.

### آیتم ۱ — بازنویسی موکاپ‌های متنی خام با ویجت واقعی کاتالوگ

برای هرکدام از موارد زیر (در `presetExtendedTemplates.ts`)، نود‌های `container`/`text` خام را با ویجت واقعی متناظر جایگزین کن — **این‌ها الگوی مرجع درست‌شان از قبل در همین پروژه وجود دارد**، فقط باید کپی/تطبیق شوند:
- **`kanban-board`** (`presetExtendedTemplates.ts:260-275`): جایگزین با `viz.kanban` واقعی — دقیقاً همان الگویی که `dashboard-viz-kit` (`newLayoutPresets.tsx:757-764`) از قبل درست استفاده می‌کند؛ آن بخش را عیناً کپی کن.
- **`analytics-detail`** (`:168-184`) و **`metrics-sidebar`** (`:445-467`): بخش‌های «`<div>` گرادیانی با متن ثابت» را با `viz.chart-line`/`viz.chart-bar` واقعی جایگزین کن (همان الگوی `dashboard-viz-kit`).
- **`comparison-table`** (`:49-73`): جایگزین با `heroui.table` یا `tailwind.card`-محور واقعی (بسته به این‌که کدام برای یک جدول مقایسه‌ی ویژگی‌محور (نه دیتا-محور) مناسب‌تر است — تصمیم را با نگاه به کاتالوگ `tailwind.*` فعلی بگیر).
- **`dashboard-kpi`** (`newLayoutPresets.tsx:691-710`): چون مفهوماً با `kpi-metrics-grid` (`enterprisePresetTemplates.ts:160-206`، نسخه‌ی بهتر و جدیدتر با `content.stat-trend` واقعی) هم‌پوشانی جدی دارد، به‌جای بازنویسی جداگانه، `dashboard-kpi` را **حذف** کن و هرجا ارجاع می‌شود به `kpi-metrics-grid` redirect کن (یا `dashboard-kpi` را یک alias ساده به همان تمپلیت تبدیل کن).

برای هرکدام، بعد از تغییر، `builtInTemplateClone.test.ts`/`builtInTemplateResolver.test.ts` را اجرا کن تا مطمئن شوی resolve/clone هنوز درست کار می‌کند (این تست‌ها معمولاً محتوای واقعی چند preset خاص را چک می‌کنند — اگر یکی از این‌ها در فهرست تست‌شده‌هاست، مقادیر انتظاری تست را هم با محتوای جدید هماهنگ کن).

### آیتم ۲ — افزودن Built-inهای جدید برای پرکردن شکاف‌های شناسایی‌شده

با اولویت (بر اساس ارزش نسبت به هدف کاربر):
1. **صفحه‌ی CRUD کامل با binding واقعی** — اگر فاز ۲۰ (Auto CRUD Page Builder) تمام شده، از خروجی آن یک نمونه‌ی «binding-ready» (با یک data source نمونه‌ی عمومی، نه یک API واقعی خاص) به‌عنوان built-in جدید ثبت کن؛ این دقیقاً چیزی است که ۱۱ صفحه‌ی ادمین ادعا می‌کردند ولی هرگز نبودند.
2. **صفحه‌ی Master-Detail کامل** — گسترش `master-detail-header` (که فعلاً فقط هدر است) به یک صفحه‌ی کامل با فرم/گرید فرزند واقعی کنار هدر.
3. **صفحه‌ی ۴۰۴/Error به‌عنوان built-in مستقل قابل‌بارگذاری** — با استفاده از عناصر `shell.not-found`/`shell.error-page` موجود (که بعد از فاز ۱۶ همین سند به مکانیزم واقعی ۴۰۴ هم وصل شدند) یک built-in بساز که این‌ها را در یک چیدمان کامل و آماده قرار می‌دهد.
4. **صفحه‌ی جست‌وجو/فیلتر پیشرفته + نتیجه** — ترکیب `heroui.entity-picker`/چند فیلتر + `heroui.data-grid`.
5. **صفحه‌ی پروفایل/تنظیمات با `heroui.tabs` واقعی** — گسترش `profile-overview`/`user-account-settings` موجود با تب‌بندی واقعی به‌جای بخش‌های تخت.

برای هرکدام، از الگوی سطح ۱ (`enterprisePresetTemplates.ts`) پیروی کن — یعنی همیشه `paletteItemId` صریح روی هر نود، binding واقعی (حتی اگر «binding-ready» بدون endpoint واقعی باشد، طبق الگوی موجود)، و بدون هیچ‌کدام از فیلدهای حذف‌شده‌ی مستند در `docs/refactor-spec/20-DESIGNER-ELEMENT-PARITY-AUDIT.md`.

### تست‌های موردنیاز
برای هر آیتم بازنویسی‌شده/جدید، حداقل یک تست در الگوی `builtInTemplateResolver.test.ts`/`builtInTemplateClone.test.ts` که تأیید می‌کند: (۱) resolve/clone بدون خطا کار می‌کند، (۲) `generateDesignerTsx` روی نتیجه بدون خطای سینتکس اجرا می‌شود (`assertValidTsxSyntax`)، (۳) هیچ‌کدام از فیلدهای حذف‌شده‌ی مستند در سند ممیزی استفاده نشده (یک grep ساده در تست کافی است).

### Self-Audit ویژه‌ی این فاز
بعد از همه‌ی تغییرات، `mergeComponentsCatalog`/فهرست نهایی Built-in Components را یک‌بار کامل مرور کن — مطمئن شو هیچ id تکراری/تصادفی ایجاد نشده و هر آیتم جدید در دسته‌بندی (category) درستی از `DesignerPaletteSidebar.tsx` ظاهر می‌شود.

### نتیجه‌ی اجرا
✅ آیتم ۱: `kanban-board`/`analytics-detail`/`metrics-sidebar`/`comparison-table` به ویجت واقعی ارتقا یافتند؛ `dashboard-kpi` alias به `kpi-metrics-grid`.
✅ آیتم ۲: `crud-collection-page`، `not-found-error-pages`، `advanced-search-results` اضافه شدند؛ `master-detail-header`/`profile-overview`/`user-account-settings` گسترش یافتند.
✅ تست: `builtInTemplatesPhase22UpgradeFix.test.ts` (+ به‌روزرسانی resolver و `tailwindUiBlocks.t1-26`).

## فاز ۲۳ — رفع باگ گزارش‌شده‌ی کاربر: آدرس/endpoint نادرست در Form/Table/CRUD from API

**اولویت: 🔴 بحرانی — گزارش مستقیم کاربر پس از تست دستی هر سه ویزارد.**
**وضعیت: ✅ تکمیل شد (هر دو زیر-باگ)**

### زمینه
کاربر شخصاً هر سه ویزارد «from API» (Auto Form، Auto Table، Auto CRUD Page Builder — فازهای ۱۷/۱۹/۲۰) را تست کرد و گزارش داد که آدرس API و ساخت درخواست به‌درستی انجام نمی‌شود. بررسی خط‌به‌خط، دو باگ واقعی و مستقل — هردو در لایه‌ی مشترک resolve/codegen، نه در کد اختصاصی هیچ‌کدام از سه ویزارد — پیدا و رفع شد.

### زیر-باگ ۱ — نسخه‌ی `:id` مسیر REST هرگز resolve نمی‌شد

`buildDefaultRestOperations` (`bindingResourceModel.ts`) برای هر data source ساخته‌شده توسط ویزاردها (`buildDataSourceFromEndpoint`)، endpointهای detail/update/delete را با کانوانسیون `:id` می‌سازد (مثلاً `/api/orders/:id`). اما تابع resolve مشترک runtime — `resolveBindingUrl` (`bindingMutationRuntime.ts`) و معادل صادرشده‌اش در `bindingApiCodegen.ts` — فقط placeholderهای سبک `{id}` را جایگزین می‌کرد. نتیجه: هر فرم Edit/Detail صادرشده‌ی این ویزاردها یک درخواست GET واقعی با رشته‌ی تحت‌اللفظی و resolve‌نشده‌ی `"/api/orders/:id?id=123"` می‌فرستاد (به‌جای `/api/orders/123`) — همیشه ۴۰۴ یا خطای مسیر.

**رفع:** هر دو resolver اکنون بعد از جایگزینی الگوی `{name}`، یک پاس دوم برای الگوی `:name` هم اجرا می‌کنند (با همان منطق `paramPaths`/`readBindingParamValue`)، دقیقاً هماهنگ با `resolveOperationUrl` (Preview/canvas hydration) و `resolveMutationRuntimeUrl` (callMutation/Delete) که از قبل `:id` را درست مدیریت می‌کردند.

### زیر-باگ ۲ — فرم Create-only، بدون `loadOperation` صریح، endpoint نادرست را resolve می‌کرد بدون جایگزینی پارامتر

فرم سناریوی «create» تنها (بدون Edit) اصلاً `loadOperation` تنظیم نمی‌کند (`resolveLoadConfig`/`resolveWizardLoadConfig` برای این سناریو یک آبجکت خالی برمی‌گردانند — این عمداً درست است چون فرم Create چیزی برای Load ندارد به‌عنوان نیت). اما `dataSourceHasRegionLoadOperation` (`bindingRegionEngine.ts`) صرف داشتن `primaryKey` روی data source (که همیشه صادق است چون هر سه ویزارد آن را ست می‌کنند) یک بارگذاری «detail» ضمنی استنتاج می‌کند — و `resolveRegionLoadConfig` قبلاً `urlParams` را فقط وقتی پر می‌کرد که `loadOperation === 'detail'` **صریحاً** ست شده باشد، نه در این حالت استنتاجی. نتیجه: فرم Create همان لحظه‌ی mount یک GET واقعی با placeholder کاملاً resolve‌نشده (`/api/users/:id`) می‌فرستاد.

**تلاش اول (رد شد):** افزودن یک مقدار صریح `loadOperation: 'none'` برای سناریوی create و کوتاه‌کردن `dataSourceHasRegionLoadOperation` روی آن. این تست‌های واقعی runtime (`autoFormRuntimeSubmit.test.tsx`) را خراب کرد: چون `collectDocumentRegionPlan` فقط وقتی `regionColumnBindings` (شامل binding نوشتن/onChange فیلدها) را می‌سازد که یک region-fetch معتبر برای آن region وجود داشته باشد، حذف کامل fetch باعث شد submit فرم Create مقدار خالی (`{}`) بفرستد — یعنی زیرساخت binding فیلدها (نه فقط شبکه) به وجود ساختاری این fetch وابسته است. این تلاش برگردانده شد.

**رفع نهایی (درست):** `resolveRegionLoadConfig` بدون تغییر در تشخیص endpoint، شرط پرکردن `urlParams` را از «فقط وقتی `loadOperation === 'detail'` صریح» به «هر وقت `primaryKey` وجود دارد و endpoint واقعاً یک path-param متناظر دارد» گسترش داد — صرف‌نظر از این‌که چرا endpoint نوع detail انتخاب شده. نتیجه: حتی درخواست پس‌زمینه‌ی فرم Create هم دیگر placeholder تحت‌اللفظی resolve‌نشده ندارد (به `selection.<pk>` map می‌شود که برای Create خالی resolve می‌شود، نه یک رشته‌ی `:id`/`{id}` واقعی خراب) — بدون دست‌زدن به زیرساخت binding فیلدها.

### تست‌های نوشته‌شده
- `apiWizardColonPathParamExportFix.test.ts`: ۴ تست — resolve `:id` REST endpoint (sanity)، resolve واقعی در `resolveBindingUrl` صادرشده (اجرای واقعی کد استخراج‌شده با `esbuild`+`new Function`، نه فقط string-match)، `resolveBindingUrl` مستقیم، و تست جدید فرم Create-only که تأیید می‌کند `urlParams` برای بارگذاری استنتاجی هم پر می‌شود.
- `autoFormBuilder.test.ts`/`autoFormRuntimeSubmit.test.tsx`/`autoFormBuilderCriticalFixesPhase17.test.tsx`/`bindingRegionEngine.test.ts`/`autoTableBuilder.test.ts`/`autoTableRuntimeSubmit.test.tsx`/`autoCrudPageBuilder.test.ts`/`autoCrudPageRuntimeE2E.test.tsx`: همه سبز، بدون رگرسیون.

### Self-Audit
- اجرای کامل `npx vitest run src/domain/component-designer --pool=forks --no-file-parallelism`: ۳۷ شکست، دقیقاً برابر با baseline شناخته‌شده‌ی قبلی (CultureProvider/react-aria snapshot/pointer-capture) — صفر رگرسیون جدید.
- Typecheck کامل پروژه (`node --max-old-space-size=8192 --stack-size=8000 tsc --noEmit -p .`): ۱۵۲۸ خطا، دقیقاً برابر baseline شناخته‌شده‌ی قبلی — صفر خطای جدید.
- Auto Table Builder (فاز ۱۹) از این تغییر متأثر نیست: مسیر list آن از `bindingGridEngine.ts` (که همیشه `loadOperation: 'list'` صریح ست می‌کند) عبور می‌کند، نه از `resolveRegionLoadConfig` — به‌صورت تجربی هم با اجرای کامل تست‌هایش تأیید شد.

---

# بخش سوم — پاریتی صفحه Users + گپ‌های تأییدشده‌ی اسناد Gap Analysis (نسخه ۴)

## ۰. زمینه و منبع این فازها

این فازها نتیجه‌ی یک بازبینی چهارمرحله‌ای (۴ ایجنت تحقیقاتی موازی، مستقیماً روی کد فعلی) است که به دو سند زیر پاسخ داد:

- `docs/refactor-spec/client-components-gap-analysis-fa.md` (نسخه ۴ — بخش ۲۰ آن مستقیماً منبع این فازهاست)
- `docs/refactor-spec/client-components-per-element-gap-analysis-fa.md` (نسخه ۲)

و به یک تحلیل عمیق و خط‌به‌خط صفحه‌ی واقعی و دستی‌نویس `src/features/users/` در برابر قابلیت‌های فعلی Component Designer، با هدف صریح کاربر: **«قابلیت‌های دیزاینر رو جوری تکمیل کن که بشه دقیق صفحه Users رو با همه اکشن و مودال و ... با دیزاینر با همون دیزاین و قابلیت‌ها ساخت بدون اینکه چیزی از قلم بیفته.»**

هر فاز پروتکل مشترک §۰/§۱ ابتدای همین سند را دنبال می‌کند (tsc baseline → fix → tsc → تست‌های جدید+مرتبط → دیف رگرسیون کامل در برابر baseline خودِ فاز → Self-Audit اجباری → گزارش). فازهای بخش سوم به دو گروه اولویت تقسیم شده‌اند:

- **گروه اول (فاز ۲۴-۳۲):** مسیر بحرانی پاریتی صفحه Users — چون این مستقیماً هدف اعلام‌شده‌ی کاربر است، اول اجرا شود.
- **گروه دوم (فاز ۳۳ به بعد):** بقیه‌ی گپ‌های تأییدشده‌ی دو سند، به ترتیب اولویت 🔴→🟢.

هر فاز دقیقاً یک یا چند آیتم از جدول‌های زیر را می‌پوشاند؛ کدهای Un به تحلیل صفحه Users (بخش ۲۰.۲ سند gap-analysis) و کدهای #n به شماره‌ی گپ در همان سند ارجاع می‌دهند.

### وابستگی‌های ترتیب اجرا (این چند فاز را زودتر از فاز وابسته‌شان اجرا نکن)

اکثر فازهای ۲۴-۵۷ کاملاً مستقل‌اند و به هر ترتیبی قابل‌اجرایند. فقط این موارد وابستگی صریح دارند:

| فاز | وابسته به | چرا |
|---|---|---|
| ۲۹ (اسلات‌های مودال دلخواه) | ۲۴ (Custom Named Operations) | اکشن‌های `confirm` سفارشی (مثل Reset Password) به `callMutation` با عملیات نام‌گذاری‌شده نیاز دارند که فاز ۲۴ می‌سازد |
| ۳۵ (Inline Cell Edit) | ۲۴ | `onCellChange` برای PATCH تکی از همان `mutationOperation` سفارشی فاز ۲۴ استفاده می‌کند |
| ۳۹ (Global Filter Bar) | ۳۷ (onDataPointClick) | Cross-filter روی کلیک چارت بدون رویداد `onDataPointClick` (که فاز ۳۷ اضافه می‌کند) معنا ندارد |
| ۵۱.۲ (Import CSV/Excel) | ۴۶ (Data Connectivity connectorType) | از `connectorType: 'static-file'` که فاز ۴۶ تعریف می‌کند مستقیماً استفاده می‌کند |

اگر می‌خواهید یکی از فازهای ستون چپ را زودتر از فاز ستون وسط اجرا کنید، یا آن قسمت وابسته را موقتاً حذف کنید (مثلاً فاز ۲۹ را بدون اکشن‌های `custom` اجرا کنید)، یا اول فاز وابسته‌شده را اجرا کنید.

---

## فاز ۲۴ — Custom Named REST Operations + تعمیم `callMutation`

**اولویت: 🔴 بحرانی — بزرگ‌ترین مانع منفرد برای پاریتی صفحه Users؛ بدون این فاز، فازهای ۲۵/۲۸/۲۹ هم به بن‌بست می‌خورند.**
**وضعیت: ✅ تکمیل شد (U1)**
**می‌پوشاند:** U1 (سند gap-analysis §۲۰.۲)
**تست رگرسیون:** `src/domain/component-designer/__tests__/customNamedRestOperationsPhase24Fix.test.ts`

### چرا این فاز لازم است (شواهد از کد واقعی)
`DesignerDataResourceOperations` (در `src/domain/component-designer/types.ts`، کنار `DataSourceDefinition`) فقط پنج کلید ثابت دارد: `{ list, detail, create, update, delete }`. `callMutation.mutationOperation` (در `DesignerDynamicAction`) هم فقط می‌تواند به یکی از همین پنج مقدار اشاره کند (`'create' | 'update' | 'delete'` — نگاه کنید `bindingResourceModel.ts`/`bindingMutationRuntime.ts`).

اما صفحه‌ی واقعی Users حداقل ۴ عملیات دارد که هیچ‌کدام این پنج‌تای CRUD نیستند:
- `Change Password` → `POST /api/users/:id/change-password`
- `Reset Password` → `POST /api/users/:id/reset-password`
- `Toggle Lock` → `PATCH /api/users/:id/locked`
- `Update Roles` → `PUT /api/users/:id/roles`

هرکدام از این‌ها یک endpoint/method/body-shape کاملاً متفاوت با CRUD معمول دارند، و هرکدام باید بتوانند از همان زنجیره‌ی موفقیت غنی (`showToast` → `showHide` مودال → `refreshDataSource` گرید) استفاده کنند که `callMutation`/`buildFormSuccessTrueActions` (فاز ۱۷) از قبل برای create/update/delete می‌سازند. بدون این فاز، این ۴ مودال Users (و هر Entity مشابه دیگری با عملیات غیر-CRUD) **اصلاً با هیچ ویزارد/Dynamic Action ای در Designer قابل‌ساخت نیستند.**

### راه‌حل دقیق

**۱. گسترش نوع داده (`types.ts`):**
```ts
// قبل:
type DesignerDataResourceOperations = {
  list?: DesignerDataResourceOperation;
  detail?: DesignerDataResourceOperation;
  create?: DesignerDataResourceOperation;
  update?: DesignerDataResourceOperation;
  delete?: DesignerDataResourceOperation;
};

// بعد — یک Record باز برای عملیات نام‌گذاری‌شده‌ی دلخواه، علاوه بر پنج‌تای شناخته‌شده:
type DesignerDataResourceOperations = {
  list?: DesignerDataResourceOperation;
  detail?: DesignerDataResourceOperation;
  create?: DesignerDataResourceOperation;
  update?: DesignerDataResourceOperation;
  delete?: DesignerDataResourceOperation;
  custom?: Record<string, DesignerDataResourceOperation>; // کلید دلخواه: 'resetPassword', 'changePassword', 'setLocked', 'updateRoles', ...
};
```
`DesignerDataResourceOperation` خودش (endpoint + method) بدون تغییر باقی می‌ماند — فقط محل نگه‌داری‌اش عمومی‌تر می‌شود.

**۲. گسترش `callMutation` (`DesignerDynamicAction`):**
```ts
mutationOperation?: 'create' | 'update' | 'delete' | { custom: string }; // { custom: 'resetPassword' } → operations.custom.resetPassword
```
یا ساده‌تر و سازگارتر با کد فعلی: `mutationOperation?: string` نگه داشته شود (نه union محدود) و یک تابع resolver (`resolveCallMutationOperation` در `bindingResourceModel.ts`) بسازید که ابتدا پنج‌تای شناخته‌شده را چک کند، در غیر این صورت `operations.custom?.[mutationOperation]` را resolve کند. **این گزینه‌ی دوم را ترجیح دهید** چون کمترین تغییر در imprint تایپ موجود را دارد و backward-compatible است (رشته‌های 'create'/'update'/'delete' موجود بدون تغییر کار می‌کنند).

**۳. Inspector UI (`InspectorDynamicActionsField.tsx` یا معادل فعلی آن برای بلوک `callMutation`):**
- دراپ‌داون «Operation» باید علاوه بر Create/Update/Delete، آیتم‌های `operations.custom` دیتاسورس انتخاب‌شده را هم نشان دهد (با لیبل خودشان).
- یک ویرایشگر جدید در پنل تعریف Data Source (کنار ویرایشگرهای list/detail/create/update/delete موجود) برای افزودن/حذف عملیات سفارشی: `{ key, label, method, endpointTemplate }` — دقیقاً با UI مشابه ویرایشگرهای موجود CRUD، فقط `key` به‌جای یک اسم ثابت آزاد است.

**۴. Codegen/Runtime:** `renderDynamicActionExecutionLines`/معادل آن در `bindingCodegen.ts` که در حال حاضر برای `callMutation` مستقیماً `dataSource.operations[mutationOperation]` را می‌خواند، باید حالا از طریق `resolveCallMutationOperation` (بند ۲) بگذرد — همان الگوی URL-templating/method فعلی (که برای create/update/delete کار می‌کند) بدون تغییر برای عملیات سفارشی هم اعمال شود؛ هیچ codegen primitive جدیدی لازم نیست.

### تست‌های موردنیاز
- تست واحد: `resolveCallMutationOperation` برای هر سه حالت (پنج‌تای شناخته‌شده، عملیات سفارشی موجود، عملیات سفارشی ناموجود → خطای واضح در Diagnostics، نه سکوت).
- تست codegen واقعی: یک Data Source با `operations.custom.resetPassword = { method: 'POST', endpoint: '/api/users/:id/reset-password' }` بسازید، یک دکمه با `callMutation({ mutationOperation: 'resetPassword' })` بایند کنید، `generateDesignerTsx` را اجرا کنید، و با `esbuild`+اجرای واقعی fetch mock (مثل الگوی فاز ۲۳) تأیید کنید که درخواست واقعی با متد/URL درست ارسال می‌شود.
- تست رگرسیون: مطمئن شوید `callMutation` با `mutationOperation: 'create'|'update'|'delete'` موجود دقیقاً همان رفتار قبلی را دارد (بدون تغییر رفتار مشاهده‌پذیر).

### Self-Audit
- بررسی کنید که آیا Auto CRUD Page Builder (فاز ۲۰) از این تغییر متأثر می‌شود یا نه — چون آن هم `callMutation` با `mutationOperation: 'delete'` می‌سازد؛ باید بدون تغییر کار کند.
- تأیید کنید که سریال‌سازی/دی‌سریال‌سازی سند (`codegen.ts`'s normalizer، دقیقاً مثل باگی که در فاز ۲۳ برای `loadOperation` پیدا شد) فیلد جدید `operations.custom` را هم درست round-trip می‌کند (ذخیره → بارگذاری → بدون افت داده).

---

## فاز ۲۵ — Session/Current-User Binding + پریست عمومی «ردیف کاربر جاری»

**اولویت: 🔴 بحرانی**
**وضعیت: ✅ تکمیل شد (U5, U6)**
**می‌پوشاند:** U5, U6 (سند gap-analysis §۲۰.۲) — تدقیق گپ #۳۳ (§۱۸.۳ همان سند)

### چرا این فاز لازم است
بررسی کد نشان داد یک مکانیزم پایه از قبل وجود دارد که هیچ سند قبلی به آن اشاره نکرده بود: `visibilityConditionEngine.ts` تابع `inferPrincipalFromDesignerStore`/`designerStoreWithAccessPrincipal` (خطوط ۳۲-۱۱۲) هویت کاربر جاری (`userId`, `email`, `role`) را به‌صورت **ambient** داخل همان `designerStore`ای که به `compileDesignerConditionExpression` پاس داده می‌شود تزریق می‌کند. یعنی از نظر فنی، عبارتی مثل `store.user.id === row.id` **همین الان کار می‌کند** — اما:
1. هیچ `sourceType` رسمی برای bind کردن این اطلاعات روی یک prop دلخواه (مثل نمایش «سلام {نام کاربر}» در یک Text) وجود ندارد؛ فقط در عبارت‌های Visibility/Row-Disable در دسترس است.
2. هیچ preset کلیکی روی این وجود ندارد؛ کاربر باید بداند دقیقاً `store.user.id` و `row.<primaryKey>` را دستی تایپ کند.

این دقیقاً نیاز صفحه Users است: `canDeleteUserRecord` (حذف غیرفعال برای ردیف خودِ کاربر) و منطق مشابه `Login As`.

### راه‌حل دقیق

**۱. `sourceType: 'session'` رسمی (`types.ts`):**
```ts
type DesignerSourceType = 'static' | 'expression' | 'apiRef' | 'store' | 'regionColumn' | 'session';
```
`DesignerBindingDefinition` برای `sourceType: 'session'` یک فیلد `sessionField: 'userId' | 'email' | 'role' | 'displayName'` می‌گیرد (به همان principal موجود در `designerStoreWithAccessPrincipal` نگاشت می‌شود — **هیچ زیرساخت تزریق جدیدی لازم نیست**، فقط یک مسیر binding رسمی روی چیزی که از قبل تزریق می‌شود).
- Runtime: در `bindingEngine.ts`/`bindingCanvasResolver.ts` (هر جا `sourceType`ها resolve می‌شوند)، یک شاخه‌ی جدید که `principal[sessionField]` را از `designerStore` بخواند.
- Codegen: یک عبارت ساده مثل `(designerStore as any)?.user?.[sessionField]` یا معادل typed آن — از همان الگوی موجود در expression compiler برای `store.user.*` استفاده کنید، نه یک مکانیزم جدید.

**۲. Preset عمومی «Disable when current-user owns this row» (`designerGridRowDisableRules.ts`):**
یک preset جدید عمومی (نه هارد‌کد `users-*`) به `DESIGNER_GRID_ROW_DISABLE_PRESET_OPTIONS` اضافه شود: `current-user-row` که پارامتر واحد `matchField` می‌گیرد (کدام فیلد ردیف با `store.user.id` مقایسه شود — پیش‌فرض primaryKey دیتاسورس). داخلاً دقیقاً همان expression موجود (`store.user.id === row.<matchField>`) را می‌سازد اما به‌صورت دراپ‌داون + یک فیلد انتخاب ستون، نه نوشتن دستی expression.

### تست‌های موردنیاز
- تست codegen: یک اکشن ردیف با disable-preset `current-user-row` روی یک دیتاسورس دلخواه (نه Entity به نام users) بسازید و تأیید کنید expression تولیدشده درست کار می‌کند وقتی `designerStore.user.id` با مقدار ردیف برابر/نابرابر است.
- تست `sourceType: 'session'`: یک Text bind شود به `session.displayName`، رندر واقعی (Preview + Export) با یک mock session انجام شود و مقدار درست نمایش داده شود.
- تست رگرسیون: عبارت‌های دستی موجود که از `store.user.*` استفاده می‌کنند (اگر تستی دارند) باید بدون تغییر کار کنند — این فاز چیزی را جایگزین نمی‌کند، فقط یک مسیر رسمی/کلیکی اضافه می‌کند.

### Self-Audit
- تأیید کنید preset جدید `current-user-row` هیچ ارجاع هارد‌کد به کلمه‌ی «users» ندارد — باید برای هر Entity (Products, Orders, …) کار کند.

---

## فاز ۲۶ — فیلترهای عمومی نوار ابزار گرید (چک‌باکس/رادیو روی هر فیلد + منطق تطبیق AND/OR)

**اولویت: 🟠 بالا**
**وضعیت: ✅ تکمیل شد (U9)**
**می‌پوشاند:** U9

### چرا این فاز لازم است
`DesignerGridToolbarConfig` (`designerGridToolbarConfig.ts`) فقط `search`, `roleFilters` (به‌صورت اختصاصی برای کلمه‌ی «roles»)، `create`, `refresh`, `serverQuery` را می‌شناسد. صفحه‌ی واقعی Users در `UserFilterToolbar.tsx` دو نوع فیلتر دارد: چک‌باکس‌گروه نقش (با یک بج منطق تطبیق AND/OR — `ToolbarFilterMatchLogicBadge`/`roleMatchLogic`) و یک رادیوگروه نوع‌شخص (`personTypeOptions`، کاملاً یک فیلد lookup متفاوت). نوع فعلی `roleFilters` نه `matchLogic` دارد نه قابل تعمیم به فیلدی غیر از roles است.

### راه‌حل دقیق
`roleFilters` جایگزین/گسترش داده شود به یک آرایه‌ی عمومی:
```ts
type DesignerGridToolbarFieldFilterConfig = {
  id: string;
  field: string;                  // هر فیلد دلخواه دیتاسورس، نه فقط roles
  label: string;
  controlType: 'checkbox-group' | 'radio-group';
  optionsSource: 'static' | 'lov';  // static: options دستی؛ lov: از یک LOV registry موجود
  options?: { value: string; label: string }[];
  lovRef?: string;
  matchLogic?: 'AND' | 'OR';        // فقط برای checkbox-group معنا دارد
  apiParam: string;
  storePath: string;
};
fieldFilters?: DesignerGridToolbarFieldFilterConfig[];  // جایگزین/مکمل roleFilters قدیمی (backward-compatible: roleFilters به‌عنوان یک fieldFilter با field='roles' مهاجرت کند)
```
- Inspector: `InspectorGridToolbarField.tsx` یک بخش «Field Filters» با دکمه‌ی «Add Filter» که فیلد/نوع کنترل/گزینه‌ها/matchLogic را می‌سازد — دقیقاً الگوی UI موجود برای roleFilters، فقط عمومی‌شده.
- Codegen: `buildGridListQueryParamBindings`/معادل آن `matchLogic` را به شکل query param مناسب تبدیل کند (مثلاً AND → چند پارامتر تکراری با `&`, OR → یک پارامتر comma-separated — هماهنگ با آنچه بک‌اند شما انتظار دارد؛ این باید با یک الگوی موجود مشابه بررسی/هماهنگ شود).

### تست‌های موردنیاز
- تست migration: سند قدیمی با `roleFilters` موجود بعد از بارگذاری باید دقیقاً به یک `fieldFilters` entry با `field: 'roles'` تبدیل شود (بدون افت تنظیمات کاربر).
- تست codegen: یک فیلتر رادیویی روی فیلدی غیر از roles (مثلاً `status`) بسازید و تأیید کنید در URL خروجی exportشده اثر می‌گذارد.

### Self-Audit
- گزارش دهید که آیا Auto Table/CRUD Builder (فاز ۱۹/۲۰) از این تغییر مدل داده متأثر می‌شوند — چون آن‌ها هم `DesignerGridToolbarConfig` تولید می‌کنند؛ باید بدون تغییر رفتار قبلی‌شان کامپایل و اجرا شوند.

---

## فاز ۲۷ — Rich Cell جدید icon-from-lookup + ارتقای دقت رندر chips

**اولویت: 🟠 بالا**
**می‌پوشاند:** U10, U11

### چرا این فاز لازم است
`DESIGNER_GRID_RICH_CELL_KINDS` فعلی: `avatar, account, link, chips, audit, lock-status`. هیچ‌کدام ستون‌هایی مثل `person_type`/آیکون جنسیت صفحه Users را پوشش نمی‌دهند — این‌ها آیکون/HTML را از یک `BaseInfoOption.uiHtml` (یک منبع lookup داینامیک) با Tooltip می‌خوانند. همچنین کایند موجود `chips` در `designerGridRichCellRuntime.tsx` فقط رنگ ADMIN=indigo/بقیه=slate را می‌شناسد — نسخه‌ی واقعی Users یک پالت هش هشت‌رنگی، کوتاه‌سازی برچسب به ۳ حرف، Tooltip روی مقدار کامل، و افکت هم‌پوشانی چیپ‌ها دارد.

### راه‌حل دقیق

**۱. کایند جدید `icon-from-lookup`:**
```ts
type RichCellIconFromLookupConfig = {
  lookupSource: string;       // ارجاع به یک LOV/BaseInfo registry موجود
  valueField: string;         // فیلد ردیف که به یک آیتم lookup نگاشت می‌شود
  showTooltip: boolean;
  fallbackIcon?: string;
};
```
رندر واقعی (`designerGridRichCellRuntime.tsx`) مقدار فیلد را در نتایج lookup پیدا کند، `uiHtml`/آیکون متناظر را نمایش دهد، و اگر `showTooltip` باشد یک Tooltip با لیبل کامل نشان دهد — دقیقاً همان الگوی رندر ستون `person_type` واقعی Users، فقط عمومی‌شده برای هر lookup دلخواه.

**۲. ارتقای `chips` cell:**
- افزودن `colorMode: 'fixed-two-tone' | 'hash-palette'` (پیش‌فرض `fixed-two-tone` برای سازگاری با رفتار فعلی).
- در حالت `hash-palette`: از همان الگوریتم هشِ رنگ واقعی Users (`getRoleChipClass`) که یک پالت ۸ رنگی با استثنای ADMIN/DEVELOPER دارد استفاده کنید (کپی/انتقال منطق، نه بازنویسی).
- افزودن `truncateLabelChars?: number` (کوتاه‌سازی با «…» یا حروف اول)، `showTooltipOnTruncate: boolean`، و یک استایل هم‌پوشانی اختیاری (`overlapMode: boolean`) با margin منفی و border سفید مطابق نسخه واقعی.

### تست‌های موردنیاز
- تست رندر واقعی (`render`+اسنپ‌شات یا assertion روی DOM): یک ستون `icon-from-lookup` با یک lookup نمونه bind شود و آیکون/Tooltip درست رندر شود.
- تست رندر `chips` در حالت `hash-palette`: چند مقدار مختلف نقش bind شود و رنگ/کوتاه‌سازی/Tooltip طبق الگوریتم هش تأیید شود؛ و یک تست جداگانه تأیید کند حالت پیش‌فرض (`fixed-two-tone`) دقیقاً همان رفتار قبل از این فاز را دارد (بدون رگرسیون بصری).

### Self-Audit
- بررسی کنید Inspector هر دو کایند جدید (`icon-from-lookup` و گزینه‌های جدید `chips`) را به‌درستی expose می‌کند (`InspectorGridRichCellFields.tsx`).

---

## فاز ۲۸ — عنصر Roles-Assignment (چک‌باکس‌گروه چندانتخابی داینامیک)

**اولویت: 🟠 بالا**
**وضعیت: ✅ تکمیل شد (U7)**
**می‌پوشاند:** U7

### چرا این فاز لازم است
هیچ عنصر آماده‌ای در پالت معادل چک‌باکس‌گروه انتخاب چندتایی «نقش‌ها» با گزینه‌های داینامیک از یک منبع (نه یک لیست ثابت هاردکد) وجود ندارد. `heroui.checkbox-group` عمومی است ولی گزینه‌هایش استاتیک تعریف می‌شوند، نه از یک API/LOV.

### راه‌حل دقیق
یک عنصر جدید (یا یک preset/mode روی `heroui.checkbox-group` موجود — ترجیحاً یک mode جدید به‌جای عنصر کاملاً تازه، برای جلوگیری از تورم Toolbox): `optionsSource: 'lov' | 'apiRef'` روی `heroui.checkbox-group` که گزینه‌ها را از یک Data Source/LOV موجود بخواند (دقیقاً همان الگوی `heroui.entity-picker`/`heroui.autocomplete` که از قبل از API گزینه می‌خوانند). مقدار انتخاب‌شده (چند-مقداری) به یک فیلد آرایه‌ای (مثل `roleIds: string[]`) در payload فرم bind شود.

### تست‌های موردنیاز
- تست codegen/runtime: یک `heroui.checkbox-group` با `optionsSource: 'apiRef'` bind شود به یک لیست نقش نمونه، مقادیر چندتایی انتخاب و submit شوند، و payload نهایی آرایه‌ی درست را داشته باشد.

### Self-Audit
- تأیید کنید این تغییر به `heroui.checkbox-group` موجود، رفتار حالت `optionsSource: 'static'` فعلی (پیش‌فرض) را دست‌نخورده نگه می‌دارد.

**رفع (U7):** `heroui.checkbox-group` گزینه‌ی Inspector `optionsSource` (`static`/`lov`/`apiRef`) گرفت؛ export از `resolveNodeOptionItemsDataExpression` + `renderDesignerItemsMapperExpression` برای items داینامیک (مثل listbox/dropdown)؛ preview از `useDesignerOptionItems` + `resolveChoiceGroupSelectedValues` برای آرایه‌های region؛ submit با `commaSeparatedArray` در `resolveDefaultRegionFieldTransform`. تست: `rolesAssignmentCheckboxGroupPhase28Fix.test.tsx`. حالت `static` بدون binding همچنان فقط گزینه‌های ثابت export می‌کند.

---

## فاز ۲۹ — Auto CRUD Page Builder: اسلات‌های مودال دلخواه (N به‌جای ۳ ثابت)

**اولویت: 🔴 بحرانی**
**می‌پوشاند:** U3

### چرا این فاز لازم است
`AutoCrudPageActions` (`autoCrudPageBuilder.ts`) فقط سه بولین ثابت دارد: `{ create: boolean; edit: boolean; delete: boolean }`. صفحه Users به ۷ اکشن ردیف نیاز دارد (Edit Profile/Roles/Attributes/Function-Access/Change-Password/Reset-Password/Lock/Delete). زیرساخت زیرین (`open-modal` behavior با `modalNodeId`+`primaryKeyField`+`selectionStorePath`) از قبل عمومی و قدرتمند است و به تعداد دلخواه مودال با محتوای دلخواه پشتیبانی می‌کند — فقط **سطح ویزارد خودکار** به این سه‌تای ثابت محدود است.

### راه‌حل دقیق
```ts
type AutoCrudCustomAction = {
  key: string;                          // 'resetPassword', 'changePassword', 'assignRoles', ...
  label: string;
  icon?: string;
  modalKind: 'form' | 'confirm';        // form: فرم Auto Form Builder با scenario دلخواه؛ confirm: alert-dialog با callMutation
  formConfig?: AutoFormBuildConfig;     // اگر modalKind='form' — دقیقاً از منطق فاز ۱۷ (mergeAutoFormIntoDocument) استفاده مجدد شود
  confirmConfig?: { message: string; mutationOperation: string; successBehaviors: FormBindingSuccessBehavior[] }; // اگر modalKind='confirm'
};

type AutoCrudPageActions = {
  create: boolean;
  edit: boolean;
  delete: boolean;
  custom?: AutoCrudCustomAction[];       // جدید
};
```
`buildAutoCrudPageDocument`/`wireGridCrudBehaviors` باید برای هر آیتم `custom`، دقیقاً همان الگوی موجود برای Edit (یک modal + `open-modal` behavior + `selection.<pk>`) یا Delete (یک `alert-dialog` + `callMutation` زنجیره‌شده با فاز ۲۴) را تکرار کند — **کد جدید تولید‌کننده نباید نوشته شود؛ الگوی موجود پارامتری شود.**

Inspector/UI ویزارد (`AutoCrudWizardDialog.tsx`): مرحله‌ی Actions فعلی (که create/edit/delete را نشان می‌دهد) یک بخش «Custom Actions» با دکمه‌ی «Add Action» بگیرد که برای هرکدام modalKind/label/icon/config بپرسد.

### تست‌های موردنیاز
- تست ساخت واقعی: یک Auto CRUD document با یک `custom` action از نوع `confirm` (شبیه Reset Password، با `callMutation` از فاز ۲۴) بسازید و تأیید کنید مودال + دکمه + زنجیره‌ی اکشن درست تولید می‌شود (نه فقط ساختار سند، بلکه codegen واقعی + اجرای mock fetch).
- تست: یک `custom` action از نوع `form` (شبیه Assign Roles، با فرم فاز ۲۸) بسازید و تأیید کنید `selection.<pk>` درست به فرم پاس داده می‌شود (همان الگوی Edit موجود).

### Self-Audit
- تأیید کنید افزودن N اسلات دلخواه، مسیر موجود create/edit/delete (که فاز ۲۰ تست کرده) را دست‌نخورده نگه می‌دارد — فقط یک قابلیت افزایشی است.

---

## فاز ۳۰ — مکانیزم واقعی Multi-step Wizard Form (+ اتصال content.stepper)

**اولویت: 🟠 بالا**
**می‌پوشاند:** U4؛ = گپ #۶ سند gap-analysis؛ = ردیف #۱۶ سند per-element (اتصال `content.stepper`)

### چرا این فاز لازم است
`content.stepper` (`designerUniversalPalette.ts`) فقط `steps, activeStep` دارد و رندرش (`DesignerRuntimeUniversalWidgets.tsx`) صرفاً یک `<ol>` برچسب‌دار است — هیچ اتصالی به state واقعی فرم، gating اعتبارسنجی هر مرحله، یا submit-فقط-در-آخرین-مرحله ندارد. `UserCreateWizardModal.tsx` (نمونه‌ی واقعی و کارکردی) سه مرحله (Membership→Profile→Roles) با `StepWizardShell` دارد که هر `onNext` می‌تواند مسدود شود اگر اعتبارسنجی مرحله‌ی فعلی رد نشود. Auto Form Builder فقط سناریوهای `'create' | 'edit'` تک‌مرحله‌ای می‌سازد.

### راه‌حل دقیق
یک سناریوی جدید در Auto Form Builder: `scenario: 'wizard'` با `AutoFormBuildConfig` گسترش‌یافته:
```ts
wizardSteps?: {
  title: string;
  fields: AutoFormFieldConfig[];        // زیرمجموعه‌ای از fields کلی که در این مرحله نمایش داده می‌شوند
}[];
```
`buildAutoFormSeeds`/`buildAutoFormDocument` برای این سناریو:
- به‌جای یک `html.form` تخت، یک ساختار state-machine مبتنی بر `storeSegments` (فاز موجود — نگاه کنید اصلاح گپ #۲ در سند gap-analysis) بسازد: یک `storeSegment` برای `currentStepIndex`.
- هر step را در یک `logic.visibility-container` با شرط `currentStepIndex === N` قرار دهد (از موتور Visibility موجود استفاده مجدد، نه بازسازی).
- دکمه‌ی «Next» هر مرحله یک Dynamic Action زنجیره‌ای بگیرد: (۱) اعتبارسنجی فیلدهای همان مرحله (از فاز ۳۱ — Cross-field/per-field validation) → اگر پاس نشد متوقف شود، (۲) `setValue` روی `storeSegment` مرحله برای `currentStepIndex + 1`.
- دکمه‌ی Submit فقط در آخرین مرحله ظاهر شود و دقیقاً از منطق submit موجود (`resolveRegionSubmitPlanForEvent`) استفاده کند.
- `content.stepper` موجود (که از قبل در Canvas زنده هیدراته می‌شود — فاز ۱۴) به همان `storeSegment` مرحله bind شود تا `activeStep` را واقعی نشان دهد (نه صرفاً تزئینی) — این دقیقاً رفع ردیف #۱۶ سند per-element است.

### تست‌های موردنیاز
- تست ساخت + رندر واقعی: یک فرم `scenario: 'wizard'` با ۳ مرحله بسازید، با `fireEvent` بین مراحل حرکت کنید، تأیید کنید مرحله‌ی بعد با فیلد نامعتبر مسدود می‌شود، و submit نهایی فقط در آخرین مرحله و با تمام مقادیر جمع‌شده‌ی همه‌ی مراحل ارسال می‌شود (نه فقط مرحله‌ی آخر).
- تست `content.stepper` real hydration: تأیید کنید `activeStep` واقعاً با پیشرفت کاربر در Canvas/Preview همگام می‌شود.

### Self-Audit
- تأیید کنید سناریوهای موجود (`create`/`edit`/`detail`/`search`) این فاز را نمی‌شکنند — `wizard` صرفاً یک شاخه‌ی جدید در `resolveLoadConfig`/`buildAutoFormSeeds` است.

---

## فاز ۳۱ — موتور Cross-Field Validation

**اولویت: 🟠 بالا**
**می‌پوشاند:** U12؛ = گپ #۸ سند gap-analysis

### چرا این فاز لازم است
هیچ ساختار validation rule‌ای که چند فیلد را به هم مرتبط کند (مثل «پسورد و تکرار پسورد باید برابر باشند» در `Change Password` واقعی Users، یا «تاریخ پایان > تاریخ شروع») در `DesignerBindingDefinition` یا `autoFormTemplateBuilder.ts` وجود ندارد — فقط اعتبارسنجی per-field (required/min/max/pattern روی خود input).

### راه‌حل دقیق
یک فیلد جدید در سطح `html.form`/region: `crossFieldValidationRules: CrossFieldRule[]`:
```ts
type CrossFieldRule = {
  id: string;
  fields: string[];             // فیلدهای درگیر
  rule: 'equals' | 'notEquals' | 'greaterThan' | 'lessThan' | 'expression';
  expression?: string;           // برای rule='expression' — از همان compileDesignerConditionExpression موجود استفاده مجدد شود (فاز مجزا لازم نیست، فقط context آن به فیلدهای فرم گسترش یابد)
  errorMessageKey: string;       // i18n
  appliesTo: string;             // کدام فیلد پیام خطا را نمایش دهد
};
```
اجرای واقعی: در همان لحظه‌ی submit (و اختیاری: on-blur هر فیلد درگیر)، قوانین ارزیابی شوند؛ اگر رد شدند، submit متوقف شود و پیام خطا کنار فیلد `appliesTo` نمایش داده شود (از همان الگوی نمایش خطای per-field موجود استفاده شود، نه یک مکانیزم UI جدید).

### تست‌های موردنیاز
- تست runtime واقعی: یک فرم با دو فیلد پسورد + قانون `equals` بسازید، مقادیر نابرابر تایپ کنید، تأیید کنید submit واقعاً مسدود می‌شود و پیام خطا رندر می‌شود؛ سپس مقادیر برابر کنید و تأیید کنید submit عبور می‌کند.

### Self-Audit
- تأیید کنید این مکانیزم به فرم‌های بدون هیچ `crossFieldValidationRules` (اکثریت فرم‌های موجود) هیچ تأثیری ندارد (رفتار پیش‌فرض بدون تغییر).

---

## فاز ۳۲ — تصمیم‌های محصولی پاریتی Users: Login-As (✅ گزینه الف — بدون کد) + فرم اتریبیوت داینامیک و Function-Access Modal (✅ بسته)

**اولویت: — (همه‌ی ۳ زیربخش بسته شدند — هیچ کد جدیدی لازم نیست.)**
**وضعیت: ✅ تکمیل شد**
**می‌پوشاند:** U2 (بسته ✅ — گزینه الف)، U8 و U13 (بسته‌شده ✅)

### ۳۲.۱ — Login As (U2) — ✅ بسته شد: گزینه الف (بدون کد جدید)
عملیات session-swap + redirect. **تصمیم نهایی (تأییدشده توسط کاربر، ۲۹ جولای ۲۰۲۶):** گزینه الف انتخاب شد — Login As رسماً از دامنه‌ی «Dynamic Action عمومی» خارج نگه داشته می‌شود. مکانیزم موجود «manual event binding» (`InspectorEventBindingPanel.tsx`) برای این مورد کافی است (کاربر endpoint session-swap را دستی وایر می‌کند). **هیچ فاز اجرایی یا کد جدیدی لازم نیست.**

### ۳۲.۲ — فرم داینامیک بر اساس Attribute Schema (U8) — ✅ بسته شد: خارج از محدوده
معادل `AttributeValuesForm`/`useUserAttributesQuery`/`useUserSessionPreviewQuery` — یک زیرسیستم کامل schema-driven-form-from-endpoint با پیش‌نمایش session. **تصمیم نهایی (تأییدشده مستقیماً توسط کاربر):** این قابلیت برای پاریتی صفحه Users لازم نیست و از کل نقشه‌راه فازهای اجرایی حذف شد. این یک قابلیت بسیار خاص «attribute مدیریتی» است که فقط Users و شاید چند Entity سیستمی دیگر دارند — پیاده‌سازی‌اش در Designer عمومی برای ارزش فعلی بیش از حد بزرگ بود. **هیچ فاز اجرایی برای این مورد نوشته نشده و نباید نوشته شود، مگر تصمیم محصولی آینده آن را دوباره باز کند.**

### ۳۲.۳ — Widget معادل EntityFunctionAccessModal (U13) — ✅ بسته شد: خارج از محدوده
گرید Allow/Deny/None با فولدربندی/جستجو برای کنترل دسترسی توابع سرور — این کاملاً متفاوت از «Node Visibility Access» موجود Designer (که نمایش کامپوننت در اپ *ساخته‌شده* را کنترل می‌کند، نه دسترسی به توابع سرور). **تصمیم نهایی (تأییدشده مستقیماً توسط کاربر):** این قابلیت برای پاریتی صفحه Users لازم نیست و از کل نقشه‌راه فازهای اجرایی حذف شد — همچنین به دلیل ریسک امنیتی (اگر یک کاربر Designer بتواند RBAC واقعی پلتفرم را از داخل یک صفحه‌ی ساخته‌شده تغییر دهد) این تصمیم به‌طور خاص درست هم بود. **هیچ فاز اجرایی برای این مورد نوشته نشده و نباید نوشته شود.**

**نتیجه:** با بسته‌شدن هر سه زیربخش (۳۲.۱ گزینه الف، ۳۲.۲ خارج از محدوده، ۳۲.۳ خارج از محدوده)، فازهای ۲۴-۳۲ اکنون **تمام** آنچه برای پاریتی کامل صفحه Users لازم است را پوشش می‌دهند — هیچ نیاز کشف‌شده‌ی دیگری از تحلیل صفحه Users باقی نمانده است.

---

## فاز ۳۳ — رفع امنیتی: `html.link` rel=noopener خودکار + `html.iframe` sandbox

**اولویت: 🔴 بحرانی (امنیتی) — ارزان و پرریسک اگر نادیده گرفته شود.**
**می‌پوشاند:** ردیف #۲ و #۳ جدول §۱۴ سند per-element

### چرا این فاز لازم است
- `html.link`: در `designerRuntimePreview.tsx:673-684`، مقدار `rel` صرفاً از پراپ خام/بایندینگ خوانده می‌شود؛ هیچ منطق شرطی «اگر `target==='_blank'` آنگاه `rel` را به `noopener noreferrer` تزریق کن» وجود ندارد. این یک حفره‌ی کلاسیک Reverse Tabnabbing روی هر لینک خروجی هر صفحه‌ی منتشرشده است.
- `html.iframe`: `catalog.ts:122-132` (`defaultProps: src, title, width, height, allowFullScreen, className`) و `PALETTE_IFRAME_FIELDS` (`inspectorPaletteFields.ts:308-314`) هیچ فیلد `sandbox` ندارند — یک iframe جاسازی‌شده بدون هیچ محدودیت sandbox رندر می‌شود.

### راه‌حل دقیق
- **html.link:** در نقطه‌ی رندر مشترک لینک (هم `designerRuntimePreview.tsx`، هم Export codegen) — قبل از نوشتن `rel` نهایی: اگر `target === '_blank'` و کاربر `rel` را صریحاً ست نکرده، مقدار پیش‌فرض `"noopener noreferrer"` inject شود؛ اگر کاربر مقدار دیگری صریحاً داده، override او محترم شمرده شود (فقط پیش‌فرض امن باشد، نه اجباری).
- **html.iframe:** فیلد جدید `sandbox: string[]` (چک‌باکس‌های استاندارد HTML: `allow-scripts`, `allow-same-origin`, `allow-forms`, `allow-popups`, ...) به `PALETTE_IFRAME_FIELDS` و `catalog.ts` defaultProps اضافه شود؛ مقدار پیش‌فرض یک زیرمجموعه‌ی محدود و امن (نه خالی/بدون محدودیت). رندر واقعی این مقادیر را به‌صورت `sandbox="value1 value2"` روی تگ `<iframe>` بنویسد. یک فیلد `loading: 'lazy'|'eager'` (پیش‌فرض `lazy`) هم در همین فاز اضافه شود (کم‌هزینه، هم‌راستا).

### تست‌های موردنیاز
- تست codegen/runtime واقعی: یک `html.link` با `target: '_blank'` و بدون `rel` صریح → خروجی HTML/TSX باید `rel="noopener noreferrer"` داشته باشد؛ یک نمونه‌ی دیگر با `rel` صریح متفاوت → مقدار کاربر حفظ شود.
- تست: یک `html.iframe` بدون `sandbox` صریح → مقدار پیش‌فرض امن اعمال شود؛ با `sandbox` صریح → دقیقاً همان مقادیر انتخاب‌شده در خروجی باشند.

### Self-Audit
- grep نهایی روی کل کدجن برای اطمینان از این‌که هیچ مسیر دیگری (Preview جدا از Export) این تزریق پیش‌فرض را دور نمی‌زند.

---

## فاز ۳۴ — Property Exposure سریع: heading level، tabs/breadcrumbs items، slider range، دکمه/چیپ/دراپ‌داون icon

**اولویت: 🟠 بالا — همه‌ی این‌ها کم‌هزینه‌اند (فقط Catalog+Inspector+Runtime، بدون بازسازی معماری) و اثر مستقیم روی «حس کامل‌بودن» فیچر دارند.**
**وضعیت: ✅ تکمیل شد (آیتم‌های ۳۴.۱–۳۴.۵)**
**می‌پوشاند:** ردیف‌های #۱، #۶، #۷، #۸ جدول §۱۴ سند per-element + بخش Cross-Cutting §۱.۵
**تست رگرسیون:** `propertyExposurePhase34Fix.test.tsx`

### ۳۴.۱ — `html.heading` — فیلد `level`
`catalog.ts:89-98` فقط `text/className` دارد؛ رندر همیشه هارد-کد `<h2>` است (`designerRuntimePreview.tsx:655-660`, `tsxComponentRegistry.ts:330-331: case 'heading': return 'h2'`). فیلد جدید `level: 'h1'|'h2'|'h3'|'h4'|'h5'|'h6'` (پیش‌فرض `h2` برای سازگاری عقب‌رو) به defaultProps+Inspector اضافه و در هر دو نقطه‌ی رندر مصرف شود.

### ۳۴.۲ — `heroui.tabs` — فیلد ساختاریافته `items`
`catalog.ts:1032-1041` فقط `className` دارد؛ `inspectorPaletteFields.ts:1162` فیلدهایش کاملاً خالی است (`[]`). فیلد جدید `items: { key: string; label: string; contentNodeRef?: string }[]` اضافه شود — هر آیتم به یک زیر-نود Canvas (کانتینر محتوای همان تب) ارجاع دهد، دقیقاً هماهنگ با نحوه‌ی کار Tabs در HeroUI (کنترل‌شده با `selectedKey`). این باید امکان ساخت N تب از Inspector (بدون drag/drop دستی هر Tab Panel) را بدهد.

### ۳۴.۳ — `heroui.breadcrumbs` — فیلد `items`
همان الگو: `catalog.ts:1043-1052` فقط `className`؛ فیلد `items: { label: string; href?: string; isCurrent?: boolean }[]` اضافه شود.

### ۳۴.۴ — `heroui.slider` — حالت Range/Dual-thumb
`inspectorPaletteFields.ts:1081-1089` فقط `value, min, max, step` تک‌مقداری. HeroUI native خودش dual-thumb را پشتیبانی می‌کند (Property Exposure ناقص، نه یک قابلیت غایب در کتابخانه پایه). فیلدهای جدید: `mode: 'single'|'range'`, `minValue`/`maxValue` (برای حالت range، جایگزین `value` تکی)، `marks: {value, label}[]`، `showTooltip: boolean`.

### ۳۴.۵ — `startIcon`/`endIcon` روی button-solid/button-outline/chip/dropdown
`HEROUI_BUTTON_FIELDS` فقط `variant, size`؛ `HEROUI_CHIP_FIELDS` (خط ۸۰۰) فقط `variant, color, size`؛ `HEROUI_DROPDOWN_FIELDS` (خط ۲۸۶) فقط `label, items, isDisabled`. فیلدهای `startIcon?: string`/`endIcon?: string` (نام آیکون از همان کتابخانه‌ی آیکون موجود پروژه) به هر سه اضافه شود؛ برای دکمه، حالت `iconOnly: boolean` هم اضافه شود (با الزام `ariaLabel` وقتی `iconOnly=true` و `text` خالی است).

### تست‌های موردنیاز
- برای هرکدام حداقل یک تست codegen/runtime که مقدار جدید را واقعاً در خروجی رندرشده/exportشده تأیید کند (نه فقط وجود فیلد در تایپ).
- تست رگرسیون: مقدار پیش‌فرض هرکدام (h2، تک‌مقداری، بدون آیکون) رفتار فعلی موجود را حفظ کند.

### Self-Audit
- برای `heroui.tabs`/`breadcrumbs`: تأیید کنید این الگوی «فقط generic props» که سند per-element آن را «سیستماتیک» توصیف کرده (`heroui.toolbar` هم همین مشکل را دارد) در فاز‌های بعدی هم رصد شود.

---

## فاز ۳۵ — گسترش گرید: Pin ستون، Bulk Actions Toolbar، Inline Cell Edit

**اولویت: 🔴 بحرانی — این‌ها الگوهای بسیار پرتکرار پنل ادمین‌اند (بخصوص Bulk Actions که خودِ صفحه Users هم به آن اشاره غیرمستقیم دارد).**
**وضعیت: ✅ تکمیل شد**
**می‌پوشاند:** بخشی از ردیف #۵ جدول §۱۴ سند per-element (بخش‌های واقعاً غایب، بعد از تدقیق: Pin/Bulk/Inline-Edit/Grouping — Grouping در فاز ۳۶ پوشش داده می‌شود)

### چرا این فاز لازم است
تأیید شد: Resize و Reorder و Multi-select از قبل در `DesignerDataGridColumn`/`HEROUI_TABLE_FIELDS` وجود دارند. اما:
- **Pin/Freeze:** هیچ `layoutPinned` در `DesignerDataGridColumn` نیست.
- **Bulk Actions:** `designerGridToolbarConfig.ts` هیچ اکشن دسته‌جمعی ندارد؛ حتی `onSelectionChange` برای هیچ‌کدام از سه گرید در `bindingEngine.ts` سیم‌کشی نشده — یعنی حتی اگر `selectionMode: 'multiple'` فعال باشد، هیچ کد بایندینگی از انتخاب چندتایی مطلع نمی‌شود.
- **Inline Edit:** `DesignerDataGridColumn` فاقد `editable`/`cellEditor` است.

### راه‌حل دقیق
- `DesignerDataGridColumn.layoutPinned?: 'left' | 'right'` — در رندر واقعی گرید (Canvas/Preview/Export) به `position: sticky` + `left`/`right` محاسبه‌شده و `z-index` مناسب map شود.
- `onSelectionChange` به Event Eligibility Matrix (`bindingEngine.ts`) برای هر سه گرید اضافه شود؛ مقدار انتخاب‌شده (آرایه‌ی primaryKeyها) در یک `storeSegment` نوشته شود.
- یک بخش جدید در `DesignerGridToolbarConfig`: `bulkActions: DynamicAction[]` که فقط وقتی `selectedKeys.length > 0` باشد (از همان `storeSegment` بالا) در Toolbar ظاهر شود — هر اکشن از همان Dynamic Actions موجود (`callMutation` تکرارشونده روی هر id انتخابی، یا یک اکشن سرور که آرایه‌ی id می‌گیرد) استفاده کند.
- `DesignerDataGridColumn.editable?: boolean` + `cellEditorPaletteItemId?: string` (کدام کنترل ادیت داخل سلول رندر شود — input-text/select/…)؛ `onCellChange` یک Dynamic Action زنجیره‌ای (`callMutation` با mutationOperation از فاز ۲۴ برای PATCH تکی) صدا بزند.

### تست‌های موردنیاز
- تست رندر: ستون با `layoutPinned: 'left'` هنگام اسکرول افقی گرید ثابت بماند (تست باید عرض/موقعیت واقعی DOM را بررسی کند، نه فقط وجود کلاس).
- تست runtime: انتخاب چند ردیف → دکمه‌ی Bulk Action ظاهر شود → کلیک → `callMutation` برای هر ردیف انتخابی صدا زده شود (mock fetch call count = تعداد انتخاب‌شده).
- تست inline edit: تغییر مقدار یک سلول ادیت‌پذیر → `onCellChange` صدا زده شود → مقدار جدید در payload درست باشد.

### Self-Audit
- تأیید کنید افزودن `onSelectionChange` رفتار موجود `selectionMode: 'multiple'` (که از قبل کار می‌کرد ولی بدون اثر بایندینگی) را نمی‌شکند.

---

## فاز ۳۶ — Aggregation/GroupBy/Pivot/Subtotal گرید

**اولویت: 🔴 بحرانی — بزرگ‌ترین شکاف باقی‌مانده برای ادعای «هر گزارشی».**
**وضعیت: ✅ تکمیل شد**
**می‌پوشاند:** §۱۹.۴ سند gap-analysis

### چرا این فاز لازم است
جست‌وجوی مستقیم `aggregation`, `groupBy`, `pivot`, `summary row`, `totals row` در `bindingGridEngine.ts`/`designerDataGridColumns.ts` صفر نتیجه داشت. یعنی در معماری فعلی هیچ گریدی نمی‌تواند ردیف‌ها را گروه‌بندی کند، یک ردیف Subtotal زیر هر گروه یا Grand Total در پایین نشان دهد، یا یک نمای Pivot (ردیف×ستون×مقدار تجمیعی) بسازد. تقریباً هر گزارش مدیریتی واقعی (فروش بر استان، هزینه بر دپارتمان) به این نیاز دارد، نه فقط یک لیست خام صفحه‌بندی‌شده.

### راه‌حل دقیق (schema پیشنهادی سند، تأییدشده به‌عنوان قابل‌اجرا روی معماری فعلی)
```typescript
type GridAggregationConfig = {
  groupByFields?: string[];
  aggregations: { field: string; fn: 'sum'|'avg'|'count'|'min'|'max'; label: string; format?: 'currency'|'percent'|'number' }[];
  showSubtotalPerGroup?: boolean;
  showGrandTotal?: boolean;
  collapsibleGroups?: boolean;
  pivotMode?: { rowField: string; columnField: string; valueField: string; aggFn: 'sum'|'avg'|'count' };
};
```
به‌عنوان یک فیلد جدید کنار `columns` در `heroui.app-table-grid` (اولویت این المنت، بعداً قابل تعمیم به بقیه). دو حالت اجرا:
- **Client-side** (`gridQueryMode: 'client'`): محاسبه روی همان داده‌ی صفحه‌ی فعلی در Runtime (یک تابع pure جدید `applyGridAggregation(rows, config)` در `designerDataGridRuntime.ts`، مشابه الگوی `resolveDataGridTotalCount` موجود).
- **Server-side** (`gridQueryMode: 'server'`): پارامترهای aggregation به query string اضافه شوند (مشابه الگوی `responseMapping`/query-param فعلی)، و پاسخ سرور با شکل توافقی (`{ groups: [...] }`) parse شود.

### تست‌های موردنیاز
- تست واحد pure: `applyGridAggregation` روی چند سناریو (تک‌سطحی، چندسطحی groupBy، pivot) با نتایج دستی محاسبه‌شده مقایسه شود.
- تست رندر: Subtotal/Grand Total ردیف‌ها واقعاً در DOM ظاهر شوند و مقدار درست را نشان دهند.

### Self-Audit
- تأیید کنید غیاب `GridAggregationConfig` (پیش‌فرض) هیچ تغییری در رفتار جدول‌های موجود ایجاد نمی‌کند.

---

## فاز ۳۷ — Field Mapping اختصاصی نوع چارت + Gauge واقعی + onDataPointClick

**اولویت: 🟠 بالا**
**وضعیت: ✅ تکمیل شد**
**می‌پوشاند:** §۱۹.۱ سند gap-analysis؛ ردیف #۱۱ و #۱۲ جدول §۱۴ سند per-element

### چرا این فاز لازم است
- تأیید شد: `BindingChartWizardDialog.tsx` یک ویزارد واحد با `DesignerChartFieldMapping = { categoryField, categoryAs?, series[] }` برای **همه‌ی** چهار نوع چارت (bar/line/pie/sparkline) دارد — کاملاً type-agnostic، برخلاف `visualizationDataTransform.ts` که برای Viz (Gantt/Kanban/Sheet/Timeline/Tree) از قبل discriminated union دارد (فاز‌های ۱۹/۲۰ آن را درست کردند؛ چارت‌ها هنوز نه).
- `viz.chart-pie`: `VIZ_CHART_PIE_FIELDS` فقط `chartVariant('pie'|'donut'|'gauge')` را می‌شناسد بدون `min/max/thresholds`؛ رندر واقعی (`DesignerRuntimeCharts.tsx:93-94,271-284`) مقدار Gauge را با `Math.min(100, Math.max(0, value))` هارد-کد بین ۰-۱۰۰ کلمپ می‌کند — «Gauge» فقط یک اسم بدون تنظیمات واقعی بازه/رنگ‌بندی آستانه است.
- `viz.chart-*`: هیچ‌کدام `onDataPointClick` در `DESIGNER_EVENT_BINDING_TARGETS` (`bindingEngine.ts:88-101`) ندارند — این پیش‌نیاز مستقیم Drill-down/Cross-filter (فاز ۳۹) است.

### راه‌حل دقیق
`ChartFieldMapping` به یک discriminated union بر اساس `chartType` تبدیل شود (schema دقیق پیشنهادی سند gap-analysis §۱۹.۱ — کپی مستقیم):
```typescript
type ChartFieldMapping =
  | { chartType: 'bar' | 'line'; categoryField: string; valueFields: { field: string; label: string; color?: string; axis?: 'primary'|'secondary' }[]; seriesGroupField?: string; sortBy?: {...}; limitTopN?: {...} }
  | { chartType: 'pie' | 'donut' | 'gauge'; labelField: string; valueField: string; gaugeMin?: number; gaugeMax?: number; gaugeThresholds?: { value: number; color: string }[] }
  | { chartType: 'sparkline'; valueField: string; compareField?: string };
```
`BindingChartWizardDialog.tsx` باید بر اساس نوع المنت انتخاب‌شده، Step «Field Mapping» را شرطی رندر کند (نه یک فرم عمومی ثابت). رندر Gauge واقعی از `gaugeMin`/`gaugeMax`/`gaugeThresholds` استفاده کند به‌جای کلمپ هارد-کد ۰-۱۰۰.
`onDataPointClick` به `DESIGNER_EVENT_BINDING_TARGETS` برای هر ۴ نوع چارت اضافه شود؛ payload کلیک (مقدار category/series کلیک‌شده) در دسترس Dynamic Actions قرار گیرد.

### تست‌های موردنیاز
- تست Inspector: انتخاب `viz.chart-pie` با `chartVariant: 'gauge'` باید فیلدهای `gaugeMin/gaugeMax/gaugeThresholds` را نشان دهد؛ انتخاب `viz.chart-bar` نباید این فیلدها را نشان دهد.
- تست رندر Gauge: مقدار خارج از `[gaugeMin, gaugeMax]` باید به‌درستی کلمپ و رنگ‌بندی‌شده بر اساس `gaugeThresholds` رندر شود (نه کلمپ ثابت ۰-۱۰۰).
- تست event: کلیک روی یک نقطه‌ی چارت باید Dynamic Action مرتبط را با payload صحیح صدا بزند.

### Self-Audit
- تأیید کنید فرم‌های چارت موجود (bar/line) بعد از تبدیل به discriminated union بدون تغییر رفتار مشاهده‌پذیر باقی می‌مانند (migration خودکار از شکل قدیمی به شکل جدید در `codegen.ts`'s normalizer).

---

## فاز ۳۸ — Combo Chart: چند Data Source روی یک چارت

**اولویت: 🟡 متوسط**
**وضعیت: ✅ تکمیل شد**
**می‌پوشاند:** §۱۹.۵ سند gap-analysis

### چرا این فاز لازم است
`CHART_DATA_RESOURCE_BINDING_KEY` (`bindingChartEngine.ts:31`) یک کلید binding **مفرد** است — هر نود چارت فقط به یک دیتاسورس متصل می‌شود؛ ترکیب داده از دو دیتاسورس مختلف (مثلاً فروش + هزینه) در یک چارت (ستون‌ها از یکی، خط از دیگری، روی محور دوم) ممکن نیست.

### راه‌حل دقیق
`chartDataResource` بتواند **آرایه‌ای** از `{ dataSourceRef, fieldMapping }` بگیرد (نه یک شیء تکی). در `bindingApiCodegen.ts`/کدجن چارت، چند `useDataFetch` موازی صادر شود و نتایج قبل از پاس به کامپوننت چارت merge شوند (بر اساس یک فیلد مشترک category/x-axis). Inspector: مرحله‌ی «Connect» ویزارد چارت یک دکمه‌ی «Add another data source» بگیرد.

### تست‌های موردنیاز
- تست codegen: چارت با دو دیتاسورس → خروجی export شامل دو `useDataFetch` مجزا + منطق merge صحیح.

### Self-Audit
- تأیید کنید چارت‌های تک-دیتاسورس موجود (اکثریت) بدون تغییر کار می‌کنند — آرایه با یک عضو باید دقیقاً معادل رفتار فعلی باشد.

---

## فاز ۳۹ — Global Filter Bar + Cross-filtering + Period Comparison چارت

**اولویت: 🟠 بالا**
**وضعیت: ✅ تکمیل شد**
**می‌پوشاند:** گپ #۴ سند gap-analysis (کامل) + باقی‌مانده‌ی #۲۹ (period comparison — auto-refresh آن طبق تدقیق نسخه ۴ از قبل حل شده)

### چرا این فاز لازم است
هر ویجت (`gridListResource`, `chartDataResource`, `vizDataResource`) بایندینگ کاملاً **مستقل** خودش را دارد. هیچ سازوکار سندی برای «یک فیلتر تاریخ در بالای صفحه که همزمان چند چارت/گرید را فیلتر کند» یا «کلیک روی یک بار چارت → فیلتر شدن گرید کنارش» وجود ندارد. بدون این، ساخت هر داشبورد چندویجتی واقعی (نه فقط یک چارت تکی) ناقص می‌ماند؛ و چون هیچ چارتی رویداد `onDataPointClick` ندارد (فاز ۳۷ آن را اضافه می‌کند)، حتی پایه‌ی فنی Cross-filter هم تا قبل از فاز ۳۷ وجود ندارد — این فاز باید **بعد از فاز ۳۷** اجرا شود.

### راه‌حل دقیق
- المنت جدید `dashboard.filter-bar` (دسته Data Visualization) — هر فیلتر یک `storeSegment` موجود (نه یک مکانیزم جدید — طبق اصلاح گپ #۲) می‌سازد/می‌نویسد.
- هر binding چارت/گرید یک فیلد جدید `filterBindings: string[]` بگیرد (لیست id متغیرهایی که در query params آن ویجت اعمال می‌شوند).
- Dynamic Action جدید: `updateFilterFromClick` — روی `onDataPointClick` (فاز ۳۷) مقدار کلیک‌شده را در یک `storeSegment` بنویسد → این‌طور کلیک روی نمودار = فیلتر شدن خودکار ویجت‌های دیگر متصل به همان segment.
- Period Comparison: به `ChartFieldMapping` نوع `bar|line` (فاز ۳۷) یک فیلد `comparisonSeries?: { dataSourceRef: string; label: string }` اضافه شود — یک سری دوم (مثلاً «ماه قبل») هم‌زمان با سری اصلی رندر شود.

### تست‌های موردنیاز
- تست runtime: یک `dashboard.filter-bar` + دو چارت متصل به همان `storeSegment` → تغییر فیلتر → هر دو چارت رفرش شوند با query-param جدید.
- تست: کلیک روی یک بار چارت → یک گرید کناری با فیلتر جدید رفرش شود (E2E مشابه الگوی `autoCrudPageRuntimeE2E.test.tsx`).

### Self-Audit
- بررسی کنید این فاز واقعاً به فاز ۳۷ (onDataPointClick) و زیرساخت storeSegment موجود وابسته است — ترتیب اجرا باید بعد از فاز ۳۷ باشد.

---

## فاز ۴۰ — غنی‌سازی Time/DateTime/Date-Range Input

**اولویت: 🟡 متوسط**
**می‌پوشاند:** ردیف #۹ و #۱۰ جدول §۱۴ سند per-element

### چرا این فاز لازم است
`form.time-input`/`form.datetime-input` فقط ۲ فیلد دارند (`UNIVERSAL_FORM_LABEL_VALUE_FIELDS`: `label, value` — `inspectorPaletteFields.ts:1025-1028,1211`)، در برابر ~۲۴ فیلد `heroui.date-picker` (`HEROUI_DATE_PICKER_FIELDS`, خطوط ۷۲۰-۷۷۳: `calendarSystem, locale, granularity, hourCycle, timeZone, minValue, maxValue, isRequired, isInvalid, errorMessage, ...`). `form.date-range` (`FORM_DATE_RANGE_FIELDS`, خطوط ۵۱۱-۵۳۳) فاقد presets است.

### راه‌حل دقیق
- `form.time-input`/`form.datetime-input` با همان مجموعه فیلدهای `date-picker` (که از React Aria primitives مشترک ساخته شده‌اند طبق تحقیق HeroUI) هم‌تراز شوند: `min/max/step (granularity دقیقه)`, `hourCycle`, `isRequired/isDisabled/isInvalid/errorMessage`.
- `form.date-range`: فیلد `presets?: { label: string; rangeFn: 'today'|'last7Days'|'thisMonth'|'lastMonth'|'custom' }[]` + `timeZone` اضافه شود؛ در Runtime یک دکمه/دراپ‌داون presets که مقدار `startValue`/`endValue` را محاسبه و ست کند.

### تست‌های موردنیاز
- تست Inspector: فیلدهای جدید `time-input`/`datetime-input` واقعاً در Inspector ظاهر و در Runtime اعمال شوند (مثلاً `isRequired` واقعاً خطای validation تولید کند).
- تست runtime: انتخاب preset «۷ روز اخیر» در `date-range` مقدار صحیح بازه را ست کند.

### Self-Audit
- تأیید کنید فرم‌های موجود با `time-input`/`datetime-input` بدون این فیلدهای جدید (مقدار پیش‌فرض) دقیقاً رفتار قبلی را دارند.

---

## بازبینی پس از اجرا — فازهای ۲۴ تا ۴۰ (۲۰۲۶-۰۷-۳۰)

بعد از اینکه فازهای ۲۴ تا ۴۰ توسط Agent های جداگانه پیاده‌سازی شدند، طبق درخواست صریح کاربر یک بازبینی خط‌به‌خط و مستقل با baseline واقعی (کامیت `0aab59dc`، دقیقاً قبل از شروع فاز ۲۴) انجام شد — هم `tsc` هم کل سوییت `vitest`، در یک `git worktree` جدا. نتیجه:

**قبل از بازبینی:** ۹۱ خطای تایپ‌اسکریپت جدید (نرمال‌شده) + ۳۷ فایل تست تازه‌شکسته (از ۱۳ فایل شکسته‌ی baseline به ۵۰ فایل).
**بعد از رفع:** ۲ اختلاف باقی‌مانده (هر دو تأییدشده به‌عنوان آرتیفکت متن/line-shift، نه باگ واقعی) + ۰ فایل تست تازه‌شکسته نسبت به baseline.

### باگ‌های واقعی پیدا و رفع‌شده (به ترتیب اهمیت)

1. **[بحرانی] Circular import — `catalog.ts` ↔ `designerDashboardFilterBarConfig.ts`:** فاز ۳۹ به `designerVizPalette.ts` (که `catalog.ts` آن را در حین eval اسپرد می‌کند) وابستگی جدیدی به `designerDashboardFilterBarConfig.ts` اضافه کرد که خودش `readNestedContextValue` را از `bindingResourceModel.ts` می‌گرفت — و `bindingResourceModel.ts` از قبل به `catalog.ts` وابسته بود. نتیجه: `DESIGNER_VIZ_PALETTE_ITEMS is not iterable` در زمان eval ماژول، که تقریباً هر فایل تستی که (مستقیم یا غیرمستقیم) `catalog.ts` را import می‌کرد را می‌شکست — تنها این یک باگ مسئول اکثریت قریب‌به‌اتفاق ۳۷ فایل تازه‌شکسته بود. **رفع:** تابع `readDashboardFilterStoreValue` از `designerDashboardFilterBarConfig.ts` به مصرف‌کننده‌ی واقعی‌اش (`DesignerRuntimeFilterBar.tsx`، یک کامپوننت runtime برگ که هرگز در مسیر eval کاتالوگ نیست) منتقل شد؛ `designerDashboardFilterBarConfig.ts` دیگر هیچ وابستگی‌ای به `bindingResourceModel.ts` ندارد.
2. **[بحرانی] Circular import دوم — `validation.ts` → `inspectorRegistry.ts` → `catalog.ts` → ... → `tailwindClasses.ts` → `inspectorRegistry.ts`:** یک چرخه‌ی ۶ فایلی *از قبل موجود* (`catalog → html5ContentModel → domProps → layoutGridColumnWidths → tailwindClasses → inspectorRegistry → catalog`) که در baseline بی‌ضرر بود (چون هیچ عضوی مقدار چرخه‌ای را در سطح top-level ماژول مصرف نمی‌کرد)، بعد از تغییر شکل گراف import توسط فازهای ۲۴-۴۰ به‌گونه‌ای شد که ترتیب eval عوض شد و `validation.ts`، که `GLOBAL_INSPECTOR_FIELDS` را بی‌درنگ در بالای ماژول (`GLOBAL_PROP_RULES`) اسپرد می‌کرد، به مقدار `undefined` می‌رسید. **رفع:** محاسبه‌ی `GLOBAL_PROP_RULES` به یک تابع lazy با memoization (`getGlobalPropRules()`) تبدیل شد — دقیقاً همان الگوی استاندارد رفع «circular import که یک مصرف eager دارد»، بدون نیاز به دست‌کاری خودِ چرخه‌ی import.
3. **[بحرانی، فاز ۳۶] `GRID_GROUP_LEVEL_KEY` استفاده‌شده بدون import در `DesignerRuntimeAppTableGrid.tsx`:** `filterCollapsedAggregationRows` (منطق Collapsible Groups) این ثابت را مستقیم مصرف می‌کرد بدون این‌که در بالای فایل import شده باشد — یک `ReferenceError` واقعی در Runtime، دقیقاً همان لحظه‌ای که کاربر یک گروه را در گریدی با `collapsibleGroups: true` جمع می‌کرد. رفع: افزودن import.
4. **[بحرانی، فاز ۲۵/۲۶/۲۸] `InspectorOptionItemsField.tsx` بدون import برای `PropertyBindingSourceMode`/`resolvePropertyBindingSourceMode`:** این فایل مشترک، Inspector پنل «Options» را برای select/autocomplete/checkbox-group/radio-group می‌سازد — یعنی این باگ عملاً Inspector را برای همه‌ی این عناصر می‌شکست. رفع: افزودن import از `inspectorBindingUi.ts`.
5. **[متوسط، فاز ۳۶] چک‌باکس‌های Inspector Aggregation از `isSelected`/`onChange(boolean)` (الگوی HeroUI خام) به‌جای `checked`/`onChange(event)` (الگوی واقعی wrapper این پروژه، `UiCheckbox`) استفاده می‌کردند — یعنی هیچ‌کدام از ۶ چک‌باکس پنل Aggregation هرگز وضعیت checked واقعی خودشان را نشان نمی‌دادند. رفع: هر ۶ مورد به الگوی درست (`checked` + `event.target.checked`) تبدیل شدند.
6. **[پایین-متوسط] چند خطای تایپ (نه باگ رفتاری) در فاز ۲۴/۲۹/۳۷/۳۹:** `successBehaviors` بدون type annotation درست widen می‌شد (فاز ۲۹)، `AutoCrudCustomAction[].map` بدون annotation صریح باعث خطای type-predicate می‌شد (فاز ۲۹)، پارامتر ۴ام `buildChartBindingWithToolbarQueryParams` به‌اشتباه یک `DesignerBindingDefinition` کامل می‌خواست درحالی‌که فقط دو فیلد را می‌خواند (فاز ۳۹) — نوع آن به `Pick<...>` محدود شد، و `resolveChoiceGroupSelectedValuesExpression` نوع بازگشتی `TsxBindingRawExpression` را اعلام نکرده بود.
7. **[امنیتی، فاز ۳۳] عدم پاریتی سه‌مسیره:** رفع امنیتی `rel=noopener` (لینک) و `sandbox` (iframe) فقط در Preview و Export اعمال شده بود، نه در بوم طراحی زنده (`canvasNodes.tsx`) — یعنی یک iframe embed‌شده در حالت طراحی، بدون sandbox بارگذاری می‌شد. رفع شد تا هر سه مسیر یکسان باشند.
8. **[پایین] چندین `intent="danger"` که مقدار معتبری در `ButtonIntent` این پروژه نیست** (مقدار درست `"destructive"` است) در ۴ فایل دیالوگ جدید (فاز ۲۴/۳۷/۳۹) — رفع شد.
9. **چند تست موجود که واقعاً نیاز به به‌روزرسانی داشتند** (نه باگ در پیاده‌سازی، بلکه انتظار تست منسوخ‌شده به‌خاطر یک تغییر عمدی و درست): تعداد رویداد `heroui.data-grid` (فاز ۳۵ دو رویداد جدید اضافه کرد)، تگ export شده‌ی `form.date-range` (فاز ۴۰ آن را از `DateRangePicker` خام به wrapper `DesignerDateRangeField` تغییر داد که presets را هم پشتیبانی می‌کند)، حضور فیلد `max`/`min` در `form.time-input`/`datetime-input` (فاز ۴۰ این‌ها را واقعی و functional کرد، برخلاف ادعای قدیمی تست مبنی بر «مرده»)، طول `VIZ_PALETTE_ITEM_IDS` (فاز ۳۹ آیتم ۱۳ام `dashboard.filter-bar` را اضافه کرد)، و import اضافه‌ی `applyGridAggregation` در TSX صادرشده‌ی App Table Grid (فاز ۳۶).

### تست‌های رگرسیون
همه‌ی تست‌های موجود (بدون فایل تست جدید — این یک فاز رفع‌باگ روی کد از قبل نوشته‌شده بود) به‌روزرسانی/رفع شدند. تأیید نهایی: `tsc --noEmit` صفر خطای جدید نسبت به baseline (۲ مورد باقی‌مانده هر دو تأییدشده به‌عنوان آرتیفکت line-shift/reorder، نه خطای واقعی)، و کل سوییت `vitest src/domain/component-designer` صفر فایل تست تازه‌شکسته نسبت به baseline.

---

## فاز ۴۱ — Tailwind UI Blocks: افزودن Props محتوایی واقعی

**اولویت: 🟡 متوسط**
**می‌پوشاند:** ردیف #۱۹ جدول §۱۴ سند per-element

### چرا این فاز لازم است
تأیید شد: `tailwind.card`(۳۸۱)/`card-glass`(۳۹۲)/`hero`(۴۰۳)/`alert`(۴۲۵)/`stat-block`(۴۳۶)/`pricing`(۴۴۷)/`image-overlay`(۴۵۸) در `catalog.ts:380-469` همگی فقط `className` دارند (`canHaveChildren: true`, ظرف خالی). `tailwind.badge-pill` تنها استثناست (`text` دارد). این یعنی این ۷ المنت وقتی از Toolbox drag می‌شوند تهی هستند — برخلاف فلسفه‌ی «Block آماده».

### راه‌حل دقیق (به‌جای بازنویسی هرکدام از صفر، تجمیع با معادل موجودشان)
- `tailwind.stat-block` → props را دقیقاً هم‌شکل `content.stat-trend` موجود کنید (`label, value, trend, trendDirection`) — یا این المنت را deprecate و کاربران را به‌سمت `content.stat-trend` هدایت کنید (تصمیم محصولی کوچک، پیشنهاد: یکی‌سازی props برای حفظ سازگاری).
- `tailwind.pricing` → props هم‌شکل `marketing.pricing-table` (`planName, price, billingPeriod, features[], isHighlighted, ctaLabel`).
- `tailwind.alert` → props هم‌شکل `feedback.alert` (`title, message, variant, dismissible`).
- `tailwind.hero` → `heading, subheading, primaryCta, secondaryCta, backgroundImage`.
- `tailwind.image-overlay` → `imageSrc, overlayText, overlayOpacity`.
- `tailwind.card-glass` → `title, description, imageSrc` (اختیاری).

### تست‌های موردنیاز
- برای هرکدام: تست resolve/clone (مثل الگوی `builtInTemplateResolver.test.ts`) که تأیید کند props جدید در defaultProps موجودند و در Runtime/Codegen مصرف می‌شوند.

### Self-Audit
- تأیید کنید اسناد کاتالوگ overlap بین این المنت‌ها و معادل‌های Content/Marketing‌شان (که سند per-element §۴ مستند کرده) بعد از این فاز یا حذف شده یا صراحتاً به‌عنوان «دو ورودی معتبر با props یکسان» مستند شده — نه یک دوگانگی گیج‌کننده.

---

## فاز ۴۲ — `viz.gantt`: قابلیت‌های واقعی (dependencies/viewMode/drag)

**اولویت: 🟡 متوسط**
**می‌پوشاند:** ردیف #۱۳ جدول §۱۴ سند per-element
**وضعیت: ✅ تکمیل شد**

### چرا این فاز لازم است
تأیید شد: `designerVizPalette.ts:210-224` فقط `title, data, className` دارد؛ `VIZ_TIMELINE_FIELDS` (مشترک با `timeline`، `inspectorPaletteFields.ts:923-926,1186`) فقط `title`/`data`. در وضعیت فعلی این المنت **نمایش‌دهنده‌ی استاتیک** است، نه Gantt کاربردی.

### راه‌حل دقیق
از discriminated union موجود `DesignerVizTimelineFieldMapping` (`visualizationDataTransform.ts` — که از فاز‌های ۱۹/۲۰ برای field mapping دارید) استفاده کنید؛ فیلد `progressField` که از قبل در این union هست را واقعاً به یک progress bar داخل هر task-bar رندر کنید. اضافه شود: `viewMode: 'day'|'week'|'month'`، `dependencies: { fromTaskId, toTaskId }[]` (رندر پیکان اتصال بین task-bars)، `milestones: { taskId, label }[]`. برای drag-resize، یک نسخه‌ی اولیه (فقط drag برای جابه‌جایی تاریخ، نه تغییر اندازه‌ی پیچیده) با `onTaskDrag` Dynamic Action کافی است.

### تست‌های موردنیاز
- تست رندر: dependencies واقعاً به‌صورت خط/پیکان بین دو task-bar رندر شوند.
- تست runtime: تغییر `viewMode` واقعاً واحد نمایش محور زمان را عوض کند.

### Self-Audit
- تأیید کنید پریست built-in «Kanban»/معادل Gantt (اگر در built-in templates استفاده شده) بعد از این تغییر همچنان resolve/clone می‌شود.

---

## فاز ۴۳ — `viz.kanban`: Drag-and-Drop واقعی + ستون‌های ساختاریافته

**اولویت: 🟡 متوسط**
**می‌پوشاند:** ردیف #۱۴ جدول §۱۴ سند per-element
**وضعیت: ✅ تکمیل شد**

### چرا این فاز لازم است
تأیید شد: `VIZ_KANBAN_FIELDS` فقط `title, data`؛ `DesignerRuntimeKanban.tsx` کارت‌ها را کاملاً استاتیک رندر می‌کند (`board.columns` از parse شدن JSON خام `data` می‌آید، نه فیلد ساختاریافته؛ هیچ `onDrop`/`draggable`/`onDragEnd` در کامپوننت نیست). پریست built-in «Kanban Board» (فاز ۲۲) فقط روکش نمایشی زیباتری روی همین المان بی‌تغییر است.

### راه‌حل دقیق
از `DesignerVizKanbanFieldMapping` موجود (`cardIdField, cardTitleField, cardDescriptionField?, cardColumnField, columnOrder?`) استفاده کنید و واقعاً به Inspector/UI وصل کنید (نه فقط در تایپ). به `DesignerRuntimeKanban.tsx` یک مکانیزم drag-and-drop واقعی (HTML5 Drag API یا کتابخانه‌ی سبک موجود پروژه) اضافه شود: `draggable` روی هر کارت، `onDrop` روی هر ستون که کارت را به ستون جدید منتقل کند و یک Dynamic Action زنجیره‌ای (`onCardMoveAction: DynamicAction[]` — از `DesignerVizKanbanFieldMapping` موجود) را با مقدار جدید `cardColumnField` صدا بزند (معمولاً یک `callMutation` برای PATCH وضعیت + `refreshDataSource`).

### تست‌های موردنیاز
- تست runtime واقعی (`fireEvent.dragStart`/`dragOver`/`drop`): جابه‌جایی یک کارت بین دو ستون → `onCardMoveAction` با مقدار ستون جدید صدا زده شود.

### Self-Audit
- تأیید کنید پریست built-in «Kanban Board» (فاز ۲۲) بدون تغییر resolve/clone می‌شود و از این drag-and-drop جدید به‌صورت خودکار بهره‌مند می‌شود (چون از همان `viz.kanban` زیرین استفاده می‌کند).

### نتیجه‌ی اجرا
✅ `viz.kanban` در Preview/Export از `UiKanbanBoard` تعاملی موجود پروژه استفاده می‌کند؛ Drag-and-Drop بین ستون‌ها فعال شد و در بوم طراحی همچنان عمداً read-only ماند تا UX و DnD خود Designer تداخل نداشته باشد.

✅ اتصال داده‌ی ساختاریافته‌ی Kanban قبلاً در union نوع‌دار `DesignerVizKanbanFieldMapping` + `BindingVizFieldMappingStep` حاضر بود؛ این فاز آن را در همان مسیر موجود نگه داشت و به‌جای اختراع prop موازی، event bindable استاندارد `onCardMove` را به ماتریس Event اضافه کرد تا زنجیره‌های `storeWrite`/Dynamic Actions در Preview و Export از همان معماری فعلی استفاده کنند.

✅ تست رگرسیون `vizKanbanCardMovePhase43Fix.test.tsx` اضافه شد: هم حرکت واقعی کارت بین ستون‌ها و payload رویداد جدید را پوشش می‌دهد، هم صدور `onCardMove` در TSX export را.

---

## فاز ۴۴ — `viz.sheet`: ستون‌های ساختاریافته + موتور فرمول

**اولویت: 🟡 متوسط**
**می‌پوشاند:** ردیف #۱۵ جدول §۱۴ سند per-element

### چرا این فاز لازم است
تأیید شد: `VIZ_SHEET_FIELDS` فقط `title, data` — بدون تعریف ستون مجزا یا فرمول؛ نامش «Editable Sheet» است اما هیچ اشاره‌ای به موتور فرمول ندارد.

### راه‌حل دقیق
از `DesignerVizSheetFieldMapping` موجود (`columns: {header, field}[]`) استفاده کنید و گسترش دهید: هر ستون یک `type: 'text'|'number'|'select'|'formula'` بگیرد؛ برای `formula`، از همان Expression Engine موجود (`compileDesignerConditionExpression` — با context گسترش‌یافته به سلول‌های سایر ستون‌های همان ردیف) استفاده مجدد شود، نه یک موتور فرمول اکسل‌مانند جدا. `onCellChangeAction: DynamicAction[]` (از قبل در تایپ union هست) واقعاً به تغییر سلول در Runtime وصل شود.

### تست‌های موردنیاز
- تست runtime: تغییر یک سلول عددی که ستون دیگری فرمول‌محور دارد (`= colA + colB`) → مقدار محاسبه‌شده به‌روزرسانی شود.

### Self-Audit
- تأیید کنید موتور فرمول از همان sandbox امن Expression Engine موجود استفاده می‌کند (نه یک `eval` جدید و ناامن).

---

## فاز ۴۵ — غنی‌سازی File Upload + نمایش UI برای debounceMs + سه‌گانه Loading/Empty/Error روی Viz

**اولویت: 🟡 متوسط**
**می‌پوشاند:** ردیف #۴ جدول §۱۴ + بخش‌های Cross-Cutting §۱.۱/§۱.۲ سند per-element

### ۴۵.۱ — File Upload
تأیید شد: `PALETTE_FILE_UPLOAD_FIELDS` (`inspectorPaletteFields.ts:316-319`) فقط `accept, multiple` دارد. اضافه شود: `maxFileSizeMb`, `maxFiles`, `showPreview`, `dragDropZone: boolean`, `uploadDestination` (ارجاع به یک Asset Manager/Cloud Storage endpoint موجود پروژه — نه یک مکانیزم آپلود جدید)، پیام خطای i18n برای نوع/حجم نامعتبر.

### ۴۵.۲ — نمایش UI برای debounceMs (تدقیق‌شده — فقط UI، نه منطق جدید)
`debounceMs` در تایپ/Codegen از قبل هست (`DesignerGridToolbarSearchConfig.debounceMs`, معادل چارت) اما در `InspectorGridToolbarField.tsx`/`BindingChartFilterConfigStep.tsx` فیلد UI ندارد (مقدار همیشه هارد-کد `?? 300`). یک `NumberInput` ساده به هر دو فایل اضافه شود.

### ۴۵.۳ — سه‌گانه Loading/Empty/Error روی Viz
تأیید شد: این سه‌گانه (`isLoading, emptyContent, errorContent`) فقط در `HEROUI_TABLE_FIELDS` هست؛ همه‌ی `viz.*` (`chart-*, tree-*, kanban, gantt, sheet`) فاقدند — فقط متن هارد-کد (`"Loading board…"`, `"Loading chart data…"`) دارند. این سه فیلد به همه‌ی المنت‌های `viz.*` اضافه شود؛ یک mixin/الگوی مشترک («Data-bound Element Contract» طبق پیشنهاد سند) در سطح تعریف Catalog اعمال شود تا هر المنت جدید آینده هم به‌صورت پیش‌فرض این سه‌گانه را داشته باشد.

### تست‌های موردنیاز
- File upload: تست انتخاب فایل بزرگ‌تر از `maxFileSizeMb` → پیام خطا نمایش داده شود، نه سکوت/کرش.
- debounceMs: تست UI که تغییر مقدار در Inspector واقعاً روی مقدار خروجی exportشده اثر می‌گذارد (نه همیشه ۳۰۰).
- Viz triad: هر ۵ المنت `viz.*` با state خالی/loading/error، پیام سفارشی کاربر را نشان دهند (نه متن هارد-کد ثابت).

### Self-Audit
- تأیید کنید مقدار پیش‌فرض هر سه فیلد جدید Viz دقیقاً معادل متن هارد-کد فعلی است (بدون تغییر UI پیش‌فرض برای موارد استفاده‌ی موجود).

---

## فاز ۴۶ — Data Connectivity: انواع Connector (GraphQL/REST خارجی/فایل استاتیک)

**اولویت: 🟡 متوسط — بزرگ‌ترین اثر بالقوه روی «امکان ساخت هرچیزی» چون همه‌ی فازهای بالا فرض می‌کنند «یک API قابل‌دسترس داریم»؛ در عین حال بزرگ‌ترین حجم کار.**
**می‌پوشاند:** گپ #۳۱ سند gap-analysis
**وضعیت: ✅ تکمیل شد**

### چرا این فاز لازم است
تأیید شد: `DataSourceDefinition` کامل (`types.ts:182-194`) فقط `{ id, name, endpoint, fields, primaryKey?, kind?, operations?, responseMapping?, pollingIntervalMs? }` دارد — هیچ `connectorType` نیست؛ همه‌ی بایندینگ‌ها فرض می‌کنند یک REST endpoint یکسان بک‌اند AppEndO وجود دارد. اتصال مستقیم به یک دیتابیس خارجی، GraphQL API، سرویس SaaS (Stripe/HubSpot/Google Sheets)، یا فایل استاتیک راهی در معماری فعلی ندارد مگر با واسطه‌ی توسعه‌دهنده‌ی بک‌اند.

### راه‌حل دقیق
- `DataSourceDefinition.connectorType?: 'internal-api' | 'rest-external' | 'graphql' | 'static-file'` (پیش‌فرض `'internal-api'` برای سازگاری کامل با همه‌ی داده‌ی موجود — DB مستقیم عمداً از این فاز حذف شد چون نیازمند یک لایه‌ی امنیتی/credential کاملاً جدا در سرور است؛ در فازی مجزا با تحلیل امنیتی مستقل بررسی شود).
- برای هرکدام از سه نوع باقی‌مانده، یک آداپتور استاندارد در `src/server/domain/component-designer/connectors/` که خروجی یکسان (`{data, total}`) برگرداند — دقیقاً همان قرارداد `responseMapping.dataPath/arrayPath/totalPath` فعلی، فقط منبع ورودی عمومی شود.
- Dialog جدید در سطح Workspace (نه per-draft): `DataConnectorManagerDialog` — اتصالات یک‌بار تعریف شوند (شبیه Asset Manager)، بعد در هر Binding Wizard از این اتصالات به‌جای تایپ مستقیم endpoint انتخاب شوند.

### تست‌های موردنیاز
- تست آداپتور `rest-external`: یک endpoint خارجی نمونه (mock) با شکل پاسخ متفاوت → از طریق `responseMapping` به شکل داخلی استاندارد map شود.
- تست آداپتور `static-file`: یک فایل JSON/CSV نمونه → به‌عنوان یک Data Source کامل با عملیات list/detail قابل‌استفاده باشد.

### Self-Audit
- تأیید کنید `connectorType` غایب (پیش‌فرض `internal-api`) هیچ تغییری در هزاران Data Source موجود ایجاد نمی‌کند.

> **✅ رفع شد — فاز ۴۶:** `connectorType` / `connectorRef` روی `DataSourceDefinition`؛ آداپتورهای `rest-external` / `graphql` / `static-file` با خروجی `{data,total}`؛ پروکسی `/api/component-designer/connectors/:id/query` (SSRF-guarded)؛ `DataConnectorManagerDialog` + انتخاب در `BindingResourceQuickConnect`. تست‌ها: `dataConnectorsPhase46Fix.test.ts` (domain + server connectors).

---

## فاز ۴۷ — تعمیم Expression/Formula sourceType + ادیتور Monaco

**اولویت: 🔴 بحرانی**
**وضعیت: ✅ تکمیل شد (گپ #۳ و #۱۲)**
**می‌پوشاند:** گپ #۳ (تدقیق‌شده) و #۱۲ سند gap-analysis

### چرا این فاز لازم است
تأیید شد یک expression engine واقعی (نه stub) از قبل وجود دارد: `compileDesignerConditionExpression` (`visibilityConditionEngine.ts:226-322`) با `new Function` و جایگزینی امن `store.*`/`data.*`/`item`/`index`. اما این فقط برای `visibleCondition` (یک فیلد Boolean تک‌منظوره) وایر شده — نه برای محاسبه‌ی مقدار یک prop عمومی (`sourceType: 'expression'` در binding از قبل در تایپ هست ولی بدون یک ادیتور غنی/Monaco)، و نه برای `form.calculator` که در واقع یک کیپد عددی است، نه یک فیلد محاسباتی واقعی (بدون `sourceType: 'formula'`).

### راه‌حل دقیق
- عمومی‌سازی: همان تابع `compileDesignerConditionExpression` (یا یک نسخه‌ی عمومی‌شده‌ی آن) برای `sourceType: 'expression'` روی **هر** prop قابل bind فراخوانی شود — نه فقط visibility.
- یک popover/Dialog ادیتور expression با Monaco (سبک، نه کل بار Monaco سنگین — از همان نمونه‌ی Monaco موجود در `form.code-editor`/سند-سطح استفاده مجدد شود) به‌جای input تک‌خطی فعلی.
- `sourceType: 'formula'` جدید که مقدارش از فیلدهای دیگر همان region با یک expression محاسبه شود و با `onChange` سایر فیلدهای وابسته دوباره ارزیابی شود (dependency tracking ساده: فیلدهای ارجاع‌شده در متن expression استخراج و به‌عنوان trigger ثبت شوند).
- طبق نکته‌ی امنیتی خودِ سند gap-analysis: چون خروجی TSX واقعی است، expression باید مستقیماً به کد TS واقعی در فایل تولیدی کامپایل شود (نه eval رانتایم) — دقیقاً همان الگویی که `compileDesignerConditionExpression` موجود از قبل در Codegen دارد؛ فقط باید برای مقدار prop عمومی هم اعمال شود.

### تست‌های موردنیاز
- تست codegen: یک prop با `sourceType: 'formula'` که به دو فیلد دیگر ارجاع می‌دهد → مقدار محاسبه‌شده در Runtime واقعی و در Export درست باشد؛ تغییر یکی از دو فیلد وابسته → مقدار فرمول به‌روزرسانی شود.

### Self-Audit
- تأیید کنید عمومی‌سازی expression engine، رفتار موجود `visibleCondition` (که از قبل روی همین تابع سوار است) را نمی‌شکند.

---

## فاز ۴۸ — Export داده (CSV/Excel/PDF) از گرید/داشبورد

**اولویت: 🟠 بالا**
**وضعیت: ✅ تکمیل شد (گپ #۵)**
**می‌پوشاند:** گپ #۵ سند gap-analysis

### چرا این فاز لازم است
تأیید شد: جست‌وجوی گسترده‌ی `exportData`/`export.*csv/pdf/excel` در کل `src/domain`/`src/features/component-designer` هیچ چیز مرتبطی پیدا نکرد (تنها `CSV_LIST_PROP_IDS` در `bindingContentEngine.ts` است که کاملاً بی‌ربط — فقط رشته‌سازی لیبل ویجت‌های Stepper/Segmented-control).

### راه‌حل دقیق
- Dynamic Action جدید: `exportData` با `{ format: 'csv'|'xlsx'|'pdf', source: 'gridListResource'|'chartDataResource' }`.
- روی toolbar گرید (`DesignerGridToolbarConfig` موجود) آیتم جدید `showExportButton: boolean`.
- برای CSV: تولید کاملاً client-side ممکن است (از داده‌ی همان `dataVar` موجود، بدون نیاز به سرور).
- برای Excel/PDF: نیازمند یک endpoint سمت سرور جدید (`/api/component-designer/export`) که با همان `responseMapping` موجود کار کند و از یک کتابخانه‌ی تولید فایل (که باید در پروژه بررسی/انتخاب شود) استفاده کند.

### تست‌های موردنیاز
- تست CSV client-side: کلیک روی Export → فایل تولیدشده دقیقاً همان ردیف‌های نمایش‌داده‌شده (بعد از فیلتر/سورت فعلی) را داشته باشد.
- تست endpoint Excel/PDF: با mock سرور، فراخوانی صحیح endpoint با پارامترهای درست تأیید شود.

### Self-Audit
- تأیید کنید Export همیشه از داده‌ی **فیلترشده/سورت‌شده‌ی فعلی** گرید می‌گیرد (نه کل دیتاست خام)، مطابق انتظار متعارف کاربر.

---

## فاز ۴۹ — Design Token Registry + Theme Editor + Component Variants

**اولویت: 🟡 متوسط**
**می‌پوشاند:** گپ #۱۵/#۱۶ سند gap-analysis
**وضعیت: ✅ تکمیل شد**

### چرا این فاز لازم است
تأیید شد: صفر نتیجه برای `DesignSystemRegistry|designToken|variantKey` در کل `src/domain/component-designer`؛ `ReusableComponentRef` فقط `propsOverride` دستی به‌ازای instance دارد، نه یک سیستم Variant نام‌دار.

### راه‌حل دقیق
- یک سطح جدید `DesignSystemRegistry` در سطح Workspace (نه per-document): `{ colors, spacing, typography, radii, shadows }` که به CSS variables کامپایل می‌شود (`--dc-color-primary`، ...).
- `tw*` compiler فعلی به‌جای مقدار خام Tailwind، بتواند به یک token reference اشاره کند (فیلد جدید اختیاری کنار مقدار خام موجود — Backward-compatible).
- Dialog جدید `DesignSystemEditorDialog` در سطح Catalog list.
- برای Component Variants: به `ReusableComponentRef` فیلد `variantKey` اضافه شود؛ در تعریف reusable component یک بخش `variants: Record<string, PartialPropsOverride>` باشد.

### تست‌های موردنیاز
- تست: تغییر یک token رنگ در `DesignSystemEditorDialog` → همه‌ی نودهایی که به آن token ارجاع می‌دهند (در چند سند مختلف) رنگ جدید را در Export بگیرند.

### Self-Audit
- تأیید کنید نودهای موجود بدون token reference (اکثریت فعلی) دقیقاً همان مقدار Tailwind خام قبلی را حفظ می‌کنند.

---

## فاز ۵۰ — Accessibility Auditing در Diagnostics

**اولویت: 🟡 متوسط**
**وضعیت: ✅ تکمیل شد (گپ #۱۹)**
**می‌پوشاند:** گپ #۱۹ سند gap-analysis

### چرا این فاز لازم است
تأیید شد: `DesignerDiagnostic['code']` (`types.ts:213-234`) هیچ کد `a11y-*` ندارد (لیست کامل فعلی: `root-missing, invalid-parent-child, html5-content-model, orphan-node, required-prop, prop-type, parse-json, parse-tsx, sync-error, binding-invalid, binding-dependency, binding-runtime, preview-timeout, draft-runtime, export-invalid, slot-unknown, document-large, reusable-version-stale, legacy-palette-item, ambiguous-repeater-alias, invalid-repeater-alias`).

### راه‌حل دقیق
- کدهای جدید در همان enum: `a11y-missing-alt`, `a11y-low-contrast`, `a11y-missing-aria-label`, `a11y-heading-order` (پرش نامعتبر بین سطوح heading — وابسته به فاز ۳۴.۱).
- این قوانین در `validation.ts` موجود به‌عنوان یک دسته‌ی جدید rule اضافه شوند (همان الگوی قوانین فعلی، فقط دسته‌ی جدید).
- یک تب/فیلتر جدید در پنل Diagnostics: Errors / Warnings / **Accessibility**.

### تست‌های موردنیاز
- تست: یک `html.image` بدون `alt` → دقیقاً یک diagnostic با کد `a11y-missing-alt` تولید شود.

### Self-Audit
- تأیید کنید افزودن این دسته‌ی جدید، شمارش/رفتار diagnostics های موجود (errors/warnings) را تغییر نمی‌دهد — فقط یک دسته‌ی موازی جدید است.

---

## فاز ۵۱ — `triggerWorkflow` Action + Import CSV/Excel → Data Source

**اولویت: 🟢 پایین-ارزان (طبق تدقیق نسخه ۴، زیرساخت مقصد هردو از قبل آماده است)**
**وضعیت: ✅ تکمیل شد**
**می‌پوشاند:** گپ #۱ (تدقیق‌شده) و #۲۳ سند gap-analysis

### ۵۱.۱ — `triggerWorkflow`
تأیید شد یک موتور Workflow کامل و مستقل با endpoint آماده از قبل وجود دارد (`POST /workflow-runtime/definitions/:definitionId/start`، `src/server/routes/workflow-runtime.routes.ts:24`؛ webhook binding adapters در `src/server/domain/workflow/publication/bindingAdapters/`). یک مقدار جدید در `DesignerDynamicActionType` (`types.ts`): `'triggerWorkflow'` با پارامترهای `{ workflowDefinitionId, payloadMapping }` — دقیقاً هم‌الگو با `callMutation` موجود (که یک URL + body می‌سازد)، فقط مقصد ثابت آن endpoint workflow است.

### ۵۱.۲ — Import CSV/Excel → Data Source خودکار
تأیید شد `DesignerGenerateFromApiMenu` فقط ورودی API دارد. یک آیتم منوی جدید «Data Source from CSV/Excel»: فایل را parse کند (schema هر ستون را حدس بزند)، و یک `DataSourceDefinition` با `connectorType: 'static-file'` (از فاز ۴۶) بسازد.

### تست‌های موردنیاز
- تست codegen: `triggerWorkflow` روی یک دکمه بایند شود → درخواست واقعی به endpoint workflow با payload صحیح ارسال شود (mock fetch).
- تست: آپلود یک فایل CSV نمونه → schema حدس‌زده‌شده (نام/نوع هر ستون) با محتوای واقعی فایل مطابقت داشته باشد.

### Self-Audit
- تأیید کنید `triggerWorkflow` مستقل از این‌که فیچر Workflow فعال/غیرفعال باشد، حداقل یک خطای واضح در Diagnostics تولید کند (نه سکوت) اگر `workflowDefinitionId` نامعتبر باشد.

---

## فاز ۵۲ — چارت‌های آماری پیشرفته + Map/Geo Visualization

**اولویت: 🟡 متوسط**
**می‌پوشاند:** §۱۵.۱/§۱۵.۲ و گپ §۱۸.۵ سند per-element/gap-analysis

### چرا این فاز لازم است
تأیید شد صفر وجود در کل کاتالوگ برای: Scatter, Radar, Heatmap, Funnel, Waterfall, Treemap, Sankey, Candlestick, Boxplot, و هر عنصر Map/Geo.

### راه‌حل دقیق (طبق پیشنهاد معماری سند — تجمیع، نه انفجار تعداد المنت)
یک المنت واحد `viz.chart` (یا گسترش `viz.chart-*` موجود) با پراپرتی `chartType` که مقادیر جدید را هم بپذیرد: `'scatter'|'radar'|'heatmap'|'funnel'|'waterfall'|'treemap'|'sankey'|'candlestick'|'boxplot'`؛ props مشترک (`data, seriesKeys, height, showLegend`) نگه داشته شود و فیلدهای اختصاصی هر نوع (مثل `sizeKey` برای scatter/bubble) به‌صورت شرطی در Inspector نمایش داده شوند (دقیقاً الگوی فاز ۳۷ برای Field Mapping type-specific). برای Map: دو المنت جدید `viz.map-pin` (پین نقطه‌ای) و `viz.map-choropleth` (رنگی بر اساس مقدار) — با پیش‌فرض OpenStreetMap/Leaflet (رایگان/open-source، نه نیازمند API Key پولی) و Mapbox/Google اختیاری.

### تست‌های موردنیاز
- برای هر نوع چارت جدید: تست resolve/render حداقلی (رندر بدون کرش با یک نمونه داده معتبر).

### Self-Audit
- تأیید کنید ۴ نوع چارت موجود (bar/line/pie/sparkline) بعد از این گسترش دست‌نخورده باقی می‌مانند.

---

## فاز ۵۳ — المنت‌های غایب: Media Player واقعی، QR/Barcode، Command Palette، Notification/User-Menu/Chat

**اولویت: 🟡 متوسط**
**می‌پوشاند:** §۱۵.۳-۱۵.۶ سند per-element

### چرا این فاز لازم است
تأیید شد صفر وجود برای همه‌ی این‌ها. `content.split-media` فقط `mediaSrc` خام دارد و همیشه به `<img>` رندر می‌شود (حتی برای ویدیو).

### راه‌حل دقیق
- `content.video-player`/`content.audio-player` (کنترل‌های واقعی HTML5: play/pause/seek/volume/caption)؛ `content.split-media` یک `mediaType: 'image'|'video'|'audio'|'lottie'` بگیرد و بسته به نوع پلیر مناسب رندر کند.
- `content.qr-code`/`content.barcode` (مقدار bindable، اندازه، سطح تصحیح خطا).
- `platform-navigation.command-palette`/`notification-bell`/`user-menu` (این‌ها باید از Dynamic Platform Palette موجود تغذیه شوند، نه Catalog محلی ثابت — دقیقاً مثل `platform-slots` فعلی؛ `user-menu` به `sourceType: 'session'` فاز ۲۵ وابسته است).
- `heroui.chat-widget` (نیازمند فاز ۵۵ — real-time push).

### تست‌های موردنیاز
- برای هرکدام: تست resolve/render حداقلی + (برای video-player) تست کنترل واقعی play/pause.

### Self-Audit
- تأیید کنید `content.split-media` موجود با مقدار پیش‌فرض `mediaType: 'image'` دقیقاً رفتار قبلی را حفظ می‌کند.

---

## فاز ۵۴ — Canvas Comments + Audit Log + Builder-level RBAC

**اولویت: 🟡 متوسط**
**وضعیت: ✅ تکمیل شد (گپ #۲۰/#۲۱/#۲۲)**
**می‌پوشاند:** گپ #۲۰/#۲۱/#۲۲ سند gap-analysis

### چرا این فاز لازم است
تأیید شد صفر وجود برای comment/auditLog/presence در `state.ts`. RBAC موجود (`designerPageAccess.ts`) دسترسی **مصرف‌کننده‌ی صفحه‌ی منتشرشده** است، نه دسترسی **ویرایشگر داخل استودیو** — این دو مفهوم باید صریحاً جدا مستند شوند تا با هم قاطی نشوند.

### راه‌حل دقیق
- Comment: لایه‌ی داده‌ی جدید `workspace/designer/comments/{draftId}.json` + اکشن `add-canvas-comment` + رندر pin روی canvas (مشابه align bar موجود).
- Audit Log: جدول append-only سمت سرور (`draftAuditLog.ts`) که هر `PUT /drafts/:id` را diff می‌کند و ذخیره می‌کند (منطق diff از `DesignerPublishDiffDialog` موجود قابل استفاده‌ی مجدد است).
- Builder-level RBAC: `defaultRoles` به فهرست قابل‌تنظیم در سطح folder تبدیل شود (`folderPermissions: Record<folder, Role[]>`) — این کاملاً مجزا از `designerPageAccess.ts` (که دست‌نخورده می‌ماند) است.

### تست‌های موردنیاز
- تست Audit Log: یک تغییر prop روی یک node → یک entry دقیق (کی، چه propی، مقدار قبل/بعد) در audit log ثبت شود.

### Self-Audit
- تأیید کنید `designerPageAccess.ts` (RBAC مصرف‌کننده) از این فاز کاملاً دست‌نخورده می‌ماند — این دو سیستم RBAC باید مستقل بمانند.

---

## فاز ۵۵ — Real-time Push Binding (WebSocket/SSE)

**اولویت: 🟢 پایین (طبق تدقیق نسخه ۴، Polling از قبل حل شده؛ این فاز فقط push واقعی را اضافه می‌کند)**
**وضعیت: ✅ تکمیل شد (گپ #۳۲)**
**می‌پوشاند:** باقی‌مانده‌ی گپ #۳۲ سند gap-analysis

### چرا این فاز لازم است
در کل سیستم Binding (`sourceType: static, expression, apiRef, store, regionColumn, session`) هیچ مقداری برای جریان داده‌ی زنده (push از سرور، نه polling دوره‌ای) وجود ندارد. برای سناریوهایی مثل «پنل مانیتورینگ سفارش‌های ورودی لحظه‌ای» یا `heroui.chat-widget` (فاز ۵۳)، یک تایمر polling کافی نیست — نیاز به یک اتصال زنده (WebSocket/SSE) واقعی است. نکته: حتی Retool (رهبر بازار) هم WebSocket بومی ندارد — حل بومی این مورد از طریق UI (بدون کد) یک مزیت رقابتی واقعی است، نه فقط پرکردن یک شکاف.

### راه‌حل دقیق
`DataSourceDefinition.liveMode?: { type: 'sse' | 'websocket', channel? }` (نه `'polling'` — آن از قبل با `pollingIntervalMs` حل شده). یک هوک runtime جدید `useLiveDataSource` که به endpoint مشخص وصل شود و نتیجه را مستقیم در `gridListResource`/`chartDataResource`/`storeSegment` بنویسد.

### تست‌های موردنیاز
- تست runtime با یک WebSocket mock: پیام جدید از سرور → مقدار bind‌شده در Runtime واقعاً به‌روزرسانی شود.

### Self-Audit
- تأیید کنید معماری «Live Runtime تک Node instance» فعلی پروژه (طبق §۱.۵ سند اصلی) با تعداد اتصالات هم‌زمان WebSocket مقیاس‌پذیر می‌ماند — این باید قبل از پیاده‌سازی گسترده بررسی شود.

---

## فاز ۵۶ — ابزار AI برای Scaffold چندصفحه‌ای اپلیکیشن

**اولویت: 🟡 متوسط — ارزش بالا، اما وابسته به تکمیل بخش زیادی از فازهای بالا (چون AI فقط چیزی می‌سازد که Toolbox پشتیبانی کند).**
**وضعیت: ✅ تکمیل شد (گپ #۲۸)**
**می‌پوشاند:** گپ #۲۸ سند gap-analysis

### چرا این فاز لازم است
تأیید شد ابزارهای AI موجود (`draft_component_layout` و بقیه در `src/core/ai/tools/native/`) هرکدام دقیقاً **یک** کامپوننت/صفحه در هر فراخوانی می‌سازند؛ هیچ ابزاری برای چند صفحه‌ی مرتبط + ناوبری + دیتاسورس مشترک وجود ندارد.

### راه‌حل دقیق
ابزار AI جدید در سطح بالاتر: `draft_application_scaffold` که orchestration روی ابزارهای موجود انجام دهد (نه بازنویسی) — یک آرایه از `draft_component_layout` به‌همراه یک Shell و `DesignerAddToMenuButton` خودکار برای هرکدام. `contextAssembly.ts` باید بتواند ساختار فولدر/اپلیکیشن موجود را به‌عنوان context بدهد.

### تست‌های موردنیاز
- تست ابزار: یک پرامپت نمونه («یک اپ مدیریت سفارش با صفحه‌ی لیست و جزئیات») → دو سند مرتبط + یک ورودی منو تولید شود.

### Self-Audit
- تأیید کنید این ابزار فقط از ابزارهای AI موجود (تک‌کامپوننتی) استفاده می‌کند، نه یک مسیر تولید سند موازی جدید.

---

## فاز ۵۷ — Custom React Component Import (Escape Hatch)

**اولویت: 🟡 متوسط-بالا — نیازمند تصمیم صریح امنیتی قبل از اجرا (دقیقاً مثل فاز ۳۲).**
**وضعیت: ✅ تکمیل شد (گزینه الف — ADMIN/DEVELOPER + static-analysis)**
**می‌پوشاند:** گپ #۱۸ سند gap-analysis

### چرا این فاز لازم است
تأیید شد `tsxComponentRegistry.ts` فقط رجیستری داخلی (HeroUI/Viz/Universal/Platform) را نگه می‌دارد؛ هیچ مکانیزم dynamic import برای کامپوننت React دلخواه کاربر وجود ندارد.

### ⚠️ پیش‌نیاز: تصمیم امنیتی صریح
چون کد آپلودشده در همان Node instance اجرا می‌شود (طبق اصل «Live Runtime» فعلی پروژه)، این فاز **قبل از پیاده‌سازی نیازمند تصمیم محصولی/امنیتی صریح از کاربر** است — دقیقاً مثل فاز ۳۲: **گزینه الف (پیشنهادی، محتاطانه):** فقط برای کاربران با نقش بسیار محدود (مثلاً فقط ADMIN/DEVELOPER سطح پلتفرم، نه هر طراح) در دسترس باشد، به‌همراه یک لایه‌ی static-analysis اجباری قبل از پذیرش کد (rejection هر `require`/`fetch`/`fs`/`process` غیرمجاز). **گزینه ب:** این فاز فعلاً به‌کل به تعویق بیفتد تا یک راه‌حل sandboxing قوی‌تر (مثل اجرای کد در یک Web Worker/iframe ایزوله به‌جای همان Node instance) طراحی شود.

**تصمیم اجرایی:** گزینه الف پیاده‌سازی شد.

### راه‌حل دقیق (در صورت تأیید گزینه الف)
ماژول «Custom Elements» در سطح Workspace: آپلود یک فایل `.tsx` با یک contract مشخص (`props`, `onChangeEvents`) + یک JSON Schema کوچک اعلامی برای Inspector. سرور در `workspace/designer/custom-elements/` ذخیره و در build به `tsxComponentRegistry.ts` پویا اضافه می‌کند (پس از عبور از static-analysis). دسته‌ی جدید dynamic palette: `custom-elements`.

### تست‌های موردنیاز
- تست static-analysis: کد حاوی `require('fs')`/`process.env` باید رد شود با پیام خطای واضح.
- تست happy-path: یک کامپوننت ساده و امن آپلود شود → در Toolbox ظاهر شود → قابل drag/drop و رندر باشد.

**رفع:** `customElementStaticAnalysis.ts` + `customElementsStore.ts` + `customElementPalette.ts` + `DesignerCustomElementHost.tsx` + wiring در Canvas/Preview/Export/Inspector؛ رگرسیون: `customReactImportPhase57Fix.test.ts`.

### Self-Audit
- تأیید کنید هیچ کامپوننت آپلودشده بدون عبور موفق از static-analysis وارد `tsxComponentRegistry.ts` نمی‌شود.

---

## جمع‌بندی نهایی — موارد آگاهانه به تعویق‌افتاده (نه فراموش‌شده)

> **✅ تأیید مستقیم کاربر:** این چهار ردیف صریحاً توسط کاربر تأیید شدند که درست تشخیص داده شده‌اند و **اصلاً نباید جزو فازهای اجرایی این نقشه‌راه باشند** — یعنی این جدول یک بایگانی مستندسازی‌شده است، نه یک TODO list؛ هیچ Agent ای نباید بدون یک تصمیم محصولی جدید و صریح، فازی برای این چهار ردیف بنویسد یا اجرا کند.

مطابق همان اصل شفافیتی که در فاز ۲.۱ (Workflow) به کار رفت، این موارد **آگاهانه** در این نقشه‌راه فاز نگرفتند — با دلیل صریح، نه به این معنا که فراموش شده‌اند:

| مورد | دلیل به‌تعویق‌افتادن | چه زمانی بازبینی شود |
|---|---|---|
| Payment Field/Wizard، E-Signature، CAPTCHA، Save & Resume (گپ #۱۰/#۱۱/#۱۳/#۱۴) | این چهار مورد عمدتاً برای فرم‌های **عمومی/انتشار عمومی** (استخدام، نظرسنجی، پرداخت آنلاین) حیاتی‌اند؛ برای یک ابزار عمدتاً ادمین/پرتال داخلی (که Client Components در حال حاضر بیشتر برای آن استفاده می‌شود) اولویت پایین‌تری دارند | اگر کاربرد فرم‌های عمومی/مشتری‌محور در روتمپ محصول جدی شد |
| Animation/Interaction (گپ #۱۷) | برای صفحات لندینگ/مارکتینگ مهم است؛ برای پنل‌های ادمین داخلی (کاربرد غالب فعلی) اولویت پایین‌تر | اگر ساخت صفحات مارکتینگ/لندینگ هدف جدی‌تری شد |
| Real-time Multiplayer Editing کامل (CRDT/OT) (گپ #۲۵) | هزینه/فایده برای یک ابزار داخلی با تیم طراحی کوچک پایین است؛ نرم‌لاک (نمایش «این draft در حال ویرایش است») همان ارزش اصلی را با هزینه‌ی بسیار کمتر می‌دهد | اگر تیم طراحی به‌طور محسوس بزرگ شد و تداخل هم‌زمان واقعاً مشکل‌ساز شد |
| Native Mobile App (گپ #۲۷) | هزینه بسیار بالا نسبت به ارزش برای سناریوهای فعلی (ادمین/پرتال داخلی)؛ PWA (که طبق تدقیق نسخه ۴ از قبل کامل است) همان نیاز «نصب‌پذیر/آفلاین» را پوشش می‌دهد | فقط با نیاز کسب‌وکاری صریح (مثلاً push notification بومی iOS/Android) |

**نکته‌ی پایانی:** فازهای ۲۴ تا ۵۷ (به‌همراه فاز ۳۲ و ۵۷ که نیازمند تصمیم صریح کاربرند) + جدول به‌تعویق‌افتاده‌ی بالا، **کل** ۳۰ گپ تأییدشده‌ی سند `client-components-gap-analysis-fa.md` (نسخه ۴) + همه‌ی ردیف‌های تأییدشده‌ی سند `client-components-per-element-gap-analysis-fa.md` (نسخه ۲) + هر ۱۳ نیاز پاریتی صفحه Users (U1-U13) را پوشش می‌دهند — هیچ آیتم تأییدشده‌ای بدون یک فاز مشخص یا یک توضیح صریح «چرا به تعویق افتاد» باقی نمانده است.

---

## بازبینی پس از اجرا — فازهای ۴۱ تا ۵۷ (۲۰۲۶-۰۷-۳۰)

بعد از اینکه فازهای ۴۱ تا ۵۷ (۱۷ فاز کد — همه به‌جز فاز ۳۲ که تصمیمی است) توسط Agent های جداگانه پیاده‌سازی شدند، همان روش بازبینی مستقل فازهای ۲۴-۴۰ تکرار شد: `git worktree` جدا در کامیت `2d2b419e` (دقیقاً بعد از رفع باگ‌های فازهای ۲۴-۴۰، پیش از شروع فاز ۴۱) به‌عنوان baseline واقعی، هم `tsc` هم کل سوییت `vitest` روی هر دو نسخه، به‌علاوه یک بازبینی امنیتی هدفمند و عمیق‌تر روی زیرسیستم‌های پرریسک این دسته از فازها (Custom Component Import، Data Connectors، Export) — چون این‌ها اولین فازهایی در کل نقشه‌راه بودند که کد کاربر را اجرا می‌کنند یا دادهٔ خروجی را در فایل‌هایی می‌گذارند که خارج از خودِ Designer باز می‌شوند.

**قبل از بازبینی:** ۵ خطای تایپ‌اسکریپت جدید (نرمال‌شده؛ خیلی کمتر از دور قبل) + ۴ فایل تست تازه‌شکسته + ۲ باگ امنیتی واقعی (نه از تایپ‌چک، از بازبینی دستی) کشف شد.
**بعد از رفع:** ۳ اختلاف باقی‌مانده (همان آرتیفکت‌های line-shift دورهای قبل، نه باگ) + ۰ فایل تست تازه‌شکسته + هر ۲ باگ امنیتی رفع‌شده.

### باگ‌های واقعی پیدا و رفع‌شده (به ترتیب اهمیت)

1. **[بحرانی، امنیتی، فاز ۵۷] فاقد محدودیت نقش اختصاصی روی آپلود/ویرایش/حذف Custom Element:** طبق تصمیم مستندشده‌ی خودِ این سند (فاز ۳۲/۵۷ — «فقط ADMIN/DEVELOPER، نه هر کاربر با دسترسی Designer»)، مسیرهای `POST/PUT/DELETE /api/component-designer/custom-elements` باید محدودتر از دسترسی عمومی استودیو باشند. پیاده‌سازی این سه route را فقط زیر همان `requireBuilderStudioAccess` عمومی (که هر نقشی با دسترسی به هر پوشه‌ی Builder را می‌پذیرد) گذاشته بود — یعنی هر نقشی که مدیر پلتفرم برای ویرایش صفحات به آن دسترسی داده، می‌توانست کد React دلخواه آپلود کند که در مرورگر بقیه‌ی کاربران (با session خودشان) اجرا می‌شود. **رفع:** `requireRole('ADMIN')` مستقیماً روی سه route نوشتن اضافه شد (`src/server/routes/component-designer.routes.ts`) — مسیرهای فقط-خواندنی (`GET`) دست‌نخورده ماندند.
2. **[بحرانی، امنیتی، فاز ۵۷] فهرست‌سیاه Static Analysis با regex ساده و قابل‌دورزدن:** `customElementStaticAnalysis.ts` فقط identifierهای صریح (`fetch(`, `process.`, `eval(`) را مسدود می‌کرد — یک الگوی بسیار شناخته‌شده‌ی دورزدن blocklist (`window['fe'+'tch']`) کاملاً از آن عبور می‌کرد، و هیچ قانونی برای `XMLHttpRequest`/`WebSocket`/`document.cookie`/`localStorage`/`sessionStorage`/`indexedDB`/`window.top`/`window.parent` وجود نداشت (همه مسیرهای واقعی نشت داده/session-riding از داخل مرورگر همان کاربری که کامپوننت را می‌بیند). **رفع:** ۶ قانون جدید اضافه شد (`forbid-xhr`, `forbid-websocket`, `forbid-storage-cookie`, `forbid-dynamic-global-access` — مسدودکردن `window/globalThis/self[...]`، و `forbid-frame-escape` برای `window.top`/`window.parent`) + ۳ تست رگرسیون امنیتی جدید + ۱ تست تأییدی که مطمئن شود کلیدهای CSS متعارف مثل `top`/`parent` (که در استایل‌های React بسیار رایج‌اند) اشتباهی مسدود نمی‌شوند. **⚠️ توجه صادقانه:** این هنوز یک فهرست‌سیاه heuristic است، نه sandbox واقعی (iframe/CSP ایزوله) — یک کاربر ADMIN مصمم همچنان می‌تواند احتمالاً راهی برای دورزدن پیدا کند. چون دسترسی الان به ADMIN محدود شده (بند ۱)، ریسک باقی‌مانده قابل‌قبول است، اما اگر این فیچر به کاربران غیر-ADMIN باز شود، سند اصلی (فاز ۵۷، «گزینه ب») باید دوباره مرور شود.
3. **[بحرانی، امنیتی، فاز ۴۸] CSV/Formula Injection (OWASP) در Export:** `escapeCsvCell` در `designerDataExport.ts` نحو CSV (کاما/کوتیشن/newline) را درست escape می‌کرد اما هیچ محافظتی در برابر **تزریق فرمول** نداشت — بر خلاف XLSX (که با `t="inlineStr"` صریح، ذاتاً امن است، تأیید شد)، فایل CSV خام هیچ متادیتای نوع سلول ندارد و Excel/Sheets نوع هر سلول را از روی محتوای متنی‌اش حدس می‌زند؛ یک مقدار معمولی کاربر (مثلاً یک فیلد «نام» در گرید) که با `=`/`+`/`-`/`@` شروع شود (مثل `=HYPERLINK(...)` یا الگوی قدیمی DDE) به‌عنوان فرمول زنده در Excel کاربری که فایل را باز می‌کند اجرا می‌شود. **رفع:** پیشوند تک‌کوتیشن استاندارد OWASP برای هر مقدار سلول با کاراکتر شروع‌کننده‌ی فرمول اضافه شد + تست رگرسیون کامل با ۴ payload واقعی حمله.
4. **[بحرانی، فاز ۴۴] `viz.sheet` مقدار ویرایش‌شده‌ی سلول را در هر re-render ناخواسته پاک می‌کرد:** `useEffect` مسئول بازمحاسبه‌ی ستون‌های فرمول همیشه از `sheet.rows` (داده‌ی خام/دست‌نخورده) به‌جای مقدار فعلی state شروع می‌کرد، و چون `dynamicActionRuntime` (شامل `designerStore`) در اکثر re-render های والد (حتی یک تغییر بی‌ربط مثل className) یک شیء تازه است، این افکت تقریباً در هر re-render دوباره اجرا و مقدار ویرایش‌شده‌ی کاربر را با داده‌ی خام جایگزین می‌شد — یعنی ادیت دستی یک سلول عملاً هیچ‌وقت پایدار نمی‌ماند مگر re-render دیگری اتفاق نیفتد. **رفع:** یک `ref` برای تشخیص واقعی «آیا `sheet` عوض شده یا نه» اضافه شد؛ فقط در آن حالت reset از داده‌ی خام انجام می‌شود، وگرنه فرمول‌ها روی `rows` **فعلی** (نه خام) بازمحاسبه می‌شوند — مقدار ویرایش‌شده‌ی کاربر حفظ می‌شود.
5. **[پایین، فاز ۴۵] `TreeNodeRow` یک پارامتر مرده `emptyContent` داشت** که نه در تایپ اعلام شده بود، نه هیچ فراخوان‌کننده‌ای آن را پاس می‌داد (مدیریت empty-state واقعی درست یک سطح بالاتر، در کانتینر، انجام می‌شود) — یک باقی‌مانده‌ی کپی-پیست از کامپوننت‌های خواهر. حذف شد.
6. **[پایین، فاز ۵۷] `useDesignerPalette.ts` — `paletteCatalogQuery.data.customItems` روی نوع `unknown`:** ریشه‌اش یک مشکل تایپ preexisting و خارج از محدوده‌ی این بازبینی بود (`systemItems`/`reusableItems` هم از قبل همین مشکل را داشتند، فقط فیلد جدید `customItems` آن را آشکار کرد)؛ با یک type-cast محلی و ایمن رفع شد — به‌عنوان یک مزیت جانبی، ۲ خطای preexisting هم با همین رفع پاک شدند.

### تست‌های موجود که نیاز به به‌روزرسانی داشتند (نه باگ — تغییر عمدی معماری)
- `fileUploadOnChangeWiring.test.tsx` و `phase3Palette.test.ts`: هر دو فرض قدیمی «Export یک `<label>`/`<input type="file">` خام تولید می‌کند» را چک می‌کردند؛ فاز ۴۵ این را عمداً به یک ارجاع به کامپوننت مشترک و غنی‌شده `<DesignerRuntimeFileUpload onChange={...} />` تغییر داد (که خودش داخلاً `<input type="file">` واقعی با onChange درست را رندر می‌کند — تأیید شد مستقیماً از کد). هر دو تست به‌روزرسانی شدند.
- `vizTreeSelectCascaderComboboxBinding.test.tsx`: تست قدیمی `viz.tree-select` فرض می‌کرد حتی در حالت خالی یک دکمه‌ی dropdown برای کلیک‌کردن وجود دارد. الگوی مشترک Data-bound Element Contract (فاز ۴۵) که حالا یکنواخت روی همه‌ی عناصر Viz اعمال می‌شود (از جمله tree-select) در حالت خالی کل trigger را با پیام empty-state جایگزین می‌کند — دقیقاً همان رفتاری که خواهرانش (`viz.cascader`, `viz.tree-combobox`) از قبل داشتند. تست به‌روزرسانی شد.

### بازبینی معماری/امنیت فراتر از تایپ‌چک (بدون یافته‌ی اضافی)
Data Connectors (فاز ۴۶): هر سه adapter (`rest-external`, `graphql`, `static-file`) از یک SSRF-guard موجود (`mcpUrlGuard.ts`) و یک محافظ دوباره-تأییدشده در برابر path-traversal (`resolveSafeConnectorFilePath`) استفاده می‌کنند — بدون یافته. Formula Engine (فاز ۴۷): از همان کامپایلر امن `visibilityConditionEngine.ts` استفاده‌ی مجدد می‌کند، بدون `eval` جدید. Real-time Push (فاز ۵۵): کاملاً سمت-مرورگر (نه پروکسی سمت سرور)، بدون ریسک مصرف منابع روی پردازه‌ی Node. Canvas Comments/Audit Log (فاز ۵۴): مسیر فایل با همان الگوی sanitize-whitelist ایمن. Design Tokens (فاز ۴۹): مقدار توکن هم در مسیر React `style` prop (بدون ریسک تزریق) و هم در Export codegen (escape صریح quote/backslash) امن است.

### تست‌های نوشته‌شده/به‌روزشده
`customReactImportPhase57Fix.test.ts` (+۴ تست جدید امنیتی)، `dataExportPhase48Fix.test.tsx` (+۱ تست تزریق فرمول)، `fileUploadOnChangeWiring.test.tsx`، `phase3Palette.test.ts`، `vizTreeSelectCascaderComboboxBinding.test.tsx` — همه به‌روزرسانی/تکمیل شدند.

### نتیجه‌ی نهایی تأییدشده
`tsc --noEmit`: صفر خطای جدید نسبت به baseline (کل شمارش حتی کمتر از baseline: ۱۷۰۰ در مقابل ۱۷۱۸؛ ۳ مورد باقی‌مانده در diff نرمال‌شده همان آرتیفکت‌های line-shift شناخته‌شده‌اند). کل سوییت `vitest src/domain/component-designer`: صفر فایل تست تازه‌شکسته نسبت به baseline.
