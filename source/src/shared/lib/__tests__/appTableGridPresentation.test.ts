import { describe, expect, it } from 'vitest';
import {
  resolveGridEffectivePresentation,
  sanitizeGridCardBelow,
  tierUsesCardLayout,
} from '../appTableGridPresentation';

describe('appTableGridPresentation', () => {
  it('resolves auto presentation by viewport tier', () => {
    expect(resolveGridEffectivePresentation('auto', 'phone')).toBe('cards');
    expect(resolveGridEffectivePresentation('auto', 'tablet')).toBe('cards');
    expect(resolveGridEffectivePresentation('auto', 'desktop')).toBe('table');
    expect(resolveGridEffectivePresentation('auto', 'wide')).toBe('table');
  });

  it('honors explicit presentation modes', () => {
    expect(resolveGridEffectivePresentation('cards', 'desktop')).toBe('cards');
    expect(resolveGridEffectivePresentation('table-scroll', 'phone')).toBe('table-scroll');
    expect(resolveGridEffectivePresentation('table', 'phone')).toBe('table');
  });

  it('keeps tablet table-scroll when cardBelow is phone', () => {
    expect(resolveGridEffectivePresentation('auto', 'tablet', 'phone')).toBe('table-scroll');
    expect(tierUsesCardLayout('tablet', 'phone')).toBe(false);
  });

  it('uses cards at every viewport when cardBelow is desktop', () => {
    expect(tierUsesCardLayout('phone', 'desktop')).toBe(true);
    expect(tierUsesCardLayout('tablet', 'desktop')).toBe(true);
    expect(tierUsesCardLayout('desktop', 'desktop')).toBe(true);
    expect(tierUsesCardLayout('wide', 'desktop')).toBe(true);
    expect(resolveGridEffectivePresentation('auto', 'desktop', 'desktop')).toBe('cards');
    expect(resolveGridEffectivePresentation('auto', 'wide', 'desktop')).toBe('cards');
  });

  it('sanitizes unknown cardBelow values to tablet', () => {
    expect(sanitizeGridCardBelow('desktop')).toBe('desktop');
    expect(sanitizeGridCardBelow('tablet')).toBe('tablet');
    expect(sanitizeGridCardBelow('phone')).toBe('phone');
    expect(sanitizeGridCardBelow('nope')).toBe('tablet');
    expect(sanitizeGridCardBelow(undefined)).toBe('tablet');
  });
});
