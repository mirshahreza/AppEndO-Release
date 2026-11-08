import { describe, expect, it } from 'vitest';
import { shouldReleaseCompanionTsxLock } from '../useDesignerCode';

describe('shouldReleaseCompanionTsxLock', () => {
  it('keeps the hydrated companion while the canvas fingerprint is unchanged', () => {
    expect(shouldReleaseCompanionTsxLock(false, 'fp-a', 'fp-a')).toBe(false);
  });

  it('releases the companion when the canvas document has moved on', () => {
    expect(shouldReleaseCompanionTsxLock(false, 'fp-a', 'fp-b')).toBe(true);
  });

  it('does not steal in-progress code edits', () => {
    expect(shouldReleaseCompanionTsxLock(true, 'fp-a', 'fp-b')).toBe(false);
  });
});
