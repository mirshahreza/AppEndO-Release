export type LifecycleStatusCode =
  | 'not_found'
  | 'busy'
  | 'locked'
  | 'already_installed_other_version'
  | 'already_uninstalled'
  | 'dependency_missing'
  | 'dependency_conflict'
  | 'dependency_cycle'
  | 'reverse_dependency_blocked'
  | 'conflict_denied'
  | 'script_execution_unsafe'
  | 'invalid_manifest'
  | 'libraries_unsatisfied'
  | 'install_failed'
  | 'internal_error';

export type PluginLifecycleOperation = 'install' | 'uninstall' | 'reinstall' | 'enable' | 'disable';

export type PackageLifecycleResult =
  | {
      success: true;
      packageId: string;
      version: string | null;
      status: 'installed' | 'not_installed';
      enabled?: boolean;
      pluginKind?: 'extension' | 'vertical-app';
      deploymentStatus?: 'none' | 'pending' | 'applied';
      idempotent: boolean;
      operation: PluginLifecycleOperation;
      details?: string[];
    }
  | {
      success: false;
      error: string;
      code: LifecycleStatusCode;
      details?: string[];
      operation: PluginLifecycleOperation;
    };

export interface InstallPackageOptions {
  version?: string;
  targetDataSource?: string;
  overridePolicy?: {
    apis?: 'allow' | 'deny';
    ui_components?: 'allow' | 'deny';
    db_objects?: 'allow' | 'deny';
    mcp_servers?: 'allow' | 'deny';
  };
  /** Apply optional seed db_objects (initial records). Defaults to true. */
  installOptionalRecords?: boolean;
  /** Skip required/optional install SQL (reinstall keeps DB; refresh runtime only). */
  skipInstallDbScripts?: boolean;
}

import type { PackageUninstallRemoveScope } from '../../../shared/api/contracts/package/uninstall';

export interface UninstallPluginOptions {
  removeScope?: PackageUninstallRemoveScope;
}

export interface RetainedPackageArtifactsV1 {
  version: string;
  uiComponents?: boolean;
}

export interface InstallHistoryEntry {
  operation: PluginLifecycleOperation;
  version: string | null;
  requestedBy: string;
  at: string;
  result: 'success' | 'failed';
  error: string | null;
}

export interface InstallOperationInfo {
  operation: PluginLifecycleOperation;
  operationId: string;
  requestedBy: string;
  startedAt: string;
  finishedAt: string | null;
  result: 'running' | 'success' | 'failed';
  error: string | null;
}

export interface InstallStateV1 {
  schema: 'package-install-state';
  schemaVersion: '1.0.0';
  packageId: string;
  status: 'not_installed' | 'installing' | 'installed' | 'uninstalling' | 'failed';
  activeVersion: string | null;
  /** Runtime toggle — only meaningful when status is installed. Defaults to true. */
  enabled?: boolean;
  targetDataSource?: string;
  pluginKind?: 'extension' | 'vertical-app';
  deploymentStatus?: 'none' | 'pending' | 'applied';
  /** Whether optional seed records were applied on this install. Missing means they were applied. */
  optionalRecordsInstalled?: boolean;
  retainedArtifacts?: RetainedPackageArtifactsV1;
  lastOperation?: InstallOperationInfo;
  history?: InstallHistoryEntry[];
  updatedAt: string;
}

export interface ApiRegistryRecord {
  apiId: string;
  conflictKey: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  httpPath: string;
  entry: string;
  auth: 'public' | 'authenticated' | 'admin';
  timeoutMs?: number;
  registeredAt: string;
}

export interface UiRegistryRecord {
  conflictKey: string;
  slotId: string;
  componentKey: string;
  entry: string;
  draftEntry?: string;
  order: number;
  registeredAt: string;
}

export interface UiRouteRegistryRecord {
  conflictKey: string;
  pageKey: string;
  entry: string;
  suggestedRoutePattern?: string;
  suggestedMountId?: string;
  registeredAt: string;
}

export interface DbRegistryRecord {
  conflictKey: string;
  objectType: 'table' | 'view' | 'index' | 'function' | 'trigger' | 'seed';
  objectName: string;
  targetDataSource: string;
  installScript: string;
  uninstallScript: string | null;
  seedScript: string | null;
  registeredAt: string;
}

export interface EdgeModelRegistryRecord {
  conflictKey: string;
  edgeModelId: string;
  entry: string;
  registeredAt: string;
}

export interface EdgeApiRegistryRecord {
  conflictKey: string;
  edgeApiId: string;
  edgeModelId: string;
  entry: string;
  registeredAt: string;
}

export interface WorkflowRegistryRecord {
  conflictKey: string;
  scopeKey: string;
  key: string;
  entry: string;
  registeredAt: string;
}

/** p-99/WFT-1 — a package-contributed workflow Action, pointing at extracted definition+script files (see `packageWorkflowActionRuntime.service.ts`). Not yet consumed by the live dispatch engine — resolved only via `packageActionRegistry.ts`'s live-rescan lookup, deliberately deferred wiring (see p-99 plan). */
export interface WorkflowActionRegistryRecord {
  conflictKey: string;
  actionKey: string;
  actionVersion: string;
  definitionEntry: string;
  scriptEntry: string;
  registeredAt: string;
}

export interface McpRegistryRecord {
  conflictKey: string;
  localId: string;
  label: string;
  enabled: boolean;
  transport: 'stdio' | 'sse' | 'http';
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
  allowedTools?: string[];
  note?: string;
  registeredAt: string;
}

export interface PluginObjectRegistry {
  schema: 'package-object-registry';
  schemaVersion: '1.0.0';
  packageId: string;
  activeVersion: string;
  records: {
    apis: ApiRegistryRecord[];
    uiComponents: UiRegistryRecord[];
    uiRoutes: UiRouteRegistryRecord[];
    dbObjects: DbRegistryRecord[];
    mcpServers: McpRegistryRecord[];
    edgeModels: EdgeModelRegistryRecord[];
    edgeApis: EdgeApiRegistryRecord[];
    workflows?: WorkflowRegistryRecord[];
    workflowActions?: WorkflowActionRegistryRecord[];
  };
  updatedAt: string;
}

export type ConflictType = 'apis' | 'ui_components' | 'db_objects' | 'mcp_servers' | 'workflow_actions';

export interface ConflictItem {
  objectType: ConflictType;
  conflictKey: string;
  ownerPackageId: string;
}

export interface InstallSelection {
  version: string;
  manifestPath: string;
}

export const MAX_HISTORY_ITEMS = 50;

export const DEFAULT_SCRIPT_POLICY_TIMEOUT_MS = 1_500;

export interface ScriptPolicy {
  allowedPathPrefixes: string[];
  maxTimeoutMs: number;
}

export interface ScriptValidationIssue {
  scriptPath: string;
  reason: string;
}
