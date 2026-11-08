import { resolvePriorityOverlayToken } from '../../../shared/routing/resolvePriorityOverlayToken';

export const DATA_STUDIO_MODELER_OVERLAY_DIALOG_GENERAL = 'dialog/general-edit';
export const DATA_STUDIO_MODELER_OVERLAY_DIALOG_IDENTITY = 'dialog/identity';
export const DATA_STUDIO_MODELER_OVERLAY_DIALOG_RECORD_POLICIES = 'dialog/record-policies';
export const DATA_STUDIO_MODELER_OVERLAY_DIALOG_LIST_ACCESS = 'dialog/list-access';
export const DATA_STUDIO_MODELER_OVERLAY_DIALOG_DEPENDENCIES = 'dialog/dependencies';

export function buildDataStudioModelerColumnOverlayToken(columnName: string): string {
  return `dialog/column/${columnName.trim()}`;
}

export function parseDataStudioModelerColumnOverlayToken(token: string): string | null {
  const prefix = 'dialog/column/';
  if (!token.startsWith(prefix)) {
    return null;
  }
  const name = token.slice(prefix.length).trim();
  return name || null;
}

export function resolveDataStudioModelerOverlayToken(input: {
  generalEditOpen: boolean;
  identityOpen: boolean;
  recordPoliciesOpen: boolean;
  listAccessOpen: boolean;
  dependenciesOpen: boolean;
}): string | null {
  return resolvePriorityOverlayToken([
    { token: DATA_STUDIO_MODELER_OVERLAY_DIALOG_RECORD_POLICIES, isOpen: input.recordPoliciesOpen, priority: 300 },
    { token: DATA_STUDIO_MODELER_OVERLAY_DIALOG_LIST_ACCESS, isOpen: input.listAccessOpen, priority: 290 },
    { token: DATA_STUDIO_MODELER_OVERLAY_DIALOG_DEPENDENCIES, isOpen: input.dependenciesOpen, priority: 280 },
    { token: DATA_STUDIO_MODELER_OVERLAY_DIALOG_IDENTITY, isOpen: input.identityOpen, priority: 270 },
    { token: DATA_STUDIO_MODELER_OVERLAY_DIALOG_GENERAL, isOpen: input.generalEditOpen, priority: 260 },
  ]);
}
