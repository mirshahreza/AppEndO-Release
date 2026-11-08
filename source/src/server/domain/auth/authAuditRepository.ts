import { fromUserId, prisma, toUserId } from '../users/prismaHelpers';

type AuthAuditRow = {
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
};

const mapAuditRow = (row: {
  id: bigint;
  userId: bigint | null;
  email: string | null;
  eventType: string;
  success: number;
  reason: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadataJson: string | null;
  createdAt: Date | null;
}): AuthAuditRow => ({
  id: fromUserId(row.id),
  user_id: row.userId !== null ? fromUserId(row.userId) : 0,
  email: row.email,
  event_type: row.eventType,
  success: row.success,
  reason: row.reason,
  ip_address: row.ipAddress,
  user_agent: row.userAgent,
  metadata_json: row.metadataJson,
  created_at: row.createdAt,
});

export const listAuthAuditLogsForUser = async (userId: number, limit: number) => {
  const rows = await prisma().baseAuthAuditLog.findMany({
    where: { userId: toUserId(userId) },
    orderBy: { id: 'desc' },
    take: limit,
  });
  return rows.map(mapAuditRow);
};

export const listAuthAuditLogs = async (limit: number, userId: number | null) => {
  const rows = await prisma().baseAuthAuditLog.findMany({
    where: userId !== null ? { userId: toUserId(userId) } : undefined,
    orderBy: { id: 'desc' },
    take: limit,
  });
  return rows.map(mapAuditRow);
};
