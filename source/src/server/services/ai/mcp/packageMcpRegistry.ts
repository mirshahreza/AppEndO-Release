import type { CapabilityMcpServer } from '../../../../core/packages/PackageManifestValidator';
import { buildPackageMcpGlobalId } from '../../../../core/packages/mcpServerIds';
import type { AiMcpServerConfig, AiMcpServerPublicConfig } from '../../../../shared/api/contracts/ai/types';
import { redactAiMcpServerConfig } from '../../../../shared/api/contracts/ai/validators';
import { getInstalledVersionsMap } from '../../../domain/package-domain/installStateRepository';
import { readObjectRegistry } from '../../../domain/package-domain/objectRegistryRepository';
import type { McpRegistryRecord } from '../../../domain/package-domain/types';

export type PluginManagedMcpServer = AiMcpServerConfig & {
  sourcePluginId: string;
};

export const mcpRegistryRecordToConfig = (
  packageId: string,
  record: McpRegistryRecord,
): PluginManagedMcpServer => ({
  id: record.conflictKey,
  label: record.label,
  enabled: record.enabled,
  transport: record.transport,
  command: record.command,
  args: record.args,
  url: record.url,
  env: record.env,
  allowedTools: record.allowedTools,
  note: record.note,
  sourcePluginId: packageId,
});

export const manifestMcpServerToConfig = (
  packageId: string,
  server: CapabilityMcpServer,
): PluginManagedMcpServer => ({
  id: buildPackageMcpGlobalId(packageId, server.id),
  label: server.label,
  enabled: server.enabled !== undefined ? Boolean(server.enabled) : true,
  transport: server.transport,
  command: server.command?.trim() || undefined,
  args: server.args?.length ? [...server.args] : undefined,
  url: server.url?.trim() || undefined,
  env: server.env && Object.keys(server.env).length > 0 ? { ...server.env } : undefined,
  allowedTools: server.allowedTools?.length ? [...server.allowedTools] : undefined,
  note: server.note?.trim() || undefined,
  sourcePluginId: packageId,
});

export const listInstalledPluginMcpServers = (): PluginManagedMcpServer[] => {
  const installed = getInstalledVersionsMap();
  const servers: PluginManagedMcpServer[] = [];

  for (const packageId of installed.keys()) {
    const registry = readObjectRegistry(packageId);
    if (!registry) continue;
    for (const record of registry.records.mcpServers ?? []) {
      servers.push(mcpRegistryRecordToConfig(packageId, record));
    }
  }

  return servers.sort((left, right) => left.id.localeCompare(right.id));
};

export const findPluginMcpServerOwner = (serverId: string): string | null => {
  for (const server of listInstalledPluginMcpServers()) {
    if (server.id === serverId) {
      return server.sourcePluginId;
    }
  }
  return null;
};

export const resolveEffectiveMcpServers = (
  settingsServers: readonly AiMcpServerConfig[],
): AiMcpServerConfig[] => {
  const settingsIds = new Set(settingsServers.map((server) => server.id));
  const pluginServers = listInstalledPluginMcpServers().filter((server) => !settingsIds.has(server.id));
  return [...settingsServers, ...pluginServers];
};

export const toPluginManagedPublicMcpServer = (
  server: PluginManagedMcpServer,
): AiMcpServerPublicConfig => ({
  ...redactAiMcpServerConfig(server),
  sourcePluginId: server.sourcePluginId,
  managedByPlugin: true,
});

export const listEffectivePublicMcpServers = (
  settingsServers: readonly AiMcpServerConfig[],
): AiMcpServerPublicConfig[] => {
  const settingsPublic = settingsServers.map(redactAiMcpServerConfig);
  const settingsIds = new Set(settingsServers.map((server) => server.id));
  const pluginPublic = listInstalledPluginMcpServers()
    .filter((server) => !settingsIds.has(server.id))
    .map(toPluginManagedPublicMcpServer);
  return [...settingsPublic, ...pluginPublic];
};
