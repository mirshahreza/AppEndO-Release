import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  assertJwtSecretsForBoot,
  loadAuthSecrets,
  resetAuthSecretsForTests,
  usesDefaultJwtSecrets,
} from '../authSecrets';

describe('assertJwtSecretsForBoot', () => {
  beforeEach(() => {
    resetAuthSecretsForTests();
  });

  afterEach(() => {
    resetAuthSecretsForTests();
  });

  it('throws in production when placeholder JWT secrets are active', () => {
    expect(usesDefaultJwtSecrets()).toBe(true);
    expect(() => assertJwtSecretsForBoot(true)).toThrow(/Production boot blocked/);
  });

  it('does not throw outside production when placeholder secrets are active', () => {
    expect(() => assertJwtSecretsForBoot(false)).not.toThrow();
  });

  it('does not throw in production when secrets are configured', () => {
    loadAuthSecrets({
      accessTokenSecret: 'configured-access-secret-for-tests',
      refreshTokenSecret: 'configured-refresh-secret-for-tests',
    });
    expect(() => assertJwtSecretsForBoot(true)).not.toThrow();
  });
});
