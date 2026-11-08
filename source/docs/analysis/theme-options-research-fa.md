# تحقیق گسترده: گزینه‌های پوسته و شخصی‌سازی شِل (Theme / Shell Options)

**وضعیت:** تصمیمات قفل‌شده (اپراتور) · **تاریخ:** 2026-09-26  
**هدف:** قبل از هر تغییر کد، فهرست گزینه‌های رایج در ادمین‌های حرفه‌ای، نگاشت به AppEndO، و تصمیم «ادمین / کاربر / هر دو» با فازبندی پیشنهادی.

**منابع مرجع (بازار):**

- [CoreUI — Sidebar & Offcanvas](https://coreui.io/bootstrap/docs/components/sidebar/) · [React Sidebar](https://coreui.io/react/docs/components/sidebar/)
- [ThemeWagon — Admin & Dashboard](https://themewagon.com/themes/) (نمونه‌های رایج: Phoenix، Horizon، Shadcn Admin، TailwindAdmin)
- [Wrapmarket — Web App templates](https://wrapmarket.com/web-templates/web-app) (Nixboard، SmartAdmin، DiBold، Adminex، …)
- [CodedThemes — Free admin templates](https://codedthemes.com/item/category/free-templates/) (Mantis، Berry، Datta Able، SaasAble)
- [Uizard](https://uizard.io/) — **ابزار طراحی AI** (تولید تم روی ماکاپ؛ معادل «Theme Designer محصول» نیست)

---

## 1. خلاصه مدیریتی

AppEndO **هم‌اکنون** لایهٔ «تم بصری» (Theme Designer + accent per user) و لایهٔ «رفتار شِل» (سایدبار، عرض صفحه، فول‌اسکرین) را **جدا** نگه داشته، اما گزینه‌های رفتاری **متمرکز، قابل‌پیکربندی توسط ادمین، و هم‌تراز با Shell Designer** نیستند. سایدبار فقط «باز / rail 81px» است؛ پیش‌فرض همیشه باز؛ و state در `localStorage` است نه ترجیحات سرور.

پیشنهاد مسیر:

1. **قرارداد واحد** `ShellExperiencePreferences` (ترجیحات تجربه) جدا از **توکن‌های CSS** Theme Designer.
2. **ادمین** سیاست و پیش‌فرض پورتال/استودیو را تعیین کند؛ **کاربر** در محدودهٔ مجاز override کند (الگوی موجود `layoutWidthUserControl`).
3. **فاز ۱** روی گزینه‌هایی که کاربر الان هم انتظار دارد: پیش‌فرض سایدبار، حالت minimize (rail vs پنهان کامل vs offcanvas)، و expose در پروفایل/تنظیمات — **بدون** شکستن `ui.admin-shell.geometry-lock`.
4. **فاز ۲+** (اختیاری) چگالی/motion؛ **بدون** dark/light shell (تصمیم اپراتور: رنگ از Theme Designer کافی است).
5. **هاب واحد UX:** همان workspace فعلی Theme Designer (نام پیشنهادی **Appearance** / **Shell appearance**) — نه پخش در Profile/Settings.

---

## 2. وضعیت فعلی AppEndO (خط مبنا)

| حوزه | امروز | ذخیره‌سازی | محدودیت |
|------|--------|------------|---------|
| **Accent + Theme Designer tokens** | کاربر logged-in؛ Theme Designer swatchها | `base_settings` USER: `accent_theme`, `theme_presets` | Tier-1 accent طبق `ui-design-system.md`؛ لاگین accent ثابت |
| **سایدبار collapsed** | toggle → عرض **253px** vs **rail 81px** (نه صفر) | `localStorage` `appendo.admin.sidebar-collapsed` | پیش‌فرض: **باز** (`readStoredSidebarCollapsed() ?? false`) |
| **گروه‌های nav باز** | accordion state | `localStorage` `appendo.admin.nav-expanded-groups` | per-browser |
| **عرض صفحه bounded/fluid** | دکمه در Profile drawer | context + shell document؛ `layoutWidthUserControl` در Shell Recipe | الگوی **ادمین پیش‌فرض + کاربر toggle** |
| **فول‌اسکرین** | Profile drawer | session (state) | — |
| **Shell Designer recipe** | پورتال‌های experience: topology، regions، visual، responsive | metadata روی سند designer | `capabilities.userPreferences` برای app mode؛ بسیاری runtime نشده |
| **Geometry lock** | عرض‌ها، logo band، collapse toggle | `ui-core.md` §Admin shell geometry lock | تغییر rail width بدون تأیید اپراتور ممنوع |

**فایل‌های کلیدی:**

- ترجیحات سایدبار: `src/shared/ui/adminLayoutPreferences.ts`
- مصرف: `src/layouts/AdminLayout.tsx`, `src/layouts/appShell/AppShell.tsx`
- قرارداد شِل (آینده‌نگر): `src/shared/api/contracts/shell-designer/schemas.ts` (`visual.*`, `responsive.overrides.*.collapse`, `regions.sidebar.layout`)
- تم توکن: `src/shared/theme/themeTokenCatalog.ts`
- منوی پروفایل: `src/components/profile/ProfileShellChromeMenu.tsx`

---

## 3. آنچه قالب‌های حرفه‌ای معمولاً ارائه می‌دهند

### 3.1 دسته‌بندی گزینه‌ها (بازار)

| دسته | گزینه‌های رایج | نمونه در بازار |
|------|----------------|----------------|
| **A. ناوبری / سایدبار** | پیش‌فرض expanded/collapsed؛ **narrow rail** (~64–81px)؛ **unfoldable** (rail + expand on hover)؛ **fully hidden** + hamburger؛ **offcanvas** موبایل؛ topology (vertical / horizontal / combo / dual)؛ sticky header | CoreUI `narrow`, `unfoldable`, mobile `visible`; Phoenix «10 layouts», sidenav collapse |
| **B. تم رنگی** | Light / Dark / **Auto** (system)； preset palettes؛ primary color picker؛ nav/header «darker» variant | Phoenix، اکثر Wrapmarket admin؛ CoreUI color modes |
| **C. چگالی** | Compact / default / comfortable؛ content vs chrome جدا | Shell recipe `chromeDensity`, `contentDensity`; Nixboard «5 theme systems» |
| **D. Layout محتوا** | Fluid vs boxed/max-width؛ user toggle | AppEndO `layoutWidth` + `layoutWidthUserControl` ✓ |
| **E. تایپوگرافی** | Scale، font family (کمتر در admin SaaS) | Shell recipe `typography.roles` |
| **F. شکل و عمق** | Radius، shadow، border | Shell recipe `shapeDepth`؛ Theme Designer بخشی از frost/texture |
| **G. Motion** | Reduced / subtle / expressive؛ respect `prefers-reduced-motion` | Shell recipe `motionLevel`؛ ui-core boot splash |
| **H. RTL / i18n** | Direction per user or culture | Phoenix RTL؛ AppEndO culture-driven RTL ✓ |
| **I. افکت / atmosphere** | Geometric bg، parallax (اغلب marketing) | Theme Designer `--app-atmosphere-geometry`؛ Shell `effects` |
| **J. Live customizer** | پنل کناری با preview فوری | Phoenix customizer؛ Nixboard live customizer؛ Horizon/Shadcn theme panel |
| **K. دسترسی** | High contrast، focus visible | CoreUI WCAG messaging |

### 3.2 الگوهای sidebar minimize (مهم برای درخواست شما)

```text
┌─────────────────────────────────────────────────────────────────┐
│ Mode            │ Desktop behavior          │ Typical user ctrl │
├─────────────────┼───────────────────────────┼───────────────────┤
│ Expanded        │ Full labels + icons       │ Yes               │
│ Icon rail       │ Fixed narrow strip        │ Yes (AppEndO now) │
│ Unfoldable rail │ Rail until hover → expand │ Sometimes admin   │
│ Hidden          │ 0 width; toggle opens     │ Yes               │
│ Offcanvas       │ Overlay drawer            │ Mobile default    │
└─────────────────────────────────────────────────────────────────┘
```

**CoreUI** سه حالت desktop را صریح نام می‌برد: full، `narrow` (≈4rem)، `narrow-unfoldable` (hover). موبایل offcanvas با backdrop.

**Phoenix / SmartAdmin / Nixboard** معمولاً **layout preset** را در customizer انتخاب می‌کنند (ادمین یا power user)، نه صدها toggle پراکنده.

### 3.3 Uizard در این بحث

Uizard «Generate themes» برای **پروژهٔ طراحی** است، نه پنل تنظیمات runtime ادمین. برای AppEndO فقط به‌عنوان **الگوی UX Theme Designer** (تغییر سریع palette روی preview) مفید است — نه به‌عنوان فهرست feature.

---

## 4. ماتریس پیشنهادی: ادمین vs کاربر vs هر دو

**تعاریف:**

- **ادمین پلتفرم / پورتال:** تنظیم سیاست و پیش‌فرض برای mount/portal/shell (Shell Designer، platform registry، یا Settings آینده).
- **کاربر نهایی:** authenticated؛ ترجیح workspace که روی دستگاه/نشست او اعمال می‌شود.
- **هر دو:** ادمین **سقف و پیش‌فرض**؛ کاربر **override** اگر `userPreferences` و policy اجازه دهد.

| ID | گزینه | ادمین | کاربر | هر دو | توضیح / سیاست AppEndO |
|----|--------|-------|-------|-------|------------------------|
| **S1** | پیش‌فرض سایدبار (expanded vs collapsed) | پیش‌فرض | override | **✓** | امروز همیشه expanded؛ باید admin default + user state |
| **S2** | حالت minimize: `rail` \| `hidden` \| `unfoldable` | سیاست + پیش‌فرض | اگر policy=`user-choice` | **✓** | rail = رفتار فعلی؛ hidden = عرض 0 desktop؛ unfoldable = فاز بعد |
| **S3** | اجازهٔ تغییر topology (sidebar/top/hybrid) | ✓ | — | — | Shell Designer؛ کاربر عادی نباید topology عوض کند |
| **S4** | Nav group default (collapsed / expanded-active) | پیش‌فرض recipe | override accordion | **✓** | recipe `groupDefault` + localStorage groups |
| **S5** | موبایل: drawer vs popover | ✓ | — | — | `responsive.mobileNavigation` |
| **T1** | Accent رنگ (Tier-1) | می‌تواند «locked brand» کند | ✓ (اگر unlocked) | **✓** | امروز کاربر آزاد؛ tenant ممکن است lock کند |
| **T2** | Theme Designer swatches | catalog عمومی | ✓ edit/save | **✓** | طبق `ui-design-system.md` per user |
| **T3** | Light / Dark / Auto | پیش‌فرض portal | override | **✓** | schema `colorScheme` هست؛ Studio عمدتاً light |
| **T4** | Presetهای رنگی (Mantis-style) | publish | pick | **✓** | همان theme_presets / catalog |
| **T5** | Chrome frost / texture / atmosphere | پیش‌فرض در catalog | Theme Designer | **✓** | tokens موجود |
| **L1** | layoutWidth fluid/bounded | ✓ | toggle if allowed | **✓** | **الگوی مرجع** برای سایر گزینه‌ها |
| **L2** | boundedMaxWidth, boundedEdge | ✓ | — | — | طراحی پورتال |
| **D1** | chromeDensity / contentDensity | پیش‌فرض | override | **✓** | فاز 2؛ CSS vars یا data attributes |
| **M1** | motionLevel | سقف | override ≤ سقف | **✓** | `none` برای accessibility policy |
| **G1** | ابعاد rail/expanded (253/81) | — | — | — | **geometry lock** — فقط با تأیید صریح اپراتور |
| **G2** | logo band heights | ✓ designer | — | — | lock |
| **P1** | fullscreen | — | ✓ session | — | موجود |
| **P2** | expanded nav groups | — | ✓ | — | localStorage |
| **P3** | reduced motion | OS | respect OS | — | already boot splash |

### 4.1 گزینه‌های عمداً **ادمین-only** (کاربر نهایی نباید دست ببرد)

- Navigation topology و componentId (`TreeNavTwoLevel` vs mega)
- عرض‌های locked rail/expanded، logo metrics، header h-59
- `experienceMode` app vs site و `authentication`
- Effects سنگین (parallax layers) روی portal عمومی
- Lock کردن accent برای brand compliance

### 4.2 گزینه‌های **کاربر-only** (بدون نیاز به policy پیچیده)

- state موقت: fullscreen، mobile menu open
- accordion groups (مگر admin «همه بسته» را force کند)

---

## 5. پیشنهاد قرارداد داده (قبل از UI)

### 5.1 دو لایه جدا بمانند

1. **`ThemePresetTokens`** — CSS variables (Theme Designer) · کلید `theme_presets`
2. **`ShellExperiencePreferences`** — رفتار و حالت UI

```typescript
// پیشنهاد conceptual — نه قرارداد نهایی
type SidebarCollapsePolicy = 'rail' | 'hidden' | 'unfoldable';
type SidebarDefaultState = 'expanded' | 'collapsed';

type ShellExperiencePreferences = {
  schemaVersion: '1';
  sidebar: {
    defaultState: SidebarDefaultState;       // admin default
    collapsePolicy: SidebarCollapsePolicy;   // admin policy
    userCollapsed?: boolean;                 // user override (effective)
  };
  colorScheme?: 'light' | 'dark' | 'auto'; // user override within admin default
  layoutWidth?: 'fluid' | 'bounded';         // mirrors existing
  chromeDensity?: 'compact' | 'default' | 'comfortable';
  contentDensity?: 'compact' | 'default' | 'comfortable';
  motion?: 'none' | 'subtle' | 'expressive';
};
```

### 5.2 کجا ذخیره شود

| لایه | محل | توضیح |
|------|-----|--------|
| **Portal policy** | Shell Recipe extension یا platform shell config | `defaultSidebarState`, `sidebarCollapsePolicy`, `allowUserSidebarPreference`, `colorSchemeDefault`, `layoutWidthUserControl` (موجود) |
| **User effective** | USER settings attribute جدید e.g. `shell_experience` | JWT cookie session + API؛ جایگزین تدریجی localStorage |
| **Device cache** | localStorage mirror | first paint / offline؛ sync از سرور |

**Greenfield:** یک schema version؛ بدون alias legacy برای کلیدهای قدیمی در API — migration یک‌باره localStorage → server در فاز 1b.

### 5.3 رفتار effective (pseudo)

```text
effectiveSidebarCollapsed =
  if mobile → drawer state (not rail width)
  else if user toggled → userCollapsed
  else → admin defaultState === 'collapsed'

effectiveSidebarVisual =
  if collapsePolicy === 'hidden' && collapsed → width 0 (content full)
  if collapsePolicy === 'rail' && collapsed → 81px rail (today)
  if collapsePolicy === 'unfoldable' && collapsed → 81px until hover
```

**هشدار geometry lock:** حالت `hidden` عرض **0** است، نه تغییر `--admin-shell-sidebar-width-collapsed` — با CSS transition روی host و بدون دست زدن به 81/253 مگر تأیید اپراتور.

---

## 6. UX محل کنترل‌ها

| گزینه | محل پیشنهادی | الگو |
|--------|--------------|------|
| S1, S2 (user) | `ProfileShellChromeMenu` یا Settings → Appearance | کنار page width / accent |
| S1, S2 (admin default) | Shell Designer inspector · Live Designer | مثل `layoutWidthUserControl` |
| T2 | Theme Designer (موجود) | — |
| T3 | Profile + admin default | Phoenix-style tri-state |
| D1 | Settings Appearance (فاز 2) | select compact/comfortable |

**Live customizer** سطح Nixboard برای AppEndO = **Theme Designer + Shell preview**؛ نیاز به پنل شناور جدا ندارد اگر Studio/workspace کافی است.

---

## 7. فازبندی پیشنهادی

### فاز 0 — این سند + تصمیم اپراتور

- [ ] تأیید ماتریس §4 (رد/اضافه گزینه)
- [ ] انتخاب: آیا Studio admin defaults جدا از experience portal؟

### فاز 1a — Sidebar policy (حداقل viable)

- Admin fields: `defaultSidebarState`, `sidebarCollapsePolicy` (`rail` \| `hidden`), `allowUserSidebarPreference`
- User: toggle فعلی؛ respect policy (hidden vs rail)
- پیش‌فرض admin: **expanded + rail** (رفتار فعلی)

### فاز 1b — Persistence

- `shell_experience` USER setting + hydrate localStorage
- Boot: read server after auth (مثل accent)

### فاز 2 — Appearance settings page

- colorScheme auto/dark/light (با محدودیت Tier-1)
- chromeDensity / contentDensity (token یا class maps)
- Nav `groupDefault` از recipe + user groups

### فاز 3 — پیشرفته (اختیاری)

- چگالی chrome/content، motionLevel (اگر محصول بخواهد)
- ~~Unfoldable rail~~ (رد شده)

### فاز 4 — Tenant brand lock

- Admin lock accent / disable Theme Designer categories
- Audit trail for portal policy changes

---

## 8. ریسک‌ها و قیود

1. **Geometry lock:** هر تغییر 253/81/logo/collapse toggle نیاز تأیید session دارد.
2. **Tier-1 color:** dark mode کل محصول فقط با audit token (sidebar/header همچنان neutral slate).
3. **دو مسیر render:** `AdminLayout` و `DesignerPublishedShell` باید parity بمانند.
4. **Preview mode:** designer preview نباید localStorage کاربر real را overwrite کند (`DesignerPublishedShellChrome` today uses stored collapse only outside preview).
5. **RTL:** hidden/offcanvas باید logical start/end رعایت کند.

---

## 9. تصمیمات قفل‌شده (اپراتور — 2026-09-26)

| # | موضوع | تصمیم |
|---|--------|--------|
| 1 | پیش‌فرض سایدبار (اولین ورود) | **باز (expanded)** |
| 2 | حالت minimize وقتی کاربر «جمع» می‌زند | **ادمین** per portal: `rail` \| `hidden`؛ **پیش‌فرض rail** (رفتار فعلی) |
| 3 | Unfoldable (rail + hover expand) | **خیر** — همان toggle باز/جمع فعلی |
| 4 | Light / Dark / Auto | **خیر** — شخصی‌سازی رنگ از Theme Designer / accent |
| 5 | Persistence | **سرور (USER settings) + کش local**؛ **بعد از login** لود؛ **هم‌مسیر** `accent_theme` / `theme_presets` (builtin attribute، نه مسیر موازی) |
| 6 | UI کاربر | **همه در workspace Theme Designer** (rename به **Appearance**)؛ accent و layout width از Profile به این هاب؛ toggle سریع روی سایدبار می‌ماند |
| 7 | مدل default | **ادمین در Appearance default می‌گذارد** → effective برای users بدون override؛ user همان صفحه override؛ **ادمین‑only** policy fields جدا |

**Default scope:** per **portal/mount** (Studio جدا از experience portals) — مگر بعداً platform-wide بخواهید.

---

## 10. هاب واحد «Appearance» — چه چیزهایی داخلش است

**ورود:** همان shortcut سایدبار (امروز Theme Designer) → route می‌تواند همان `theme-designer` بماند یا alias `appearance`.

| بخش workspace | محتوا | ذخیره |
|---------------|--------|--------|
| **Colors & tokens** (موجود) | swatchها، `themeTokenCatalog` (brand، surfaces، frost، texture، nav chrome، …) | `theme_presets` |
| **Accent** (منتقل از Profile) | `AccentColorPicker` | `accent_theme` |
| **Shell behavior** (جدید) | ترجیح «بعد از login سایدبار باز/جمع»؛ نمایش policy پورتال (rail/hidden) read-only | attribute جدید e.g. `shell_experience` (JSON) |
| **Page width** (منتقل از Profile) | fluid/bounded اگر `layoutWidthUserControl` | همان context + بخشی از `shell_experience` یا attribute موجود |

**خارج از هاب (عمداً):** fullscreen (نشست موقت)؛ toggle لحظه‌ای سایدبار روی chrome؛ policy ادمین → **Shell Designer** نه این صفحه.

---

## 11. فهرست دقیق آپشن‌ها — موجود / اضافه / حذف‌شده

### 11.1 الان در محصول (Theme Designer + accent)

از `themeTokenCatalog.ts`: Brand، Surfaces (geometry، sidebar/header fill %، menu/header texture %، shell bg، …)، Borders، Atmosphere RGB، Logo gradient، Navigation chrome، Focus & elevation، Interaction gradients.

### 11.2 فاز 1 — **اضافه می‌شود**

**کاربر (Appearance workspace + USER attribute، load post-login):**

| آپشن | توضیح |
|------|--------|
| `sidebarPreferredCollapsed` | ترجیح بعد از login: باز یا جمع (effective با toggle لحظه‌ای) |
| `layoutWidthPreference` | اگر policy اجازه دهد: fluid vs bounded (انتقال از Profile) |
| (اختیاری فاز 1) `navExpandedGroups` | مهاجرت از localStorage به همان JSON |

**ادمین (Shell Designer / portal shell config):**

| آپشن | توضیح |
|------|--------|
| `defaultSidebarState` | expanded \| collapsed برای کسانی که ترجیح شخصی ندارند |
| `sidebarCollapsePolicy` | `rail` \| `hidden` |
| `allowUserSidebarPreference` | آیا فیلد Appearance editable است |
| `layoutWidth` + `layoutWidthUserControl` | موجود — parity |

**Runtime:**

| رفتار | توضیح |
|--------|--------|
| Policy `hidden` + collapsed | عرض 0 روی host (بدون تغییر 81/253 lock) |
| Boot | کش local برای flash؛ پس از auth reconcile با سرور |

### 11.3 **عمداً اضافه نمی‌شود** (تصمیم یا out of scope فاز 1)

- Unfoldable rail، dark/light/auto shell، تغییر topology ناوبری، تغییر عرض rail/expanded، live floating customizer (Nixboard-style panel)، Uizard-style AI theme gen (جدای Theme Designer).

### 11.4 بازار — چه دیدیم vs چه می‌گیریم

| منبع | چه بررسی شد | چه برمی‌داریم |
|------|--------------|----------------|
| **CoreUI** | مستندات sidebar: narrow، unfoldable، offcanvas | **rail** + **hidden**؛ offcanvas = موبایل موجود |
| **Phoenix / ThemeWagon** | bullet lists: layouts، sidenav collapse، dark/auto | collapse policy؛ **نه** dark (اپراتور) |
| **Wrapmarket** (Nixboard، SmartAdmin، …) | feature bullets customizer، RTL، dashboards | **یک workspace** به‌جای panel شناور؛ RTL از culture |
| **CodedThemes** | free kits: presets، sidebar mini | presets = `theme_presets`؛ mini = rail |
| **Uizard** | landing/marketing | **مرتبط نیست** به runtime admin |

**صداقت روش:** هر قالب به‌صورت live demo نصب نشد؛ الگو از **مستندات CoreUI** + **feature lists بازار** + **Shell Recipe داخلی** استخراج شد. برای parity با Phoenix customizer، معادل AppEndO = **Appearance workspace با preview زنده** (همان Theme Designer today).

---

## 12. جمع‌بندی

- **شکاف:** رفتار سایدبار + persistence سرور + **یک هاب Appearance**.
- **فاز 1:** §11.2؛ attribute `shell_experience` هم‌سبک builtin USER settings؛ bridge بعد از login مثل accent.
- geometry lock دست نخورده.

---

## پیوست A — نگاشت Shell Recipe → گزینهٔ محصول

| `shellRecipeV1` path | گزینهٔ کاربر/ادمین |
|----------------------|---------------------|
| `capabilities.userPreferences` | master switch user overrides |
| `visual.layoutWidth` + `layoutWidthUserControl` | L1 ✓ |
| `visual.colorScheme` | T3 |
| `visual.chromeDensity` / `contentDensity` | D1 |
| `visual.motionLevel` | M1 |
| `visual.accentControl` | T1 exposure (`header` vs hidden) |
| `regions.sidebar.layout` | `fixed` vs `icon-rail` vs `overlay` → S2/S3 |
| `responsive.overrides.sidebar.collapse` | `rail` \| `drawer` \| … |
| `navigation.presentation.*` | mostly admin |

## پیوست B — مراجع سریع Wrapmarket / CodedThemes (feature bullets)

- **Nixboard:** live customizer، 5 theme systems، RTL، 106 pages SaaS ops
- **DiBold / Adminex:** React 19 + TW4، dark/light، RTL، multi-dashboard
- **SmartAdmin:** 150+ layout combinations، seed projects
- **CodedThemes free kits:** light/dark presets، sidebar mini/fixed، MIT free tier

---

*§9 قفل شد. گام بعد: plan پیاده‌سازی فاز 1 + rename UX + builtin seed `shell_experience`.*
