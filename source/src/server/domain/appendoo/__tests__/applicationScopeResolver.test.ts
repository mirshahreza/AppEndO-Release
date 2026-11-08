import { describe, expect, it } from 'vitest';
import { resolveApplicationScope } from '../applicationScopeResolver';

describe('resolveApplicationScope', () => {
  it('resolves studio platform scope with pageKey from path', () => {
    const scope = resolveApplicationScope({
      path: '/us/studio/server-functions',
      pageKey: 'server-functions',
    });

    expect(scope).toEqual({
      kind: 'platform',
      scopeKey: 'platform:studio:page:server-functions',
      mountId: 'studio',
      cultureId: 'us',
      portalSegment: 'studio',
      pageKey: 'server-functions',
    });
  });

  it('infers pageKey from path segments when omitted', () => {
    const scope = resolveApplicationScope({
      path: '/us/studio/chat-history',
    });

    expect(scope?.pageKey).toBe('chat-history');
    expect(scope?.scopeKey).toBe('platform:studio:page:chat-history');
  });

  it('resolves package scope from packageId hint', () => {
    const scope = resolveApplicationScope({
      packageId: 'crm-demo',
    });

    expect(scope).toEqual({
      kind: 'package',
      scopeKey: 'package:crm-demo',
      mountId: 'studio',
      packageId: 'crm-demo',
      ownerPackageId: 'crm-demo',
    });
  });

  it('resolves vertical_app scope when hinted', () => {
    const scope = resolveApplicationScope({
      packageId: 'hr-app',
      scopeKindHint: 'vertical_app',
    });

    expect(scope?.kind).toBe('vertical_app');
    expect(scope?.scopeKey).toBe('vertical:hr-app');
  });

  it('returns null when no path or package hints', () => {
    expect(resolveApplicationScope({})).toBeNull();
  });
});
