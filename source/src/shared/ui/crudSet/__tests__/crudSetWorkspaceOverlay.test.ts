import { describe, expect, it } from 'vitest';
import {
  buildCrudSetDialogOverlayToken,
  parseCrudSetDialogOverlayToken,
} from '../crudSetWorkspaceOverlay';

describe('crudSetWorkspaceOverlay', () => {
  it('round-trips create and patch tokens', () => {
    const create = buildCrudSetDialogOverlayToken({ kind: 'create', createId: 'user' });
    expect(parseCrudSetDialogOverlayToken(create)).toEqual({ kind: 'create', createId: 'user' });

    const patch = buildCrudSetDialogOverlayToken({
      kind: 'form-patch',
      patchId: 'profile',
      rowKey: '42',
    });
    expect(parseCrudSetDialogOverlayToken(patch)).toEqual({
      kind: 'form-patch',
      patchId: 'profile',
      rowKey: '42',
    });
  });
});
