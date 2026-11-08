# CRM Phase 3 scaffold

> **۲۰۲۶-۰۸-۳۰:** خروجی نصب‌شدهٔ فاز ۳ (و ۱–۲) از workspace رولبک شد. این اسکریپت‌ها برای نصب دوباره باقی‌اند.

Opt-in installer for CRM Studio UI. Sub-phases (each its own install step —
never combined into one script; see `plans/packages/todo/crm-package/p-packages-crm.md`):

| Sub-phase | Script / scope | Status |
|-----------|----------------|--------|
| **3a** | Nav group `CRM` + Settings + 4 vocab pages | ✅ done |
| **3b** | Customers list + deep editor (golden reference for 3c/3d) | ✅ done |
| **3c-pre** | Shared `UiKanbanBoard` rich-card completion (platform, not CRM-only) | ✅ done |
| **3c** | Opportunities (Kanban + grid + editor) | ✅ done |
| **3d** | Tickets inbox + chat editor | ✅ done |

## Commands

```bash
npm run crm:phase3            # install 3a
npm run crm:phase3:rollback
npm run crm:phase3:live       # 3a: registry + route render + full vocab CRUD (after install)
npm run crm:phase3b           # install 3b (Customers)
npm run crm:phase3b:rollback
npm run crm:phase3c           # install 3c (Opportunities)
npm run crm:phase3c:rollback
npm run crm:phase3d           # install 3d (Tickets)
npm run crm:phase3d:rollback
npm run crm:phase2:smoke      # Phase 2 HTTP API acceptance (dev server on :3000)
npm run crm:verify-final      # Phase 3 named live-verify: every route + Tags/Assign/Reply
```

Requires Phase 1–2 installed (`crm:phase1`, `crm:phase2`).

## Contracts

- Plan: [`plans/packages/todo/crm-package/`](../../plans/packages/todo/crm-package/p-packages-crm.md) — v2, `crm_customers` (not `crm_parties`)
- UI: [`docs/standards/package-ui.md`](../../docs/standards/package-ui.md)
- Vocab: [`docs/standards/package-base-info-vocab.md`](../../docs/standards/package-base-info-vocab.md)

## Phase 3a deliverables (done)

- Studio group **CRM** (`nav.group.crm`) — Settings only for now; Customers/Opportunities/Tickets
  each add their own nav item when their own sub-phase ships (`buildCrmStudioNavGroup` takes an
  ordered `CrmStudioNavPage[]` precisely so later phases can append without re-deriving 3a's item).
- Culture keys already present in `src/core/culture/translations/baseEn.ts` (+ `us`/`ir`/`iq`
  culture-pack bundles): `nav.group.crm`, `nav.crm-settings`. `nav.crm-customers` /
  `nav.crm-opportunities` / `nav.crm-tickets` are registered too, ready for 3b/3c/3d to use.
- Settings left rail: Lead Sources · Ticket Priority · Ticket Channel · Customer Tags
  (`form.base-info-record`) — routes `crm/settings/lead-sources` etc.
- `loaderKind: designer` only — no `core:Crm` / `src/features/crm` / Auto-CRUD / portal.
- Live-verified: `npm run crm:phase3:live` checks nav registry, all 5 route bindings, that each
  route renders 200, and does a full create/list/update/delete cycle against `/api/base-info`
  for each of the 4 vocab categories (the exact API the `form.base-info-record` bridge uses).

## Closed enums (no vocab pages)

Lifecycle Stages · Pipeline Stages · Activity Types · Ticket Status — seed-only (Phase 1).
`person_type_code` is platform-owned (Base Info `100.2`), not part of the CRM root at all.

## Phase 3b deliverables (done)

- Customers list (`scripts/crm-phase3/crmCustomersScaffold.ts`): search (cross-table, via the
  `customers-list` domain action added to Phase 2 — DATA_API's generic search can't reach joined
  `base_users`/`base_user_profiles` columns) + Add Individual / Add Company / Merge action row +
  grid (name link, lifecycle status badge, source, email, phone, owner, updated).
- Customers editor (`crm/customers/edit/*`): action bar (Back · identity · Archive · Save) · main
  Profile + CRM note FormSections · rail Identity/Ownership/Audit trail/Tags/Related (count
  summaries), all live-verified end to end including the two-step create chain.
- **Documented simplifications** (see file header comment): toolbar has search only (Lifecycle/
  Source/Owner/"My customers" filters deferred); Add Individual/Company/Merge sit in a thin action
  row above the grid rather than the grid's single-slot `create` button; "Person type" column
  omitted from the list grid (visible in the editor rail); Merge uses a two-text-field modal, not
  grid-selection-driven.
- **Two real bugs found and fixed by reading the generated `.tsx` and live-testing, not just
  reviewing scaffold code**:
  1. A standalone create-modal `DataSourceDefinition` whose `primaryKey` matches one of its own
     submitted fields (`survivorUserId` on the Merge modal) gets that value appended onto the
     mutation URL by codegen (`update-by-id` convention) — turns `POST …/merge` into
     `POST …/merge/{id}`. Fixed by setting `primaryKey: 'id'` (a field that field is never
     submitted) on body-only create data sources.
  2. `POST /api/users`'s singular `role` field defaults to `DEVELOPER` when absent and is
     **always** merged into `roles[]`, not replaced by it — every "Add Individual/Company" would
     have silently granted `DEVELOPER` alongside `CUSTOMER`. Fixed by sending an explicit hidden
     `role: ''` field. See `p-packages-crm.md` §شکل API for the full writeup (useful for any other
     Designer form that posts to `/api/users`).

## Phase 3c-pre deliverables (done)

- `UiKanbanCard` extended: `badges?`, `avatar?`, `meta?`, `accent?`; `UiKanbanBoardProps` got
  `coloredColumns?` (default off — columns render neutral `slate` unless explicitly enabled).
- `DesignerRuntimeKanban.tsx` (`DesignerVizKanban`): full prop passthrough (`showCardCount`,
  `density`, `tone`, `columnWidth`, `columnLayout`, `showDescriptions`, `height`,
  `coloredColumns`) + a `revertSignal` prop that force-reverts the optimistic post-drop board to
  the resolved data, bypassing the `isBoardAheadOfResolved` heuristic that otherwise never
  reverts on Cancel (confirmed red-then-green: `src/domain/component-designer/__tests__/vizKanbanCancelRevert.test.tsx`).
- `DesignerKanbanCard` (`visualizationDataModel.ts`) synced with the same new fields.
- Old title/description-only cards keep rendering unchanged (all pre-existing Kanban tests stay
  green).

## Phase 3c deliverables (done)

- Opportunities list (`crm-opportunities`, route `crm/opportunities`): Kanban default view
  (`viz.kanban` grouped by `stageCode` via the generic `DesignerVizFieldMapping`, column order =
  live Pipeline Stages) + Board/Table toggle to a searchable/sortable grid + Create modal (with a
  hidden fixed `stageCode = New`).
- Opportunities editor (`crm/opportunities/edit/*`): action bar (Back · identity · Reopen · Save)
  · main Deal + Note FormSections · rail Identity/Audit/Stage-history-hint.
- Drag → drop fires `POST /api/crm/opportunities/:id/change-stage` directly (no confirm dialog —
  see file header in `crmOpportunitiesScaffold.ts` for why); `Reopen` already covers the undo
  case.
- **Two real bugs found and fixed via live-testing, not just review:**
  1. **Platform codegen bug** (`src/domain/component-designer/bindingCodegen.ts`,
     `renderValueEventHandlerLines`): any custom event binding with BOTH a `storeWritePath` AND
     `trueActions` containing an async action (`callMutation`/`refreshDataSource`/`exportData`/
     `triggerWorkflow`) generated a syntactically invalid component — `await` inside a
     non-`async React.useCallback`. This affects any future package wiring a custom event (not
     `onClick`/`onSubmit`, which already had the fix via a sibling code path) to an async
     action — not CRM-specific. Fixed with the same `void (async () => {...})()` wrapper the
     sibling path already used.
  2. Opportunity create posted `stageCode: null` (no hidden default field) — every new
     opportunity was invisible on the Kanban board (falls into an unmatched "default" column).
     Fixed by adding a hidden fixed field defaulting to the live-resolved Pipeline Stages "New" id.
- **Rich cards (customer avatar · amount badge · days-in-stage · close-date accent) are built but
  not wired to this board** — see the file header in `crmOpportunitiesScaffold.ts` for the exact
  platform gap (`DesignerVizFieldMapping`'s `kanban` variant has no badge/avatar/meta/accent
  mapping fields yet) and the already-built, tested `GET /api/crm/opportunities/board` endpoint
  ready for whenever that mapping extension lands.

## Phase 3d deliverables (done)

- Tickets inbox (`crm-tickets`, route `crm/tickets`): searchable/sortable grid (subject,
  customer, status badge, priority, channel, assigned-to, opened/closed).
- Ticket chat editor (`crm/tickets/edit/*`): rail (Identity · Assign · Dates · Audit trail) ·
  main message feed (chronological cards, newest-last) + reply bar.
- **Documented simplifications** (plan calls for more): no bulk actions row, no "My tickets"
  filter, no waiting-duration badge on the list — all deferred, same spirit as 3b's toolbar
  simplifications.
- **Serious platform bug found and fixed via live-testing, not just review — the most
  consequential one found across all of Phase 3:** the regionSubmit codegen/runtime method
  resolver (`resolveRegionDmlMethodExpression` in `bindingCodegen.ts`/`bindingRegionEngine.ts`,
  and its Preview-mode twin `resolveRegionDmlMethod` in `bindingMutationRuntime.ts`) **hardcoded
  `'PUT'`** as the "this is an edit, not a create" method, and resolved the submit URL's `:id`-
  style path param **only** from a value read off the region's own already-fetched detail record
  (keyed by the data source's declared `primaryKey`) — never from the region's `urlParams`
  (`routeParams.id`) the way the initial GET fetch does. Two independent failure modes fell out
  of this:
  1. Any data source whose real update endpoint is `PATCH` (not `PUT`) — e.g.
     `CUSTOMERS_DETAIL_DATA_SOURCE` in `crmCustomersScaffold.ts` — generated a hardcoded PUT
     request that the server never registered a route for. **This means the Customers editor's
     main Identity-edit Save button was very likely broken in the live browser this entire time**,
     despite 3b's README claiming "live-verified end to end" — that verification exercised the
     API directly (PATCH), never the actual rendered Save button, the same false-positive shape
     as the bugs below. Confirmed via a live probe: `curl -X PUT .../api/crm/customers/:userId`
     → `"API route not found."` (only PATCH is registered).
  2. Any data source with **no** `detail` operation at all (Tags in 3b, Assign/Reply here) never
     populated its region's fetched record, so the `:id`/`:userId` placeholder was never
     substituted — the generated code submitted to the **literal, unresolved** URL
     (`/api/crm/customers/:userId/tags`, colon and all). Direct-API tests against the real
     resolved URL passed, creating a false sense that these forms worked; they did not.
  - **Fix (platform, not CRM-specific):** `ResolvedRegionSubmitPlan` gained an `updateMethod`
    field sourced from `dataSource.operations.update.method`, threaded into both the codegen and
    Preview-runtime method resolvers (defaulting to `'PUT'` when unset, so no other package's
    behavior silently changes). `setDataSource`'s local `update` type was widened to allow
    `'POST'` too, for POST-only named actions deliberately reused as a region's "update" op.
  - **Fix (CRM):** `CUSTOMERS_TAGS_DATA_SOURCE`, `TICKETS_ASSIGN_DATA_SOURCE`,
    `TICKETS_REPLY_DATA_SOURCE` each got a real `detail` operation (reusing the existing customer/
    ticket detail GET) plus an explicit `primaryKey` and an `operations.update` entry pointing at
    the real action endpoint with its real method (`PUT` for Tags, `POST` for Assign/Reply).
    `CUSTOMERS_DETAIL_DATA_SOURCE` needed no CRM-side change — its already-correct `PATCH`
    declaration is now actually honored.
  - **Verification discipline that caught this:** reading the generated `.tsx` (not just calling
    the API directly) after every sub-phase, as established during 3c. Re-confirmed after the fix
    by re-grepping the regenerated `.tsx` for the exact `method`/`url` expressions, then
    `scripts/crm-phase3/verify-final-live.ts` (route renders + Tags/Assign/Reply against their
    now-correct URLs) and a full re-run of `smoke-crm-phase2.ts`.

## Post-3d UI bug sweep (done, found via user screenshot report — API-only verification had missed all three)

The API-level verification (`crm:verify-final`, `crm:phase2:smoke`) never exercises rendered
button clicks or grid cell display, so three real client-side bugs shipped silently until the
user actually opened the pages in a browser and reported: no visible customer/ticket/opportunity
names in list columns, the Opportunities Board/Table toggle showing both views at once, and
**none of the buttons doing anything** (Add Individual, Add Company, Merge duplicates, Create
opportunity, Toggle Board/Table). All three were scaffold mistakes (wrong or misplaced field
names), not platform bugs, found by reading the generated `.tsx`:

1. **Link-cell columns rendered blank.** `DesignerGridLinkCell` reads its label from
   `column.cellFields.labelField` and its href from `column.cellFields.hrefTemplate` — the
   scaffold set `hrefTemplate` as a top-level column prop instead (`{ key, hrefTemplate: '...' }`
   instead of `{ key, cellFields: { labelField: key, hrefTemplate: '...' } }`), which
   `set-node-prop`'s storage silently dropped before it ever reached codegen. Same shape for the
   Customers Lifecycle badge's `colorField`. Fixed the Name (Customers), Subject (Tickets), and
   Title (Opportunities) link columns, plus the Lifecycle status-badge color.
2. **Every "open a modal" button did nothing.** `resolveDynamicActions` only emits a `showHide`
   action when `action.targetNodeId` is set (it derives the store path itself via
   `visibilityStorePathForNode(action.targetNodeId)`) — the scaffold's `wireOpenModal`/
   `showHideToggle` helpers set a non-existent `.storePath` field instead, so the action was
   silently dropped and every onClick compiled to an empty function body. Affected Add
   Individual/Add Company/Merge duplicates (Customers) and Create opportunity (Opportunities).
   Fixed by setting `.targetNodeId`; the Opportunities Board/Table toggle (which flips a plain
   store flag, not a real node's visibility) now uses a `setValue` action with an
   `!store.<flag>` expression instead, since `showHide` only supports node-tied visibility.
3. **Board/Table toggle showed both views permanently.** `setVisibleCondition(host.state, ...)`
   was correctly computed but then immediately discarded by a leftover
   `state = host.state;` line running *after* it — a pure ordering bug, not a platform gap
   (`node.layout.visibleCondition` genuinely works end-to-end once actually stored; confirmed via
   the CMS package's own scaffold contract test).

Re-verified via the same discipline as every other fix this phase: re-read the regenerated
`.tsx` line by line for all three symptoms, re-ran `crm:verify-final` + `crm:phase2:smoke` (both
still green — these were pure client-rendering bugs, invisible to API-level testing), and a full
`vitest run src/domain/component-designer` (same 41 pre-existing, unrelated failures as before
this session — none of these are new). **Not independently re-verified by clicking in a real
browser** — no browser tool is available in this session; the user's next screenshot/click-test
is the remaining confirmation step.

## Post-3d UI bug sweep, round 2 (done, found via a second user screenshot report)

After the round-1 fixes, the user re-tested and reported the Customer Edit page's Profile
(First/Last name, Nickname, Company, Registration, Website), Identity rail (Person type,
Username, Email, Mobile), Owner, and Created/Updated-by fields all still rendering blank/`—`.

**Root cause:** `regionColumnToExpression` resolves a `bindValue`/`metaField` field argument as a
single flat JS property accessor — a dotted string like `'profile.firstname'` compiles to a
*literal* bracket-key lookup (`data?.["profile.firstname"]`), not nested traversal
(`data?.profile?.firstname`). The scaffold used dotted paths (`'profile.firstname'`,
`'user.username'`, `'owner.username'`, `'createdBy.username'`) assuming they'd match
`customersGet`'s raw Sequelize include tree (`{ user: {...}, profile: {...} }`) — but no field
in this platform's binding system is ever addressed that way; every other working binding in this
phase (Tags/list columns/lifecycle/source) already used flat keys.

Two-sided fix:
1. **Client** (`crmCustomersScaffold.ts`): every `profile.X`/`user.X`/`owner.username`/
   `createdBy.username`/`updatedBy.username` field reference switched to its flat equivalent
   (`firstname`, `username`, `ownerUsername`, `createdByUsername`, …).
2. **Server** (`crmDomainActionSources.ts`'s `customersGet`): rewritten to return the same flat,
   enriched shape `customersList` already used (it previously spread the raw `{...plain}` include
   tree) — now also includes `createdByUser`/`updatedByUser` associations and `tagCodes` (an
   array, feeding the Tags multi-select's pre-fill too).

While auditing for the same class of bug elsewhere, found a **third, related bug**: the
Opportunities and Tickets editors' Audit-trail rail referenced `createdByUserUsername`/
`updatedByUserUsername`, a field that never existed in either domain's DATA_API-projected
response at all (no typo — the enrichment itself was simply missing). Added
`crm_enrich_opp_created_by`/`_updated_by` and `crm_enrich_ticket_created_by`/`_updated_by`
(`userJoin`) to `crmApiProjection.ts` and corrected both scaffolds' field references to
`createdByUsername`/`updatedByUsername`.

Verified: live-curled all three detail endpoints to confirm the flat/enriched fields are
genuinely populated (not just present-but-null), re-read the regenerated `.tsx` to confirm the
editor's `regionData_*` bindings now reference the right keys, and re-ran `crm:verify-final` +
`crm:phase2:smoke` (both still green). **Still not confirmed by an actual browser click** — same
caveat as round 1.

## Final live-verify (done)

`npm run crm:verify-final` — all 8 Studio routes render 200 (customers/opportunities/tickets
lists + 4 settings vocab pages), a real customer + ticket editor route renders 200 with a live
id, and Tags/Assign/Reply are exercised against the exact URLs the fixed generated code now
constructs. See the plan's "Live-verify فاز ۳" row for the full acceptance text.

Each of the above gets its own `crm*Scaffold.ts` file (rebuilt fresh — the v1-era
`crmPartiesScaffold.ts` / `crmOpportunitiesScaffold.ts` / `crmTicketsScaffold.ts` /
`crmBaseInfoLovs.ts` were deleted 2026-08-29: they targeted the rolled-back `crm_parties` v1
schema and referenced designer APIs that had since changed shape) plus its own entry in a
per-sub-phase install script — not accreted into `install-crm-phase3.ts`, which now covers 3a only.

## Base Components (hard)

Every control from `/studio/base-components`. Opportunities board (3c) must use `viz.kanban` →
`UiKanbanBoard`. Ticket reply (3d) = `UiTextarea`. No raw HTML inputs.
