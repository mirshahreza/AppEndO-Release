import { describe, expect, it } from 'vitest';
import { findPackageNamingViolations } from '../packageNamingGate';

describe('packageNamingGate', () => {
  it('src/ has no legacy package naming violations (PKU-0.9)', () => {
    const violations = findPackageNamingViolations();
    expect(violations).toEqual([]);
  });
});
