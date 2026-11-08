import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import AdmZip from 'adm-zip';
import { validateManifest } from '../PackageManifestValidator';
import {
  REMOTE_HUBS_LIBRARIES,
  REMOTE_HUBS_NAV_HEADING,
  REMOTE_HUBS_PACKAGE_ID,
} from '../remoteHubsPackage';
import {
  buildRemoteHubsCultureKeys,
  buildRemoteHubsManifestDraft,
  buildRemoteHubsNavigationPatch,
  REMOTE_HUBS_CULTURE_KEYS_ENTRY,
  REMOTE_HUBS_NAV_PATCH_ENTRY,
  REMOTE_HUBS_UI_ROUTES,
} from '../remoteHubsPackagePackRecipe';
import { navGroupKey } from '../../culture/cultureShellKeys';
import { parseNavigationPatchPayload } from '../../../server/services/package-runtime/packageNavigationPatch.service';
import { buildRemoteHubsPackageZip } from '../remoteHubsPackageZip';
import studioNav from '../../../config/platform-registry/navigation/studio.json';

describe('Remote Hubs package recipe', () => {
  it('builds a valid pack manifest with libraries and Studio extras', () => {
    const draft = buildRemoteHubsManifestDraft();
    const result = validateManifest(draft);
    expect(result.valid, result.errors.join('\n')).toBe(true);
    expect(result.manifest?.id).toBe(REMOTE_HUBS_PACKAGE_ID);
    expect(result.manifest?.libraries).toEqual(REMOTE_HUBS_LIBRARIES);
    expect(result.manifest?.capabilities.ui_routes).toEqual([...REMOTE_HUBS_UI_ROUTES]);
    expect(REMOTE_HUBS_UI_ROUTES.map((route) => route.entry)).toEqual([
      'ui/sftp.tsx',
      'ui/ssh.tsx',
      'ui/rdp.tsx',
    ]);
  });

  it('names the Studio group Remote Hubs with the three hub pages', () => {
    const patch = buildRemoteHubsNavigationPatch();
    expect(patch.heading).toBe(REMOTE_HUBS_NAV_HEADING);
    expect(patch.headingOrder).toBe(6);
    expect(patch.items.map((item) => item.pageKey)).toEqual(['ssh-hub', 'file-hub', 'rdp-hub']);
    expect(patch.items.map((item) => item.label)).toEqual(['SSH', 'Sftp', 'RDP']);
    expect(patch.items.map((item) => item.routePattern)).toEqual(['ssh/*', 'sftp/*', 'rdp/*']);
    expect(patch.items.find((item) => item.pageKey === 'rdp-hub')?.separatorBefore).toBe(true);
    const parsed = parseNavigationPatchPayload(JSON.stringify(patch));
    expect(parsed?.headingOrder).toBe(6);
    expect(parsed?.headingIcon).toBe('tabler:IconNetwork');
    expect(parsed?.items[0]?.auth?.allowRoles).toEqual(['ADMIN']);
    expect(parsed?.items.find((item) => item.pageKey === 'rdp-hub')?.separatorBefore).toBe(true);
  });

  it('ships English nav + hub copy in culture keys', () => {
    const keys = buildRemoteHubsCultureKeys();
    expect(keys[navGroupKey(REMOTE_HUBS_NAV_HEADING)]).toBe(REMOTE_HUBS_NAV_HEADING);
    expect(keys['nav.file-hub']).toBe('Sftp');
    expect(keys['nav.ssh-hub']).toBe('SSH');
    expect(keys['nav.rdp-hub']).toBe('RDP');
    expect(keys['fileHub.create.title']).toBeTruthy();
    expect(keys['sshHub.create.title']).toBeTruthy();
    expect(keys['rdpHub.create.title']).toBeTruthy();
  });

  it('does not bake hub pages into shipped Studio nav', () => {
    expect(studioNav.groups.find((group) => group.heading === 'Operations')).toBeUndefined();
    const development = studioNav.groups.find((group) => group.heading === 'Development');
    const developmentKeys = (development?.items ?? []).map((item) => item.pageKey);
    expect(developmentKeys).not.toContain('file-hub');
    expect(developmentKeys).not.toContain('ssh-hub');
    expect(developmentKeys).not.toContain('rdp-hub');
    expect(developmentKeys).not.toContain('package-manager');
    expect(developmentKeys).not.toContain('libraries');
    expect(developmentKeys).toEqual([
      'idea-foundry',
      'data-studio',
      'server-functions',
      'client-components',
      'base-components',
      'platform-portals',
      'workflows',
      'scheduled-tasks',
      'jobs',
      'cache',
      'git',
      'file-manager',
      'appearance',
      'settings',
    ]);
    expect(development?.items.find((item) => item.pageKey === 'data-studio')?.separatorBefore).toBe(true);
    expect(development?.items.find((item) => item.pageKey === 'data-studio')?.children?.map((item) => item.pageKey))
      .toEqual(['sql-console', 'sources']);
    expect(development?.items.find((item) => item.pageKey === 'server-functions')?.children?.map((item) => item.pageKey))
      .toEqual(['api-talk', 'dev-reference']);
    expect(development?.items.find((item) => item.pageKey === 'client-components')?.children).toBeUndefined();
    expect(studioNav.groups.find((group) => group.heading === 'Remote Hubs')).toBeUndefined();
    expect(studioNav.groups.find((group) => group.heading === 'Workshops')).toBeUndefined();
    const extensions = studioNav.groups.find((group) => group.heading === 'Extensions');
    expect(extensions?.order).toBe(2);
    expect((extensions?.items ?? []).map((item) => item.pageKey)).toEqual(['package-manager', 'libraries']);
    expect((extensions?.items ?? []).map((item) => item.routePattern)).toEqual([
      'package-manager',
      'libraries',
    ]);
    const records = studioNav.groups.find((group) => group.heading === 'Records');
    expect(records?.order).toBe(5);
  });

  it('does not declare hub protocol libraries on the host package.json', () => {
    const host = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'),
    ) as {
      dependencies?: Record<string, string>;
      optionalDependencies?: Record<string, string>;
    };
    const deps = { ...host.dependencies, ...host.optionalDependencies };
    for (const library of REMOTE_HUBS_LIBRARIES) {
      expect(deps[library.name], library.name).toBeUndefined();
    }
  });

  it('builds a zip whose manifest validates', () => {
    const buffer = buildRemoteHubsPackageZip();
    expect(buffer.length).toBeGreaterThan(100);
    const zip = new AdmZip(buffer);
    const names = zip.getEntries().map((entry) => entry.entryName.replace(/\\/g, '/'));
    expect(names).toEqual(expect.arrayContaining([
      'package.json',
      REMOTE_HUBS_NAV_PATCH_ENTRY,
      REMOTE_HUBS_CULTURE_KEYS_ENTRY,
      'ui/sftp.tsx',
      'ui/ssh.tsx',
      'ui/rdp.tsx',
    ]));
    const manifest = JSON.parse(zip.readAsText('package.json')) as {
      capabilities?: { ui_routes?: Array<{ pageKey: string; entry: string }> };
    };
    expect(manifest.capabilities?.ui_routes?.map((route) => route.pageKey)).toEqual([
      'file-hub',
      'ssh-hub',
      'rdp-hub',
    ]);
  });
});
