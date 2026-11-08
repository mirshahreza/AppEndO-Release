import { describe, expect, it } from 'vitest';
import { toCanonicalJsonText } from '../canonicalJson';
import { sha256Hex } from '../sha256';

describe('shared canonical JSON and SHA-256', () => {
  it('is stable across insertion order while preserving array order', async () => {
    const left = { z: [3, 2, 1], a: { y: true, x: 1 } };
    const right = { a: { x: 1, y: true }, z: [3, 2, 1] };
    expect(toCanonicalJsonText(left)).toBe(toCanonicalJsonText(right));
    expect(await sha256Hex(toCanonicalJsonText(left))).toBe(await sha256Hex(toCanonicalJsonText(right)));
    expect(toCanonicalJsonText({ value: [1, 2] })).not.toBe(toCanonicalJsonText({ value: [2, 1] }));
  });

  it('matches committed lowercase SHA-256 vectors', async () => {
    expect(await sha256Hex('null')).toBe('74234e98afe7498fb5daf1f36ac2d78acc339464f950703b8c019892f982b90b');
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('rejects non-JSON and non-finite values', () => {
    expect(() => toCanonicalJsonText({ missing: undefined })).toThrow();
    expect(() => toCanonicalJsonText({ value: Number.NaN })).toThrow();
    expect(() => toCanonicalJsonText(new Date())).toThrow();
  });
});
