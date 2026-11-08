import { resolvePriorityOverlayToken } from '../../routing/resolvePriorityOverlayToken';

export const CRUD_SET_OVERLAY_DIALOG_FILTER = 'dialog/filter';
export const CRUD_SET_OVERLAY_DIALOG_EXPORT = 'dialog/export';

export type CrudSetDialogOverlayState =
  | { kind: 'none' }
  | { kind: 'create'; createId: string }
  | { kind: 'form-patch'; patchId: string; rowKey: string }
  | { kind: 'toggle-confirm'; patchId: string; rowKey: string }
  | { kind: 'delete'; rowKey: string }
  | { kind: 'export' }
  | { kind: 'view'; actionId: string; rowKey: string }
  | { kind: 'host-confirm'; actionId: string; rowKey: string }
  | { kind: 'collection-confirm'; actionId: string }
  | { kind: 'history'; rowKey: string };

export function buildCrudSetDialogOverlayToken(state: Exclude<CrudSetDialogOverlayState, { kind: 'none' }>): string {
  switch (state.kind) {
    case 'create':
      return `dialog/create/${state.createId}`;
    case 'form-patch':
      return `dialog/patch/${state.patchId}/${state.rowKey}`;
    case 'toggle-confirm':
      return `dialog/toggle-confirm/${state.patchId}/${state.rowKey}`;
    case 'delete':
      return `dialog/delete/${state.rowKey}`;
    case 'export':
      return CRUD_SET_OVERLAY_DIALOG_EXPORT;
    case 'view':
      return `dialog/view/${state.actionId}/${state.rowKey}`;
    case 'host-confirm':
      return `dialog/host-confirm/${state.actionId}/${state.rowKey}`;
    case 'collection-confirm':
      return `dialog/collection-confirm/${state.actionId}`;
    case 'history':
      return `dialog/history/${state.rowKey}`;
    default:
      return 'dialog/unknown';
  }
}

export function parseCrudSetDialogOverlayToken(token: string): CrudSetDialogOverlayState | null {
  if (token === CRUD_SET_OVERLAY_DIALOG_EXPORT) {
    return { kind: 'export' };
  }
  if (token === CRUD_SET_OVERLAY_DIALOG_FILTER) {
    return null;
  }

  const segments = token.split('/');
  const kind = segments[0];
  const dialogKind = segments[1];

  if (kind !== 'dialog' || !dialogKind) {
    return null;
  }

  if (dialogKind === 'create' && segments[2]) {
    return { kind: 'create', createId: segments.slice(2).join('/') };
  }
  if (dialogKind === 'patch' && segments[2] && segments[3]) {
    return { kind: 'form-patch', patchId: segments[2], rowKey: segments.slice(3).join('/') };
  }
  if (dialogKind === 'toggle-confirm' && segments[2] && segments[3]) {
    return { kind: 'toggle-confirm', patchId: segments[2], rowKey: segments.slice(3).join('/') };
  }
  if (dialogKind === 'delete' && segments[2]) {
    return { kind: 'delete', rowKey: segments.slice(2).join('/') };
  }
  if (dialogKind === 'view' && segments[2] && segments[3]) {
    return { kind: 'view', actionId: segments[2], rowKey: segments.slice(3).join('/') };
  }
  if (dialogKind === 'host-confirm' && segments[2] && segments[3]) {
    return { kind: 'host-confirm', actionId: segments[2], rowKey: segments.slice(3).join('/') };
  }
  if (dialogKind === 'collection-confirm' && segments[2]) {
    return { kind: 'collection-confirm', actionId: segments.slice(2).join('/') };
  }
  if (dialogKind === 'history' && segments[2]) {
    return { kind: 'history', rowKey: segments.slice(2).join('/') };
  }

  return null;
}

export function resolveCrudSetOverlayToken(input: {
  dialog: CrudSetDialogOverlayState;
  filterOpen: boolean;
  historyOpen: boolean;
  historyRowKey: string | null;
}): string | null {
  const dialogToken = input.dialog.kind === 'none'
    ? null
    : buildCrudSetDialogOverlayToken(input.dialog);

  return resolvePriorityOverlayToken([
    {
      token: input.historyOpen && input.historyRowKey
        ? buildCrudSetDialogOverlayToken({ kind: 'history', rowKey: input.historyRowKey })
        : 'dialog/history',
      isOpen: input.historyOpen && Boolean(input.historyRowKey),
      priority: 450,
    },
    { token: dialogToken ?? 'dialog/active', isOpen: Boolean(dialogToken), priority: 400 },
    { token: CRUD_SET_OVERLAY_DIALOG_FILTER, isOpen: input.filterOpen, priority: 200 },
  ]);
}
