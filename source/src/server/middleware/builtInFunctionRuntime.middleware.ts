import type { NextFunction, Request, Response } from 'express';
import { cacheManager } from '../../core/cache/CacheManager';
import { buildEdgeResponseCacheKey } from '../../shared/lib/cacheKeyFormat';
import { HWY_MEMBER_DIRECTORY_LIST_BUILTIN_CACHE_GENERATION } from '../domain/hwy/ensureHwyMemberDirectoryListRuntime';
import type { MergedBuiltinFunctionRecord } from '../services/builtinFunctionRegistry.service';
import {
  resolveServerFunctionRuntimeConfig,
  runtimeConfigInputFromBuiltinRecord,
} from '../services/resolveServerFunctionRuntimeConfig';

type CachedBuiltinResponse = {
  statusCode: number;
  body: unknown;
  contentType: 'json' | 'send';
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

const sendCachedResponse = (res: Response, cached: CachedBuiltinResponse): void => {
  if (cached.contentType === 'send') {
    res.status(cached.statusCode).send(cached.body);
    return;
  }
  res.status(cached.statusCode).json(cached.body);
};

const installResponseCapture = (
  req: Request,
  res: Response,
  options: {
    cacheKey: string;
    cacheTtlSeconds: number;
    onResponseStart?: () => void;
  },
): void => {
  const originalJson = res.json.bind(res);
  const originalSend = typeof res.send === 'function' ? res.send.bind(res) : null;
  let captured = false;

  const persistResponse = async (statusCode: number, body: unknown, contentType: 'json' | 'send') => {
    if (captured || statusCode < 200 || statusCode >= 300) {
      return;
    }
    captured = true;
    await cacheManager.set(options.cacheKey, {
      statusCode,
      body,
      contentType,
    } satisfies CachedBuiltinResponse, options.cacheTtlSeconds);
  };

  const notifyResponseStart = () => {
    options.onResponseStart?.();
  };

  res.json = ((body: unknown) => {
    notifyResponseStart();
    void persistResponse(res.statusCode || 200, body, 'json');
    return originalJson(body);
  }) as Response['json'];

  res.send = ((body: unknown) => {
    notifyResponseStart();
    void persistResponse(res.statusCode || 200, body, 'send');
    return originalSend ? originalSend(body) : body;
  }) as Response['send'];

  res.on('finish', () => {
    res.json = originalJson;
    if (originalSend) {
      res.send = originalSend;
    }
  });
};

export const applyBuiltInRuntimePolicy = async (
  req: Request,
  res: Response,
  record: MergedBuiltinFunctionRecord,
): Promise<boolean> => {
  const runtime = resolveServerFunctionRuntimeConfig(
    runtimeConfigInputFromBuiltinRecord(record as unknown as Record<string, unknown>),
  );

  const shouldUseCache = Boolean(
    runtime.cache.enabled
    && String(req.method || '').toUpperCase() === 'GET',
  );

  // Catalogued Express controllers only use response caching here — not VM sandbox timeouts.
  if (!shouldUseCache) {
    return true;
  }

  const listFaceCaptionCacheSuffix = record.path === '/api/hwy/member-directory'
    ? `:${HWY_MEMBER_DIRECTORY_LIST_BUILTIN_CACHE_GENERATION}`
    : '';
  const cacheKey = buildEdgeResponseCacheKey({
    keyNamespace: `${record.method}:${record.path}${listFaceCaptionCacheSuffix}`,
    byParam: runtime.cache.byParam,
    byUser: runtime.cache.byUser,
    actorId: resolveActorId(req),
    requestParams: req.params,
    requestQuery: req.query,
  });

  const cached = await cacheManager.get<CachedBuiltinResponse>(cacheKey);
  if (cached) {
    sendCachedResponse(res, cached);
    return false;
  }

  installResponseCapture(req, res, {
    cacheKey,
    cacheTtlSeconds: normalizeTtlSeconds(runtime.cache.ttlMs),
  });

  return true;
};

export const createBuiltInRuntimePolicyMiddleware = () => (
  async (req: Request, res: Response, next: NextFunction) => {
    const record = (req as Request & { builtinFunctionRecord?: MergedBuiltinFunctionRecord }).builtinFunctionRecord;
    if (!record) {
      next();
      return;
    }

    try {
      const shouldContinue = await applyBuiltInRuntimePolicy(req, res, record);
      if (!shouldContinue) {
        return;
      }
      next();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Built-in runtime policy failed.';
      res.status(500).json({ success: false, error: message });
    }
  }
);
