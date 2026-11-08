import { describe, expect, it } from 'vitest';
import {
  IdentityProviderValidationError,
  mergeIdentityProviderSecrets,
  normalizeIdentityProvider,
  normalizeIdentityProviders,
  redactIdentityProvider,
} from '../identityProviderValidators';

describe('identityProviderValidators', () => {
  it('normalizes a Google OAuth provider', () => {
    const entry = normalizeIdentityProvider({
      id: 'google-main',
      kind: 'google-oauth',
      label: 'Google',
      enabled: true,
      autoProvision: true,
      clientId: 'client-id',
      clientSecret: 'secret',
      redirectUri: 'http://localhost:3000/api/auth/oauth/google-main/callback',
    });

    expect(entry.id).toBe('google-main');
    expect(entry.kind).toBe('google-oauth');
    expect(entry.autoProvision).toBe(true);
  });

  it('rejects duplicate provider ids', () => {
    expect(() => normalizeIdentityProviders([
      { id: 'github', kind: 'github-oauth', label: 'GitHub', clientId: 'a', redirectUri: 'http://x' },
      { id: 'github', kind: 'github-oauth', label: 'GitHub 2', clientId: 'b', redirectUri: 'http://y' },
    ])).toThrow(IdentityProviderValidationError);
  });

  it('redacts secrets in public config', () => {
    const redacted = redactIdentityProvider({
      id: 'github-main',
      kind: 'github-oauth',
      label: 'GitHub',
      enabled: true,
      autoProvision: false,
      clientId: 'id',
      clientSecret: 'top-secret',
      redirectUri: 'http://localhost/cb',
    });

    expect(redacted.hasClientSecret).toBe(true);
    expect(redacted.clientSecret).toBe('••••••••');
    expect(redacted.clientId).toBe('id');
  });

  it('requires issuerUrl for oidc-generic', () => {
    expect(() => normalizeIdentityProvider({
      id: 'oidc-main',
      kind: 'oidc-generic',
      label: 'OIDC',
      clientId: 'client',
      redirectUri: 'http://localhost:3000/api/auth/oauth/oidc-main/callback',
    })).toThrow('requires issuerUrl');
  });

  it('requires issuerUrl for microsoft-oauth', () => {
    expect(() => normalizeIdentityProvider({
      id: 'microsoft-main',
      kind: 'microsoft-oauth',
      label: 'Microsoft',
      clientId: 'client',
      redirectUri: 'http://localhost:3000/api/auth/oauth/microsoft-main/callback',
    })).toThrow('requires issuerUrl');
  });

  it('normalizes microsoft-oauth with issuerUrl', () => {
    const entry = normalizeIdentityProvider({
      id: 'microsoft-main',
      kind: 'microsoft-oauth',
      label: 'Microsoft',
      clientId: 'client',
      redirectUri: 'http://localhost:3000/api/auth/oauth/microsoft-main/callback',
      issuerUrl: 'https://login.microsoftonline.com/common/v2.0',
    });

    expect(entry.kind).toBe('microsoft-oauth');
    expect(entry.issuerUrl).toBe('https://login.microsoftonline.com/common/v2.0');
  });

  it('preserves existing secrets when incoming value is redacted', () => {
    const merged = mergeIdentityProviderSecrets(
      {
        id: 'github-main',
        kind: 'github-oauth',
        label: 'GitHub',
        enabled: true,
        autoProvision: false,
        clientId: 'id',
        clientSecret: '••••••••',
        redirectUri: 'http://localhost/cb',
      },
      {
        id: 'github-main',
        kind: 'github-oauth',
        label: 'GitHub',
        enabled: true,
        autoProvision: false,
        clientId: 'id',
        clientSecret: 'stored-secret',
        redirectUri: 'http://localhost/cb',
      },
    );

    expect(merged.clientSecret).toBe('stored-secret');
  });
});
