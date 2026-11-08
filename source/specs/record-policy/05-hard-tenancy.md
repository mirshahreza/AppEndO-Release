# Record Policy — Hard tenancy (RPE-11-6)

> **Status:** Frozen decision (document only — no platform implementation in this delivery)  
> **Plan:** [`docs/standards/record-policy.md`](../../docs/standards/record-policy.md)  
> **Related:** [`02-decisions.md`](./02-decisions.md) N1 · [`01-domain.md`](./01-domain.md)

## Decision

**AppEndO Record Policy remains logical row filtering** (compiler → parameterized WHERE on the shared Edge Data API / control-plane DB).

The platform does **not** ship, in RPE-11:

- schema-per-tenant
- database-per-tenant
- engine-native RLS as the product tenancy story

Customers who need hard isolation must use **separate deployments / separate databases** (ops), not a second tenancy engine inside Studio policies.

## Rationale

- Logical tenant Dimension + fail-closed policies already close the common SaaS multi-tenant IDOR class for Edge models.
- Hard tenancy multiplies ops, migrations, package install, and backup complexity without replacing Capability×Scope authoring.
- Mixing logical policies with half-implemented schema tenancy creates a false sense of isolation.

## Rejected for this delivery

| Option | Why deferred |
|--------|----------------|
| Automatic Postgres RLS policies generated from Record Policy | Dual enforcement paths; dialect lock-in; hard to explain |
| Schema-per-tenant switch in Studio | Out of RPE scope; needs product + ops plan |
| Hybrid “logical until X rows then hard” | Unstable security story |

## When to reopen

Only with an explicit PO initiative (new plan), covering: connection routing, migrations, package install, backups, and how Record Policy interacts with physical isolation. Until then, standards and marketing must say **logical multi-tenant**.
