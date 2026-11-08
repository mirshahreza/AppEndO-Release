const STORAGE_PREFIX = 'appendo.workspace-split.v1:';

export type WorkspaceSplitSizeState = {
  size: number;
  collapsed: boolean;
  expandedSize: number;
};

export type WorkspaceSplitRatioState = {
  ratio: number;
  collapsed: boolean;
  expandedRatio: number;
};

export const WORKSPACE_SPLIT_PANEL_KEYS = {
  serverFunctionsSidebar: 'server-functions.sidebar',
  serverFunctionsPayload: 'server-functions.payload',
  serverFunctionsPayloadHeight: 'server-functions.payload-height',
  serverFunctionsAiPanel: 'server-functions.ai-panel',
  sandboxNav: 'sandbox.nav',
  designerPalette: 'designer.palette',
  designerInspector: 'designer.inspector',
  designerDesignCode: 'designer.design-code',
  liveDesignerOutline: 'live-designer.outline',
  liveDesignerProperties: 'live-designer.properties',
  liveDesignerCode: 'live-designer.code',
  liveDesignerAiPanel: 'live-designer.ai-panel',
  gitChangesDiff: 'git.changes-diff',
  imageEditorAiPanel: 'image-editor.ai-panel',
  sshHubAiPanel: 'ssh-hub.ai-panel',
  sshHubSidebar: 'ssh-hub.sidebar',
  fileHubAiPanel: 'file-hub.ai-panel',
  fileHubSidebar: 'file-hub.sidebar',
  rdpHubSidebar: 'rdp-hub.sidebar',
  contextChatPanelDemo: 'base-components.context-chat-panel',
  fileManagerTree: 'file-manager.tree',
  apiTalkSidebar: 'api-talk.sidebar',
  apiTalkRequestHeight: 'api-talk.request-height',
  sqlConsoleSidebar: 'sql-console.sidebar',
  sqlConsoleEditorHeight: 'sql-console.editor-height',
  sqlConsoleAiPanel: 'sql-console.ai-panel',
  workflowDesignerAiPanel: 'workflows.ai-panel',
  workflowExecuteInputHeight: 'workflows.execute-input-height',
  workflowNodePropertiesInput: 'workflows.node-properties-input',
  workflowNodePropertiesOutput: 'workflows.node-properties-output',
  dataStudioRunUsageHeight: 'data-studio.run-usage-height',
  dataStudioDatasheetSqlHeight: 'data-studio.datasheet-sql-height',
  componentLayoutStartAside: 'component-layout.start-aside',
  componentLayoutEndAside: 'component-layout.end-aside',
  layoutsEditorProperties: 'layouts.editor-properties',
  recordFormSidePanel: 'record-form.side-panel',
  ideaFoundryInspector: 'idea-foundry.inspector',
  packageDetailInspector: 'package-detail.inspector',
  hwyGeoResponsibilityPatchHistory: 'hwy-geo-responsibility.patch-history',
} as const;

export type WorkspaceSplitPanelKey = typeof WORKSPACE_SPLIT_PANEL_KEYS[keyof typeof WORKSPACE_SPLIT_PANEL_KEYS];

export function workspaceSplitStorageKey(panelKey: WorkspaceSplitPanelKey): string {
  return `${STORAGE_PREFIX}${panelKey}`;
}

export function clampWorkspaceSplitSize(size: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(size)));
}

export function clampWorkspaceSplitRatio(ratio: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, ratio));
}

function readJson<T>(storageKey: string): T | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson(storageKey: string, value: unknown): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(value));
  } catch {
    // ignore quota / privacy errors
  }
}

export function readWorkspaceSplitSizeState(
  panelKey: WorkspaceSplitPanelKey,
  fallback: WorkspaceSplitSizeState,
): WorkspaceSplitSizeState {
  const stored = readJson<Partial<WorkspaceSplitSizeState>>(workspaceSplitStorageKey(panelKey));
  if (!stored) {
    return fallback;
  }

  const expandedSize = typeof stored.expandedSize === 'number' && Number.isFinite(stored.expandedSize)
    ? stored.expandedSize
    : fallback.expandedSize;
  const size = typeof stored.size === 'number' && Number.isFinite(stored.size)
    ? stored.size
    : fallback.size;
  const collapsed = typeof stored.collapsed === 'boolean' ? stored.collapsed : fallback.collapsed;

  return {
    size,
    collapsed,
    expandedSize,
  };
}

export function persistWorkspaceSplitSizeState(
  panelKey: WorkspaceSplitPanelKey,
  state: WorkspaceSplitSizeState,
): void {
  writeJson(workspaceSplitStorageKey(panelKey), state);
}

export function readWorkspaceSplitRatioState(
  panelKey: WorkspaceSplitPanelKey,
  fallback: WorkspaceSplitRatioState,
): WorkspaceSplitRatioState {
  const stored = readJson<Partial<WorkspaceSplitRatioState>>(workspaceSplitStorageKey(panelKey));
  if (!stored) {
    return fallback;
  }

  const expandedRatio = typeof stored.expandedRatio === 'number' && Number.isFinite(stored.expandedRatio)
    ? stored.expandedRatio
    : fallback.expandedRatio;
  const ratio = typeof stored.ratio === 'number' && Number.isFinite(stored.ratio)
    ? stored.ratio
    : fallback.ratio;
  const collapsed = typeof stored.collapsed === 'boolean' ? stored.collapsed : fallback.collapsed;

  return {
    ratio,
    collapsed,
    expandedRatio,
  };
}

export function persistWorkspaceSplitRatioState(
  panelKey: WorkspaceSplitPanelKey,
  state: WorkspaceSplitRatioState,
): void {
  writeJson(workspaceSplitStorageKey(panelKey), state);
}
