import type { GitConnectMode, GitSettings } from './types';

export const REDACTED_GIT_TOKEN = '••••••••';

export const DEFAULT_GIT_REMOTE_NAME = 'origin';

export const GIT_CONNECT_MODES: readonly GitConnectMode[] = ['full', 'remoteOnly'];

export const DEFAULT_GIT_SETTINGS: GitSettings = {
  enabled: false,
  integrationSuppressed: false,
  commitMessage: {
    autoGenerateEnabled: true,
    template: '',
  },
  pr: {
    provider: 'github',
  },
};
