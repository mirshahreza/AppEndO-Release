/**
 * Bug found (gap analysis #28 / Phase 56): AI tools only drafted one component layout per call —
 * no orchestration for multi-page apps (shell + related pages + portal menu).
 * Fixed in draftApplicationScaffold.ts / agentDraftStore.ts / changeSetBuilder.ts /
 * changeSet.service.ts / contextAssembly.ts / designerPack.ts / capabilityPacks.ts:
 * draft_application_scaffold orchestrates executeDraftComponentLayout for shell + pages,
 * attaches menuEntry intents (DesignerAddToMenuButton parity on apply), and contextAssembly
 * surfaces existing Designer folder/application structure.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAgentDrafts, getAgentDraft, listAgentDrafts } from '../agentDraftStore';
import { executeDraftApplicationScaffold, DRAFT_APPLICATION_SCAFFOLD_TOOL_NAME } from '../draftApplicationScaffold';
import { buildChangeSetsFromDrafts } from '../../../validation/changeSetBuilder';
import { formatDesignerApplicationStructure } from '../../../agent/contextAssembly';
import type { DesignerDraftSummary } from '../../../../../server/domain/component-designer/draftTypes';

describe('Phase 56 — draft_application_scaffold (AI multi-page app)', () => {
  beforeEach(() => {
    clearAgentDrafts();
  });

  it('registers the canonical tool name', () => {
    expect(DRAFT_APPLICATION_SCAFFOLD_TOOL_NAME).toBe('draft_application_scaffold');
  });

  it('requires appName and pages', async () => {
    const missingName = await executeDraftApplicationScaffold({
      pages: [{ name: 'Orders List' }],
    });
    expect(missingName.ok).toBe(false);

    const missingPages = await executeDraftApplicationScaffold({
      appName: 'Order Management',
    });
    expect(missingPages.ok).toBe(false);
  });

  it('scaffolds list+detail pages with shell and menu entries via draft_component_layout', async () => {
    const result = await executeDraftApplicationScaffold({
      appName: 'Order Management',
      folder: 'orders',
      description: 'Sample order management app with list and details',
      pages: [
        { name: 'Orders List', templateId: 'crud-collection-page' },
        { name: 'Order Detail' },
      ],
      sharedDataSources: {
        ordersApi: {
          id: 'ordersApi',
          name: 'Orders API',
          endpoint: '/api/orders',
          fields: ['id', 'status', 'total'],
        },
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data?.shell?.layoutId).toBeTruthy();
    expect(result.data?.pages).toHaveLength(2);
    expect(result.data?.pages?.[0]?.name).toBe('Orders List');
    expect(result.data?.pages?.[1]?.name).toBe('Order Detail');
    expect(result.data?.menuEntries).toHaveLength(2);
    expect(result.data?.menuEntries?.[0]?.pageKey).toContain('orders/');
    expect(result.data?.menuEntries?.[0]?.navLabel).toBe('Orders List');
    expect(result.data?.sharedDataSourceKeys).toEqual(['ordersApi']);

    const layoutDrafts = listAgentDrafts().filter((draft) => draft.kind === 'component_layout');
    // shell + 2 pages — all produced by executeDraftComponentLayout
    expect(layoutDrafts.length).toBe(3);

    const listDraft = getAgentDraft(result.data!.pages![0]!.draftId);
    expect(listDraft?.kind).toBe('component_layout');
    if (listDraft?.kind === 'component_layout') {
      expect(listDraft.menuEntry?.portalSegment).toBe('studio');
      expect(listDraft.menuEntry?.navLabel).toBe('Orders List');
      const bindings = listDraft.bindingDefinitions as unknown as {
        dataSources?: Record<string, unknown>;
      };
      expect(bindings.dataSources?.ordersApi).toBeTruthy();
    }

    const shellDraft = getAgentDraft(result.data!.shell!.draftId);
    expect(shellDraft?.kind).toBe('component_layout');
    if (shellDraft?.kind === 'component_layout') {
      expect(shellDraft.menuEntry).toBeUndefined();
      expect(shellDraft.name).toContain('Shell');
    }

    // Artifacts cover every layout draft for proposal collection
    expect(result.artifacts?.length).toBe(3);

    const changeSets = buildChangeSetsFromDrafts(
      layoutDrafts.map((draft) => draft.id),
    );
    expect(changeSets).toHaveLength(3);
    expect(changeSets.every((cs) => cs.kind === 'component_layout_patch')).toBe(true);

    const listChangeSet = changeSets.find((cs) => cs.kind === 'component_layout_patch'
      && cs.layoutId === result.data!.pages![0]!.layoutId);
    expect(listChangeSet?.kind).toBe('component_layout_patch');
    if (listChangeSet?.kind === 'component_layout_patch') {
      const patch = listChangeSet.patch as Record<string, unknown>;
      expect(patch.menuEntry).toMatchObject({
        navLabel: 'Orders List',
        portalSegment: 'studio',
      });
    }
  });

  it('honors addToMenu: false and custom portalSegment', async () => {
    const result = await executeDraftApplicationScaffold({
      appName: 'Internal Tools',
      portalSegment: 'studio',
      pages: [
        { name: 'Hidden Page', addToMenu: false },
        { name: 'Visible Page', addToMenu: true },
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data?.menuEntries).toHaveLength(1);
    expect(result.data?.menuEntries?.[0]?.navLabel).toBe('Visible Page');
  });

  it('formatDesignerApplicationStructure groups drafts by folder', () => {
    const drafts: DesignerDraftSummary[] = [
      {
        id: 'a',
        name: 'Orders List',
        folder: 'orders',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'b',
        name: 'Order Detail',
        folder: 'orders',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'c',
        name: 'Builtin',
        folder: 'system',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        isBuiltIn: true,
      },
    ];

    const block = formatDesignerApplicationStructure(drafts);
    expect(block).toBeTruthy();
    expect(block).toContain('### folder: orders');
    expect(block).toContain('Orders List');
    expect(block).toContain('Order Detail');
    expect(block).toContain('draft_application_scaffold');
    expect(block).not.toContain('Builtin');
  });

  it('does not invent a parallel document generator — pages come from draft_component_layout node trees', async () => {
    const spy = vi.spyOn(
      await import('../draftComponentLayout'),
      'executeDraftComponentLayout',
    );

    const result = await executeDraftApplicationScaffold({
      appName: 'Spy App',
      pages: [{ name: 'Page A' }, { name: 'Page B' }],
    });

    expect(result.ok).toBe(true);
    // shell + 2 pages
    expect(spy).toHaveBeenCalledTimes(3);
    spy.mockRestore();
  });
});
