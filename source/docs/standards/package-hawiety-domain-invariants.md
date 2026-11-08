# Hawiety domain invariants

> **Shard:** `package-hawiety-domain-invariants`  
> **Audience:** AI agents and developers changing Hawiety membership, geo, or access.

## Operator mirror

Arabic prose for operators lives in Studio **Identity business rules** (`pageKey: hwy-business-rules-reference`), section `electoral-tree-role-anchor`. Sync contract: [`specs/hwy-business-rules-reference/01-scope-contract.md`](../../specs/hwy-business-rules-reference/01-scope-contract.md).

## Electoral tree (reference)

Studio chain (see [`package-hawiety-ui-vocab.md`](./package-hawiety-ui-vocab.md)):

**province** → **ghavateh** (optional) → **circle** → **maktab** → **region**.

Each node has a `legacy_kind` / `geo_level` and identifiers (`legacy_geo_id`, `geo_base_info_id`).

## Multiple roles per person (allowed)

One **member** (natural person) **MAY** hold **multiple** Hawiety operational roles at the same time (different `role_name` values, slots, or capability bundles). This invariant does **not** limit role count — it limits **electoral-tree anchoring**.

## Invariant — single electoral anchor per person (locked)

Any person who **holds one or more** Hawiety operational roles scoped to the electoral division tree (geo-responsibility officials, area limits derived from approved geo nominations, and equivalent legacy `HWY_Members_AreaLimits` semantics) **MUST** share **one** electoral anchor for all such roles:

1. **Exactly one level** on the tree (`geo_level`: `province` | `ghavateh` | `circle` | `maktab` | `region`).
2. **Exactly one node** on that level (`legacy_geo_id` + matching `geo_base_info_id`).

They **MUST NOT** simultaneously hold two approved anchors on different levels or different nodes (even when they hold multiple roles). Additional roles **MUST** attach to the **same** level and node — not a second branch of the tree. Changing place of responsibility **MUST** go through nomination / removal / transfer workflows — not by adding a second anchor.

### Out of scope for this invariant

- **Plain membership** without an electoral-tree role (applicant, institute member, list-only scopes).
- **Nakhebin electoral join** on the member dossier (`nakheb_join_eghtera_id` / region link): membership geography for the voter, not a substitute for official role anchoring.
- **Institute org roles** (`hwy_member_institutes`, org transfer): institute dimension, not the `HWY_H_*` electoral tree — unless product explicitly maps an institute role to a geo anchor (then this invariant still applies to that geo binding).

### Enforcement expectation

- **Writes:** `dbo.hwy_geo_responsibility_*`, `hwy_member_area_limits`, and `base_scope_memberships` (geo dimension) **MUST** reject or replace a second anchor when implementing or extending role assignment — never silently accumulate multiple approved nodes for the same member and role family.
- **Reads / UI:** Lists may show **electoral join mismatch** when responsibility geo disagrees with nakhebin join; that badge is informational today — it is not a substitute for enforcing single-anchor writes.
- **Drift:** If code or ETL allows multiple `hwy_member_area_limits` rows for one member, treat that as a **bug against this invariant**, not an accepted state. Document current gaps in the business-rules section `role-electoral-enforcement-gap` until fixed.

## Agent checklist

When touching geo responsibility, area limits, official access, or role scope:

1. Load this shard and business-rules section `electoral-tree-role-anchor`.
2. Allow **multiple roles** per member; preserve **one level + one node** electoral anchor per member.
3. Update business-rules seed (`npm run hwy:business-rules:seed` or `npm run hwy:business-rules:portal`) and this shard if behavior changes. Related operator sections: `member-list-legacy-filters`, `employees-list`.

## Index

- [`docs/standards/INDEX.md`](INDEX.md) · `projectStandards.ts` id `package.hawiety.domain-invariants`.
