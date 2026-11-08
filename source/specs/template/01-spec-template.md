# Feature Specification

> **Instructions:** Copy this file to `specs/<feature-slug>/spec.md` and fill in every section before any implementation begins. An AI agent must not write application code until this document is reviewed and explicitly approved by the product owner.

---

## Metadata

| Field | Value |
| --- | --- |
| **Feature slug** | `<feature-slug>` |
| **Author** | |
| **Status** | `Draft` / `Approved` / `In Progress` / `Done` |
| **Created** | YYYY-MM-DD |
| **Last updated** | YYYY-MM-DD |
| **Constitution version** | 1.0.0 |

---

## Feature Goal

<!-- One paragraph: What are we building and what problem does it solve? Be specific about the user outcome, not the implementation. -->

### Problem Statement

<!-- What pain exists today? Who experiences it? -->

### Desired Outcome

<!-- What does "done" look like from the user's perspective? -->

### Success Criteria

<!-- Measurable, testable conditions. Example: "Admin can create a role and assign it to a user in under 3 clicks." -->

- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

### Out of Scope

<!-- Explicitly list what this feature will NOT include to prevent scope creep. -->

-

---

## User Stories

<!-- Use the standard "As a … I want … So that …" format. Include acceptance criteria per story. -->

### US-1: <Short title>

**As a** `<role>`  
**I want** `<capability>`  
**So that** `<benefit>`

**Acceptance Criteria:**

- [ ] AC-1.1: …
- [ ] AC-1.2: …

**Priority:** `Must Have` / `Should Have` / `Could Have`

---

### US-2: <Short title>

**As a** `<role>`  
**I want** `<capability>`  
**So that** `<benefit>`

**Acceptance Criteria:**

- [ ] AC-2.1: …
- [ ] AC-2.2: …

**Priority:** `Must Have` / `Should Have` / `Could Have`

---

## Business Logic

<!-- Domain rules, validations, state transitions, edge cases. This is the "brain" of the feature — independent of UI layout or SQL syntax. -->

### Entities & Relationships

<!-- List domain entities, their key fields, and how they relate. Example: "A Role has many Users through base_user_roles." -->

| Entity | Key Fields | Notes |
| --- | --- | --- |
| | | |

### Rules & Constraints

<!-- Numbered business rules. Example: "R1: Role names must be unique (case-insensitive)." -->

1. **R1:** …
2. **R2:** …
3. **R3:** …

### State Transitions

<!-- If the feature involves lifecycle states, document them. -->

```
<Initial State> → <Action> → <New State>
```

### Edge Cases & Error Scenarios

| Scenario | Expected Behavior |
| --- | --- |
| | |

### Permissions & Roles

<!-- Who can perform which actions? Map to existing roles (ADMIN, etc.) or define new ones. -->

| Action | Required Role(s) | Notes |
| --- | --- | --- |
| | | |

---

## UI/UX Notes (Optional)

<!-- High-level UX expectations. Detailed visual rules are governed by AGENTS.md — reference patterns, don't restate the full standard. -->

- Page type: `CRUD list` / `Tree` / `Workspace` / `Settings form` / `Other`
- Reference feature for visual parity: e.g. `Users`, `Roles`
- Modal vs. full-page editor: …

---

## Dependencies & Integrations

<!-- Other features, APIs, tables, or third-party services this feature touches. -->

| Dependency | Type | Notes |
| --- | --- | --- |
| | Existing feature / New table / External API | |

---

## Open Questions

<!-- Unresolved decisions. Implementation must not proceed on blocked items. -->

- [ ] Q1: …
- [ ] Q2: …

---

## Approval

| Role | Name | Date | Status |
| --- | --- | --- | --- |
| Product Owner | | | `Pending` / `Approved` |

**Agent instruction:** Do not proceed to `plan.md` or code until Status is `Approved`.
