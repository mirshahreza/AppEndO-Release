import { REDACTED_API_KEY } from '../ai/constants';
import type {
  AuthIdentitySettings,
  IdentityProviderConfig,
  IdentityProviderKind,
  IdentityProviderPublicConfig,
} from './identityProviders';

const PROVIDER_ID_RE = /^[a-z][a-z0-9-]{2,63}$/;
const PROVIDER_KINDS = new Set<IdentityProviderKind>([
  'google-oauth',
  'github-oauth',
  'microsoft-oauth',
  'oidc-generic',
  'saml',
]);
const OAUTH_KINDS = new Set<IdentityProviderKind>([
  'google-oauth',
  'github-oauth',
  'microsoft-oauth',
  'oidc-generic',
]);

export class IdentityProviderValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IdentityProviderValidationError';
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

const parseOptionalString = (value: unknown): string | undefined => {
  if (value === undefined || value === null) return undefined;
  return String(value);
};

const normalizeKind = (value: unknown): IdentityProviderKind => {
  const kind = String(value ?? '').trim() as IdentityProviderKind;
  if (!PROVIDER_KINDS.has(kind)) {
    throw new IdentityProviderValidationError(`Provider kind "${kind || '(empty)'}" is not supported.`);
  }
  return kind;
};

export const normalizeIdentityProvider = (value: unknown): IdentityProviderConfig => {
  if (!isRecord(value)) {
    throw new IdentityProviderValidationError('Identity provider entry must be an object.');
  }

  const id = String(value.id ?? '').trim();
  if (!PROVIDER_ID_RE.test(id)) {
    throw new IdentityProviderValidationError(
      `Provider id "${id || '(empty)'}" must match ${PROVIDER_ID_RE.source}.`,
    );
  }

  const kind = normalizeKind(value.kind);
  const label = String(value.label ?? '').trim();
  if (!label) {
    throw new IdentityProviderValidationError(`Provider "${id}" requires a label.`);
  }

  const entry: IdentityProviderConfig = {
    id,
    kind,
    label,
    enabled: value.enabled !== undefined ? Boolean(value.enabled) : true,
    autoProvision: value.autoProvision !== undefined ? Boolean(value.autoProvision) : false,
    defaultRoleId: parseOptionalString(value.defaultRoleId)?.trim() || undefined,
    clientId: parseOptionalString(value.clientId)?.trim() || undefined,
    clientSecret: parseOptionalString(value.clientSecret)?.trim() || undefined,
    hasClientSecret: Boolean(value.hasClientSecret)
      || Boolean(parseOptionalString(value.clientSecret)?.trim()),
    redirectUri: parseOptionalString(value.redirectUri)?.trim() || undefined,
    issuerUrl: parseOptionalString(value.issuerUrl)?.trim() || undefined,
    metadataUrl: parseOptionalString(value.metadataUrl)?.trim() || undefined,
    entryPoint: parseOptionalString(value.entryPoint)?.trim() || undefined,
    certificate: parseOptionalString(value.certificate)?.trim() || undefined,
  };

  if (OAUTH_KINDS.has(kind)) {
    if (!entry.clientId) {
      throw new IdentityProviderValidationError(`OAuth provider "${id}" requires clientId.`);
    }
    if (!entry.redirectUri) {
      throw new IdentityProviderValidationError(`OAuth provider "${id}" requires redirectUri.`);
    }
    if (kind === 'oidc-generic' && !entry.issuerUrl) {
      throw new IdentityProviderValidationError(`OIDC provider "${id}" requires issuerUrl.`);
    }
    if (kind === 'microsoft-oauth' && !entry.issuerUrl) {
      throw new IdentityProviderValidationError(`Microsoft provider "${id}" requires issuerUrl.`);
    }
  }

  if (kind === 'saml') {
    if (!entry.entryPoint) {
      throw new IdentityProviderValidationError(`SAML provider "${id}" requires entryPoint.`);
    }
    if (!entry.certificate) {
      throw new IdentityProviderValidationError(`SAML provider "${id}" requires certificate.`);
    }
  }

  return entry;
};

export const normalizeIdentityProviders = (value: unknown): IdentityProviderConfig[] => {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throw new IdentityProviderValidationError('identityProviders must be an array.');
  }
  const seen = new Set<string>();
  return value.map((item, index) => {
    const entry = normalizeIdentityProvider(item);
    if (seen.has(entry.id)) {
      throw new IdentityProviderValidationError(`Duplicate identity provider id "${entry.id}" at index ${index}.`);
    }
    seen.add(entry.id);
    return entry;
  });
};

export const normalizeAuthIdentitySettings = (value: unknown): AuthIdentitySettings => ({
  identityProviders: normalizeIdentityProviders(
    isRecord(value) ? value.identityProviders : undefined,
  ),
});

export const redactIdentityProvider = (entry: IdentityProviderConfig): IdentityProviderPublicConfig => {
  const hasClientSecret = Boolean(entry.hasClientSecret) || Boolean(entry.clientSecret?.trim());
  const hasCertificate = Boolean(entry.certificate?.trim());
  return {
    ...entry,
    clientSecret: hasClientSecret ? REDACTED_API_KEY : undefined,
    certificate: hasCertificate ? REDACTED_API_KEY : undefined,
    hasClientSecret,
    hasCertificate,
  };
};

export const mergeIdentityProviderSecrets = (
  incoming: IdentityProviderConfig,
  existing: IdentityProviderConfig | undefined,
): IdentityProviderConfig => {
  const incomingSecret = incoming.clientSecret?.trim() ?? '';
  const incomingCert = incoming.certificate?.trim() ?? '';
  return {
    ...incoming,
    clientSecret: !incomingSecret || incomingSecret === REDACTED_API_KEY
      ? existing?.clientSecret
      : incoming.clientSecret,
    hasClientSecret: !incomingSecret || incomingSecret === REDACTED_API_KEY
      ? Boolean(existing?.hasClientSecret) || Boolean(existing?.clientSecret?.trim()) || Boolean(incoming.hasClientSecret)
      : true,
    certificate: !incomingCert || incomingCert === REDACTED_API_KEY
      ? existing?.certificate
      : incoming.certificate,
  };
};
