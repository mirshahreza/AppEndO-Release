# UI audit — Fluent 2 alignment (color, typography, component reuse)

**This is an audit backlog, not a product standard.** Rules live in [`docs/standards/ui-design-system.md`](../standards/ui-design-system.md) and [`ui-core.md`](../standards/ui-core.md).

Living backlog for the interface-quality pass requested 2026-07. Base Components (`src/features/base-components/`) is where shared primitives are fixed first.

## 1. Design-token drift (highest leverage — fix here cascades everywhere)

Current palette (slate/indigo/violet/cyan/emerald/amber/rose, teal rare, HeroUI v3 base) is workable but **the same 7-tone semantic map is redeclared independently in 4 files** with slightly different shade choices for the same role:
- `src/shared/ui/surfaceClasses.ts` — `APP_SURFACE_BOX_TONE_CLASS`, `ICON_ACTION_*`, `GRID_ACTION_*`
- `src/shared/ui/buttonSemantics.ts` — `BUTTON_INTENT_CLASS`
- `src/shared/ui/surfaceChromeClasses.ts` — `SURFACE_CHROME_TONE`
- `src/features/settings/settingsSectionTypography.ts` — `TONE_*` maps

Changing one hue today means editing 4 files by hand; they will drift further without a single base map. **Backlog:** introduce one `toneHues.ts` base record (hue → border/bg/text/hover shade quad) that the other three import and specialize, instead of re-typing hex/Tailwind class literals per file.

Other concrete drift found:
- Three parallel button components coexist: `Button.tsx`, `AppButton.tsx`, `NativeButton.tsx`. Only `AppButton` + `buttonSemantics.ts` is documented as the standard — the other two are candidates for removal once call sites are confirmed migrated.
- `floatingPanelClasses.ts` is a `@deprecated` shim re-exporting `surfaceChromeClasses.ts` — dead weight per its own comments.
- Raw hex bypassing the theme layer entirely: `OrbitBorderFrame.tsx` (10+ literal hex in "rainbow/sunset/ocean" decorative presets — doesn't re-theme with `--app-accent-*`, and a saturated rotating-rainbow border is the opposite of Fluent's calm neutral-plus-one-accent philosophy); `src/shared/lib/schemaRelationEdgeStyles.ts` (`#8b5cf6`, `#0d9488`, `#6366f1` React-Flow SVG strokes, also accent-var-blind); one literal `!border-[#d7dee6]` in `surfaceClasses.ts` duplicating the `--color-border-field` CSS var instead of consuming it.
- Modeler relation-badge colors defined twice with diverging values: `modelerChipStyles.ts` vs `schemaRelationEdgeStyles.ts` (the latter has a third "both" = indigo state the former doesn't model).

## 2. Typography ramp — no single source, same role styled differently per surface

No global type-scale file; sizes are ad hoc Tailwind (`text-[10px]`, `text-[11px]`, `text-xs`, `text-sm`, rare `text-base`). Two independent ramps diverge for the **same semantic role**:
- Generic forms (`docs/standards/ui-core.md`): field label = `text-sm font-semibold`.
- Settings (`settingsSectionTypography.ts`, actual code): field label = `text-[11px] font-bold uppercase tracking-wider`.
- `MODELER_CAPTION_CLASS` = `text-[11px] font-normal` vs `APP_SURFACE_BOX_TITLE_CLASS` = `text-[10px] font-bold uppercase tracking-wider` — same "small label" tier, 10px vs 11px.

**Backlog:** publish one documented type ramp (Fluent-inspired tiers below) and have `heroFieldSize.ts`, `settingsSectionTypography.ts`, `surfaceClasses.ts` title/caption constants, and `modelerChipStyles.ts` all resolve from it instead of hand-picking px values per surface.

### Proposed ramp (Fluent 2 tiers mapped onto existing Tailwind scale)
| Fluent 2 tier | Fluent px/line-height | AppEndO role | AppEndO class (proposed canonical) |
|---|---|---|---|
| Caption 2 | 10/14 | dense meta / timestamps | `text-[10px] font-normal` |
| Caption 1 | 12/16 | section eyebrow / small label | `text-xs font-semibold uppercase tracking-wider` |
| Body 1 | 14/20 | field label / body default | `text-sm font-semibold` (label), `text-sm font-normal` (body) |
| Subtitle 2 | 16/22 | dialog/panel subsection title | `text-base font-semibold` |
| Title 3 | 20/26 | page/section title | `text-lg font-bold` |

Fluent 2's actual web base body size is 14px (not 16px) — matches this codebase's existing `text-sm` default well; no base-size migration needed, just convergence of the *label* tier which is currently split between `text-sm` and `text-[11px]`.

## 3. Radius / elevation

- `.rounded-sm/.rounded/.rounded-md/.rounded-lg/.rounded-xl/.rounded-2xl/.rounded-3xl` are globally remapped via `--app-radius-*` CSS vars in `src/index.css` — a hidden coupling: any literal Tailwind radius class is intercepted. Stray literals like `rounded-[6px]` in `formChoiceLayout.ts` bypass that remap entirely (renders a size the design system didn't intend).
- No shared elevation scale — `shadow-sm/md/lg/2xl/none` picked ad hoc per component; only 3 named custom shadows exist in `index.css`, barely reused.
- **Fluent 2 reference** (for target ramp shape, not literal values to copy): 4-step radius scale (Small/Medium/Large/XLarge, roughly 2/4/6/8px) and a 6-step shadow scale (shadow2 → shadow64, each a paired ambient+key-light box-shadow of increasing offset/blur). AppEndO's existing `--app-radius-*` remap already gives a small/compact feel consistent with Fluent's density — the gap is *literal bracket values bypassing it*, not the scale itself.

**Backlog:** grep-and-fix remaining `rounded-\[` / ad-hoc `shadow-` literals to use the existing token classes; define a named 4-step elevation set (`SHADOW_LOW/MEDIUM/HIGH/MODAL`) in `surfaceClasses.ts` so components stop picking `shadow-lg` vs `shadow-xl` by feel.

## 4. Native HTML bypassing the shared component library

Documented standard (`ui-core.md`) forbids raw `<input>`/`<textarea>`/`<select>`/native checkbox except `type="file"|"hidden"|"color"`. Grep across `src/features/**/*.tsx` (excluding `__tests__`, excluding documented exceptions) found a small, bounded set of real offenders — good news: the app is largely disciplined; these are the concrete exceptions:

| File | Issue |
|---|---|
| `src/features/workflows/components/NodeKindForm.tsx` | **Worst offender** — 6 raw `<select>` (join mode, ambiguity mode, delay type, work item type, mode, +1), 1 raw `<input type="checkbox">`, all form labels hand-styled `text-[11px] font-semibold text-slate-700` instead of `FormField`/`UiSelect`/`UiCheckbox` |
| `src/features/workflows/components/EdgeSelectorPopover.tsx` | raw `<select>` with hand-rolled `border-border-subtle` class |
| `src/features/workflows/components/DuplicateDialog.tsx` | raw `<input type="radio">` ×2 instead of `UiRadioGroup` |
| `src/features/work-items/components/WorkItemInboxPanel.tsx` | raw `<select>` `border-slate-300` |
| `src/features/component-designer/components/InspectorOptionItemsField.tsx` | raw `<select>` |
| `src/features/component-designer/components/DesignerPreviewFixturePicker.tsx` | raw `<select>` |
| `src/features/settings/components/webFonts/WebFontsSection.tsx` | raw `<input>` (verify type before fixing — may be legitimate file/color exception) |
| `src/features/settings/components/PwaIconField.tsx` | raw `<input>` (verify type) |
| `src/features/component-designer/components/InspectorVisualStylePanel.tsx` | raw `<input>` (verify type — likely `type="color"`, allowed exception) |
| `src/features/base-components/components/BaseComponentsSurfaceChromeFields.tsx` | raw `<input>` — should demonstrate real `UiInput` even for catalog-shell-only chrome controls |
| `src/features/component-designer/components/DesignerAssetManager.tsx`, `src/features/file-manager/components/FileManagerTreeNodeMenu.tsx`, `FileManagerZipEditorPanel.tsx`, `src/features/packages/components/PackageWorkspaceAssetsPickerDialog.tsx`, `src/features/platform-transfer/components/PlatformTransferPageView.tsx` | raw `<input>` — several likely legitimate `type="file"` (need per-file confirmation, not blind rewrite) |

All `__tests__/**` matches and `type="file"` on the `FeedbackSubmitDialog.tsx` upload button are correct exceptions per the documented standard — left untouched.

## 5. Semantic-color usage sampling (danger/warning borders)

`border-(red|rose)-\d{3}` appears in 87 non-test files. Sampling shows most are **legitimate** intentional danger/delete/warning accents (buttons, badges, banners) consistent with the documented semantic-color recipe — not automatically violations. The standard specifically forbids this pattern only for the **invalid-field border** role, which must route through `HEROUI_FIELD_INVALID_BORDER_CLASS` / `isInvalid`. **Backlog:** narrow this list to actual form-field invalid-state usages (vs. buttons/badges/banners, which are fine) before touching any of the 87 — do not bulk-replace.

## 6. Base Components catalog health

Spot-checked 5 core workspaces (dialog, grid, form-fields, toast, toolbar) plus 2 more (surface-box, sidebar-menu) — **all correctly import real shared primitives**, none reimplement markup. `baseComponentsVisualTokens.ts` intentionally mirrors (not duplicates-by-accident) `data-studio-modeler.md` chrome restraint for the catalog's own shell. Only nits: a couple of inline `text-rose-700`/`text-amber-700` literals in `grid`/`dialog` demo copy that should reference the shared danger/warning classes instead of repeating the literal. Not yet diffed against real components: `treegrid`, `wizard`, `icon-sets`, `html-editor`, `markdown-editor` catalog sections — follow-up pass. (`server-utilities` has since moved out to the standalone Developer Reference page — see p-74 log.)

## 7. Under-applied existing color tokens (perceived "flatness")

User feedback (2026-07-27, screenshot of Data Studio Modeler "CMS Contents" columns view): the Modeler feels noticeably more colorful/alive than Base Components and other pages, and asked why the app isn't consistently that vibrant everywhere. Investigation found this is **not** a separate, richer design system in Modeler — it is the same small-area-accent recipe (§ui-core.md "Semantic color") everywhere; Modeler *looks* richer for two reasons:

1. **Modeler group colors are operator-authored data**, not fixed chrome: `EdgeModelModelerColumnsSection.tsx`'s `ColumnGroupBucket` lets the person building that model pick a color per field-group via `NavigationTailwindColorPicker` (same picker used for nav icon colors), stored in `columnGroupColors`. A freshly-created model with no groups colored yet looks exactly as neutral as any other page — the screenshot is colorful because that specific CMS Contents model's author colored 5 groups.
2. **Real bug found and fixed:** `BaseComponentsNav.tsx` (then `SandboxNav.tsx`) already had a full per-section hue map (`baseComponentsSectionTheme.ts`, all 22 sections assigned a distinct tone) but only applied `theme.iconClass` when a nav item was the **active** route — every other (most) row forced a neutral icon class regardless of the theme map. `SettingsNav.tsx`'s equivalent icon component has no such gating, which is why Settings' rail already reads more colorful at rest. Fixed: nav icons now always render `theme.iconClass` (matches Settings' pattern); the now-dead neutral-icon token was removed. Verified with project typecheck (no new errors).
3. Searched for the same "active-only color, neutral-gray otherwise" anti-pattern elsewhere (`isActive ? …iconClass… : …neutral…`) — no other occurrences found; the other `*_NEUTRAL_ICON_CLASS` uses (Modeler field-chip icons) are intentional small-icon neutrality by design (group/category level gets color, individual field chips stay neutral), not the same bug.

**Direction going forward (user preference, overrides the more conservative "avoid rainbow pages" phrasing in §Semantic color/`ui-core.md`):** the user wants the app to feel warmer/more colorful, using Modeler's per-category small-area accent treatment as the reference bar, not the exception. This does not mean large color washes — it means: wherever a page has a fixed set of named sections/categories/groups (nav rails, section lists, group headers), give each one a consistent, always-visible (not just on-hover/active) icon or accent-bar hue, the way `baseComponentsSectionTheme.ts` and `settingsSectionSemantics.ts` already do — and audit remaining "flat" surfaces for the same missed opportunity rather than assuming neutral-by-default is safer. Backlog: sweep other section/nav lists (Data Studio object list, Component Designer outline tree, Workflow list panels, Git panel, Package list) for at-rest neutral icons where a semantic per-item hue would help wayfinding, and consider whether `ui-core.md`'s "one or two accent hues per view" line needs softening to reflect this.

## 8. Fluent 2 alignment — practical checklist

Reference: fluent2.microsoft.design (two-layer token model — global raw values, alias tokens carry semantic meaning; neutral/brand/shared/status palettes; `@fluentui/react-components` v9 token names).

- [ ] One base hue→shade map feeding all 4 tone-class files (§1).
- [ ] One documented type ramp; Settings/generic/modeler converge on it (§2).
- [ ] Fix stray `rounded-[…]` literals that bypass the `--app-radius-*` remap (§3).
- [ ] Name a 4-step elevation scale; stop picking `shadow-*` by feel (§3).
- [ ] Fix confirmed raw-HTML offenders in §4 to use shared `Ui*` components.
- [x] Base Components nav icons always show their per-section hue instead of only-when-active (§7).
- [ ] Sweep other nav/section lists for the same at-rest-neutral-icon gap (§7).
- [x] ~~Merge `APP_SURFACE_BOX_TONE_CLASS` / `SURFACE_CHROME_TONE` into one generator~~ — investigated 2026-07-27, **closed as not-a-bug**: their per-hue values are legitimately different by design (surface-box panels vs. draggable chrome windows get different opacity/gradient treatment on purpose), and hue-key completeness is already enforced by both importing the same `AppSurfaceBoxTone` union type (TypeScript errors if a hue is missing from either `Record`). Forcing a shared generator would either lose the intentional differences or require a template-string builder that breaks Tailwind's static class-name scanning (see `paletteHues.ts` header comment) — not worth the fragility for zero real duplication removed.
- [x] ~~Merge `settingsSectionTypography.ts` tone maps~~ — same verdict, same reasoning: each of its ~8 token shapes (page title, field label, group desc, toggle-active, checkbox card, grid primary/secondary/mono/badge, emphasis, stat line) intentionally varies shade/opacity per role, and the hue-key set is already type-enforced. Left as bespoke, hand-maintained tone tables — not a drift risk, just verbose.
- [ ] Narrow and fix true invalid-field ad-hoc borders inside the 87-file sample (§5) — do not bulk-edit.
- [ ] Diff remaining 5 Base Components workspaces for staleness (§6).
- [ ] Decide fate of `Button.tsx` / `NativeButton.tsx` (migrate-and-delete vs. keep) and `floatingPanelClasses.ts` deprecated shim.
- [ ] Reconsider `OrbitBorderFrame.tsx` rainbow presets against Fluent's restrained-accent philosophy (decorative feature — confirm intent before changing).

## Status log

- 2026-07-27 — Initial full-repo pass: token/typography drift mapped, catalog spot-checked clean, raw-HTML offenders enumerated (bounded list, not widespread), 87-file danger-border sample flagged for narrowing before edits. Fixes begin against this backlog next, catalog-first.
- 2026-07-27 — §4 native-HTML fixes applied and verified: `NodeKindForm.tsx` (6 raw `<select>` → `UiSelect`, 4 raw checkboxes → `UiCheckbox`), `EdgeSelectorPopover.tsx` (1 select), `DuplicateDialog.tsx` (2 raw radios → one `UiRadioGroup`), `WorkItemInboxPanel.tsx` (1 select), `InspectorOptionItemsField.tsx` + `DesignerPreviewFixturePicker.tsx` (1 select each). All remaining raw `<input>` hits in the original grep sample were confirmed legitimate documented exceptions (`type="file"` uploads in `WebFontsSection.tsx`, `PwaIconField.tsx`, `DesignerAssetManager.tsx`, `FileManagerTreeNodeMenu.tsx`, `FileManagerZipEditorPanel.tsx`, `PackageWorkspaceAssetsPickerDialog.tsx`, `PlatformTransferPageView.tsx`; `type="color"` in `BaseComponentsSurfaceChromeFields.tsx` paired correctly with a hex `UiInput`; `type="range"` slider in `InspectorVisualStylePanel.tsx` — no shared slider component exists yet to swap to, left as an accepted native-control exception). §4 checklist item is now **closed** for the sampled scope. Verified with `tsc --noEmit` (no errors touching any edited file — project-wide typecheck needs `--max-old-space-size`/`--stack-size` to complete on this machine, unrelated pre-existing errors elsewhere left untouched). Not yet visually smoke-tested in a running browser — recommend clicking through Workflow Designer node inspector (all 11 node kinds), the Duplicate workflow dialog, and the Work Item inbox outcome picker on next app run.
- Remaining backlog (§1 token consolidation, §2 typography ramp unification, §3 radius/elevation cleanup, §5 invalid-field border narrowing, §6 five unchecked Base Components workspaces, button/shim consolidation, `OrbitBorderFrame` decision) is unstarted — next pass should tackle §1 first since it is the highest-leverage, lowest-risk change (pure token consolidation, no visual change if done correctly).
- 2026-07-27 — **Authoritative spec published:** [`ui-design-system.md`](../standards/ui-design-system.md) — the definitive color (3-tier: Accent/Object-palette/Neutral-status)/typography/spacing/radius/elevation/iconography policy, supersedes older restraint phrasing in `ui-core.md` where they conflict (INDEX precedence updated). Written after re-grounding in Fluent 2's token model (global→alias tokens, neutral/brand/status palettes, 14px Body1 base type ramp) and reconciling it with the user's explicit direction: accent/theme color must stay reserved to ~5 roles (primary CTA, active nav, focus ring, brand mark, opt-in accent chrome) and never bleed into general object/category coloring — that's what Tier 2 (the existing 7-hue semantic palette) is for, and it must stay independent of whatever accent hex the operator picks.
- 2026-07-27 — §1 token consolidation, first real slice: created `src/shared/ui/paletteHues.ts` (`APP_OBJECT_PALETTE_HUES`, `SOFT_TONE_CLASS`/`SOLID_TONE_CLASS`/`ICON_TONE_CLASS` — static literal Records, not template-interpolated, so Tailwind's scanner still sees every class name). `buttonSemantics.ts`'s `BUTTON_INTENT_CLASS` now derives every intent from these (verified byte-identical output before switching, confirmed with project typecheck — zero new errors). `APP_SURFACE_BOX_TONE_CLASS` / `SURFACE_CHROME_TONE` / `settingsSectionTypography.ts`'s tone maps were **not** mechanically merged this pass — their shapes are less uniform (settings typography especially: per-tone grid/checkbox/badge variants with hand-tuned opacity), and forcing them into the shared builder without visual QA was judged too risky to do blind. They remain backlog. Also added a named elevation scale (`SHADOW_FLAT/RAISED/FLOATING/MODAL` in `surfaceClasses.ts`, barrel-exported) — additive only, nothing migrated to consume it yet.
- 2026-07-27 — Searched for more instances of the Base Components-nav "per-category hue map defined but suppressed to neutral except when active" bug across other nav/list components (`AppEndooPanel.tsx`, `FlatLinks.tsx`, scheduled-tasks picker, Base Components icon-sets, `NewLayoutDialog.tsx`) — none found; those are ordinary single-hue active/inactive states (correct as-is), not a suppressed multi-hue category map. The Base Components nav bug appears to have been the only occurrence of that specific pattern.
- 2026-07-27 — §1 accent-usage spot check: `AdminShellSidebar.tsx` (nav collapse toggle hover tint) and `GraphCanvas.tsx` (workflow node **selection** ring, `isSelected`-gated, not a default node style) both confirmed legitimate Tier 1 uses. Full 74-file sweep still not done (too large for a spot check) — remains backlog. Minor unrelated nit spotted in passing: `GraphCanvas.tsx`'s selection ring uses `rounded-[10px]` (arbitrary bracket radius, violates §4) — cosmetic, low priority, left as a backlog note rather than an isolated untested edit.
- 2026-07-27 — Looked at `DataStudioObjectCardGrid.tsx` (the object/model card grid, same area as the Modeler screenshot the user referenced) as a candidate for more Tier-2 default color: it already tints each card's icon `text-indigo-500` by default (`NAV_DEFAULT_ICON_COLOR`) and lets an operator override per-model via `row.modelColor` (same picker pattern as Modeler groups) — **not a bug**, no change made. Checked `WorkflowsListPanel.tsx` and `DesignerOutlineRegion.tsx` (Component Designer outline tree) — the outline tree has **no icon column at all** (text-only rows), so there's nothing to recolor without adding a new icon system, which is a feature addition, not a color fix; left alone.
- 2026-07-27 — User said proceed end-to-end at their own discretion. Ran a full grep of `bg-primary-*`/`text-primary-*`/`border-primary-*` (~150 hits across the ~74 files) and triaged by reading each in context. Verdict: the large majority are legitimate Tier 1 (shell chrome — headers/sidebars/nav across `adminShell`/`appShell`; primary CTA buttons/links on auth pages; active/selected-state highlights in `StepWizardShell`, `DevelopmentCatalogCards`, wizard steps; interactive hover affordances on split-drag handles; `ChatMarkdown`'s deliberate "user bubble gets the live accent, assistant bubble gets fixed indigo" split). No bulk misuse found.
- 2026-07-27 — Found and fixed one real, concrete pattern: several **Workflow floating-panel title icons defaulted to the accent color** instead of a distinguishing Tier-2 hue, so every workflow dialog looked identically tinted regardless of what it was. Recolored using the already-documented content-semantics recipe from `ui-core.md` ("identity → indigo/violet, technical/types → cyan, success/confirm → emerald"): `WorkflowExecutePanel.tsx` (Play icon + running-spinner) → indigo (echoes `kindColor('ACTION')`, also indigo — "running the workflow" is an action-flavored operation); `WorkflowDossierDialog.tsx` (execution-history icon) → violet (identity/record-keeping); `ValidationPublishPanel.tsx` (Publish confirm dialog) → emerald (exact "success/confirm" match, consistent with `buttonSemantics.ts`'s `confirm` intent already being emerald); `WorkflowExecuteFixtureDialog.tsx` (JSON schema icon) → cyan (technical/types); `WorkflowPalette.tsx` ("Toolbox" title icon) → violet (matches Base Components' own `baseComponentsSectionTheme.ts` precedent of `toolbox-panel: violet`). Left the matching demo icon in `ToolboxPanelBaseComponentsWorkspace.tsx` untouched — catalog-only showcase scaffolding, not a real surface, low value to chase. Verified with project typecheck (no new errors) and confirmed no tests assert the old hex/class values.
- 2026-07-27 — Also found and fixed a **genuine cross-file color-family drift**: `GraphCanvas.tsx`'s `kindColor()` (workflow node-kind colors, imported by `NodePropertiesFloatingPanel.tsx` and `WorkflowPalette.tsx` too — one function, cascades everywhere per the fix-shared-components-first rule) used Tailwind's `blue/green/red/gray/pink` hue family in raw hex, independent of the rest of the app's `indigo/emerald/rose/slate` Tier-2 palette. `DECISION`/`SWITCH` (amber), `WORK_ITEM` (violet), and `WAIT_EVENT`/`DELAY` (cyan) already matched the canonical palette exactly — only `ACTION` (blue→indigo `#4f46e5`), `END` (green→emerald `#059669`), `FAIL` (red→rose `#e11d48`), `PARALLEL_SPLIT`/`PARALLEL_JOIN` (gray→slate `#475569`) needed correcting; `SUBFLOW` (pink) moved to `purple` `#9333ea` (the extended hue) since violet was already taken by `WORK_ITEM`. Same visual groupings, now speaking the same color language as the rest of the app.
- 2026-07-27 — Git panel and Package list not yet reviewed for the same class of opportunity — remains backlog, lower priority than the above since no obvious accent-overreach or missed-differentiation was spotted there in the initial grep sample.
