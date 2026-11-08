export type OidcDiscoveryDocument = {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint?: string;
  jwks_uri?: string;
};

const CACHE_TTL_MS = 5 * 60 * 1000;
const discoveryCache = new Map<string, { doc: OidcDiscoveryDocument; expiresAt: number }>();

export const normalizeIssuerUrl = (issuerUrl: string): string => issuerUrl.trim().replace(/\/+$/, '');

export const __resetOidcDiscoveryCacheForTests = (): void => {
  discoveryCache.clear();
};

export const fetchOidcDiscovery = async (issuerUrl: string): Promise<OidcDiscoveryDocument> => {
  const normalized = normalizeIssuerUrl(issuerUrl);
  if (!normalized) {
    throw new Error('issuerUrl is required.');
  }

  const cached = discoveryCache.get(normalized);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.doc;
  }

  const response = await fetch(`${normalized}/.well-known/openid-configuration`);
  if (!response.ok) {
    throw new Error(`OIDC discovery returned HTTP ${response.status}.`);
  }

  const payload = await response.json() as Record<string, unknown>;
  const authorizationEndpoint = String(payload.authorization_endpoint ?? '').trim();
  const tokenEndpoint = String(payload.token_endpoint ?? '').trim();
  const issuer = String(payload.issuer ?? normalized).trim();

  if (!authorizationEndpoint || !tokenEndpoint) {
    throw new Error('OIDC discovery document is missing authorization or token endpoint.');
  }

  const doc: OidcDiscoveryDocument = {
    issuer,
    authorization_endpoint: authorizationEndpoint,
    token_endpoint: tokenEndpoint,
    userinfo_endpoint: typeof payload.userinfo_endpoint === 'string'
      ? payload.userinfo_endpoint.trim()
      : undefined,
    jwks_uri: typeof payload.jwks_uri === 'string' ? payload.jwks_uri.trim() : undefined,
  };

  discoveryCache.set(normalized, { doc, expiresAt: Date.now() + CACHE_TTL_MS });
  return doc;
};

export const decodeIdTokenPayload = (idToken: string): Record<string, unknown> => {
  const parts = idToken.split('.');
  if (parts.length < 2) {
    throw new Error('Invalid id_token format.');
  }
  const payload = Buffer.from(parts[1], 'base64url').toString('utf8');
  return JSON.parse(payload) as Record<string, unknown>;
};

export const testOidcDiscoveryReachability = async (
  issuerUrl: string,
  clientId: string,
  label: string,
): Promise<{ ok: boolean; message: string }> => {
  const trimmedClientId = clientId.trim();
  if (!trimmedClientId) {
    return { ok: false, message: 'clientId is required.' };
  }
  if (!issuerUrl.trim()) {
    return { ok: false, message: 'issuerUrl is required.' };
  }

  try {
    const discovery = await fetchOidcDiscovery(issuerUrl);
    return {
      ok: true,
      message: `Config shape OK — ${label} OIDC discovery reachable (issuer: ${discovery.issuer}).`,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : `${label} OIDC discovery request failed.`,
    };
  }
};
