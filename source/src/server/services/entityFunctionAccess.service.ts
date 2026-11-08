import {
  isBuiltinAdminUsername,
  isFunctionAccessBypassRole,
  rolesHaveFunctionAccessBypass,
} from '../../shared/lib/server-functions/functionAccessBypass';
import {
  applyEntityAccessDecision,
  buildRoleAccessEntityKey,
  buildUserAccessEntityKeys,
  resolveEntityFunctionAccessDecision,
  resolvePrimaryUserAccessEntityKey,
  type EntityFunctionAccessDecision,
  type EntityFunctionAccessEntry,
  type EntityFunctionAccessResponse,
  type FunctionAccessEntityKind,
  type ReplaceEntityFunctionAccessPayload,
} from '../../shared/api/contracts/server-functions/entityAccess';
import {
  normalizeFunctionAccessControl,
  type FunctionAccessControl,
} from '../../shared/api/contracts/server-functions/accessControl';
import { isPackageServerFunction } from '../../shared/api/contracts/server-functions/packageFunctions';
import type { ServerFunctionItem } from '../../shared/api/contracts/server-functions/types';
import { writeBuiltinFunctionMetadata } from '../../core/functions/BuiltinFunctionMetadataStore';
import { HttpError } from '../errors/HttpError';
import {
  findManagedFunctionById,
  updateManagedFunction,
} from '../domain/functions/functionRepository';
import { findRoleIdByName } from '../domain/users/roleRepository';
import { findUserIdEmailUsername } from '../domain/users/userRepository';
import { getUserRolesForRequest } from '../domain/users/userRoleRepository';
import { builtinFunctionRegistry } from './builtinFunctionRegistry.service';
import { refreshOpenApiDocumentationCaches } from './openApiDocRefresh';
import {
  buildMergedServerFunctionsCatalog,
  type ServerFunctionsCatalogDeps,
} from './serverFunctionsCatalog.service';

export type EntityFunctionAccessServiceDeps = ServerFunctionsCatalogDeps;

type CatalogEntry = {
  id: string;
  name: string;
  method: string;
  path: string;
  folder: string;
  accessControl: FunctionAccessControl;
  source: 'builtin' | 'custom' | 'package';
};

const toCatalogEntry = (fn: ServerFunctionItem): CatalogEntry => ({
  id: fn.id,
  name: fn.name,
  method: fn.method,
  path: fn.path,
  folder: fn.folder,
  accessControl: normalizeFunctionAccessControl(fn.accessControl),
  source: isPackageServerFunction(fn) ? 'package' : (fn.isBuiltIn ? 'builtin' : 'custom'),
});

const loadEditableCatalog = async (
  deps: EntityFunctionAccessServiceDeps,
): Promise<CatalogEntry[]> => {
  const mergedCatalog = await buildMergedServerFunctionsCatalog(deps);

  return mergedCatalog
    .map(toCatalogEntry)
    .sort((left, right) => {
      const folderCompare = left.folder.localeCompare(right.folder, undefined, { sensitivity: 'base' });
      if (folderCompare !== 0) {
        return folderCompare;
      }
      const nameCompare = left.name.localeCompare(right.name, undefined, { sensitivity: 'base' });
      if (nameCompare !== 0) {
        return nameCompare;
      }
      return left.id.localeCompare(right.id);
    });
};

const buildEntries = (
  catalog: CatalogEntry[],
  kind: FunctionAccessEntityKind,
  entityKeys: string[],
): EntityFunctionAccessEntry[] => (
  catalog.map((entry) => ({
    id: entry.id,
    name: entry.name,
    method: entry.method,
    path: entry.path,
    folder: entry.folder,
    accessMode: entry.accessControl.accessMode ?? 'authenticated',
    decision: resolveEntityFunctionAccessDecision(entry.accessControl, kind, entityKeys),
    editable: entry.source !== 'package',
  }))
);

const normalizeDecisionPayload = (
  value: unknown,
): Record<string, EntityFunctionAccessDecision> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const decisions: Record<string, EntityFunctionAccessDecision> = {};
  for (const [functionId, decision] of Object.entries(value)) {
    if (typeof functionId !== 'string' || !functionId.trim()) {
      continue;
    }
    if (decision === 'allow' || decision === 'deny' || decision === 'none') {
      decisions[functionId] = decision;
    }
  }
  return decisions;
};

const persistAccessControl = async (
  entry: CatalogEntry,
  accessControl: FunctionAccessControl,
  actorEmail: string | null,
): Promise<void> => {
  if (entry.source === 'package') {
    throw new HttpError(400, `Package API functions cannot be edited from user/role access: ${entry.id}`);
  }

  if (entry.source === 'builtin') {
    writeBuiltinFunctionMetadata(
      entry.id,
      entry.method,
      entry.path,
      { accessControl: normalizeFunctionAccessControl(accessControl) },
      actorEmail,
    );
    return;
  }

  const existing = await findManagedFunctionById(entry.id);
  if (!existing) {
    throw new HttpError(404, `Function not found: ${entry.id}`);
  }

  await updateManagedFunction([
    existing.name,
    existing.folder,
    existing.method,
    existing.path,
    existing.code,
    existing.language,
    existing.test_payload,
    existing.runtime_version,
    existing.memory_limit,
    existing.timeout_ms,
    existing.cache_enabled,
    existing.cache_ttl_ms,
    existing.cache_by_param,
    existing.cache_by_user,
    existing.engine_type,
    existing.metadata_json,
    normalizeFunctionAccessControl(accessControl),
    entry.id,
    existing.use_global_config !== false,
    existing.enable_logs !== false,
    actorEmail,
  ]);
};

const resolveUserEntity = async (userId: number) => {
  const user = await findUserIdEmailUsername(userId);
  if (!user) {
    throw new HttpError(404, 'User not found.');
  }

  const roles = await getUserRolesForRequest(userId);
  const entityKeys = buildUserAccessEntityKeys(userId, user.email);
  const entityKey = resolvePrimaryUserAccessEntityKey(userId, user.email);
  const entityLabel = user.username?.trim() || user.email?.trim() || `User #${userId}`;
  const adminBypass =
    rolesHaveFunctionAccessBypass(roles) || isBuiltinAdminUsername(user.username);

  return { entityKeys, entityKey, entityLabel, adminBypass };
};

const resolveRoleEntity = async (roleName: string) => {
  const normalizedRoleName = buildRoleAccessEntityKey(roleName);
  if (!normalizedRoleName) {
    throw new HttpError(400, 'Role name is required.');
  }

  const roleId = await findRoleIdByName(normalizedRoleName);
  if (!roleId) {
    throw new HttpError(404, 'Role not found.');
  }

  return {
    entityKeys: [normalizedRoleName],
    entityKey: normalizedRoleName,
    entityLabel: normalizedRoleName,
    adminBypass: isFunctionAccessBypassRole(normalizedRoleName),
  };
};

export async function getEntityFunctionAccess(
  deps: EntityFunctionAccessServiceDeps,
  entityKind: FunctionAccessEntityKind,
  rawEntityKey: string,
): Promise<EntityFunctionAccessResponse> {
  const catalog = await loadEditableCatalog(deps);

  if (entityKind === 'user') {
    const userId = Number(rawEntityKey);
    if (!Number.isFinite(userId)) {
      throw new HttpError(400, 'Invalid user id.');
    }

    const entity = await resolveUserEntity(userId);
    return {
      success: true,
      entityKind,
      entityKey: entity.entityKey,
      entityLabel: entity.entityLabel,
      adminBypass: entity.adminBypass,
      entries: buildEntries(catalog, entityKind, entity.entityKeys),
    };
  }

  const entity = await resolveRoleEntity(rawEntityKey);
  return {
    success: true,
    entityKind,
    entityKey: entity.entityKey,
    entityLabel: entity.entityLabel,
    adminBypass: entity.adminBypass,
    entries: buildEntries(catalog, entityKind, entity.entityKeys),
  };
}

export async function replaceEntityFunctionAccess(
  deps: EntityFunctionAccessServiceDeps,
  entityKind: FunctionAccessEntityKind,
  rawEntityKey: string,
  payload: ReplaceEntityFunctionAccessPayload,
  actorEmail: string | null,
): Promise<{ body: { success: true } }> {
  const decisionMap = normalizeDecisionPayload(payload.decisions);

  const catalog = await loadEditableCatalog(deps);
  const catalogById = new Map(catalog.map((entry) => [entry.id, entry]));

  let entityKeys: string[];
  let primaryEntityKey: string;
  let adminBypass = false;

  if (entityKind === 'user') {
    const userId = Number(rawEntityKey);
    if (!Number.isFinite(userId)) {
      throw new HttpError(400, 'Invalid user id.');
    }
    const entity = await resolveUserEntity(userId);
    entityKeys = entity.entityKeys;
    primaryEntityKey = entity.entityKey;
    adminBypass = entity.adminBypass;
  } else {
    const entity = await resolveRoleEntity(rawEntityKey);
    entityKeys = entity.entityKeys;
    primaryEntityKey = entity.entityKey;
    adminBypass = entity.adminBypass;
  }

  if (adminBypass) {
    throw new HttpError(
      400,
      'Built-in admin, ADMIN, and DEVELOPER principals bypass server function access checks and cannot be edited.',
    );
  }

  const touchedIds = new Set<string>([
    ...Object.keys(decisionMap),
    ...catalog
      .filter((entry) => resolveEntityFunctionAccessDecision(
        entry.accessControl,
        entityKind,
        entityKeys,
      ) !== 'none')
      .map((entry) => entry.id),
  ]);

  for (const functionId of touchedIds) {
    const entry = catalogById.get(functionId);
    if (!entry) {
      throw new HttpError(404, `Function not found: ${functionId}`);
    }
    if (entry.source === 'package') {
      continue;
    }

    const desiredDecision = decisionMap[functionId] ?? 'none';
    const currentDecision = resolveEntityFunctionAccessDecision(
      entry.accessControl,
      entityKind,
      entityKeys,
    );
    if (desiredDecision === currentDecision) {
      continue;
    }

    const nextAccessControl = applyEntityAccessDecision(
      entry.accessControl,
      entityKind,
      entityKeys,
      primaryEntityKey,
      desiredDecision,
    );

    if (JSON.stringify(nextAccessControl) === JSON.stringify(entry.accessControl)) {
      continue;
    }

    await persistAccessControl(entry, nextAccessControl, actorEmail);
  }

  await builtinFunctionRegistry.reload();
  refreshOpenApiDocumentationCaches(undefined, { includeBuiltinRegistry: true });

  return { body: { success: true as const } };
};
