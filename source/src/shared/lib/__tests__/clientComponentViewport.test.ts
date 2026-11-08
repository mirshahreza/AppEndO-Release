import { describe, expect, it } from 'vitest';
import {
  clientComponentMeetsMinViewport,
  clientComponentViewportRequiresWrap,
  parseClientComponentBelowMin,
  parseClientComponentMinViewport,
  resolveClientComponentViewportPolicy,
} from '../clientComponentViewport';

describe('clientComponentViewport', () => {
  it('treats always/phone/empty as no minimum', () => {
    expect(parseClientComponentMinViewport('')).toBeUndefined();
    expect(parseClientComponentMinViewport('always')).toBeUndefined();
    expect(parseClientComponentMinViewport('phone')).toBeUndefined();
    expect(parseClientComponentMinViewport('desktop')).toBe('desktop');
    expect(parseClientComponentMinViewport('tablet')).toBe('tablet');
    expect(resolveClientComponentViewportPolicy({}).minViewport).toBeUndefined();
    expect(resolveClientComponentViewportPolicy({}).belowMin).toBe('continue');
    expect(clientComponentViewportRequiresWrap(resolveClientComponentViewportPolicy({}))).toBe(false);
  });

  it('defaults below-min to continue so components can adapt', () => {
    expect(parseClientComponentBelowMin(undefined)).toBe('continue');
    expect(parseClientComponentBelowMin('hide')).toBe('hide');
    expect(
      resolveClientComponentViewportPolicy({ minViewport: 'desktop' }).belowMin,
    ).toBe('continue');
    expect(
      resolveClientComponentViewportPolicy({ minViewport: 'always', belowMin: 'hide' }).belowMin,
    ).toBe('continue');
  });

  it('requires a wrap only when the component should hide or show a placeholder', () => {
    expect(clientComponentMeetsMinViewport('phone', 'desktop')).toBe(false);
    expect(clientComponentMeetsMinViewport('desktop', 'desktop')).toBe(true);
    expect(clientComponentViewportRequiresWrap({
      minViewport: 'desktop',
      belowMin: 'placeholder',
    })).toBe(true);
    expect(clientComponentViewportRequiresWrap({
      minViewport: 'desktop',
      belowMin: 'continue',
    })).toBe(false);
  });
});
