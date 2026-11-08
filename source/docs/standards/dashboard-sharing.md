# Dashboard Sharing, Embedding &amp; Snapshots

> **Shard:** `dashboard-sharing` · **Reuses:** the exact platform-wide `FunctionAccessControl` shape (`src/shared/api/contracts/server-functions/accessControl.ts`) already used by Server Functions, Data API, MCP, Portals, route-binding — **and** by Workbooks sharing (`src/shared/api/contracts/workbooks/access.ts`), which this shard mirrors field-for-field.
> **Plan:** [`plans/core/todo/dashboard-canvas/p-117-dashboard-sharing.md`](../../plans/core/todo/dashboard-canvas/p-117-dashboard-sharing.md)
> **The second deliberate exception:** like [`dashboard-widget-comments.md`](./dashboard-widget-comments.md), sharing config and snapshots genuinely need small persisted state — a `(pageId)`-scoped access setting is not URL/session-ephemeral like everything in `personalizable-dashboard-canvas.md`, and a snapshot is by definition a frozen, persisted copy.

Locked 2026-09-10. Implemented 2026-09-11. Independently sequenced — a page is fully usable with zero sharing configuration (default: normal Studio/route permission only, exactly today's behavior).

## Intent

Every product benchmarked has some form of this (Metabase public links + signed embedding, Superset guest-token embedding with RLS, Grafana snapshots, Lightdash). AppEndO already solved the identical problem for Workbooks — **reuse that exact solution, not a new one**:

```
base_workbooks precedent (already shipped):
  accessControl: FunctionAccessControl { accessMode: 'specific' | 'authenticated' | 'public', allowRoles, allowUsers, denyRoles, denyUsers }
  accessPermission: 'view' | 'edit'
  → 'public' accessMode alone is the "anyone with this link, no login" mode — no separate token table, no Regenerate action.
  → Revoking = flipping accessMode back to 'specific'.

Dashboard Canvas (this shard):
  Same accessControl shape, scoped per (pageId) instead of per-workbook-row.
  Same permission split, renamed to this domain's verbs: 'view' | 'personalize'.
  Embedding = the same public/authenticated URL, rendered in a chrome-stripped display mode inside an <iframe>.
  Snapshot = a NEW, distinct capability: freeze the current PivotResult(s) into a persisted, expiring copy — for when a live, ever-changing link is not what the sharer wants.
```

## MUST

- Store one `FunctionAccessControl` + one permission value per dashboard page in a new, small table `base_dashboard_page_access` (`pageId`, `accessControl` JSON, `accessPermission: 'view' | 'personalize'`, `ownerUserId`, audit columns) — a Designer page has no such column today, and this is deliberately a Core platform table (`base_` prefix), not page-content itself.
- Default (no row present) = today's behavior exactly: whatever Studio/route-level permission already governs the page, no `public`/`authenticated` override. Sharing is opt-in per page.
- Reuse `canAccessManagedFunction`/`normalizeFunctionAccessControl` (the same functions Workbooks calls) for the access check — do not write a second ACL evaluator.
- Map the two permission levels precisely: `'view'` = render the developer's default layout, filters usable, **no** Add Widget / personalization write; `'personalize'` = everything a normal logged-in viewer can already do per `personalizable-dashboard-canvas.md` (their own personalization state still applies, keyed by their own `userId` if authenticated — `accessMode: 'public'` visitors have no `userId`, so their personalization is browser-local only, never written server-side).
- Gate sharing-config changes to the page's **owner** (the Designer page's registered owner, or whoever Studio already treats as able to publish it) — exactly Workbooks' "only Owner manages sharing" rule.
- For embedding: expose a page-level `embedAllowedOrigins?: string[]` field (also on `base_dashboard_page_access`) — when set, the response sends `Content-Security-Policy: frame-ancestors <origins>` instead of the default deny; when unset, embedding is blocked by default (same "opt-in, not opt-out" posture as `public` access itself).
- For snapshots: a new `data.pivot-snapshot-save` capability (reusing the exact render pipeline `pivot-threshold-alerts.md`'s `data.pivot-snapshot-delivery` and `personalizable-dashboard-canvas.md`'s on-demand Export already share) that freezes the current rendered output into `base_dashboard_snapshots` (`id`, `pageId`, `renderedPayload` — the frozen `PivotResult`s or a rendered image reference, `createdBy`, `createdAt`, `expiresAt` nullable) behind its own `accessMode: 'public'`-only access (a snapshot is inherently meant for outside sharing, never `specific`/`authenticated`-gated the way the live page can be).
- Rate-limit the no-auth `public` access path (page and snapshot both) — the exact same operational precaution Workbooks' own public `access/open` route already needed.

## NEVER

- Invent a second access-control shape, a regeneratable token, or a "Regenerate link" action — `accessMode: 'public'` on the stable page/snapshot URL is the entire mechanism, matching Workbooks' final (simplified) design exactly.
- Let `accessMode: 'public'` or `'authenticated'` bypass the page's own domain whitelist — a shared/embedded/snapshotted view still only ever shows data from the page's already-declared domain, same as any other viewer.
- Let a `public`-mode visitor's personalization (widget hide/reorder/add) persist server-side — they have no `userId` to key it by; personalization for anonymous visitors is browser-local (`localStorage`) at most, never written to the `(userId, pageId)` store.
- Let embedding work without an explicit `embedAllowedOrigins` allowlist — no wildcard-frame-ancestors default.
- Build a full "Public Gallery" / cross-org discovery surface for shared dashboards — this is direct-link sharing only, like Workbooks, not a marketplace.
- Let a snapshot silently go stale-but-look-live — it is visually/structurally understood as a frozen artifact (a "Snapshot taken at {date}" banner), never rendered identically to the live page without that distinction.

## Tokens / files (when implemented)

- Table: `base_dashboard_page_access` (Core), mirroring `base_workbooks`' `accessControl`/`accessPermission` columns.
- Table: `base_dashboard_snapshots` (Core) — frozen render + expiry.
- Reuse: `src/shared/api/contracts/server-functions/accessControl.ts` (`FunctionAccessControl`, `normalizeFunctionAccessControl`, `canAccessManagedFunction`) — same functions Workbooks imports, not a fork.
- UI: a "Share" dialog reusing `src/features/workbooks/components/WorkbookSharePanel.tsx`'s pattern (same three-mode picker, same "Owner only" gating) adapted to this shard's `view`/`personalize` permission pair.
- Embed render mode: `?dc_embed=1` (and `dc_page={pageId}` when the path is not the designer editor) on the **existing** page route suppresses Studio shell/nav chrome — no new page/route type. When `embedAllowedOrigins` is set, the HTML response sends `Content-Security-Policy: frame-ancestors 'self' <origins>` and drops `X-Frame-Options`; when unset, the default SAMEORIGIN deny stays.
- Snapshot render: public viewer `/shared/dashboard-snapshots/:id` (plus culture-prefixed `/:cultureId/shared/dashboard-snapshots/:id`) shows a "Snapshot taken at {date}" banner over frozen `PivotResult`s — reuses the render module `pivot-threshold-alerts.md`'s `data.pivot-snapshot-delivery` and the Export feature already share.

## IDs

`dashboard-sharing.reuses-function-access-control`, `dashboard-sharing.no-separate-token-table`, `dashboard-sharing.owner-only-manages-sharing`, `dashboard-sharing.domain-whitelist-still-applies`, `dashboard-sharing.anonymous-personalization-is-local-only`, `dashboard-sharing.embed-requires-explicit-allowlist`, `dashboard-sharing.snapshot-is-visibly-frozen`
