import { describe, expect, it } from 'vitest';
import { readManifestCapabilityArray } from '../manifestCapabilityArrays';

describe('readManifestCapabilityArray', () => {
  it('returns an empty array when the capability is missing or not an array', () => {
    expect(readManifestCapabilityArray(undefined)).toEqual([]);
    expect(readManifestCapabilityArray(null)).toEqual([]);
    expect(readManifestCapabilityArray({})).toEqual([]);
  });

  it('returns the array when valid', () => {
    expect(readManifestCapabilityArray([{ id: 'a' }])).toEqual([{ id: 'a' }]);
  });
});
