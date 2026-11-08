import { describe, expect, it } from 'vitest';
import { isAuthHardeningLocked } from '../authPolicy';

describe('authPolicy', () => {
  it('locks auth hardening in development', () => {
    expect(isAuthHardeningLocked('development')).toBe(true);
    expect(isAuthHardeningLocked(undefined)).toBe(true);
  });

  it('unlocks auth hardening in production and test', () => {
    expect(isAuthHardeningLocked('production')).toBe(false);
    expect(isAuthHardeningLocked('test')).toBe(false);
  });
});
