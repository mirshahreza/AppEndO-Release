import type { DataStudioExplorerObjectKind } from '../types';

export const formatPrimaryKeyLabel = (primaryKey: string | string[] | null | undefined): string | null => {
  if (!primaryKey) {
    return null;
  }

  if (Array.isArray(primaryKey)) {
    const parts = primaryKey.filter((part) => part.trim().length > 0);
    return parts.length > 0 ? parts.join(', ') : null;
  }

  return primaryKey.trim() || null;
};

export const isRoutineExplorerObjectKind = (objectKind: DataStudioExplorerObjectKind): boolean => (
  objectKind === 'STORED_PROCEDURE'
  || objectKind === 'SCALAR_FUNCTION'
  || objectKind === 'TABLE_VALUED_FUNCTION'
);

export const formatSchemaObjectStructureLabel = (input: {
  objectKind: DataStudioExplorerObjectKind;
  columnCount: number;
  primaryKey: string | string[] | null;
}): string => {
  const isRoutine = isRoutineExplorerObjectKind(input.objectKind);
  const countLabel = isRoutine
    ? `${input.columnCount} param${input.columnCount === 1 ? '' : 's'}`
    : `${input.columnCount} column${input.columnCount === 1 ? '' : 's'}`;

  if (isRoutine) {
    return countLabel;
  }

  const primaryKeyLabel = formatPrimaryKeyLabel(input.primaryKey);
  return primaryKeyLabel ? `${countLabel} · PK: ${primaryKeyLabel}` : `${countLabel} · No PK`;
};
