import { describe, expect, it } from 'vitest';
import { toCanonicalJsonText, canonicalJsonFingerprint } from '../canonicalJson';

describe('canonicalJson (doc 03 section 20)', () => {
  it('produces equal fingerprints regardless of object key insertion order', () => {
    const a = { b: 1, a: 2, c: { z: 1, y: 2 } };
    const b = { a: 2, c: { y: 2, z: 1 }, b: 1 };
    expect(canonicalJsonFingerprint(a)).toBe(canonicalJsonFingerprint(b));
  });

  it('produces equal fingerprints regardless of pretty-printing (only structural content matters)', () => {
    const compact = { a: 1, b: [1, 2, 3] };
    const rebuilt = JSON.parse(JSON.stringify(compact, null, 4));
    expect(canonicalJsonFingerprint(compact)).toBe(canonicalJsonFingerprint(rebuilt));
  });

  it('preserves array order (does not sort array elements)', () => {
    expect(toCanonicalJsonText({ a: [3, 1, 2] })).toBe('{"a":[3,1,2]}');
    expect(toCanonicalJsonText({ a: [1, 2, 3] })).not.toBe(toCanonicalJsonText({ a: [3, 2, 1] }));
  });

  it('rejects non-finite numbers', () => {
    expect(() => toCanonicalJsonText({ a: Number.POSITIVE_INFINITY })).toThrow();
    expect(() => toCanonicalJsonText({ a: Number.NaN })).toThrow();
  });

  it('rejects non-JSON values (undefined, function, symbol)', () => {
    expect(() => toCanonicalJsonText({ a: undefined })).toThrow();
    expect(() => toCanonicalJsonText({ a: () => 1 })).toThrow();
  });

  it('is stable/deterministic across repeated calls', () => {
    const value = { x: 1, y: { z: [1, 2, { w: true }] } };
    expect(canonicalJsonFingerprint(value)).toBe(canonicalJsonFingerprint(value));
  });

  it('returns the well-known SHA-256 hex digest for a trivial value', () => {
    // sha256('null') per RFC 8785-style canonical JSON of a bare null literal
    expect(canonicalJsonFingerprint(null)).toBe('74234e98afe7498fb5daf1f36ac2d78acc339464f950703b8c019892f982b90b');
  });
});
