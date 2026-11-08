<div dir="rtl" lang="fa" class="hwy-parity-doc">
<style>
  .hwy-parity-doc { text-align: right; unicode-bidi: plaintext; }
  .hwy-parity-doc h1, .hwy-parity-doc h2, .hwy-parity-doc h3, .hwy-parity-doc h4, .hwy-parity-doc p, .hwy-parity-doc li { text-align: right; }
  .hwy-parity-doc table { direction: rtl; text-align: right; width: 100%; border-collapse: collapse; margin: 0.75rem 0; }
  .hwy-parity-doc th, .hwy-parity-doc td { border: 1px solid #c4c4c4; padding: 0.35rem 0.5rem; vertical-align: top; text-align: right; }
  .hwy-parity-doc th { background: #f6f6f6; font-weight: 600; }
  .hwy-parity-doc blockquote { text-align: right; border-right: 3px solid #ccc; border-left: none; padding-right: 1rem; margin-right: 0; }
  .hwy-parity-doc ul, .hwy-parity-doc ol { padding-right: 1.25rem; padding-left: 0; }
  .hwy-parity-doc pre, .hwy-parity-doc code { direction: ltr; text-align: left; unicode-bidi: embed; }
</style>

<p><strong>خلاصه برای operatore:</strong> این سند جزو <strong>plans</strong> است (p-appearance-shell-preferences). ستون وضعیت در <a href="./p-00-todo-index.md">index مربوطه</a> مرجع «شروع شده / design / تمام» است.</p>
<p><strong>راهنمای خواندن:</strong> بخش‌های انگلیسی برای agent/dev هستند؛ جداول وضعیت و یادداشت‌های فارسی را اول بخوانید.</p>


# Appearance & shell preferences (implementation plan)

**Status:** Approved for implementation · **Decisions doc:** `docs/analysis/theme-options-catalog-review-fa.md`

## Product model

- **Portal defaults:** Admin sets Appearance like any user → effective for users without personal override (per mount/portal).
- **User override:** Same Appearance page; persisted USER settings after login.
- **Admin-only:** Sidebar collapse policy (`rail` | `hidden`), allow user override; not shown to normal users.

## Phase 1a

- [x] Schema: portal appearance defaults + user `shell_experience` shape
- [x] Seed `shell_experience` builtin USER attribute (`controlPlaneSeed` + `database.ts`)
- [x] Portal default storage (`appearancePortalDefaults` platform blob)
- [x] Appearance workspace: rename labels; admin «Portal defaults» section
- [x] Move `AccentColorPicker` from `ProfileShellChromeMenu`
- [x] Runtime merge effective sidebar state (C1, C3, C8)

## Phase 1b

- [x] Load/sync after auth (`UserShellExperienceBridge` + react-query session)
- [x] localStorage cache reconcile (sidebar + nav groups)
- [x] `navExpandedGroups` in `shell_experience` persist
- [x] Layout width wired to `ShellLayoutWidthContext` + server persist on toggle
- [x] Nav/culture labels Appearance; `ui-design-system.md` + `projectStandards.ts`

## Explicitly out

- Dark/light/auto shell, unfoldable rail, RTL toggle in Appearance, sidebar width 253/81 changes

## Standards follow-up (post-code)

- [x] Update `ui-design-system.md` § Theme Designer scope (portal defaults + user override)
- [x] `projectStandards.ts` id `ui.theme-designer.user-scope`

## Follow-up (optional polish)

- [x] Route tests `appearance.routes.test.ts`
- [x] `DesignerPublishedShell` loads appearance session (experience portals)
- [x] Hidden-sidebar UX: desktop header menu when fully hidden; hide in-aside collapse toggle when width 0
- [ ] Existing DBs: restart server once so `seedSettingsAttributes` upserts `shell_experience`
- [x] Nav/culture **Appearance** (`us`/`iq`/`ir` packs + route-binding 39 + registry sync)


</div>
