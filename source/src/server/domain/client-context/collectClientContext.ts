import type { Request } from 'express';
import {
  CLIENT_CONTEXT_BODY_KEY,
  CLIENT_CONTEXT_ENVELOPE_MAX_BYTES,
  CLIENT_CLOCK_SKEW_WARN_MINUTES,
  APPENDO_CLIENT_HEADER,
  type ClientContextFieldSelection,
  type ClientContextMode,
  isKnownClientContextFieldId,
} from '../../../shared/api/contracts/client-context';
import { HttpError } from '../../errors/HttpError';
import { getRecordEventRequestScope } from './requestAls';

export type CollectedClientContext = {
  observed: Record<string, unknown>;
  claimed: Record<string, unknown>;
  clientChannel: string | null;
  clientIp: string | null;
  clientTimeZone: string | null;
  clientInstallId: string | null;
  clockSkewMinutes: number | null;
  requestId: string | null;
};

const lower = (name: string): string => name.toLowerCase();

const readHeader = (req: Pick<Request, 'headers'> | undefined, name: string): string | undefined => {
  if (!req) return undefined;
  const value = req.headers[lower(name)] ?? req.headers[name];
  if (Array.isArray(value)) return value[0];
  return typeof value === 'string' ? value : undefined;
};

const byteLength = (value: string): number => Buffer.byteLength(value, 'utf8');

const parseEnvelopeJson = (raw: string): Record<string, unknown> => {
  if (byteLength(raw) > CLIENT_CONTEXT_ENVELOPE_MAX_BYTES) {
    throw new HttpError(400, 'Client context envelope exceeds 4KB.');
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new HttpError(400, 'Client context envelope must be a JSON object.');
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, 'Client context envelope is not valid JSON.');
  }
};

export const stripReservedClientKeys = (body: unknown): unknown => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return body;
  }
  const next = { ...(body as Record<string, unknown>) };
  delete next[CLIENT_CONTEXT_BODY_KEY];
  delete next.__changeReasonCode;
  delete next.__changeReasonText;
  delete next.__revertedFromSeq;
  delete next.__revertedFromEventId;
  return next;
};

const readEnvelope = (req: Pick<Request, 'headers' | 'body'> | undefined): Record<string, unknown> => {
  if (!req) return {};
  const headerRaw = readHeader(req, APPENDO_CLIENT_HEADER);
  if (headerRaw?.trim()) {
    return parseEnvelopeJson(headerRaw);
  }
  const body = req.body;
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    const nested = (body as Record<string, unknown>)[CLIENT_CONTEXT_BODY_KEY];
    if (typeof nested === 'string' && nested.trim()) {
      return parseEnvelopeJson(nested);
    }
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      if (byteLength(JSON.stringify(nested)) > CLIENT_CONTEXT_ENVELOPE_MAX_BYTES) {
        throw new HttpError(400, 'Client context envelope exceeds 4KB.');
      }
      return nested as Record<string, unknown>;
    }
  }
  return {};
};

const modeOf = (fields: ClientContextFieldSelection[] | undefined, id: string): ClientContextMode => (
  fields?.find((field) => field.id === id)?.mode ?? 'off'
);

const includeInJson = (fields: ClientContextFieldSelection[] | undefined, id: string): boolean => {
  if (!fields || fields.length === 0) {
    return false;
  }
  const mode = modeOf(fields, id);
  return mode === 'record' || mode === 'require';
};

export type CollectClientContextInput = {
  req?: Pick<Request, 'headers' | 'body' | 'ip' | 'httpVersion'> & { requestId?: string };
  occurredAt: Date;
  fields?: ClientContextFieldSelection[];
  isWrite: boolean;
  inProcess?: boolean;
};

export const collectClientContext = (input: CollectClientContextInput): CollectedClientContext => {
  const scope = getRecordEventRequestScope();
  const req = input.req ?? scope?.req;
  const inProcess = Boolean(input.inProcess || (!req && scope?.source === 'workflow') || (!req && !scope));
  const skipRequire = inProcess;
  const fields = input.fields;
  const envelope = req ? readEnvelope(req) : {};
  const claimedRoot = envelope.claimed && typeof envelope.claimed === 'object' && !Array.isArray(envelope.claimed)
    ? envelope.claimed as Record<string, unknown>
    : envelope;

  const claimed: Record<string, unknown> = {};
  for (const field of fields ?? []) {
    if (field.mode === 'off' || !isKnownClientContextFieldId(field.id, 'claimed') || field.id === 'ip') {
      continue;
    }
    const value = claimedRoot[field.id];
    const missing = value === undefined || value === null || value === '';
    if (missing) {
      if (field.mode === 'require' && input.isWrite && !skipRequire) {
        throw new HttpError(400, `Client context field "${field.id}" is required.`);
      }
      continue;
    }
    claimed[field.id] = value;
  }
  delete claimed.ip;

  const observed: Record<string, unknown> = {};
  const putObserved = (id: string, value: unknown) => {
    if (value === undefined || value === null || value === '') return;
    if (includeInJson(fields, id) || id === 'clockSkewMinutes' || (inProcess && id === 'channel')) {
      observed[id] = value;
    }
  };

  const ip = req && typeof req.ip === 'string' ? req.ip : null;
  putObserved('ip', ip);
  putObserved('userAgent', req ? readHeader(req, 'user-agent') : undefined);
  putObserved('serverOccurredAt', input.occurredAt.toISOString());
  const requestId = (req as { requestId?: string } | undefined)?.requestId
    ?? readHeader(req, 'x-request-id')
    ?? null;
  putObserved('requestId', requestId);
  if (inProcess) {
    observed.channel = 'server';
  }
  putObserved('httpVersion', req?.httpVersion);
  putObserved('acceptLanguage', req ? readHeader(req, 'accept-language') : undefined);
  putObserved('secChUa', req ? readHeader(req, 'sec-ch-ua') : undefined);
  putObserved('secChUaMobile', req ? readHeader(req, 'sec-ch-ua-mobile') : undefined);
  putObserved('secChUaPlatform', req ? readHeader(req, 'sec-ch-ua-platform') : undefined);

  let clockSkewMinutes: number | null = null;
  if (typeof claimed.clientOccurredAt === 'string' && claimed.clientOccurredAt.trim()) {
    const parsed = new Date(claimed.clientOccurredAt);
    if (!Number.isNaN(parsed.getTime())) {
      const skew = Math.abs(parsed.getTime() - input.occurredAt.getTime()) / 60000;
      clockSkewMinutes = Math.round(skew * 100) / 100;
      if (skew > CLIENT_CLOCK_SKEW_WARN_MINUTES) {
        observed.clockSkewMinutes = clockSkewMinutes;
      }
    }
  }

  const claimedChannel = typeof claimed.channel === 'string' ? claimed.channel : null;

  return {
    observed,
    claimed,
    clientChannel: inProcess ? 'server' : claimedChannel,
    clientIp: ip,
    clientTimeZone: typeof claimed.timeZone === 'string' ? claimed.timeZone : null,
    clientInstallId: typeof claimed.installId === 'string' ? claimed.installId : null,
    clockSkewMinutes,
    requestId,
  };
};
