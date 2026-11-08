import type { GitAuthSettingsPublic, GitSettingsPublic, GitStatusPayload } from '../../shared/api/contracts/git/types';
import { hasStoredGitAuthFromServer } from './gitConnectWizard';

export const hasGitRemoteConfigured = (status: GitStatusPayload | undefined): boolean => (
  Boolean(status?.remoteUrl?.trim())
);

export const shouldShowGitConnectPrompt = (status: GitStatusPayload | undefined): boolean => {
  if (!status) {
    return false;
  }

  if (status.integrationSuppressed) {
    return true;
  }

  if (
    status.isEnabled
    && status.isConfigured
    && (status.status === 'connected' || status.status === 'error')
  ) {
    return false;
  }

  return !status.isRepository
    || !status.isEnabled
    || !status.isConfigured
    || status.status === 'disabled'
    || status.status === 'not_configured';
};

export const isGitConnected = (status: GitStatusPayload | undefined): boolean => (
  Boolean(status?.isEnabled && status?.isConfigured && status.status === 'connected')
);

export const shouldShowConnectRemotePrompt = (
  status: GitStatusPayload | undefined,
  _settings?: GitSettingsPublic | undefined,
): boolean => {
  if (!status?.isEnabled || !status.isRepository) {
    return false;
  }

  if (shouldShowGitConnectPrompt(status)) {
    return false;
  }

  return !hasGitRemoteConfigured(status);
};

export const shouldShowGitDisconnect = (
  status: GitStatusPayload | undefined,
  auth?: GitAuthSettingsPublic,
): boolean => (
  hasStoredGitAuthFromServer(auth ?? status?.auth) || hasGitRemoteConfigured(status)
);
