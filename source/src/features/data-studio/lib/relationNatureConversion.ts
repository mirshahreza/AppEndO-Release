import type {
  EdgeModelAssociation,
  EdgeModelDefinition,
} from '../../../shared/api/contracts/data-api';
import type {
  AddForeignKeyConstraintInput,
  FkReferentialAction,
} from '../../../shared/api/contracts/data-sources/foreignKeyConstraint';
import type { SchemaRelationEdge } from '../../../shared/api/contracts/data-sources/schemaRelations';
import { suggestForeignKeyConstraintName } from '../../../shared/lib/schemaObjectForeignKey';
import {
  associationsFromSuggestions,
  foreignKeyOwnerForKind,
  suggestAssociationAlias,
  suggestAssociationsFromPhysicalRelations,
  supportsPhysicalNatureConversion,
  type PhysicalRelationSuggestion,
} from './edgeModelAssociations';

export type LogicalToPhysicalPlan = {
  tableName: string;
  columnName: string;
  referencedTable: string;
  referencedColumn: string;
  suggestedConstraintName: string;
  /** True when the FK-owning table is not the focus model. */
  altersPeerTable: boolean;
};

export type PhysicalToLogicalPlan = PhysicalRelationSuggestion & {
  association: EdgeModelAssociation;
};

const resolvePrimaryKeyColumn = (
  model: Pick<EdgeModelDefinition, 'primaryKey' | 'columns'>,
): string | null => {
  if (typeof model.primaryKey === 'string' && model.primaryKey.trim()) {
    return model.primaryKey.trim();
  }
  if (Array.isArray(model.primaryKey) && model.primaryKey.length > 0) {
    const first = model.primaryKey[0]?.trim();
    if (first) {
      return first;
    }
  }
  const marked = model.columns.find((column) => column.isPrimaryKey)?.name?.trim();
  return marked || null;
};

export const planLogicalToPhysical = (args: {
  association: EdgeModelAssociation;
  focusModel: EdgeModelDefinition;
  targetModel: EdgeModelDefinition;
}): LogicalToPhysicalPlan | { error: string } => {
  if (!supportsPhysicalNatureConversion(args.association.kind)) {
    return { error: 'Belongs-to-many relations stay logical in this version (junction foreign keys are managed on the through model).' };
  }

  const foreignKey = args.association.foreignKey.trim();
  if (!foreignKey) {
    return { error: 'Logical relation has no foreign-key column.' };
  }

  const owner = foreignKeyOwnerForKind(args.association.kind);
  if (owner === 'through') {
    return { error: 'Belongs-to-many relations cannot be converted to a single physical foreign-key.' };
  }
  if (owner === 'source') {
    const referencedColumn = resolvePrimaryKeyColumn(args.targetModel);
    if (!referencedColumn) {
      return { error: `Target model ${args.targetModel.objectName} has no primary key.` };
    }
    return {
      tableName: args.focusModel.objectName,
      columnName: foreignKey,
      referencedTable: args.targetModel.objectName,
      referencedColumn,
      suggestedConstraintName: suggestForeignKeyConstraintName(
        args.focusModel.objectName,
        foreignKey,
      ),
      altersPeerTable: false,
    };
  }

  const referencedColumn = resolvePrimaryKeyColumn(args.focusModel);
  if (!referencedColumn) {
    return { error: `Source model ${args.focusModel.objectName} has no primary key.` };
  }
  return {
    tableName: args.targetModel.objectName,
    columnName: foreignKey,
    referencedTable: args.focusModel.objectName,
    referencedColumn,
    suggestedConstraintName: suggestForeignKeyConstraintName(
      args.targetModel.objectName,
      foreignKey,
    ),
    altersPeerTable: true,
  };
};

export const buildAddForeignKeyFromPlan = (args: {
  dataSourceId: string;
  plan: LogicalToPhysicalPlan;
  constraintName?: string;
  onDelete?: '' | FkReferentialAction;
  onUpdate?: '' | FkReferentialAction;
}): AddForeignKeyConstraintInput => ({
  dataSourceId: args.dataSourceId,
  tableName: args.plan.tableName,
  columnName: args.plan.columnName,
  referencedTable: args.plan.referencedTable,
  referencedColumn: args.plan.referencedColumn,
  constraintName: (args.constraintName?.trim() || args.plan.suggestedConstraintName),
  ...(args.onDelete ? { onDelete: args.onDelete } : {}),
  ...(args.onUpdate ? { onUpdate: args.onUpdate } : {}),
});

export const planPhysicalToLogical = (args: {
  focusObjectName: string;
  relation: SchemaRelationEdge;
  models: ReadonlyArray<EdgeModelDefinition>;
  dataSourceId: string;
  existing: ReadonlyArray<Pick<EdgeModelAssociation, 'as' | 'kind' | 'targetModelId' | 'foreignKey'>>;
}): PhysicalToLogicalPlan | { error: string } => {
  const suggestions = suggestAssociationsFromPhysicalRelations({
    focusObjectName: args.focusObjectName,
    relations: [args.relation],
    models: args.models,
    dataSourceId: args.dataSourceId,
    existing: args.existing,
  });
  const suggestion = suggestions[0];
  if (!suggestion) {
    const outbound = args.relation.fromTable === args.focusObjectName;
    const peer = outbound ? args.relation.toTable : args.relation.fromTable;
    const hasPeer = args.models.some(
      (model) => model.dataSourceId === args.dataSourceId && model.objectName === peer,
    );
    if (!hasPeer) {
      return {
        error: `No Edge model found for "${peer}". Import or sync that table first.`,
      };
    }
    return {
      error: 'A matching logical relation already exists for this physical constraint.',
    };
  }

  const [association] = associationsFromSuggestions([suggestion]);
  return {
    ...suggestion,
    association,
  };
};

/** Prefer an unused alias when the planned association collides after edits. */
export const ensureUniqueAssociationAlias = (
  association: EdgeModelAssociation,
  existing: ReadonlyArray<Pick<EdgeModelAssociation, 'as'>>,
  targetObjectName: string,
): EdgeModelAssociation => {
  const used = new Set(existing.map((item) => item.as));
  if (!used.has(association.as)) {
    return association;
  }
  return {
    ...association,
    as: suggestAssociationAlias(
      association.kind,
      targetObjectName,
      used,
      association.foreignKey,
    ),
  };
};

export const physicalMatchesAssociation = (args: {
  association: EdgeModelAssociation;
  focusObjectName: string;
  targetObjectName: string;
  relation: SchemaRelationEdge;
}): boolean => {
  if (!supportsPhysicalNatureConversion(args.association.kind)) {
    return false;
  }
  const owner = foreignKeyOwnerForKind(args.association.kind);
  if (owner === 'through') {
    return false;
  }
  if (owner === 'source') {
    return (
      args.relation.fromTable === args.focusObjectName
      && args.relation.fromColumn === args.association.foreignKey
      && args.relation.toTable === args.targetObjectName
    );
  }
  return (
    args.relation.fromTable === args.targetObjectName
    && args.relation.fromColumn === args.association.foreignKey
    && args.relation.toTable === args.focusObjectName
  );
};

export const findAssociationForPhysicalRelation = (args: {
  relation: SchemaRelationEdge;
  focusObjectName: string;
  associations: ReadonlyArray<EdgeModelAssociation>;
  models: ReadonlyArray<Pick<EdgeModelDefinition, 'id' | 'objectName'>>;
}): EdgeModelAssociation | null => {
  for (const association of args.associations) {
    const target = args.models.find((model) => model.id === association.targetModelId);
    if (!target) {
      continue;
    }
    if (physicalMatchesAssociation({
      association,
      focusObjectName: args.focusObjectName,
      targetObjectName: target.objectName,
      relation: args.relation,
    })) {
      return association;
    }
  }
  return null;
};

export const findPhysicalRelationForAssociation = (args: {
  association: EdgeModelAssociation;
  focusObjectName: string;
  targetObjectName: string;
  relations: ReadonlyArray<SchemaRelationEdge>;
}): SchemaRelationEdge | null => (
  args.relations.find((relation) => physicalMatchesAssociation({
    association: args.association,
    focusObjectName: args.focusObjectName,
    targetObjectName: args.targetObjectName,
    relation,
  })) ?? null
);

export const formatReferentialActionLabel = (
  onDelete?: string | null,
  onUpdate?: string | null,
): string | null => {
  const parts: string[] = [];
  if (onDelete?.trim()) {
    parts.push(`ON DELETE ${onDelete.trim()}`);
  }
  if (onUpdate?.trim()) {
    parts.push(`ON UPDATE ${onUpdate.trim()}`);
  }
  return parts.length > 0 ? parts.join(' · ') : null;
};
