import { REDACTED_API_KEY } from '../../../../shared/api/contracts/ai/constants';
import { REDACTED_REDIS_PASSWORD } from '../../../../shared/api/contracts/cache/constants';
import { REDACTED_GIT_TOKEN } from '../../../../shared/api/contracts/git/constants';
import type { AiSettings } from '../../../../shared/api/contracts/ai/types';
import type { CacheSettings } from '../../../../shared/api/contracts/cache/types';
import type { GitSettings } from '../../../../shared/api/contracts/git/types';
import type { AuthIdentitySettings, IdentityProviderConfig } from '../../../../shared/api/contracts/auth/identityProviders';
import {
  AI_INBOUND_HOST_OWNER_TYPE,
  AI_MCP_SERVER_OWNER_TYPE,
  AI_PROVIDER_OWNER_TYPE,
  AI_WEB_SEARCH_OWNER_TYPE,
  API_KEY_PURPOSE,
  CLIENT_SECRET_PURPOSE,
  ENV_JSON_PURPOSE,
  GIT_OAUTH_OWNER_TYPE,
  IDENTITY_PROVIDER_OWNER_TYPE,
  PASSWORD_PURPOSE,
  PLATFORM_REDIS_OWNER_TYPE,
  PLATFORM_SETTINGS_OWNER_ID,
  PLATFORM_SMTP_OWNER_TYPE,
  assertNoLegacyPlaintextSecret,
  deletePlatformSecret,
  deletePlatformSecretsForOwner,
  getPlatformSecret,
  isBlankOrRedactedSecret,
  setPlatformSecret,
} from './platformSettingsVault';

export { isLegacySettingsSecretError } from './platformSettingsVault';

const extraAiTokens = [REDACTED_API_KEY];

export const assertEmailSectionHasNoPlaintextSecret = (section: Record<string, unknown>): void => {
  assertNoLegacyPlaintextSecret(section.smtpPass);
};

export const assertCacheSettingsHaveNoPlaintextSecret = (settings: CacheSettings): void => {
  assertNoLegacyPlaintextSecret(settings.storeSettings.redis.password, [REDACTED_REDIS_PASSWORD]);
};

export const assertAiSettingsHaveNoPlaintextSecret = (settings: AiSettings): void => {
  for (const provider of settings.providers) {
    assertNoLegacyPlaintextSecret(provider.apiKey, extraAiTokens);
  }
  assertNoLegacyPlaintextSecret(settings.mcp.inboundHost?.apiKey, extraAiTokens);
  assertNoLegacyPlaintextSecret(settings.webSearch?.apiKey, extraAiTokens);
  for (const server of settings.mcpServers) {
    if (server.env) {
      for (const value of Object.values(server.env)) {
        assertNoLegacyPlaintextSecret(value, extraAiTokens);
      }
    }
  }
};

export const assertGitSettingsHaveNoPlaintextSecret = (settings: GitSettings): void => {
  assertNoLegacyPlaintextSecret(settings.githubOAuth?.clientSecret, [REDACTED_GIT_TOKEN]);
};

export const assertIdentitySettingsHaveNoPlaintextSecret = (settings: AuthIdentitySettings): void => {
  for (const provider of settings.identityProviders) {
    assertNoLegacyPlaintextSecret(provider.clientSecret, extraAiTokens);
  }
};

const hasFlagOrValue = (flag: boolean | undefined, value: string | undefined): boolean => (
  Boolean(flag) || Boolean(value?.trim())
);

export async function syncSmtpPassword(smtpPass: unknown, previousHasPassword: boolean): Promise<boolean> {
  if (isBlankOrRedactedSecret(smtpPass)) {
    return previousHasPassword;
  }
  await setPlatformSecret(
    PLATFORM_SMTP_OWNER_TYPE,
    PLATFORM_SETTINGS_OWNER_ID,
    PASSWORD_PURPOSE,
    String(smtpPass),
  );
  return true;
}

export async function hydrateSmtpPassword(): Promise<string> {
  return await getPlatformSecret(PLATFORM_SMTP_OWNER_TYPE, PLATFORM_SETTINGS_OWNER_ID, PASSWORD_PURPOSE) ?? '';
}

export async function clearSmtpPassword(): Promise<void> {
  await deletePlatformSecret(PLATFORM_SMTP_OWNER_TYPE, PLATFORM_SETTINGS_OWNER_ID, PASSWORD_PURPOSE);
}

export async function syncCacheRedisPassword(
  settings: CacheSettings,
): Promise<CacheSettings> {
  const redis = settings.storeSettings.redis;
  const incoming = redis.password;
  let hasPassword = Boolean(redis.hasPassword);
  if (!isBlankOrRedactedSecret(incoming, [REDACTED_REDIS_PASSWORD])) {
    await setPlatformSecret(
      PLATFORM_REDIS_OWNER_TYPE,
      PLATFORM_SETTINGS_OWNER_ID,
      PASSWORD_PURPOSE,
      String(incoming),
    );
    hasPassword = true;
  }
  if (settings.driver !== 'redis') {
    if (hasPassword) {
      await deletePlatformSecret(PLATFORM_REDIS_OWNER_TYPE, PLATFORM_SETTINGS_OWNER_ID, PASSWORD_PURPOSE);
    }
    hasPassword = false;
  }
  return {
    ...settings,
    storeSettings: {
      ...settings.storeSettings,
      redis: {
        ...redis,
        password: undefined,
        hasPassword,
      },
    },
  };
}

export async function hydrateCacheSecrets(settings: CacheSettings): Promise<CacheSettings> {
  if (settings.driver !== 'redis' || settings.storeSettings.redis.password) {
    return settings;
  }
  if (!settings.storeSettings.redis.hasPassword) {
    return settings;
  }
  const password = await getPlatformSecret(
    PLATFORM_REDIS_OWNER_TYPE,
    PLATFORM_SETTINGS_OWNER_ID,
    PASSWORD_PURPOSE,
  ) ?? undefined;
  return {
    ...settings,
    storeSettings: {
      ...settings.storeSettings,
      redis: {
        ...settings.storeSettings.redis,
        password,
      },
    },
  };
}

export async function syncAiSettingsSecrets(settings: AiSettings): Promise<AiSettings> {
  const providers = [];
  for (const provider of settings.providers) {
    const incoming = provider.apiKey;
    let hasApiKey = hasFlagOrValue(provider.hasApiKey, incoming);
    if (!isBlankOrRedactedSecret(incoming, extraAiTokens)) {
      await setPlatformSecret(AI_PROVIDER_OWNER_TYPE, provider.provider, API_KEY_PURPOSE, incoming as string);
      hasApiKey = true;
    }
    providers.push({
      ...provider,
      apiKey: undefined,
      hasApiKey,
    });
  }

  const inbound = settings.mcp.inboundHost;
  let inboundHasKey = hasFlagOrValue(inbound?.hasApiKey, inbound?.apiKey);
  if (inbound && !isBlankOrRedactedSecret(inbound.apiKey, extraAiTokens)) {
    await setPlatformSecret(
      AI_INBOUND_HOST_OWNER_TYPE,
      PLATFORM_SETTINGS_OWNER_ID,
      API_KEY_PURPOSE,
      inbound.apiKey as string,
    );
    inboundHasKey = true;
  }

  const webSearch = settings.webSearch;
  let webHasKey = hasFlagOrValue(webSearch.hasApiKey, webSearch.apiKey);
  if (!isBlankOrRedactedSecret(webSearch.apiKey, extraAiTokens)) {
    await setPlatformSecret(
      AI_WEB_SEARCH_OWNER_TYPE,
      PLATFORM_SETTINGS_OWNER_ID,
      API_KEY_PURPOSE,
      webSearch.apiKey as string,
    );
    webHasKey = true;
  }

  const mcpServers = [];
  for (const server of settings.mcpServers) {
    const incomingEnv = server.env;
    let hasEnv = Boolean(server.hasEnv) || Boolean(incomingEnv && Object.keys(incomingEnv).length > 0);
    const envIsRedacted = !incomingEnv
      || Object.keys(incomingEnv).length === 0
      || Object.entries(incomingEnv).every(([key, value]) => (
        key === 'REDACTED' || isBlankOrRedactedSecret(value, extraAiTokens)
      ));
    if (!envIsRedacted && incomingEnv) {
      await setPlatformSecret(
        AI_MCP_SERVER_OWNER_TYPE,
        server.id,
        ENV_JSON_PURPOSE,
        JSON.stringify(incomingEnv),
      );
      hasEnv = true;
    }
    mcpServers.push({
      ...server,
      env: undefined,
      hasEnv,
    });
  }

  return {
    ...settings,
    providers,
    mcpServers,
    webSearch: {
      ...webSearch,
      apiKey: undefined,
      hasApiKey: webHasKey,
    },
    mcp: {
      ...settings.mcp,
      inboundHost: inbound
        ? {
          ...inbound,
          apiKey: undefined,
          hasApiKey: inboundHasKey,
        }
        : inbound,
    },
  };
}

export async function hydrateAiSettingsSecrets(settings: AiSettings): Promise<AiSettings> {
  const providers = await Promise.all(settings.providers.map(async (provider) => {
    if (provider.apiKey?.trim() && !isBlankOrRedactedSecret(provider.apiKey, extraAiTokens)) {
      return provider;
    }
    if (!provider.hasApiKey) {
      return { ...provider, apiKey: undefined };
    }
    const apiKey = await getPlatformSecret(AI_PROVIDER_OWNER_TYPE, provider.provider, API_KEY_PURPOSE) ?? undefined;
    return { ...provider, apiKey };
  }));

  const inbound = settings.mcp.inboundHost;
  let inboundApiKey = inbound?.apiKey;
  if (inbound?.hasApiKey && isBlankOrRedactedSecret(inboundApiKey, extraAiTokens)) {
    inboundApiKey = await getPlatformSecret(
      AI_INBOUND_HOST_OWNER_TYPE,
      PLATFORM_SETTINGS_OWNER_ID,
      API_KEY_PURPOSE,
    ) ?? undefined;
  }

  let webApiKey = settings.webSearch.apiKey;
  if (settings.webSearch.hasApiKey && isBlankOrRedactedSecret(webApiKey, extraAiTokens)) {
    webApiKey = await getPlatformSecret(
      AI_WEB_SEARCH_OWNER_TYPE,
      PLATFORM_SETTINGS_OWNER_ID,
      API_KEY_PURPOSE,
    ) ?? undefined;
  }

  const mcpServers = await Promise.all(settings.mcpServers.map(async (server) => {
    if (server.env && Object.keys(server.env).length > 0) {
      return server;
    }
    if (!server.hasEnv) {
      return { ...server, env: undefined };
    }
    const raw = await getPlatformSecret(AI_MCP_SERVER_OWNER_TYPE, server.id, ENV_JSON_PURPOSE);
    if (!raw) {
      return { ...server, env: undefined };
    }
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return { ...server, env: undefined };
      }
      return { ...server, env: parsed as Record<string, string> };
    } catch {
      return { ...server, env: undefined };
    }
  }));

  return {
    ...settings,
    providers,
    mcpServers,
    webSearch: {
      ...settings.webSearch,
      apiKey: webApiKey,
    },
    mcp: {
      ...settings.mcp,
      inboundHost: inbound
        ? { ...inbound, apiKey: inboundApiKey }
        : inbound,
    },
  };
}

export async function syncGitOAuthSecret(settings: GitSettings): Promise<GitSettings> {
  const incoming = settings.githubOAuth?.clientSecret;
  let hasClientSecret = Boolean(settings.githubOAuth?.hasClientSecret) || Boolean(incoming?.trim());
  if (!isBlankOrRedactedSecret(incoming, [REDACTED_GIT_TOKEN])) {
    await setPlatformSecret(
      GIT_OAUTH_OWNER_TYPE,
      PLATFORM_SETTINGS_OWNER_ID,
      CLIENT_SECRET_PURPOSE,
      String(incoming),
    );
    hasClientSecret = true;
  }
  if (!settings.githubOAuth) {
    return settings;
  }
  return {
    ...settings,
    githubOAuth: {
      clientId: settings.githubOAuth.clientId,
      hasClientSecret,
    },
  };
}

export async function hydrateGitOAuthSecret(settings: GitSettings): Promise<string> {
  return await getPlatformSecret(GIT_OAUTH_OWNER_TYPE, PLATFORM_SETTINGS_OWNER_ID, CLIENT_SECRET_PURPOSE) ?? '';
}

export async function syncIdentityProviderSecrets(
  providers: IdentityProviderConfig[],
  previous: IdentityProviderConfig[],
): Promise<IdentityProviderConfig[]> {
  const keptIds = new Set(providers.map((item) => item.id));
  for (const prior of previous) {
    if (!keptIds.has(prior.id)) {
      await deletePlatformSecretsForOwner(IDENTITY_PROVIDER_OWNER_TYPE, prior.id);
    }
  }

  const next: IdentityProviderConfig[] = [];
  for (const provider of providers) {
    const incoming = provider.clientSecret;
    let hasClientSecret = hasFlagOrValue(provider.hasClientSecret, incoming);
    if (!isBlankOrRedactedSecret(incoming, extraAiTokens)) {
      await setPlatformSecret(
        IDENTITY_PROVIDER_OWNER_TYPE,
        provider.id,
        CLIENT_SECRET_PURPOSE,
        incoming as string,
      );
      hasClientSecret = true;
    }
    next.push({
      ...provider,
      clientSecret: undefined,
      hasClientSecret,
    });
  }
  return next;
}

export async function hydrateIdentityProviderSecrets(
  providers: IdentityProviderConfig[],
): Promise<IdentityProviderConfig[]> {
  return Promise.all(providers.map(async (provider) => {
    if (provider.clientSecret?.trim() && !isBlankOrRedactedSecret(provider.clientSecret, extraAiTokens)) {
      return provider;
    }
    if (!provider.hasClientSecret) {
      return { ...provider, clientSecret: undefined };
    }
    const clientSecret = await getPlatformSecret(
      IDENTITY_PROVIDER_OWNER_TYPE,
      provider.id,
      CLIENT_SECRET_PURPOSE,
    ) ?? undefined;
    return { ...provider, clientSecret };
  }));
}

export async function deleteAiProviderSecrets(providerKind: string): Promise<void> {
  await deletePlatformSecretsForOwner(AI_PROVIDER_OWNER_TYPE, providerKind);
}

export async function deleteAiMcpServerSecrets(serverId: string): Promise<void> {
  await deletePlatformSecretsForOwner(AI_MCP_SERVER_OWNER_TYPE, serverId);
}
