export type DbObjectInstallMode = 'required' | 'optional';

export type DbObjectInstallModeFields = {
  objectType?: unknown;
  installMode?: unknown;
};

export function resolveDbObjectInstallMode(obj: DbObjectInstallModeFields): DbObjectInstallMode {
  if (obj.installMode === 'optional' && obj.objectType === 'seed') {
    return 'optional';
  }
  return 'required';
}

export function isOptionalDbObject(obj: DbObjectInstallModeFields): boolean {
  return resolveDbObjectInstallMode(obj) === 'optional';
}

export function selectDbObjectsForRecordChoice<T extends DbObjectInstallModeFields>(
  objects: readonly T[],
  includeOptionalRecords: boolean,
): T[] {
  if (includeOptionalRecords) return [...objects];
  return objects.filter((obj) => !isOptionalDbObject(obj));
}

export function packageHasOptionalDbRecords(manifest: {
  capabilities?: { db_objects?: readonly DbObjectInstallModeFields[] };
} | null | undefined): boolean {
  const objects = manifest?.capabilities?.db_objects;
  if (!Array.isArray(objects)) return false;
  return objects.some((obj) => isOptionalDbObject(obj));
}

export function parseInstallOptionalRecordsFlag(value: unknown, fallback = true): boolean {
  if (typeof value === 'boolean') return value;
  return fallback;
}
