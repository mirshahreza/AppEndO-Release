import type { ConflictItem, PluginObjectRegistry } from './types';

export type ConflictOwnerIndex = {
  apis: Map<string, string>;
  ui_components: Map<string, string>;
  db_objects: Map<string, string>;
  mcp_servers: Map<string, string>;
  workflow_actions: Map<string, string>;
};

export function buildConflictOwnerIndex(
  registries: Array<{ ownerPackageId: string; registry: PluginObjectRegistry }>,
): ConflictOwnerIndex {
  const existingByType: ConflictOwnerIndex = {
    apis: new Map<string, string>(),
    ui_components: new Map<string, string>(),
    db_objects: new Map<string, string>(),
    mcp_servers: new Map<string, string>(),
    workflow_actions: new Map<string, string>(),
  };

  for (const { ownerPackageId, registry } of registries) {
    for (const item of registry.records.apis) {
      existingByType.apis.set(item.conflictKey, ownerPackageId);
    }
    for (const item of registry.records.uiComponents) {
      existingByType.ui_components.set(item.conflictKey, ownerPackageId);
    }
    for (const item of registry.records.dbObjects) {
      existingByType.db_objects.set(item.conflictKey, ownerPackageId);
    }
    for (const item of registry.records.mcpServers ?? []) {
      existingByType.mcp_servers.set(item.conflictKey, ownerPackageId);
    }
    for (const item of registry.records.workflowActions ?? []) {
      existingByType.workflow_actions.set(item.conflictKey, ownerPackageId);
    }
  }

  return existingByType;
}

export function collectConflicts(
  packageId: string,
  candidate: PluginObjectRegistry,
  existingByType: ConflictOwnerIndex,
): ConflictItem[] {
  const conflicts: ConflictItem[] = [];

  for (const item of candidate.records.apis) {
    const owner = existingByType.apis.get(item.conflictKey);
    if (owner) {
      conflicts.push({ objectType: 'apis', conflictKey: item.conflictKey, ownerPackageId: owner });
    }
  }

  for (const item of candidate.records.uiComponents) {
    const owner = existingByType.ui_components.get(item.conflictKey);
    if (owner) {
      conflicts.push({ objectType: 'ui_components', conflictKey: item.conflictKey, ownerPackageId: owner });
    }
  }

  for (const item of candidate.records.dbObjects) {
    const owner = existingByType.db_objects.get(item.conflictKey);
    if (owner) {
      conflicts.push({ objectType: 'db_objects', conflictKey: item.conflictKey, ownerPackageId: owner });
    }
  }

  for (const item of candidate.records.mcpServers ?? []) {
    const owner = existingByType.mcp_servers.get(item.conflictKey);
    if (owner) {
      conflicts.push({ objectType: 'mcp_servers', conflictKey: item.conflictKey, ownerPackageId: owner });
    }
  }

  for (const item of candidate.records.workflowActions ?? []) {
    const owner = existingByType.workflow_actions.get(item.conflictKey);
    if (owner) {
      conflicts.push({ objectType: 'workflow_actions', conflictKey: item.conflictKey, ownerPackageId: owner });
    }
  }

  return conflicts;
}

export function conflictMessages(conflicts: ConflictItem[]): string[] {
  return conflicts.map(
    (c) => `${c.objectType}: ${c.conflictKey} (owned by ${c.ownerPackageId})`,
  );
}

export function groupConflictsByOwner(conflicts: ConflictItem[]): Map<string, ConflictItem[]> {
  const grouped = new Map<string, ConflictItem[]>();
  for (const item of conflicts) {
    const arr = grouped.get(item.ownerPackageId) ?? [];
    arr.push(item);
    grouped.set(item.ownerPackageId, arr);
  }
  return grouped;
}

export function removeConflictsFromRegistry(
  registry: PluginObjectRegistry,
  items: ConflictItem[],
  updatedAt: string,
): PluginObjectRegistry {
  const keysByType = {
    apis: new Set(items.filter((x) => x.objectType === 'apis').map((x) => x.conflictKey)),
    ui_components: new Set(items.filter((x) => x.objectType === 'ui_components').map((x) => x.conflictKey)),
    db_objects: new Set(items.filter((x) => x.objectType === 'db_objects').map((x) => x.conflictKey)),
    mcp_servers: new Set(items.filter((x) => x.objectType === 'mcp_servers').map((x) => x.conflictKey)),
    workflow_actions: new Set(items.filter((x) => x.objectType === 'workflow_actions').map((x) => x.conflictKey)),
  };

  return {
    ...registry,
    records: {
      apis: registry.records.apis.filter((x) => !keysByType.apis.has(x.conflictKey)),
      uiComponents: registry.records.uiComponents.filter((x) => !keysByType.ui_components.has(x.conflictKey)),
      uiRoutes: registry.records.uiRoutes,
      dbObjects: registry.records.dbObjects.filter((x) => !keysByType.db_objects.has(x.conflictKey)),
      mcpServers: (registry.records.mcpServers ?? []).filter((x) => !keysByType.mcp_servers.has(x.conflictKey)),
      workflowActions: (registry.records.workflowActions ?? []).filter((x) => !keysByType.workflow_actions.has(x.conflictKey)),
      // edge_models/edge_apis/workflows are not part of ConflictType — never evicted here, pass through unchanged.
      edgeModels: registry.records.edgeModels,
      edgeApis: registry.records.edgeApis,
      workflows: registry.records.workflows,
    },
    updatedAt,
  };
}
