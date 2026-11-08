import { describe, expect, it } from 'vitest';
import {
  generatePairwiseCases,
  type PairwiseOptionDomain,
} from '../generatePairwiseCases';

const domains: readonly PairwiseOptionDomain[] = [
  { id: 'variant', values: ['line', 'contained'] },
  { id: 'placement', values: ['top', 'start', 'end'] },
  { id: 'disabled', values: [false, true] },
];

describe('generatePairwiseCases', () => {
  it('covers every value pair with fewer cases than the Cartesian product', () => {
    const cases = generatePairwiseCases(domains);
    expect(cases.length).toBeLessThan(12);

    for (let left = 0; left < domains.length; left += 1) {
      for (let right = left + 1; right < domains.length; right += 1) {
        for (const leftValue of domains[left].values) {
          for (const rightValue of domains[right].values) {
            expect(
              cases.some(
                (candidate) =>
                  candidate[domains[left].id] === leftValue &&
                  candidate[domains[right].id] === rightValue,
              ),
            ).toBe(true);
          }
        }
      }
    }
  });

  it('excludes impossible pairs while covering valid constrained pairs', () => {
    const cases = generatePairwiseCases(domains, {
      isValid: (candidate) =>
        !(candidate.variant === 'contained' && candidate.placement === 'end'),
    });

    expect(
      cases.some(
        (candidate) =>
          candidate.variant === 'contained' && candidate.placement === 'end',
      ),
    ).toBe(false);
    expect(
      cases.some(
        (candidate) =>
          candidate.variant === 'line' && candidate.placement === 'end',
      ),
    ).toBe(true);
  });

  it('rejects malformed domains', () => {
    expect(() =>
      generatePairwiseCases([
        { id: 'same', values: [1] },
        { id: 'same', values: [2] },
      ]),
    ).toThrow('Duplicate pairwise option ID');
    expect(() => generatePairwiseCases([{ id: 'empty', values: [] }])).toThrow(
      'requires at least one value',
    );
  });
});
