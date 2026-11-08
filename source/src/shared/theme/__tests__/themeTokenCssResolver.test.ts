import { describe, expect, it } from 'vitest';
import {
  bakeThemeGradientCssForDesigner,
  bakeThemeShadowCssForDesigner,
  resolveThemeTokenCSSValue,
  resolveThemeTokenVarReferences,
  shouldUseThemeGradientPicker,
  shouldUseThemeVariableColorPicker,
  shouldUseThemeShadowPicker,
} from '../themeTokenCssResolver';
import { THEME_TOKEN_DEFINITION_BY_KEY } from '../themeTokenCatalog';

describe('themeTokenCssResolver', () => {
  it('resolves chained var() references for gradient aliases', () => {
    const tokens = {
      '--gradient-nav-group': 'linear-gradient(180deg, #112233 0%, #445566 100%)',
      '--gradient-nav-group-header': 'var(--gradient-nav-group)',
    };

    expect(resolveThemeTokenCSSValue(tokens, '--gradient-nav-group-header')).toBe(
      'linear-gradient(180deg, #112233 0%, #445566 100%)',
    );
  });

  it('inlines var() stops inside gradient strings', () => {
    const tokens = {
      '--app-logo-from': '#FF0000',
      '--app-logo-via': '#00FF00',
      '--app-logo-to': '#0000FF',
      '--gradient-app-logo': 'linear-gradient(105deg, var(--app-logo-from) 0%, var(--app-logo-via) 48%, var(--app-logo-to) 100%)',
    };

    expect(resolveThemeTokenVarReferences(tokens['--gradient-app-logo'], tokens)).toContain('#FF0000');
  });

  it('treats editor gradient tokens as gradient picker tokens', () => {
    const navActiveToken = THEME_TOKEN_DEFINITION_BY_KEY.get('--gradient-nav-item-active');
    expect(navActiveToken).toBeTruthy();
    expect(shouldUseThemeGradientPicker(navActiveToken!, {
      '--gradient-nav-item-active': 'linear-gradient(135deg, rgb(255 255 255) 0%, rgb(var(--app-accent-rgb) / 0.02) 36%, rgb(255 255 255 / 0.99) 100%)',
      '--app-accent-rgb': '0 162 138',
    })).toBe(true);
  });

  it('bakes theme rgb(var()) stops into rgba literals for the gradient designer', () => {
    const tokens = {
      '--app-accent-rgb': '0 162 138',
      '--app-accent-secondary-rgb': '0 130 120',
      '--gradient-pattern-menu-overlay':
        'linear-gradient(165deg, rgb(var(--app-accent-rgb) / 0.05) 0%, rgb(var(--app-accent-secondary-rgb) / 0.03) 42%, rgb(255 255 255 / 0) 74%)',
    };

    const baked = bakeThemeGradientCssForDesigner(tokens['--gradient-pattern-menu-overlay'], tokens);
    expect(baked).toContain('rgba(0, 162, 138, 0.05)');
    expect(baked).toContain('rgba(0, 130, 120, 0.03)');
  });

  it('treats shadow keys and box-shadow css as shadow picker tokens', () => {
    const shadowToken = THEME_TOKEN_DEFINITION_BY_KEY.get('--shadow-cyan-ring-sm');
    expect(shadowToken).toBeTruthy();
    expect(shouldUseThemeShadowPicker(shadowToken!, {
      '--shadow-cyan-ring-sm': '0 0 0 2px rgb(var(--app-accent-rgb) / 0.12)',
      '--app-accent-rgb': '0 162 138',
    })).toBe(true);

    const baked = bakeThemeShadowCssForDesigner('0 0 0 2px rgb(var(--app-accent-rgb) / 0.12)', {
      '--app-accent-rgb': '0 162 138',
    });
    expect(baked).toContain('rgba(0, 162, 138, 0.12)');
  });

  it('treats nav hover hex tokens as color picker tokens, not variable rgb pickers', () => {
    const hoverToken = THEME_TOKEN_DEFINITION_BY_KEY.get('--color-nav-item-hover-bg');
    expect(hoverToken).toBeTruthy();
    expect(hoverToken?.valueKind).toBe('hex');
    expect(shouldUseThemeVariableColorPicker(hoverToken!, {
      '--color-nav-item-hover-bg': '#F1F5F9',
    })).toBe(false);

    const rgbChannelToken = THEME_TOKEN_DEFINITION_BY_KEY.get('--app-accent-rgb');
    expect(rgbChannelToken).toBeTruthy();
    expect(shouldUseThemeVariableColorPicker(rgbChannelToken!, {
      '--app-accent-rgb': '0 162 138',
    })).toBe(false);
  });

  it('does not treat the geometric backdrop toggle as a color or gradient picker', () => {
    const token = THEME_TOKEN_DEFINITION_BY_KEY.get('--app-atmosphere-geometry');
    expect(token?.valueKind).toBe('toggle');
    expect(shouldUseThemeGradientPicker(token!, { '--app-atmosphere-geometry': 'on' })).toBe(false);
    expect(shouldUseThemeShadowPicker(token!, { '--app-atmosphere-geometry': 'on' })).toBe(false);
    expect(shouldUseThemeVariableColorPicker(token!, { '--app-atmosphere-geometry': 'on' })).toBe(false);
  });

  it('does not treat chrome fill and texture percents as color or gradient pickers', () => {
    const token = THEME_TOKEN_DEFINITION_BY_KEY.get('--app-sidebar-fill-opacity');
    expect(token?.valueKind).toBe('percent');
    expect(shouldUseThemeGradientPicker(token!, { '--app-sidebar-fill-opacity': '40%' })).toBe(false);
    expect(shouldUseThemeShadowPicker(token!, { '--app-sidebar-fill-opacity': '40%' })).toBe(false);
    expect(shouldUseThemeVariableColorPicker(token!, { '--app-sidebar-fill-opacity': '40%' })).toBe(false);
  });
});
