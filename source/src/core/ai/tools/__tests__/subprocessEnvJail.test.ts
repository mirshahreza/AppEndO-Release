import { afterEach, describe, expect, it } from 'vitest';
import { resolveJailedSubprocessEnv } from '../subprocessEnvJail';

describe('V5 P09 § V5-14 — resolveJailedSubprocessEnv (D-008 Option C)', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('excludes application secrets from the jailed env', () => {
    process.env.DATABASE_URL = 'postgres://user:pass@host/db';
    process.env.OPENAI_API_KEY = 'sk-secret';
    process.env.SESSION_SECRET = 'super-secret';

    const jailed = resolveJailedSubprocessEnv();

    expect(jailed.DATABASE_URL).toBeUndefined();
    expect(jailed.OPENAI_API_KEY).toBeUndefined();
    expect(jailed.SESSION_SECRET).toBeUndefined();
  });

  it('preserves the minimal set a subprocess needs to run', () => {
    process.env.PATH = '/usr/bin:/bin';
    process.env.GIT_CONFIG_GLOBAL = '/tmp/gitconfig';

    const jailed = resolveJailedSubprocessEnv();

    expect(jailed.PATH).toBe('/usr/bin:/bin');
    expect(jailed.GIT_CONFIG_GLOBAL).toBe('/tmp/gitconfig');
  });

  it('is a pure recomputation, not a cached snapshot', () => {
    process.env.PATH = '/first';
    const first = resolveJailedSubprocessEnv();
    expect(first.PATH).toBe('/first');

    process.env.PATH = '/second';
    const second = resolveJailedSubprocessEnv();
    expect(second.PATH).toBe('/second');
  });
});
