import type {
  EdgeModelAssociation,
  EdgeModelColumn,
  EdgeModelDefinition,
} from '../api/contracts/data-api';
import { isControlPlaneSchemaObjectName } from './controlPlaneSchemaObjects';

/** Column fields that define physical DB shape — immutable on existing platform columns. */
export const CONTROL_PLANE_STRUCTURAL_COLUMN_KEYS = [
  'name',
  'field',
  'dataType',
  'allowNull',
  'isPrimaryKey',
  'isForeignKey',
  'fkTarget',
] as const satisfies ReadonlyArray<keyof EdgeModelColumn>;

type StructuralColumnKey = (typeof CONTROL_PLANE_STRUCTURAL_COLUMN_KEYS)[number];

const stableJson = (value: unknown): string => JSON.stringify(value ?? null);

const structuralColumnSlice = (column: EdgeModelColumn): Pick<EdgeModelColumn, StructuralColumnKey> => ({
  name: column.name,
  field: column.field,
  dataType: column.dataType,
  allowNull: column.allowNull,
  isPrimaryKey: column.isPrimaryKey,
  isForeignKey: column.isForeignKey,
  fkTarget: column.fkTarget,
});

const isStructuralColumnUnchanged = (
  previous: EdgeModelColumn,
  next: EdgeModelColumn,
): boolean => (
  stableJson(structuralColumnSlice(previous)) === stableJson(structuralColumnSlice(next))
);

const isAssociationUnchanged = (
  previous: EdgeModelAssociation,
  next: EdgeModelAssociation,
): boolean => stableJson(previous) === stableJson(next);

export type ControlPlaneEdgeModelPatch = Partial<
  Pick<EdgeModelDefinition, 'labels' | 'columns' | 'associations' | 'readOnly'>
>;

/**
 * Platform (`base_*`) models may gain columns/associations and freely change model metadata,
 * but existing physical columns and original associations cannot be removed or reshaped.
 */
export function assertControlPlaneEdgeModelPatchAllowed(
  existing: EdgeModelDefinition,
  patch: ControlPlaneEdgeModelPatch,
): void {
  if (!isControlPlaneSchemaObjectName(existing.objectName)) {
    return;
  }

  if (patch.columns) {
    const desiredByName = new Map(patch.columns.map((column) => [column.name, column]));

    for (const previous of existing.columns) {
      const next = desiredByName.get(previous.name);
      if (!next) {
        throw new Error(
          `Platform schema column "${previous.name}" cannot be removed.`,
        );
      }
      if (!isStructuralColumnUnchanged(previous, next)) {
        throw new Error(
          `Platform schema column "${previous.name}" cannot change database shape (name, field, type, nullability, keys).`,
        );
      }
    }
  }

  if (patch.associations) {
    const desiredById = new Map(patch.associations.map((association) => [association.id, association]));

    for (const previous of existing.associations) {
      const next = desiredById.get(previous.id);
      if (!next) {
        throw new Error(
          `Platform schema relation "${previous.as}" cannot be removed.`,
        );
      }
      if (!isAssociationUnchanged(previous, next)) {
        throw new Error(
          `Platform schema relation "${previous.as}" cannot be changed.`,
        );
      }
    }
  }
}

export function isControlPlaneProtectedColumnName(
  objectName: string,
  columnName: string,
  protectedColumnNames: ReadonlySet<string>,
): boolean {
  return isControlPlaneSchemaObjectName(objectName) && protectedColumnNames.has(columnName);
}

export function isControlPlaneProtectedAssociationId(
  objectName: string,
  associationId: string,
  protectedAssociationIds: ReadonlySet<string>,
): boolean {
  return isControlPlaneSchemaObjectName(objectName) && protectedAssociationIds.has(associationId);
}

/** True when the patch touches physical-shape keys (not runtime metadata like sequelizeType). */
export function isControlPlaneStructuralColumnPatch(patch: Partial<EdgeModelColumn>): boolean {
  return CONTROL_PLANE_STRUCTURAL_COLUMN_KEYS.some((key) => Object.prototype.hasOwnProperty.call(patch, key));
}
