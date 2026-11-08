# Appearance QA — `/us/studio/appearance`

**Date:** 2026-09-26  
**Environment:** `http://127.0.0.1:3200` · signed-in Sys Admin  
**Screenshots:** `workspace/smoke-pass/appearance/` (21 PNGs; canonical set `appearance-01` … `appearance-18`)

## Summary

| Area | Result |
|------|--------|
| **Tabs** (Shell & layout · Atmosphere tokens) | Pass — navigation and copy match refactor |
| **Page width bounded vs fluid** | Pass after fix + reload — DOM `data-shell-layout-width="bounded"` toggles with saved user `layoutWidth` |
| **Portal sidebar policy** (rail · hidden) | Pass — rail shows collapse + icon rail; hidden removes persistent sidebar when collapsed, header **Open navigation menu** expands overlay |
| **Accent matrix picker** | Pass — popover opens (LIGHT/SOFT/CORE/… grid) |
| **Atmosphere tokens UI** | Pass — sections render; sample border/shadow designer opens |
| **Unit / integration tests** | Automated gate — see below |
| **UiSelect (page width / collapse policy)** | Fixed — `preferNativeSelect` on Appearance panel |
| **Header width control** | Fixed — hidden when portal default is fluid (no dead button) |

**Post-QA portal default restored:** `sidebarCollapsePolicy: rail` (studio mount).  
**User preference left:** `layoutWidth: bounded` (matches your earlier repro).

### Automated regression (run instead of manual re-check)

```bash
node workspace/smoke-pass/run-appearance-automated-tests.mjs
```

Covers: appearance API routes, bounded/fluid merge logic, shell prefs panel (select + live preview + portal dirty), header control visibility, theme token slider/undo wiring.

---

## Code fixes (2026-09-26 follow-up)

1. **`shellLayoutWidthAppearance`** — user bounded override when portal fluid (existing).
2. **`ShellLayoutWidthContext`** — `headerControlVisible` only when portal default width is **bounded** and user width control is on.
3. **`AppearanceShellPreferencesPanel`** — `preferNativeSelect` on shell selects; card `overflow-visible` so menus are not clipped.
4. **`UiSelect`** — new `preferNativeSelect` prop; listbox items expose `data-testid="ui-select-option-<value>"`.

---

## Shell & layout

| Control | How tested | Expected | Result | Screenshot |
|---------|------------|----------|--------|------------|
| Section nav — Shell & layout | Click tab | Shell prefs visible | Pass | `appearance-10-shell-rail-bounded-baseline.png` |
| Section nav — Atmosphere tokens | Click tab | Token grid visible | Pass | `appearance-06-atmosphere-tab.png`, `appearance-14-atmosphere-tab-expanded-sidebar.png` |
| **Page width — Bounded** | `PUT /api/appearance/me` `{ layoutWidth: "bounded" }` + reload | Centered column, `data-shell-layout-width="bounded"` | Pass | `appearance-03`, `appearance-13-page-width-bounded-saved.png` |
| **Page width — Fluid** | Same API `{ layoutWidth: "fluid" }` + reload | Full width, no bounded attribute | Pass | `appearance-02`, `appearance-12-page-width-fluid-saved.png` |
| Live preview (in-panel dirty) | Not re-run this pass | Shell updates before Save | Covered in code (`applySession` in panel); API-only save needs reload to refresh shell context |
| **Accent color** | Click **Accent color** | Theme matrix popover | Pass | `appearance-04`, `appearance-11-accent-picker-open.png` |
| Start with sidebar collapsed | Switch visible ON; Save disabled when clean | Toggle enables Save when dirty | Not fully automated (switch click flaky); state matches session |
| Save my preferences / Reset | Buttons present; Save disabled when clean | — | Visual pass |
| Collapse sidebar (portal **rail**) | Click **Collapse sidebar** | Icon rail | Pass | `appearance-05-sidebar-collapsed-rail.png` |
| Portal — When collapsed **Show icon rail** | API + UI combobox | Rail behavior | Pass | `appearance-10` |
| Portal — When collapsed **Hide completely** | `PUT portal-defaults` `hidden` + collapse | No sidebar chrome; header menu | Pass | `appearance-16`–`appearance-18` |
| Portal — Default bounded / user width toggles | Visible; portal fluid + user bounded in session | User can pick bounded while portal default fluid | Pass (matches bug fix) | `appearance-10`, `appearance-13` |
| Header **Expand page width** control | Portal `layoutWidth` fluid + `layoutWidthUserControl` on | Control may be absent when portal default not bounded | **Not shot** — portal default bounded OFF in session |

---

## Atmosphere tokens

| Control | How tested | Expected | Result | Screenshot |
|---------|------------|----------|--------|------------|
| Reset atmosphere to catalog | Button visible | Resets preset | Not clicked (destructive) |
| Undo / Redo | After CDP slider tweak | Enabled after real edit | **Inconclusive** — CDP slider did not enable undo; use manual slider click for history |
| Brand / surface color pickers | Fields present in a11y tree | Hex inputs | Pass (presence) | `appearance-14` |
| Geometric shapes | Switch ON in snapshot | Toggles shell pattern | Not toggled off in automation |
| Sidebar fill slider | CDP set 45% earlier | Sidebar frost changes | Partial — value 45 in tree once; reverted after reload | `appearance-09-atmosphere-sidebar-fill-45.png` |
| Primary channel border/shadow | Click picker | Designer popover | Pass | `appearance-15-primary-channel-border-designer.png` |
| Remaining ~40 token fields | Not each individually | Each maps to CSS vars | **Sampled only** — same control patterns (color, gradient, border/shadow) |

---

## Known issues / UX notes

1. **Bounded wraps whole shell** (sidebar + content) — on very wide monitors the margin effect can look subtle; see bounded shots `appearance-13`.
2. **Duplicate titles** — shell header “Dev / Appearance” + in-page “Appearance” (admin shell geometry lock; not changed in this QA).
3. **HeroUI `UiSelect`** (page width, portal policy) — listbox option clicks often fail in browser automation; manual keyboard or API used for width verification. Worth a human click-test on real browser.
4. **After API save of shell prefs** — full shell width context updates on reload (or in-panel live preview when editing on Appearance page).

---

## Regression fix verified

**Issue:** User **Bounded** ignored when portal default **Fluid**.  
**Fix:** `resolveShellLayoutWidthAppearance` — when portal is fluid, `activeWidth` follows effective user `layoutWidth`.  
**Test:** `honors user bounded override when portal default is fluid` in `shellLayoutWidthAppearance.test.ts`.

---

## Screenshot index (canonical)

| File | Description |
|------|-------------|
| `appearance-01-shell-baseline-bounded.png` | Early session — shell tab bounded |
| `appearance-02-page-width-fluid.png` | Fluid width |
| `appearance-03-page-width-bounded.png` | Bounded width |
| `appearance-04-accent-picker-open.png` | Accent matrix |
| `appearance-05-sidebar-collapsed-rail.png` | Collapsed → rail |
| `appearance-06-atmosphere-tab.png` | Atmosphere overview |
| `appearance-07-portal-hidden-sidebar.png` | Portal hidden policy |
| `appearance-08-hidden-nav-menu-open.png` | Header nav overlay |
| `appearance-09-atmosphere-sidebar-fill-45.png` | Sidebar fill slider experiment |
| `appearance-10-shell-rail-bounded-baseline.png` | Rail restored + bounded |
| `appearance-11-accent-picker-open.png` | Accent matrix (repeat) |
| `appearance-12-page-width-fluid-saved.png` | Fluid after save + reload |
| `appearance-13-page-width-bounded-saved.png` | Bounded after save + reload |
| `appearance-14-atmosphere-tab-expanded-sidebar.png` | Atmosphere + expanded nav |
| `appearance-15-primary-channel-border-designer.png` | Border/shadow designer |
| `appearance-16-portal-hidden-sidebar-shell.png` | Portal hidden — settings reflect policy |
| `appearance-17-portal-hidden-collapsed-header-menu.png` | Collapsed hidden chrome |
| `appearance-18-hidden-nav-overlay-open.png` | Overlay nav from header menu |

Also copied: `appearance-shell-tab.png`, `appearance-shell-redesign.png`, `appearance-atmosphere-tab.png` (earlier passes).
