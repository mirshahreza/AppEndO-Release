import type { NextFunction, Request, Response } from 'express';
import { tryAttachAuth } from './auth.middleware';
import {
  createRequestPerfStore,
  requestPerfAls,
  type RequestPerfStore,
} from '../domain/perf/requestPerfAls';

const PROFILE_HEADER = 'x-appendo-page-profile';
const PERF_RESPONSE_HEADER = 'x-appendo-server-perf';

const canExposePageProfile = (req: Request): boolean => {
  if (!req.auth?.userId) {
    tryAttachAuth(req);
  }
  if (!req.auth?.userId) {
    return false;
  }
  const roles = req.auth.roles?.length
    ? req.auth.roles
    : (req.auth.role ? [req.auth.role] : []);
  const normalized = roles.map((role) => role.toUpperCase());
  return normalized.includes('ADMIN') || normalized.includes('DEVELOPER');
};

const buildPerfPayload = (store: RequestPerfStore, totalMs: number): string => {
  const totalMsRounded = Math.round(totalMs);
  const dbTotalMs = Math.round(store.dbMs);
  const applicationMs = Math.max(0, totalMsRounded - dbTotalMs);
  const payload = {
    totalMs: totalMsRounded,
    sections: {
      database: {
        totalMs: dbTotalMs,
        queryCount: store.queryCount,
        queries: store.queries,
      },
      application: {
        totalMs: applicationMs,
      },
    },
    dbMs: dbTotalMs,
    dbQueries: store.queryCount,
    queries: store.queries,
  };
  return encodeURIComponent(JSON.stringify(payload));
};

const attachPerfHeader = (
  req: Request,
  res: Response,
  store: RequestPerfStore,
  startedAt: bigint,
  attachedRef: { value: boolean },
): void => {
  if (attachedRef.value || res.headersSent || !canExposePageProfile(req)) {
    return;
  }
  attachedRef.value = true;
  const totalMs = Number((process.hrtime.bigint() - startedAt) / BigInt(1_000_000));
  try {
    res.setHeader(PERF_RESPONSE_HEADER, buildPerfPayload(store, totalMs));
  } catch {
    // Ignore header failures.
  }
};

export const pageProfileRequestMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const wantsProfile = String(req.headers[PROFILE_HEADER] ?? '').trim() === '1';
  if (!wantsProfile) {
    next();
    return;
  }

  const store = createRequestPerfStore();
  requestPerfAls.run(store, () => {
    const startedAt = process.hrtime.bigint();
    const attachedRef = { value: false };

    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);
    const originalEnd = res.end.bind(res);

    res.json = ((body: unknown) => {
      attachPerfHeader(req, res, store, startedAt, attachedRef);
      return originalJson(body);
    }) as Response['json'];

    res.send = ((body: unknown) => {
      attachPerfHeader(req, res, store, startedAt, attachedRef);
      return originalSend(body);
    }) as Response['send'];

    res.end = (...args: Parameters<Response['end']>) => {
      attachPerfHeader(req, res, store, startedAt, attachedRef);
      return originalEnd(...args);
    };

    next();
  });
};
