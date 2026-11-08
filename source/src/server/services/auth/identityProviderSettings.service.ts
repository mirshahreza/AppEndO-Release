import { SETTINGS_PATH } from '../../config/settingsFile';
import {
  getAuthIdentitySettings,
  getIdentityProviderFromFile,
  mergeIdentityProvider,
  removeIdentityProvider,
  saveAuthIdentitySettingsToFile,
} from '../../db/identityProvidersStore';
import {
  hydrateIdentityProviderSecrets,
  syncIdentityProviderSecrets,
} from '../../domain/security/credentialVault/platformSettingsSecrets';
import { HttpError } from '../../errors/HttpError';
import { reloadIdentityProviderRegistry } from '../../../core/identity/OAuthFlowEngine';
import { testGithubOAuthReachability } from '../../../core/system-extensions/identity-providers/github-oauth/adapter';
import { testGoogleOAuthReachability } from '../../../core/system-extensions/identity-providers/google-oauth/adapter';
import { testMicrosoftOAuthReachability } from '../../../core/system-extensions/identity-providers/microsoft-oauth/adapter';
import { testOidcGenericReachability } from '../../../core/system-extensions/identity-providers/oidc-generic/adapter';
import {
  IdentityProviderValidationError,
  normalizeIdentityProvider,
  redactIdentityProvider,
} from '../../../shared/api/contracts/auth/identityProviderValidators';
import type { IdentityProviderConfig } from '../../../shared/api/contracts/auth/identityProviders';

const assertRedirectUriMatchesProvider = (provider: IdentityProviderConfig): void => {
  const redirectUri = provider.redirectUri?.trim() ?? '';
  if (!redirectUri) {
    throw new HttpError(400, 'redirectUri is required before testing.');
  }

  let parsed: URL;
  try {
    parsed = new URL(redirectUri);
  } catch {
    throw new HttpError(400, 'redirectUri must be a valid absolute URL.');
  }

  const expectedPath = `/api/auth/oauth/${provider.id}/callback`;
  if (parsed.pathname !== expectedPath) {
    throw new HttpError(
      400,
      `Redirect URI path must be ${expectedPath}. Register this exact callback URL in your IdP console.`,
    );
  }
};

export class IdentityProviderSettingsService {
  constructor(private readonly settingsPath: string = SETTINGS_PATH) {}

  private async publish(settings = getAuthIdentitySettings(this.settingsPath)) {
    const hydrated = await hydrateIdentityProviderSecrets(settings.identityProviders);
    reloadIdentityProviderRegistry(hydrated);
    return settings;
  }

  async listProviders() {
    const settings = await this.publish();
    return {
      body: {
        success: true as const,
        identityProviders: settings.identityProviders.map(redactIdentityProvider),
      },
    };
  }

  async createProvider(payload: unknown) {
    try {
      const provider = normalizeIdentityProvider(payload);
      const saved = await mergeIdentityProvider(this.settingsPath, provider, 'create');
      await this.publish(saved);
      const created = saved.identityProviders.find((item) => item.id === provider.id);
      return {
        statusCode: 201,
        body: {
          success: true as const,
          identityProvider: created ? redactIdentityProvider(created) : null,
        },
      };
    } catch (error) {
      if (error instanceof IdentityProviderValidationError) {
        throw new HttpError(400, error.message);
      }
      throw error;
    }
  }

  async updateProvider(id: string, payload: unknown) {
    try {
      const incoming = normalizeIdentityProvider({ ...(payload as object), id });
      const saved = await mergeIdentityProvider(this.settingsPath, incoming, 'update');
      await this.publish(saved);
      const updated = saved.identityProviders.find((item) => item.id === id);
      return {
        body: {
          success: true as const,
          identityProvider: updated ? redactIdentityProvider(updated) : null,
        },
      };
    } catch (error) {
      if (error instanceof IdentityProviderValidationError) {
        throw new HttpError(400, error.message);
      }
      throw error;
    }
  }

  async deleteProvider(id: string) {
    try {
      const saved = await removeIdentityProvider(this.settingsPath, id);
      await this.publish(saved);
      return {
        body: {
          success: true as const,
        },
      };
    } catch (error) {
      if (error instanceof IdentityProviderValidationError) {
        throw new HttpError(404, error.message);
      }
      throw error;
    }
  }

  async testProvider(id: string) {
    const provider = getIdentityProviderFromFile(this.settingsPath, id);
    if (!provider) {
      throw new HttpError(404, 'Identity provider was not found.');
    }

    const clientId = provider.clientId?.trim() ?? '';
    if (!clientId || !provider.redirectUri?.trim()) {
      throw new HttpError(400, 'clientId and redirectUri are required before testing.');
    }

    assertRedirectUriMatchesProvider(provider);

    let result: { ok: boolean; message: string };
    switch (provider.kind) {
      case 'google-oauth':
        result = await testGoogleOAuthReachability();
        break;
      case 'github-oauth':
        result = await testGithubOAuthReachability(clientId);
        break;
      case 'microsoft-oauth':
        result = await testMicrosoftOAuthReachability(provider.issuerUrl ?? '', clientId);
        break;
      case 'oidc-generic':
        result = await testOidcGenericReachability(provider.issuerUrl ?? '', clientId);
        break;
      default:
        throw new HttpError(400, `Test connection is not supported for kind "${provider.kind}".`);
    }

    return {
      body: {
        success: result.ok,
        message: result.message,
      },
    };
  }

  async replaceAllProviders(providers: IdentityProviderConfig[]) {
    const current = getAuthIdentitySettings(this.settingsPath);
    const stripped = await syncIdentityProviderSecrets(providers, current.identityProviders);
    const saved = saveAuthIdentitySettingsToFile(this.settingsPath, { identityProviders: stripped });
    await this.publish(saved);
    return saved;
  }
}

export const initIdentityProviderRuntime = async (settingsPath: string = SETTINGS_PATH): Promise<void> => {
  const settings = getAuthIdentitySettings(settingsPath);
  const hydrated = await hydrateIdentityProviderSecrets(settings.identityProviders);
  reloadIdentityProviderRegistry(hydrated);
};
