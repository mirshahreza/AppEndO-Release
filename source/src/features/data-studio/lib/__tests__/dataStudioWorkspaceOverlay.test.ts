import { describe, expect, it } from 'vitest';
import {
  buildDataStudioSqlPanelOverlayToken,
  parseDataStudioObjectScopedPanelOverlay,
  resolveDataStudioActiveOverlayToken,
} from '../dataStudioWorkspaceOverlay';

describe('dataStudioWorkspaceOverlay', () => {
  it('parses object-scoped panel tokens', () => {
    const token = buildDataStudioSqlPanelOverlayToken('VIEW', 'v_orders');
    expect(parseDataStudioObjectScopedPanelOverlay(token, 'panel/sql')).toEqual({
      objectKind: 'VIEW',
      objectName: 'v_orders',
    });
  });

  it('picks the highest z-order overlay', () => {
    expect(resolveDataStudioActiveOverlayToken({
      createObjectDialogOpen: false,
      designerPanels: [{ id: '1', context: {} as never, zOrder: 120, cascadeIndex: 0 }],
      datasheetPanels: [{ id: '2', context: {} as never, zOrder: 130, cascadeIndex: 0 }],
      relationsPanels: [],
      sqlPanels: [],
      runPanels: [],
    })).toBe('panel/datasheet');
  });
});
