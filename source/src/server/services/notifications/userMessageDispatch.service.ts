import { randomUUID } from 'node:crypto';
import type { NotificationChannelKey } from './notificationDispatch';
import { getUserMessageDispatchModel } from '../../domain/user-message-dispatches/userMessageDispatchSequelizeModels';

export type UserMessageDeliveryStatus =
  | 'digest_pending'
  | 'sent'
  | 'failed'
  | 'fallback_in_app';

export const MSGI_DISPATCH_ID_METADATA_KEY = 'msgiDispatchId';
export const MSGI_CORRELATION_METADATA_KEY = 'msgiCorrelationId';

const BODY_SUMMARY_MAX = 4000;

export const truncateMessageBodySummary = (body: string): string =>
  body.length <= BODY_SUMMARY_MAX ? body : `${body.slice(0, BODY_SUMMARY_MAX - 1)}…`;

export type CreateUserMessageDispatchInput = {
  userId: number;
  correlationId: string;
  eventType: string;
  channel: NotificationChannelKey;
  deliveryStatus: UserMessageDeliveryStatus;
  title: string;
  body: string;
  href?: string | null;
  severity?: string;
  metadata?: unknown;
  inAppNotificationId?: number | null;
  digestBatchId?: string | null;
  deliveredAt?: Date | null;
  errorSummary?: string | null;
};

const mapRow = (row: {
  id: bigint;
  userId: bigint;
  correlationId: string;
  eventType: string;
  channel: string;
  deliveryStatus: string;
  title: string;
  bodySummary: string;
  href: string | null;
  severity: string;
  metadataJson: string | null;
  inAppNotificationId: bigint | null;
  digestBatchId: string | null;
  deliveredAt: Date | null;
  errorSummary: string | null;
  createdAt: Date;
}): UserMessageDispatchRecord => ({
  id: Number(row.id),
  userId: Number(row.userId),
  correlationId: row.correlationId,
  eventType: row.eventType,
  channel: row.channel,
  deliveryStatus: row.deliveryStatus,
  title: row.title,
  bodySummary: row.bodySummary,
  href: row.href,
  severity: row.severity,
  metadataJson: row.metadataJson,
  inAppNotificationId: row.inAppNotificationId !== null ? Number(row.inAppNotificationId) : null,
  digestBatchId: row.digestBatchId,
  deliveredAt: row.deliveredAt ? row.deliveredAt.toISOString() : null,
  errorSummary: row.errorSummary,
  createdAt: row.createdAt.toISOString(),
});

export type UserMessageDispatchRecord = {
  id: number;
  userId: number;
  correlationId: string;
  eventType: string;
  channel: string;
  deliveryStatus: string;
  title: string;
  bodySummary: string;
  href: string | null;
  severity: string;
  metadataJson: string | null;
  inAppNotificationId: number | null;
  digestBatchId: string | null;
  deliveredAt: string | null;
  errorSummary: string | null;
  createdAt: string;
};

export function newMessageDispatchCorrelationId(): string {
  return randomUUID();
}

export async function createUserMessageDispatch(
  input: CreateUserMessageDispatchInput,
): Promise<{ id: number }> {
  const model = getUserMessageDispatchModel();
  const now = new Date();
  const row = await model.create({
    userId: input.userId,
    correlationId: input.correlationId,
    eventType: input.eventType,
    channel: input.channel,
    deliveryStatus: input.deliveryStatus,
    title: input.title.trim(),
    bodySummary: truncateMessageBodySummary(input.body),
    href: input.href ?? null,
    severity: input.severity?.trim() || 'info',
    metadataJson: input.metadata === undefined ? null : JSON.stringify(input.metadata),
    inAppNotificationId: input.inAppNotificationId ?? null,
    digestBatchId: input.digestBatchId ?? null,
    deliveredAt: input.deliveredAt ?? (input.deliveryStatus === 'sent' || input.deliveryStatus === 'fallback_in_app' ? now : null),
    errorSummary: input.errorSummary ?? null,
    createdAt: now,
  });
  return { id: Number(row.id) };
}

export async function updateUserMessageDispatch(
  dispatchId: number,
  userId: number,
  patch: {
    deliveryStatus?: UserMessageDeliveryStatus;
    digestBatchId?: string | null;
    deliveredAt?: Date | null;
    inAppNotificationId?: number | null;
    errorSummary?: string | null;
  },
): Promise<void> {
  const model = getUserMessageDispatchModel();
  await model.update(
    {
      ...(patch.deliveryStatus !== undefined ? { deliveryStatus: patch.deliveryStatus } : {}),
      ...(patch.digestBatchId !== undefined ? { digestBatchId: patch.digestBatchId } : {}),
      ...(patch.deliveredAt !== undefined ? { deliveredAt: patch.deliveredAt } : {}),
      ...(patch.inAppNotificationId !== undefined ? { inAppNotificationId: patch.inAppNotificationId } : {}),
      ...(patch.errorSummary !== undefined ? { errorSummary: patch.errorSummary } : {}),
    },
    { where: { id: dispatchId, userId } },
  );
}

const parseDispatchIdFromMetadata = (metadataJson: string | null): number | null => {
  if (!metadataJson) return null;
  try {
    const parsed = JSON.parse(metadataJson) as Record<string, unknown>;
    const raw = parsed[MSGI_DISPATCH_ID_METADATA_KEY];
    if (typeof raw === 'number' && Number.isInteger(raw) && raw > 0) return raw;
    if (typeof raw === 'string' && /^\d+$/.test(raw)) return Number(raw);
  } catch {
    return null;
  }
  return null;
};

/** MSGI-1 — after digest SMTP batch, stamp ledger rows linked via digest item metadata. */
export async function markUserMessageDispatchesSentForDigestItems(
  items: Array<{ userId: number; metadataJson: string | null }>,
  digestBatchId: string,
): Promise<number> {
  const now = new Date();
  let updated = 0;
  for (const item of items) {
    const dispatchId = parseDispatchIdFromMetadata(item.metadataJson);
    if (!dispatchId) continue;
    await updateUserMessageDispatch(dispatchId, item.userId, {
      deliveryStatus: 'sent',
      digestBatchId,
      deliveredAt: now,
    });
    updated += 1;
  }
  return updated;
}

const buildDispatchWhere = (
  userId: number,
  options?: {
    channel?: string;
    deliveryStatus?: string;
    eventType?: string;
  },
): Record<string, unknown> => {
  const where: Record<string, unknown> = { userId };
  if (options?.channel) where.channel = options.channel;
  if (options?.deliveryStatus) where.deliveryStatus = options.deliveryStatus;
  if (options?.eventType) where.eventType = options.eventType;
  return where;
};

export async function countUserMessageDispatches(
  userId: number,
  options?: {
    channel?: string;
    deliveryStatus?: string;
    eventType?: string;
  },
): Promise<number> {
  const model = getUserMessageDispatchModel();
  return model.count({ where: buildDispatchWhere(userId, options) });
}

export async function listUserMessageDispatches(
  userId: number,
  options?: {
    channel?: string;
    deliveryStatus?: string;
    eventType?: string;
    skip?: number;
    take?: number;
  },
): Promise<UserMessageDispatchRecord[]> {
  const model = getUserMessageDispatchModel();
  const where = buildDispatchWhere(userId, options);
  const rows = await model.findAll({
    where,
    order: [['createdAt', 'DESC']],
    offset: options?.skip ?? 0,
    limit: Math.min(options?.take ?? 20, 100),
  });
  return rows.map((row) => {
    const plain = row.get({ plain: true });
    return mapRow({
      ...plain,
      id: BigInt(plain.id),
      userId: BigInt(plain.userId),
      inAppNotificationId: plain.inAppNotificationId !== null && plain.inAppNotificationId !== undefined
        ? BigInt(plain.inAppNotificationId)
        : null,
    });
  });
}

export async function getUserMessageDispatchById(
  userId: number,
  dispatchId: number,
): Promise<UserMessageDispatchRecord | null> {
  const model = getUserMessageDispatchModel();
  const row = await model.findOne({ where: { id: dispatchId, userId } });
  if (!row) return null;
  const plain = row.get({ plain: true });
  return mapRow({
    ...plain,
    id: BigInt(plain.id),
    userId: BigInt(plain.userId),
    inAppNotificationId: plain.inAppNotificationId !== null && plain.inAppNotificationId !== undefined
      ? BigInt(plain.inAppNotificationId)
      : null,
  });
}

/** ADMIN — wipe all hot dispatch rows (Control records clear; skips archive). */
export async function clearHotUserMessageDispatches(): Promise<{ deleted: number }> {
  const model = getUserMessageDispatchModel();
  const deleted = await model.destroy({ where: {} });
  return { deleted };
}

export function mergeDispatchMetadata(
  metadata: unknown,
  dispatchLink: { dispatchId: number; correlationId: string },
): Record<string, unknown> {
  const base = metadata && typeof metadata === 'object' && !Array.isArray(metadata)
    ? { ...(metadata as Record<string, unknown>) }
    : {};
  return {
    ...base,
    [MSGI_DISPATCH_ID_METADATA_KEY]: dispatchLink.dispatchId,
    [MSGI_CORRELATION_METADATA_KEY]: dispatchLink.correlationId,
  };
}
