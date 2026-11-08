import type { AuthAuditContext } from '../../types/requestContext';
import type { AuthAuditEvent } from './types';
import { getAuthAuditPinoLogger } from '../../../core/logging/PinoRuntime';
import {
  listAuthAuditLogs,
  listAuthAuditLogsForUser,
} from '../../domain/auth/authAuditRepository';

const safeSerializeMetadata = (metadata: unknown): string | null => {
  if (metadata === undefined) return null;
  try {
    return JSON.stringify(metadata);
  } catch {
    return JSON.stringify({ serializationError: true, type: typeof metadata });
  }
};

export const logAuthEvent = async (
  audit: AuthAuditContext,
  eventType: AuthAuditEvent,
  options?: {
    userId?: number;
    email?: string;
    success?: boolean;
    reason?: string;
    metadata?: unknown;
  },
): Promise<void> => {
  const authAuditLogger = getAuthAuditPinoLogger();
  if (!authAuditLogger) {
    console.error('[AuthAuditPersistence] Pino auth audit logger is not initialized.');
    return;
  }

  const { userId, email, success = false, reason, metadata } = options || {};

  authAuditLogger.info({
    userId: userId || null,
    email: email || null,
    eventType,
    success,
    reason: reason || null,
    ipAddress: audit.ipAddress || null,
    userAgent: audit.userAgent || null,
    metadataJson: safeSerializeMetadata(metadata),
  }, eventType);
};

const mapAuditItem = (item: {
  id: number;
  user_id: number;
  email: string | null;
  event_type: string;
  success: number;
  reason: string | null;
  ip_address: string | null;
  user_agent: string | null;
  metadata_json: string | null;
  created_at: Date | null;
}) => ({
  id: item.id,
  userId: item.user_id,
  email: item.email,
  eventType: item.event_type,
  success: !!item.success,
  reason: item.reason,
  ipAddress: item.ip_address,
  userAgent: item.user_agent,
  metadata: item.metadata_json ? JSON.parse(item.metadata_json) : null,
  createdAt: item.created_at,
});

export const fetchMyAuditLogs = async (userId: number, limit: number) => {
  const items = await listAuthAuditLogsForUser(userId, limit);
  return items.map(mapAuditItem);
};

export const fetchAdminAuditLogs = async (limit: number, userId: number | null) => {
  const items = await listAuthAuditLogs(limit, userId);
  return items.map(mapAuditItem);
};
