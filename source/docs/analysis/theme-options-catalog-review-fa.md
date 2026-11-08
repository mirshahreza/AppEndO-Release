# فهرست آپشن‌های Appearance / Shell — برای بررسی مشترک

**هدف:** یک جدول واحد از «آنچه بازار دارد» → «AppEndO امروز» → «پیشنهاد پیاده‌سازی».

## مدل حاکمیت (قفل — 2026-09-26)

1. **پیش‌فرض پورتال/mount** — ادمین در **Appearance** (همان UI مشترک) مقادیر را تنظیم می‌کند → **default** برای همهٔ کاربران تا override.
2. **Override شخصی** — هر کاربر همان صفحه را باز می‌کند و برای **خودش** ذخیره می‌کند (`USER` settings، لود بعد از login).
3. **ادمین‑only** — فیلدهای policy (rail/hidden، allow override، …)؛ کاربر عادی نمی‌بیند.
4. **Reset کاربر** — برگشت به **default ادمین** (نه لزوماً catalog عمومی)، مگر Reset swatch رنگ که catalog workspace بماند.
5. **ادمین default عوض کرد** — کاربر بدون override → فوری default جدید؛ با override → تا Reset/تغییر دستی.

**ذخیره (پیشنهاد فنی):** default پورتال در config shell/platform؛ override در `shell_experience` + `theme_presets` / `accent_theme` per user.  
**منابع مستند (خوانده‌شده):**

- [Phoenix v1.23 configuration](https://prium.github.io/phoenix/v1.23.0/documentation/customization/configuration.html) — ۸ کلید `initialConfig`
- [Mantis theme-config / project-config](https://codedthemes.gitbook.io/mantis/theme-config) — `miniDrawer`, `container`, `menuOrientation`, `presetColor`, `mode`, `themeDirection`
- [Shadcn Dashboard theme-settings](https://shadcndashboard.dev/docs/admin-template/theme-settings) — `isCollapse`, `isLayout`, `isSidebarHover`, `activeLayout`, …
- [Apex Dashboard theming](https://apex-dashboard.pages.dev/docs/theming) — presets, density, layout shells, container, RTL
- [CoreUI Sidebar](https://coreui.io/bootstrap/docs/components/sidebar/) — narrow, unfoldable, offcanvas
- [Steex feature list](https://perfectwpthemes.com/steex-admin-and-dashboard-template/) — layout/sidebar variants (bullet)
- **AppEndO:** `themeTokenCatalog.ts`, `shellRecipeV1`, `adminLayoutPreferences.ts`, `ProfileShellChromeMenu`

**راهنمای ستون «پیشنهاد»:**

| برچسب | معنی |
|--------|------|
| **موجود** | الان کار می‌کند؛ شاید فقط جابه‌جایی UI به Appearance |
| **فاز۱** | پیاده‌سازی جدید در scope توافق‌شده |
| **فاز۲** | بعداً؛ نیاز تصمیم جدا |
| **ادمین‌فقط** | Shell Designer / platform؛ نه Appearance کاربر |
| **رد** | عمداً نمی‌آید (دلیل در ستون یادداشت) |

---

## A — رنگ و برند

| # | آپشن (بازار) | بازار | AppEndO امروز | پیشنهاد | یادداشت |
|---|----------------|-------|---------------|---------|---------|
| A1 | **Primary / accent color** | همه | `AccentColorPicker` + `accent_theme` | **موجود** → انتقال به Appearance | Tier-1 طبق design system |
| A2 | **Color presets / swatches** | Apex 6 palette، Mantis `presetColor` | Theme Designer swatches + `theme_presets` | **موجود** | ~40 توکن CSS در editor |
| A3 | **Light / Dark / Auto** | Phoenix `phoenixTheme`، Mantis `mode` | schema هست؛ runtime Studio عمدتاً light | **رد** | تصمیم اپراتور: رنگ از Theme Designer کافی است |
| A4 | **Nav/header darker variant** | Phoenix vertical/top style `darker` | frost % + shell bg tokens | **موجود** | `--app-sidebar-fill-opacity`, header fill, … |
| A5 | **Sidebar «colored» vs neutral** | Steex | accent فقط روی active nav؛ fill slate | **موجود** | سیاست Tier-1؛ نه sidebar fill رنگی |

---

## B — چیدمان کل و ناوبری

| # | آپشن | بازار | AppEndO | پیشنهاد | یادداشت |
|---|------|-------|---------|---------|---------|
| B1 | **Navigation topology** (vertical / horizontal / combo / dual) | Phoenix `phoenixNavbarPosition`، Mantis `menuOrientation` | `shellRecipe.navigation.topology` | **ادمین‌فقط** | Shell Designer؛ نه Appearance |
| B2 | **Top navbar slim** | Phoenix `phoenixNavbarTopShape` | header height lock | **رد** یا **فاز۲** | `ui.admin-shell.geometry-lock` |
| B3 | **Mega / tree nav mode** | SmartAdmin | `TreeNavTwoLevel`, mega in recipe | **ادمین‌فقط** | designer |
| B4 | **Mobile nav: drawer / popover** | CoreUI offcanvas | `useMobileShellDrawer`, tier | **موجود** | جدا از desktop policy |
| B5 | **Support chat widget toggle** | Phoenix | AppEndO FAB/agent جدا | **رد** | محصول خودمان |

---

## C — سایدبار (رفتار — محور درخواست شما)

| # | آپشن | بازار | AppEndO | پیشنهاد | یادداشت |
|---|------|-------|---------|---------|---------|
| C1 | **Default expanded vs collapsed on load** | Phoenix `phoenixIsNavbarVerticalCollapsed`، Shadcn `isCollapse`، Mantis `miniDrawer` | همیشه expanded مگر localStorage | **فاز۱** user + **ادمین** portal default | تصمیم: default **expanded** |
| C2 | **Mini rail (icon strip)** | Shadcn mini width، CoreUI `narrow`، Apex Mini | collapsed = **81px rail** | **موجود** | geometry lock |
| C3 | **Fully hidden sidebar when collapsed** | Apex «hide rail» variants، Steex detached | **ندارد** | **فاز۱** policy `hidden` | عرض 0؛ نه تغییر 81px |
| C4 | **Hover to expand rail (unfoldable)** | CoreUI `unfoldable`، Shadcn `isSidebarHover`، Steex «Icon Hovered» | **ندارد** | **رد** | تصمیم اپراتور |
| C5 | **Fixed vs scrollable sidebar** | Steex | nav scroll در shell | **فاز۲** | کم‌اولویت |
| C6 | **Floating / inset sidebar panel** | Apex Floating layout | recipe `regions.sidebar.layout: floating` | **ادمین‌فقط** | designer |
| C7 | **User may change sidebar preference** | implicit in templates | همیشه | **فاز۱** flag `allowUserSidebarPreference` | admin |
| C8 | **Toggle on chrome (instant)** | همه | دکمه collapse | **موجود** | جدا از «ترجیح بعد از login» |
| C9 | **Nav groups expanded/collapsed** | Phoenix accordion | localStorage groups | **فاز۱ اختیاری** | migrate به `shell_experience` |

---

## D — عرض محتوا و چگالی

| # | آپشن | بازار | AppEndO | پیشنهاد | یادداشت |
|---|------|-------|---------|---------|---------|
| D1 | **Fluid vs boxed/bounded** | Mantis `container`، Shadcn `isLayout`، Apex Container | `layoutWidth` + user toggle | **موجود** → **Appearance** | Profile → یکپارچه |
| D2 | **Admin allows user page-width toggle** | — | `layoutWidthUserControl` | **ادمین‌فقط** | Shell Designer |
| D3 | **Bounded max width (sm/md/lg)** | — | recipe | **ادمین‌فقط** | |
| D4 | **Density compact / default / comfortable** | Apex، Zenith، recipe `chromeDensity`/`contentDensity` | schema only | **فاز۲** | نیاز CSS global |
| D5 | **Content host card vs plain** | Steex | recipe `content.hostStyle` | **ادمین‌فقط** | designer |

---

## E — شکل، سایه، تایپوگرافی

| # | آپشن | بازار | AppEndO | پیشنهاد | یادداشت |
|---|------|-------|---------|---------|---------|
| E1 | **Border radius global** | Shadcn `isBorderRadius` | `--app-radius-*` + recipe `shapeDepth.radius` | **موجود** tokens + **ادمین** recipe | کاربر global radius فاز۲ |
| E2 | **Card shadow on/off** | Shadcn `isCardShadow` | `surfaceClasses` tokens | **فاز۲** | |
| E3 | **Font family picker** | Mantis `fontFamily` | typography ramp locked | **رد** | `typographyRoles.ts` |
| E4 | **Geometric atmosphere** | — | `--app-atmosphere-geometry` | **موجود** | Theme Designer |
| E5 | **Menu/header line texture** | — | texture opacity % | **موجود** | Theme Designer |

---

## F — جهت و زبان

| # | آپشن | بازار | AppEndO | پیشنهاد | یادداشت |
|---|------|-------|---------|---------|---------|
| F1 | **RTL / LTR toggle in customizer** | Phoenix `phoenixIsRTL`، Apex Direction | **Culture** | **رد** در Appearance | RTL از culture؛ duplicate خطرناک |
| F2 | **Locale / i18n** | Mantis `i18n` | CultureContext | **رد** | Settings culture |

---

## G — Motion و افکت

| # | آپشن | بازار | AppEndO | پیشنهاد | یادداشت |
|---|------|-------|---------|---------|---------|
| G1 | **Motion level** | recipe `motionLevel` | schema | **فاز۲** user cap | |
| G2 | **Reduced motion** | Apex implicit | boot splash | **موجود** | `prefers-reduced-motion` |
| G3 | **Parallax / creative effects** | recipe `effects.layers` | designer | **ادمین‌فقط** | landing |

---

## H — ابزارهای customizer

| # | آپشن | بازار | AppEndO | پیشنهاد | یادداشت |
|---|------|-------|---------|---------|---------|
| H1 | **Live preview workspace** | Nixboard drawer | Theme Designer live preview | **موجود** | rename **Appearance** |
| H2 | **Reset to defaults** | Apex Reset | Reset swatch to catalog | **موجود** | |
| H3 | **Floating palette drawer** | Nixboard | full page workspace | **رد** | هاب واحد Appearance |

---

# خلاصه — فقط «پیاده‌سازی جدید» فاز ۱ (پیشنهاد فنی)

| ID | آپشن جدید | UI | ذخیره |
|----|-----------|-----|--------|
| **C1** | ترجیح کاربر: بعد از login سایدبار **باز** یا **جمع** | Appearance › Shell | USER `shell_experience` |
| **C3** | وقتی جمع است: **rail** یا **fully hidden** | ادمین Shell Designer؛ کاربر فقط می‌بیند | portal shell config |
| **C1b** | پیش‌فرض پورتال expanded/collapsed | Shell Designer | shell recipe extension |
| **C7** | اجازهٔ ویرایش ترجیح کاربر | Shell Designer | recipe |
| **D1b** | ترجیح fluid/bounded (انتقال از Profile) | Appearance | `shell_experience` یا merge با layout context |
| **—** | لود بعد از login + کش local | bridge | مثل `accent_theme` |
| **—** | Rename + یکپارچه accent/tokens | Appearance workspace | — |
| **C9?** | گروه‌های nav روی سرور | Appearance یا auto-sync | optional |

**تعداد توکن/rنگ در Theme Designer (بدون کد جدید):** 8 دسته، **~35 کنترل** — لیست کامل در `themeTokenCatalog.ts`.

---

# تصمیمات نهایی بررسی بخش‌به‌بخش (اپراتور: «هرطور بهتر — تا آخر»)

| بخش | نتیجه |
|-----|--------|
| **C سایدبار** | **فاز۱ OK** — C9 گروه‌های nav → **فاز 1b** همراه `shell_experience` (هم‌مسیر login sync) |
| **A رنگ** | **موجود** + Appearance؛ **رد** dark/light/auto |
| **B topology** | **ادمین‌فقط** Shell Designer؛ Appearance دخالت ندارد |
| **D عرض/چگالی** | **D1** انتقال به Appearance + default/override؛ **D4 چگالی** → **فاز۲** |
| **E شکل/فونت** | tokens/recipe **موجود**؛ font picker **رد**؛ radius/shadow user global → **فاز۲** |
| **F RTL** | **رد** در Appearance (culture) |
| **G motion** | **فاز۲**؛ reduced-motion **موجود** |
| **H UX** | Appearance workspace + rename؛ **رد** floating drawer |

---

# برنامهٔ پیاده‌سازی (ترتیب پیشنهادی)

## فاز 1a — رفتار + policy + UI

1. قرارداد `PortalAppearanceDefaults` + `UserAppearanceOverrides` (یا یک JSON `shell_experience` + portal store).
2. Admin-only controls در Appearance (tab/section «Portal defaults»): C3 policy، C7 allow override.
3. Shared controls: C1، D1، accent، swatches (انتقال از Profile).
4. Runtime: rail vs hidden؛ effective = merge(default, override).
5. Rename nav/shortcut: **Appearance** (`theme-designer` route can stay).

## فاز 1b — persistence

1. Builtin USER attribute `shell_experience` (seed مثل `accent_theme`).
2. Portal/mount defaults در platform shell config یا shell recipe extension.
3. Bridge بعد از login؛ local cache برای first paint.
4. C9 `navExpandedGroups` migrate از localStorage.

## فاز 2 (backlog)

- D4 chrome/content density
- G1 motion cap
- E2 card shadow / E1 global radius user toggle
- Admin brand lock accent
