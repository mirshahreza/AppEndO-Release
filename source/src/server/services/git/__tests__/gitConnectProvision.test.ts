import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const gitNativeMocks = vi.hoisted(() => ({
  bareRemotePath: '',
}));

vi.mock('../gitNativeConfig', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../gitNativeConfig')>();
  return {
    ...actual,
    ensureOriginRemote: async (
      remoteUrl: string,
      remoteName?: string,
      cwd?: string,
    ) => {
      const resolvedUrl = gitNativeMocks.bareRemotePath || remoteUrl;
      return actual.ensureOriginRemote(resolvedUrl, remoteName, cwd);
    },
  };
});

import { provisionGitConnect } from '../gitConnectProvision';
import { clearGitCredentials, readGitCredentials } from '../gitCredentialStore';
import { getGitSettingsFromFile } from '../../../db/gitSettingsStore';
import { startGitCredentialVaultForTests, stopGitCredentialVaultForTests } from './gitCredentialVaultHarness';
import type { Sequelize } from 'sequelize';

describe('gitConnectProvision', () => {
  let tempDir = '';
  let previousCwd = '';
  let settingsPath = '';
  let sequelize: Sequelize;

  beforeEach(async () => {
    sequelize = await startGitCredentialVaultForTests();
  });

  afterEach(async () => {
    gitNativeMocks.bareRemotePath = '';
    vi.unstubAllGlobals();
    if (tempDir) {
      await clearGitCredentials();
      process.chdir(previousCwd || process.cwd());
    }
    await stopGitCredentialVaultForTests(sequelize);
    if (tempDir && fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // Windows may keep the temp directory locked briefly after chdir.
      }
      tempDir = '';
    }
  });

  const initGitUser = (cwd: string): void => {
    execFileSync('git', ['config', 'user.email', 'test@appendo.local'], { cwd, encoding: 'utf8' });
    execFileSync('git', ['config', 'user.name', 'AppEndO Test'], { cwd, encoding: 'utf8' });
  };

  const setupWorkspace = (withGit = false): void => {
    previousCwd = process.cwd();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'appendo-git-connect-'));
    process.chdir(tempDir);
    settingsPath = path.join(tempDir, 'settings.json');
    fs.writeFileSync(settingsPath, `${JSON.stringify({ git: { enabled: false } }, null, 2)}\n`, 'utf8');
    if (withGit) {
      fs.writeFileSync('.gitignore', 'settings.json\n.appendo-git-credentials.json\n', 'utf8');
      execFileSync('git', ['init', '-b', 'main'], { encoding: 'utf8' });
      initGitUser(tempDir);
    }
  };

  const createEmptyBareRemote = (): string => {
    const bareDir = path.join(tempDir, 'origin-empty.git');
    fs.mkdirSync(bareDir, { recursive: true });
    execFileSync('git', ['init', '--bare', '-b', 'main'], { cwd: bareDir, encoding: 'utf8' });
    return bareDir;
  };

  const createBareRemoteWithCommit = (fileName: string, content: string): string => {
    const bareDir = path.join(tempDir, 'origin.git');
    fs.mkdirSync(bareDir, { recursive: true });
    execFileSync('git', ['init', '--bare', '-b', 'main'], { cwd: bareDir, encoding: 'utf8' });

    const seedDir = path.join(tempDir, 'origin-seed');
    fs.mkdirSync(seedDir, { recursive: true });
    execFileSync('git', ['init', '-b', 'main'], { cwd: seedDir, encoding: 'utf8' });
    initGitUser(seedDir);
    fs.writeFileSync(path.join(seedDir, fileName), content, 'utf8');
    execFileSync('git', ['add', fileName], { cwd: seedDir, encoding: 'utf8' });
    execFileSync('git', ['commit', '-m', 'seed remote'], { cwd: seedDir, encoding: 'utf8' });
    execFileSync('git', ['remote', 'add', 'origin', bareDir], { cwd: seedDir, encoding: 'utf8' });
    execFileSync('git', ['push', '-u', 'origin', 'main'], { cwd: seedDir, encoding: 'utf8' });

    return bareDir;
  };

  const readWorkspaceFile = (fileName: string): string => (
    fs.readFileSync(path.join(tempDir, fileName), 'utf8')
  );

  const readRemoteCloneFile = (bareRemotePath: string, fileName: string): string => {
    const cloneDir = path.join(tempDir, 'remote-check');
    if (fs.existsSync(cloneDir)) {
      fs.rmSync(cloneDir, { recursive: true, force: true });
    }
    execFileSync('git', ['clone', bareRemotePath, cloneDir], { encoding: 'utf8' });
    return fs.readFileSync(path.join(cloneDir, fileName), 'utf8');
  };

  const stubGithubFetch = (): void => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/user')) {
        return new Response(JSON.stringify({ login: 'octocat' }), { status: 200 });
      }
      if (url.endsWith('/user/repos') && init?.method === 'POST') {
        return new Response(JSON.stringify({ full_name: 'octocat/demo' }), { status: 201 });
      }
      return new Response('{}', { status: 404 });
    }));
  };

  const githubConnectRequest = (sync: 'use_workspace' | 'use_remote') => ({
    mode: 'full' as const,
    auth: { kind: 'https_pat' as const, token: 'gho_test_token', username: 'octocat' },
    repository: {
      connectToGithub: true,
      owner: 'octocat',
      repo: 'demo',
      defaultBranch: 'main',
      repoVisibility: 'private' as const,
      existingRepoSync: sync,
    },
  });

  it('provisions local-only git connect', async () => {
    setupWorkspace();

    const result = await provisionGitConnect({
      mode: 'full',
      auth: { kind: 'none' },
      repository: { connectToGithub: false },
    }, { settingsPath });

    expect(result.success).toBe(true);
    expect(result.mode).toBe('full');
    expect(fs.existsSync('.git')).toBe(true);
    expect(fs.existsSync('.gitignore')).toBe(true);

    const settings = getGitSettingsFromFile(settingsPath);
    expect(settings.enabled).toBe(true);
    expect(settings).not.toHaveProperty('remoteUrl');

    const initStep = result.steps.find((step) => step.id === 'init');
    expect(initStep?.status).toBe('success');
  });

  it('persists credentials and configures origin for github connect', async () => {
    setupWorkspace();
    stubGithubFetch();

    const result = await provisionGitConnect(githubConnectRequest('use_workspace'), { settingsPath });

    expect((await readGitCredentials()).token).toBe('gho_test_token');

    const settings = getGitSettingsFromFile(settingsPath);
    expect(settings.enabled).toBe(true);
    expect(settings.pr?.owner).toBe('octocat');
    expect(settings.pr?.repo).toBe('demo');

    const remoteStep = result.steps.find((step) => step.id === 'remote');
    expect(remoteStep?.status).toBe('success');

    const configuredOrigin = execFileSync(
      'git',
      ['config', '--get', 'remote.origin.url'],
      { encoding: 'utf8' },
    ).trim();
    expect(configuredOrigin).toBe('https://github.com/octocat/demo.git');
  });

  it('skips init when connecting an existing local repository', async () => {
    setupWorkspace(true);
    fs.writeFileSync('README.md', 'existing workspace', 'utf8');
    execFileSync('git', ['add', 'README.md'], { encoding: 'utf8' });
    execFileSync('git', ['commit', '-m', 'existing'], { encoding: 'utf8' });

    const result = await provisionGitConnect({
      mode: 'full',
      auth: { kind: 'none' },
      repository: { connectToGithub: false },
    }, { settingsPath });

    const initStep = result.steps.find((step) => step.id === 'init');
    expect(initStep?.status).toBe('skipped');
    expect(initStep?.message).toContain('existing');
    expect(result.success).toBe(true);
  });

  it('provisions remoteOnly mode on an existing repository', async () => {
    setupWorkspace(true);
    stubGithubFetch();
    gitNativeMocks.bareRemotePath = createEmptyBareRemote();

    const result = await provisionGitConnect({
      mode: 'remoteOnly',
      auth: { kind: 'https_pat', token: 'gho_test_token', username: 'octocat' },
      repository: {
        connectToGithub: true,
        owner: 'octocat',
        repo: 'demo',
        defaultBranch: 'main',
        existingRepoSync: 'use_workspace',
      },
    }, { settingsPath });

    expect(result.mode).toBe('remoteOnly');
    expect(result.success).toBe(true);

    const initStep = result.steps.find((step) => step.id === 'init');
    expect(initStep).toBeUndefined();

    const githubCreateStep = result.steps.find((step) => step.id === 'github_create');
    expect(githubCreateStep?.status).toBe('skipped');
    expect(githubCreateStep?.message).toContain('Remote-only');

    const remoteStep = result.steps.find((step) => step.id === 'remote');
    expect(remoteStep?.status).toBe('success');

    const configuredOrigin = execFileSync(
      'git',
      ['config', '--get', 'remote.origin.url'],
      { encoding: 'utf8' },
    ).trim();
    expect(configuredOrigin).toBe(gitNativeMocks.bareRemotePath);
  });

  it('syncs use_remote by resetting workspace to match origin', async () => {
    setupWorkspace(true);
    stubGithubFetch();
    gitNativeMocks.bareRemotePath = createBareRemoteWithCommit('README.md', 'from-remote');

    fs.writeFileSync('README.md', 'from-workspace', 'utf8');
    execFileSync('git', ['add', 'README.md'], { encoding: 'utf8' });
    execFileSync('git', ['commit', '-m', 'local workspace'], { encoding: 'utf8' });

    const result = await provisionGitConnect(githubConnectRequest('use_remote'), { settingsPath });

    const syncStep = result.steps.find((step) => step.id === 'sync');
    expect(syncStep?.status, syncStep?.message ?? 'missing sync step').toBe('success');
    expect(readWorkspaceFile('README.md')).toBe('from-remote');
    expect(result.status.remoteUrl).toBe(gitNativeMocks.bareRemotePath);
  });

  it('syncs use_workspace by force-pushing local history to origin', async () => {
    setupWorkspace(true);
    stubGithubFetch();
    gitNativeMocks.bareRemotePath = createBareRemoteWithCommit('README.md', 'from-remote');

    fs.writeFileSync('README.md', 'from-workspace', 'utf8');
    execFileSync('git', ['add', 'README.md'], { encoding: 'utf8' });
    execFileSync('git', ['commit', '-m', 'local workspace'], { encoding: 'utf8' });

    const result = await provisionGitConnect(githubConnectRequest('use_workspace'), { settingsPath });

    const syncStep = result.steps.find((step) => step.id === 'sync');
    expect(syncStep?.status).toBe('warning');
    expect(readWorkspaceFile('README.md')).toBe('from-workspace');
    expect(readRemoteCloneFile(gitNativeMocks.bareRemotePath, 'README.md')).toBe('from-workspace');
    expect(result.warnings.some((warning) => warning.includes('Force-pushed'))).toBe(true);
  });

  it('warns when origin URL changes on an existing repository', async () => {
    setupWorkspace(true);
    stubGithubFetch();
    gitNativeMocks.bareRemotePath = createBareRemoteWithCommit('README.md', 'remote baseline');
    execFileSync('git', ['remote', 'add', 'origin', 'https://github.com/old-owner/old-repo.git'], {
      encoding: 'utf8',
    });

    const result = await provisionGitConnect(githubConnectRequest('use_workspace'), { settingsPath });

    const remoteStep = result.steps.find((step) => step.id === 'remote');
    expect(remoteStep?.status).toBe('warning');
    expect(result.warnings.some((warning) => warning.includes('Origin URL changed'))).toBe(true);

    const configuredOrigin = execFileSync(
      'git',
      ['config', '--get', 'remote.origin.url'],
      { encoding: 'utf8' },
    ).trim();
    expect(configuredOrigin).toBe(gitNativeMocks.bareRemotePath);
  });
});
