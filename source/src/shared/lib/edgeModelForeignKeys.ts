import type { EdgeModelColumn, EdgeModelDefinition } from '../api/contracts/data-api';
import type { SchemaRelationEdge } from '../api/contracts/data-sources/schemaRelations';

export type OutboundForeignKeyTarget = {
  toTable: string;
  toColumn: string;
  constraintName?: string;
};

/** Outbound physical FKs keyed by local column name. */
export const buildOutboundForeignKeyMap = (
  objectName: string,
  relations: ReadonlyArray<SchemaRelationEdge>,
): Map<string, OutboundForeignKeyTarget> => {
  const map = new Map<string, OutboundForeignKeyTarget>();
  for (const relation of relations) {
    if (relation.fromTable !== objectName) {
      continue;
    }
    if (map.has(relation.fromColumn)) {
      continue;
    }
    map.set(relation.fromColumn, {
      toTable: relation.toTable,
      toColumn: relation.toColumn,
      constraintName: relation.constraintName,
    });
  }
  return map;
};

export const formatForeignKeyTargetLabel = (
  target: Pick<OutboundForeignKeyTarget, 'toTable' | 'toColumn'>,
): string => `${target.toTable}.${target.toColumn}`;

/**
 * Marks columns that participate in outbound physical foreign keys.
 * Sets `fkTarget` when a peer Edge model exists for the referenced table.
 */
export const annotateEdgeModelColumnsWithForeignKeys = (
  columns: ReadonlyArray<EdgeModelColumn>,
  args: {
    objectName: string;
    dataSourceId: string;
    relations: ReadonlyArray<SchemaRelationEdge>;
    models: ReadonlyArray<Pick<EdgeModelDefinition, 'id' | 'dataSourceId' | 'objectName'>>;
  },
): EdgeModelColumn[] => {
  const fkMap = buildOutboundForeignKeyMap(args.objectName, args.relations);

  return columns.map((column) => {
    const target = fkMap.get(column.name);
    if (!target) {
      if (!column.isForeignKey && !column.fkTarget) {
        return column;
      }
      const next: EdgeModelColumn = {
        ...column,
        isForeignKey: false,
      };
      delete next.fkTarget;
      return next;
    }

    const targetModel = args.models.find((model) => (
      model.dataSourceId === args.dataSourceId && model.objectName === target.toTable
    ));

    const next: EdgeModelColumn = {
      ...column,
      isForeignKey: true,
    };

    if (targetModel) {
      next.fkTarget = {
        modelId: targetModel.id,
        column: target.toColumn,
      };
    } else {
      delete next.fkTarget;
    }

    return next;
  });
};
