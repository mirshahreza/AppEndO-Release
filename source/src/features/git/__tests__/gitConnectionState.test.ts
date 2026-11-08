import { describe, expect, it } from 'vitest';
import {
  hasGitRemoteConfigured,
  isGitConnected,
  shouldShowConnectRemotePrompt,
  shouldShowGitConnectPrompt,
  shouldShowGitDisconnect,
} from '../gitConnectionState';
import { createEmptyGitSettingsForm } from '../gitSettingsForm';
import { validateGitPreferencesForm } from '../gitSettingsForm';

describe('gitConnectionState', () => {
  const connectedStatus = {
    status: 'connected' as const,
    isEnabled: true,
    isConfigured: true,
    isRepository: true,
    integrationSuppressed: false,
    currentBranch: 'main',
    workspacePath: '/workspace',
    lastError: null,
    remoteUrl: 'https://github.com/org/repo.git',
    remoteName: 'origin',
    defaultBranch: 'main',
    hasCredential: true,
    usesNativeAuth: false,
    auth: { kind: 'https_pat' as const, hasToken: true },
  };

  it('reads remote configuration from status payload', () => {
    expect(hasGitRemoteConfigured(connectedStatus)).toBe(true);
    expect(hasGitRemoteConfigured({ ...connectedStatus, remoteUrl: null })).toBe(false);
  });

  it('shows connect remote prompt when enabled repo has no origin', () => {
    expect(shouldShowConnectRemotePrompt({
      ...connectedStatus,
      remoteUrl: null,
      status: 'connected',
      isConfigured: true,
    })).toBe(true);
  });

  it('does not use settings for remote detection', () => {
    const settings = {
      enabled: true,
      pr: { provider: 'github' as const, owner: 'org', repo: 'repo' },
    };

    expect(shouldShowConnectRemotePrompt({
      ...connectedStatus,
      remoteUrl: null,
      status: 'connected',
      isConfigured: true,
    }, settings)).toBe(true);
  });

  it('detects connected git workspace', () => {
    expect(isGitConnected(connectedStatus)).toBe(true);
    expect(isGitConnected({ ...connectedStatus, status: 'disabled', isEnabled: false })).toBe(false);
  });

  it('shows disconnect when remote or stored auth exists', () => {
    expect(shouldShowGitDisconnect(connectedStatus)).toBe(true);
    expect(shouldShowGitDisconnect({
      ...connectedStatus,
      remoteUrl: null,
      auth: { kind: 'none' },
    })).toBe(false);
  });

  it('shows connect prompt when git is not configured', () => {
    expect(shouldShowGitConnectPrompt({
      ...connectedStatus,
      isEnabled: false,
      isConfigured: false,
      status: 'disabled',
    })).toBe(true);
  });

  it('hides connect prompt for native-auth connected workspace', () => {
    expect(shouldShowGitConnectPrompt({
      ...connectedStatus,
      hasCredential: false,
      usesNativeAuth: true,
      auth: { kind: 'none' },
    })).toBe(false);
  });

  it('shows connect prompt after explicit disconnect suppression', () => {
    expect(shouldShowGitConnectPrompt({
      ...connectedStatus,
      isEnabled: false,
      isConfigured: false,
      status: 'disabled',
      integrationSuppressed: true,
    })).toBe(true);
  });
});

describe('validateGitPreferencesForm', () => {
  it('accepts preference forms without extra required fields', () => {
    expect(validateGitPreferencesForm(createEmptyGitSettingsForm())).toBeNull();
  });
});
