# Creative Shell Studio manual assistive-technology verification

This checklist is intentionally **manual**. Playwright covers browser semantics, keyboard behavior,
focus return, reflow, preference fallbacks, and an axe-equivalent DOM ruleset; it does not claim to
operate or validate a screen reader.

## Current status

- Automated browser matrix: **Passed 2026-08-03 — Edge, Firefox and WebKit, 30 tests**
- NVDA + Firefox on Windows: **Pending manual verification — NVDA is not installed on the release host**
- NVDA + Chromium/Edge on Windows: **Pending manual verification — NVDA is not installed on the release host**
- VoiceOver + Safari/WebKit on macOS: **Pending external manual verification — unavailable on the Windows release host**
- Product Owner release acceptance: **Pending after the manual AT evidence**

Record the tester, operating-system version, browser version, screen-reader version, date, and
result beside each item when the check is performed. A browser-binary test result must not be used
as a substitute for these checks.

## NVDA checklist

- [ ] Start with NVDA browse mode at the isolated gate route or the production Shell Studio route.
- [ ] Confirm the page title and single level-one heading are announced.
- [ ] Use landmark navigation: one main region and a labeled Primary navigation are discoverable.
- [ ] Activate the skip link and confirm focus/virtual cursor reaches the main region.
- [ ] Create a shell using only the keyboard; labels, required state, profile radio group, and
      button names are announced accurately.
- [ ] Edit the display name and scene, save, and confirm the live status “Draft saved” is announced
      once without interrupting input.
- [ ] Open and close the account menu with Enter and Escape; focus returns to Account menu.
- [ ] Open preview and confirm the scene heading, body, actions, poster alternatives, callouts, and
      fallback content are available in a sensible reading order.
- [ ] Enable deterministic fallback and confirm no semantic content or action disappears.
- [ ] In Windows High Contrast, confirm controls, focus indicators, boundaries, and fallback text
      remain perceivable.
- [ ] At 200% text and 400% browser zoom, confirm reading order and operation remain usable without
      two-dimensional scrolling.

## VoiceOver checklist

- [ ] Enable VoiceOver on macOS and use Safari with Quick Nav both off and on.
- [ ] Confirm the title, one level-one heading, main landmark, and labeled navigation are announced.
- [ ] Use the rotor to enumerate headings, links, form controls, and landmarks; names and order match
      the visible interface.
- [ ] Create and edit a shell using keyboard commands only; radio-group position/state and field
      labels are announced.
- [ ] Confirm Save status is announced without moving focus.
- [ ] Open the account menu, press Escape, and confirm VoiceOver focus returns to its trigger.
- [ ] Open preview and verify scene content/actions remain navigable while decorative Canvas/WebGL
      output is ignored.
- [ ] Force deterministic fallback and confirm equivalent semantic content remains.
- [ ] Enable Reduce Motion and Increase Contrast separately; confirm static output and usable focus
      indicators.
- [ ] At 200% text and 400% zoom, confirm content remains readable and operable in logical order.

## Failure recording

For every failure, capture the exact route/fixture, browser and assistive-technology versions,
keyboard sequence, expected announcement, actual announcement, and a screenshot or short recording
when policy permits. Do not mark a row complete from code inspection or automated test output.
