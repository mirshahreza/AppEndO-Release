import { describe, expect, it, beforeEach } from 'vitest';
import { clearAgentDrafts } from '../agentDraftStore';
import { executeDraftComponentLayout } from '../draftComponentLayout';
import { executeDesignerInsertPaletteItem } from '../designerInsertPaletteItem';

describe('executeDesignerInsertPaletteItem', () => {
  beforeEach(() => {
    clearAgentDrafts();
  });

  it('inserts a palette item into an agent layout draft', async () => {
    const base = await executeDraftComponentLayout({ name: 'Users Grid', templateId: 'roles' });
    expect(base.ok).toBe(true);
    if (!base.ok) return;

    const beforeCount = base.data?.nodeCount ?? 0;
    const result = await executeDesignerInsertPaletteItem(
      { itemId: 'heroui.button-solid', layoutId: base.data!.layoutId },
      { mode: 'agent', allowedGroups: ['draft'], pageContext: { path: '/client-components', pageLabel: 'Designer', layoutId: base.data!.layoutId } },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data?.insertedNodeId).toBeTruthy();
      expect(result.data?.itemId).toBe('heroui.button-solid');
      expect((result.data?.nodeCount ?? 0) > beforeCount).toBe(true);
      expect(result.artifacts?.[0]?.kind).toBe('draft');
    }
  });

  it('defaults layoutId from pageContext', async () => {
    const base = await executeDraftComponentLayout({ name: 'WF3 Layout' });
    expect(base.ok).toBe(true);
    if (!base.ok) return;

    const result = await executeDesignerInsertPaletteItem(
      { itemId: 'html.text' },
      {
        mode: 'agent',
        allowedGroups: ['draft'],
        pageContext: { path: '/client-components', pageLabel: 'Designer', layoutId: base.data!.layoutId },
      },
    );

    expect(result.ok).toBe(true);
  });

  it('requires itemId', async () => {
    const result = await executeDesignerInsertPaletteItem({}, { mode: 'agent', allowedGroups: [] });
    expect(result.ok).toBe(false);
  });
});
