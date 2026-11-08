import { toPositionalParams } from '../db/database';

export const AUTH_AUDIT_ROW_COLUMN_COUNT = 8;

export type AuthAuditQueueEntry = {
  userId: number | null;
  email: string | null;
  eventType: string;
  success: boolean;
  reason: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadataJson: string | null;
};

export type AuthAuditRowValues = [
  number | null,
  string | null,
  string,
  number,
  string | null,
  string | null,
  string | null,
  string | null,
];

export const mapAuthAuditEntryToRowValues = (entry: AuthAuditQueueEntry): AuthAuditRowValues => ([
  entry.userId,
  entry.email,
  entry.eventType,
  entry.success ? 1 : 0,
  entry.reason,
  entry.ipAddress,
  entry.userAgent,
  entry.metadataJson,
]);

export const buildAuthAuditBatchInsertSql = (rowCount: number): string => {
  const rowPlaceholder = '(?, ?, ?, ?, ?, ?, ?, ?)';
  const valuesClause = Array.from({ length: rowCount }, () => rowPlaceholder).join(', ');
  return toPositionalParams(`
    INSERT INTO base_logs_auth_audit (
      user_id, email, event_type, success, reason, ip_address, user_agent, metadata_json
    )
    VALUES ${valuesClause}
  `);
};

export const flattenAuthAuditRowValues = (rows: AuthAuditRowValues[]): unknown[] =>
  rows.flatMap((row) => [...row]);
