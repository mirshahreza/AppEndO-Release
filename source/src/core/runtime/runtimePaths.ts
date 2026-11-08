import path from 'path';

/** Single on-disk working directory for all app filesystem artifacts. */
export const WORKSPACE_ROOT = 'workspace';

export const runtimeDirs = {
  root: WORKSPACE_ROOT,
  workspace: WORKSPACE_ROOT,
  /** Shared atomic-write / helper temp for every workspace module — safe to gitignore. */
  workspaceTemp: path.join(WORKSPACE_ROOT, 'temp'),
  workspaceAssets: path.join(WORKSPACE_ROOT, 'assets'),
  serverFunctions: path.join(WORKSPACE_ROOT, 'server-functions'),
  serverFunctionsCustom: path.join(WORKSPACE_ROOT, 'server-functions', 'custom'),
  serverFunctionsBuiltin: path.join(WORKSPACE_ROOT, 'server-functions', 'builtin'),
  serverFunctionsLocks: path.join(WORKSPACE_ROOT, 'server-functions', 'locks'),
  designer: path.join(WORKSPACE_ROOT, 'designer'),
  designerDrafts: path.join(WORKSPACE_ROOT, 'designer', 'drafts'),
  designerSnapshots: path.join(WORKSPACE_ROOT, 'designer', 'snapshots'),
  designerPreviewLogs: path.join(WORKSPACE_ROOT, 'designer', 'preview-logs'),
  designerExports: path.join(WORKSPACE_ROOT, 'designer', 'exports'),
  platformRegistry: path.join(WORKSPACE_ROOT, 'platform-registry'),
  edgeModels: path.join(WORKSPACE_ROOT, 'edge-models'),
  edgeApis: path.join(WORKSPACE_ROOT, 'edge-apis'),
  edgeModelStudioMeta: path.join(WORKSPACE_ROOT, 'edge-model-studio-meta'),
  edgeModelsLocks: path.join(WORKSPACE_ROOT, 'edge-models', 'locks'),
  edgeApisLocks: path.join(WORKSPACE_ROOT, 'edge-apis', 'locks'),
  edgeModelStudioMetaLocks: path.join(WORKSPACE_ROOT, 'edge-model-studio-meta', 'locks'),
  recordPolicies: path.join(WORKSPACE_ROOT, 'record-policies'),
  recordPoliciesLocks: path.join(WORKSPACE_ROOT, 'record-policies', 'locks'),
  recordPolicyBindings: path.join(WORKSPACE_ROOT, 'record-policy-bindings'),
  recordPolicyBindingsLocks: path.join(WORKSPACE_ROOT, 'record-policy-bindings', 'locks'),
  querySurfaceBindings: path.join(WORKSPACE_ROOT, 'query-surface-bindings'),
  querySurfaceBindingsLocks: path.join(WORKSPACE_ROOT, 'query-surface-bindings', 'locks'),
  appearancePresets: path.join(WORKSPACE_ROOT, 'appearance'),
  appearancePresetsLocks: path.join(WORKSPACE_ROOT, 'appearance', 'locks'),
  sshHub: path.join(WORKSPACE_ROOT, 'ssh-hub'),
  sshHubLocks: path.join(WORKSPACE_ROOT, 'ssh-hub', 'locks'),
  rdpHub: path.join(WORKSPACE_ROOT, 'rdp-hub'),
  rdpHubLocks: path.join(WORKSPACE_ROOT, 'rdp-hub', 'locks'),
  fileHub: path.join(WORKSPACE_ROOT, 'file-hub'),
  fileHubLocks: path.join(WORKSPACE_ROOT, 'file-hub', 'locks'),
  sqlConsole: path.join(WORKSPACE_ROOT, 'sql-console'),
  sqlConsoleLocks: path.join(WORKSPACE_ROOT, 'sql-console', 'locks'),
  httpConnections: path.join(WORKSPACE_ROOT, 'http-connections'),
  httpConnectionsLocks: path.join(WORKSPACE_ROOT, 'http-connections', 'locks'),
  appendoo: path.join(WORKSPACE_ROOT, 'appendoo'),
  models: path.join(WORKSPACE_ROOT, 'models'),
  modelsEmbeddings: path.join(WORKSPACE_ROOT, 'models', 'embeddings'),
  platform: path.join(WORKSPACE_ROOT, 'platform'),
  platformFonts: path.join(WORKSPACE_ROOT, 'platform', 'fonts'),
  platformPwa: path.join(WORKSPACE_ROOT, 'platform', 'pwa'),
  feedbackAttachments: path.join(WORKSPACE_ROOT, 'feedback-attachments'),
  directMessageAttachments: path.join(WORKSPACE_ROOT, 'direct-message-attachments'),
} as const;

export const EDGE_MODELS_INDEX_PATH = path.join(runtimeDirs.edgeModels, 'index.json');
export const EDGE_APIS_INDEX_PATH = path.join(runtimeDirs.edgeApis, 'index.json');
export const EDGE_MODEL_STUDIO_META_INDEX_PATH = path.join(runtimeDirs.edgeModelStudioMeta, 'index.json');
export const RECORD_POLICIES_INDEX_PATH = path.join(runtimeDirs.recordPolicies, 'index.json');
export const SSH_HUB_INDEX_PATH = path.join(runtimeDirs.sshHub, 'index.json');
export const RDP_HUB_INDEX_PATH = path.join(runtimeDirs.rdpHub, 'index.json');
export const FILE_HUB_INDEX_PATH = path.join(runtimeDirs.fileHub, 'index.json');
export const SQL_CONSOLE_COLLECTIONS_INDEX_PATH = path.join(runtimeDirs.sqlConsole, 'collections.json');
export const HTTP_CONNECTIONS_INDEX_PATH = path.join(runtimeDirs.httpConnections, 'index.json');
export const HTTP_WORKSHOP_COLLECTIONS_INDEX_PATH = path.join(runtimeDirs.httpConnections, 'collections.json');

export const SERVER_FUNCTIONS_INDEX_PATH = path.join(runtimeDirs.serverFunctions, 'index.json');
