import {
  AUTHENTICATED_FUNCTION_ACCESS_CONTROL,
  canAccessManagedFunction,
  parseFunctionAccessControl,
  type FunctionAccessControl,
  type ManagedFunctionAccessPrincipal,
} from '../../../shared/api/contracts/server-functions/accessControl';
import {
  AGENT_CAPABILITY_UI_PACKS,
  AI_CAPABILITY_PACK_BY_ID,
  DEFAULT_AGENT_CAPABILITY_SCOPE,
  resolveDefaultCapabilityPackIds,
  type AiAgentCapabilityScope,
  type AiCapabilityPackId,
  isAiCapabilityPackId,
} from '../../../shared/api/contracts/ai/capabilityPacks';
import { DEFAULT_INBOUND_MCP_SERVICE_ROLE } from '../../../shared/api/contracts/ai/constants';
import type {
  EffectiveMcpAccess,
  McpAccessCatalogMcpServer,
  McpAccessCatalogResponse,
  McpAccessContextSnapshot,
  McpAccessMePack,
  McpAccessMeResponse,
  McpGrantResourceKind,
  ReplaceRoleMcpGrantsPayload,
  ReplaceMcpResourceAccessControlPayload,
  RoleMcpGrantInput,
  RoleMcpGrantsResponse,
} from '../../../shared/api/contracts/ai/mcpAccess';
import { isMcpGrantResourceKind } from '../../../shared/api/contracts/ai/mcpAccess';
import type { AiMcpServerConfig, AiMcpServerPublicConfig, AiMcpSettings } from '../../../shared/api/contracts/ai/types';
import { DEFAULT_AI_MCP_SETTINGS } from '../../../shared/api/contracts/ai/constants';
import { redactAiMcpServerConfig } from '../../../shared/api/contracts/ai/validators';
import { aiManager } from '../../../core/ai/AiManager';
import { logger } from '../../../core/logging/Logger';
import { listRoleMcpGrantRows, replaceRoleMcpGrants } from '../../domain/ai/mcpAccessRepository';
import { findRoleIdByName } from '../../domain/users/roleRepository';
import { getUserRolesForRequest } from '../../domain/users/userRoleRepository';
import { HttpError } from '../../errors/HttpError';
import { BUILTIN_CAPABILITY_PACK_REGISTRARS } from './mcp/builtin';
import {
  listEffectivePublicMcpServers,
  listInstalledPluginMcpServers,
} from './mcp/packageMcpRegistry';

export const ADMIN_BYPASS_ROLE = 'ADMIN';

export type McpAccessAuditEvent =
  | 'agent_run_denied'
  | 'inbound_packs_clamped';

export const logMcpAccessAudit = (
  event: McpAccessAuditEvent,
  details: Record<string, unknown>,
): void => {
  if (event === 'agent_run_denied') {
    logger.warn('McpAccess', 'MCP access denied — agent capability scope outside role grants', {
      event,
      ...details,
    });
    return;
  }

  logger.info('McpAccess', 'Inbound MCP capability packs clamped by role grants', {
    event,
    ...details,
  });
};

const REGISTERED_PACK_IDS = Object.keys(BUILTIN_CAPABILITY_PACK_REGISTRARS).filter(
  isAiCapabilityPackId,
) as AiCapabilityPackId[];

export const isAdminMcpBypass = (roles: readonly string[]): boolean =>
  roles.some((role) => role.toUpperCase() === ADMIN_BYPASS_ROLE);

export const DEFAULT_MCP_RESOURCE_ACCESS_CONTROL: FunctionAccessControl = AUTHENTICATED_FUNCTION_ACCESS_CONTROL;

export const buildManagedFunctionAccessPrincipal = (
  userId: number,
  roles: readonly string[],
  email?: string | null,
): ManagedFunctionAccessPrincipal => ({
  isAuthenticated: true,
  userId,
  email,
  roles,
  isAdmin: isAdminMcpBypass(roles),
});

export const resolveMcpResourceAccessControl = (
  resourceId: string,
  resourceKind: McpGrantResourceKind,
  settingsMcpServers: readonly AiMcpServerConfig[],
  mcpSettings: AiMcpSettings,
): FunctionAccessControl => {
  if (resourceKind === 'external_mcp') {
    const server = settingsMcpServers.find((item) => item.id === resourceId);
    return parseFunctionAccessControl(
      server?.accessControl ?? mcpSettings.resourceAccessControl?.[resourceId],
    );
  }

  return parseFunctionAccessControl(mcpSettings.resourceAccessControl?.[resourceId]);
};

export const filterEffectiveMcpAccessByResourcePolicy = (
  access: EffectiveMcpAccess,
  principal: ManagedFunctionAccessPrincipal,
  settingsMcpServers: readonly AiMcpServerConfig[],
  mcpSettings: AiMcpSettings,
): EffectiveMcpAccess => {
  if (access.adminBypass) {
    return access;
  }

  const settingsServerIds = new Set(settingsMcpServers.map((server) => server.id));
  const packIds = access.packIds.filter((packId) => canAccessManagedFunction(
    principal,
    resolveMcpResourceAccessControl(packId, 'builtin_pack', settingsMcpServers, mcpSettings),
  ));

  const mcpServerIds = access.mcpServerIds.filter((serverId) => {
    const resourceKind: McpGrantResourceKind = settingsServerIds.has(serverId)
      ? 'external_mcp'
      : 'plugin_mcp';
    return canAccessManagedFunction(
      principal,
      resolveMcpResourceAccessControl(serverId, resourceKind, settingsMcpServers, mcpSettings),
    );
  });

  return {
    ...access,
    packIds,
    mcpServerIds,
  };
};

export const assertMcpResourceInCatalog = (
  resourceKind: McpGrantResourceKind,
  resourceId: string,
  settingsMcpServers: readonly AiMcpServerConfig[],
): void => {
  const allowed = buildMcpAccessCatalogGrantKeys(settingsMcpServers);
  if (allowed.has(grantKey(resourceKind, resourceId))) {
    return;
  }
  throw new HttpError(404, `MCP resource "${resourceId}" was not found in the access catalog.`);
};

export const normalizeMcpResourceAccessControlPayload = (
  payload: unknown,
): ReplaceMcpResourceAccessControlPayload => {
  if (!payload || typeof payload !== 'object') {
    throw new HttpError(400, 'Request body must be an object.');
  }

  const candidate = payload as {
    resourceKind?: unknown;
    accessControl?: unknown;
  };
  const resourceKind = typeof candidate.resourceKind === 'string'
    ? candidate.resourceKind.trim()
    : '';
  if (!isMcpGrantResourceKind(resourceKind)) {
    throw new HttpError(400, 'resourceKind is invalid.');
  }
  if (resourceKind === 'external_mcp') {
    throw new HttpError(400, 'External MCP server access is stored on the server record.');
  }

  return {
    resourceKind,
    accessControl: parseFunctionAccessControl(candidate.accessControl),
  };
};

const uniqueSorted = <T extends string>(values: Iterable<T>): T[] => (
  Array.from(new Set(values)).sort((left, right) => left.localeCompare(right))
);

const filterEnabledPublicMcpServers = (
  servers: readonly AiMcpServerPublicConfig[],
): AiMcpServerPublicConfig[] => servers.filter((server) => server.enabled);

export const clampAgentCapabilityScope = (
  scope: AiAgentCapabilityScope,
  access: EffectiveMcpAccess,
): AiAgentCapabilityScope => {
  const allowedPackIds = new Set(access.packIds);
  const allowedMcpServerIds = new Set(access.mcpServerIds);

  return {
    packIds: scope.packIds.filter((packId) => allowedPackIds.has(packId)),
    mcpServerIds: scope.mcpServerIds.filter((serverId) => allowedMcpServerIds.has(serverId)),
  };
};

export const resolveDefaultAgentCapabilityScope = (
  access: EffectiveMcpAccess,
): AiAgentCapabilityScope => clampAgentCapabilityScope(DEFAULT_AGENT_CAPABILITY_SCOPE, access);

export const buildAdminEffectiveMcpAccess = (
  settingsMcpServers: readonly AiMcpServerConfig[],
): EffectiveMcpAccess => ({
  adminBypass: true,
  packIds: [...REGISTERED_PACK_IDS],
  mcpServerIds: uniqueSorted(
    listEffectivePublicMcpServers(settingsMcpServers)
      .filter((server) => server.enabled)
      .map((server) => server.id),
  ),
});

export const resolveInboundMcpServiceRoleName = (): string => {
  const configured = aiManager.getSettings()?.mcp.inboundHost?.serviceRoleName?.trim();
  return configured || DEFAULT_INBOUND_MCP_SERVICE_ROLE;
};

export const intersectInboundMcpPackIds = (
  configuredPackIds: readonly AiCapabilityPackId[],
  access: EffectiveMcpAccess,
): AiCapabilityPackId[] => {
  if (access.adminBypass) {
    return [...configuredPackIds];
  }

  const allowed = new Set(access.packIds);
  return configuredPackIds.filter((packId) => allowed.has(packId));
};

export async function resolveInboundMcpCapabilityPackIds(): Promise<AiCapabilityPackId[]> {
  const settings = aiManager.getSettings();
  const configuredPackIds = resolveDefaultCapabilityPackIds(settings?.mcp.defaultCapabilityPackIds);
  const serviceRoleName = resolveInboundMcpServiceRoleName();

  if (isAdminRoleName(serviceRoleName)) {
    return configuredPackIds;
  }

  const grantRows = await listRoleMcpGrantRows([serviceRoleName]);
  const grantAccess = buildEffectiveMcpAccessFromGrants(grantRows, settings?.mcpServers ?? []);
  const principal = buildManagedFunctionAccessPrincipal(0, [serviceRoleName]);
  const access = filterEffectiveMcpAccessByResourcePolicy(
    grantAccess,
    principal,
    settings?.mcpServers ?? [],
    settings?.mcp ?? DEFAULT_AI_MCP_SETTINGS,
  );
  const effectivePackIds = intersectInboundMcpPackIds(configuredPackIds, access);

  const deniedPackIds = configuredPackIds.filter((packId) => !effectivePackIds.includes(packId));
  if (deniedPackIds.length > 0) {
    logMcpAccessAudit('inbound_packs_clamped', {
      serviceRoleName,
      configuredPackIds,
      effectivePackIds,
      deniedPackIds,
      adminBypass: access.adminBypass,
    });
  }

  return effectivePackIds;
}

export const buildEffectiveMcpAccessFromGrants = (
  grants: Array<{ resource_kind: string; resource_id: string }>,
  settingsMcpServers: readonly AiMcpServerConfig[],
): EffectiveMcpAccess => {
  const packIds = new Set<AiCapabilityPackId>();
  const externalMcpIds = new Set<string>();
  const pluginMcpIds = new Set<string>();

  grants.forEach((grant) => {
    if (grant.resource_kind === 'builtin_pack' && isAiCapabilityPackId(grant.resource_id)) {
      packIds.add(grant.resource_id);
      return;
    }
    if (grant.resource_kind === 'external_mcp') {
      externalMcpIds.add(grant.resource_id);
      return;
    }
    if (grant.resource_kind === 'plugin_mcp') {
      pluginMcpIds.add(grant.resource_id);
    }
  });

  const settingsServerIds = new Set(settingsMcpServers.map((server) => server.id));
  const installedPluginIds = new Set(listInstalledPluginMcpServers().map((server) => server.id));

  const mcpServerIds = uniqueSorted([
    ...[...externalMcpIds].filter((serverId) => settingsServerIds.has(serverId)),
    ...[...pluginMcpIds].filter((serverId) => installedPluginIds.has(serverId)),
  ]);

  return {
    adminBypass: false,
    packIds: uniqueSorted(packIds),
    mcpServerIds,
  };
};

export async function resolveEffectiveMcpAccessForUser(
  userId: number,
  options?: {
    fallbackRole?: string;
    settingsMcpServers?: readonly AiMcpServerConfig[];
    mcpSettings?: AiMcpSettings;
    userEmail?: string | null;
  },
): Promise<EffectiveMcpAccess> {
  const roles = await getUserRolesForRequest(userId, options?.fallbackRole);
  const settingsMcpServers = options?.settingsMcpServers ?? [];
  const mcpSettings = options?.mcpSettings ?? DEFAULT_AI_MCP_SETTINGS;

  let access: EffectiveMcpAccess;
  if (isAdminMcpBypass(roles)) {
    access = buildAdminEffectiveMcpAccess(settingsMcpServers);
  } else {
    const grantRows = await listRoleMcpGrantRows(roles);
    access = buildEffectiveMcpAccessFromGrants(grantRows, settingsMcpServers);
  }

  const principal = buildManagedFunctionAccessPrincipal(userId, roles, options?.userEmail);
  return filterEffectiveMcpAccessByResourcePolicy(
    access,
    principal,
    settingsMcpServers,
    mcpSettings,
  );
}

export const buildAllowedUiPacks = (access: EffectiveMcpAccess): McpAccessMePack[] => {
  const allowed = new Set(access.packIds);
  return AGENT_CAPABILITY_UI_PACKS
    .filter((pack) => allowed.has(pack.id))
    .map((pack) => ({
      id: pack.id,
      label: pack.label,
      description: pack.description,
      icon: pack.icon,
      hasWriteTools: pack.hasWriteTools,
    }));
};

export const buildCatalogUiPacks = (): McpAccessMePack[] =>
  AGENT_CAPABILITY_UI_PACKS.map((pack) => ({
    id: pack.id,
    label: pack.label,
    description: pack.description,
    icon: pack.icon,
    hasWriteTools: pack.hasWriteTools,
  }));

export const buildCatalogMcpServers = (
  settingsMcpServers: readonly AiMcpServerConfig[],
): McpAccessCatalogMcpServer[] => {
  const settingsIds = new Set(settingsMcpServers.map((server) => server.id));
  const externalServers = filterEnabledPublicMcpServers(
    settingsMcpServers.map(redactAiMcpServerConfig),
  ).map((server) => ({
    ...server,
    resourceKind: 'external_mcp' as const,
  }));

  const pluginServers = listInstalledPluginMcpServers()
    .filter((server) => !settingsIds.has(server.id) && server.enabled)
    .map((server) => ({
      ...redactAiMcpServerConfig(server),
      sourcePluginId: server.sourcePluginId,
      managedByPlugin: true,
      resourceKind: 'plugin_mcp' as const,
    }));

  return [...externalServers, ...pluginServers].sort((left, right) => left.label.localeCompare(right.label));
};

export const buildMcpAccessCatalog = (
  settingsMcpServers: readonly AiMcpServerConfig[],
): McpAccessCatalogResponse => ({
  success: true,
  packs: buildCatalogUiPacks(),
  mcpServers: buildCatalogMcpServers(settingsMcpServers),
});

const grantKey = (resourceKind: McpGrantResourceKind, resourceId: string): string =>
  `${resourceKind}:${resourceId}`;

export const buildMcpAccessCatalogGrantKeys = (
  settingsMcpServers: readonly AiMcpServerConfig[],
): Set<string> => {
  const keys = new Set<string>();
  buildCatalogUiPacks().forEach((pack) => keys.add(grantKey('builtin_pack', pack.id)));
  buildCatalogMcpServers(settingsMcpServers).forEach((server) => {
    keys.add(grantKey(server.resourceKind, server.id));
  });
  return keys;
};

export const normalizeRoleMcpGrantInputs = (
  grants: unknown,
): RoleMcpGrantInput[] => {
  if (!Array.isArray(grants)) {
    throw new HttpError(400, 'grants must be an array.');
  }

  const normalized: RoleMcpGrantInput[] = [];
  const seen = new Set<string>();

  grants.forEach((entry, index) => {
    if (!entry || typeof entry !== 'object') {
      throw new HttpError(400, `grants[${index}] must be an object.`);
    }
    const candidate = entry as { resourceKind?: unknown; resourceId?: unknown };
    const resourceKind = typeof candidate.resourceKind === 'string' ? candidate.resourceKind.trim() : '';
    const resourceId = typeof candidate.resourceId === 'string' ? candidate.resourceId.trim() : '';

    if (!isMcpGrantResourceKind(resourceKind)) {
      throw new HttpError(400, `grants[${index}].resourceKind is invalid.`);
    }
    if (!resourceId) {
      throw new HttpError(400, `grants[${index}].resourceId is required.`);
    }

    const key = grantKey(resourceKind, resourceId);
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    normalized.push({ resourceKind, resourceId });
  });

  return normalized;
};

export const assertRoleMcpGrantsInCatalog = (
  grants: readonly RoleMcpGrantInput[],
  settingsMcpServers: readonly AiMcpServerConfig[],
): void => {
  const allowed = buildMcpAccessCatalogGrantKeys(settingsMcpServers);
  const invalid = grants.filter((grant) => !allowed.has(grantKey(grant.resourceKind, grant.resourceId)));
  if (invalid.length === 0) {
    return;
  }
  throw new HttpError(
    400,
    `One or more grants are not in the MCP access catalog: ${invalid.map((grant) => grant.resourceId).join(', ')}`,
  );
};

export const isAdminRoleName = (roleName: string): boolean =>
  roleName.trim().toUpperCase() === ADMIN_BYPASS_ROLE;

export const buildAllowedPublicMcpServers = (
  access: EffectiveMcpAccess,
  settingsMcpServers: readonly AiMcpServerConfig[],
): AiMcpServerPublicConfig[] => {
  const allowed = new Set(access.mcpServerIds);
  return filterEnabledPublicMcpServers(listEffectivePublicMcpServers(settingsMcpServers))
    .filter((server) => allowed.has(server.id));
};

export const buildMcpAccessMeResponse = (
  access: EffectiveMcpAccess,
  settingsMcpServers: readonly AiMcpServerConfig[],
): McpAccessMeResponse => ({
  success: true,
  adminBypass: access.adminBypass,
  packs: buildAllowedUiPacks(access),
  mcpServers: buildAllowedPublicMcpServers(access, settingsMcpServers),
  defaultScope: resolveDefaultAgentCapabilityScope(access),
});

export const intersectAgentRunCapabilityScope = (
  requested: {
    enabledCapabilityPackIds?: readonly AiCapabilityPackId[];
    enabledMcpServerIds?: readonly string[];
  },
  sessionScope: AiAgentCapabilityScope | undefined,
  access: EffectiveMcpAccess,
): AiAgentCapabilityScope => {
  const baseScope = requested.enabledCapabilityPackIds !== undefined
    || requested.enabledMcpServerIds !== undefined
    ? {
      packIds: requested.enabledCapabilityPackIds
        ? [...requested.enabledCapabilityPackIds]
        : [],
      mcpServerIds: requested.enabledMcpServerIds
        ? [...requested.enabledMcpServerIds]
        : [],
    }
    : sessionScope ?? resolveDefaultAgentCapabilityScope(access);

  if (
    requested.enabledCapabilityPackIds === undefined
    && baseScope.packIds.length === 0
    && requested.enabledMcpServerIds === undefined
  ) {
    return clampAgentCapabilityScope(
      {
        packIds: [...DEFAULT_AGENT_CAPABILITY_SCOPE.packIds],
        mcpServerIds: baseScope.mcpServerIds,
      },
      access,
    );
  }

  return clampAgentCapabilityScope(baseScope, access);
};

export const assertAgentRunWithinMcpAccess = (
  scope: AiAgentCapabilityScope,
  requested: {
    enabledCapabilityPackIds?: readonly AiCapabilityPackId[];
    enabledMcpServerIds?: readonly string[];
  },
  access: EffectiveMcpAccess,
  context: { userId: number; sessionId?: number },
): void => {
  const allowedPackIds = new Set(access.packIds);
  const allowedMcpServerIds = new Set(access.mcpServerIds);

  const requestedPackIds = requested.enabledCapabilityPackIds ?? scope.packIds;
  const requestedMcpServerIds = requested.enabledMcpServerIds ?? scope.mcpServerIds;

  const deniedPackIds = requestedPackIds.filter((packId) => !allowedPackIds.has(packId));
  const deniedMcpServerIds = requestedMcpServerIds.filter((serverId) => !allowedMcpServerIds.has(serverId));

  if (deniedPackIds.length === 0 && deniedMcpServerIds.length === 0) {
    return;
  }

  logMcpAccessAudit('agent_run_denied', {
    userId: context.userId,
    sessionId: context.sessionId,
    deniedPackIds,
    deniedMcpServerIds,
    adminBypass: access.adminBypass,
  });

  throw new HttpError(403, 'One or more agent capabilities are not allowed for your role.');
};

export const buildMcpAccessContextSnapshot = (
  scope: AiAgentCapabilityScope,
): McpAccessContextSnapshot => ({
  packLabels: scope.packIds.map((packId) => AI_CAPABILITY_PACK_BY_ID[packId]?.label ?? packId),
  mcpServerLabels: [...scope.mcpServerIds],
});

export const clampSessionAgentCapabilityScope = async (
  userId: number,
  scope: AiAgentCapabilityScope,
  options?: {
    fallbackRole?: string;
    settingsMcpServers?: readonly AiMcpServerConfig[];
    mcpSettings?: AiMcpSettings;
    userEmail?: string | null;
  },
): Promise<AiAgentCapabilityScope> => {
  const access = await resolveEffectiveMcpAccessForUser(userId, options);
  return clampAgentCapabilityScope(scope, access);
};

export class McpAccessService {
  async getMe(userId: number, fallbackRole?: string) {
    const settings = aiManager.getSettings();
    const access = await resolveEffectiveMcpAccessForUser(userId, {
      fallbackRole,
      settingsMcpServers: settings?.mcpServers ?? [],
      mcpSettings: settings?.mcp ?? DEFAULT_AI_MCP_SETTINGS,
    });
    return {
      body: buildMcpAccessMeResponse(access, settings?.mcpServers ?? []),
    };
  }

  async getPublicMcpServerLabel(serverId: string, settingsMcpServers: readonly AiMcpServerConfig[]): Promise<string> {
    const fromSettings = settingsMcpServers.find((server) => server.id === serverId);
    if (fromSettings) {
      return redactAiMcpServerConfig(fromSettings).label;
    }
    const pluginServer = listInstalledPluginMcpServers().find((server) => server.id === serverId);
    return pluginServer?.label ?? serverId;
  }

  async buildMcpAccessContextSnapshotForScope(
    scope: AiAgentCapabilityScope,
    settingsMcpServers: readonly AiMcpServerConfig[],
  ): Promise<McpAccessContextSnapshot> {
    const packLabels = scope.packIds.map((packId) => AI_CAPABILITY_PACK_BY_ID[packId]?.label ?? packId);
    const mcpServerLabels = await Promise.all(
      scope.mcpServerIds.map((serverId) => this.getPublicMcpServerLabel(serverId, settingsMcpServers)),
    );
    return { packLabels, mcpServerLabels };
  }

  async getCatalog() {
    const settings = aiManager.getSettings();
    return {
      body: buildMcpAccessCatalog(settings?.mcpServers ?? []),
    };
  }

  async getRoleGrants(roleName: string) {
    const normalizedRoleName = roleName.trim();
    if (!normalizedRoleName) {
      throw new HttpError(400, 'Role name is required.');
    }

    const role = await findRoleIdByName(normalizedRoleName);
    if (!role) {
      throw new HttpError(404, 'Role not found.');
    }

    const rows = await listRoleMcpGrantRows([normalizedRoleName]);
    const body: RoleMcpGrantsResponse = {
      success: true,
      roleName: normalizedRoleName,
      adminBypass: isAdminRoleName(normalizedRoleName),
      grants: rows.map((row) => ({
        resourceKind: row.resource_kind,
        resourceId: row.resource_id,
      })),
    };
    return { body };
  }

  async replaceRoleGrants(
    roleName: string,
    payload: ReplaceRoleMcpGrantsPayload,
    actorId: number | null,
  ) {
    const normalizedRoleName = roleName.trim();
    if (!normalizedRoleName) {
      throw new HttpError(400, 'Role name is required.');
    }

    if (isAdminRoleName(normalizedRoleName)) {
      throw new HttpError(400, 'ADMIN role uses full MCP bypass; grants cannot be edited.');
    }

    const role = await findRoleIdByName(normalizedRoleName);
    if (!role) {
      throw new HttpError(404, 'Role not found.');
    }

    const settings = aiManager.getSettings();
    const grants = normalizeRoleMcpGrantInputs(payload.grants);
    assertRoleMcpGrantsInCatalog(grants, settings?.mcpServers ?? []);
    await replaceRoleMcpGrants(normalizedRoleName, grants, actorId);

    return {
      body: {
        success: true as const,
        roleName: normalizedRoleName,
        grantCount: grants.length,
      },
    };
  }
}

export const mcpAccessService = new McpAccessService();
