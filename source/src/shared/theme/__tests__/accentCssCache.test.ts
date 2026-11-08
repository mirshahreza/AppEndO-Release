// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import {
  ACCENT_CSS_STORAGE_KEY,
  applyCachedAccentCssVarsToDocument,
  buildAccentCssVars,
  cacheAccentThemeCssVars,
  harmonizeAccentHex,
  mirrorShellAtmosphereGradient,
  persistAccentTheme,
  mirrorHorizontalPxBoxShadow,
  syncAdminShellDirectionalThemeTokens,
} from '../accentColorUtils';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');

afterEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('style');
  document.documentElement.removeAttribute('data-atmosphere-geometry');
  document.querySelector('meta[name="theme-color"]')?.remove();
});

describe('accent CSS splash cache', () => {
  it('persists theme CSS vars and reapplies them to the document', () => {
    const meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    meta.setAttribute('content', '#00a28a');
    document.head.append(meta);

    persistAccentTheme({ hex: '#6366F1', source: 'fluent' });
    const cached = JSON.parse(localStorage.getItem(ACCENT_CSS_STORAGE_KEY) ?? '{}') as Record<string, string>;
    expect(cached['--app-accent-500']).toBe('#6366F1');
    expect(cached['--gradient-shell-atmosphere']).toContain('rgb(');
    expect(cached['--gradient-app-logo']).toContain('#6366F1');
    expect(cached['--app-atmosphere-geometry']).toBe('on');

    document.documentElement.removeAttribute('style');
    expect(applyCachedAccentCssVarsToDocument()).toBe(true);
    expect(document.documentElement.style.getPropertyValue('--app-accent-500')).toBe('#6366F1');
    expect(meta.getAttribute('content')).toBe('#6366F1');
  });

  it('ignores unsafe cached keys and markup in values', () => {
    localStorage.setItem(ACCENT_CSS_STORAGE_KEY, JSON.stringify({
      '--app-accent-500': '#112233',
      color: 'red',
      '--xss': '</style><script>alert(1)</script>',
    }));
    expect(applyCachedAccentCssVarsToDocument()).toBe(true);
    expect(document.documentElement.style.getPropertyValue('--app-accent-500')).toBe('#112233');
    expect(document.documentElement.style.getPropertyValue('--xss')).toBe('');
    expect(document.documentElement.style.getPropertyValue('color')).toBe('');
  });

  it('applies the geometric backdrop flag from a cached off token', () => {
    localStorage.setItem(ACCENT_CSS_STORAGE_KEY, JSON.stringify({
      '--app-accent-500': '#112233',
      '--app-atmosphere-geometry': 'off',
    }));
    expect(applyCachedAccentCssVarsToDocument()).toBe(true);
    expect(document.documentElement.getAttribute('data-atmosphere-geometry')).toBe('off');
  });

  it('writes the same atmosphere token the boot splash and fullscreen loader consume', () => {
    cacheAccentThemeCssVars('#EC4899', true);
    const vars = buildAccentCssVars(harmonizeAccentHex('#EC4899', true));
    const cached = JSON.parse(localStorage.getItem(ACCENT_CSS_STORAGE_KEY) ?? '{}') as Record<string, string>;
    expect(cached['--gradient-shell-atmosphere']).toBe(vars['--gradient-shell-atmosphere']);
  });
});

describe('boot splash and fullscreen loading theme tokens', () => {
  it('uses theme CSS variables instead of a hardcoded teal palette', () => {
    const html = readFileSync(resolve(repoRoot, 'index.html'), 'utf8');
    const css = readFileSync(resolve(repoRoot, 'src/index.css'), 'utf8');

    expect(html).toContain('var(--gradient-shell-atmosphere)');
    expect(html).toContain('var(--gradient-app-logo)');
    expect(html).toContain('var(--app-accent-500');
    expect(html).toContain(ACCENT_CSS_STORAGE_KEY);
    expect(html).toContain('appendo-portal-brand-v1');
    expect(html).toContain('data-atmosphere-geometry');
    expect(html).not.toMatch(/#app-boot-splash \{[\s\S]*rgba\(0,\s*162,\s*138/);
    expect(html).not.toMatch(/#app-boot-splash \.app-boot-logo \{[\s\S]*#00a28a 0%/);

    expect(css).toMatch(/\.app-route-loading--fullscreen \{\s*background:\s*var\(--gradient-shell-atmosphere\);/);
    expect(css).toContain("html[data-atmosphere-geometry='off'] .admin-shell-surface .install-wizard-backdrop");
    expect(css).not.toMatch(/\.app-route-loading--fullscreen \{[\s\S]*rgba\(0,\s*162,\s*138/);
  });

  it('mirrors shell atmosphere gradient anchors when culture direction is rtl', () => {
    const ltr = buildAccentCssVars(harmonizeAccentHex('#00A28A'))['--gradient-shell-atmosphere'];
    expect(mirrorShellAtmosphereGradient(ltr)).toContain('at 106% -10%');

    document.documentElement.style.setProperty('--gradient-shell-atmosphere-ltr', ltr);
    document.documentElement.style.setProperty('--shadow-content-host-ltr', '-6px 0 16px -8px rgb(15 23 42 / 0.045)');
    syncAdminShellDirectionalThemeTokens(document.documentElement, 'rtl');
    expect(document.documentElement.style.getPropertyValue('--gradient-shell-atmosphere')).toContain('at 106% -10%');
    expect(document.documentElement.style.getPropertyValue('--shadow-content-host')).toContain('6px 0');
    expect(mirrorHorizontalPxBoxShadow('-6px 0 16px -8px rgb(0 0 0 / 0.1)')).toBe(
      '6px 0 16px -8px rgb(0 0 0 / 0.1)',
    );
  });
});
