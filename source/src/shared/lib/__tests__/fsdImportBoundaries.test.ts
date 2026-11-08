import { describe, expect, it } from 'vitest';
import { findFsdBoundaryViolations } from '../fsdImportBoundaries';

describe('fsdImportBoundaries', () => {
  it('features slices do not import from pages/', () => {
    const violations = findFsdBoundaryViolations();
    expect(violations).toEqual([]);
  });
});
