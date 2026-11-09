# Hawiety member-directory face caption (avatar code line)

> **Shard:** `package-hawiety-member-face-caption`  
> **Audience:** AI agents and engineers touching Hawiety member lists, dossier rail, or list APIs.

## Operator-visible rule (locked)

Under the **member avatar** on directory grids and the shared list face card:

| Condition | Text | Color (semantic) |
|-----------|------|------------------|
| Allocated membership username (exactly **six digits**, not member id / `m{id}` / `hwy-m-{id}`) | That username | Blue (`text-sky-600`) |
| Otherwise | **Tracking code**, else member id | Red (`text-rose-600`) |

**Applicant / queue lists** (`HWY_Members_List_Waited_*`, `Marfoozeh_*`, pending-local institute scopes): **tracking only** — never blue username. Business rule: allocated username means the person is not on those queues.

## Single UI surface (do not fork)

| Layer | Use |
|-------|-----|
| Avatar + code only | `HwyMemberAvatarWithMembershipCode` (`src/shared/ui/hwy/`) |
| Member-directory column 1 (avatar + name + meta) | `HwyMemberDirectoryListFaceCard` |
| Designer grid cell | `HwyMemberDirectoryGridFaceCell` → above |
| Identity components catalog | Short reference codes `hi.{section}.{variant}` (e.g. `hi.mdf.reg`) on `/hawiety/identity-components` |

**Resolve caption** with `resolveHwyMemberDirectoryListFaceCaptionForScope(row, listScopeLegacy, fields)` on every member-directory list. Do **not** use `resolveHwyMemberFaceCaptionFromIdentity` for list rows (misses enrich fields; bypasses queue mode).

## Single server pipeline (do not fork)

All `GET /api/hwy/member-directory` list rows MUST pass through `applyHwyMemberDirectoryListFaceCaptionUsernames(rows, { listScopeLegacy })` **after** enrichments and identity masks (`executeHwyMemberDirectoryList`).

- Registered / active scopes: legacy + CP username attach, then normalize allocated six-digit on `username`.
- Tracking-only scopes: clear username fields; attach legacy **TrackingCode** only (`attachLegacyTrackingCodesToMemberDirectoryRows`).

List fetch MUST project `userId`, `username`, `trackingCode` (`HWY_MEMBER_DIRECTORY_LIST_FACE_CAPTION_ROW_FIELDS`).

Response cache generation: `HWY_MEMBER_DIRECTORY_LIST_BUILTIN_CACHE_GENERATION` in `ensureHwyMemberDirectoryListRuntime.ts` — bump when row shape or pipeline changes.

## Scope mode (canonical)

`resolveHwyMemberDirectoryListFaceCaptionMode(listScopeLegacy)` in `hwyMemberDirectoryListFaceCaptionMode.ts`:

- `membership_username` — montadhemin, all people, institutes, image-fix (active members), quick search, etc.
- `tracking_only` — non-active `membership_status`, `pending_local_institute`.

## Regression lock (CI)

Run:

```bash
npm run test:hwy-member-face-caption
```

Contract tests (do not delete or weaken without operator approval):

- `hwyMemberFaceCaptionListContract.test.ts`
- `hwyMemberDirectoryListFaceCaptionMode.test.ts`
- `hwyMemberDossierProfileRailFaceCaption.test.ts`
- `hwyMemberDirectoryFaceCaptionLock.test.ts`

Public import barrel for agents: `src/domain/hwy/hwyMemberDirectoryFaceCaptionContract.ts`.

## Change process

1. Operator explicitly approves a **policy** change (not a bugfix restoring this shard).
2. Update this shard, `projectStandards.ts` id `package.hawiety.member-face-caption`, contract tests, and bump `HWY_MEMBER_DIRECTORY_FACE_CAPTION_CONTRACT_VERSION` + list cache generation if API shape changes.
