import { describe, expect, it } from 'vitest';
import { buildPackageRepackAdditions } from '../buildPackageRepackAdditions';

describe('buildPackageRepackAdditions', () => {
  it('includes designerDraftId and ui entry files for selected components', () => {
    const additions = buildPackageRepackAdditions({
      packageId: 'demo-pack',
      existingManifest: {
        id: 'demo-pack',
        name: 'Demo Pack',
        version: '1.0.0',
        requiredAppVersion: '>=1.0.0',
        capabilities: {
          apis: [],
          ui_components: [],
          db_objects: [],
        },
      },
      selectedApis: [],
      selectedComponents: [{
        id: 'draft-42',
        componentKey: 'dashboard/summary-card',
        label: 'dashboard/summary-card',
        exportBundle: {
          entry: 'ui/dashboard/summary-card.tsx',
          code: 'export default function SummaryCard() { return null; }',
        },
      }],
      selectedPortals: [],
      selectedWorkflows: [],
      catalogNavigations: [],
      installSql: '',
      uninstallSql: '',
    });

    expect(additions?.ui_components).toHaveLength(1);
    expect(additions?.ui_components?.[0]).toMatchObject({
      componentKey: 'dashboard/summary-card',
      slotId: 'core.dashboard.widgets',
      entry: 'ui/dashboard/summary-card.tsx',
      designerDraftId: 'draft-42',
    });
    expect(additions?.ui_routes).toEqual([
      expect.objectContaining({
        pageKey: 'summary-card',
        entry: 'ui/dashboard/summary-card.tsx',
        suggestedMountId: 'studio',
      }),
    ]);
    expect(additions?.files.some((file) => (
      file.entryPath === 'ui/dashboard/summary-card.tsx'
      && file.content.includes('SummaryCard')
    ))).toBe(true);
  });

  it('packs designer draft JSON and skips ui_routes for portal-derived pages', () => {
    const additions = buildPackageRepackAdditions({
      packageId: 'demo-pack',
      existingManifest: {
        id: 'demo-pack',
        name: 'Demo Pack',
        version: '1.0.0',
        requiredAppVersion: '>=1.0.0',
        capabilities: {
          apis: [],
          ui_components: [],
          db_objects: [],
        },
      },
      selectedApis: [],
      selectedComponents: [{
        id: 'draft-42',
        componentKey: 'dashboard/summary-card',
        label: 'dashboard/summary-card',
        exportBundle: {
          entry: 'ui/dashboard/summary-card.tsx',
          code: 'export default function SummaryCard() { return null; }',
          draftJson: '{"id":"draft-42"}',
          draftEntry: 'designer/pages/dashboard/summary-card.json',
        },
      }],
      selectedPortals: [],
      selectedWorkflows: [],
      catalogNavigations: [],
      pageSeedComponents: [{
        id: 'draft-42',
        componentKey: 'dashboard/summary-card',
        label: 'dashboard/summary-card',
        exportBundle: {
          entry: 'ui/dashboard/summary-card.tsx',
          code: 'export default function SummaryCard() { return null; }',
        },
      }],
      skipUiRouteComponentKeys: ['dashboard/summary-card'],
      installSql: '',
      uninstallSql: '',
    });

    expect(additions?.ui_components?.[0]).toMatchObject({
      draftEntry: 'designer/pages/dashboard/summary-card.json',
    });
    expect(additions?.files.some((file) => (
      file.entryPath === 'designer/pages/dashboard/summary-card.json'
      && file.content.includes('draft-42')
    ))).toBe(true);
    expect(additions?.ui_routes).toBeUndefined();
  });

  it('includes workflow capability entries for selected definitions', () => {
    const additions = buildPackageRepackAdditions({
      packageId: 'demo-pack',
      existingManifest: {
        id: 'demo-pack',
        name: 'Demo Pack',
        version: '1.0.0',
        requiredAppVersion: '>=1.0.0',
        capabilities: {
          apis: [],
          ui_components: [],
          db_objects: [],
        },
      },
      selectedApis: [],
      selectedComponents: [],
      selectedPortals: [],
      selectedWorkflows: [{
        id: 12,
        scopeKey: 'global',
        key: 'order-approval',
        label: 'global/order-approval',
        lifecycleStatus: 'DRAFT',
      }],
      catalogNavigations: [],
      installSql: '',
      uninstallSql: '',
    });

    expect(additions?.workflows).toEqual([{
      scopeKey: 'global',
      key: 'order-approval',
      entry: 'workflows/global/order-approval.json',
    }]);
  });

  it('emits a Studio nav patch and culture keys for new studio page seeds', () => {
    const additions = buildPackageRepackAdditions({
      packageId: 'demo-pack',
      existingManifest: {
        id: 'demo-pack',
        name: 'Demo Pack',
        version: '1.0.0',
        requiredAppVersion: '>=1.0.0',
        capabilities: {
          apis: [],
          ui_components: [],
          db_objects: [],
        },
      },
      selectedApis: [],
      selectedComponents: [{
        id: 'draft-42',
        componentKey: 'crm/contacts',
        label: 'Contacts',
        exportBundle: {
          entry: 'ui/crm/contacts.tsx',
          code: 'export default function Contacts() { return null; }',
        },
      }],
      selectedPortals: [],
      selectedWorkflows: [],
      catalogNavigations: [],
      installSql: '',
      uninstallSql: '',
    });

    expect(additions?.navigation_patches).toEqual([{
      navigationId: 'studio',
      entry: 'platform/navigation-patches/studio.json',
    }]);
    expect(additions?.culture_keys).toEqual([{ entry: 'culture/keys.json' }]);
    const navFile = additions?.files.find((file) => file.entryPath === 'platform/navigation-patches/studio.json');
    expect(navFile).toBeDefined();
    expect(JSON.parse(navFile!.content)).toMatchObject({
      navigationId: 'studio',
      heading: 'Demo Pack',
      items: [expect.objectContaining({ pageKey: 'contacts', label: 'Contacts' })],
    });
    const cultureFile = additions?.files.find((file) => file.entryPath === 'culture/keys.json');
    expect(JSON.parse(cultureFile!.content)['nav.group.demo pack']).toBe('Demo Pack');
  });

  it('packs optional initial records as a separate seed object', () => {
    const additions = buildPackageRepackAdditions({
      packageId: 'demo-pack',
      existingManifest: {
        id: 'demo-pack',
        name: 'Demo Pack',
        version: '1.0.0',
        requiredAppVersion: '>=1.0.0',
        capabilities: {
          apis: [],
          ui_components: [],
          db_objects: [],
        },
      },
      selectedApis: [],
      selectedComponents: [],
      selectedPortals: [],
      selectedWorkflows: [],
      catalogNavigations: [],
      installSql: 'CREATE TABLE demo (id int);',
      uninstallSql: 'DROP TABLE demo;',
      includeInitialRecords: true,
      optionalInstallSql: 'INSERT INTO demo VALUES (1);',
      optionalUninstallSql: 'DELETE FROM demo WHERE id = 1;',
    });

    expect(additions?.db_objects).toEqual([
      expect.objectContaining({
        installMode: 'required',
        installScript: 'db/install/repack-addon.sql',
      }),
      expect.objectContaining({
        installMode: 'optional',
        installScript: 'db/seed/repack-addon-optional-records.sql',
      }),
    ]);
    expect(additions?.files.some((file) => (
      file.entryPath === 'db/seed/repack-addon-optional-records.sql'
      && file.content.includes('INSERT INTO demo')
    ))).toBe(true);
  });

  it('omits optional seed when the packer does not include initial records', () => {
    const additions = buildPackageRepackAdditions({
      packageId: 'demo-pack',
      existingManifest: {
        id: 'demo-pack',
        name: 'Demo Pack',
        version: '1.0.0',
        requiredAppVersion: '>=1.0.0',
        capabilities: {
          apis: [],
          ui_components: [],
          db_objects: [],
        },
      },
      selectedApis: [],
      selectedComponents: [],
      selectedPortals: [],
      selectedWorkflows: [],
      catalogNavigations: [],
      installSql: 'CREATE TABLE demo (id int);',
      uninstallSql: 'DROP TABLE demo;',
      includeInitialRecords: false,
      optionalInstallSql: 'INSERT INTO demo VALUES (1);',
      optionalUninstallSql: 'DELETE FROM demo WHERE id = 1;',
    });

    expect(additions?.db_objects).toEqual([
      expect.objectContaining({ installMode: 'required' }),
    ]);
    expect(additions?.files.some((file) => file.entryPath === 'db/seed/repack-addon-optional-records.sql')).toBe(false);
  });
});
