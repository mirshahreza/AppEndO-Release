import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Sequelize } from 'sequelize';
import { DEFAULT_AI_SETTINGS } from '../../../../../shared/api/contracts/ai/constants';
import { DEFAULT_CACHE_SETTINGS } from '../../../../../shared/api/contracts/cache/constants';
import { LEGACY_SETTINGS_PLAINTEXT_SECRET_ERROR } from '../platformSettingsVault';
import {
  assertAiSettingsHaveNoPlaintextSecret,
  assertCacheSettingsHaveNoPlaintextSecret,
  hydrateAiSettingsSecrets,
  hydrateCacheSecrets,
  hydrateSmtpPassword,
  syncAiSettingsSecrets,
  syncCacheRedisPassword,
  syncSmtpPassword,
} from '../platformSettingsSecrets';
import { getSecret } from '../credentialVault';
import {
  startGitCredentialVaultForTests,
  stopGitCredentialVaultForTests,
} from '../../../../services/git/__tests__/gitCredentialVaultHarness';

describe('platform settings credential vault', () => {
  let sequelize: Sequelize;

  beforeEach(async () => {
    sequelize = await startGitCredentialVaultForTests();
  });

  afterEach(async () => {
    await stopGitCredentialVaultForTests(sequelize);
  });

  it('stores SMTP password and hydrates it back', async () => {
    await syncSmtpPassword('smtp-secret', false);
    expect(await hydrateSmtpPassword()).toBe('smtp-secret');
    expect(await getSecret('platform_smtp', 'app', 'password')).toBe('smtp-secret');
  });

  it('moves a Redis password into the vault and hydrates metadata', async () => {
    const stripped = await syncCacheRedisPassword({
      ...DEFAULT_CACHE_SETTINGS,
      driver: 'redis',
      storeSettings: {
        ...DEFAULT_CACHE_SETTINGS.storeSettings,
        redis: {
          ...DEFAULT_CACHE_SETTINGS.storeSettings.redis,
          password: 'redis-secret',
        },
      },
    });
    expect(stripped.storeSettings.redis.password).toBeUndefined();
    expect(stripped.storeSettings.redis.hasPassword).toBe(true);
    const hydrated = await hydrateCacheSecrets(stripped);
    expect(hydrated.storeSettings.redis.password).toBe('redis-secret');
  });

  it('moves an AI provider key into the vault and hydrates metadata', async () => {
    const incoming = {
      ...DEFAULT_AI_SETTINGS,
      providers: [{ provider: 'openai' as const, providerLabel: 'OpenAI', apiKey: 'sk-test-key' }],
    };
    const stripped = await syncAiSettingsSecrets(incoming);
    const openai = stripped.providers.find((item) => item.provider === 'openai');
    expect(openai?.apiKey).toBeUndefined();
    expect(openai?.hasApiKey).toBe(true);
    const hydrated = await hydrateAiSettingsSecrets(stripped);
    expect(hydrated.providers.find((item) => item.provider === 'openai')?.apiKey).toBe('sk-test-key');
  });

  it('throws when leftover plaintext remains on cache settings', () => {
    expect(() => assertCacheSettingsHaveNoPlaintextSecret({
      ...DEFAULT_CACHE_SETTINGS,
      storeSettings: {
        ...DEFAULT_CACHE_SETTINGS.storeSettings,
        redis: {
          ...DEFAULT_CACHE_SETTINGS.storeSettings.redis,
          password: 'leftover',
        },
      },
    })).toThrow(LEGACY_SETTINGS_PLAINTEXT_SECRET_ERROR);
  });

  it('throws when leftover plaintext remains on AI settings', () => {
    expect(() => assertAiSettingsHaveNoPlaintextSecret({
      ...DEFAULT_AI_SETTINGS,
      providers: [{ provider: 'openai' as const, providerLabel: 'OpenAI', apiKey: 'leftover-key' }],
    })).toThrow(LEGACY_SETTINGS_PLAINTEXT_SECRET_ERROR);
  });
});
