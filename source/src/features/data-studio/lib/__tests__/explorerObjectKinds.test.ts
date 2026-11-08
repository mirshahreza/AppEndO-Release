import { describe, expect, it } from 'vitest';
import { canDeleteExplorerObjectFromList } from '../explorerObjectKinds';

describe('canDeleteExplorerObjectFromList', () => {
  it('allows delete for non-table explorer objects', () => {
    expect(canDeleteExplorerObjectFromList({ objectKind: 'VIEW', isControlPlaneLocked: false })).toBe(true);
    expect(canDeleteExplorerObjectFromList({ objectKind: 'STORED_PROCEDURE', isControlPlaneLocked: false })).toBe(true);
    expect(canDeleteExplorerObjectFromList({ objectKind: 'SCALAR_FUNCTION', isControlPlaneLocked: false })).toBe(true);
    expect(canDeleteExplorerObjectFromList({ objectKind: 'TABLE_VALUED_FUNCTION', isControlPlaneLocked: false })).toBe(true);
  });

  it('keeps tables on the modeler delete path', () => {
    expect(canDeleteExplorerObjectFromList({ objectKind: 'TABLE', isControlPlaneLocked: false })).toBe(false);
  });

  it('blocks control-plane locked objects', () => {
    expect(canDeleteExplorerObjectFromList({ objectKind: 'VIEW', isControlPlaneLocked: true })).toBe(false);
  });
});
