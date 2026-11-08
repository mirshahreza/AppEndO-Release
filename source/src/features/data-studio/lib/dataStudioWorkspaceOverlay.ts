import {
  buildHrefWithWorkspaceOverlay,
  workspaceOverlayTokenStartsWith,
} from '../../../shared/routing/workspaceOverlayDeepLink';
import type { DataStudioExplorerObjectKind } from '../types';
import type { EdgeModelDesignerPanelEntry } from '../hooks/useEdgeModelDesignerManager';
import type { EdgeModelDatasheetPanelEntry } from '../hooks/useEdgeModelDatasheetManager';
import type { EdgeModelRelationsPanelEntry } from '../hooks/useEdgeModelRelationsManager';
import type { SchemaObjectSqlPanelEntry } from '../hooks/useSchemaObjectSqlPanelManager';
import type { SchemaObjectRunPanelEntry } from '../hooks/useSchemaObjectRunPanelManager';

export const DATA_STUDIO_OVERLAY_PANEL_DESIGNER = 'panel/designer';
export const DATA_STUDIO_OVERLAY_PANEL_DATASHEET = 'panel/datasheet';
export const DATA_STUDIO_OVERLAY_PANEL_RELATIONS = 'panel/relations';
export const DATA_STUDIO_OVERLAY_DIALOG_CREATE_OBJECT = 'dialog/create-object';

const DATA_STUDIO_OVERLAY_PANEL_SQL_PREFIX = 'panel/sql';
const DATA_STUDIO_OVERLAY_PANEL_RUN_PREFIX = 'panel/run';

export function buildDataStudioSqlPanelOverlayToken(
  objectKind: DataStudioExplorerObjectKind,
  objectName: string,
): string {
  return `${DATA_STUDIO_OVERLAY_PANEL_SQL_PREFIX}/${objectKind}/${objectName}`;
}

export function buildDataStudioRunPanelOverlayToken(
  objectKind: DataStudioExplorerObjectKind,
  objectName: string,
): string {
  return `${DATA_STUDIO_OVERLAY_PANEL_RUN_PREFIX}/${objectKind}/${objectName}`;
}

export function parseDataStudioObjectScopedPanelOverlay(
  token: string,
  prefix: string,
): { objectKind: DataStudioExplorerObjectKind; objectName: string } | null {
  if (!workspaceOverlayTokenStartsWith(token, prefix)) {
    return null;
  }
  const rest = token.slice(prefix.length + 1);
  const slash = rest.indexOf('/');
  if (slash <= 0) {
    return null;
  }
  const objectKind = rest.slice(0, slash) as DataStudioExplorerObjectKind;
  const objectName = rest.slice(slash + 1).trim();
  if (!objectName) {
    return null;
  }
  return { objectKind, objectName };
}

type OverlayZCandidate = { token: string; zOrder: number };

function pushPanelCandidates(
  target: OverlayZCandidate[],
  panels: { zOrder: number }[],
  token: string,
): void {
  for (const panel of panels) {
    target.push({ token, zOrder: panel.zOrder });
  }
}

export function resolveDataStudioActiveOverlayToken(input: {
  createObjectDialogOpen: boolean;
  designerPanels: EdgeModelDesignerPanelEntry[];
  datasheetPanels: EdgeModelDatasheetPanelEntry[];
  relationsPanels: EdgeModelRelationsPanelEntry[];
  sqlPanels: SchemaObjectSqlPanelEntry[];
  runPanels: SchemaObjectRunPanelEntry[];
}): string | null {
  if (input.createObjectDialogOpen) {
    return DATA_STUDIO_OVERLAY_DIALOG_CREATE_OBJECT;
  }

  const candidates: OverlayZCandidate[] = [];
  pushPanelCandidates(candidates, input.designerPanels, DATA_STUDIO_OVERLAY_PANEL_DESIGNER);
  pushPanelCandidates(candidates, input.datasheetPanels, DATA_STUDIO_OVERLAY_PANEL_DATASHEET);
  pushPanelCandidates(candidates, input.relationsPanels, DATA_STUDIO_OVERLAY_PANEL_RELATIONS);

  for (const panel of input.sqlPanels) {
    candidates.push({
      token: buildDataStudioSqlPanelOverlayToken(panel.context.objectKind, panel.context.objectName),
      zOrder: panel.zOrder,
    });
  }
  for (const panel of input.runPanels) {
    candidates.push({
      token: buildDataStudioRunPanelOverlayToken(panel.context.objectKind, panel.context.objectName),
      zOrder: panel.zOrder,
    });
  }

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((left, right) => right.zOrder - left.zOrder);
  return candidates[0]?.token ?? null;
}

export function buildDataStudioOverlayHref(
  pathnameAndSearch: string,
  token: string,
): string {
  return buildHrefWithWorkspaceOverlay(pathnameAndSearch, token);
}
