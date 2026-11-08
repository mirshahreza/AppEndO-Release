import { describe, expect, it } from 'vitest';
import {
  GIT_MAX_OUTPUT_BYTES,
  truncateGitOutput,
  validateGitPath,
  validateGitRef,
} from '../gitRunner';

describe('gitRunner helpers', () => {
  it('validates git refs', () => {
    expect(validateGitRef('HEAD')).toBe('HEAD');
    expect(validateGitRef('main')).toBe('main');
    expect(validateGitRef('abc1234')).toBe('abc1234');
    expect(validateGitRef('')).toBeNull();
    expect(validateGitRef('; rm -rf /')).toBeNull();
  });

  it('validates git paths and denies secrets', () => {
    expect(validateGitPath('src/shared/ui/App.tsx')).toEqual({
      ok: true,
      relativePath: 'src/shared/ui/App.tsx',
    });
    expect(validateGitPath('../etc/passwd').ok).toBe(false);
    expect(validateGitPath('.env').ok).toBe(false);
  });

  it('truncates oversized output', () => {
    const huge = 'x'.repeat(GIT_MAX_OUTPUT_BYTES + 1_000);
    const result = truncateGitOutput(huge);
    expect(result.truncated).toBe(true);
    expect(Buffer.byteLength(result.text, 'utf8')).toBeLessThanOrEqual(GIT_MAX_OUTPUT_BYTES + 64);
    expect(result.text).toContain('[output truncated]');
  });
});
