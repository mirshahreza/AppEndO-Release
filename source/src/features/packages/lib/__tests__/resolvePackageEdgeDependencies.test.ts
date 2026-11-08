/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import { resolvePackageEdgeDependencies } from '../resolvePackageEdgeDependencies';
import { buildPackageUiRoutesForPageSeeds } from '../packageUiRoutesFromComponents';

describe('resolvePackageEdgeDependencies', () => {
  it('matches Edge models and APIs from TSX paths, draft JSON, and quoted object names', () => {
    const result = resolvePackageEdgeDependencies({
      components: [{
        id: 'page-1',
        componentKey: 'crm/contacts',
        label: 'crm/contacts',
        exportBundle: {
          entry: 'ui/crm/contacts.tsx',
          code: 'fetch("/api/data/contacts/list")',
          draftJson: JSON.stringify({
            objectName: 'Contact',
            binding: { endpoint: '/api/data/contacts' },
          }),
        },
      }],
      edgeModels: [{ id: 'model-contact', objectName: 'Contact', label: 'Contact' }],
      edgeApis: [{
        id: 'api-contact',
        edgeModelId: 'model-contact',
        key: 'contacts',
        label: 'Contacts API',
        basePath: '/api/data/contacts',
      }],
    });

    expect(result.models.map((model) => model.id)).toEqual(['model-contact']);
    expect(result.apis.map((api) => api.id)).toEqual(['api-contact']);
  });
});

describe('buildPackageUiRoutesForPageSeeds', () => {
  it('emits studio ui_routes for page seeds and skips portal-derived keys', () => {
    const routes = buildPackageUiRoutesForPageSeeds({
      pageSeeds: [
        {
          id: 'page-1',
          componentKey: 'crm/contacts',
          label: 'crm/contacts',
          exportBundle: { entry: 'ui/crm/contacts.tsx', code: '' },
        },
        {
          id: 'page-2',
          componentKey: 'sales/dashboard',
          label: 'sales/dashboard',
          exportBundle: { entry: 'ui/sales/dashboard.tsx', code: '' },
        },
      ],
      skipComponentKeys: new Set(['sales/dashboard']),
    });

    expect(routes).toEqual([
      expect.objectContaining({
        pageKey: 'crm-contacts',
        entry: 'ui/crm/contacts.tsx',
        suggestedMountId: 'studio',
      }),
    ]);
  });
});
