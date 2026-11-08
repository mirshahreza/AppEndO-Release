# بازبینی UI/UX کامل Designer Studio (Inspector، Toolbox، دیالوگ‌ها/ویزاردها، Canvas) — تحلیل کامل + تحقیق بهترین شیوه‌های صنعت

> این سند نتیجه‌ی دو دور بررسی است. **دور اول** (بخش‌های ۱-۴): بررسی خط‌به‌خط Inspector، بررسی خط‌به‌خط Toolbox، و تحقیق میدانی روی بهترین الگوهای UI/UX صنعت (Figma، Framer، Webflow، Retool، VS Code، MUI/Ant Design/Chakra UI). **دور دوم** (بخش‌های ۵-۷، پس از بازخورد کاربر «حتی تغییرات بزرگ هم قبوله... همه‌چیز در صفحه‌ی دیزاینر را در نظر بگیر»): بررسی کامل هر ~۲۳ دیالوگ/ویزارد، و یک ممیزی کمّی سراسر کدبیس روی الگوی «border-stacking» که کاربر صریحاً به‌عنوان یک شکایت مستقل مطرح کرد («در پراپرتی من border های کنار هم زیاد می‌بینم و خیلی زشته»). هدف نهایی: مستندسازی دقیق وضعیت فعلی **کل صفحه‌ی Designer Studio** (نه فقط Inspector/Toolbox) + شواهد میدانی صنعت، به‌عنوان مبنای یک بازطراحی کامل — از جمله تغییرات ساختاری بزرگ در صورت لزوم — که در سند اجرایی همراه (`23-INSPECTOR-TOOLBOX-UX-EXECUTION-PHASES.md`) فازبندی شده است.

---

## بخش ۱ — وضعیت فعلی پنل Inspector (شواهد دقیق از کد)

### ۱.۱ معماری کلی

```
DesignerInspectorRegion.tsx   (فقط memo/prop-diff، بدون منطق layout)
  → DesignerInspector.tsx     (خودِ پنل — ۱۳۵۶ خط، یک کامپوننت غول‌پیکر تکه‌نشده)
      → InspectorPropFields.tsx      (رندر فیلدهای سه‌تیر Content/Style/Advanced)
      → InspectorInteractionsSection.tsx  (تیر «Behavior» — تنها جایی که از HeroUI Accordion واقعی استفاده می‌شود)
      → ده‌ها بلوک خام <details>/<summary> دست‌نویس برای پنل‌های Advanced (conditionals، source settings، node binding، global store، binding definitions، preview runtime، diagnostics)
```

`DesignerInspector.tsx` هیچ‌وقت به زیرکامپوننت تفکیک نشده — کل شاخه‌ی «نود انتخاب‌شده» (خطوط ۴۶۱–۱۱۷۸، حدود ۷۲۰ خط) یک درخت JSX پیوسته است که layout، منطق تیر، و پنل‌های یک‌بارمصرف دست‌نویس (`system-slot`, `platform-nav`, `reusable-slot`) را در هم آمیخته.

### ۱.۲ مدل تیر (Content/Style/Advanced) — و چرا ستون‌های گرید در «Advanced» گم می‌شوند

مدل سه‌تیری در `inspectorRegistry.ts:53-56` تعریف شده (`InspectorTierId = 'content' | 'style' | 'advanced'`) و به‌طور پیش‌فرض فقط `content` و `style` باز هستند (`INSPECTOR_DEFAULT_OPEN_SECTIONS`, خط ۶۰۶). تخصیص هر فیلد به یک تیر، بر اساس یک allow-list ثابت است (`isContentTierField`, خط ۶۹۲؛ `isStyleTierField`, خط ۷۱۰)؛ **هر فیلدی که در این دو allow-list نباشد، خودکار به Advanced می‌افتد** — این یک catch-all است، نه یک انتخاب آگاهانه.

**یافته‌ی حیاتی:** فیلد `columns` گرید (`inspectorPaletteFields.ts:500, 525`) با `group: 'heroui'` تعریف شده — نه در allow-list محتوا است، نه Style — پس به‌طور خودکار در Advanced قرار می‌گیرد. یعنی **مهم‌ترین تنظیم یک گرید (تعریف ستون‌ها) پشت یک toggle سراسری «Advanced» پنهان است**، دقیقاً همان چیزی که در عکس شما دیدید: باید اول «Advanced» را باز کنید تا اصلاً پنل ستون‌ها را ببینید.

یک لایه‌ی دوم و مستقل هم وجود دارد: `splitInspectorFields()` (`inspectorRegistry.ts:722-738`) با یک key-set جدا (`INSPECTOR_ADVANCED_FIELD_KEYS`, ~۵۵ کلید) یک primary/advanced دیگر **درون هر تیر** می‌سازد. یعنی دو مکانیزم افشای تدریجی مستقل، با دو قانون متفاوت، هم‌زمان روی هم اعمال می‌شوند.

### ۱.۳ سه (نه یک) مکانیزم Collapse موازی، بدون هماهنگی بصری

| مکانیزم | محل استفاده | مشکل |
|---|---|---|
| `<div>` ساده، همیشه باز | تیرهای Content/Style/Advanced | بدون collapse اصلاً |
| `<details>/<summary>` خام HTML | ~۲۰ بار در `DesignerInspector.tsx` (data-binding، shell/nav/reusable، conditionals، store، diagnostics...) | هر کدام رنگ حاشیه را دستی و متفاوت انتخاب می‌کنند (indigo/violet/teal/emerald/amber/sky) — نه از یک enum مرکزی؛ هر body باید یک workaround (`preventInspectorDetailsToggle`) داشته باشد چون کلیک روی یک input داخلی به‌طور پیش‌فرض کل `<details>` را می‌بندد — این یک نقص شناخته‌شده‌ی خودِ HTML `<details>` است |
| HeroUI `Accordion` واقعی (`UiAccordion`) | فقط یک‌بار، برای تیر «Behavior» | تنها جایی که واقعاً از کتابخانه‌ی کامپوننت خودِ پروژه استفاده می‌کند، نه HTML خام |

یک enum توکن رسمی برای رنگ (`AppSurfaceBoxTone`: `slate/violet/cyan/indigo/emerald/amber/rose`, `surfaceClasses.ts:547`) از قبل وجود دارد و توسط `AppSurfaceBox` استفاده می‌شود، اما `DesignerInspector.tsx` این را نادیده می‌گیرد و کلاس‌های Tailwind را دستی برای هر `<details>` تکرار می‌کند — یعنی **دو سیستم رنگ موازی و ناهماهنگ** برای دقیقاً همان نقش بصری (بدنه‌ی یک بخش).

### ۱.۴ خودِ کامپوننت عکس شما — `InspectorDataGridColumnsField.tsx` (۶۱۵ خط)

هر کارت ستون به‌صورت کامل و بدون هیچ collapse رندر می‌شود — یک state به نام `expandedWidths` (خط ۶۹) تعریف شده اما **هرگز در جای دیگری خوانده یا نوشته نمی‌شود** (کد مرده — احتمالاً قصد اولیه‌ی ساخت collapse بوده که هیچ‌وقت واقعاً وصل نشده).

برای یک ستون App Table Grid (دقیقاً نوع ستون در عکس شما)، هر کارت شامل تا **~۱۳ کنترل فرم** است، در ۸ ردیف/گروه منطقی، فقط با یک خط نازک `border-t border-slate-200/60` بین‌شان جدا شده:

1. Header Label + Field Key (۲ اینپوت، `grid-cols-2`)
2. Column Type + Width (سلکت + اینپوت)
3. Sortable/Filterable (۲ چک‌باکس) + دکمه‌های جابه‌جایی/حذف
4. *(شرطی)* تنظیمات ستون Action
5. *(شرطی)* Filter Type، Cell Display، Card Role، Hide Below (۴ سلکت)
6. *(شرطی)* تنظیمات Rich Cell
7. *(شرطی)* **Hideable/Resizable/Reorderable/Editable — دقیقاً همان ردیف چک‌باکس‌های ریز در عکس شما** (۴ چک‌باکس، `flex flex-wrap`)
8. *(شرطی)* Pin (سلکت None/Left/Right — دقیقاً همان دراپ‌داون پس از ردیف چک‌باکس‌ها)

این کل بلوک، بدون هیچ collapse، به ازای **هر ستون** تکرار می‌شود — برای یک گرید ۱۰ستونه، یعنی تا ۱۳۰ کنترل هم‌زمان روی صفحه.

توکن‌های تایپوگرافی/فاصله‌ی این فایل به‌تنهایی: کپشن فیلد `text-[10px]` (تکرار دستی در ≥۸ جا، نه یک ثابت مشترک)، لیبل چک‌باکس `text-[11px]`، padding کارت `p-2.5`، شعاع `rounded-lg`، فاصله‌ی بین کارت‌ها `space-y-3`.

### ۱.۵ سازگاری بصری در کل پنل (نمونه‌گیری از ۱۰ فایل)

| قرارداد | مقادیر یافت‌شده | وضعیت |
|---|---|---|
| شعاع گوشه‌ی بخش | `rounded-md` (تیرهای بالایی) در برابر `rounded-lg` (`AppSurfaceBox`) | ناسازگار |
| Padding بدنه‌ی بخش | `p-2` در برابر `p-3` | ناسازگار |
| کپشن ریز فیلد | `text-[10px] font-semibold text-slate-500` | مقدار یکسان، ولی در ≥۶ فایل به‌صورت رشته‌ی تکراری کپی‌شده، نه یک ثابت مشترک |
| لیبل چک‌باکس | `text-[11px]` (ستون‌های گرید) در برابر `text-xs` = ۱۲px (فیلد boolean عمومی) | ناسازگار برای همان نقش معنایی |
| پالت رنگ لهجه | ۸ رنگ مجزا (indigo/violet/teal/cyan/emerald/amber/rose/sky) به‌ازای هر فیچر، نه هر نقش معنایی | بدون حاکمیت مرکزی |
| دکمه‌های آیکون‌محور | `ICON_ACTION_*_CLASS` از `surfaceClasses.ts` | **سازگار** — این یک نمونه‌ی خوب موجود است |
| اندازه‌ی کنترل HeroUI | همه‌جا `size="sm"` (`!h-8`, ۳۲px) | **سازگار** |

### ۱.۶ الگوهای افشای تدریجی که از قبل وجود دارند (پایه‌ی قابل‌استفاده برای بازطراحی)

`InspectorAdvancedFieldGroup.tsx` از قبل یک کامپوننت کاملاً عمومی و آماده است: «محتوای اصلی + محتوای Advanced قابل‌جمع‌شدن + دکمه‌ی toggle» — همین الان برای «Conditionals» و «Source Settings» استفاده می‌شود. این **بهترین نامزد موجود** برای الگوی «فیلدهای پایه + Advanced به‌ازای هر بخش» است که تحقیق صنعت (بخش ۳) هم دقیقاً همین را توصیه می‌کند.

### ۱.۷ فهرست کامل انواع فیلد Inspector (۱۶ کامپوننت مجزا)

`InspectorOptionItemsField`, `InspectorStaticListItemsField`, `InspectorDataGridColumnsField`, `InspectorGridSortOptionsField`, `InspectorGridAggregationField`, `InspectorGridToolbarField`, `InspectorLayoutGridColumnWidthsField`, `InspectorLucideIconPickerField`, `InspectorContentRecordsField`, `InspectorGridActionColumnFields`, `InspectorGridRichCellFields`, `InspectorGridDisableRuleFields`, `InspectorDynamicActionsField`, `InspectorPropDialogField`, `InspectorPropBindingControl`, `InspectorVisualStylePanel` — **هیچ‌کدام بیش از یک بار (فقط برای لیبل کل ویجت) از `DesignerFieldRow` استفاده نمی‌کنند**؛ تقریباً نیمی اصلاً از آن استفاده نمی‌کنند و کلاس لیبل را دستی تکرار می‌کنند. یک یافته‌ی جانبی: حالت `layout="inline"` خودِ `DesignerFieldRow` **در کل کدبیس هیچ‌جا استفاده نشده** — کد مرده.

**نکته مهم درباره‌ی «رنگ»:** فیلدهایی با نام «Color» در واقع یک `select` با گزینه‌های معنایی ثابت هستند (`default/primary/secondary/success/warning/danger/accent`) — **هیچ color-picker واقعی (swatch/hex) در کل Inspector وجود ندارد.**

---

## بخش ۲ — وضعیت فعلی Toolbox (شواهد دقیق از کد)

### ۲.۱ دو سیستم دسته‌بندی موازی — که یکی‌شان مرده است

**سطح ۱ (مدل داده):** ۱۷ دسته‌ی خام در `DesignerPaletteCategory` (`types.ts:40-57`) + `DESIGNER_PALETTE_CATEGORY_LABELS` (`catalog.ts:1311-1329`). **این map کاملاً کد مرده است** — در `useDesignerPalette.ts` import می‌شود ولی هیچ‌وقت استفاده نمی‌شود.

**سطح ۲ (آنچه واقعاً رندر می‌شود):** یک نگاشت دستیِ جداگانه، `CATEGORY_MAPPING` در `useDesignerPalette.ts:86-111`، که ۱۷ دسته‌ی خام را به **۸ گروه تلفیقی** (`ConsolidatedCategory`) می‌ریزد — این، نه سطح ۱، UI واقعی Toolbox را می‌سازد.

مشکل: این تلفیق دسته‌های کاملاً نامرتبط را کنار هم می‌گذارد:
- **`logic-advanced`** = کنترل‌جریان (`logic.repeater`) + کامپوننت‌های قابل‌استفاده‌ی مجدد سرور-محور + Custom Elements + ویجت‌های Feedback/Status ثابت (Alert, Banner, Empty State) — چهار مقوله‌ی کاملاً بی‌ربط در یک آکاردئون.
- **`layout-containers`** = پریمیتیوهای layout + کل فهرست ثابت ۱۷تایی Shell Chrome + Platform Slots داینامیک سرور — سه نیت‌ نویسندگی کاملاً متفاوت.
- **`heroui-data-display`** همه‌ی ۱۶ آیتم `data-visualization` (چارت/نقشه/گانت/کانبان) را زیر برچسب «HeroUI» می‌گنجاند، درحالی‌که اکثرشان اصلاً کامپوننت HeroUI نیستند.

### ۲.۲ UI خودِ Toolbox

پنل شناور، قابل‌جابه‌جایی و قابل‌تغییر-اندازه (`DesignerToolbox.tsx`) — نه یک پنل docked ثابت. یک آکاردئون از ۸ گروه تلفیقی، که **فقط یک گروه (`layout-containers`) به‌طور پیش‌فرض باز است** — ۷ گروه دیگر (شامل هزاران... ببخشید، ۱۵۵ آیتم موجود، اکثرشان) پشت کلیک پنهانند. هنگام جست‌وجو، کل مکانیزم آکاردئون/دسته دور زده می‌شود و یک گرید تخت از نتایج نشان داده می‌شود.

هر کارت (`PaletteCard.tsx`): آیکون (۲۰px) + لیبل دو‌خطی ریز (~۹.۵px) در یک گرید تخت با سلول‌های ثابت ۹۲px. یک نقطه‌ی رنگی ۶×۶px برای هشدار پوشش (کهنه/شکسته) در گوشه — تنها نشانه‌ی بصری کیفیت. هیچ نشانه‌ی بصری‌ای برای «این آیتم داینامیک/سرور-محور است در برابر ایستا» وجود ندارد جز یک `sourceType` در متن tooltip.

### ۲.۳ یافته‌ی حیاتی — سیستم آیکون ناقص

آیکون‌ها از یک `ICON_MAP` ثابت با ~۱۰۶ نام lucide-react خوانده می‌شوند؛ هر رشته‌ی نامعلوم بی‌صدا به آیکون عمومی `LayoutTemplate` سقوط می‌کند. **حداقل ۱۷ آیتم از کاتالوگ ثابت** دقیقاً همین اتفاق برایشان می‌افتد (`Search`, `ScatterChart`, `MapPin`, `Map`, `HelpCircle`, `Quote`, `CreditCard`, `Eye`, `Ratio`, `Pin`, `Users`, `Clapperboard`, `AudioLines`, `QrCode`, `Barcode`, `Send`, `MessagesSquare`, `Command`, `Bell`) — یعنی این آیتم‌ها همین الان با یک آیکون عمومی و اشتباه در Toolbox نمایش داده می‌شوند، بدون این‌که کسی متوجه شود (هیچ خطا/هشدار build-time وجود ندارد).

### ۲.۴ جست‌وجو

فقط substring case-insensitive روی `label`/`id`/`sourceRef` — **نه** روی `category`، بدون fuzzy matching، بدون رتبه‌بندی، بدون «اخیراً استفاده‌شده». آیتم‌های `legacy: true` (مثل `heroui.table`) از جست‌وجو هم مستثنا هستند (رفتار درست و عمدی).

### ۲.۵ خلاصه‌ی عددی

۱۵۵ آیتم همیشه-حاضر (۱۳۳ ایستا + ۱۷ Shell Chrome runtime-fixed + ۵ Platform Nav runtime-fixed) + تعداد نامحدود آیتم داینامیک سرور (Reusable Components، Custom Elements، Platform Slots) — همه در ۸ آکاردئون که فقط یکی‌شان پیش‌فرض باز است.

---

## بخش ۳ — خلاصه‌ی تحقیق بهترین شیوه‌های صنعت

### ۳.۱ پنل ویژگی (Property/Inspector Panel)

**الگوهای مشترک بین Figma، Framer، Webflow، Retool، VS Code:**

1. **بخش‌های نام‌دار و از‌هم‌جدا، با collapse** — نه یک اسکرول تخت.
2. **فیلدهای اصلی همیشه دیده می‌شوند؛ فیلدهای فرعی پشت یک «Advanced» *به‌ازای هر بخش*، نه یک Advanced سراسری واحد.** بلاگ رسمی Retool («Simplifying Retool's Inspector») دقیقاً همین مسیر بازطراحی را رفته: ۴۰+ بخش پراکنده را به ۳ دسته‌ی ثابت **Content / Interaction / Appearance** جمع کردند، هر کدام با toggle Advanced مستقل خودش.
3. **ردیف‌های فشرده‌ی چندفیلدی برای مقادیر کوتاه مرتبط** (مثل X/Y/W/H در Figma) به‌جای یک ردیف کامل‌عرض به‌ازای هر فیلد — دقیقاً کاربردی برای فیلدهای کوتاه شما مثل Width/Category.
4. **نشانگر «مقدار غیرپیش‌فرض دارد» روی بخش‌های بسته** (نقطه‌ی رنگی Webflow) — یعنی جمع‌کردن یک بخش هرگز state را پنهان نمی‌کند.
5. **متن توضیحی همیشه‌مرئی کنار فیلد**، نه فقط در tooltip (VS Code، Framer) — مستقیماً پاسخ به شکایت «کاربر گیج می‌شود».

**برای «فهرست تکرارشونده‌ی آیتم‌های قابل‌تنظیم» (ستون‌های گرید — دقیقاً حالت شما):**
الگوی همگرا: **ردیف جمع‌شده = آیکون + نام + یک نوار برچسب/badge کوچک برای گزینه‌های فعال (نه چک‌باکس کامل) + دستگیره‌ی drag** → کلیک روی ردیف، ویرایشگر کامل را فقط برای همان یک آیتم باز می‌کند؛ بقیه‌ی ردیف‌ها جمع می‌مانند. Retool مستقیماً این را برای ویرایشگر ستون جدول خودشان اجرا کرده است.

**برای خوشه‌ی چک‌باکس‌های بولی (Sortable/Filterable/Resizable/Hideable/Pin):**
توصیه‌ی مشخص تحقیق: **ردیف Chip قابل‌کلیک** (نه چک‌باکس، نه Switch) برای ۵ تا ۸ گزینه‌ی مستقل — سطح کلیک بزرگ‌تر، در یک خط، وضعیت روشن/خاموش در نگاه اول قابل‌دیدن. Segmented Control فقط برای انتخاب انحصاری واقعی (مثل Pin: None/Left/Right) رزرو شود، نه برای بولین‌های مستقل.

### ۳.۲ پالت کامپوننت (Toolbox)

- **جست‌وجو باید نقطه‌ی ورود اصلی باشد**، نه ثانویه، وقتی کتابخانه از ~۵۰ آیتم بگذرد (Figma/Framer/Webflow/Gutenberg همه سرچ را بالای پنل می‌گذارند؛ Figma و Gutenberg fuzzy/معنایی هم دارند).
- **یک شبه‌دسته‌ی «Recently Used»/«Most Used» بالای فهرست** — الگوی تکرارشونده (Gutenberg این را صریح دارد)؛ با ۱۵۵+ آیتم، اکثر کاربران فقط ۱۰-۱۵ تای ثابت را مکرراً می‌خواهند.
- **عمق دسته‌بندی باید کم بماند** — یک سطح، به‌ندرت دو سطح (Gutenberg's Blocks vs. Patterns تنها نمونه‌ی واقعی دو-سطحی است).
- **گرید آیکون+لیبل، نه فهرست متنی تخت** — Toolbox فعلی شما از قبل این را دارد (نکته‌ی مثبت موجود).
- **وضعیت باز/بسته‌ی هر دسته باید persist شود.**

**طبقه‌بندی استاندارد همگرا** (از مقایسه‌ی مستقیم مستندات MUI، Ant Design، Chakra UI): **Layout، Navigation، Forms/Data-Entry، Data Display، Feedback، Overlays، Buttons، (Media به‌صورت اختیاری)، Utilities/Other** — این دقیقاً طرح پیشنهادی خودِ شما (Layout, Forms/Inputs, Data Display, Navigation, Feedback, Media, Data Visualization) را با شواهد مستند صنعتی تأیید می‌کند؛ فقط Data Visualization به‌عنوان دسته‌ی جدا در هیچ‌کدام از سه کتابخانه به‌طور مستقل وجود ندارد (در Data Display ادغام می‌شود) — با توجه به این‌که شما ۱۶ آیتم چارت/نقشه/گانت/کانبان دارید، نگه‌داشتنش به‌عنوان دسته‌ی جدا موجه است.

---

## بخش ۴ — بازبینی کلی سیستم طراحی (Design System)

بر اساس شواهد بالا (نه فقط Inspector/Toolbox، بلکه کل قراردادهای بصری مشترک این دو سطح):

| مؤلفه | وضعیت فعلی | مشکل |
|---|---|---|
| مقیاس تایپوگرافی | حداقل ۴ سایز دلخواه پراکنده: `text-[9.5px]`, `text-[10px]`, `text-[11px]`, `text-xs`(۱۲px) | بدون نام/توکن رسمی؛ هرکس هر عدد را که خواسته انتخاب کرده |
| شعاع گوشه | `rounded-md`(۶px) و `rounded-lg`(۸px) برای همان نقش «کارت/بخش» | دو استاندارد موازی |
| Padding بخش | `p-2` و `p-3` برای همان نقش | دو استاندارد موازی |
| پالت رنگ لهجه | ۸ رنگ (indigo/violet/teal/cyan/emerald/amber/rose/sky) به‌ازای فیچر | بدون نقش معنایی مشخص (کدام رنگ یعنی چه؟) — باید به یک پالت معنایی محدود (Primary/Success/Warning/Danger/Info) تقلیل یابد |
| کامپوننت بخش‌بندی | `AppSurfaceBox` (بالغ، توکن‌دار) در برابر `<details>` خام دست‌نویس | دو مسیر موازی برای دقیقاً یک نقش — `AppSurfaceBox` باید تنها مسیر باشد |
| دکمه‌های آیکونی | `ICON_ACTION_*_CLASS` مشترک | ✅ نمونه‌ی خوب موجود — الگو باید تعمیم یابد |
| اندازه‌ی کنترل HeroUI | `size="sm"` یکنواخت | ✅ نمونه‌ی خوب موجود |
| سیستم آیکون Toolbox | `ICON_MAP` با حداقل ۱۷ نگاشت گمشده | باگ واقعی، نیازمند رفع + محافظ خودکار (تست/لینت) |

**نتیجه‌ی کلی:** پروژه یک پایه‌ی خوب دارد (`AppSurfaceBox`، `ICON_ACTION_*_CLASS`، اندازه‌ی `size="sm"` یکنواخت، مدل سه‌تیر Content/Style/Advanced که مفهوماً close به الگوی Retool است) — مشکل اصلی «نبود یک سیستم طراحی» نیست، بلکه **عدم اعمال یکنواخت همان الگوهای خوبی است که خودِ کدبیس از قبل دارد.** بازطراحی باید روی «تعمیم و اجباری‌کردن» این الگوهای موجود تمرکز کند، نه اختراع یک زبان بصری کاملاً جدید.

---

## بخش ۵ — دیالوگ‌ها و ویزاردها (۲۳ کامپوننت، ~۶۹۰۰ خط، بررسی کامل)

هر دیالوگ/ویزارد قابل‌دسترس از `ComponentDesignerView.tsx` بررسی شد — از دیالوگ‌های ساده‌ی تأیید تا ویزاردهای چندمرحله‌ای Auto-Build و مدیرهای تمام‌صفحه (Asset Manager، Data Connector Manager، Design System Editor).

### ۵.۱ سه سیستم مجزا و ناهماهنگ Chrome دیالوگ — نه یک پایه‌ی مشترک

برخلاف Inspector/Toolbox (یک درخت کامپوننتی)، دیالوگ‌ها روی **سه سیستم chrome کاملاً مجزا و دست‌ساز** بنا شده‌اند؛ هیچ‌جا از `Modal` خام HeroUI استفاده نمی‌شود:

| Shell | فایل | Backdrop | مصرف‌کننده‌ها |
|---|---|---|---|
| **A. `DesignerDialog`** | `components/dialogs/DesignerDialog.tsx` (۲۴۹ خط) | تگ بومی `<dialog>`، لایه‌ی `::backdrop`: `rgba(15,23,42,0.12)` + `blur(4px)` — بسیار کم‌رنگ (`src/index.css:216-220`) | ۱۳ دیالوگ ساده‌ی تأیید/CRUD/مدیریت |
| **B. `StepWizardShell`** | `shared/ui/StepWizardShell.tsx` (۴۱۵ خط) | یک `div` ثابت با `createPortal`، `bg-slate-900/40 backdrop-blur-sm` — یک scrim تیره‌تر با شدت ۴۰٪، کاملاً بی‌ربط به استاندارد `<dialog>` بومی | ۳ ویزارد Auto-Build + هر ۶ `Binding*WizardDialog` |
| **C. کاملاً دست‌ساز، بدون shell مشترک** | `components/dialogs/DesignerPreviewDialog.tsx` (۵۲۹ خط) | **هیچ** — یک `motion.aside` شناور/قابل‌جابه‌جایی/قابل‌تغییر-اندازه، بدون هیچ overlay تیره‌کننده | فقط Preview زمان اجرا |

یعنی پاسخ به «آیا یک shell مشترک وجود دارد» ترکیبی است: بله برای دیالوگ‌های تأیید/مدیریت (A)، بله برای ویزاردهای Auto-Build/Binding (B)، اما یک سیستم سوم کاملاً مجزا برای Preview (C) — سه شدت تیرگی backdrop متفاوت، سه رفتار متفاوت برای close/انیمیشن (رویداد `cancel` بومی `<dialog>` در برابر listener مستقل `Escape` در برابر یک listener مستقل سوم `Escape`).

**Shell A** (`DesignerDialog.tsx:184-248`): بدنه‌ی `rounded-xl border border-slate-200 bg-white shadow-2xl`؛ هدر `border-b border-slate-200 bg-slate-50/80`؛ فوتر اختیاری `border-t border-slate-200 bg-slate-100/90`. طبق قرارداد مستندشده در `AGENTS.md` («استاندارد بدنه‌ی دیالوگ»)، هر دیالوگ باید بدنه‌ی پیش‌فرض را override کند و خودش دوباره در `bg-white p-[15px]` بپیچد — **هر دیالوگ بررسی‌شده این کار را دستی و جداگانه انجام می‌دهد** (مثلاً `DesignerDeleteComponentDialog.tsx:50`, `DesignerDraftDialog.tsx:98`, `ComponentInfoDialog.tsx:41`) — یک قرارداد تکرارشونده و مستعد خطای تایپی، نه یک prop داخلی.

**Shell B** (`StepWizardShell.tsx:170-385`): پوسته با **دو کلاس border جدا روی همان المان** — `CREATE_EDIT_MODAL_SHELL_CLASS` شامل `border border-slate-200` (`surfaceClasses.ts:54-55`) **به‌علاوه** `DIALOG_SHELL_CHROME_BORDER_CLASS` معادل `border-[1.5px]` (`surfaceChromeClasses.ts:153`) — یعنی خودِ پوسته‌ی بیرونی هر ویزارد از قبل دو تعریف border هم‌زمان دارد. نوار Stepper هم هر سلول را با `border-e border-border-divider` جدا می‌کند.

**Shell C** (`DesignerPreviewDialog.tsx:393-529`): تنها عضو این خانواده که واقعاً انیمیت می‌شود (`motion.aside`، transition مقیاس+شفافیت)؛ درگ/تغییر-اندازه‌ی کاملاً دست‌نویس (mousedown/mousemove)؛ چند نوار ابزار پشت‌سرهم که هرکدام `border-b border-border-subtle` مستقل دارند.

### ۵.۲ Border-stacking در ویزاردها — همان الگوی Inspector، تکرارشده

الگوی «هر لایه‌ی تودرتو، بردر خودش را اضافه می‌کند» که در بخش ۱.۴ برای `InspectorDataGridColumnsField` مستند شد، **عیناً داخل `AutoFormWizardDialog` هم تکرار می‌شود** — این یک باگ محلی Inspector نیست، یک الگوی معماری در کل کدبیس است:

۱. **بردر پوسته‌ی ویزارد** — `StepWizardShell.tsx:160-168` (دو تعریف border هم‌زمان، بند ۵.۱ بالا)
۲. **بردر بخش `AppSurfaceBox`** — `AutoFormWizardDialog.tsx:536-544`: `<AppSurfaceBox tone="cyan" title="Form fields">` که خودش `APP_SURFACE_BOX_SHELL_CLASS = 'overflow-hidden rounded-lg border bg-white'` را رندر می‌کند (`surfaceClasses.ts:602`)
۳. **بردر کارت هر ردیف فیلد** — `AutoFormWizardDialog.tsx:560-563`: هر فیلد یک `<div className="... rounded-lg border border-slate-200 bg-white ...">` جدا
۴. **بردر خودِ کنترل** — `UiSelect`/`UiInput` داخل آن ردیف (`:579-597`) با `fieldBorderClass` مستقل خودش (`HeroFieldControls.tsx:640`)

**۴ لایه‌ی بردر تودرتو** دور یک جفت label+select — دقیقاً همان الگوی ۴ تا ۶ لایه‌ای که کاربر در عکس گرید-columns دید. الگوی مشابه (کم‌عمق‌تر، ۲-۳ لایه) در `AutoCrudWizardDialog.tsx:656` (کارت‌های custom-action داخل `AppSurfaceBox`) و در جدول‌های مرحله‌ی Review هر دو ویزارد Table/Crud هم دیده می‌شود.

خارج از ویزاردها: `ComponentInfoDialog.tsx:42,57` (دو باکس اطلاعاتی خواهر، هرکدام `rounded-md border`، مستقیماً داخل بردر خودِ پوسته‌ی دیالوگ)؛ `DesignSystemEditorDialog.tsx:405,483` (نوار «افزودن» با بردر خودش، داخل پوسته‌ی بردردار fullscreen، داخلش هم `UiInput`های بردردار)؛ `CustomElementsManagerDialog.tsx:135,176` (دو پنل خواهر sidebar/editor، هرکدام `rounded-lg border`، هر دو مستقیماً چسبیده به بردر پوسته‌ی بیرونی).

**یک الگوی ضدـstacking از قبل در کدبیس وجود دارد و باید مبنای راه‌حل شود:** `DesignerFieldRow.tsx` خودش هیچ borderی اضافه نمی‌کند (`components/DesignerFieldRow.tsx:48-58`)، و `src/index.css:222-228` صراحتاً بردر input/select خام را وقتی داخل `.designer-field-row` است حذف می‌کند. مشکل این است که ویزاردهای Auto-Build/Binding به‌جای استفاده از این پرایمیتیو مشترک، دیوهای دست‌ساز خودشان را می‌سازند.

### ۵.۳ نشانگر چندمرحله‌ای — چهار مکانیزم بصری متفاوت برای یک مفهوم

| مکانیزم | مصرف‌کننده‌ها |
|---|---|
| نوار Stepper کامل (سلول آیکون+لیبل، کلیک‌پذیر، زیرنویس توضیح) | همه‌ی مصرف‌کننده‌های `StepWizardShell`: ۳ ویزارد Auto-Build + هر ۶ Binding wizard |
| Stepper دایره‌ی شماره‌دار دست‌ساز، مستقل از `StepWizardShell` | `ExportToPackageWizardDialog.tsx:144-172` — دایره‌های `1 2 3` با رنگ‌های جدا، شورون بین‌شان |
| دو-view toggle، **بدون هیچ نشانگر پیشرفت** (یک لینک متنی «مرور همه‌ی قالب‌ها» بین دو view سوییچ می‌کند) | `NewLayoutDialog.tsx` |
| تب‌های toggle-button ساده (نه معنای واقعی wizard) | `DesignSystemEditorDialog.tsx:314-330` |

کاربری که پشت‌سرهم «Auto Form Wizard» → «Export to Package» → «New Layout» را باز کند، سه پاسخ بصری متفاوت به «الان کجای فرآیندم» می‌بیند.

### ۵.۴ دکمه‌ی اکشن اصلی — جایگاه یکنواخت، اما رنگ/معنا ناهماهنگ

جایگاه (پایین-راست) در همه‌جا یکنواخت است. اما رنگ/intent نه:

- استاندارد = indigo توپر (`AppButton intent="primary"`) — اکثر دیالوگ‌ها.
- **`DesignerPublishDiffDialog.tsx:38`**: دکمه‌ی «Publish» (پرمخاطره‌ترین و غیرقابل‌بازگشت‌ترین اکشن کل مجموعه) با `intent="confirm"` (emerald نرم) رندر می‌شود — سبک‌تر از دکمه‌ی Save معمولی.
- **`StepWizardShell`**'s دکمه‌ی «Next» در هر مرحله‌ی میانی `intent="secondary"` (indigo نرم) است و فقط در مرحله‌ی آخر به `intent="primary"` (indigo توپر) تغییر می‌کند — یعنی وزن بصری دکمه‌ی «جلو» در طول یک ویزارد واحد عوض می‌شود.
- **`DataConnectorManagerDialog`** و بخش Tokens/Variants **`DesignSystemEditorDialog`**: اکشن اصلی («Save changes»/«Create connector») داخل بدنه (پنل ویرایشگر) است، نه فوتر — فوتر فقط «Close» دارد (`DataConnectorManagerDialog.tsx:247-254` در برابر `:512-517`) — نقض قرارداد «اکشن اصلی در فوتر» که همه‌ی دیالوگ‌های دیگر رعایت می‌کنند.
- **`NewLayoutDialog`** اصلاً دکمه‌ی primary ندارد (انتخاب با کلیک مستقیم روی کارت انجام می‌شود)؛ **`DesignerAssetManager`** هم فوتر فقط-Close دارد (آپلود/حذف اکشن‌های inline هستند).

### ۵.۵ Backdrop/انیمیشن — یافته‌ی مکمل

Shell A: تینت ۱۲٪ + بلور ۴px (خیلی سبک). Shell B: تینت ۴۰٪ + بلور — محسوساً تیره‌تر. Shell C: بدون هیچ تیرگی، تنها عضو انیمیت‌شده. یعنی حتی «تیرگی پس‌زمینه هنگام باز شدن یک دیالوگ» بین سه سیستم فرق می‌کند.

---

## بخش ۶ — ممیزی کمّی سراسر کدبیس: Border-Stacking و عناصر ریز

بر اساس شکایت صریح کاربر («border های کنار هم زیاد می‌بینم») این بخش پرسش را از «آیا این یک مورد محلی است» به «این الگو در کل Component Designer چقدر گسترده است» می‌برد — با grep مستقیم روی کل `src/features/component-designer/`.

### ۶.۱ گستردگی واقعی الگو

`grep -rn "border border-slate-200"` روی `src/features/component-designer/` → **۱۷۲ مورد در ۶۵ فایل جدا**. این یک باگ یک کامپوننت نیست؛ یعنی «هر wrapper سطح تودرتو بردر خودش را اضافه می‌کند» یک عادت نویسندگی سراسری است که در Inspector (۱۳+ فایل)، ویزاردها (بخش ۵.۲)، و دیالوگ‌های مدیریتی (Asset/Connector/DesignSystem/CustomElements Manager) به یک شکل تکرار شده.

### ۶.۲ دو الگوی موجود و درست که باید مبنای راه‌حل شوند (نه اختراع چیز جدید)

- **Canvas selection chrome**: `canvasNodes.tsx:~1306-1307,1413-1414` از `ring-2 ring-cyan-300/70 ring-offset-1` (حالت انتخاب) و `ring-2 ring-rose-300/70 ring-offset-1` (حالت خطا) استفاده می‌کند — یک مکانیزم مبتنی بر box-shadow (`ring`) که هرگز روی هم انباشته نمی‌شود و در layout جایی اشغال نمی‌کند، برخلاف `border`.
- **`DesignerPublishLifecycleBadge.tsx:60-67`**: بج وضعیت (Draft/Saved/Published) از `ring-1 ring-inset` به‌جای `border` استفاده می‌کند.

این دو نشان می‌دهد راه‌حل از قبل در کدبیس امتحان و پذیرفته شده — بازطراحی باید این الگو (ring/shadow برای لایه‌های تودرتو، به‌جای border جدید در هر سطح) را تعمیم دهد، نه یک زبان بصری تازه اختراع کند.

### ۶.۳ سایه (Shadow) — بر خلاف بردر، این یکی نسبتاً منضبط است

بررسی همه‌ی ۵۵+ مورد `shadow-*` در فیچر: `shadow-sm` به‌طور یکنواخت برای پنل‌ها/کارت‌های درون‌خطی (Inspector fields، Toolbox flyout body) و `shadow-2xl` به‌طور یکنواخت برای دیالوگ‌های واقعی/فلای‌اوت‌های سطح‌بالا (`DesignerDialog.tsx:206`, `DesignerToolbox.tsx:146`, `DesignerPreviewDialog.tsx:405`) استفاده شده — یک سلسله‌مراتب ارتفاع (elevation) قابل‌قبول که **نیازی به بازطراحی ندارد**، فقط باید هنگام معرفی توکن‌های رسمی فاز ۱ (سند ۲۳) به‌عنوان یک قرارداد موجود مستند و حفظ شود.

### ۶.۴ کتابخانه‌ی آیکون — سازگار

`grep` برای `react-icons`/`@heroicons` در کل `component-designer` صفر نتیجه داد — همه‌جا فقط `lucide-react`. این یک نکته‌ی مثبت موجود است که باید همین‌طور حفظ شود (فقط باگ نگاشت مفقود در فاز ۹ سند ۲۳ باید رفع شود).

### ۶.۵ Tooltip — یک مکانیزم واحد، اما سطح‌پایین

هیچ کامپوننت tooltip غنی (با تأخیر hover، جای‌گذاری هوشمند، پشتیبانی لمسی) در کل فیچر پیدا نشد. هر نقطه‌ای که نیاز به توضیح کوتاه دارد — `InspectorFieldHelpLink.tsx:15`, `PaletteCard.tsx:37`, `DesignerPublishLifecycleBadge.tsx:68`, نشانگر maturity در `PaletteCard.tsx:52` — صرفاً از attribute بومی `title` مرورگر استفاده می‌کند. این *سازگار* است (یک الگو، نه چند)، اما سطح کیفیتش پایین‌تر از باقی سیستم است: بدون تأخیر قابل‌تنظیم، بدون استایل‌دهی، غیرقابل‌دسترسی روی صفحه‌لمسی. یک یافته‌ی جزئی برای فهرست «عناصر ریز» کاربر، نه یک باگ بحرانی.

### ۶.۶ کارت Toolbox خودش (`PaletteCard.tsx`) — بررسی مجدد، بدون مشکل stacking

برخلاف بقیه‌ی کدبیس، `PaletteCard.tsx:42-45` از `border border-transparent` (نه یک رنگ واقعی) با تغییر به `hover:border-cyan-200` استفاده می‌کند — یعنی خودِ کارت‌های Toolbox دچار مشکل انباشت بردر نیستند؛ مشکلات واقعی Toolbox (سند بخش ۲) جای دیگری‌اند: طبقه‌بندی، آیکون گمشده، کشف‌پذیری.

---

## بخش ۷ — Canvas (بوم) و نوار ابزار بالا

بررسی مستقیم `DesignerWorkspaceToolbar.tsx`، `DesignerSelectionAlignBar.tsx`، `DesignerCanvasCommentsBar.tsx`، `canvas/canvasNodes.tsx`، و `canvas/DesignerCanvas.tsx`.

### ۷.۱ نوار ابزار بالا — یک نمونه‌ی خوب موجود، نه یک مشکل

`DesignerWorkspaceToolbar.tsx` به‌طور یکنواخت از `AppButton size="icon-md" intent="utility"` برای همه‌ی دکمه‌های آیکونی استفاده می‌کند، گروه‌ها را با یک جداکننده‌ی رسمی و مشترک (`DESIGNER_TOOLBAR_SEPARATOR_CLASS`) از هم جدا می‌کند، و `role="group" aria-label="..."` معنایی برای هر خوشه دارد (History، Workspace tools، Viewport، Panels). هیچ نمونه‌ی border-stacking در این فایل یافت نشد — این باید به‌عنوان **الگوی مرجع** برای یکسان‌سازی دکمه‌های آیکونی در فازهای دیگر (بخصوص فاز ۴/۶ سند ۲۳) استفاده شود.

### ۷.۲ Align Bar و Comments Bar — دو کامپوننت تقریباً یکسان، دوبار پیاده‌سازی شده

`DesignerSelectionAlignBar.tsx` (نوار «۲ آیتم انتخاب شد» + دکمه‌های Align) و `DesignerCanvasCommentsBar.tsx` (نوار Comments) هر دو دقیقاً همان اسکلت را دارند — `border-b` + برچسب کوچک‌حروف‌بزرگ + جداکننده‌ی عمودی نازک + دکمه(ها) — اما در دو فایل مجزا با کد کاملاً تکراری پیاده‌سازی شده‌اند، بدون یک کامپوننت پایه‌ی مشترک. رنگ‌شان هم بدون دلیل معنایی متفاوت است (Align Bar: `slate`، Comments Bar: `amber`) — نه یک نقش رنگی مشخص (مثلاً «نوار وضعیت انتخاب» = یک رنگ ثابت). کاندید مناسب برای یک پرایمیتیو مشترک تازه (`DesignerCanvasStatusBar` یا مشابه) اگر بخش‌های آینده نوار مشابه دیگری اضافه کنند.

### ۷.۳ زنجیره‌ی Node/Drop-zone بوم — بدون مشکل انباشت بردر

- انتخاب نود: `ring-2 ring-cyan-300/70 ring-offset-1` (`canvasNodes.tsx:1306-1307,1413-1414`) — قبلاً به‌عنوان الگوی مثبت در بخش ۶.۲ ثبت شد.
- بنر خطا/تشخیص داخل یک نود: `rounded-md border ...` (`canvasNodes.tsx:1358,1480`) — این یک بردر «برگ» (leaf) واقعی روی یک بنر مستقل است، نه لایه‌ای روی لایه‌ی دیگر؛ چون بردر بیرونی نود خودش `ring` است نه `border`، این دو با هم انباشته نمی‌شوند — **بدون مشکل**.
- Placeholder کانتینر خالی: `rounded-md border-2 border-dashed border-amber-300/90` (کانتینر عمومی، `canvasNodes.tsx:334-338`) و `border-2 border-dashed border-indigo-200` (کانتینر DOM سفارشی، `canvasNodes.tsx:968-971`) — الگوی متعارف «drop-zone خالی با بردر نقطه‌چین» در ابزارهای طراحی، و چون این کانتینرها خودشان معمولاً بدون بردر دیگری تودرتو نیستند، **stacking واقعی ایجاد نمی‌کنند**.
- قاب بیرونی بوم: `DesignerCanvas.tsx:216` یک `border border-dashed border-slate-400/70` تکی برای کل ویوپورت؛ برچسب اندازه (`:310`) و دستگیره‌ی تغییر اندازه (`:319`) هرکدام یک بردر مستقل و شناور دارند (نه تودرتوی داخل قاب اصلی) — **بدون مشکل**.

### ۷.۴ نتیجه‌ی این بخش

برخلاف Inspector/دیالوگ‌ها، **Canvas و نوار ابزار بالا از قبل نسبتاً منضبط‌اند** و نیازی به یک فاز اصلاحی مشابه فاز ۱۳ ندارند. تنها یافته‌ی واقعی، تکرار کد بین Align Bar/Comments Bar است (بخش ۷.۲) — یک بهبود کوچک reuse، نه یک باگ بصری. Section ۷.۱ (نوار ابزار) باید به‌عنوان الگوی مرجع دکمه‌ی آیکونی در بقیه‌ی فازها ارجاع داده شود.

---

*ادامه در `23-INSPECTOR-TOOLBOX-UX-EXECUTION-PHASES.md` — فازبندی دقیق و اجرایی این بازطراحی، شامل فازهای جدید برای Border-Stacking سراسری، یکپارچه‌سازی Shell دیالوگ‌ها، و سازگاری دکمه‌ی اکشن اصلی.*
