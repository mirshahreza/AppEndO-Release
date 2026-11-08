/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest';
import { resolveTranslationIconAnchor } from '../resolveTranslationIconAnchor';

describe('resolveTranslationIconAnchor', () => {
  it('uses the inline-start corner for LTR shell direction', () => {
    const element = document.createElement('span');
    element.textContent = 'Users';
    element.getBoundingClientRect = () => ({
      top: 40,
      left: 100,
      right: 160,
      bottom: 56,
      width: 60,
      height: 16,
      x: 100,
      y: 40,
      toJSON: () => ({}),
    });
    document.body.appendChild(element);

    const anchor = resolveTranslationIconAnchor(element, 'ltr');
    expect(anchor.left).toBe(106);
    expect(anchor.translateClassName).toContain('-translate-y-1/2');
    expect(anchor.translateClassName).not.toContain('-translate-x-full');

    document.body.removeChild(element);
  });

  it('uses the inline-start corner for RTL shell direction', () => {
    const element = document.createElement('span');
    element.getBoundingClientRect = () => ({
      top: 10,
      left: 20,
      right: 80,
      bottom: 26,
      width: 60,
      height: 16,
      x: 20,
      y: 10,
      toJSON: () => ({}),
    });

    const anchor = resolveTranslationIconAnchor(element, 'rtl');
    expect(anchor.left).toBe(74);
    expect(anchor.translateClassName).toContain('-translate-x-full');
  });
});
