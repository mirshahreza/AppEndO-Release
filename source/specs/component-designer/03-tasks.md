# Implementation Tasks — Component Designer (historical; execution plan p-46 removed 2026-09-15)

---

## Metadata

| Field | Value |
| --- | --- |
| **Feature slug** | `component-designer` |
| **Spec reference** | `specs/component-designer/01-spec.md` |
| **Plan reference** | `specs/component-designer/02-plan.md` |
| **Status** | `In Progress` |
| **Started** | 2026-07-06 |
| **Completed** | |

---

## Pre-Implementation (Phase A)

- [x] Read `.specify/memory/constitution.md`
- [x] Review standard layouts and guidelines in `AGENTS.md` and `docs/standards/component-designer.md`
- [x] Create feature specification (`01-spec.md`)
- [x] Create implementation plan (`02-plan.md`)
- [x] Create tasks checklist (`03-tasks.md`)
- [x] Verify baseline tests pass successfully

---

## Phase B: Shell & Layout Designer

- [ ] CD-B01: Shell layout designer workspace
  - Add entry point for shell drafts (mode or route).
  - Configure shell save and preview paths.
- [ ] CD-B02: Visual shell assignment in portals
  - Wire portal experience manifest `shellKey` selection UI.
  - Dynamically load the selected shell layout in preview hosts.
- [ ] CD-B07: One-click admin-like header preset
  - Implement top-nav preset in `shellChromeTemplates.ts`.
- [ ] CD-B03: Responsive sidebar drawer layout
  - Add mobile Drawer overlay toggle inside headers for small screen widths.
- [ ] CD-B04: Theme surface tokens picker
  - Create property panel selector for container background and styling presets.
- [ ] CD-B05: Flex direction / column counts per breakpoint
  - Adapt inspectors to support responsive Tailwind classes (e.g., md:grid-cols-3).

---

## Phase F: Media & Branding Assets

- [ ] CD-F01: Visual Asset Manager panel
  - Create file listing, upload, and deletion routes in `/api/component-designer/assets`.
  - Design file grid list interface.
- [ ] CD-F02: Logo asset upload
  - Bind logo selector to the asset manager output.
  - Save logos as `/assets/workspace/*` paths.

---

## Phase E: Menus & Navigation

- [ ] CD-E01: Navigation tree manager
  - Implement CRUD panel for portal menu lists.
- [ ] CD-E02: Add to menu dialog
  - Add a quick shortcut in the publish flow to insert the component route into a navigation manifest.

---

## Phase G: Versioning & Publish

- [ ] CD-G01: Publish version snapshots
  - Save immutable snapshots to `workspace/designer/snapshots/` upon publishing.
- [ ] CD-G06: Path-based routing enforcement
  - Exclude draft IDs from public route resolvers; enforce folder + name pattern.
