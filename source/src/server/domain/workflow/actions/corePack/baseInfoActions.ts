import type { ActionDefinition, ActionExecutor } from '../types';
import type { JsonValue } from '../../awm/types';
import { BaseInfoService } from '../../../../services/base-info.service';
import { HttpError } from '../../../../errors/HttpError';
import type { ActorContext, RequestDbContext } from '../../../../types/requestContext';

/**
 * Base Info Action pack (p-89 ACT-8) — in-process create/update via BaseInfoService.
 * Workflow HTTP cannot call `/api/base-info` (SSRF blocks loopback).
 */

const inlineSchema = (schema: JsonValue = {}) => ({ type: 'INLINE' as const, schema });

const parseActorId = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value;
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    const n = Number(value.trim());
    return Number.isInteger(n) && n > 0 ? n : null;
  }
  return null;
};

const asRecord = (value: unknown): Record<string, unknown> | null => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
);

const emptyCtx = {} as RequestDbContext;

const actorFrom = (userId: number): ActorContext => ({ userId, isAdmin: true });

const mapHttpError = (error: unknown, fallbackCode: string) => {
  if (error instanceof HttpError) {
    return {
      status: 'FAILED' as const,
      errorCode: fallbackCode,
      errorClass: error.statusCode === 404
        ? 'NOT_FOUND' as const
        : error.statusCode === 400
          ? 'VALIDATION' as const
          : 'EXTERNAL_ERROR' as const,
      safeMessage: error.message,
    };
  }
  const safeMessage = error instanceof Error ? error.message : 'Base Info action failed.';
  return {
    status: 'FAILED' as const,
    errorCode: fallbackCode,
    errorClass: 'EXTERNAL_ERROR' as const,
    safeMessage,
  };
};

let serviceSingleton: BaseInfoService | null = null;
const getService = (): BaseInfoService => {
  if (!serviceSingleton) serviceSingleton = new BaseInfoService();
  return serviceSingleton;
};

export const __resetBaseInfoActionServiceForTests = (): void => {
  serviceSingleton = null;
};

export const baseInfoCreateDefinition: ActionDefinition = {
  key: 'base-info.create',
  version: '1',
  contributor: { type: 'CORE', id: 'core' },
  configSchema: inlineSchema(),
  inputSchema: inlineSchema({
    type: 'object',
    properties: {
      parentId: { type: 'string', description: 'Parent base_info id (category/node).' },
      title: { type: 'string' },
      titleEn: { type: 'string' },
      shortName: { type: 'string' },
      childDigits: { type: 'integer' },
      isActive: { type: 'boolean' },
      note: { type: 'string' },
      actorUserId: { type: ['integer', 'string'] },
    },
    required: ['parentId', 'title'],
  }),
  outputSchema: inlineSchema({
    type: 'object',
    properties: {
      id: { type: ['string', 'null'] },
      parentId: { type: 'string' },
      title: { type: 'string' },
    },
  }),
  executionTimeoutMs: 15000,
  idempotency: { guarantee: 'NONE' },
  cancellationSupport: 'NONE',
  sideEffectClass: 'WRITE_EXTERNAL',
  riskClass: 'MEDIUM',
  requiredCapabilities: ['base-info.write'],
  requiredPermissions: [],
  secretReferenceFields: [],
  availability: 'AVAILABLE',
  executionMode: 'DETERMINISTIC',
  tags: ['base-info'],
};

export const baseInfoCreateExecutor: ActionExecutor = {
  async execute(context, _config, input) {
    const record = asRecord(input) ?? {};
    const parentId = typeof record.parentId === 'string' ? record.parentId.trim() : '';
    const title = typeof record.title === 'string' ? record.title.trim() : '';
    if (!parentId || !title) {
      return {
        status: 'FAILED',
        errorCode: 'BASE_INFO_INVALID_INPUT',
        errorClass: 'VALIDATION',
        safeMessage: 'Expected input.parentId and input.title (non-empty strings).',
      };
    }
    const actorFromInput = parseActorId(record.actorUserId);
    const actorId = context.effectiveIdentity.type === 'USER'
      ? context.effectiveIdentity.id
      : actorFromInput;
    if (!actorId) {
      return {
        status: 'FAILED',
        errorCode: 'BASE_INFO_INVALID_INPUT',
        errorClass: 'VALIDATION',
        safeMessage: 'Expected actorUserId when workflow identity is not a USER.',
      };
    }
    const titleEn = typeof record.titleEn === 'string' && record.titleEn.trim()
      ? record.titleEn.trim()
      : title;
    const shortName = typeof record.shortName === 'string' && record.shortName.trim()
      ? record.shortName.trim()
      : titleEn.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40) || 'item';
    try {
      const result = await getService().createNode(emptyCtx, actorFrom(actorId), {
        parentId,
        title,
        titleEn,
        shortName,
        childDigits: typeof record.childDigits === 'number' ? record.childDigits : 3,
        isActive: record.isActive === undefined ? true : Boolean(record.isActive),
        note: typeof record.note === 'string' ? record.note : undefined,
      });
      const id = (result.body as { id?: string | null }).id ?? null;
      context.writeTraceMetadata({ type: 'BASE_INFO_CREATE', payload: { parentId, id } });
      return {
        status: 'SUCCEEDED',
        output: { id, parentId, title },
      };
    } catch (error) {
      return mapHttpError(error, 'BASE_INFO_CREATE_FAILED');
    }
  },
};

export const baseInfoUpdateDefinition: ActionDefinition = {
  key: 'base-info.update',
  version: '1',
  contributor: { type: 'CORE', id: 'core' },
  configSchema: inlineSchema(),
  inputSchema: inlineSchema({
    type: 'object',
    properties: {
      id: { type: 'string', description: 'base_info node id' },
      title: { type: 'string' },
      titleEn: { type: 'string' },
      shortName: { type: 'string' },
      isActive: { type: 'boolean' },
      note: { type: 'string' },
      actorUserId: { type: ['integer', 'string'] },
    },
    required: ['id'],
  }),
  outputSchema: inlineSchema({
    type: 'object',
    properties: {
      id: { type: 'string' },
      updated: { type: 'boolean' },
    },
  }),
  executionTimeoutMs: 15000,
  idempotency: { guarantee: 'NONE' },
  cancellationSupport: 'NONE',
  sideEffectClass: 'WRITE_EXTERNAL',
  riskClass: 'MEDIUM',
  requiredCapabilities: ['base-info.write'],
  requiredPermissions: [],
  secretReferenceFields: [],
  availability: 'AVAILABLE',
  executionMode: 'DETERMINISTIC',
  tags: ['base-info'],
};

export const baseInfoUpdateExecutor: ActionExecutor = {
  async execute(context, _config, input) {
    const record = asRecord(input) ?? {};
    const id = typeof record.id === 'string' ? record.id.trim() : '';
    if (!id) {
      return {
        status: 'FAILED',
        errorCode: 'BASE_INFO_INVALID_INPUT',
        errorClass: 'VALIDATION',
        safeMessage: 'Expected input.id (base_info node id).',
      };
    }
    const actorFromInput = parseActorId(record.actorUserId);
    const actorId = context.effectiveIdentity.type === 'USER'
      ? context.effectiveIdentity.id
      : actorFromInput;
    if (!actorId) {
      return {
        status: 'FAILED',
        errorCode: 'BASE_INFO_INVALID_INPUT',
        errorClass: 'VALIDATION',
        safeMessage: 'Expected actorUserId when workflow identity is not a USER.',
      };
    }
    const fields: Record<string, unknown> = {};
    for (const key of ['title', 'titleEn', 'shortName', 'note'] as const) {
      if (typeof record[key] === 'string') fields[key] = record[key];
    }
    if (record.isActive !== undefined) fields.isActive = Boolean(record.isActive);
    if (Object.keys(fields).length === 0) {
      return {
        status: 'FAILED',
        errorCode: 'BASE_INFO_INVALID_INPUT',
        errorClass: 'VALIDATION',
        safeMessage: 'Expected at least one updatable field.',
      };
    }
    try {
      await getService().updateNode(emptyCtx, actorFrom(actorId), id, fields);
      context.writeTraceMetadata({ type: 'BASE_INFO_UPDATE', payload: { id } });
      return { status: 'SUCCEEDED', output: { id, updated: true } };
    } catch (error) {
      return mapHttpError(error, 'BASE_INFO_UPDATE_FAILED');
    }
  },
};
