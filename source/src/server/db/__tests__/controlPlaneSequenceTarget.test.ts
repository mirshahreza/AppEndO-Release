import { describe, expect, it } from 'vitest';

import { assertControlPlaneSequenceTarget } from '../controlPlaneSeed';

describe('assertControlPlaneSequenceTarget', () => {
  it('accepts the known identity tables', () => {
    expect(() => assertControlPlaneSequenceTarget('base_users', 'id')).not.toThrow();
    expect(() => assertControlPlaneSequenceTarget('base_roles', 'id')).not.toThrow();
  });

  it('rejects interpolated identifiers outside the allowlist', () => {
    expect(() => assertControlPlaneSequenceTarget('base_users; DROP TABLE base_users;--', 'id'))
      .toThrow(/unlisted table/);
    expect(() => assertControlPlaneSequenceTarget('base_auth_refresh_tokens', 'id'))
      .toThrow(/unlisted table/);
    expect(() => assertControlPlaneSequenceTarget('base_users', 'password_hash'))
      .toThrow(/unlisted column/);
  });
});
