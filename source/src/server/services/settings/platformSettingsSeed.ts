import fs from 'fs';
import path from 'path';

import { buildDefaultRuntimeSettings } from '../../config/settingsFile';
import { loadAuthSecrets } from '../../config/authSecrets';
import type { PlatformBlobSectionKey } from '../../../shared/api/contracts/settings/scopes';
import { DEFAULT_PLATFORM_FEEDBACK_POLICY } from '../../../shared/api/contracts/feedback/constants';
import { DEFAULT_PLATFORM_ROUTE_LOADING_CONFIG } from '../../../shared/api/contracts/routeLoading/constants';
import {
  getCachedPlatformBlob,
  isPlatformSettingsCacheInitialized,
} from './platformSettingsCache';

export const SETTINGS_EXAMPLE_PATH = path.join(process.cwd(), 'settings.example.json');

export const readPlatformBlobSeedsFromExample = (): Partial<Record<PlatformBlobSectionKey, Record<string, unknown>>> => {
  if (!fs.existsSync(SETTINGS_EXAMPLE_PATH)) {
    return {};
  }

  const example = JSON.parse(fs.readFileSync(SETTINGS_EXAMPLE_PATH, 'utf8')) as Record<string, unknown>;
  const auth = example.auth;
  const identityProviders = auth && typeof auth === 'object' && !Array.isArray(auth)
    ? (auth as Record<string, unknown>).identityProviders
    : [];

  const runtime = example.runtime;
  const security = runtime && typeof runtime === 'object' && !Array.isArray(runtime)
    ? {
      accessTokenSecret: (runtime as Record<string, unknown>).accessTokenSecret,
      refreshTokenSecret: (runtime as Record<string, unknown>).refreshTokenSecret,
    }
    : {};

  return {
    ai: example.ai && typeof example.ai === 'object' ? example.ai as Record<string, unknown> : undefined,
    cache: example.cache && typeof example.cache === 'object' ? example.cache as Record<string, unknown> : undefined,
    platformCultures: example.platformCultures && typeof example.platformCultures === 'object'
      ? example.platformCultures as Record<string, unknown>
      : undefined,
    platformFeedback: {
      policy: DEFAULT_PLATFORM_FEEDBACK_POLICY,
      routingRules: [],
    },
    platformRouteLoading: DEFAULT_PLATFORM_ROUTE_LOADING_CONFIG as unknown as Record<string, unknown>,
    'identity-providers': { identityProviders: Array.isArray(identityProviders) ? identityProviders : [] },
    security: security as Record<string, unknown>,
    scheduler: example.scheduler && typeof example.scheduler === 'object'
      ? example.scheduler as Record<string, unknown>
      : undefined,
    git: example.git && typeof example.git === 'object' ? example.git as Record<string, unknown> : undefined,
  };
};

export const loadAuthSecretsFromPlatformCache = (): void => {
  if (!isPlatformSettingsCacheInitialized()) {
    return;
  }

  const security = getCachedPlatformBlob('security');
  const defaults = buildDefaultRuntimeSettings();
  loadAuthSecrets({
    accessTokenSecret: typeof security?.accessTokenSecret === 'string'
      ? security.accessTokenSecret
      : defaults.accessTokenSecret,
    refreshTokenSecret: typeof security?.refreshTokenSecret === 'string'
      ? security.refreshTokenSecret
      : defaults.refreshTokenSecret,
  });
};
