import { describe, expect, it } from 'vitest';
import { parseRepackAdditions, parseRepackRemovals } from '../packageRepack.service';

describe('parseRepackAdditions', () => {
  it('parses ui_components with designerDraftId and files', () => {
    const parsed = parseRepackAdditions({
      ui_components: [{
        componentKey: 'dashboard/summary-card',
        slotId: 'core.dashboard.widgets',
        entry: 'ui/dashboard/summary-card.tsx',
        order: 100,
        designerDraftId: 'draft-42',
      }],
      files: [{
        entryPath: 'ui/dashboard/summary-card.tsx',
        content: 'export default function SummaryCard() { return null; }',
      }],
    });

    expect(parsed?.ui_components).toHaveLength(1);
    expect(parsed?.ui_components?.[0]).toMatchObject({
      componentKey: 'dashboard/summary-card',
      slotId: 'core.dashboard.widgets',
      entry: 'ui/dashboard/summary-card.tsx',
      order: 100,
      designerDraftId: 'draft-42',
    });
    expect(parsed?.files).toHaveLength(1);
  });

  it('parses ui_routes, draftEntry, and edge capabilities', () => {
    const parsed = parseRepackAdditions({
      ui_components: [{
        componentKey: 'crm/contacts',
        slotId: 'core.dashboard.widgets',
        entry: 'ui/crm/contacts.tsx',
        order: 100,
        draftEntry: 'designer/pages/crm/contacts.json',
      }],
      ui_routes: [{
        pageKey: 'crm-contacts',
        entry: 'ui/crm/contacts.tsx',
        suggestedMountId: 'studio',
      }],
      edge_models: [{ id: 'model-1', entry: 'edge/models/model-1.json' }],
      edge_apis: [{ id: 'api-1', edgeModelId: 'model-1', entry: 'edge/apis/api-1.json' }],
      files: [
        { entryPath: 'ui/crm/contacts.tsx', content: 'export default function Contacts() { return null; }' },
        { entryPath: 'designer/pages/crm/contacts.json', content: '{}' },
        { entryPath: 'edge/models/model-1.json', content: '{}' },
        { entryPath: 'edge/apis/api-1.json', content: '{}' },
      ],
    });

    expect(parsed?.ui_components?.[0]?.draftEntry).toBe('designer/pages/crm/contacts.json');
    expect(parsed?.ui_routes).toEqual([{
      pageKey: 'crm-contacts',
      entry: 'ui/crm/contacts.tsx',
      suggestedMountId: 'studio',
    }]);
    expect(parsed?.edge_models).toEqual([{ id: 'model-1', entry: 'edge/models/model-1.json' }]);
    expect(parsed?.edge_apis).toEqual([{
      id: 'api-1',
      edgeModelId: 'model-1',
      entry: 'edge/apis/api-1.json',
    }]);
  });

  it('parses workflow additions', () => {
    const parsed = parseRepackAdditions({
      workflows: [{
        scopeKey: 'global',
        key: 'order-approval',
        entry: 'workflows/global/order-approval.json',
      }],
      files: [{
        entryPath: 'workflows/global/order-approval.json',
        content: '{"format":"appendo.workflow.definition"}',
      }],
    });

    expect(parsed?.workflows).toEqual([{
      scopeKey: 'global',
      key: 'order-approval',
      entry: 'workflows/global/order-approval.json',
    }]);
  });

  it('parses blob files from contentBase64', () => {
    const parsed = parseRepackAdditions({
      files: [{
        entryPath: 'db/blobs/files/cms_content_assets_file_id=9.bin',
        content: '',
        contentBase64: Buffer.from([0xde, 0xad]).toString('base64'),
      }],
    });

    expect(parsed?.files).toEqual([{
      entryPath: 'db/blobs/files/cms_content_assets_file_id=9.bin',
      content: '',
      contentBase64: '3q0=',
    }]);
  });

  it('parses navigation_patches and culture_keys', () => {
    const parsed = parseRepackAdditions({
      navigation_patches: [{
        navigationId: 'studio',
        entry: 'platform/navigation-patches/studio.json',
      }],
      culture_keys: [{ entry: 'culture/keys.json' }],
      files: [
        { entryPath: 'platform/navigation-patches/studio.json', content: '{"navigationId":"studio"}' },
        { entryPath: 'culture/keys.json', content: '{"nav.group.demo pack":"Demo Pack"}' },
      ],
    });

    expect(parsed?.navigation_patches).toEqual([{
      navigationId: 'studio',
      entry: 'platform/navigation-patches/studio.json',
    }]);
    expect(parsed?.culture_keys).toEqual([{ entry: 'culture/keys.json' }]);
    expect(parsed?.files).toHaveLength(2);
  });

  it('parses home_portal', () => {
    const parsed = parseRepackAdditions({
      home_portal: [{ entry: 'platform/home-shell.json' }],
      files: [
        { entryPath: 'platform/home-shell.json', content: '{"entryMode":"shell"}' },
      ],
    });

    expect(parsed?.home_portal).toEqual([{ entry: 'platform/home-shell.json' }]);
    expect(parsed?.files).toHaveLength(1);
  });
});

describe('parseRepackRemovals', () => {
  it('parses capability removal lists', () => {
    const parsed = parseRepackRemovals({
      apis: ['get-demo'],
      ui_components: ['demo/widget'],
      portals: ['demo'],
      navigations: ['demo-nav'],
      workflows: ['global/old-flow'],
    });

    expect(parsed).toEqual({
      apis: ['get-demo'],
      ui_components: ['demo/widget'],
      portals: ['demo'],
      navigations: ['demo-nav'],
      workflows: ['global/old-flow'],
    });
  });
});
