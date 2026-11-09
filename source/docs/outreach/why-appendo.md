Read in Persian: [نسخهٔ فارسی](why-appendo-fa.md)

# AppEndO: Put Reins on AI Coding—and Build Beyond the Demo

*An integrated, self-hosted application platform for turning AI-assisted development into coherent business software—not a growing pile of generated code.*

AI coding tools can feel like a wild horse: extraordinary power, instant acceleration, and the unsettling realization that speed is not the same thing as control.

Ask an environment like Cursor for a screen, an endpoint, or a database integration, and it can move remarkably fast. Ask it to keep a large application consistent over years of changing requirements, developers, and business rules, and the challenge changes. Who defines the permission model? Which component library wins? Where does business logic belong? What prevents the next prompt from quietly inventing a second architecture?

The problem is not a shortage of code. It is a shortage of shared decisions that survive the next change.

**AppEndO puts reins on that power.** It gives developers and AI agents an established application environment: reusable building blocks, explicit standards, discoverable architecture, and a studio for building and running business applications. Instead of asking AI to reinvent the platform with every feature, you ask it to work within one.

The second payoff is just as practical: you stop spending the opening months of every project rebuilding the same foundation.

## A platform, not another starter template

AppEndO is a **self-hosted enterprise application platform**: a back-office studio, an application runtime, and tools for delivering front-office portals and custom vertical applications.

Its stack uses Node.js 22, Express, React, Vite, and TypeScript. SQL Server is the default and recommended control-plane database; the install wizard also offers PostgreSQL, MySQL, and SQLite. Sequelize powers new control-plane tables and the Data API runtime; remaining Prisma usage is legacy rather than the direction for new development.

That matters because AppEndO is not simply a repository of attractive screens. Identity, data access, application composition, workflows, packaging, AI tools, and operational controls live in the same platform.

It is also not an out-of-the-box ERP. The core supplies the toolchain and runtime; domain-specific applications belong in ecosystem packages.

## Open it in Cursor and start building the same day

You do not need a special plugin or a custom IDE to work this way. **Open the AppEndO folder in Cursor, start the platform, and begin building.** Cursor brings the speed: codebase indexing, multi-file edits, Agent and Plan modes, and an integrated terminal. AppEndO brings the reins: the decisions Cursor's agent should follow instead of inventing them again.

Here is what the agent finds the moment the project is open:

- **A front door for every AI session.** [`AGENTS.md`](../../AGENTS.md) sits at the repository root, where Cursor picks it up as project instructions. It sets the precedence of sources, the always-on rules (prompt scope only, Base Components first, the feature import graph, cookie-only JWTs, the database path), and a topic map that tells the agent which single standards file to load for the task at hand.
- **Focused context instead of noise.** The project's `.cursorignore` keeps dependencies, build output, runtime drafts, archived documents, and large media out of Cursor's index, so the agent's attention goes to the code and standards that matter.
- **A map of the codebase.** The [codebase index](../ai/CODEBASE_INDEX.md) and the architecture notes tell the agent where a page's code, workspace, and API live before it starts searching.
- **Building blocks to reuse.** Base Components, CRUD Set, Server Functions, Data Studio, record policies, and the workflow engine are already in place, so a prompt like "add a request-approval screen" becomes extending the platform rather than generating a new mini-framework.
- **The live platform as a tool source.** AppEndO also includes an inbound MCP endpoint (`/api/mcp`, API-key protected) that exposes the capability packs you enable in Settings. MCP-capable clients such as Cursor can connect to it, so the agent can work with the running platform's tools rather than only with source files.

A typical first session is simple: open the folder in Cursor, run `npm install` and `npm run dev`, finish the install wizard in the browser, and then ask Cursor's agent for your first real feature. It works inside a platform that already has access control, logging, and an application model, and those parts don't need to be built first.

That combination is the point. **Cursor gives you an exceptionally fast coding environment; AppEndO gives that environment a production-grade foundation and a rulebook to follow.** You keep everything Cursor offers and add the structure that keeps it on track.

## 1. Give AI a map, a vocabulary, and boundaries

A generic coding agent can write a plausible implementation. A useful project environment helps it write an implementation that belongs.

AppEndO approaches this at two levels.

### In the IDE: make the project's decisions discoverable

The repository's [AI standards hub](../../AGENTS.md) defines architectural and security invariants. Its [topic-based standards](../standards/INDEX.md) cover specific concerns—CRUD pages, Data APIs, record policies, dialogs, routing, and more—rather than relying on one enormous prompt. The development tree's path-scoped Cursor rules point agents toward the relevant standards instead of duplicating them. Public snapshots omit IDE-specific `.cursor/` assets; the standards hub and documentation are still included.

A [generated codebase index](../ai/CODEBASE_INDEX.md) maps pages to feature folders, workspaces, and API prefixes. Feature-graph tooling provides focused navigation. Page-edit-lock rules require the operator's prompt to explicitly target a page before its files are changed: a deliberate guard against “while I'm here” edits.

These are engineering conventions and agent controls, not a claim that an IDE can never make a mistake. Their value is reducing ambiguity: where to look, what to reuse, and what not to touch.

### Inside the platform: use application-aware tools

AppEndO also has an in-app agent with **Ask, Plan, and Agent** modes. This is distinct from Cursor: one is an IDE environment; the other works inside the live application platform.

The [in-app coding playbook](../standards/vibe-operator-playbook.md) describes a retrieve → plan → draft → finalize pipeline. Tools can retrieve project standards, inspect page context and feature graphs, draft Server Functions, test them, and draft Component Designer layouts. Managed changes go through the platform's proposal/apply path, with rollback available for the last apply. Valid proposals can be auto-applied in Agent mode; this is not a promise of a manual approval click before every change.

Applied managed functions and layouts use the **same running AppEndO instance**. You do not need a separate application engine just to preview that kind of change. Larger source refactors and deep interactive debugging still belong naturally in an IDE.

Built-in MCP capability packs connect the agent to areas such as data, standards, designer tools, Server Functions, jobs, packages, Git, and workflow actions. MCP access controls and remote-server restrictions make tools part of the platform's governance story—not an unlimited second route around it.

| Concern | AI coding without a shared platform | AI-assisted work with AppEndO |
| --- | --- | --- |
| Architecture | Re-explain or rediscover project conventions | Start with documented layers, topic standards, and a codebase map |
| Repeated UI | Generate another grid and form implementation | Reuse Base Components, CRUD Set, and Designer patterns |
| Permissions | Design and connect each enforcement path | Extend shared access controls and configured record policies |
| Change scope | Rely heavily on prompt discipline | Add page-targeting rules and platform-aware change tools |
| Delivery | Assemble infrastructure before the business feature | Build on an existing studio, runtime, and package model |

The goal is not less powerful AI. It is **less architectural improvisation per feature**.

## 2. Start where ordinary projects spend months arriving

Most business applications need the same unglamorous capabilities. They are easy to underestimate because none of them is the product's headline feature.

A login page is not identity management. A hidden button is not authorization. A timestamp is not an audit history. A green demo is not an operating model.

AppEndO already supplies these foundations, so the early project can focus on business behavior rather than infrastructure assembly.

### Identity and access beyond “add authentication”

The platform includes users, roles, JWT sessions in **HttpOnly cookies**, lockout, active-session management, and Individual/Company profiles. Built-in identity-provider adapters cover Google, GitHub, Microsoft Entra, and generic OIDC.

**Function Access Control** provides a shared ACL model across surfaces including Server Functions, Data APIs, MCP, portals, and workbooks. Access Assistant helps operators configure page and function access without hand-editing ACL rows.

AppEndO also distinguishes two questions that applications often blur:

- **Capability:** may this person call the operation?
- **Scope:** which records may they see or change?

[Record Policy](../standards/record-policy.md) adds organization- and geography-based row scoping to configured Data API models. A regional operator might have permission to update applications, but only applications in their assigned region.

This requires configuration: record scope defaults to off, and custom functions bypassing the Data API must explicitly enforce scope. Logical row filtering is not hard tenant isolation. Those boundaries are important engineering facts, not reasons to invent a separate permission system on every project.

### Data, APIs, and interfaces that already fit together

**Data Studio** provides visual Edge models, relationships, published REST Data APIs, a live datasheet, a read-only SQL Console, and AI-assisted schema enrichment. Relational edge sources include SQL Server, PostgreSQL, MySQL, Oracle, and SQLite.

For custom logic, **Server Functions** let builders author and version JavaScript/TypeScript APIs in a restricted runtime, with OpenAPI documentation. **API Talk** adds an in-studio HTTP client with collections, environments, assertions, history, and import options.

On the client side, **Component Designer**, **Base Components**, and **CRUD Set** supply a repeatable vocabulary for pages, grids, forms, and list/create/edit/delete flows. The catalog extends to charts, maps, kanban, signatures, scanners, and document viewing.

The point is not merely that a grid exists. It is that the grid, form, API contract, and surrounding interaction patterns can remain consistent as the application grows.

### Real business processes, not just status fields

The native **Workflow Engine** includes a visual designer, durable runs, human work items and task forms, and assignment strategies such as roles, named users, round-robin, and shortest queue.

Four-eyes controls, escalation, out-of-office handling, dead-letter recovery, timers, webhooks, parallel paths, subflows, and encrypted workflow secrets address the parts of a process that appear after the happy-path demo. Action catalogs can be extended by packages.

That is useful for approvals, onboarding, case handling, and other processes where “someone should do the next step” must become an explicit, manageable responsibility.

### History and operations from the beginning

Structured application logs and authentication audit are separate from the **Record Event Log**: append-only history of changes to tracked records, with actors, change reasons, redaction controls, and history views. This is not event sourcing; the current record remains the source of truth. Custom handlers need to integrate with event emission rather than receiving magical, universal tracking.

Background jobs, scheduled tasks, memory/Redis cache options, health/readiness probes, File Manager, Git workspace, and Platform Transfer cover further recurring needs. A personal inbox brings together work items, feedback, alerts, and message-dispatch history, rather than leaving every feature to invent its own attention queue.

For projects that would otherwise build and integrate this foundation themselves, **avoiding months of repeat work is a credible opportunity—not a measured guarantee**. The savings depend on the application's requirements and the team's starting point.

The ambition is to reach a production-minded baseline faster, not to produce a disposable MVP faster. Security review, backups, testing, and deployment hardening still belong to the delivery team.

## 3. Let operational data become useful insight

Many application stacks stop at CRUD, then send the team shopping for a separate reporting layer.

AppEndO's [Pivot API](../standards/data-api-pivot.md) uses a common request/result contract across flat relational datasets, internal **ROLAP star schemas**, an optional **Microsoft SSAS OLAP bridge**, and read-only **MongoDB** and **Elasticsearch** aggregation providers.

These are deliberately different integrations: MongoDB and Elasticsearch analytics are not general-purpose CRUD support, Redis is a cache option rather than an analytics database, and SSAS requires a separately operated bridge. The internal ROLAP provider is not an XMLA server for external BI clients.

Dashboard pages reuse Designer components. Developers declare an approved data domain; viewers can personalize layouts and add widgets within that domain. Filtering, drill interactions, sharing, embedding controls, snapshots, and widget comments extend the experience.

Optional dashboard AI assist can draft widget configurations or explain an already displayed chart. Its documented boundary is especially sensible: **AI gets no additional data privilege beyond the corresponding manual surface**.

That combination makes dashboards more than decorative screenshots. They become another application surface governed by explicit data and access decisions.

## 4. One foundation for builders, operators, and end users

A capable admin panel is only half the story when customers or partners also need to use the system.

AppEndO supports back-office Studio and front-office portals on the same stack. Culture × application × route resolution supports localized experiences, public pages, authenticated services, and branded vertical applications. Culture packs include US, IR, and IQ, with locale, calendar, direction, and font concerns treated as platform concepts.

UI consistency receives similar attention. The design system follows **Fluent 2 token discipline on Tailwind and HeroUI**, not a migration to Fluent React. Shared typography, colors, spacing, component conventions, and appearance controls reduce the visual drift that accumulates across independently generated screens.

Deep-linking standards extend to nested editors and many workspace overlays, making specific workspaces bookmarkable and easier to revisit. Personal and shared workbooks support spreadsheet-shaped work. The shell is PWA-ready, with an optional Electron desktop wrapper.

Together these details reduce the distance between “developers built it” and “people can use it every day.”

## 5. Extend the platform without turning the core into your application

A reusable platform needs a boundary between infrastructure and business-specific behavior.

AppEndO's **Packages hub** supports installing, building, and exporting ZIP artifacts for extensions and vertical applications. Reference packages demonstrate widgets, APIs, pages, and a vertical-app shape. Libraries manages npm packages in the node's store.

CMS and Remote Hubs are shipped packages rather than reasons to expand the core indefinitely. CMS supplies editorial capabilities; Remote Hubs optionally adds File, SSH, and RDP tools. The public release bundles CMS and Remote Hubs artifacts, not every private or planned domain package.

A central marketplace and broader ready-made business modules remain roadmap work. You should evaluate what ships today, not count future CRM, HR, or commerce modules as installed features.

The compelling architectural idea is already present: **reuse the platform; package the difference**.

## 6. Design for the second year, not only the first sprint

Long-lived software needs an answer to “what happens when this changes?”

AppEndO's documented feature boundaries, shared contracts, reusable UI, and planning workflow aim to make that answer less dependent on whoever remembers the original implementation. Its settings model distinguishes platform-wide configuration, node-local runtime settings, and structured data-model definitions.

Deployment also has explicit boundaries. A single node can carry service, platform, and worker capabilities. The documented split-role topology allows multiple service processes behind an external load balancer, but retains singleton platform and worker roles. Leader election, distributed worker coordination, and automated rolling updates are not a finished cluster feature.

Self-hosting gives teams control over infrastructure and deployment choices. It does not remove operational responsibility. Production still requires proper secret management—including the credential-vault master key—TLS, access-policy configuration, monitoring, and recovery planning.

That is a healthier proposition than “enterprise-ready because the screenshot looks enterprise.” The platform supplies mechanisms; teams validate them against their own operational and security requirements.

## What does a first application look like?

Consider an illustrative regional service-request system—not a claim that a ready-made package already ships:

1. Model requests and relationships in Data Studio; publish the required Data APIs.
2. Configure role-based capability checks and organization/geography record scope.
3. Compose the request list and forms with CRUD Set and Component Designer.
4. Add custom validation or integration logic through Server Functions.
5. Model review and approval as a workflow with human tasks and escalation.
6. Expose a customer-facing portal and an operator workspace on the same platform.
7. Add record-history tracking and a dashboard over approved measures.
8. Package reusable application pieces and review changes through the existing toolchain.

You still design the domain. What you avoid is designing an entire application platform before you can deliver it.

## Who should take a closer look?

AppEndO is particularly interesting for small teams building substantial business systems, organizations connecting existing databases, integrators delivering repeatable vertical applications, and developers who want AI assistance without surrendering architectural consistency.

It is less compelling if all you need is a static site, a managed backend service, or a complete ERP suite ready on day one. Its current release is early, and database paths have different validation coverage: SQL Server and PostgreSQL first-run paths are human-tested, SQLite is machine-tested, and MySQL wizard coverage remains thin.

### A clear licensing note

AppEndO publishes source under a **custom Apache-2.0-based license with additional terms**, not standard Apache 2.0. Section A controls: forks are permitted for contributing to AppEndO or private-network use, and public Internet hosting of forks is prohibited. Operating the official work for end users, including public-facing portals without maintaining a separate platform fork, is addressed separately in Section A.4.

These restrictions mean it should not be presented as unrestricted, OSI-style open source. Read the [full license](../../LICENSE) before adopting or redistributing it. Source visibility is valuable; accurate expectations are essential.

## Try a real slice, not just a landing page

Start with the [official public release repository](https://github.com/mirshahreza/AppEndO-Release) and its installation guide. For source-based development, the [project README](../../README.md#installation) documents Node.js 22, dependency installation, `npm run dev`, and the browser wizard at `http://localhost:3000/install`.

Use the wizard for the recommended SQL Server path; `npm run setup` is a PostgreSQL-only CLI bootstrap, not a universal installer. Before production, follow the documented build, configuration, secret-rotation, and hardening steps.

Then build one representative vertical slice: one real dataset, one scoped role, one workflow, and one useful screen. That is a better test of fit than a feature checklist.

If the approach resonates, **star the public repository, try the release, and contribute a focused improvement through the project's official channels**—a reproducible bug report, a clearer guide, a reusable package, or a carefully scoped contribution.

AI has made producing code easier. The next advantage is making that code belong to a system worth maintaining.

**Keep the horsepower. Add the reins. Build the application—not the foundation again.**
