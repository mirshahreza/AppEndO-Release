import { describe, expect, it } from 'vitest';
import {
  SURFACE_CHROME_ACCENT,
  SURFACE_CHROME_TONE,
  resolveSurfaceChrome,
  resolveSurfaceChromeCustom,
} from '../surfaceChromeClasses';

describe('surfaceChromeClasses', () => {
  it('returns accent chrome by default', () => {
    expect(resolveSurfaceChrome({})).toBe(SURFACE_CHROME_ACCENT);
  });

  it('returns preset tone chrome', () => {
    expect(resolveSurfaceChrome({ colorSource: 'tone', tone: 'violet' }))
      .toBe(SURFACE_CHROME_TONE.violet);
  });

  it('builds custom chrome from hex without tinting body', () => {
    const chrome = resolveSurfaceChromeCustom('#6366F1');
    expect(chrome.shellStyle?.borderColor).toContain('rgb(');
    expect(chrome.headerStyle?.background).toContain('linear-gradient');
    expect(chrome.footer).toContain('bg-slate-100');
  });

  it('uses custom hex when colorSource is custom', () => {
    const chrome = resolveSurfaceChrome({
      colorSource: 'custom',
      customColorHex: '#E11D48',
    });
    expect(chrome.shellStyle?.borderColor).toContain('rgb(');
  });
});
