/**
 * Marketplace plugins must not register identity-provider System Extensions.
 * Builtin IdPs ship in-tree under src/core/system-extensions/identity-providers/.
 */

export const RESERVED_BUILTIN_IDENTITY_PROVIDER_IDS = new Set([
  'google-oauth',
  'github-oauth',
  'microsoft-oauth',
  'oidc-generic',
]);

const FORBIDDEN_AUTH_ROUTE_PREFIXES = ['/api/auth/oauth/', '/api/auth/saml/'];

export const assertMarketplaceCannotRegisterIdentityProvider = (extensionType: string): void => {
  if (extensionType === 'identity-provider') {
    throw new Error('Marketplace plugins cannot register identity-provider extensions.');
  }
};

export const appendMarketplaceIdentityProviderManifestErrors = (
  m: Record<string, unknown>,
  errors: string[],
): void => {
  for (const field of ['extensionType', 'systemExtensionType'] as const) {
    const value = m[field];
    if (value === undefined) {
      continue;
    }
    if (typeof value !== 'string' || !value.trim()) {
      errors.push(`${field} must be a non-empty string when present.`);
      continue;
    }
    try {
      assertMarketplaceCannotRegisterIdentityProvider(value.trim());
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Invalid identity extension type.');
    }
  }

  if (typeof m.id === 'string' && RESERVED_BUILTIN_IDENTITY_PROVIDER_IDS.has(m.id)) {
    errors.push(`Package id "${m.id}" is reserved for builtin identity-provider System Extensions.`);
  }

  const capabilities = m.capabilities;
  if (!capabilities || typeof capabilities !== 'object' || Array.isArray(capabilities)) {
    return;
  }

  const apis = (capabilities as Record<string, unknown>).apis;
  if (!Array.isArray(apis)) {
    return;
  }

  for (const api of apis) {
    if (!api || typeof api !== 'object' || Array.isArray(api)) {
      continue;
    }
    const path = (api as Record<string, unknown>).path;
    if (typeof path !== 'string') {
      continue;
    }
    if (FORBIDDEN_AUTH_ROUTE_PREFIXES.some((prefix) => path.includes(prefix))) {
      errors.push('Marketplace plugins cannot register auth OAuth/SAML API routes.');
      break;
    }
  }
};
