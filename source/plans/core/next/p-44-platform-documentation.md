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

<p><strong>خلاصه برای operatore:</strong> این سند جزو <strong>plans</strong> است (p-44-platform-documentation). ستون وضعیت در <a href="./p-00-next-index.md">index مربوطه</a> مرجع «شروع شده / design / تمام» است.</p>
<p><strong>راهنمای خواندن:</strong> بخش‌های انگلیسی برای agent/dev هستند؛ جداول وضعیت و یادداشت‌های فارسی را اول بخوانید.</p>


# p-44 — Platform Documentation (User · HowTo · Developer · README · Competitive)

> **فاز:** DOC · **موکول** (next)  
> **اولویت:** — — **آخر ریلیز** · [p-23](p-23-enterprise-saml.md) ترجیحی · Culture ✅ · Package Studio ✅  
> **وضعیت:** ⬜ — **فقط تولید سند** · کنترل: [p-00-next-index.md](p-00-next-index.md) (موکول)  
> **شماره آرشیو:** p-31  
> **وابستگی:** Culture terminology ✅ · Package Studio HowTo ✅ · وضعیت محصول (`document.md` · `src/ARCHITECTURE.md` · `AGENTS.md`)

---

## خلاصه اجرایی

AppEndO امروز دانش محصول را در چند سند پراکنده نگه می‌دارد (`document.md`، `DEVELOPER_GUIDE_FA.md`، auditها، `docs/architecture/`، README قدیمی AI Studio). این فاز **فقط تولید و سازماندهی مستندات** است — **نه** پیاده‌سازی فیچر، **نه** docs site استاتیک، **نه** i18n در محصول.

**چرا آخر موج ۶:** مستندات روی محصول **تثبیت‌شده** نوشته می‌شوند — بعد از marketplace · updates · mobile. SAML ([p-23](p-23-enterprise-saml.md)) موکول است. HowToهای Package Studio (p-29 ✅) و feature list نهایی.

**خروجی:** مجموعه‌ای از markdownهای canonical در `docs/` که برای کاربر نهایی، توسعه‌دهنده، و تصمیم‌گیر enterprise قابل استفاده باشد.

```
README (ورود) → docs/product/ (مفاهیم) → docs/how-to/ (HowToها) → docs/developer/ (توسعه) → docs/compare/ (موقعیت‌یابی)
```

---

## اهداف (Goals)

<table dir="rtl">
<thead><tr><th>#</th><th>هدف</th><th>معیار موفقیت</th></tr></thead>
<tbody><tr><td>G1</td><td><strong>README محصولی</strong></td><td>README ریشه مخزن = معرفی AppEndO، feature list، quick start، لینک به docs</td></tr>
<tr><td>G2</td><td><strong>مستند کاربر (User Guide)</strong></td><td>admin/operator بدون خواندن کد، flowهای اصلی را انجام دهد</td></tr>
<tr><td>G3</td><td><strong>HowToها (task-per-file)</strong></td><td><strong>هر</strong> کار قابل انجام در UI = یک فایل «چطور … انجام دهیم» — پوشش کامل</td></tr>
<tr><td>G4</td><td><strong>مستند توسعه‌دهنده (Developer Guide)</strong></td><td>onboarding تازه‌وارد ≤ ۱ روز تا اولین Server Function / CRUD</td></tr>
<tr><td>G5</td><td><strong>سند مقایسه‌ای رقبا</strong></td><td>ماتریس شفاف AppEndO vs WordPress · Oracle APEX · Odoo · …</td></tr>
<tr><td>G6</td><td><strong>یکپارچه‌سازی پراکندگی</strong></td><td>هر موضوع یک canonical path؛ سندهای قدیمی → «منسوخ / ارجاع»</td></tr>
<tr><td>G7</td><td><strong>آمادگی enterprise</strong></td><td>بخش positioning + security/compliance summary برای خریدار</td></tr>
</tbody></table>

---

## محدوده

### Scope IN (فقط سند)

<table dir="rtl">
<thead><tr><th>کار</th><th>شرح</th></tr></thead>
<tbody><tr><td><strong>README.md</strong></td><td>جایگزینی محتوای AI Studio با README محصول AppEndO</td></tr>
<tr><td><strong>User docs</strong></td><td>راهنمای مفهومی admin: auth، CRUD، settings، plugins، designer، git، AI، jobs</td></tr>
<tr><td><strong>HowToها</strong></td><td><code dir="ltr" style="unicode-bidi: embed;">docs/how-to/</code> — <strong>یک فایل مجزا per actionable task</strong> · عنوان «چطور … انجام دهیم»</td></tr>
<tr><td><strong>Developer docs</strong></td><td>معماری، setup، conventions، Server Functions، Auto-CRUD، plugins، MCP، testing</td></tr>
<tr><td><strong>Competitive analysis</strong></td><td>مقایسه چندمحصولی + positioning AppEndO</td></tr>
<tr><td><strong>Doc map / index</strong></td><td><code dir="ltr" style="unicode-bidi: embed;">docs/README.md</code> — فهرست و مسیر یادگیری per persona</td></tr>
<tr><td><strong>Glossary</strong></td><td>واژه‌نامه اصطلاحات (Server Function، control plane، slot، <strong>Culture</strong>، …)</td></tr>
<tr><td><strong>FAQ</strong></td><td>سوالات تکراری admin و developer</td></tr>
<tr><td><strong>Changelog template</strong></td><td>قالب <code dir="ltr" style="unicode-bidi: embed;">CHANGELOG.md</code> برای release notes آینده</td></tr>
</tbody></table>

### Scope OUT

<table dir="rtl">
<thead><tr><th>خارج از scope</th><th>دلیل</th></tr></thead>
<tbody><tr><td>پیاده‌سازی کد / UI help panel</td><td>فاز جدا</td></tr>
<tr><td>Docusaurus / VitePress / docs site</td><td>بعد از stabilize محتوا</td></tr>
<tr><td>ترجمه کامل EN↔FA در UI</td><td>مدل Culture موجود؛ اجرای bundle در فاز C3 — packaging docs فقط ساختار دوزبانه markdown where useful</td></tr>
<tr><td>ویدیو / اسکرین‌کست</td><td>اختیاری بعداً</td></tr>
<tr><td>OpenAPI regeneration</td><td>از قبل موجود — فقط لینک در dev docs</td></tr>
</tbody></table>

---

## ساختار پیشنهادی خروجی (`docs/`)

```
docs/
├── README.md                          # نقشه مستندات + persona paths
├── product/
│   ├── overview.md                    # AppEndO چیست — brief محصول
│   ├── feature-list.md                # لیست فیچرها با وضعیت (shipped / planned)
│   ├── getting-started-admin.md       # اولین login · navigation · roles
│   ├── users-and-roles.md
│   ├── data-sources.md
│   ├── server-functions-user.md         # مصرف API از دید admin (نه کد)
│   ├── plugins-user.md
│   ├── package-studio-user.md         # Package Studio · artifact kinds · p-29
│   ├── component-designer-user.md
│   ├── git-workspace-user.md
│   ├── ai-assistant-user.md
│   ├── jobs-and-scheduler-user.md
│   ├── settings-and-security-user.md
│   └── faq-user.md
├── how-to/                            # HowToها — یک فایل = یک کار UI
│   ├── README.md                      # فهرست الفبایی + دسته‌بندی + نگاشت به صفحات
│   ├── _template.md                   # قالب استاندارد هر HowTo
│   ├── auth/
│   ├── users/
│   ├── roles/
│   ├── base-info/
│   ├── data-sources/
│   ├── server-functions/
│   ├── auto-crud/
│   ├── component-designer/
│   ├── themes/
│   ├── plugins/
│   ├── git/
│   ├── platform-portals/
│   ├── platform-navigations/
│   ├── scheduled-tasks/
│   ├── jobs/
│   ├── cache/
│   ├── logs/
│   ├── chat-history/
│   ├── my-apis/
│   ├── settings/
│   ├── ai-assistant/
│   └── dashboard/
├── developer/
│   ├── getting-started.md             # clone · setup · test:critical
│   ├── architecture-overview.md       # خلاصه از src/ARCHITECTURE.md
│   ├── project-structure.md
│   ├── coding-standards.md            # pointer به AGENTS.md + vibe-coding
│   ├── server-functions-dev.md
│   ├── auto-crud-dev.md
│   ├── plugins-dev.md                 # merge با plugin-contract + builder guide
│   ├── component-designer-dev.md
│   ├── ai-and-mcp-dev.md
│   ├── database-and-multi-db.md
│   ├── auth-and-rbac-dev.md
│   ├── testing.md
│   ├── deployment.md
│   └── faq-dev.md
├── compare/
│   ├── competitive-landscape.md       # سند اصلی مقایسه
│   ├── decision-matrix.md             # جدول انتخاب برای CTO/PM
│   └── positioning-one-pager.md       # یک صفحه «چرا AppEndO»
└── governance/
    ├── doc-maintenance.md             # چه وقت README/docs به‌روز شود
    └── deprecated-docs-index.md       # map سند قدیمی → جایگزین
```

**README ریشه** (`README.md`): hero کوتاه + badges اختیاری + «Run locally» + لینک به `docs/product/overview.md` و `docs/developer/getting-started.md`.

---

## README — محتوای الزامی

### بخش ۱ — معرفی محصول (Product Brief)

- **یک پاراگراف:** AppEndO = پلتفرم admin enterprise با Server Functions، multi-DB، plugins، Component Designer، AI/MCP — self-hosted، PostgreSQL control plane.
- **مخاطب:** تیم dev/ops سازمانی، نه سایت‌ساز عمومی.
- **تفاوت کلیدی:** code-first extensibility + visual designer + unified admin shell (نه CMS محتوا).

### بخش ۲ — Feature List (جدول)

<table dir="rtl">
<thead><tr><th>حوزه</th><th>قابلیت</th><th>وضعیت</th></tr></thead>
<tbody><tr><td>Identity</td><td>Users · Roles · RBAC · JWT</td><td>✅ shipped</td></tr>
<tr><td>Data</td><td>Multi-DB data sources · Auto-CRUD wizard</td><td>✅ / 🟡</td></tr>
<tr><td>Extensibility</td><td>Server Functions · Plugins · Component Designer</td><td>✅</td></tr>
<tr><td>DevOps</td><td>Git workspace · Jobs · Cache · Logs</td><td>✅ / 🟡</td></tr>
<tr><td>AI</td><td>Chat · Agent · MCP packs</td><td>✅</td></tr>
<tr><td>Platform</td><td>Settings · Themes · Platform Experiences · Package Studio</td><td>✅ / 🟡 p-29</td></tr>
<tr><td>Roadmap</td><td>Marketplace · Install wizard · Multi-node · Culture Engine C1+</td><td>⬜ plans-next / موج ۳</td></tr>
</tbody></table>

(لیست نهایی از `document.md` + `plans-done` + `plans-todo` استخراج شود.)

### بخش ۳ — Quick Start

- `npm install` · `npm run setup` · `npm run dev` (از README فعلی، بدون AI Studio banner)
- لینک health/ready · admin seed · `test:auth-e2e`

### بخش ۴ — Documentation Map

لینک به `docs/README.md` با مسیرهای persona · **فهرست HowToها:** `docs/how-to/README.md`

### بخش ۵ — Standards & Contributing (خلاصه)

- `AGENTS.md` · `/api/project-standards` · `docs/standards/INDEX.md`

---

## User Documentation — outline

**Persona:** Admin سازمانی، Operator، Power user بدون دسترسی repo.

<table dir="rtl">
<thead><tr><th>سند</th><th>محتوا</th></tr></thead>
<tbody><tr><td>overview</td><td>value prop · مفاهیم (control plane vs app data)</td></tr>
<tr><td>getting-started-admin</td><td>login · sidebar · AI panel · profile</td></tr>
<tr><td>users-and-roles</td><td>CRUD users · roles · lockout · audit columns</td></tr>
<tr><td>data-sources</td><td>افزودن PG/MySQL/… · تست اتصال</td></tr>
<tr><td>server-functions-user</td><td>لیست functions · settings access · Swagger <code dir="ltr" style="unicode-bidi: embed;">/api/docs</code></td></tr>
<tr><td>plugins-user</td><td>نصب ZIP · فعال/غیرفعال · slots</td></tr>
<tr><td>package-studio-user</td><td>extension vs vertical-app vs theme · export · conflict preview · p-29</td></tr>
<tr><td>component-designer-user</td><td>layout · publish · preview</td></tr>
<tr><td>git-workspace-user</td><td>connect · status · commit (بعد از p-19 به‌روز)</td></tr>
<tr><td>ai-assistant-user</td><td>Plan/Ask/Agent · capabilities · confirm gate</td></tr>
<tr><td>jobs-and-scheduler</td><td>cron · missed run · logs</td></tr>
<tr><td>settings-and-security</td><td>auth flags · cache · logging levels</td></tr>
<tr><td>faq-user</td><td>«چرا Server Function؟» · «تفاوت plugin و theme» · …</td></tr>
</tbody></table>

**اصول نگارش user doc:**
- imperative steps · screenshots اختیاری (placeholder `[screenshot: …]`)
- بدون jargon بدون تعریف در glossary
- ارجاع به RBAC: «اگر دسترسی ندارید با admin تماس بگیرید»

**تفکیک product vs HowTo:**
- `docs/product/` = مفاهیم، overview، «این بخش چیست و چرا»
- `docs/how-to/` = **فقط procedure** — گام‌های کلیک‌به‌کلیک برای یک کار مشخص؛ بدون تکرار theory

---

## HowToها — فولدر `docs/how-to/`

### هدف

مجموعه‌ای **کامل و granular** از راهنماهای عملیاتی: هر کاری که کاربر (یا admin) در AppEndO می‌تواند انجام دهد → **دقیقاً یک فایل markdown** با عنوان:

> **چطور [کار] انجام دهیم**

مثال نام فایل: `how-to-create-a-user.md` · عنوان سند: «چطور کاربر جدید ایجاد کنیم»

### قوانین نگارش (الزامی)

<table dir="rtl">
<thead><tr><th>قانون</th><th>شرح</th></tr></thead>
<tbody><tr><td><strong>یک کار = یک فایل</strong></td><td>Create و Edit جدا · Delete جدا · هر modal/action جدا</td></tr>
<tr><td><strong>عنوان FA</strong></td><td>«چطور …» در H1 · slug EN در نام فایل</td></tr>
<tr><td><strong>قالب واحد</strong></td><td>از <code dir="ltr" style="unicode-bidi: embed;">_template.md</code> — Prerequisites · Steps · Result · Troubleshooting · Related</td></tr>
<tr><td><strong>شماره‌گذاری Steps</strong></td><td>۱، ۲، ۳ — هر step = یک UI action (کلیک، پر کردن فیلد، Confirm)</td></tr>
<tr><td><strong>نقش / دسترسی</strong></td><td>ابتدای سند: ADMIN · USER · نقش خاص · desktop-only (Tier D)</td></tr>
<tr><td><strong>مسیر UI</strong></td><td><code dir="ltr" style="unicode-bidi: embed;">Settings → Auth &amp; Security → …</code> یا <code dir="ltr" style="unicode-bidi: embed;">Sidebar → Users → Create</code></td></tr>
<tr><td><strong>Placeholder screenshot</strong></td><td><code dir="ltr" style="unicode-bidi: embed;">[screenshot: users-create-modal-step-2]</code> — اختیاری ولی جای‌گذاری شود</td></tr>
<tr><td><strong>Cross-link</strong></td><td>پایان هر HowTo: «مرتبط» → product doc + HowToهای مجاور</td></tr>
<tr><td><strong>پوشش کامل</strong></td><td>اگر دکمه/modal در UI هست و doc ندارد = <strong>gap</strong> — باید پر شود</td></tr>
</tbody></table>

### قالب `_template.md`

```markdown
# چطور [کار] انجام دهیم

> **صفحه:** … · **نقش:** ADMIN · **viewport:** desktop

## پیش‌نیاز
- …

## مراحل
1. …
2. …

## نتیجه مورد انتظار
- …

## عیب‌یابی
| مشکل | راه‌حل |
|------|--------|

## مرتبط
- [چطور …](…)
- [Users — overview](../product/users-and-roles.md)
```

### فهرست‌نویسی (`docs/how-to/README.md`)

- جدول **همه HowToها** با ستون: عنوان · فایل · صفحه · نقش · گروه nav
- فیلتر per persona (Admin · Operator · Developer-using-UI)
- **Action inventory** — checklist پوشش: هر ردیف = UI action شناسایی‌شده در audit

### روش استخراج کatalog (DOC-0 / DOC-3b)

1. **Platform registry** — `src/config/platform-registry/route-bindings/*.json` → صفحات nav
2. **Toolbar / modal grep** — label دکمه‌ها در `src/features/**` و `src/pages/**`
3. **Settings sections** — `settingsSections.ts` → زیربخش‌های Settings
4. **Grid actions** — View · Edit · Delete · Lock · Test · … per CRUD page
5. **Designer / Git / AI** — workspace toolbars جدا audit شوند
6. **خروجی:** `docs/how-to/_inventory.md` — master checklist تا ۱۰۰٪ tick شود

---

## کاتالوگ HowToها (هدف پوشش کامل)

> **تعداد تقریبی:** ~۱۲۰–۱۵۰ فایل · هر زیربخش = پوشه · هر bullet = یک HowTo

### `auth/` — احراز هویت (عمومی + پروفایل)

<table dir="rtl">
<thead><tr><th>فایل (slug)</th><th>عنوان</th></tr></thead>
<tbody><tr><td><code dir="ltr" style="unicode-bidi: embed;">login.md</code></td><td>چطور وارد سیستم شویم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">logout.md</code></td><td>چطور خارج شویم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">register.md</code></td><td>چطور ثبت‌نام کنیم (اگر فعال باشد)</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">forgot-password.md</code></td><td>چطور بازیابی رمز را درخواست کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">reset-password.md</code></td><td>چطور رمز را با لینک reset عوض کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">verify-email.md</code></td><td>چطور ایمیل را تأیید کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">change-own-password.md</code></td><td>چطور رمز خود را عوض کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">view-active-sessions.md</code></td><td>چطور sessionهای فعال را ببینیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">revoke-a-session.md</code></td><td>چطور یک session را لغو کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">revoke-all-sessions.md</code></td><td>چطور همه sessionها را لغو کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">delete-own-account.md</code></td><td>چطور حساب خود را حذف کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">view-my-audit-logs.md</code></td><td>چطور audit log خود را ببینیم</td></tr>
</tbody></table>

### `users/` — کاربران

<table dir="rtl">
<thead><tr><th>فایل</th><th>عنوان</th></tr></thead>
<tbody><tr><td><code dir="ltr" style="unicode-bidi: embed;">create-user.md</code></td><td>چطور کاربر جدید ایجاد کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">edit-user-profile.md</code></td><td>چطور پروفایل کاربر را ویرایش کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">delete-user.md</code></td><td>چطور کاربر را حذف کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">lock-user.md</code></td><td>چطور کاربر را قفل کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">unlock-user.md</code></td><td>چطور قفل کاربر را باز کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">reset-user-password-admin.md</code></td><td>چطور رمز کاربر را reset کنیم (admin)</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">change-user-password-admin.md</code></td><td>چطور رمز کاربر را عوض کنیم (admin)</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">assign-user-roles.md</code></td><td>چطور نقش به کاربر بدهیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">login-as-user.md</code></td><td>چطور Login As انجام دهیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">upload-user-profile-image.md</code></td><td>چطور تصویر پروفایل کاربر آپلود کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">filter-sort-page-users-grid.md</code></td><td>چطور در grid کاربران فیلتر/مرتب‌سازی/صفحه‌بندی کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">view-user-session-preview.md</code></td><td>چطور پیش‌نمایش session کاربر را ببینیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">manage-user-attributes.md</code></td><td>چطور attributeهای کاربر را ویرایش کنیم</td></tr>
</tbody></table>

### `roles/` — نقش‌ها

<table dir="rtl">
<thead><tr><th>فایل</th><th>عنوان</th></tr></thead>
<tbody><tr><td><code dir="ltr" style="unicode-bidi: embed;">create-role.md</code></td><td>چطور نقش جدید ایجاد کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">edit-role.md</code></td><td>چطور نقش را ویرایش کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">delete-role.md</code></td><td>چطور نقش را حذف کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">manage-role-attributes.md</code></td><td>چطور attributeهای نقش را ویرایش کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">filter-sort-roles-grid.md</code></td><td>چطور grid نقش‌ها را فیلتر/مرتب کنیم</td></tr>
</tbody></table>

### `base-info/` — Base Info (درخت دیکشنری)

<table dir="rtl">
<thead><tr><th>فایل</th><th>عنوان</th></tr></thead>
<tbody><tr><td><code dir="ltr" style="unicode-bidi: embed;">create-base-info-entry.md</code></td><td>چطور ردیف Base Info ایجاد کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">edit-base-info-entry.md</code></td><td>چطور ردیف Base Info ویرایش کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">delete-base-info-entry.md</code></td><td>چطور ردیف Base Info حذف کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">reorder-base-info-tree.md</code></td><td>چطور ترتیب درخت را تغییر دهیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">expand-collapse-base-info-tree.md</code></td><td>چطور Expand/Collapse All درخت کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">search-base-info.md</code></td><td>چطور در Base Info جستجو کنیم</td></tr>
</tbody></table>

### `data-sources/` — منابع داده

<table dir="rtl">
<thead><tr><th>فایل</th><th>عنوان</th></tr></thead>
<tbody><tr><td><code dir="ltr" style="unicode-bidi: embed;">create-data-source.md</code></td><td>چطور data source جدید اضافه کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">edit-data-source.md</code></td><td>چطور data source را ویرایش کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">delete-data-source.md</code></td><td>چطور data source را حذف کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">test-data-source-connection.md</code></td><td>چطور اتصال یک source را تست کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">test-all-data-sources.md</code></td><td>چطور Test All connections بزنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">filter-sort-data-sources-grid.md</code></td><td>چطور grid data sources را فیلتر/مرتب کنیم</td></tr>
</tbody></table>

### `server-functions/` — Server Functions

<table dir="rtl">
<thead><tr><th>فایل</th><th>عنوان</th></tr></thead>
<tbody><tr><td><code dir="ltr" style="unicode-bidi: embed;">create-edge-function.md</code></td><td>چطور Server Function جدید بسازیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">edit-edge-function-code.md</code></td><td>چطور کد function را ویرایش کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">delete-edge-function.md</code></td><td>چطور function را حذف کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">test-edge-function.md</code></td><td>چطور function را تست کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">configure-edge-function-settings.md</code></td><td>چطور Settings یک function را تنظیم کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">view-edge-function-openapi.md</code></td><td>چطور Swagger/OpenAPI function را ببینیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">view-aggregated-api-docs.md</code></td><td>چطور <code dir="ltr" style="unicode-bidi: embed;">/api/docs</code> aggregated را باز کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">duplicate-edge-function.md</code></td><td>چطور function را duplicate کنیم (اگر UI دارد)</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">filter-sort-server-functions-grid.md</code></td><td>چطور grid functions را فیلتر/مرتب کنیم</td></tr>
</tbody></table>

### `auto-crud/` — Auto-CRUD Wizard

<table dir="rtl">
<thead><tr><th>فایل</th><th>عنوان</th></tr></thead>
<tbody><tr><td><code dir="ltr" style="unicode-bidi: embed;">launch-auto-crud-wizard.md</code></td><td>چطور ویزارد Auto-CRUD را باز کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">auto-crud-pick-schema-table.md</code></td><td>چطور جدول/schema را در ویزارد انتخاب کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">auto-crud-configure-routes.md</code></td><td>چطور routeها را در ویزارد تنظیم کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">auto-crud-preview-generated-code.md</code></td><td>چطور کد تولیدشده را preview کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">auto-crud-create-functions-from-wizard.md</code></td><td>چطور functionهای ویزارد را persist کنیم</td></tr>
</tbody></table>

### `component-designer/` — Component Designer

<table dir="rtl">
<thead><tr><th>فایل</th><th>عنوان</th></tr></thead>
<tbody><tr><td><code dir="ltr" style="unicode-bidi: embed;">open-component-designer.md</code></td><td>چطور Designer را باز کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">create-new-layout.md</code></td><td>چطور layout جدید بسازیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">edit-layout-canvas.md</code></td><td>چطور روی canvas ویرایش کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">add-component-from-palette.md</code></td><td>چطور از palette کامپوننت اضافه کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">edit-component-properties.md</code></td><td>چطور properties کامپوننت را ویرایش کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">edit-style-class-names.md</code></td><td>چطور Style/Class Name editor را استفاده کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">save-layout-draft.md</code></td><td>چطور draft را save کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">publish-layout.md</code></td><td>چطور layout را publish کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">duplicate-layout.md</code></td><td>چطور layout را duplicate کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">delete-layout.md</code></td><td>چطور layout را حذف کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">preview-layout.md</code></td><td>چطور preview بگیریم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">export-layout-to-git.md</code></td><td>چطور Export to Git کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">rename-layout.md</code></td><td>چطور layout را rename کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">search-palette-components.md</code></td><td>چطور در palette جستجو کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">undo-redo-designer-changes.md</code></td><td>چطور Undo/Redo در Designer (اگر exposed)</td></tr>
</tbody></table>

### `themes/` — Themes

<table dir="rtl">
<thead><tr><th>فایل</th><th>عنوان</th></tr></thead>
<tbody><tr><td><code dir="ltr" style="unicode-bidi: embed;">upload-theme.md</code></td><td>چطور theme ZIP آپلود کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">activate-theme.md</code></td><td>چطور theme را فعال کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">set-default-theme.md</code></td><td>چطور theme پیش‌فرض تنظیم کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">delete-theme.md</code></td><td>چطور theme را حذف کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">preview-theme.md</code></td><td>چطور theme را preview کنیم</td></tr>
</tbody></table>

### `plugins/` — Plugins · Package Studio

<table dir="rtl">
<thead><tr><th>فایل</th><th>عنوان</th></tr></thead>
<tbody><tr><td><code dir="ltr" style="unicode-bidi: embed;">upload-install-plugin.md</code></td><td>چطور plugin ZIP نصب کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">open-package-studio.md</code></td><td>چطور Package Studio را باز کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">create-extension-package.md</code></td><td>چطور extension-only package بسازیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">create-vertical-app-package.md</code></td><td>چطور vertical-app package بسازیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">export-functions-to-package.md</code></td><td>چطور functionها را به package export کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">export-mount-to-package.md</code></td><td>چطور mount را به package export کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">export-theme-package.md</code></td><td>چطور theme package export کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">preview-package-before-install.md</code></td><td>چطور manifest/conflict را قبل از install ببینیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">enable-plugin.md</code></td><td>چطور plugin را فعال کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">disable-plugin.md</code></td><td>چطور plugin را غیرفعال کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">delete-plugin.md</code></td><td>چطور plugin را حذف کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">create-plugin-via-builder.md</code></td><td>چطور با Package Builder plugin بسازیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">review-plugin-deployment-proposal.md</code></td><td>چطور deployment proposal را بررسی کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">refresh-plugins-list.md</code></td><td>چطور لیست plugins را refresh کنیم</td></tr>
</tbody></table>

### `git/` — Git Workspace

<table dir="rtl">
<thead><tr><th>فایل</th><th>عنوان</th></tr></thead>
<tbody><tr><td><code dir="ltr" style="unicode-bidi: embed;">connect-git-repository.md</code></td><td>چطور repository را connect کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">configure-git-preferences.md</code></td><td>چطور Git preferences را تنظیم کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">view-git-status.md</code></td><td>چطور status را ببینیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">stage-and-commit-changes.md</code></td><td>چطور stage و commit کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">push-to-remote.md</code></td><td>چطور push کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">pull-from-remote.md</code></td><td>چطور pull کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">fetch-remote.md</code></td><td>چطور fetch کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">create-branch.md</code></td><td>چطور branch جدید بسازیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">switch-branch.md</code></td><td>چطور branch عوض کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">view-diff.md</code></td><td>چطور diff را ببینیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">discard-local-changes.md</code></td><td>چطور تغییرات local را discard کنیم</td></tr>
</tbody></table>

> **یادداشت:** پس از اتمام p-19، HowToهای Git با flow واقعی sync شوند.

### `platform-portals/` · `platform-navigations/` — Portals & Navigations

<table dir="rtl">
<thead><tr><th>فایل</th><th>عنوان</th></tr></thead>
<tbody><tr><td><code dir="ltr" style="unicode-bidi: embed;">create-portal.md</code></td><td>چطور Portal جدید بسازیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">edit-portal.md</code></td><td>چطور Portal را ویرایش کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">delete-portal.md</code></td><td>چطور Portal را حذف کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">edit-navigation.md</code></td><td>چطور navigation tree را ویرایش کنیم</td></tr>
</tbody></table>

### `scheduled-tasks/` · `jobs/`

<table dir="rtl">
<thead><tr><th>فایل</th><th>عنوان</th></tr></thead>
<tbody><tr><td><code dir="ltr" style="unicode-bidi: embed;">create-scheduled-task.md</code></td><td>چطور Scheduled Task بسازیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">edit-scheduled-task.md</code></td><td>چطور Scheduled Task ویرایش کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">delete-scheduled-task.md</code></td><td>چطور Scheduled Task حذف کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">enable-disable-scheduled-task.md</code></td><td>چطور task را فعال/غیرفعال کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">view-jobs-list.md</code></td><td>چطور لیست Jobs را ببینیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">filter-jobs-grid.md</code></td><td>چطور Jobs را فیلتر کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">retry-failed-job.md</code></td><td>چطور job failed را retry کنیم (اگر UI دارد)</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">cancel-running-job.md</code></td><td>چطور job در حال اجرا را cancel کنیم (اگر UI دارد)</td></tr>
</tbody></table>

### `cache/` · `logs/`

<table dir="rtl">
<thead><tr><th>فایل</th><th>عنوان</th></tr></thead>
<tbody><tr><td><code dir="ltr" style="unicode-bidi: embed;">view-cache-stats.md</code></td><td>چطور آمار cache را ببینیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">flush-cache-namespace.md</code></td><td>چطور یک namespace cache را flush کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">flush-all-cache.md</code></td><td>چطور همه cache را flush کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">open-cache-settings-modal.md</code></td><td>چطور Cache Settings modal را باز کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">view-application-logs.md</code></td><td>چطور Logs را ببینیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">filter-application-logs.md</code></td><td>چطور Logs را فیلتر کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">clear-logs.md</code></td><td>چطور Logs را clear کنیم (اگر UI دارد)</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">export-logs.md</code></td><td>چطور Logs را export کنیم (اگر UI دارد)</td></tr>
</tbody></table>

### `chat-history/` · `my-apis/` · `dashboard/`

<table dir="rtl">
<thead><tr><th>فایل</th><th>عنوان</th></tr></thead>
<tbody><tr><td><code dir="ltr" style="unicode-bidi: embed;">view-chat-history.md</code></td><td>چطور تاریخچه چت AI را ببینیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">open-chat-session-detail.md</code></td><td>چطور جزئیات یک session چت را باز کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">delete-chat-session.md</code></td><td>چطور session چت را حذف کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">view-my-apis.md</code></td><td>چطور My APIs را ببینیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">create-my-api-connection.md</code></td><td>چطور connection شخصی API بسازیم (AC prep)</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">view-dashboard.md</code></td><td>چطور Dashboard را بخوانیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">customize-dashboard-widgets.md</code></td><td>چطور widgetهای dashboard را تنظیم کنیم (اگر UI دارد)</td></tr>
</tbody></table>

### `settings/` — تنظیمات (هر action در SettingsWorkspace)

<table dir="rtl">
<thead><tr><th>فایل</th><th>عنوان</th></tr></thead>
<tbody><tr><td><code dir="ltr" style="unicode-bidi: embed;">configure-server-functions-settings.md</code></td><td>چطور تنظیمات سراسری Server Functions را عوض کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">configure-logging-settings.md</code></td><td>چطور تنظیمات Logs را عوض کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">configure-auth-security-settings.md</code></td><td>چطور Auth &amp; Security را تنظیم کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">configure-email-smtp.md</code></td><td>چطور Email/SMTP را تنظیم کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">configure-pwa-settings.md</code></td><td>چطور PWA را تنظیم کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">configure-cache-settings-section.md</code></td><td>چطور بخش Cache در Settings را تنظیم کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">create-ai-provider.md</code></td><td>چطور AI Provider اضافه کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">edit-ai-provider.md</code></td><td>چطور AI Provider ویرایش کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">delete-ai-provider.md</code></td><td>چطور AI Provider حذف کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">create-ai-model.md</code></td><td>چطور AI Model اضافه کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">edit-ai-model.md</code></td><td>چطور AI Model ویرایش کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">delete-ai-model.md</code></td><td>چطور AI Model حذف کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">create-mcp-server.md</code></td><td>چطور MCP Server اضافه کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">edit-mcp-server.md</code></td><td>چطور MCP Server ویرایش کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">delete-mcp-server.md</code></td><td>چطور MCP Server حذف کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">configure-mcp-builtin-pack.md</code></td><td>چطور built-in MCP pack را تنظیم کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">configure-mcp-inbound-host.md</code></td><td>چطور inbound MCP host را تنظیم کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">configure-mcp-http-allowlist.md</code></td><td>چطور HTTP allowlist MCP را تنظیم کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">configure-mcp-web-search.md</code></td><td>چطور Web Search MCP را تنظیم کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">manage-profile-fields.md</code></td><td>چطور Profile Fields را مدیریت کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">create-user-attribute-definition.md</code></td><td>چطور تعریف User Attribute بسازیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">edit-user-attribute-definition.md</code></td><td>چطور User Attribute را ویرایش کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">delete-user-attribute-definition.md</code></td><td>چطور User Attribute را حذف کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">create-role-attribute-definition.md</code></td><td>چطور تعریف Role Attribute بسازیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">edit-role-attribute-definition.md</code></td><td>چطور Role Attribute را ویرایش کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">delete-role-attribute-definition.md</code></td><td>چطور Role Attribute را حذف کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">save-settings-changes.md</code></td><td>چطور تغییرات Settings را Save کنیم</td></tr>
</tbody></table>

### `ai-assistant/` — پنل AI

<table dir="rtl">
<thead><tr><th>فایل</th><th>عنوان</th></tr></thead>
<tbody><tr><td><code dir="ltr" style="unicode-bidi: embed;">open-ai-panel.md</code></td><td>چطور پنل AI را باز کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">start-new-ai-chat.md</code></td><td>چطور چت جدید AI شروع کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">switch-ai-mode-plan-ask-agent.md</code></td><td>چطور بین Plan / Ask / Agent جابه‌جا شویم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">select-agent-capabilities.md</code></td><td>چطور capability packs و MCP servers را انتخاب کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">confirm-agent-destructive-action.md</code></td><td>چطور confirm gate برای git-write/… را بزنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">view-ai-trace-or-tool-calls.md</code></td><td>چطور trace/tool calls را ببینیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">resume-ai-session.md</code></td><td>چطور session AI را ادامه دهیم</td></tr>
</tbody></table>

### `shell/` — Admin Shell (عمومی UI)

<table dir="rtl">
<thead><tr><th>فایل</th><th>عنوان</th></tr></thead>
<tbody><tr><td><code dir="ltr" style="unicode-bidi: embed;">navigate-sidebar.md</code></td><td>چطور در sidebar navigate کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">collapse-expand-sidebar.md</code></td><td>چطور sidebar را collapse/expand کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">open-profile-drawer.md</code></td><td>چطور profile drawer را باز کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">switch-grid-paging-infinite.md</code></td><td>چطور بین Paging و Infinite Scroll در grid عوض کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">change-grid-page-size.md</code></td><td>چطور page size grid را عوض کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">sort-filter-grid-column.md</code></td><td>چطور sort/filter ستون grid را استفاده کنیم</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">use-about-app-modal.md</code></td><td>چطور About App را ببینیم</td></tr>
</tbody></table>

---

### معیار «کامل کامل» برای HowToها

- [ ] `_inventory.md` از audit UI — **۰ gap** (هر action tick شده)
- [ ] هر HowTo از `_template.md` پیروی می‌کند
- [ ] `README.md` فهرست همه فایل‌ها را دارد
- [ ] product docs به HowToها لینک می‌دهند (و بالعکس)
- [ ] HowToهای «اگر UI ندارد» یا marked `N/A — no UI` یا حذف از inventory با دلیل

---

## Developer Documentation — outline

**Persona:** مهندس تازه‌وارد · contributor · plugin author · integrator.

<table dir="rtl">
<thead><tr><th>سند</th><th>محتوا</th></tr></thead>
<tbody><tr><td>getting-started</td><td>prerequisites · setup · ساختار repo · اولین PR</td></tr>
<tr><td>architecture-overview</td><td>FSD client · Routes→Services→Domain · monolith process</td></tr>
<tr><td>project-structure</td><td><code dir="ltr" style="unicode-bidi: embed;">src/features</code> · <code dir="ltr" style="unicode-bidi: embed;">src/server</code> · <code dir="ltr" style="unicode-bidi: embed;">src/shared</code> · <code dir="ltr" style="unicode-bidi: embed;">src/core</code></td></tr>
<tr><td>coding-standards</td><td>لینک canonical — نه duplicate کامل AGENTS</td></tr>
<tr><td>server-functions-dev</td><td>sandbox · template · OpenAPI · test payload</td></tr>
<tr><td>auto-crud-dev</td><td>wizard · route naming REST · generated script layout</td></tr>
<tr><td>plugins-dev</td><td>contract · manifest · slots · test suite</td></tr>
<tr><td>component-designer-dev</td><td>storage · draft · export</td></tr>
<tr><td>ai-and-mcp-dev</td><td>capability packs · inbound MCP · stdio allowlist</td></tr>
<tr><td>database-and-multi-db</td><td>cpPool vs EdgeDbRouter · migrations policy (greenfield)</td></tr>
<tr><td>auth-and-rbac-dev</td><td>JWT · cookies · rbac-matrix pointer</td></tr>
<tr><td>testing</td><td>vitest · test:critical · auth-e2e</td></tr>
<tr><td>deployment</td><td>production secrets · build · health</td></tr>
<tr><td>faq-dev</td><td>«کجا route اضافه کنم؟» · «چرا core legacy؟»</td></tr>
</tbody></table>

**منابع merge (نه حذف فوری):**
- `DEVELOPER_GUIDE_FA.md` → absorb به `docs/developer/*` · header «منسوخ — see docs/developer»
- `document.md` → technical depth به developer + product split
- Audit reports → فقط یافته‌های پایدار در architecture/testing؛ بقیه در `deprecated-docs-index`

---

## Competitive Analysis — سند مقایسه‌ای

**فایل اصلی:** `docs/compare/competitive-landscape.md`

### محصولات مرجع (حداقل)

<table dir="rtl">
<thead><tr><th>محصول</th><th>دسته</th><th>چرا در مقایسه</th></tr></thead>
<tbody><tr><td><strong>WordPress</strong> (+ WooCommerce)</td><td>CMS / low-code extensibility</td><td>اکوسیستم plugin · self-host · non-dev admin</td></tr>
<tr><td><strong>Oracle APEX</strong></td><td>Low-code enterprise on Oracle DB</td><td>rapid app · SQL-centric · enterprise IT</td></tr>
<tr><td><strong>Odoo</strong></td><td>ERP modular</td><td>modules · business apps · self-host/SaaS</td></tr>
<tr><td><strong>Retool / Appsmith</strong></td><td>Internal tools builder</td><td>admin UI · DB connectors · less custom code</td></tr>
<tr><td><strong>Directus / Strapi</strong></td><td>Headless CMS + admin</td><td>content/API · extensibility model</td></tr>
<tr><td><strong>Supabase</strong> (+ Server Functions)</td><td>BaaS</td><td>Postgres · serverless functions · auth</td></tr>
<tr><td><strong>OutSystems / Mendix</strong></td><td>Enterprise low-code</td><td>visual dev · governance · licensing</td></tr>
</tbody></table>

*(لیست نهایی قابل گسترش — حداکثر ۸–۱۰ برای خوانایی.)*

### محورهای مقایسه (dimensions)

<table dir="rtl">
<thead><tr><th>محور</th><th>سوال</th></tr></thead>
<tbody><tr><td><strong>Primary use case</strong></td><td>CMS vs ERP vs internal platform vs dev extensibility</td></tr>
<tr><td><strong>Target user</strong></td><td>marketer · business analyst · full-stack dev · DBA</td></tr>
<tr><td><strong>Extensibility model</strong></td><td>PHP hooks · PL/SQL · Python modules · JS edge · visual only</td></tr>
<tr><td><strong>Data layer</strong></td><td>single DB vs multi-DB vs vendor lock-in</td></tr>
<tr><td><strong>Hosting</strong></td><td>SaaS-only · self-host · hybrid</td></tr>
<tr><td><strong>Auth / SSO</strong></td><td>built-in · plugins · enterprise SAML (roadmap <a href="p-23-enterprise-saml.md">p-23</a>)</td></tr>
<tr><td><strong>Visual builder</strong></td><td>page builder · form builder · component designer depth</td></tr>
<tr><td><strong>API-first</strong></td><td>REST/OpenAPI native vs secondary</td></tr>
<tr><td><strong>AI integration</strong></td><td>none · bolt-on · agent+MCP in-process (AppEndO)</td></tr>
<tr><td><strong>License / TCO</strong></td><td>OSS · per-user · per-app · infra cost</td></tr>
<tr><td><strong>Maturity / ecosystem</strong></td><td>marketplace size · community</td></tr>
<tr><td><strong>Ops complexity</strong></td><td>install wizard · multi-node · git-native deploy</td></tr>
</tbody></table>

### ماتریس خلاصه (نمونه ساختار)

```
                    WP    APEX   Odoo   Retool  AppEndO
Self-host           ✓     ✓      ✓      ◐       ✓
Multi-DB            ✗     ◐      ✗      ✓       ✓
Custom code (JS)    ◐     ◐      ✓      ◐       ✓✓
Visual UI builder   ✓     ✓      ✓      ✓       ✓
Enterprise RBAC     ◐     ✓      ✓      ✓       ✓
Plugin marketplace  ✓✓    ◐      ✓      ◐       🟡 p-42
AI agent in-app     ✗     ✗      ◐      ◐       ✓
```

(✓✓ = strength · ✓ = good · ◐ = partial · ✗ = weak · 🟡 = planned)

### Positioning AppEndO (پیام کلیدی)

**AppEndO جای WordPress یا Odoo نیست** — بلکه **پلتفرم ساخت و اداره اپ‌های سازمانی** برای تیم‌هایی که:

- به **کد TypeScript/JavaScript** و Server Functions نیاز دارند (نه فقط SQL یا PHP)
- **چند دیتابیس** و data source واقعی دارند
- **Component Designer + Git + AI Agent** را در یک admin shell می‌خواهند
- self-host و control plane PostgreSQL را ترجیح می‌دهند

**Sweet spot:** internal tools + custom business apps + integrator platform — نه blog/shop عمومی، نه ERP کامل out-of-the-box.

### `decision-matrix.md`

سؤالات برای CTO/PM:

1. آیا تیم dev JavaScript دارید؟ → بله = AppEndO · خیر = APEX/Retool
2. آیا ERP finance/HR out-of-the-box لازم است؟ → بله = Odoo · خیر = AppEndO
3. آیا محتوای عمومی/web marketing اصلی است؟ → بله = WordPress · خیر = AppEndO
4. آیا vendor lock-in Oracle قبول است؟ → …

### `positioning-one-pager.md`

- Problem · Solution · Differentiators (۳–۵ bullet) · Not a fit when · Roadmap teaser

---

## ایده‌های تکمیلی (اضافه به scope)

<table dir="rtl">
<thead><tr><th>#</th><th>سند / بخش</th><th>ارزش</th></tr></thead>
<tbody><tr><td>1</td><td><strong>Persona learning paths</strong> در <code dir="ltr" style="unicode-bidi: embed;">docs/README.md</code></td><td>Admin 30min · Developer Day-1 · Architect 2h</td></tr>
<tr><td>2</td><td><strong>Feature maturity labels</strong></td><td>shipped · beta · planned (link p-NN)</td></tr>
<tr><td>3</td><td><strong>Security summary for buyers</strong></td><td>JWT · sandbox · RBAC · SSRF guards MCP — pointer <code dir="ltr" style="unicode-bidi: embed;">docs/security/</code></td></tr>
<tr><td>4</td><td><strong>Plugin author quickstart</strong></td><td>۱۵ دقیقه اولین slot — جدا از user doc</td></tr>
<tr><td>5</td><td><strong>Operations runbook index</strong></td><td>merge <code dir="ltr" style="unicode-bidi: embed;">docs/architecture/multi-node-deployment.md</code> + deployment</td></tr>
<tr><td>6</td><td><strong>Terminology FA/EN</strong></td><td>glossary دوزبانه برای تیم mixed</td></tr>
<tr><td>7</td><td><strong>Anti-patterns</strong></td><td>«چه زمانی AppEndO انتخاب نکنید» — صداقت در compare doc</td></tr>
<tr><td>8</td><td><strong>Doc freshness policy</strong></td><td>هر merge فیچر بزرگ → README feature row + user/dev section</td></tr>
<tr><td>9</td><td><strong>Appendix: plan index link</strong></td><td>roadmap عمومی از plans-done/todo (بدون جزئیات implementation داخلی)</td></tr>
<tr><td>10</td><td><strong>Migration narratives</strong></td><td>«از WordPress نیامدید — از custom Express آمدید»</td></tr>
<tr><td>11</td><td><strong>HowTo search tags</strong></td><td>tag <code dir="ltr" style="unicode-bidi: embed;">#git</code> <code dir="ltr" style="unicode-bidi: embed;">#crud</code> در frontmatter هر HowTo برای فیلتر آینده</td></tr>
</tbody></table>

---

## فازهای تولید سند (بدون کد)

<table dir="rtl">
<thead><tr><th>فاز</th><th>کار</th><th>خروجی</th></tr></thead>
<tbody><tr><td><strong>DOC-0</strong></td><td>Inventory</td><td>لیست همه <code dir="ltr" style="unicode-bidi: embed;">.md</code> موجود + تصمیم keep/merge/deprecate</td></tr>
<tr><td><strong>DOC-1</strong></td><td>README + doc map</td><td><code dir="ltr" style="unicode-bidi: embed;">README.md</code> · <code dir="ltr" style="unicode-bidi: embed;">docs/README.md</code></td></tr>
<tr><td><strong>DOC-2</strong></td><td>Product brief + feature list</td><td><code dir="ltr" style="unicode-bidi: embed;">docs/product/overview.md</code> · <code dir="ltr" style="unicode-bidi: embed;">feature-list.md</code></td></tr>
<tr><td><strong>DOC-3</strong></td><td>User guides (MVP)</td><td>۵–۸ سند پرکاربرد (auth · CRUD · plugins · designer · AI)</td></tr>
<tr><td><strong>DOC-3b</strong></td><td><strong>HowToها — inventory + template</strong></td><td><code dir="ltr" style="unicode-bidi: embed;">_inventory.md</code> · <code dir="ltr" style="unicode-bidi: embed;">_template.md</code> · <code dir="ltr" style="unicode-bidi: embed;">how-to/README.md</code></td></tr>
<tr><td><strong>DOC-3c</strong></td><td><strong>HowToها — نگارش کامل</strong></td><td>همه فایل‌های کاتالوگ (~۱۲۰+) · ۱۰۰٪ tick روی inventory</td></tr>
<tr><td><strong>DOC-4</strong></td><td>Developer guides (MVP)</td><td>getting-started · architecture · edge · plugins · testing</td></tr>
<tr><td><strong>DOC-5</strong></td><td>Competitive pack</td><td><code dir="ltr" style="unicode-bidi: embed;">competitive-landscape.md</code> · <code dir="ltr" style="unicode-bidi: embed;">decision-matrix.md</code> · one-pager</td></tr>
<tr><td><strong>DOC-6</strong></td><td>Consolidation</td><td>deprecated index · به‌روز لینک‌های cross-ref · glossary · FAQ</td></tr>
<tr><td><strong>DOC-7</strong></td><td>Review pass</td><td>یک نفر non-author · اصلاح ناسازگاری با کد فعلی</td></tr>
</tbody></table>

---

## معیار خروج

- [ ] `README.md` ریشه = محصول AppEndO (نه AI Studio) با feature list و quick start
- [ ] `docs/README.md` با persona paths
- [ ] حداقل **۸** سند user در `docs/product/`
- [ ] **`docs/how-to/`** — `_inventory.md` با ۰ gap · **≥ ۱۰۰** HowTo فایل · README فهرست کامل
- [ ] حداقل **۸** سند developer در `docs/developer/`
- [ ] `docs/compare/competitive-landscape.md` با ≥ ۶ رقیب و ماتریس محورها
- [ ] `decision-matrix.md` + `positioning-one-pager.md`
- [ ] `deprecated-docs-index.md` — مسیر از سندهای ریشه قدیمی
- [ ] Glossary + FAQ (user + dev)
- [ ] `CHANGELOG.md` template
- [ ] **هیچ** تغییر runtime/code در scope این فاز (جز markdown)

---

## وابستگی و زمان‌بندی

<table dir="rtl">
<thead><tr><th>موضوع</th><th>توصیه</th></tr></thead>
<tbody><tr><td><strong>موازی با p-29</strong></td><td>DOC-0…2 (inventory · README · product brief) — <strong>قبل از</strong> p-29 تمام</td></tr>
<tr><td><strong>HowTo packaging</strong></td><td>بعد از p-29 PKG-1 — UI Package Studio باید وجود داشته باشد</td></tr>
<tr><td><strong>Culture glossary</strong></td><td>terminology از مدل Culture موجود</td></tr>
<tr><td><strong>Git user doc</strong></td><td>p-19 ✅ — sync با flow فعلی</td></tr>
<tr><td><strong>Marketplace در compare</strong></td><td>p-42 = planned در ماتریس</td></tr>
<tr><td><strong>تخمین HowToها</strong></td><td>~۱ هفته inventory + template · ~۲–۳ هفته نگارش full catalog</td></tr>
<tr><td><strong>تخمین کل فاز</strong></td><td>۳–۵ هفته نگارش · DOC-1…5 قابل shippable جدا · <strong>شروع DOC-0 موازی با p-29 مجاز</strong></td></tr>
</tbody></table>

---

## کار بعدی (اولین قدم)

- [ ] **DOC-0 — Inventory** — فهرست `*.md` ریشه و `docs/` + جدول keep/merge/deprecate  
  _(می‌تواند موازی با p-29 PKG-1 شروع شود)_

---

*سند برنامه — Platform Documentation · DOC · p-44 · فقط تولید markdown · موج ۶*


</div>
