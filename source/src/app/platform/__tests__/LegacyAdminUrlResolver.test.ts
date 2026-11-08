import { describe, expect, it } from 'vitest';
import { bootstrapCultureRegistry } from '../../../core/culture/CultureRegistry';
import {
  STUDIO_PORTAL_SEGMENT,
  LEGACY_ADMIN_ROUTE_NAMESPACE,
} from '../../../shared/api/contracts/platform/mountConstants';
import type { PlatformRuntimeConfig } from '../../../shared/api/contracts/platform/types';
import {
  resolveBareStudioCultureRedirect,
  resolveInvalidCulturePrefixRedirect,
  resolveLegacyAdminCanonicalRedirect,
  resolveLegacyStudioPageAliasRedirect,
  resolveLegacyRoutingRedirect,
} from '../LegacyAdminUrlResolver';

const runtimeConfig: PlatformRuntimeConfig = {
  version: 'legacy-admin-v1',
  mounts: [],
  shells: [
    {
      shellKey: 'admin',
      name: 'Admin Layout',
      entry: 'core:AdminLayout',
      surface: 'admin',
      enabled: true,
    },
    {
      shellKey: 'designer',
      name: 'Designer Shell',
      entry: 'core:DesignerShell',
      surface: 'designer',
      enabled: true,
    },
  ],
  shellRules: [
    {
      id: 1,
      mountId: 'studio',
      pathPrefix: '/studio/client-components',
      shellKey: 'designer',
      priority: 10,
      enabled: true,
    },
  ],
  pageModules: [],
  bindings: [],
  navigations: [],
};

describe('LegacyAdminUrlResolver', () => {
  it('redirects legacy /admin/users to /us/studio/users', () => {
    bootstrapCultureRegistry(['us', 'ir']);
    expect(resolveLegacyAdminCanonicalRedirect('/admin/users', runtimeConfig)).toBe(
      `/us/${STUDIO_PORTAL_SEGMENT}/users`,
    );
  });

  it('redirects /us/admin/users to /us/studio/users', () => {
    bootstrapCultureRegistry(['us', 'ir']);
    expect(resolveLegacyAdminCanonicalRedirect(`/us/${LEGACY_ADMIN_ROUTE_NAMESPACE}/users`, runtimeConfig)).toBe(
      `/us/${STUDIO_PORTAL_SEGMENT}/users`,
    );
  });

  it('redirects /ir/admin/users to /ir/studio/users', () => {
    bootstrapCultureRegistry(['us', 'ir']);
    expect(resolveLegacyAdminCanonicalRedirect(`/ir/${LEGACY_ADMIN_ROUTE_NAMESPACE}/users`, runtimeConfig)).toBe(
      `/ir/${STUDIO_PORTAL_SEGMENT}/users`,
    );
  });

  it('redirects mistyped culture /ui/studio/cms/contents to /us/studio/cms/contents', () => {
    bootstrapCultureRegistry(['us', 'ir']);
    expect(resolveInvalidCulturePrefixRedirect('/ui/studio/cms/contents')).toBe(
      `/us/${STUDIO_PORTAL_SEGMENT}/cms/contents`,
    );
  });

  it('redirects mistyped culture /ux/studio/cms/contents to /us/studio/cms/contents', () => {
    bootstrapCultureRegistry(['us', 'ir']);
    expect(resolveInvalidCulturePrefixRedirect('/ux/studio/cms/contents')).toBe(
      `/us/${STUDIO_PORTAL_SEGMENT}/cms/contents`,
    );
    expect(resolveLegacyRoutingRedirect('/ux/studio/cms/contents', runtimeConfig)).toBe(
      `/us/${STUDIO_PORTAL_SEGMENT}/cms/contents`,
    );
  });

  it('does not redirect canonical /us/studio/users', () => {
    bootstrapCultureRegistry(['us']);
    expect(resolveLegacyAdminCanonicalRedirect('/us/studio/users', runtimeConfig)).toBeNull();
  });

  it('redirects bare /studio/users to /us/studio/users', () => {
    bootstrapCultureRegistry(['us', 'ir']);
    expect(resolveBareStudioCultureRedirect('/studio/users', runtimeConfig)).toBe(
      `/us/${STUDIO_PORTAL_SEGMENT}/users`,
    );
  });

  it('does not redirect designer /studio/client-components', () => {
    bootstrapCultureRegistry(['us']);
    expect(resolveBareStudioCultureRedirect('/studio/client-components', runtimeConfig)).toBeNull();
  });

  it('does not redirect explicit culture /us/designer/client-components', () => {
    bootstrapCultureRegistry(['us']);
    expect(resolveLegacyRoutingRedirect('/us/designer/client-components', runtimeConfig)).toBeNull();
  });

  it('redirects legacy /us/studio/edge to /us/studio/server-functions', () => {
    bootstrapCultureRegistry(['us']);
    expect(resolveLegacyStudioPageAliasRedirect('/us/studio/edge')).toBe(
      `/us/${STUDIO_PORTAL_SEGMENT}/server-functions`,
    );
  });

  it('redirects legacy /us/edge to /us/studio/server-functions', () => {
    bootstrapCultureRegistry(['us']);
    expect(resolveLegacyStudioPageAliasRedirect('/us/edge')).toBe(
      `/us/${STUDIO_PORTAL_SEGMENT}/server-functions`,
    );
  });

  it('redirects legacy /us/studio/applications to /us/studio/portals', () => {
    bootstrapCultureRegistry(['us']);
    expect(resolveLegacyStudioPageAliasRedirect('/us/studio/applications')).toBe(
      `/us/${STUDIO_PORTAL_SEGMENT}/portals`,
    );
  });

  it('redirects legacy /us/studio/sandbox to /us/studio/base-components', () => {
    bootstrapCultureRegistry(['us']);
    expect(resolveLegacyStudioPageAliasRedirect('/us/studio/sandbox')).toBe(
      `/us/${STUDIO_PORTAL_SEGMENT}/base-components`,
    );
    expect(resolveLegacyStudioPageAliasRedirect('/us/studio/sandbox/dialog')).toBe(
      `/us/${STUDIO_PORTAL_SEGMENT}/base-components/dialog`,
    );
  });

  it('redirects legacy hub page segments to sftp / ssh / rdp', () => {
    bootstrapCultureRegistry(['us']);
    expect(resolveLegacyStudioPageAliasRedirect('/us/studio/file-hub')).toBe(
      `/us/${STUDIO_PORTAL_SEGMENT}/sftp`,
    );
    expect(resolveLegacyStudioPageAliasRedirect('/us/studio/ssh-hub/edit/edge-db')).toBe(
      `/us/${STUDIO_PORTAL_SEGMENT}/ssh/edit/edge-db`,
    );
    expect(resolveLegacyStudioPageAliasRedirect('/us/studio/rdp-hub')).toBe(
      `/us/${STUDIO_PORTAL_SEGMENT}/rdp`,
    );
    expect(resolveLegacyStudioPageAliasRedirect('/us/studio/ssh')).toBeNull();
  });

  it('redirects legacy /us/studio/extensions/{page} to flat studio pages', () => {
    bootstrapCultureRegistry(['us']);
    expect(resolveLegacyStudioPageAliasRedirect('/us/studio/extensions/package-manager')).toBe(
      `/us/${STUDIO_PORTAL_SEGMENT}/package-manager`,
    );
    expect(resolveLegacyStudioPageAliasRedirect('/us/studio/extensions/libraries')).toBe(
      `/us/${STUDIO_PORTAL_SEGMENT}/libraries`,
    );
    expect(resolveLegacyStudioPageAliasRedirect('/us/studio/package-manager')).toBeNull();
    expect(resolveLegacyStudioPageAliasRedirect('/us/studio/libraries')).toBeNull();
  });

  it('redirects legacy /us/studio/workflows/{key} to /us/studio/workflows/edit/{key}', () => {
    bootstrapCultureRegistry(['us']);
    expect(resolveLegacyStudioPageAliasRedirect('/us/studio/workflows/scn-07-multi-stage-approval')).toBe(
      `/us/${STUDIO_PORTAL_SEGMENT}/workflows/edit/scn-07-multi-stage-approval`,
    );
    expect(resolveLegacyStudioPageAliasRedirect('/us/studio/workflows')).toBeNull();
    expect(resolveLegacyStudioPageAliasRedirect('/us/studio/workflows/edit/scn-07-multi-stage-approval')).toBeNull();
  });

  it('redirects legacy /us/studio/workflow-designer/{key} to /us/studio/workflows/edit/{key}', () => {
    bootstrapCultureRegistry(['us']);
    expect(resolveLegacyStudioPageAliasRedirect('/us/studio/workflow-designer/scn-07-multi-stage-approval')).toBe(
      `/us/${STUDIO_PORTAL_SEGMENT}/workflows/edit/scn-07-multi-stage-approval`,
    );
  });

  it('redirects legacy /us/studio/server-functions/{folder}/{name} to edit URLs', () => {
    bootstrapCultureRegistry(['us']);
    expect(resolveLegacyStudioPageAliasRedirect('/us/studio/server-functions/auth/login')).toBe(
      `/us/${STUDIO_PORTAL_SEGMENT}/server-functions/edit/auth/login`,
    );
    expect(resolveLegacyStudioPageAliasRedirect('/us/studio/server-functions/new')).toBe(
      `/us/${STUDIO_PORTAL_SEGMENT}/server-functions/edit/new`,
    );
    expect(resolveLegacyStudioPageAliasRedirect('/us/studio/server-functions/edit/auth/login')).toBeNull();
  });

  it('redirects legacy /us/studio/data-studio/{objectName} to edit URLs', () => {
    bootstrapCultureRegistry(['us']);
    expect(resolveLegacyStudioPageAliasRedirect('/us/studio/data-studio/test_products')).toBe(
      `/us/${STUDIO_PORTAL_SEGMENT}/data-studio/edit/test_products`,
    );
    expect(resolveLegacyStudioPageAliasRedirect('/us/studio/data-studio/edit/test_products')).toBeNull();
    expect(resolveLegacyStudioPageAliasRedirect('/us/studio/data-studio')).toBeNull();
  });

  it('redirects legacy client-components live-designer and classic paths to edit URLs', () => {
    bootstrapCultureRegistry(['us']);
    expect(resolveLegacyStudioPageAliasRedirect('/us/studio/client-components/live-designer/general/test-c')).toBe(
      `/us/${STUDIO_PORTAL_SEGMENT}/client-components/edit/test-c`,
    );
    expect(resolveLegacyStudioPageAliasRedirect('/us/studio/client-components/general/test-c')).toBe(
      `/us/${STUDIO_PORTAL_SEGMENT}/client-components/edit/test-c`,
    );
    expect(resolveLegacyStudioPageAliasRedirect('/us/studio/client-components/edit/general/test-c')).toBe(
      `/us/${STUDIO_PORTAL_SEGMENT}/client-components/edit/test-c`,
    );
    expect(resolveLegacyStudioPageAliasRedirect('/us/studio/client-components/edit/test-c')).toBeNull();
  });
});
