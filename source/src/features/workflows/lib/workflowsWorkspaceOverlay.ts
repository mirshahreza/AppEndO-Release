import { resolvePriorityOverlayToken } from '../../../shared/routing/resolvePriorityOverlayToken';

export const WORKFLOW_OVERLAY_PANEL_DEAD_LETTERS = 'panel/dead-letters';
export const WORKFLOW_OVERLAY_PANEL_SLA_VIOLATIONS = 'panel/sla-violations';
export const WORKFLOW_OVERLAY_DIALOG_CREATE = 'dialog/create';
export const WORKFLOW_OVERLAY_DIALOG_DUPLICATE = 'dialog/duplicate';
export const WORKFLOW_OVERLAY_DIALOG_DELETE = 'dialog/delete';

export function buildWorkflowDeleteOverlayToken(definitionId: number): string {
  return `dialog/delete/${definitionId}`;
}

export function parseWorkflowDeleteOverlayToken(token: string): number | null {
  const prefix = 'dialog/delete/';
  if (!token.startsWith(prefix)) {
    return null;
  }
  const id = Number(token.slice(prefix.length));
  return Number.isFinite(id) && id > 0 ? id : null;
}

export const WORKFLOW_OVERLAY_PANEL_EXECUTE = 'panel/execute';
export const WORKFLOW_OVERLAY_PANEL_SECRET_REFERENCES = 'panel/secret-references';
export const WORKFLOW_OVERLAY_PANEL_START_SETTINGS = 'panel/start-settings';
export const WORKFLOW_OVERLAY_PANEL_PALETTE = 'panel/palette';
export const WORKFLOW_OVERLAY_PANEL_AI = 'panel/ai';
export const WORKFLOW_OVERLAY_DIALOG_FIXTURES = 'dialog/fixtures';

export function buildWorkflowDossierOverlayToken(definitionId: number): string {
  return `dialog/dossier/${definitionId}`;
}

export function parseWorkflowDossierOverlayToken(token: string): number | null {
  const prefix = 'dialog/dossier/';
  if (!token.startsWith(prefix)) {
    return null;
  }
  const id = Number(token.slice(prefix.length));
  return Number.isFinite(id) && id > 0 ? id : null;
}

export function buildWorkflowNodePropertiesOverlayToken(nodeKey: string): string {
  const trimmed = nodeKey.trim();
  return `panel/node-properties/${trimmed}`;
}

export function parseWorkflowNodePropertiesOverlayToken(token: string): string | null {
  const prefix = 'panel/node-properties/';
  if (!token.startsWith(prefix)) {
    return null;
  }
  const nodeKey = token.slice(prefix.length).trim();
  return nodeKey || null;
}

export function resolveWorkflowListOverlayToken(input: {
  deadLettersOpen: boolean;
  slaViolationsOpen: boolean;
  createOpen: boolean;
  duplicateOpen: boolean;
  deleteOpen: boolean;
  deleteDefinitionId: number | null;
  dossierDefinitionId: number | null;
}): string | null {
  return resolvePriorityOverlayToken([
    {
      token: input.deleteOpen && input.deleteDefinitionId
        ? buildWorkflowDeleteOverlayToken(input.deleteDefinitionId)
        : WORKFLOW_OVERLAY_DIALOG_DELETE,
      isOpen: input.deleteOpen,
      priority: 500,
    },
    { token: WORKFLOW_OVERLAY_DIALOG_DUPLICATE, isOpen: input.duplicateOpen, priority: 400 },
    { token: WORKFLOW_OVERLAY_DIALOG_CREATE, isOpen: input.createOpen, priority: 300 },
    {
      token: input.dossierDefinitionId
        ? buildWorkflowDossierOverlayToken(input.dossierDefinitionId)
        : 'dialog/dossier/0',
      isOpen: input.dossierDefinitionId !== null,
      priority: 250,
    },
    { token: WORKFLOW_OVERLAY_PANEL_DEAD_LETTERS, isOpen: input.deadLettersOpen, priority: 120 },
    { token: WORKFLOW_OVERLAY_PANEL_SLA_VIOLATIONS, isOpen: input.slaViolationsOpen, priority: 110 },
  ]);
}

export function resolveWorkflowEditorOverlayToken(input: {
  executeOpen: boolean;
  secretReferencesOpen: boolean;
  startSettingsOpen: boolean;
  paletteOpen: boolean;
  aiPanelOpen: boolean;
  fixturesOpen: boolean;
  propertiesOpen: boolean;
  selectedNodeKey: string | null;
  dossierDefinitionId: number | null;
}): string | null {
  const nodeToken = input.propertiesOpen && input.selectedNodeKey
    ? buildWorkflowNodePropertiesOverlayToken(input.selectedNodeKey)
    : 'panel/node-properties';

  return resolvePriorityOverlayToken([
    {
      token: input.dossierDefinitionId
        ? buildWorkflowDossierOverlayToken(input.dossierDefinitionId)
        : 'dialog/dossier/0',
      isOpen: input.dossierDefinitionId !== null,
      priority: 500,
    },
    { token: WORKFLOW_OVERLAY_DIALOG_FIXTURES, isOpen: input.fixturesOpen, priority: 400 },
    { token: nodeToken, isOpen: input.propertiesOpen && Boolean(input.selectedNodeKey), priority: 350 },
    { token: WORKFLOW_OVERLAY_PANEL_EXECUTE, isOpen: input.executeOpen, priority: 300 },
    { token: WORKFLOW_OVERLAY_PANEL_SECRET_REFERENCES, isOpen: input.secretReferencesOpen, priority: 280 },
    { token: WORKFLOW_OVERLAY_PANEL_START_SETTINGS, isOpen: input.startSettingsOpen, priority: 270 },
    { token: WORKFLOW_OVERLAY_PANEL_PALETTE, isOpen: input.paletteOpen, priority: 260 },
    { token: WORKFLOW_OVERLAY_PANEL_AI, isOpen: input.aiPanelOpen, priority: 250 },
  ]);
}
