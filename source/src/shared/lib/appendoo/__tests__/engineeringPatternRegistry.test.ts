import { describe, expect, it } from 'vitest';
import { findApplicablePatterns, getPattern } from '../engineeringPatternRegistry';

describe('engineeringPatternRegistry', () => {
  it('finds active reference patterns by applicability', () => {
    const patterns = findApplicablePatterns(undefined, { appliesTo: 'page' });
    expect(patterns.some((pattern) => pattern.patternId === 'pattern.ref-hello-page')).toBe(true);
  });

  it('returns pattern detail by id', () => {
    const pattern = getPattern('pattern.ref-hello-api');
    expect(pattern?.requiredCapabilities).toContain('appendo-server-functions');
  });
});
