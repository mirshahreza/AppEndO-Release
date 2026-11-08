export type DataApiAuditOperationKind = 'create' | 'update' | 'patch';

const hasWritableField = (writeFields: readonly string[], field: string): boolean =>
  writeFields.includes(field);

export const applyDataApiAuditFields = (
  payload: Record<string, unknown>,
  writeFields: readonly string[],
  operationKind: DataApiAuditOperationKind,
  actorUserId: unknown,
  changedAt = new Date().toISOString(),
): Record<string, unknown> => {
  const actorId = Number(actorUserId);
  if (!Number.isFinite(actorId) || actorId <= 0) {
    return payload;
  }

  const next = { ...payload };
  if (operationKind === 'create') {
    if (hasWritableField(writeFields, 'createdBy')) {
      next.createdBy = actorId;
    }
    if (hasWritableField(writeFields, 'createdAt')) {
      next.createdAt = changedAt;
    }
  }

  if (hasWritableField(writeFields, 'updatedBy')) {
    next.updatedBy = actorId;
  }
  if (hasWritableField(writeFields, 'updatedAt')) {
    next.updatedAt = changedAt;
  }

  if (payload.statusCode !== undefined) {
    if (hasWritableField(writeFields, 'statusCodeUpdatedBy')) {
      next.statusCodeUpdatedBy = actorId;
    }
    if (hasWritableField(writeFields, 'statusCodeUpdatedAt')) {
      next.statusCodeUpdatedAt = changedAt;
    }
  }

  return next;
};
