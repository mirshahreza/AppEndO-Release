# فیچرلیست MVP AppEndO

این سند قابلیت‌هایی را که از MVP فعلی و ساختار کد استخراج می‌شوند، در یک لیست عملی جمع می‌کند. مبنا هم `README.md`، هم پوشه‌های `src/features/` و هم route/controllerهای سرور است.

## خلاصهٔ قابلیت‌ها

| حوزه | قابلیت‌های دیده‌شده در محصول |
| --- | --- |
| Identity & access | login, register, reset password, verify email, users, roles, JWT sessions, lockout, OAuth/OIDC, Individual/Company profiles, Function Access Control, session context, Record Policy |
| Admin studio | customizable Home dashboard, pin-to-home shortcuts, navigation, platform settings, user/role management, Theme Designer, in-app notifications |
| Data | data sources, schema introspection, base info, org/geo, attributes, Data Studio, SQL Console, Data API, workbooks (personal + sharing) |
| Development | Idea Foundry, Component Designer, Base Components catalog, CRUD Set, Server Functions, API Talk, Developer Reference, My APIs, Git workspace, package tools |
| Packages | install, build, export ZIP, package hub, Libraries, Platform Transfer |
| Operations | cache, logs, jobs, scheduled tasks, background work, health/readiness, File Manager |
| Portals & routing | culture-aware URLs, portals, navigation, page modules, vertical apps |
| AI & assistant | AppEndO agent (Ask/Plan/Agent), background agent runs, chat history, 16 MCP packs, designer-local AI, end-user field assist, inbound MCP host |
| Collaboration & work | feedback, work items, human workflows (assignment, four-eyes, escalation, out-of-office, dead-letter), notifications |
| Files & assets | file manager, workspace assets, platform assets; optional Remote Hubs (File/SSH/RDP) |
| Platform setup | install wizard, boot, PWA, profile, settings scopes |

## استخراج مستقیم از `src/features/`

این feature sliceها در کد دیده می‌شوند:

- `ai-chat`
- `api-talk`
- `appendoo`
- `attributes`
- `base-components`
- `base-info`
- `cache`
- `chat-history`
- `component-designer`
- `dashboard`
- `data-sources`
- `data-studio`
- `dev-reference`
- `feedback`
- `file-manager`
- `git`
- `idea-foundry`
- `install`
- `jobs`
- `libraries`
- `logs`
- `my-apis`
- `operations`
- `org-geo`
- `packages`
- `platform-navigations`
- `platform-portals`
- `platform-transfer`
- `roles`
- `scheduled-tasks`
- `server-functions`
- `settings`
- `sql-console`
- `appearance`
- `users`
- `work-items`
- `workbooks`
- `workflows`

## آنچه به‌صورت package شناسایی می‌شود

- reference packages: widget, api, page و vertical app نمونه
- culture packs: US, IR, IQ
- identity provider packs: Google, GitHub, Microsoft Entra, generic OIDC؛ SAML در roadmap
- AI/MCP packs: ۱۶ پک داخلی (files, codebase, git, web, HTTP, standards, context, data, designer, Server Functions, jobs, packages, memory, cache, OpenAPI, workflow actions)
- CMS و Remote Hubs به‌صورت package نصب می‌شوند (هسته نیستند)

## دسته‌بندی کاربردی

اگر بخواهیم محصول را به زبان محصولی ببینیم، چهار ناحیهٔ اصلی دارد:

1. **Back-office core**: admin studio، dashboard، data، users، roles، settings، logs، cache، workbooks
2. **Developer studio**: Idea Foundry، Component Designer، Base Components، Server Functions، API Talk، Data Studio، packages، git
3. **Front-office delivery**: portals، pages، routing، culture packs، vertical apps
4. **Platform operations**: jobs، scheduled tasks، install، transfer، health، notifications، Workflow Engine

## پیشنهاد برای استفاده از این سند

- برای تصمیم معماری، به [docs/appendo-architecture.md](appendo-architecture.md) برو.
- برای فهمیدن «چه چیزهایی الان داریم»، همین سند را مبنا بگیر.
- برای جزئیات implementation-level، `src/ARCHITECTURE.md` و زیرسندهای `docs/architecture/` را بخوان.