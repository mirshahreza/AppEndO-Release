import type { EdgeModelAssociation, EdgeModelDefinition } from '../../../shared/api/contracts/data-api';
import type {
  LogicalRelationGraphInput,
  LogicalRelationPeerTable,
} from '../../../shared/lib/buildEdgeSchemaFlowGraph';
import { isBelongsToManyAssociation } from './edgeModelAssociations';

export const toLogicalRelationGraphInputs = (
  sourceModel: Pick<EdgeModelDefinition, 'objectName' | 'associations'>,
  peerModels: ReadonlyArray<Pick<EdgeModelDefinition, 'id' | 'objectName'>>,
): LogicalRelationGraphInput[] => {
  const objectNameById = new Map(
    peerModels.map((model) => [model.id, model.objectName] as const),
  );

  const inputs: LogicalRelationGraphInput[] = [];
  for (const association of sourceModel.associations) {
    const targetObjectName = objectNameById.get(association.targetModelId);
    if (!targetObjectName) {
      continue;
    }
    const throughObjectName = isBelongsToManyAssociation(association)
      ? objectNameById.get(association.throughModelId)
      : undefined;
    if (isBelongsToManyAssociation(association) && !throughObjectName) {
      continue;
    }
    inputs.push({
      associationId: association.id,
      kind: association.kind,
      as: association.as,
      foreignKey: association.foreignKey,
      sourceObjectName: sourceModel.objectName,
      targetObjectName,
      ...(isBelongsToManyAssociation(association)
        ? {
          throughObjectName,
          otherKey: association.otherKey,
        }
        : {}),
    });
  }
  return inputs;
};

export const toLogicalRelationPeerTables = (
  associations: ReadonlyArray<EdgeModelAssociation>,
  peerModels: ReadonlyArray<Pick<EdgeModelDefinition, 'id' | 'objectName' | 'columns'>>,
  existingTableNames: ReadonlySet<string>,
): LogicalRelationPeerTable[] => {
  const neededIds = new Set<string>();
  for (const association of associations) {
    neededIds.add(association.targetModelId);
    if (isBelongsToManyAssociation(association)) {
      neededIds.add(association.throughModelId);
    }
  }
  const tables: LogicalRelationPeerTable[] = [];
  for (const model of peerModels) {
    if (!neededIds.has(model.id) || existingTableNames.has(model.objectName)) {
      continue;
    }
    tables.push({
      name: model.objectName,
      columns: model.columns.map((column) => ({
        name: column.name,
        dataType: column.dataType || 'unknown',
        isPrimaryKey: Boolean(column.isPrimaryKey),
      })),
    });
  }
  return tables;
};

export const peerTablesForDataSource = (
  peerModels: ReadonlyArray<Pick<EdgeModelDefinition, 'objectName' | 'columns' | 'dataSourceId'>>,
  dataSourceId: string,
  excludeObjectName?: string,
): LogicalRelationPeerTable[] => {
  const byName = new Map<string, LogicalRelationPeerTable>();
  for (const model of peerModels) {
    if (model.dataSourceId !== dataSourceId) {
      continue;
    }
    if (excludeObjectName && model.objectName === excludeObjectName) {
      continue;
    }
    if (byName.has(model.objectName)) {
      continue;
    }
    byName.set(model.objectName, {
      name: model.objectName,
      columns: model.columns.map((column) => ({
        name: column.name,
        dataType: column.dataType || 'unknown',
        isPrimaryKey: Boolean(column.isPrimaryKey),
      })),
    });
  }
  return [...byName.values()];
};
