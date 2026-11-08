import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_GIT_SETTINGS } from '../../../../shared/api/contracts/git/constants';
import { resolveGitPrStatus } from '../gitPrStatus';

vi.mock('../../../../core/ai/tools/native/git/gitRunner', () => ({
  getGitCurrentBranch: vi.fn(),
  assertGitRepository: vi.fn(() => ({ ok: false as const, error: 'not a repo' })),
}));

vi.mock('../gitCredentialStore', () => ({
  readGitCredentials: vi.fn(),
}));

vi.mock('../gitRuntime', () => ({
  resolveGitRuntime: vi.fn(),
}));

import { getGitCurrentBranch } from '../../../../core/ai/tools/native/git/gitRunner';
import { readGitCredentials } from '../gitCredentialStore';
import { resolveGitRuntime } from '../gitRuntime';

const mockedGetGitCurrentBranch = vi.mocked(getGitCurrentBranch);
const mockedReadGitCredentials = vi.mocked(readGitCredentials);
const mockedResolveGitRuntime = vi.mocked(resolveGitRuntime);

describe('resolveGitPrStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
    mockedResolveGitRuntime.mockResolvedValue({
      settings: DEFAULT_GIT_SETTINGS,
      remoteUrl: 'https://github.com/org/repo.git',
      remoteName: 'origin',
      defaultBranch: 'main',
      auth: { kind: 'none' },
      hasCredential: false,
    });
  });

  it('requires a GitHub API token', async () => {
    mockedReadGitCredentials.mockResolvedValue({ kind: 'none' });

    const result = await resolveGitPrStatus({
      ...DEFAULT_GIT_SETTINGS,
      enabled: true,
    });

    expect(result.available).toBe(false);
    expect(result.reason).toContain('GitHub token');
  });

  it('returns no open PR when GitHub has none', async () => {
    mockedReadGitCredentials.mockResolvedValue({ kind: 'https_pat', token: 'test-token' });
    mockedGetGitCurrentBranch.mockResolvedValue('feature/test');
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }));

    const result = await resolveGitPrStatus({
      ...DEFAULT_GIT_SETTINGS,
      enabled: true,
      pr: { provider: 'github', owner: 'org', repo: 'repo' },
    });

    expect(result.available).toBe(true);
    expect(result.branch).toBe('feature/test');
    expect(result.pullRequest).toBeNull();
  });

  it('returns PR summary with checks when open PR exists', async () => {
    mockedReadGitCredentials.mockResolvedValue({ kind: 'https_pat', token: 'test-token' });
    mockedGetGitCurrentBranch.mockResolvedValue('feature/test');
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify([
        {
          number: 42,
          title: 'Add feature',
          state: 'open',
          html_url: 'https://github.com/org/repo/pull/42',
          head: { sha: 'abc123' },
        },
      ]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        state: 'success',
        total_count: 2,
        statuses: [{ state: 'success' }, { state: 'success' }],
      }), { status: 200 }));

    const result = await resolveGitPrStatus({
      ...DEFAULT_GIT_SETTINGS,
      enabled: true,
      pr: { provider: 'github', owner: 'org', repo: 'repo' },
    });

    expect(result.available).toBe(true);
    expect(result.pullRequest?.number).toBe(42);
    expect(result.pullRequest?.checks.state).toBe('success');
    expect(result.pullRequest?.checks.success).toBe(2);
  });
});
