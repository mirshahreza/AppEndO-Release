# Identity profile — Individual vs Company

> **Shard:** `identity-profile` · **Tables:** [`data-model.md`](./data-model.md)

## Intent

Anyone who authenticates is `base_users` + `base_user_profiles` (1:1). Packages extend with optional 1:1 tables on `user_id`. They do **not** duplicate name/email/phone on a parallel contact/party row.

## MUST

| Layer | Table | Role |
|-------|-------|------|
| Auth | `base_users` | username, email, mobile, roles, password |
| Profile | `base_user_profiles` | person vs company fields |
| Domain extension | e.g. `crm_customer` | package-only fields, `user_id` FK |

`person_type_code` (Base Info `100.2`): `100.2.1` Individual · `100.2.2` Company.

1. **Chosen at create** — two create actions (Add Individual / Add Company). No generic create that asks for type later.
2. **Locked after create** — PATCH that changes type → `400`. Wrong type → new user, not conversion.
3. **One profile table** — visibility/validation differs; schema does not fork. Helper: `isProfileFieldVisibleForPersonType` in `src/shared/profile/personType.ts`.

| Individual | Company | Shared |
|------------|---------|--------|
| `firstname`, `lastname`, `fathername`, `grandfathername`, `gender_code`, `birth_*`, `national_code` | `company_name`, `registration_number`, `website`, optional `national_code` | `phone`, `nickname`, `profile_image`, `person_type_code` (read-only after create) |

`organization_user_id` on the profile links an Individual to their employer **user**. Packages read it; they do not add a parallel `organization_id`.

## NEVER

- A package-level `parties` / `contacts` directory as primary identity for login-capable people.
- A second حقیقی/حقوقی vocabulary beside `person_type_code`.
- Per-package copies of the conditional profile form.

CRM rebuild uses `crm_customers` + `customer_user_id` — not `crm_parties`. Plan: `plans/packages/todo/crm-package/`.
