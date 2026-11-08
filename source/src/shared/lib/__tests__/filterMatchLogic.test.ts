import { describe, expect, it } from 'vitest';
import { getFilterMatchLogicOption, parseFilterMatchLogic } from '../filterMatchLogic';

describe('filterMatchLogic', () => {
  it('defaults unknown values to or', () => {
    expect(parseFilterMatchLogic(undefined)).toBe('or');
    expect(parseFilterMatchLogic('')).toBe('or');
    expect(parseFilterMatchLogic('invalid')).toBe('or');
  });

  it('parses and', () => {
    expect(parseFilterMatchLogic('AND')).toBe('and');
    expect(parseFilterMatchLogic('nor')).toBe('or');
  });

  it('resolves option metadata', () => {
    expect(getFilterMatchLogicOption('and').label).toBe('AND');
    expect(getFilterMatchLogicOption('unknown' as never).label).toBe('OR');
  });
});
