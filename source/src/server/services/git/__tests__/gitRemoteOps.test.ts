import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_GIT_SETTINGS } from '../../../../shared/api/contracts/git/constants';
import type { GitChangesPayload } from '../../../../shared/api/contracts/git/types';
import { commitGitChanges, suggestGitCommitMessage } from '../gitRemoteOps';
import { HttpError } from '../../../errors/HttpError';

vi.mock('../gitWorkspace', () => ({
  getGitChanges: vi.fn(),
  stageGitPaths: vi.fn(),
}));

vi.mock('../../../../core/ai/tools/native/git/gitRunner', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../core/ai/tools/native/git/gitRunner')>();
  return {
    ...actual,
    runGit: vi.fn(),
  };
});

import { runGit } from '../../../../core/ai/tools/native/git/gitRunner';
import { getGitChanges, stageGitPaths } from '../gitWorkspace';

const mockedGetGitChanges = vi.mocked(getGitChanges);
const mockedStageGitPaths = vi.mocked(stageGitPaths);
const mockedRunGit = vi.mocked(runGit);

const buildChanges = (entries: GitChangesPayload['entries']): GitChangesPayload => ({
  branch: 'main',
  ahead: 0,
  behind: 0,
  isClean: false,
  entries,
});

describe('suggestGitCommitMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds a message from staged modified files', async () => {
    mockedGetGitChanges.mockResolvedValue(buildChanges([
      { path: 'src/a.ts', section: 'staged', statusCode: 'M', denied: false },
      { path: 'src/b.ts', section: 'staged', statusCode: 'M', denied: false },
      { path: 'src/c.ts', section: 'unstaged', statusCode: 'M', denied: false },
    ]));

    const result = await suggestGitCommitMessage(DEFAULT_GIT_SETTINGS);
    expect(result.message).toBe('Update src/a.ts and src/b.ts');
  });

  it('applies commit message template prefix', async () => {
    mockedGetGitChanges.mockResolvedValue(buildChanges([
      { path: 'README.md', section: 'staged', statusCode: 'A', denied: false },
    ]));

    const result = await suggestGitCommitMessage({
      ...DEFAULT_GIT_SETTINGS,
      commitMessage: {
        autoGenerateEnabled: true,
        template: 'chore',
      },
    });

    expect(result.message).toBe('chore: Add README.md');
  });

  it('filters to requested staged paths only', async () => {
    mockedGetGitChanges.mockResolvedValue(buildChanges([
      { path: 'src/a.ts', section: 'staged', statusCode: 'M', denied: false },
      { path: 'src/b.ts', section: 'staged', statusCode: 'M', denied: false },
    ]));

    const result = await suggestGitCommitMessage(DEFAULT_GIT_SETTINGS, ['src/b.ts']);
    expect(result.message).toBe('Update src/b.ts');
  });

  it('builds a message from requested unstaged paths', async () => {
    mockedGetGitChanges.mockResolvedValue(buildChanges([
      { path: 'src/a.ts', section: 'unstaged', statusCode: 'M', denied: false },
      { path: 'src/b.ts', section: 'untracked', statusCode: 'A', denied: false },
    ]));

    const result = await suggestGitCommitMessage(DEFAULT_GIT_SETTINGS, ['src/a.ts', 'src/b.ts']);
    expect(result.message).toBe('Update src/a.ts; Add src/b.ts');
  });
});

describe('commitGitChanges', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedRunGit.mockResolvedValue({ ok: true, stdout: '', stderr: '', truncated: false });
    mockedStageGitPaths.mockResolvedValue({ success: true, message: 'Staged 1 path(s).' });
  });

  it('auto-stages unstaged and untracked paths before committing', async () => {
    mockedGetGitChanges.mockResolvedValue(buildChanges([
      { path: 'src/a.ts', section: 'unstaged', statusCode: 'M', denied: false },
      { path: 'src/b.ts', section: 'untracked', statusCode: 'U', denied: false },
    ]));

    const result = await commitGitChanges('Update workspace');

    expect(mockedRunGit).toHaveBeenCalledWith(['add', '-u']);
    expect(mockedStageGitPaths).toHaveBeenCalledWith(['src/b.ts']);
    expect(mockedRunGit).toHaveBeenCalledWith(['commit', '-m', 'Update workspace']);
    expect(result.message).toBe('Committed changes.');
  });

  it('commits already-staged changes without staging', async () => {
    mockedGetGitChanges.mockResolvedValue(buildChanges([
      { path: 'src/a.ts', section: 'staged', statusCode: 'M', denied: false },
    ]));

    await commitGitChanges('Ship staged work');

    expect(mockedRunGit).not.toHaveBeenCalledWith(['add', '-u']);
    expect(mockedStageGitPaths).not.toHaveBeenCalled();
    expect(mockedRunGit).toHaveBeenCalledWith(['commit', '-m', 'Ship staged work']);
  });

  it('rejects commit when only denied changes exist', async () => {
    mockedGetGitChanges.mockResolvedValue(buildChanges([
      { path: 'settings.json', section: 'unstaged', statusCode: 'M', denied: true },
    ]));

    await expect(commitGitChanges('Blocked')).rejects.toBeInstanceOf(HttpError);
    expect(mockedStageGitPaths).not.toHaveBeenCalled();
    expect(mockedRunGit).not.toHaveBeenCalled();
  });
});
