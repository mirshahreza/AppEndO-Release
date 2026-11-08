import type { Request, Response } from 'express';
import { cacheManager } from '../../../core/cache/CacheManager';
import { buildEdgeResponseCacheKey } from '../../../shared/lib/cacheKeyFormat';
import type { EdgeApiDefinition } from '../../../shared/api/contracts/data-api';
import type { ManagedFunctionExecutionRecord } from '../server-function.service';
import {
  resolveServerFunctionRuntimeConfig,
  runtimeConfigInputFromManagedRecord,
} from '../resolveServerFunctionRuntimeConfig';
import { fireServerFunctionHook } from '../workflow/workflowHookFiring';
import {
  readDataApiListCacheDefaultEnabled,
  readDataApiListCacheDefaultTtlMs,
} from './dataApiListPlatformSettings';
import { listEdgeApiDefinitions } from './edgeApiStore';
import { listEdgeModels } from './edgeModelStore';
import { getRecordPolicyBindingOrDefault } from '../record-policy/recordPolicyBindingStore';
import { listEnabledRecordPoliciesForModel } from '../record-policy/recordPolicyStore';
import { resolveSessionScope } from '../record-policy/sessionScope.service';
import { getSessionContextForUser } from '../attributes/sessionContext.service';
import { hasAdminRole, normalizeAuthRoles } from '../../middleware/auth.middleware';
import {
  omitDataApiNoCacheFromQuery,
  readDataApiNoCacheFromRequest,
} from '../../../shared/lib/dataApiNoCache';
import {
  HWY_MEMBER_DIRECTORY_DATA_API_TIMEOUT_MS,
  isHwyMemberDirectoryListFunctionId,
  isHwyMemberDirectoryManagedFunctionId,
} from '../../domain/hwy/ensureHwyMemberDirectoryListRuntime';

type CachedDataApiResponse = {
  statusCode: number;
  body: unknown;
};

const normalizeTtlSeconds = (ttlMs: unknown): number => {
  const raw = Number(ttlMs);
  if (!Number.isFinite(raw) || raw <= 0) {
    return 180;
  }
  return Math.max(1, Math.floor(raw / 1000));
};

const resolveActorId = (req: Request): string => {
  if (req.auth?.userId != null && Number.isFinite(req.auth.userId)) {
    return String(req.auth.userId);
  }
  if (req.auth?.email?.trim()) {
    return req.auth.email.trim();
  }
  return 'anonymous';
};

export type DataApiRuntimeContext = {
  definition: EdgeApiDefinition;
  record: ManagedFunctionExecutionRecord;
  timeoutMs: number;
  cacheEnabled: boolean;
  cacheKey?: string;
  cacheTtlSeconds?: number;
};

/**
 * Drop every cached GET response for a Data API definition (all byParam / byUser variants).
 * Must run after successful writes — list GETs share `data-api:<definitionId>` and otherwise
 * keep serving pre-delete rows until TTL expires.
 */
export const invalidateDataApiDefinitionCache = async (definitionId: string): Promise<void> => {
  const trimmed = String(definitionId || '').trim();
  if (!trimmed) {
    return;
  }

  const prefix = buildEdgeResponseCacheKey({
    keyNamespace: `data-api:${trimmed}`,
  });
  await cacheManager.invalidateByPrefix(prefix);
};

/**
 * After schema-level mutations (truncate / bulk wipe) that bypass Data API write ops,
 * clear GET caches for every published API bound to the matching edge model(s).
 */
export const invalidateDataApiCachesForSchemaObject = async (input: {
  dataSourceId: string;
  objectName: string;
}): Promise<void> => {
  const dataSourceId = String(input.dataSourceId || '').trim();
  const objectName = String(input.objectName || '').trim();
  if (!dataSourceId || !objectName) {
    return;
  }

  const modelIds = new Set(
    listEdgeModels()
      .filter((model) => model.dataSourceId === dataSourceId && model.objectName === objectName)
      .map((model) => model.id),
  );
  if (modelIds.size === 0) {
    return;
  }

  const definitionIds = listEdgeApiDefinitions()
    .filter((definition) => modelIds.has(definition.edgeModelId))
    .map((definition) => definition.id);

  await Promise.all(definitionIds.map((definitionId) => invalidateDataApiDefinitionCache(definitionId)));
};

export const prepareDataApiRuntime = async (
  req: Request,
  res: Response,
  definition: EdgeApiDefinition,
  record: ManagedFunctionExecutionRecord,
): Promise<DataApiRuntimeContext | null> => {
  const runtimeBase = resolveServerFunctionRuntimeConfig(
    runtimeConfigInputFromManagedRecord(record as unknown as Record<string, unknown>),
  );
  const functionId = String(record.id ?? '');
  const runtime = isHwyMemberDirectoryManagedFunctionId(functionId)
    ? { ...runtimeBase, timeoutMs: HWY_MEMBER_DIRECTORY_DATA_API_TIMEOUT_MS }
    : runtimeBase;
  const isGet = String(req.method || '').toUpperCase() === 'GET';
  const listCacheDefault = isGet && readDataApiListCacheDefaultEnabled();
  let effectiveCache = runtime.cache.enabled || !listCacheDefault
    ? runtime.cache
    : {
      enabled: true,
      ttlMs: readDataApiListCacheDefaultTtlMs(),
      byParam: true,
      byUser: runtime.cache.byUser,
    };
  if (isHwyMemberDirectoryListFunctionId(String(record.id ?? ''))) {
    effectiveCache = { ...effectiveCache, byUser: true };
  }

  const hooks = definition.runtime.hooks ?? record.hooks;
  if (hooks?.before) {
    fireServerFunctionHook(hooks.before, req.body as Record<string, unknown> | undefined);
  }

  const bypassResponseCache = isGet && readDataApiNoCacheFromRequest(req);
  const cacheEligible = Boolean(effectiveCache.enabled && isGet);

  const timeoutHandle = setTimeout(() => {
    if (!res.headersSent) {
      res.status(504).json({
        success: false,
        error: 'Data API execution timed out.',
      });
    }
  }, runtime.timeoutMs);

  const clearTimeoutHandle = () => clearTimeout(timeoutHandle);
  res.on('finish', clearTimeoutHandle);
  res.on('close', clearTimeoutHandle);

  if (!cacheEligible) {
    return {
      definition,
      record,
      timeoutMs: runtime.timeoutMs,
      cacheEnabled: false,
    };
  }

  const binding = getRecordPolicyBindingOrDefault(definition.edgeModelId);
  const hasPolicies = listEnabledRecordPoliciesForModel(definition.edgeModelId).length > 0;
  const getOperation = (definition.operations ?? []).find((operation) => (
    operation.enabled && String(operation.method).toUpperCase() === 'GET'
  ));
  const bypassed = Boolean(getOperation?.bypassRecordPolicy);
  const policyOverrideId = getOperation?.recordPolicyId?.trim();
  const policyCache = binding.recordScope === 'on'
    && !bypassed
    && (hasPolicies || Boolean(policyOverrideId));

  let scopeHash: string | undefined;
  if (policyCache && req.auth?.userId != null && Number.isFinite(req.auth.userId)) {
    const roles = normalizeAuthRoles(req);
    const sessionContext = await getSessionContextForUser(Number(req.auth.userId), roles[0]);
    const session = await resolveSessionScope({
      userId: Number(req.auth.userId),
      roles: roles.length > 0 ? roles : ['USER'],
      isAdmin: hasAdminRole(req),
      email: req.auth.email ?? null,
      serverContext: sessionContext.serverContext as Record<string, unknown>,
    });
    scopeHash = session.scopeHash;
  }

  const queryForCacheKey = omitDataApiNoCacheFromQuery(
    req.query as Record<string, unknown> | undefined,
  );

  const cacheKey = buildEdgeResponseCacheKey({
    keyNamespace: `data-api:${definition.id}`,
    byParam: Boolean(effectiveCache.byParam) || Boolean(scopeHash),
    byUser: policyCache ? true : effectiveCache.byUser,
    actorId: resolveActorId(req),
    requestParams: req.params,
    requestQuery: queryForCacheKey,
  });

  const cached = await cacheManager.get<CachedDataApiResponse>(cacheKey);
  if (cached && !bypassResponseCache) {
    clearTimeoutHandle();
    res.status(cached.statusCode).json(cached.body);
    return null;
  }

  return {
    definition,
    record,
    timeoutMs: runtime.timeoutMs,
    cacheEnabled: true,
    cacheKey,
    cacheTtlSeconds: normalizeTtlSeconds(effectiveCache.ttlMs),
  };
};

export const finalizeDataApiRuntime = async (
  req: Request,
  res: Response,
  context: DataApiRuntimeContext,
  body: Record<string, unknown>,
): Promise<void> => {
  const hooks = context.definition.runtime.hooks ?? context.record.hooks;
  if (hooks?.after) {
    fireServerFunctionHook(hooks.after, body);
  }

  const statusCode = res.statusCode || 200;
  const method = String(req.method || '').toUpperCase();
  const ok = statusCode >= 200 && statusCode < 300;

  if (
    context.cacheEnabled
    && context.cacheKey
    && context.cacheTtlSeconds
    && ok
  ) {
    await cacheManager.set(context.cacheKey, {
      statusCode,
      body,
    } satisfies CachedDataApiResponse, context.cacheTtlSeconds);
  }

  // Writes must clear list/detail GET cache even when this operation itself is uncached.
  if (ok && method !== 'GET' && method !== 'HEAD') {
    await invalidateDataApiDefinitionCache(context.definition.id);
  }
};
