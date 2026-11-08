import { describe, expect, it } from 'vitest';
import { parseGitPorcelainV2 } from '../gitPorcelainParser';

describe('parseGitPorcelainV2', () => {
  it('parses branch info and change sections', () => {
    const output = [
      '# branch.head main',
      '# branch.ab +2 -1',
      '1 M. N... 100644 100644 0000000 89b69e0 M\tstaged-only.ts',
      '1 .M N... 100644 100644 89b69e0 0000000 M\tunstaged-only.ts',
      '1 MM N... 100644 100644 89b69e0 91c70e1 M\tboth.ts',
      '? untracked.ts',
    ].join('\n');

    const parsed = parseGitPorcelainV2(output);

    expect(parsed.branch).toBe('main');
    expect(parsed.ahead).toBe(2);
    expect(parsed.behind).toBe(1);
    expect(parsed.isClean).toBe(false);
    expect(parsed.entries).toEqual([
      { path: 'staged-only.ts', section: 'staged', statusCode: 'M', denied: false },
      { path: 'unstaged-only.ts', section: 'unstaged', statusCode: 'M', denied: false },
      { path: 'both.ts', section: 'staged', statusCode: 'M', denied: false },
      { path: 'both.ts', section: 'unstaged', statusCode: 'M', denied: false },
      { path: 'untracked.ts', section: 'untracked', statusCode: 'U', denied: false },
    ]);
  });

  it('marks denied paths', () => {
    const output = '? .env';
    const parsed = parseGitPorcelainV2(output);
    expect(parsed.entries[0]).toMatchObject({
      path: '.env',
      section: 'untracked',
      denied: true,
    });
  });

  it('returns clean payload when no entries exist', () => {
    const parsed = parseGitPorcelainV2('# branch.head main\n# branch.ab +0 -0\n');
    expect(parsed.isClean).toBe(true);
    expect(parsed.entries).toEqual([]);
  });

  it('parses space-separated paths emitted by some Git builds on Windows', () => {
    const output = [
      '# branch.head develope-mohsen',
      '1 .M N... 100644 100644 100644 de042ac18971ffa762cfa98a7f5cd1fc5e2d14b1 de042ac18971ffa762cfa98a7f5cd1fc5e2d14b1 src/features/git/components/GitPageView.tsx',
      '? src/features/git/components/GitBranchDropdown.tsx',
    ].join('\n');

    const parsed = parseGitPorcelainV2(output);

    expect(parsed.entries).toEqual([
      { path: 'src/features/git/components/GitPageView.tsx', section: 'unstaged', statusCode: 'M', denied: false },
      { path: 'src/features/git/components/GitBranchDropdown.tsx', section: 'untracked', statusCode: 'U', denied: false },
    ]);
  });
});
