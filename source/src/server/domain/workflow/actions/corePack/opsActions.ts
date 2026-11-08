import type { ActionDefinition, ActionExecutor } from '../types';
import type { JsonValue } from '../../awm/types';
import { prisma, fromUserId } from '../../../users/prismaHelpers';

/**
 * Ops Action pack — control-plane reads that Edge `data.db-query` cannot reach
 * (logs live in Prisma control plane, not Edge Data Sources).
 */

const inlineSchema = (schema: JsonValue = {}) => ({ type: 'INLINE' as const, schema });

const asRecord = (value: unknown): Record<string, unknown> | null => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
);

export const opsAppLogsRecentDefinition: ActionDefinition = {
  key: 'ops.app-logs-recent',
  version: '1',
  contributor: { type: 'CORE', id: 'core' },
  configSchema: inlineSchema(),
  inputSchema: inlineSchema({
    type: 'object',
    properties: {
      level: { type: 'string', description: 'Optional level filter (e.g. ERROR).' },
      context: { type: 'string', description: 'Optional context contains filter.' },
      limit: { type: 'integer', default: 20 },
    },
  }),
  outputSchema: inlineSchema({
    type: 'object',
    properties: {
      count: { type: 'integer' },
      items: { type: 'array' },
    },
  }),
  executionTimeoutMs: 10000,
  idempotency: { guarantee: 'DEDUPLICATED', deduplicationWindowMs: 60000 },
  cancellationSupport: 'NONE',
  sideEffectClass: 'READ_EXTERNAL',
  riskClass: 'LOW',
  requiredCapabilities: ['ops.read'],
  requiredPermissions: [],
  secretReferenceFields: [],
  availability: 'AVAILABLE',
  executionMode: 'DETERMINISTIC',
  tags: ['ops', 'logs'],
};

export const opsAppLogsRecentExecutor: ActionExecutor = {
  async execute(context, _config, input) {
    const record = asRecord(input) ?? {};
    const level = typeof record.level === 'string' && record.level.trim() ? record.level.trim() : null;
    const contextFilter = typeof record.context === 'string' && record.context.trim() ? record.context.trim() : null;
    const limitRaw = typeof record.limit === 'number' && Number.isInteger(record.limit) ? record.limit : 20;
    const limit = Math.min(Math.max(limitRaw, 1), 100);

    const where: Record<string, unknown> = {};
    if (level) where.level = level;
    if (contextFilter) where.context = { contains: contextFilter };

    try {
      const rows = await prisma().baseAppLog.findMany({
        where,
        orderBy: { id: 'desc' },
        take: limit,
        select: {
          id: true,
          level: true,
          context: true,
          message: true,
          actor: true,
          createdAt: true,
          failureReason: true,
        },
      });
      const items = rows.map((row) => ({
        id: fromUserId(row.id),
        level: row.level,
        context: row.context,
        message: row.message,
        actor: row.actor,
        createdAt: row.createdAt?.toISOString() ?? null,
        failureReason: row.failureReason,
      }));
      context.writeTraceMetadata({
        type: 'OPS_APP_LOGS_RECENT',
        payload: { count: items.length, level, context: contextFilter },
      });
      return {
        status: 'SUCCEEDED',
        output: {
          count: items.length,
          items,
          top: items[0] ?? null,
        },
      };
    } catch (error) {
      const safeMessage = error instanceof Error ? error.message : 'App logs query failed.';
      return {
        status: 'FAILED',
        errorCode: 'OPS_APP_LOGS_FAILED',
        errorClass: 'EXTERNAL_ERROR',
        safeMessage,
      };
    }
  },
};
