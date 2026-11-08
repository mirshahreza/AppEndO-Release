import type { ModelCtor } from 'sequelize';
import type { EdgeModelAssociation, EdgeModelDefinition } from '../../../../shared/api/contracts/data-api';
import { listEdgeModels } from '../edgeModelStore';

const associationNeighborIds = (association: EdgeModelAssociation): string[] => {
  if (association.kind === 'belongsToMany') {
    return [association.targetModelId, association.throughModelId];
  }
  return [association.targetModelId];
};

export const sortModelsTopologically = (defs: EdgeModelDefinition[]): EdgeModelDefinition[] => {
  const byId = new Map(defs.map((def) => [def.id, def]));
  const visited = new Set<string>();
  const result: EdgeModelDefinition[] = [];

  const visit = (def: EdgeModelDefinition) => {
    if (visited.has(def.id)) {
      return;
    }
    visited.add(def.id);
    for (const association of def.associations) {
      for (const neighborId of associationNeighborIds(association)) {
        const neighbor = byId.get(neighborId);
        if (neighbor) {
          visit(neighbor);
        }
      }
    }
    result.push(def);
  };

  defs.forEach(visit);
  return result;
};

export const registerModelAssociations = (
  models: Map<string, ModelCtor>,
  defs: EdgeModelDefinition[],
): void => {
  const ordered = sortModelsTopologically(defs);
  for (const def of ordered) {
    const sourceModel = models.get(def.id);
    if (!sourceModel) {
      continue;
    }

    for (const association of def.associations) {
      const targetModel = models.get(association.targetModelId);
      if (!targetModel) {
        continue;
      }

      switch (association.kind) {
        case 'belongsTo':
          sourceModel.belongsTo(targetModel, {
            foreignKey: association.foreignKey,
            as: association.as,
          });
          break;
        case 'hasMany':
          sourceModel.hasMany(targetModel, {
            foreignKey: association.foreignKey,
            as: association.as,
          });
          break;
        case 'hasOne':
          sourceModel.hasOne(targetModel, {
            foreignKey: association.foreignKey,
            as: association.as,
          });
          break;
        case 'belongsToMany': {
          const throughModel = models.get(association.throughModelId);
          if (!throughModel) {
            break;
          }
          sourceModel.belongsToMany(targetModel, {
            through: throughModel,
            foreignKey: association.foreignKey,
            otherKey: association.otherKey,
            as: association.as,
          });
          break;
        }
        default:
          break;
      }
    }
  }
};

export const loadAssociationContext = (
  rootModelId: string,
): { defs: EdgeModelDefinition[]; modelIds: Set<string> } => {
  const all = listEdgeModels();
  const root = all.find((item) => item.id === rootModelId);
  if (!root) {
    return { defs: [], modelIds: new Set() };
  }

  const modelIds = new Set<string>([root.id]);
  const queue = root.associations.flatMap((item) => associationNeighborIds(item));

  while (queue.length > 0) {
    const nextId = queue.shift();
    if (!nextId || modelIds.has(nextId)) {
      continue;
    }
    modelIds.add(nextId);
    const def = all.find((item) => item.id === nextId);
    if (def) {
      queue.push(...def.associations.flatMap((item) => associationNeighborIds(item)));
    }
  }

  return {
    defs: all.filter((item) => modelIds.has(item.id)),
    modelIds,
  };
};
