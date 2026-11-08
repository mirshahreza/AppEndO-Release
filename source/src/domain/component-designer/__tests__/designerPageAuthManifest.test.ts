import { describe, expect, it } from 'vitest';
import {
  buildDesignerPageDefaultRolesJson,
  buildDesignerPageRouteAuth,
  formatDesignerPageAuthManifestPreview,
  isDesignerSimulatedRoleAllowed,
  resolveDesignerDocumentPageAccess,
} from '../designerPageAccess';

describe('designerPageAccess (CD-J01)', () => {
  it('defaults legacy empty allowedRoles to authenticated access', () => {
    const access = resolveDesignerDocumentPageAccess({});
    expect(access.accessMode).toBe('authenticated');
    expect(buildDesignerPageRouteAuth({})).toEqual(access);
    expect(buildDesignerPageDefaultRolesJson({})).toBeNull();
  });

  it('migrates legacy allowedRoles to specific access', () => {
    const access = resolveDesignerDocumentPageAccess({ allowedRoles: ['ADMIN', 'EDITOR'] });
    expect(access.accessMode).toBe('specific');
    expect(access.allowRoles).toEqual(['ADMIN', 'EDITOR']);
    expect(buildDesignerPageDefaultRolesJson({ allowedRoles: ['ADMIN', 'EDITOR'] })).toBe(
      JSON.stringify(['ADMIN', 'EDITOR']),
    );
  });

  it('formats inspector manifest preview payload', () => {
    const preview = formatDesignerPageAuthManifestPreview({
      pageAccess: {
        accessMode: 'specific',
        allowRoles: ['Finance'],
        allowUsers: [],
        denyRoles: [],
        denyUsers: [],
      },
    });
    expect(preview).toContain('"routeBindingAuth"');
    expect(preview).toContain('"FINANCE"');
    expect(preview).toContain('"pageAccess"');
  });

  it('evaluates simulated role against full access control', () => {
    const document = {
      pageAccess: {
        accessMode: 'specific' as const,
        allowRoles: ['ADMIN'],
        allowUsers: [],
        denyRoles: [],
        denyUsers: [],
      },
    };
    expect(isDesignerSimulatedRoleAllowed(document, 'ADMIN')).toBe(true);
    expect(isDesignerSimulatedRoleAllowed(document, 'USER')).toBe(false);
  });
});
