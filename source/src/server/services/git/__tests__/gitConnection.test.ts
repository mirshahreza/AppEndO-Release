import { describe, expect, it } from 'vitest';
import { normalizeGitAuthSettings } from '../../../../shared/api/contracts/git/validators';
import { resolveGitToken } from '../gitConnection';

describe('gitConnection helpers', () => {
  it('resolves token from environment key', () => {
    const previous = process.env.TEST_GIT_TOKEN;
    process.env.TEST_GIT_TOKEN = 'from-env';
    try {
      const token = resolveGitToken({
        kind: 'https_pat',
        tokenEnvKey: 'TEST_GIT_TOKEN',
      });
      expect(token).toBe('from-env');
    } finally {
      if (previous === undefined) {
        delete process.env.TEST_GIT_TOKEN;
      } else {
        process.env.TEST_GIT_TOKEN = previous;
      }
    }
  });

  it('falls back to inline token when env is empty', () => {
    const auth = normalizeGitAuthSettings({
      kind: 'https_pat',
      token: 'inline-token',
    });
    expect(resolveGitToken(auth)).toBe('inline-token');
  });
});
