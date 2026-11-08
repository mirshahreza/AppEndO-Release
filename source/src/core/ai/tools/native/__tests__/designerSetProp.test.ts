import { describe, expect, it, beforeEach } from 'vitest';
import { clearAgentDrafts } from '../agentDraftStore';
import { executeDraftComponentLayout } from '../draftComponentLayout';
import { executeDesignerInsertPaletteItem } from '../designerInsertPaletteItem';
import { executeDesignerSetProp } from '../designerSetProp';

describe('executeDesignerSetProp', () => {
  beforeEach(() => {
    clearAgentDrafts();
  });

  it('sets a property on a node using pageContext defaults (WF-3 path)', async () => {
    const base = await executeDraftComponentLayout({ name: 'WF3 Grid', templateId: 'roles' });
    expect(base.ok).toBe(true);
    if (!base.ok) return;

    const insert = await executeDesignerInsertPaletteItem(
      { itemId: 'heroui.button-solid', layoutId: base.data!.layoutId },
      {
        mode: 'agent',
        allowedGroups: ['draft'],
        pageContext: { path: '/client-components', pageLabel: 'Designer', layoutId: base.data!.layoutId },
      },
    );
    expect(insert.ok).toBe(true);
    if (!insert.ok) return;

    const nodeId = insert.data!.insertedNodeId as string;
    const result = await executeDesignerSetProp(
      { propKey: 'text', value: 'Save changes', draftId: insert.data!.draftId as string },
      {
        mode: 'agent',
        allowedGroups: ['draft'],
        pageContext: {
          path: '/client-components',
          pageLabel: 'Designer',
          layoutId: base.data!.layoutId,
          selectedNodeId: nodeId,
        },
      },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data?.propKey).toBe('text');
      expect(result.data?.value).toBe('Save changes');
      expect(result.artifacts?.[0]?.kind).toBe('draft');
    }
  });

  it('requires propKey and value', async () => {
    const result = await executeDesignerSetProp({ layoutId: 'missing' }, { mode: 'agent', allowedGroups: [] });
    expect(result.ok).toBe(false);
  });
});
