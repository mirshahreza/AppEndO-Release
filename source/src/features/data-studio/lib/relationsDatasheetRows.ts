import type { EdgeModelAssociation, EdgeModelDefinition } from '../../../shared/api/contracts/data-api';
import type { SchemaRelationEdge } from '../../../shared/api/contracts/data-sources/schemaRelations';
import {
  associationKindLabel,
  isBelongsToManyAssociation,
  isPhysicalFkCoveredByBelongsToMany,
} from './edgeModelAssociations';
import {
  findAssociationForPhysicalRelation,
  formatReferentialActionLabel,
} from './relationNatureConversion';

export type RelationsDatasheetRow =
  | {
    key: string;
    nature: 'physical';
    name: string;
    kindLabel: string;
    cascadeLabel: string | null;
    fromLabel: string;
    toLabel: string;
    relation: SchemaRelationEdge;
  }
  | {
    key: string;
    nature: 'logical';
    name: string;
    kindLabel: string;
    cascadeLabel: string | null;
    fromLabel: string;
    toLabel: string;
    association: EdgeModelAssociation;
  }
  | {
    key: string;
    nature: 'both';
    name: string;
    kindLabel: string;
    cascadeLabel: string | null;
    fromLabel: string;
    toLabel: string;
    relation: SchemaRelationEdge;
    association: EdgeModelAssociation;
  };

const endpointLabel = (table: string, column: string) => `${table}.${column}`;

/** Merge physical/logical twins into one row (same as the relations diagram). */
export const buildRelationsDatasheetRows = (args: {
  objectName: string;
  physicalRelations: ReadonlyArray<SchemaRelationEdge>;
  associations: ReadonlyArray<EdgeModelAssociation>;
  peerModels: ReadonlyArray<Pick<EdgeModelDefinition, 'id' | 'objectName' | 'labels'>>;
}): RelationsDatasheetRow[] => {
  const modelById = new Map(
    args.peerModels.map((model) => [model.id, model] as const),
  );
  const matchedAssociationIds = new Set<string>();
  const rows: RelationsDatasheetRow[] = [];

  for (const relation of args.physicalRelations) {
    if (isPhysicalFkCoveredByBelongsToMany({
      relation,
      focusObjectName: args.objectName,
      associations: args.associations,
      models: args.peerModels,
    })) {
      continue;
    }

    const association = findAssociationForPhysicalRelation({
      relation,
      focusObjectName: args.objectName,
      associations: args.associations,
      models: args.peerModels,
    });
    const cascadeLabel = formatReferentialActionLabel(relation.onDelete, relation.onUpdate);
    const fromLabel = endpointLabel(relation.fromTable, relation.fromColumn);
    const toLabel = endpointLabel(relation.toTable, relation.toColumn);
    const physicalKey = `physical:${relation.fromTable}.${relation.fromColumn}->${relation.toTable}.${relation.toColumn}:${relation.constraintName ?? ''}`;

    if (association) {
      matchedAssociationIds.add(association.id);
      rows.push({
        key: `both:${association.id}:${physicalKey}`,
        nature: 'both',
        name: association.as,
        kindLabel: associationKindLabel(association.kind),
        cascadeLabel,
        fromLabel,
        toLabel,
        relation,
        association,
      });
      continue;
    }

    // Physical FK alone: outbound (focus holds FK) → Belongs to; inbound → Has many.
    const physicalKind = relation.fromTable === args.objectName ? 'belongsTo' : 'hasMany';
    rows.push({
      key: physicalKey,
      nature: 'physical',
      name: relation.constraintName?.trim() || `${relation.fromColumn} → ${relation.toColumn}`,
      kindLabel: associationKindLabel(physicalKind),
      cascadeLabel,
      fromLabel,
      toLabel,
      relation,
    });
  }

  for (const association of args.associations) {
    if (matchedAssociationIds.has(association.id)) {
      continue;
    }
    const target = modelById.get(association.targetModelId);
    const targetLabel = target?.labels.title || target?.objectName || association.targetModelId;
    if (isBelongsToManyAssociation(association)) {
      const through = modelById.get(association.throughModelId);
      const throughLabel = through?.labels.title || through?.objectName || association.throughModelId;
      rows.push({
        key: `logical:${association.id}`,
        nature: 'logical',
        name: association.as,
        kindLabel: associationKindLabel(association.kind),
        cascadeLabel: null,
        fromLabel: `${args.objectName} · via ${throughLabel}.${association.foreignKey}`,
        toLabel: `${targetLabel} · via ${throughLabel}.${association.otherKey}`,
        association,
      });
      continue;
    }
    rows.push({
      key: `logical:${association.id}`,
      nature: 'logical',
      name: association.as,
      kindLabel: associationKindLabel(association.kind),
      cascadeLabel: null,
      fromLabel: args.objectName,
      toLabel: `${targetLabel} · ${association.foreignKey}`,
      association,
    });
  }

  return rows.sort((left, right) => left.name.localeCompare(right.name));
};
