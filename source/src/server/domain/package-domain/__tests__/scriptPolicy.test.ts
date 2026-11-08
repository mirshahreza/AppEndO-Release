import { describe, expect, it } from 'vitest';
import { isSafeSqlScriptPath } from '../scriptPolicy';
import type { ScriptPolicy } from '../types';

const policy: ScriptPolicy = {
  allowedPathPrefixes: ['db/install/', 'db/uninstall/', 'db/seed/', 'sql/'],
  maxTimeoutMs: 1500,
};

describe('isSafeSqlScriptPath', () => {
  it('accepts scripts under the allowlisted directories', () => {
    expect(isSafeSqlScriptPath('db/install/schema.sql', policy)).toBe(true);
    expect(isSafeSqlScriptPath('db/uninstall/schema.sql', policy)).toBe(true);
    expect(isSafeSqlScriptPath('db/seed/optional-records.sql', policy)).toBe(true);
    expect(isSafeSqlScriptPath('sql/cms.sql', policy)).toBe(true);
  });

  it('rejects SQL files sitting directly under db/', () => {
    expect(isSafeSqlScriptPath('db/install.sql', policy)).toBe(false);
    expect(isSafeSqlScriptPath('db/uninstall.sql', policy)).toBe(false);
    expect(isSafeSqlScriptPath('db/optional-records.sql', policy)).toBe(false);
    expect(isSafeSqlScriptPath('db/optional-records-uninstall.sql', policy)).toBe(false);
  });
});
