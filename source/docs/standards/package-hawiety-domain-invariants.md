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

One **member** (natural person) **MAY** hold **multiple** Hawiety operational roles at the same time (different `role_name` values, slots, or capability bundles). This contract does **not** limit role count.

## Two geo assignment paths (locked)

Electoral-tree geo binding uses **two** product paths. Both require **one geo_level** at a time for a member’s approved anchors — **MUST NOT** span multiple levels simultaneously.

### 1 — Process path (geo responsibility / specific official roles)

Nomination and approval via **geo responsibility** (`hwy_geo_responsibility_*`, Studio workflows). For roles on this path: **exactly one node** (`legacy_geo_id` / `geo_base_info_id`) per member for that assignment family. Moves use nomination / removal / transfer — not an additive second node on another branch.

### 2 — Direct path (employees list and legacy-style direct assignment)

**Employees list** role + region assignment (and equivalent legacy direct writes) **MAY** assign **multiple approved nodes on the same geo_level** for one member (several `item_id` values, one `legacy_kind`). This is **expected**; it is **not** data drift. The UI and `hwy_member_area_limits` rows may therefore show more than one approved row per member when every row maps to the **same** level.

### Cross-level rule (drift)

A member **MUST NOT** hold two or more **approved** anchors on **different** geo levels at the same time (e.g. province + circle). That state is **drift** against this contract — block on new writes when extending geo/role assignment, and use probes / repair only for **cross-level** cases (not same-level multi-node).

### Out of scope

- **Plain membership** without an electoral-tree role (applicant, institute member, list-only scopes).
- **Nakhebin electoral join** on the member dossier (`nakheb_join_eghtera_id` / region link): membership geography for the voter, not a substitute for official role anchoring.
- **Institute org roles** (`hwy_member_institutes`, org transfer): institute dimension, not the `HWY_H_*` electoral tree — unless product explicitly maps an institute role to a geo anchor (then the cross-level rule still applies).

### Enforcement expectation

- **Writes:** Process-path flows keep **one-node** semantics. Direct-path flows allow **same-level** multi-node. All paths **MUST** reject or replace a **second level** (cross-level anchor), not same-level extra nodes on the direct path.
- **Reads / UI:** Lists may show **electoral join mismatch** when responsibility geo disagrees with nakhebin join; that badge is informational — not a substitute for cross-level enforcement.
- **Probes:** `npm run schema:area-limits-invariant` reports same-level multi-node counts for visibility; **failure** is **cross-level** approved anchors only (`members_multi_distinct_level`). No ETL collapse for same-level multi-node (operator closed — schema ownership B11).
- **ETL:** `hwy:etl:legacy-edge-parity` and `hwy:etl:geo-responsibility-nominations` **do not import** approved legacy rows for members with cross-level drift (`hwyMemberAreaLimitsCrossLevelEtl`). Purge existing edge drift: `npm run hwy:etl:purge-cross-level-area-limits`.

## Agent checklist

When touching geo responsibility, area limits, official access, or role scope:

1. Load this shard and business-rules section `electoral-tree-role-anchor`.
2. Allow **multiple roles** per member; distinguish **process** (one node) vs **direct** (multi-node, same level).
3. Update business-rules seed (`npm run hwy:business-rules:seed` or `npm run hwy:business-rules:portal`) and this shard if behavior changes. Related operator sections: `member-list-legacy-filters`, `employees-list`.

## Index

- [`docs/standards/INDEX.md`](INDEX.md) · `projectStandards.ts` id `package.hawiety.domain-invariants`.
