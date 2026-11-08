import { describe, expect, it } from 'vitest';
import { ACCENT_COLOR_MATRIX } from '../accentPalettes';
import {
  buildAccentCssVars,
  contrastRatioHex,
  ensureFillContrastsWhite,
  harmonizeAccentHex,
} from '../accentColorUtils';
import {
  NEUTRAL_SURFACE,
  NEUTRAL_TEXT,
  SEMANTIC_STATUS_RGB,
  WCAG_AA_CONTRAST,
} from '../colorTokens';

const allSwatches = ACCENT_COLOR_MATRIX.flatMap((row) => row.swatches);

describe('accent theme isolation', () => {
  it('keeps shell, cards, and nav chrome on slate regardless of accent (including Cranberry and Gray)', () => {
    for (const swatch of allSwatches) {
      const vars = buildAccentCssVars(harmonizeAccentHex(swatch.hex, true));
      expect(vars['--app-shell-bg'], swatch.id).toBe(NEUTRAL_SURFACE.page);
      expect(vars['--color-surface-shell'], swatch.id).toBe(NEUTRAL_SURFACE.page);
      expect(vars['--color-surface-elevated'], swatch.id).toBe(NEUTRAL_SURFACE.card);
      expect(vars['--color-surface-panel-muted'], swatch.id).toBe(NEUTRAL_SURFACE.muted);
      expect(vars['--app-nav-group-header-edge'], swatch.id).toBe(NEUTRAL_SURFACE.page);
      expect(vars['--app-nav-group-header-text'], swatch.id).toBe(NEUTRAL_TEXT.body);
      expect(vars['--app-nav-hover'], swatch.id).toBe(NEUTRAL_SURFACE.muted);
      expect(vars['--gradient-shell-atmosphere'], swatch.id).toContain(NEUTRAL_SURFACE.page);
      expect(vars['--gradient-shell-atmosphere'], swatch.id).not.toMatch(/linear-gradient\(155deg/);
    }
  });

  it('does not remap emerald / status glows to the accent RGB', () => {
    const cranberry = buildAccentCssVars(harmonizeAccentHex('#C50F1F', true));
    const gray = buildAccentCssVars(harmonizeAccentHex('#393939', true));
    for (const vars of [cranberry, gray]) {
      expect(vars['--color-emerald-glow-a14']).toContain(SEMANTIC_STATUS_RGB.success);
      expect(vars['--color-emerald-glow-a14']).not.toContain(vars['--app-accent-rgb']);
      expect(vars['--shadow-emerald-glow-md']).toContain('--app-accent-rgb');
    }
  });

  it('meets WCAG AA for ink on paper and white labels on button fill across the matrix', () => {
    for (const swatch of allSwatches) {
      const tokens = harmonizeAccentHex(swatch.hex, true);
      const vars = buildAccentCssVars(tokens);
      expect(contrastRatioHex(vars['--app-accent-700'], NEUTRAL_SURFACE.card), `${swatch.id} ink/white`)
        .toBeGreaterThanOrEqual(WCAG_AA_CONTRAST);
      expect(contrastRatioHex(vars['--app-accent-700'], NEUTRAL_SURFACE.page), `${swatch.id} ink/page`)
        .toBeGreaterThanOrEqual(WCAG_AA_CONTRAST);
      expect(contrastRatioHex('#FFFFFF', vars['--app-accent-600']), `${swatch.id} white/fill`)
        .toBeGreaterThanOrEqual(WCAG_AA_CONTRAST);
      expect(contrastRatioHex(NEUTRAL_TEXT.body, NEUTRAL_SURFACE.card)).toBeGreaterThanOrEqual(WCAG_AA_CONTRAST);
    }
  });

  it('darkens pastel Light fills until white text passes AA', () => {
    const lightTeal = '#9BD9DB';
    expect(contrastRatioHex('#FFFFFF', lightTeal)).toBeLessThan(WCAG_AA_CONTRAST);
    expect(contrastRatioHex('#FFFFFF', ensureFillContrastsWhite(lightTeal)))
      .toBeGreaterThanOrEqual(WCAG_AA_CONTRAST);
  });
});
