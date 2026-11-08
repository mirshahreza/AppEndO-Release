import { describe, it, expect, vi, beforeEach } from 'vitest';

const draftRecords = vi.hoisted(() => new Map<string, {
  id: string;
  name: string;
  folder: string;
  document: Record<string, unknown>;
  bindingDefinitions: Record<string, unknown>;
  companionTsx?: string | null;
}>());

const draftByComponentKey = vi.hoisted(() => new Map<string, {
  id: string;
  name: string;
  folder: string;
  document: Record<string, unknown>;
  bindingDefinitions: Record<string, unknown>;
  companionTsx?: string | null;
}>());

const tsxSources = vi.hoisted(() => new Map<string, { content: string }>());

vi.mock('../../../domain/component-designer/draftIo', () => ({
  readDraftRecord: (draftId: string) => draftRecords.get(draftId) ?? null,
  readDraftRecordByComponentName: (componentKey: string) => draftByComponentKey.get(componentKey) ?? null,
}));

vi.mock('../../../domain/component-designer/draftTsxHydration', () => ({
  readNewestDraftTsxSource: (record: { id: string }) => tsxSources.get(record.id) ?? null,
}));

vi.mock('../../../domain/component-designer/drafts', () => ({
  listDesignerDrafts: () => Array.from(draftRecords.values()).map((record) => ({
    id: record.id,
    name: record.name,
    folder: record.folder,
  })),
}));

vi.mock('../../../domain/component-designer/codegen', () => ({
  generateDesignerTsx: () => 'export default function GeneratedComponent() { return null; }',
}));

import { buildDesignerComponentExportBundle, buildPackageUiEntryPath, materializeUiComponentRepackAdditions } from '../packageComponentExport.service';

describe('packageComponentExport.service', () => {
  beforeEach(() => {
    draftRecords.clear();
    draftByComponentKey.clear();
    tsxSources.clear();
  });

  it('exports companion TSX and package entry path for a designer draft', () => {
    draftRecords.set('draft-1', {
      id: 'draft-1',
      name: 'Customer Summary',
      folder: 'landing',
      document: {},
      bindingDefinitions: {},
      companionTsx: 'export default function CustomerSummary() { return <div>Hello</div>; }',
    });

    const bundle = buildDesignerComponentExportBundle('draft-1');

    expect(bundle.ok, !bundle.ok ? bundle.error : undefined).toBe(true);
    if (!bundle.ok) return;

    expect(bundle.componentKey).toBe('landing/customer-summary');
    expect(bundle.entry).toBe('ui/landing/customer-summary.tsx');
    expect(bundle.code).toContain('CustomerSummary');
    expect(bundle.code).toContain('export default');
    expect(bundle.draftEntry).toBe('designer/pages/landing/customer-summary.json');
    expect(bundle.draftJson).toContain('Customer Summary');
  });

  it('falls back to newest TSX source when companion TSX is missing', () => {
    draftRecords.set('draft-2', {
      id: 'draft-2',
      name: 'Orders Panel',
      folder: 'general',
      document: {},
      bindingDefinitions: {},
      companionTsx: null,
    });
    tsxSources.set('draft-2', {
      content: 'export default function OrdersPanel() { return <div>Orders</div>; }',
    });

    const bundle = buildDesignerComponentExportBundle('draft-2');

    expect(bundle.ok).toBe(true);
    if (!bundle.ok) return;

    expect(bundle.code).toContain('OrdersPanel');
  });

  it('returns an error when the draft does not exist', () => {
    const bundle = buildDesignerComponentExportBundle('missing-draft');
    expect(bundle.ok).toBe(false);
    if (bundle.ok) return;
    expect(bundle.error).toContain('missing-draft');
  });

  it('maps folder/name to ui/{folder}/{name}.tsx package entry', () => {
    draftRecords.set('draft-folder-name', {
      id: 'draft-folder-name',
      name: 'c1',
      folder: 'my-tests',
      document: {},
      bindingDefinitions: {},
      companionTsx: 'export default function C1() { return null; }',
    });

    const bundle = buildDesignerComponentExportBundle('draft-folder-name');

    expect(bundle.ok).toBe(true);
    if (!bundle.ok) return;

    expect(bundle.componentKey).toBe('my-tests/c1');
    expect(bundle.entry).toBe('ui/my-tests/c1.tsx');
    expect(buildPackageUiEntryPath(bundle.componentKey)).toBe('ui/my-tests/c1.tsx');
  });

  it('materializes repack additions from designerDraftId', () => {
    const record = {
      id: 'draft-4',
      name: 'Summary Card',
      folder: 'dashboard',
      document: {},
      bindingDefinitions: {},
      companionTsx: 'export default function SummaryCard() { return <div>Summary</div>; }',
    };
    draftRecords.set('draft-4', record);

    const additions = materializeUiComponentRepackAdditions({
      ui_components: [{
        componentKey: 'dashboard/summary-card',
        slotId: 'core.dashboard.widgets',
        entry: 'ui/dashboard/summary-card.tsx',
        order: 100,
        designerDraftId: 'draft-4',
      }],
      files: [{
        entryPath: 'ui/dashboard/summary-card.tsx',
        content: 'export default function Stub() { return null; }',
      }],
    });

    expect(additions?.files.find((file) => file.entryPath === 'ui/dashboard/summary-card.tsx')?.content).toContain('SummaryCard');
    expect(additions?.ui_components?.[0]?.entry).toBe('ui/dashboard/summary-card.tsx');
    expect(additions?.ui_components?.[0]?.draftEntry).toBe('designer/pages/dashboard/summary-card.json');
    expect(additions?.files.find((file) => file.entryPath === 'designer/pages/dashboard/summary-card.json')?.content)
      .toContain('Summary Card');
  });

  it('materializes repack addition files from designer componentKey', () => {
    const record = {
      id: 'draft-3',
      name: 'Orders Panel',
      folder: 'general',
      document: {},
      bindingDefinitions: {},
      companionTsx: 'export default function OrdersPanel() { return <div>Orders</div>; }',
    };
    draftRecords.set('draft-3', record);
    draftByComponentKey.set('general/orders-panel', record);

    const additions = materializeUiComponentRepackAdditions({
      ui_components: [{
        componentKey: 'general/orders-panel',
        slotId: 'core.dashboard.widgets',
        entry: 'ui/general/orders-panel.tsx',
        order: 100,
      }],
      files: [{
        entryPath: 'ui/general/orders-panel.tsx',
        content: 'export default function Stub() { return null; }',
      }],
    });

    expect(additions?.files.find((file) => file.entryPath === 'ui/general/orders-panel.tsx')?.content).toContain('OrdersPanel');
  });
});
