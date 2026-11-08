import { describe, expect, it } from 'vitest';
import { NEUTRAL_SURFACE, SEMANTIC_STATUS_RGB } from '../colorTokens';
import {
  deriveThemeTokensFromBase,
  hexToRgbToken,
  reconcileNeutralChromeTokens,
  rgbTokenToHex,
  sanitizeThemeTokenMap,
  syncDerivedThemeTokens,
} from '../themePresetUtils';
import { THEME_TOKEN_KEYS } from '../themeTokenCatalog';

describe('themePresetUtils', () => {
  it('derives a full token map from base accent', () => {
    const tokens = deriveThemeTokensFromBase('#111111', 'fluent');
    expect(tokens['--app-accent-500']).toBe('#111111');
    expect(tokens['--app-atmosphere-geometry']).toBe('on');
    expect(tokens['--gradient-shell-atmosphere']).toContain('gradient');
    expect(Object.keys(tokens).length).toBeGreaterThan(60);
  });

  it('sanitizes unsafe token keys and values', () => {
    const sanitized = sanitizeThemeTokenMap({
      '--app-accent-500': '#112233',
      color: 'red',
      '--xss': '</style>',
    });
    expect(sanitized).toEqual({ '--app-accent-500': '#112233' });
  });

  it('converts rgb tokens to hex and back', () => {
    expect(rgbTokenToHex('0 162 138')).toBe('#00A28A');
    expect(hexToRgbToken('#00A28A')).toBe('0 162 138');
    expect(hexToRgbToken(rgbTokenToHex('17 34 51'))).toBe('17 34 51');
  });

  it('covers every editor token key in derived output', () => {
    const tokens = deriveThemeTokensFromBase('#038387', 'fluent');
    for (const key of THEME_TOKEN_KEYS) {
      expect(tokens[key], key).toBeTruthy();
    }
  });

  it('preserves user-edited literal interaction gradients during sync', () => {
    const literal = 'linear-gradient(90deg, #111111 0%, #222222 100%)';
    const synced = syncDerivedThemeTokens({
      '--gradient-nav-item-active': literal,
    });

    expect(synced['--gradient-nav-item-active']).toBe(literal);
  });

  it('always rebuilds logo gradient from stop tokens', () => {
    const synced = syncDerivedThemeTokens({
      '--app-logo-from': '#FF0000',
      '--app-logo-via': '#00FF00',
      '--app-logo-to': '#0000FF',
      '--gradient-app-logo': 'linear-gradient(90deg, #111111 0%, #222222 100%)',
    });

    expect(synced['--gradient-app-logo']).toBe(
      'linear-gradient(105deg, var(--app-logo-from) 0%, var(--app-logo-via) 48%, var(--app-logo-to) 100%)',
    );
  });

  it('restamps expanded nav group header ink to darkened theme accent', () => {
    const synced = syncDerivedThemeTokens({
      '--app-nav-group-header-text-expanded': '#111111',
    });

    expect(synced['--app-nav-group-header-text-expanded']).toBe(
      'var(--app-accent-700, #0f8f7a)',
    );
    expect(synced['--color-nav-group-header-expanded']).toBe(
      'var(--app-nav-group-header-text-expanded)',
    );
  });

  it('mirrors alias tokens when a paired key changes', () => {
    const synced = syncDerivedThemeTokens({
      '--color-primary-500': '#ABCDEF',
      '--app-accent-500': '#112233',
    });

    expect(synced['--color-primary-500']).toBe('#112233');
    expect(synced['--color-picker-default']).toBe('#112233');
  });

  it('prefers the edited mirror key when syncing live edits', () => {
    const synced = syncDerivedThemeTokens({
      '--color-primary-500': '#ABCDEF',
      '--app-accent-500': '#112233',
    }, { preferredMirrorKey: '--color-primary-500' });

    expect(synced['--color-primary-500']).toBe('#ABCDEF');
    expect(synced['--app-accent-500']).toBe('#ABCDEF');
    expect(synced['--color-picker-default']).toBe('#ABCDEF');
  });

  it('rewrites derived glow tokens but preserves operator-edited catalog shadows', () => {
    const synced = syncDerivedThemeTokens({
      '--app-accent-rgb': '255 0 0',
      '--color-primary-glow-a055': 'rgb(0 162 138 / 0.1)',
      '--shadow-cyan-ring-sm': '0 0 0 2px rgb(0 80 255 / 0.4)',
    });

    expect(synced['--color-primary-glow-a055']).toBe('rgb(var(--app-accent-rgb) / 0.1)');
    expect(synced['--shadow-cyan-ring-sm']).toBe('0 0 0 2px rgb(0 80 255 / 0.4)');
  });

  it('keeps Theme Designer catalog chrome and restamps non-catalog status glows', () => {
    const stale = {
      '--app-accent-500': '#960B18',
      '--app-shell-bg': '#F4F0F0',
      '--color-surface-elevated': '#F8EEEF',
      '--color-surface-panel-muted': '#EFE6E7',
      '--app-nav-group-header-edge': '#E41124',
      '--color-emerald-glow-a14': 'rgb(150 11 24 / 0.16)',
      '--gradient-shell-atmosphere': 'linear-gradient(155deg, var(--app-accent-wash) 0%, var(--app-shell-bg) 100%)',
    };
    const reconciled = reconcileNeutralChromeTokens(stale, '#960B18', 'fluent');

    expect(reconciled['--app-accent-500']).toBe('#960B18');
    expect(reconciled['--app-shell-bg']).toBe('#F4F0F0');
    expect(reconciled['--color-surface-shell']).toBe('#F4F0F0');
    expect(reconciled['--color-surface-elevated']).toBe('#F8EEEF');
    expect(reconciled['--app-surface-soft']).toBe('#F8EEEF');
    expect(reconciled['--color-surface-panel-muted']).toBe(NEUTRAL_SURFACE.muted);
    expect(reconciled['--app-nav-group-header-edge']).toBe('#E41124');
    expect(reconciled['--color-emerald-glow-a14']).toContain(SEMANTIC_STATUS_RGB.success);
    expect(reconciled['--gradient-shell-atmosphere']).not.toMatch(/linear-gradient\(155deg/);
  });

  it('is idempotent when restamping already-neutral chrome', () => {
    const first = reconcileNeutralChromeTokens({
      '--app-accent-500': '#960B18',
      '--app-shell-bg': '#F4F0F0',
    }, '#960B18', 'fluent');
    const second = reconcileNeutralChromeTokens(first, '#960B18', 'fluent');
    expect(second['--app-shell-bg']).toBe(first['--app-shell-bg']);
    expect(second['--app-accent-500']).toBe(first['--app-accent-500']);
  });

  it('keeps geometric backdrop off when the operator disabled it', () => {
    const reconciled = reconcileNeutralChromeTokens({
      '--app-atmosphere-geometry': 'off',
    }, '#038387', 'fluent');
    expect(reconciled['--app-atmosphere-geometry']).toBe('off');
  });

  it('keeps operator chrome fill and texture percents', () => {
    const reconciled = reconcileNeutralChromeTokens({
      '--app-sidebar-fill-opacity': '35%',
      '--app-header-texture-opacity': '60%',
    }, '#038387', 'fluent');
    expect(reconciled['--app-sidebar-fill-opacity']).toBe('35%');
    expect(reconciled['--app-header-texture-opacity']).toBe('60%');
    expect(reconciled['--app-header-fill-opacity']).toBe('0%');
    expect(reconciled['--app-menu-texture-opacity']).toBe('0%');
  });
});
