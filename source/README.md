# AppEndO

**AppEndO** is a self-hosted **enterprise platform** for organizations that run custom business applications—not a blogging CMS or out-of-the-box ERP suite. **Operators and builders** use the back-office studio; **everyday end users**—people with no technical background who only need general web information, forms, or self-service pages—use **front-office** portals and vertical apps on the same stack. Public sites, customer portals, partner apps, and branded experiences share one **relational control plane** (**SQL Server** default and recommended; PostgreSQL, MySQL, and SQLite supported on the wizard) with optional **multiple external databases**.

The **AppEndO ecosystem** is built around extensibility without reinventing the wheel: **ready-made packages** (extensions and vertical apps) install from the Packages hub; a guided **install wizard** and **marketplace** (roadmap) aim for **one-click setup and extension** so teams are not forced to code every capability from scratch. **Server Functions**, **Data Studio**, and the **Workflow Engine** still allow deep customization when needed. **Platform experiences** route traffic by culture, portal, and page—for admins and for the general public alike. AppEndO is **not CMS-first**, but it is **platform-first**: one stack for **back-office + front-office**, from power users to casual visitors.

**Control plane (2026):** **SQL Server** is the **default and recommended** relational database (`settings.example.json`). PostgreSQL, MySQL, and SQLite remain supported on the install wizard; the provider is chosen once at setup and is not silently rewritten at boot. New `base_*` tables use **Sequelize**; remaining **Prisma** usage is legacy and not extended.

### Who it's for

| Audience | Typical user | What they do |
| --- | --- | --- |
| **Builders** | Developers, integrators | Data Studio, Server Functions, Client Components, Workflows, custom packages, data sources |
| **Operators** | Admins, IT, business owners | Install ready-made packages, configure settings, manage users, roles, org/geo scope |
| **End users** | Everyday staff, customers, public visitors | Browse information, submit forms, complete work items, use self-service portals—no studio access required |

---

## Built-in platform

These ship with the **core install**—no marketplace plugin or extra license required.

| Area | Included out of the box |
| --- | --- |
| **Identity** | Users · roles · JWT sessions (HttpOnly cookies) · login lockout · Google, GitHub, Microsoft Entra, and generic OIDC · Individual/Company profiles · **Function Access Control** (shared ACL for Server Functions, Data APIs, MCP, portals, workbooks) · session context · active sessions |
| **Admin shell (back-office)** | Unified studio navigation · customizable Home dashboard (work-item inbox, shortcuts, KPIs, and more) · pin pages to Home · RBAC-gated pages · PWA-ready shell · Theme Designer (named accent presets) · in-app notifications |
| **Front-office & public** | Multiple **portals** & shells · **vertical apps** (branding, public routes, static assets) · per-route auth (public · authenticated · admin) · culture-localized URLs |
| **Data** | Multi-engine **control plane** (**SQL Server** default · PostgreSQL, MySQL, SQLite) · edge data sources (Postgres, SQL Server, MySQL, Oracle, MongoDB, Redis, SQLite) · **Data Studio** (Edge models, Sequelize Data API, SQL Console, AI schema enricher) · **Record Policy** (row-level org/geo scope) · **Workbooks** (personal + shared) |
| **Development** | **Idea Foundry** · Client Components (Component Designer toolbox from **Base Components** + **CRUD Set** wizard) · **Base Components** catalog · Server Functions (sandboxed JS/TS + OpenAPI) · **API Talk** (Postman-class HTTP client) · **Access Assistant** (page/function ACL wizard) · Data Studio · Packages hub (install/build/export ZIPs) · **Libraries** (node npm store) · Portals · Git workspace · runtime sandbox |
| **Workflows** | Native **Workflow Engine** (designer, durable run, human work items and task forms, assignment strategies, four-eyes, escalation, out-of-office, dead-letter queue, encrypted secrets, webhooks, timers, parallel/subflow) · action catalog (core + package-contributed) · definition import/export · designer AI drafts · inbound MCP tools for workflow actions |
| **Platform routing** | Culture packs (US · IR · IQ) · portals · experience routing (culture × app × route) · web fonts per culture |
| **Operations** | Cache control (memory / Redis) · structured logs · background jobs · cron scheduler · File Manager · Git workspace · Platform Transfer · embedded feedback · in-app notifications · optional **Remote Hubs** package (File Hub · SSH Hub · RDP Hub) |
| **AI** | In-app **AppEndO** agent (Ask / Plan / Agent) · **background agent runs** · chat history · **16 MCP capability packs** · designer-local AI panels · end-user field assist (forms, textarea, image editor) · optional external MCP servers · inbound MCP host (`/api/mcp`) |
| **APIs & standards** | OpenAPI aggregation · `/api/project-standards` · health / readiness probes |
| **Settings** | System config hub: auth, JWT secrets, email, cultures, web fonts, AI models, MCP access, end-user AI assist, identity providers, PWA, logs, session context, profile fields, user/role attributes, feedback, Platform Transfer |
| **Install** | First-run **install wizard** (topology, cache, database, admin, email) · CLI `npm run setup` for **PostgreSQL-only** greenfield bootstrap (other engines: use the wizard) |

LOB modules (CRM, HR, commerce, …) are **ecosystem packages**—planned or optional add-ons, not bundled as the core product. **CMS** is a shipped editorial package built on Data Studio + Server Functions + Client Components.

---

## Features

- **Identity & access** — Users, roles, JWT auth, RBAC, OAuth/OIDC providers, Individual/Company profiles, **Function Access Control** (one ACL model across Server Functions, Data APIs, MCP, portals, and workbooks), session context, and **Record Policy** for row-level org/geo scope on Data APIs.
- **Data Studio & Data API** — Model edge tables visually, publish REST Data APIs (Sequelize runtime), run read-only **SQL Console** queries, and enrich connected schemas with AI (relationship discovery and documentation).
- **Multi-database data layer** — Control plane on **SQL Server** (default) plus PostgreSQL, MySQL, and SQLite; register extra edge sources including Oracle, MongoDB, and Redis. New control-plane tables use **Sequelize**; remaining Prisma models are legacy and not extended.
- **Workflow Engine** — Author, simulate, publish, and run durable workflows with human work items and task forms, assignment strategies (role, user, round-robin, shortest queue, expression), four-eyes, escalation, out-of-office, dead-letter handling, encrypted secrets, webhooks, waits, package-contributed actions, and a core action pack.
- **Server Functions** — Author, version, and execute TypeScript/JavaScript APIs in a restricted runtime with OpenAPI documentation.
- **API Talk** — Postman-class in-studio HTTP client (collections, environments, assertions/extract, history, OpenAPI/Postman/cURL import, copy-as snippet) for calling and inspecting APIs.
- **Client Components, CRUD Set & Base Components** — Visually compose UI from a living catalog (grids, charts, forms, maps, kanban, signature pad, scanners, document viewer, and more). **CRUD Set** is the repeatable list + create/edit/delete pattern. The Component Designer toolbox is a subset of the Base Components catalog (`/studio/base-components`).
- **Idea Foundry** — Register product ideas and grow them from spark to scoped work inside Studio.
- **Home dashboard** — Customizable widget layout (work-item inbox, shortcuts, KPIs, portals, health, and more). Pin studio pages to Home from the sidebar.
- **Workbooks** — Spreadsheets for signed-in users. Admins still manage the Records catalog; each user opens **My Workbooks** from the personal menu, with sharing (named members, any signed-in user with the link, or a public link).
- **Theme Designer** — Named shell atmosphere presets with accent token control.
- **Packages & portability** — Install, build, and export plugin ZIPs from **Package Manager**; **Libraries** installs npm packages into this node’s store. **Ready-made ecosystem packages** for operators who prefer install-over-code.
- **Install wizard** — Guided first-time setup in the browser (no database required until the wizard applies schema). **SQL Server** and **PostgreSQL** are human-tested first-run paths; SQLite is machine-tested; MySQL wizard coverage is still thin.
- **Access Assistant** — Studio tools-menu wizard to grant **Function Access Control** on pages, Server Functions, and related subjects without hand-editing ACL rows.
- **Platform experiences** — Culture-aware routing across **admin studio**, **customer portals**, and **public pages** without hard-coding every URL.
- **Front-office surfaces** — Public sites and portals for **non-technical end users** (general information, forms, self-service)—alongside the operator studio.
- **Operations** — Cache control, structured logs, background jobs, scheduled tasks, File Manager, Git workspace, Platform Transfer, and in-app notifications (inbox + preferences). Optional **Remote Hubs** package adds File Hub, SSH Hub, and RDP Hub.
- **AI & MCP** — In-app AppEndO agent (Ask / Plan / Agent), background runs with notifications, 16 built-in MCP packs (including Workflow Actions), designer-local AI panels, inbound MCP host, and optional remote MCP servers (SSRF-guarded).
- **Settings & theming** — Central system config: auth, JWT secrets, email, PWA, AI models, end-user AI assist, identity providers, cultures, web fonts, session context, profile fields, and user/role attributes.

---

## Studio map

Core studio groups after a greenfield install (CMS appears when that package is present; Remote Hubs appears after that package is installed):

| Group | Pages |
| --- | --- |
| **Home** | Dashboard — customizable widgets (work-item inbox, shortcuts, KPIs, and more); pin pages from the sidebar |
| **Development** | Idea Foundry · Data Studio (SQL Console · Data Sources) · Server Functions (API Talk · Developer Reference) · Client Components (Base Components) · Portals · Workflows · Scheduled Tasks · Jobs · Cache Control · Git · File Manager · Theme Designer · Settings |
| **Extensions** | Package Manager · Libraries |
| **Records** | Users · Roles · Base Info (Organization Chart · Geographic Divisions) · Workbooks (admin catalog) · Chat History · Logs |

Theme Designer and Settings sit in the sidebar footer. The **personal menu** (profile drawer) opens **My APIs**, **My Workbooks**, and **My Feedback**, plus active sessions. My Work Items, Platform Transfer, and Feedback Inbox remain as pages (dashboard widget, Settings, and the feedback control) — they are not default sidebar items. File Hub / SSH Hub / RDP Hub are **not** core nav; they appear under **Remote Hubs** after `npm run remote-hubs:install`.

---

## Roadmap & ecosystem packages

AppEndO ships **reference packages** and **system extensions** alongside the core platform. Extension and vertical-app ZIPs are built from the repo (`npm run package:reference-build`, `npm run package:reference-vertical-build`) and installed through the **Packages** hub. Domain packages such as CMS are built with the same studio toolchain (Data Studio, Server Functions, Client Components) rather than as core `src/features/` modules.

### Shipped today

| Artifact | Type | What it demonstrates |
| --- | --- | --- |
| **ref-hello-widget** | Extension | Dashboard widget in `core.dashboard.widgets` |
| **ref-hello-api** | Extension | Sandboxed package API (`GET …/health`) |
| **ref-hello-page** | Extension | Registered UI route / page module |
| **inventory** | Vertical app | Full LOB app: routes, APIs, DB scripts, branding, propose→apply deployment |
| **hawiety** | Vertical app (monorepo) | Institute membership / Hawiety parity — build & install with `npm run hawiety:pack-and-install` (private pack tooling; omitted from public OSS release snapshots) |
| **CMS** | Domain package | Editorial content, vocabularies, and Studio CMS nav (Data Studio + Server Functions + Client Components) |
| **Remote Hubs** | Optional Studio package | File Hub (SFTP/FTP/FTPS) · SSH Hub · RDP Hub — install with `npm run remote-hubs:install` |
| **Culture packs** (US · IR · IQ) | System extension | Locale, calendar, direction, and web-font bundles (in-tree) |
| **Google / GitHub / Microsoft / OIDC** | System extension | Built-in identity-provider adapters |
| **AI MCP packs** (16 built-in) | In-process agent tools | Files, web, HTTP, Git, codebase, standards, data, context, designer, Server Functions, jobs, packages, memory, cache, OpenAPI, **workflow actions** |

### Platform roadmap

| Item | Focus |
| --- | --- |
| **Marketplace** | Central catalog — discover and **one-click install** ready-made packages |
| **Multi-node cluster** | Redis-backed scheduler, leader election, global rate limits (wizard already offers single-node vs role-based topology) |
| **Install wizard E2E** | Harden **MySQL** first-run path (SQL Server + PostgreSQL human-tested; SQLite machine-tested) — active work |
| **Platform updates** | Rolling updates and artifact pipeline |
| **Mobile apps** | Expo + WebView shells for vertical apps (admin studio already has selective-responsive polish) |
| **Enterprise SAML** | SSO for large orgs (OIDC/OAuth adapters already ship) |
| **Identity-provider ZIP packs** | Install additional OAuth/SAML adapters without rebuilding core |
| **Platform documentation** | End-user guides, HowTos, and a full docs site |
| **Control-plane Prisma retirement** | Finish moving remaining `base_*` tables off Prisma onto Sequelize |

### Planned ecosystem packages

Packages on the studio backlog (full list: [`plans/packages/todo/p-packages-backlog.md`](plans/packages/todo/p-packages-backlog.md)). Grouped by category:

**Studio & admin tools**
- **Database Manager** — Schema explorer, query runner, DBA tooling (beyond the shipped SQL Console)
- **Payment Gateways** — Payment provider config and webhook handling

**UI components**
- **Engagement** — Polls, comments, and lightweight engagement widgets
- **Contact Form** — Simple public contact form

**Panel & MCP**
- **Shell / SSH** — MCP agent on top of SSH Hub (requires Remote Hubs)
- **NatQL** — Natural-language database queries (requires Database Manager)
- **API Connectors** — OpenAPI catalog, per-user connections, proxied outbound calls

**Operational modules**
- **Newsletter & Push** — Email newsletter and Web Push notifications
- **Task Management** — Projects, tasks, and kanban boards (design only)
- **HR & Recruitment** — HR records and hiring workflows
- **Time & Payroll** — Attendance and payroll (depends on HR)
- **CRM & Support** — CRM, tickets, and live chat (v2 redesign on User/Profile; earlier phases rolled back)
- **Forum** — Discussion boards and community threads
- **Calendar & AMS** — Calendar, booking, and appointment scheduling
- **Commerce** — Sales, inventory, and invoicing

**And more** — additional operational packages are planned (procurement, warehouse, email campaigns, fleet management, accounting, and others). Each will ship as an installable ecosystem package when its spec is ready.

---

## How AppEndO compares

Quick positioning against common alternatives. **Pricing below was verified against vendor pages on 2026-06-29**—re-check before contracts or public claims. Development-model notes are summarized from vendor documentation (see [Sources](#comparison-sources)).

### What it is (and is not)

| | |
| --- | --- |
| **Is** | A self-hosted **enterprise application platform**: studio + runtime for custom business apps (back-office **and** front-office portals) on your infrastructure |
| **Is not** | A blogging CMS, an out-of-the-box ERP suite, a managed BaaS, or “just” an application framework you wire up in an external IDE |
| **Market name** | Not a widely known consumer brand. Closest category labels (nearest first): **self-hosted low-code / application platform** → **internal + external app builder** → **modular package platform**. Unrelated: the commercial product **Appendo** (POS data services) is a different company |

**One-line product shape:** core = development toolchain + control plane + workflow engine; line-of-business features (CRM, commerce, …) = **ecosystem packages**. CMS is a shipped editorial package, not the product category.

### Market concepts — who is what

| Market concept | Examples | AppEndO? | Shared DNA | Key difference |
| --- | :---: | --- | --- | --- |
| **CMS** | WordPress, Drupal | **No** | Can host public pages and portals; **CMS package** for editorial content | CMS is content/SEO-first; AppEndO is **platform-first** (CMS is a package, not the core product) |
| **ERP / business suite** | Odoo, SAP | **No** | Can grow CRM/HR/commerce via packages | ERP ships LOB modules on day one; AppEndO ships the **studio**—LOB is optional ecosystem |
| **Application framework** | ABP, Nest/Django admin kits | **Partial** | Modular apps, RBAC, extensibility | Framework = code in *your* IDE; AppEndO = **in-platform studio + runtime** |
| **Low-code / aPaaS** | Oracle APEX, OutSystems | **Closest** | Visual builder + in-platform logic | APEX is Oracle-stack; AppEndO is Node + multi-DB control plane, Git workspace in core |
| **Internal tools builder** | Retool, Appsmith | **Partial** | Fast UIs on data sources | Retool is mostly internal/SaaS; AppEndO also targets **public portals and vertical apps** |
| **BaaS / backend platform** | Supabase, Firebase | **Partial** | Auth, APIs, serverless functions | BaaS expects you to build the frontend elsewhere; AppEndO includes **designer + admin shell + portals** |
| **DXP / portal platform** | Liferay, Sitecore | **Surface-level** | Multi-portal, branding, culture routing | DXP leans digital experience/content; AppEndO leans **custom business apps + toolchain** |
| **Composable / package platform** | WordPress plugins, Odoo modules | **Yes (extension model)** | Installable ZIP/modules | Same *extension shape*; day-one product is neither CMS nor ERP |
| **BPMS** | Camunda, Flowable, Bonita | **Partial** | In-platform **Workflow Engine** (design, run, work items) | BPMS is process-orchestration-first; AppEndO is **application-platform-first**—workflows are a core capability, not the whole product |

### Verified pricing snapshot

Official list prices (USD unless noted). AppEndO has **no per-seat platform fee** when self-hosted.

| Platform | Entry / list price | Billing model | Official pricing |
| --- | --- | --- | --- |
| **AppEndO** | **Infra only** (your VM + database) · optional LLM API usage | Self-hosted · no vendor seat fee | — (this repository) |
| **WordPress** | **$0** core ([GPLv2](https://wordpress.org/about/)) · hosting separate · page builders e.g. Elementor **from ~$49/yr** | OSS core · paid hosting & plugins | [wordpress.org](https://wordpress.org/) · [Elementor pricing](https://elementor.com/pricing/) |
| **Oracle APEX** | **$0** with licensed Oracle DB on-prem · OCI **Always Free** tier · paid cloud **from ~$122/mo** (compute+storage) | DB license or OCI consumption · **no per-user APEX fee** | [APEX pricing](https://apex.oracle.com/en/learn/getting-started/pricing/) |
| **ABP Framework** | **$0** open-source · **Team $2,999** perpetual (3 dev seats, 1yr pro updates) · Business **$5,999** · Enterprise **$9,999** | Perpetual commercial license + optional renewal | [commercial.abp.io/pricing](https://commercial.abp.io/pricing) |
| **Odoo** | **One App Free $0** (unlimited users, one app) · **Standard ~$16.90/user/mo** (annual) · **Custom ~$25.50/user/mo** (Studio, on-prem) | Per internal user (Enterprise/SaaS) · **portal visitors free** | [odoo.com/pricing](https://www.odoo.com/pricing) |
| **Retool** | **Free** (up to 5 users) · **Team** builder **$10/user/mo** (annual) · internal user **$5/user/mo** · **Business** builder **$50/user/mo** | Per builder & internal user · external users priced on Business+ | [retool.com/pricing](https://retool.com/pricing) |
| **Supabase** | **Free $0** · **Pro from $25/mo** (+ compute; $10/mo credit covers one Micro instance) · **Team from $599/mo** | Org plan + per-project compute & usage overages | [supabase.com/pricing](https://supabase.com/pricing) |

### Development model

Where **building and extending** the product happens—and whether dev tooling is **part of the platform** or **bought/added separately**.

| Dimension | [AppEndO](.) | [WordPress](https://wordpress.org/) | [Oracle APEX](https://apex.oracle.com/) | [ABP Framework](https://abp.io/) | [Odoo](https://www.odoo.com/) | [Retool](https://retool.com/) | [Supabase](https://supabase.com/) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **Dev tooling in core?** | **Yes** — studio ships designer, Data Studio, API editor, Git, sandbox, package builder, workflow designer | **No** — core is runtime + block editor; builders & debug tools are **plugins** | **Yes** — browser **App Builder**, Page Designer, SQL Workshop ([docs](https://docs.oracle.com/en/database/oracle/apex/)) | **Partial** — framework in repo; **ABP Studio** & commercial UI are **separate products** | **Partial** — **[Odoo Studio](https://www.odoo.com/app/studio)** for no-code UI; Python module dev is **external IDE** | **Yes** — the **cloud builder is the product** ([docs](https://retool.com/docs/apps)) | **Partial** — dashboard for DB/SQL/**Server Functions** ([docs](https://supabase.com/docs/guides/functions)); **no full app UI builder** |
| **Visual UI builder** | **Client Components** + **CRUD Set** wizard + Base Components catalog (built-in) | Plugin market (Elementor, etc.) — often **paid** | **Page Designer** (built-in) | Commercial **Lepton** themes or custom Blazor/Razor | **Odoo Studio** (vendor-hosted; customization layer) | Drag-and-drop apps (built-in) | Build frontend **outside** Supabase |
| **Custom API / logic** | **Server Functions** + **Data API** + **API Talk** in studio | PHP **themes/plugins**; REST via plugins or custom code | **PL/SQL** + APEX components in-platform | **C#** services & controllers you write | **Python** modules; automated actions in Studio | **JavaScript** in queries & transformers | **Deno Server Functions** in dashboard/CLI |
| **Workflows** | **Workflow Engine** in core (designer + durable runtime + human task forms, assignment, four-eyes, escalation) | Plugins | Approvals / processes in APEX | You build or add a BPMS | Automated actions + Studio | Workflows (plan-dependent) | External / Edge Functions |
| **Extension packaging** | **ZIP packages** — build/export in Packages hub | Plugin ZIP via **manual dev** + wp-admin upload | Export/import APEX apps | **NuGet** / solution modules | **Odoo modules** (Python addons) | Limited export; apps live in Retool | Migrations, functions, config via CLI |
| **In-platform Git / codebase tools** | **Git workspace** built-in | ✗ — FTP, hosting panel, or local dev | ✗ — DB-resident apps | ✗ — Git is your own repo + CI | ✗ — module folder + external Git | ✗ | ✗ — CLI + your repo |
| **AI-assisted development** | **In-app AppEndO agent + 16 MCP packs** (designer, Git, data, web, workflow, …) plus background runs | Plugin ecosystem (e.g. AI Engine) — **not core** | Limited / third-party | Custom integration | Odoo AI features (add-on trajectory) | AI-assisted building (plan-dependent) | External LLM + Server Functions |

**AppEndO distinction:** business features (CRM, commerce, …) ship as **ecosystem packages**; the **development toolchain** (designer, Data Studio, Server Functions, Git, package studio, sandbox, workflows) is **platform core**—similar to how APEX bundles its builder, but unlike WordPress where page builders and developer panels are typically **separate plugin purchases**.

### Positioning & pricing

| Dimension | [AppEndO](.) | [WordPress](https://wordpress.org/) | [Oracle APEX](https://apex.oracle.com/) | [ABP Framework](https://abp.io/) | [Odoo](https://www.odoo.com/) | [Retool](https://retool.com/) | [Supabase](https://supabase.com/) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **Development model** | **Platform-native studio** — designer, Data Studio, APIs, Git, packages, workflows in core | **Plugin + external IDE** — builders/debug tools extra | **In-browser low-code IDE** (with Oracle DB) | **Code-first .NET** + optional commercial studio/UI | **Studio** (vendor) + **Python modules** (IDE) | **Builder-as-product** (SaaS) | **Backend dashboard** + external frontend |
| **Primary focus** | Enterprise admin & custom business apps | Public content & marketing sites | Oracle-stack low-code apps | .NET modular application framework | All-in-one ERP/CRM | Internal tools & dashboards | Postgres BaaS + serverless |
| **CMS-first?** | No — platform-first (CMS package optional) | Yes | No | No | No (ERP-first) | No | No (backend-first) |
| **Target user** | **Builders** + **operators** + **everyday end users** (public/info portals) | Editors, agencies, bloggers | Oracle DBAs & enterprise devs | .NET developers | Business + functional consultants | Ops & citizen developers | Product engineers on Postgres |
| **License model** | **Custom** ([Section A controls](LICENSE): forks → contribution or private network only; **no public fork hosting**) | [GPLv2](https://wordpress.org/about/) core · commercial plugins/themes | **No-cost APEX feature** of Oracle Database · OCI consumption | MIT OSS · **[commercial perpetual licenses](https://commercial.abp.io/pricing)** | SaaS per internal user · Community edition self-host | **SaaS subscription** ([per-seat](https://retool.com/pricing)) | **Freemium cloud** · [org + usage billing](https://supabase.com/pricing) |
| **List price (verified 2026-06-29)** | Infra + optional AI APIs | **$0** core · builders e.g. **~$49+/yr** | **$0** on-prem with DB · cloud **from ~$122/mo** | OSS **$0** · Team **$2,999** (3 devs) | Free one-app · **~$17–26/user/mo** | Free tier · Team **$10–12/builder/mo** | Free · Pro **$25+/mo** |
| **Per-seat / user fees** | None (self-hosted platform) | None for WP core · plugins priced separately | **None for APEX** · Oracle DB / OCI billed separately | Commercial = **per dev seat** (3 included) | **Per internal user** · portal customers free | **Per builder & internal user** | **MAU & usage** on cloud (100k included on Pro) |
| **Typical extra costs** | Ops · HA · LLM tokens | Hosting · premium plugins · agency | Oracle DB license · DBA · OCI optional services | Hosting · DB · renewal after year 1 | Implementation · Odoo.sh hosting · IAP credits | SSO · on-prem enterprise · external users | Compute tiers · egress · storage overages |
| **Self-hosting** | Yes (Node + relational DB) | Yes | Yes (Oracle stack) | Yes (.NET host) | Yes or SaaS | Cloud-first; limited self-host | Cloud-first; self-host possible |
| **Best fit when…** | You want admin + public portals on your infra, with **ready packages** for operators and **code depth** when developers need it | Content, SEO, and community sites matter most | You are already on Oracle and want rapid DB apps | You standardize on .NET and want a modular monolith/SaaS kit | You want ERP modules (HR, inventory, accounting) day one | You want fast internal CRUD UIs with minimal backend code | You want managed Postgres, auth, and storage as a service |

### Built-in capabilities (no extra product tier)

What you get **without** buying add-ons, plugins, or a higher SaaS plan—at a glance.

| Capability | AppEndO | WordPress | Oracle APEX | ABP | Odoo | Retool | Supabase |
| --- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| Admin shell + RBAC | ✓ | ◐ | ✓ | ◐ build | ✓ | ✓ | ◐ |
| Multi-database connectors | ✓ | ✗ | ◐ Oracle-first | ◐ app DB | ✗ | ✓ | ✗ Postgres |
| Visual UI / form designer | ✓ core | ◐ plugins (often paid) | ✓ core | ◐ commercial themes | ◐ Studio (vendor) | ✓ core | ✗ external |
| Dev toolchain in platform | ✓ | ✗ plugins / external | ✓ | ◐ IDE + paid studio | ◐ Studio + external Python | ✓ (builder only) | ◐ backend only |
| Custom API / serverless runtime | ✓ core | ◐ plugins / PHP | ✓ in-platform | ◐ you build (C#) | ◐ Python modules | ◐ JS in builder | ✓ Server Functions |
| Workflow engine (design + run) | ✓ core | ◐ plugins | ◐ | ◐ you build | ◐ | ◐ | ✗ |
| Row-level record policy | ✓ core | ◐ plugins | ◐ | ◐ you build | ◐ | ◐ | ◐ RLS |
| Job scheduler & background tasks | ✓ | ◐ plugins | ✓ | ◐ you build | ✓ | ◐ | ◐ |
| Git-native dev workspace | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| In-app AI agent + tool packs | ✓ | ✗ | ✗ | ✗ | ◐ | ◐ | ✗ |
| Plugin / package portability (ZIP) | ✓ | ◐ | ◐ | ◐ | ✓ modules | ✗ | ✗ |
| OpenAPI-first APIs | ✓ | ◐ | ◐ | ◐ | ◐ | ◐ | ✓ |
| ERP / CRM modules out of the box | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ |

✓ included · ◐ partial / extension / DIY · ✗ not a core strength

**Not a substitute for:** WordPress (pure content marketing), Odoo (full ERP), or Supabase (managed BaaS). **Sweet spot:** organizations that need **back-office control** and **front-office reach**—a **built-in dev studio** (not a pile of paid builder plugins), **ready-made packages** for operators, and **end users** who may be non-technical visitors.

### Comparison sources

**Last verified: 2026-06-29.** Re-check vendor pages before sales, procurement, or marketing use.

| Platform | Product & development | Pricing (official) |
| --- | --- | --- |
| **AppEndO** | [`src/ARCHITECTURE.md`](src/ARCHITECTURE.md) · [`docs/ai/CODEBASE_INDEX.md`](docs/ai/CODEBASE_INDEX.md) · [`docs/standards/data-model.md`](docs/standards/data-model.md) (control-plane DB) | Self-hosted — no vendor list price |
| **WordPress** | [About / GPLv2](https://wordpress.org/about/) · [Plugin directory](https://wordpress.org/plugins/) (Query Monitor: “developer tools panel”) | Core free · [Elementor pricing](https://elementor.com/pricing/) (representative paid page builder) |
| **Oracle APEX** | [Product](https://apex.oracle.com/) · [Documentation](https://docs.oracle.com/en/database/oracle/apex/) | [APEX pricing](https://apex.oracle.com/en/learn/getting-started/pricing/) |
| **ABP Framework** | [abp.io](https://abp.io/) · open-source framework | [commercial.abp.io/pricing](https://commercial.abp.io/pricing) |
| **Odoo** | [Odoo Studio](https://www.odoo.com/app/studio) | [odoo.com/pricing](https://www.odoo.com/pricing) |
| **Retool** | [Classic apps docs](https://retool.com/docs/apps) | [retool.com/pricing](https://retool.com/pricing) |
| **Supabase** | [Server Functions guide](https://supabase.com/docs/guides/functions) | [supabase.com/pricing](https://supabase.com/pricing) |

---

## Installation

**Stack:** Node.js 22 · React (Vite) · Express · **SQL Server** control plane (default; legacy Prisma + **Sequelize** for new `base_*` tables) · Sequelize Data API · PostgreSQL/MySQL/SQLite wizard options. Optional Windows desktop wrapper via Electron (`npm run electron:dev` / `npm run build:exe`).

### Prerequisites

- [Node.js 22](https://nodejs.org/) and npm
- A control-plane database. **SQL Server** is the default in `settings.example.json` and the recommended production path. PostgreSQL, MySQL, and SQLite are also available on the [install wizard](http://localhost:3000/install).
- For the **PostgreSQL-only** `npm run setup` path: a running server and password (`PGPASSWORD` in `.env` when `settings.json` still uses the placeholder).
- For **SQL Server** (and most greenfield installs): use the install wizard after `npm run dev` — `npm run setup` exits early when the provider is not PostgreSQL.

### Option A — Install wizard (recommended first run)

The server starts in a **minimal install mode** until setup is complete (no database required to open the wizard).

```bash
git clone <this-repo>
cd AppEndO
cp .env.example .env          # PGPASSWORD only needed for PostgreSQL CLI setup
npm install
npm run dev
```

Open [http://localhost:3000/install](http://localhost:3000/install). The wizard walks through node capabilities, cache (memory or Redis), database, admin account, and optional email, then applies schema and redirects into the studio.

### Option B — CLI greenfield (PostgreSQL only)

Use this when the control-plane provider is **PostgreSQL** and you want a scripted bootstrap (`settings.example.json` defaults to SQL Server — switch the provider to PostgreSQL first, or use Option A for SQL Server):

```bash
cp .env.example .env          # set PGPASSWORD (PostgreSQL CLI path)
npm install
npm run setup                 # copies settings.example.json, creates DB, schema, seed (PostgreSQL only)
npm run dev
```

Default **development** login after seed (not for production):

| Field | Value |
| --- | --- |
| Email | `admin@append.os` |
| Password | `admin123` |

Health checks: `GET /api/health` · `GET /api/ready`.

### Production build

```bash
npm run build
npm run start
```

The process serves the Vite build and the API from the same Node server (`dist/server.cjs`). Set `runtime.nodeEnv` to `production` in `settings.json`, rotate JWT secrets, and enable the auth options you need in Settings (OTP / email verify stay off in development by policy).

### Useful commands

| Command | Purpose |
| --- | --- |
| `npm run setup` | Greenfield bootstrap (**PostgreSQL** provider only) |
| `npm run hawiety:pack-and-install` | Build and install the Hawiety vertical package (this monorepo) |
| `npm run dev` | API + Vite (default [http://localhost:3000](http://localhost:3000)) |
| `npm run db:sync-schema` | Additive control-plane schema sync (preserves tables not in Prisma). Do **not** use raw `prisma db push --accept-data-loss` on customer DBs — that drops unknown tables |
| `npm run install:reset` | Reset install state to re-run the wizard |
| `npm run remote-hubs:install` | Install the optional Remote Hubs package (File / SSH / RDP) |
| `npm run electron:dev` | Desktop wrapper (Electron) against the local server |
| `npm run test:critical` | High-signal regression suite |
| `npm run lint` | Typecheck (`tsc --noEmit`) |

---

## Secrets at rest

AppEndO encrypts recoverable secrets with **AES-256-GCM**. Production must set `APPENDO_CREDENTIAL_MASTER_KEY` (32 bytes: 64 hex characters or base64). Losing this key makes vault ciphertext unreadable; back it up with other deploy secrets, not in `settings.json` or git. On more than one node, every process uses the same key and `APPENDO_CREDENTIAL_KEY_VERSION`.

The control-plane **default data source** password stays in `settings.json` (encrypted blob) or `PGPASSWORD` because it is needed before the database is open. Every other recoverable secret belongs in the credential vault table (`base_credential_vault_secrets`). File / SSH / RDP Hub passwords and keys use that same table.

```bash
openssl rand -hex 32
```

To rotate the master key: back up `settings.json` and the control-plane database; set `APPENDO_CREDENTIAL_MASTER_KEY_PREVIOUS` to the current key, `APPENDO_CREDENTIAL_MASTER_KEY` to the new key, and bump `APPENDO_CREDENTIAL_KEY_VERSION`; restart; run `npx tsx scripts/migrations/credential-vault/rotate-credential-secrets.ts`. If every walker reports `failed=0`, unset `PREVIOUS`. Do not bump the version again before rotate finishes. Leftover plaintext or pre-vault blobs still need the matching `scripts/migrations/credential-vault/migrate-*.ts` scripts first.

---

## Remote Hubs

Optional Studio package (`remote-hubs`) for in-browser File Hub (SFTP/FTP/FTPS), SSH Hub, and RDP Hub. A fresh app does not show these pages until you install the package (`npm run remote-hubs:install`). After install they appear under the **Remote Hubs** sidebar group. File Manager stays in Development (local `workspace/` files).

Saved connections live under `workspace/file-hub/`, `workspace/ssh-hub/`, and `workspace/rdp-hub/`. Passwords and private keys are stored in the Core Credential Vault (`APPENDO_CREDENTIAL_MASTER_KEY`), not hub-specific master keys. Uninstalling the package removes the sidebar group, APIs, and the protocol libraries from Studio Libraries (`packages-storage/libs`). It does not delete those catalogs. Reinstalling the package npm-installs `ssh2`, `basic-ftp`, `ws`, `@xterm/*`, and `guacamole-*` back into `packages-storage/libs`. Restart the Studio server after install or uninstall so the client widgets pick up the change.

The browser talks to AppEndO over the **same origin**; the Node process then opens isolated `ssh2` / FTP / RDP (`guacamole-lite` + `guacd`) sessions. Production must set `APPENDO_CREDENTIAL_MASTER_KEY` (see Secrets at rest).

**RDP** needs Apache `guacd` on the AppEndO host:

```bash
docker run -d --name guacd --restart unless-stopped -p 4822:4822 guacamole/guacd
```

Optional env: `GUACD_HOST` / `GUACD_PORT` (defaults `127.0.0.1:4822`).

---

## Guides & documentation

End-user HowTos and a public docs site are still on the [platform documentation](plans/core/next/p-44-platform-documentation.md) roadmap. What exists today:

| Audience | Start here |
| --- | --- |
| **Product / architecture** | [`src/ARCHITECTURE.md`](src/ARCHITECTURE.md) · [`docs/appendo-architecture.md`](docs/appendo-architecture.md) · [`docs/README.md`](docs/README.md) |
| **Feature inventory** | [`docs/appendo-features.md`](docs/appendo-features.md) · generated map [`docs/ai/CODEBASE_INDEX.md`](docs/ai/CODEBASE_INDEX.md) |
| **Identity providers** | [`docs/guides/identity-providers-runbook.md`](docs/guides/identity-providers-runbook.md) |
| **Data Studio / Data API** | [`docs/standards/data-studio.md`](docs/standards/data-studio.md) |
| **CRUD Set** | [`docs/standards/crud-set.md`](docs/standards/crud-set.md) · Base Components catalog |
| **Record Policy** | [`docs/standards/record-policy.md`](docs/standards/record-policy.md) |
| **Packages** | [`docs/standards/package-ui.md`](docs/standards/package-ui.md) |
| **AI / MCP / AppEndO agent** | [`docs/standards/ai-mcp.md`](docs/standards/ai-mcp.md) |
| **UI / Base Components** | Studio `/studio/base-components` · [`docs/standards/ui-core.md`](docs/standards/ui-core.md) |
| **Access Assistant** | [`docs/standards/access-assistant.md`](docs/standards/access-assistant.md) |
| **Hawiety vertical package** | [`plans/packages/todo/hawiety-package/README.md`](plans/packages/todo/hawiety-package/README.md) · [`docs/standards/package-hawiety-db.md`](docs/standards/package-hawiety-db.md) |
| **Contributors & AI coding** | [`AGENTS.md`](AGENTS.md) · [`docs/standards/INDEX.md`](docs/standards/INDEX.md) |
| **What to build next** | [`plans/core/todo/p-00-todo-index.md`](plans/core/todo/p-00-todo-index.md) |

---

## License

**This is not standard Apache 2.0.** AppEndO uses a **custom license**: Apache 2.0 text plus **Section A primary terms** in [`LICENSE`](LICENSE). **Section A has legal priority** over Apache where they differ.

| Rule | Summary |
| --- | --- |
| **Legal priority** | **Section A controls** — Apache 2.0 (Section B) applies only where it does not conflict |
| **Fork — contribution** | Allowed — collaborate and contribute back to AppEndO development |
| **Fork — private network** | Allowed — deploy a fork **only** inside a private network (not public Internet) |
| **Fork — public Internet** | **Prohibited** — **no fork may be directly hosted on the public Internet** |
| **Official Work (not a fork)** | You may operate the official platform for your end users (including public-facing portals) without maintaining a separate source fork — see LICENSE A.4 |

Full legal text: [`LICENSE`](LICENSE) · Apache 2.0 reference (Section B only): [apache.org/licenses/LICENSE-2.0](https://www.apache.org/licenses/LICENSE-2.0)
