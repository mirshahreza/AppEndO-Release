import { describe, expect, it } from 'vitest';
import {
  inferAppTableGridColumnTextDirectionFromLegacyClassName,
  resolveAppTableGridColumnBidi,
  resolveAppTableGridColumnDirectionChrome,
  stripLegacyAppTableGridColumnPhysicalDirection,
} from '../appTableGridColumnTextDirection';

describe('appTableGridColumnTextDirection', () => {
  it('resolves culture and opposite from application direction', () => {
    expect(resolveAppTableGridColumnBidi('culture', 'ltr')).toBe('ltr');
    expect(resolveAppTableGridColumnBidi('culture', 'rtl')).toBe('rtl');
    expect(resolveAppTableGridColumnBidi('opposite', 'ltr')).toBe('rtl');
    expect(resolveAppTableGridColumnBidi('opposite', 'rtl')).toBe('ltr');
    expect(resolveAppTableGridColumnBidi('ltr', 'rtl')).toBe('ltr');
    expect(resolveAppTableGridColumnBidi('rtl', 'ltr')).toBe('rtl');
  });

  it('maps legacy physical LTR to culture and RTL to opposite', () => {
    expect(inferAppTableGridColumnTextDirectionFromLegacyClassName('text-left [direction:ltr]')).toBe('culture');
    expect(inferAppTableGridColumnTextDirectionFromLegacyClassName('[direction:rtl]')).toBe('opposite');
  });

  it('strips legacy physical direction tokens from class names', () => {
    expect(stripLegacyAppTableGridColumnPhysicalDirection('text-left [direction:ltr] font-medium')).toBe('font-medium');
  });

  it('applies culture-relative dir on start-aligned columns', () => {
    const chrome = resolveAppTableGridColumnDirectionChrome(
      { textDirection: 'culture' },
      'rtl',
    );
    expect(chrome.headerClassName).toBe('text-start');
    expect(chrome.headerDir).toBe('rtl');
    expect(chrome.cellDir).toBe('rtl');
  });

  it('skips bidi on center and end aligned columns', () => {
    const centered = resolveAppTableGridColumnDirectionChrome(
      {
        headerClassName: 'text-center',
        cellClassName: 'text-center',
        textDirection: 'culture',
      },
      'rtl',
    );
    expect(centered.headerDir).toBeUndefined();
    expect(centered.cellDir).toBeUndefined();

    const actions = resolveAppTableGridColumnDirectionChrome(
      {
        headerClassName: 'text-end',
        cellClassName: 'text-end',
      },
      'ltr',
    );
    expect(actions.headerDir).toBeUndefined();
  });
});
