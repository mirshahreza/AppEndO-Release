import type { ActionDefinition, ActionExecutor } from '../types';
import type { JsonValue } from '../../awm/types';
import { ScopeMembershipsService } from '../../../../services/scope-memberships.service';
import { HttpError } from '../../../../errors/HttpError';
import type { ActorContext, RequestDbContext } from '../../../../types/requestContext';

/**
 * Scope membership Action pack (p-89 ACT-9) — in-process grant/revoke via ScopeMembershipsService.
 * Workflow HTTP cannot call `/api/scope-memberships` (SSRF blocks loopback).
 */

const inlineSchema = (schema: JsonValue = {}) => ({ type: 'INLINE' as const, schema });

const parsePositiveInt = (value: unknown): number | null => {
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
        : error.statusCode === 409
          ? 'CONFLICT' as const
          : error.statusCode === 400
            ? 'VALIDATION' as const
            : 'EXTERNAL_ERROR' as const,
      safeMessage: error.message,
    };
  }
  const safeMessage = error instanceof Error ? error.message : 'Scope membership action failed.';
  return {
    status: 'FAILED' as const,
    errorCode: fallbackCode,
    errorClass: 'EXTERNAL_ERROR' as const,
    safeMessage,
  };
};

let serviceSingleton: ScopeMembershipsService | null = null;
const getService = (): ScopeMembershipsService => {
  if (!serviceSingleton) serviceSingleton = new ScopeMembershipsService();
  return serviceSingleton;
};

export const __resetScopeActionServiceForTests = (): void => {
  serviceSingleton = null;
};

export const scopeMembershipGrantDefinition: ActionDefinition = {
  key: 'scope.membership-grant',
  version: '1',
  contributor: { type: 'CORE', id: 'core' },
  configSchema: inlineSchema(),
  inputSchema: inlineSchema({
    type: 'object',
    properties: {
      dimensionKey: { type: 'string', description: '"org" or "geo"' },
      nodeId: { type: 'string', description: 'base_info node under org (120) or geo (121)' },
      userId: { type: ['integer', 'string'] },
      actorUserId: { type: ['integer', 'string'] },
    },
    required: ['dimensionKey', 'nodeId', 'userId'],
  }),
  outputSchema: inlineSchema({
    type: 'object',
    properties: {
      id: { type: ['integer', 'null'] },
      userId: { type: 'integer' },
      dimensionKey: { type: 'string' },
      nodeId: { type: 'string' },
    },
  }),
  executionTimeoutMs: 15000,
  idempotency: { guarantee: 'NONE' },
  cancellationSupport: 'NONE',
  sideEffectClass: 'WRITE_EXTERNAL',
  riskClass: 'HIGH',
  requiredCapabilities: ['scope.write'],
  requiredPermissions: [],
  secretReferenceFields: [],
  availability: 'AVAILABLE',
  executionMode: 'DETERMINISTIC',
  tags: ['scope', 'membership'],
};

export const scopeMembershipGrantExecutor: ActionExecutor = {
  async execute(context, _config, input) {
    const record = asRecord(input) ?? {};
    const dimensionKey = typeof record.dimensionKey === 'string' ? record.dimensionKey.trim() : '';
    const nodeId = typeof record.nodeId === 'string' ? record.nodeId.trim() : '';
    const userId = parsePositiveInt(record.userId);
    if (!dimensionKey || !nodeId || !userId) {
      return {
        status: 'FAILED',
        errorCode: 'SCOPE_INVALID_INPUT',
        errorClass: 'VALIDATION',
        safeMessage: 'Expected dimensionKey, nodeId, and userId.',
      };
    }
    const actorFromInput = parsePositiveInt(record.actorUserId);
    const actorId = context.effectiveIdentity.type === 'USER'
      ? context.effectiveIdentity.id
      : actorFromInput;
    if (!actorId) {
      return {
        status: 'FAILED',
        errorCode: 'SCOPE_INVALID_INPUT',
        errorClass: 'VALIDATION',
        safeMessage: 'Expected actorUserId when workflow identity is not a USER.',
      };
    }
    try {
      const result = await getService().create(emptyCtx, actorFrom(actorId), {
        dimensionKey,
        nodeId,
        userId,
      });
      const item = (result.body as { item?: Record<string, unknown> }).item ?? {};
      const id = typeof item.id === 'number' ? item.id : parsePositiveInt(item.id);
      context.writeTraceMetadata({
        type: 'SCOPE_MEMBERSHIP_GRANT',
        payload: { id, userId, dimensionKey, nodeId },
      });
      return {
        status: 'SUCCEEDED',
        output: {
          id,
          userId,
          dimensionKey,
          nodeId,
        },
      };
    } catch (error) {
      return mapHttpError(error, 'SCOPE_MEMBERSHIP_GRANT_FAILED');
    }
  },
};

export const scopeMembershipRevokeDefinition: ActionDefinition = {
  key: 'scope.membership-revoke',
  version: '1',
  contributor: { type: 'CORE', id: 'core' },
  configSchema: inlineSchema(),
  inputSchema: inlineSchema({
    type: 'object',
    properties: {
      membershipId: { type: ['integer', 'string'], description: 'base_scope_memberships.id' },
      actorUserId: { type: ['integer', 'string'] },
    },
    required: ['membershipId'],
  }),
  outputSchema: inlineSchema({
    type: 'object',
    properties: {
      membershipId: { type: 'integer' },
      revoked: { type: 'boolean' },
    },
  }),
  executionTimeoutMs: 15000,
  idempotency: { guarantee: 'NONE' },
  cancellationSupport: 'NONE',
  sideEffectClass: 'WRITE_EXTERNAL',
  riskClass: 'HIGH',
  requiredCapabilities: ['scope.write'],
  requiredPermissions: [],
  secretReferenceFields: [],
  availability: 'AVAILABLE',
  executionMode: 'DETERMINISTIC',
  tags: ['scope', 'membership'],
};

export const scopeMembershipRevokeExecutor: ActionExecutor = {
  async execute(context, _config, input) {
    const record = asRecord(input) ?? {};
    const membershipId = parsePositiveInt(record.membershipId);
    if (!membershipId) {
      return {
        status: 'FAILED',
        errorCode: 'SCOPE_INVALID_INPUT',
        errorClass: 'VALIDATION',
        safeMessage: 'Expected input.membershipId (positive integer).',
      };
    }
    const actorFromInput = parsePositiveInt(record.actorUserId);
    const actorId = context.effectiveIdentity.type === 'USER'
      ? context.effectiveIdentity.id
      : actorFromInput;
    if (!actorId) {
      return {
        status: 'FAILED',
        errorCode: 'SCOPE_INVALID_INPUT',
        errorClass: 'VALIDATION',
        safeMessage: 'Expected actorUserId when workflow identity is not a USER.',
      };
    }
    try {
      await getService().remove(emptyCtx, actorFrom(actorId), String(membershipId));
      context.writeTraceMetadata({
        type: 'SCOPE_MEMBERSHIP_REVOKE',
        payload: { membershipId },
      });
      return { status: 'SUCCEEDED', output: { membershipId, revoked: true } };
    } catch (error) {
      return mapHttpError(error, 'SCOPE_MEMBERSHIP_REVOKE_FAILED');
    }
  },
};
