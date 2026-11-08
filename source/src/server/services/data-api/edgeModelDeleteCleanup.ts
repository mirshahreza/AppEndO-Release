import type { EdgeModelAssociation, EdgeModelDefinition } from '../../../shared/api/contracts/data-api';
import { deleteRecordPolicy, listRecordPoliciesForModel } from '../record-policy/recordPolicyStore';
import { deleteRecordPolicyBinding } from '../record-policy/recordPolicyBindingStore';
import { deleteEdgeApiDefinitionById } from './edgeApiPublisher';
import { listEdgeApiDefinitions } from './edgeApiStore';
import {
  deleteEdgeModel,
  getEdgeModelById,
  listEdgeModels,
  saveEdgeModel,
} from './edgeModelStore';
import {
  parkEdgeModelStudioMeta,
  getEdgeModelStudioMeta,
  upsertEdgeModelStudioMeta,
} from './edgeModelStudioMetaStore';

export type EdgeModelDeleteRelationRef = {
  peerObjectName: string;
  peerModelId: string;
  as: string;
  kind: EdgeModelAssociation['kind'];
  role: 'target' | 'through';
};

export type EdgeModelDeleteRelationImpact = {
  edgeModelId: string | null;
  objectName: string;
  outboundLogicalCount: number;
  outboundAliases: string[];
  inboundRefs: EdgeModelDeleteRelationRef[];
  willParkStudioMeta: boolean;
};

const associationReferencesModel = (
  association: EdgeModelAssociation,
  modelId: string,
): 'target' | 'through' | null => {
  if (association.targetModelId === modelId) {
    return 'target';
  }
  if (
    association.kind === 'belongsToMany'
    && association.throughModelId === modelId
  ) {
    return 'through';
  }
  return null;
};

export const findEdgeModelsForSchemaObject = (args: {
  dataSourceId: string;
  objectName: string;
  objectType: 'TABLE' | 'VIEW';
}): EdgeModelDefinition[] => (
  listEdgeModels().filter((model) => (
    model.dataSourceId === args.dataSourceId
    && model.objectName === args.objectName
    && model.objectType === args.objectType
  ))
);

/** Preview of logical-relation cleanup when a table/view (and its Edge model) is deleted. */
export const collectEdgeModelDeleteRelationImpact = (args: {
  dataSourceId: string;
  objectName: string;
  objectType: 'TABLE' | 'VIEW';
}): EdgeModelDeleteRelationImpact => {
  const focusModels = findEdgeModelsForSchemaObject(args);
  const focus = focusModels[0] ?? null;
  if (!focus) {
    return {
      edgeModelId: null,
      objectName: args.objectName,
      outboundLogicalCount: 0,
      outboundAliases: [],
      inboundRefs: [],
      willParkStudioMeta: false,
    };
  }

  const focusIds = new Set(focusModels.map((model) => model.id));
  const outboundAliases = focus.associations.map((association) => association.as);
  const inboundRefs: EdgeModelDeleteRelationRef[] = [];

  for (const peer of listEdgeModels()) {
    if (peer.dataSourceId !== args.dataSourceId || focusIds.has(peer.id)) {
      continue;
    }
    for (const association of peer.associations) {
      for (const focusId of focusIds) {
        const role = associationReferencesModel(association, focusId);
        if (!role) {
          continue;
        }
        inboundRefs.push({
          peerObjectName: peer.objectName,
          peerModelId: peer.id,
          as: association.as,
          kind: association.kind,
          role,
        });
      }
    }
  }

  inboundRefs.sort((left, right) => {
    const byPeer = left.peerObjectName.localeCompare(right.peerObjectName);
    return byPeer !== 0 ? byPeer : left.as.localeCompare(right.as);
  });

  const studioMeta = getEdgeModelStudioMeta(focus.id);
  const willParkStudioMeta = Boolean(
    studioMeta.columnMeta.length
    || studioMeta.associationMeta.length
    || studioMeta.tags.length
    || Object.keys(studioMeta.extensions).length,
  );

  return {
    edgeModelId: focus.id,
    objectName: focus.objectName,
    outboundLogicalCount: outboundAliases.length,
    outboundAliases: outboundAliases.slice(0, 8),
    inboundRefs,
    willParkStudioMeta,
  };
};

export const deleteOwnedEdgeApisAndPolicies = (modelIds: ReadonlySet<string>): void => {
  if (modelIds.size === 0) {
    return;
  }

  for (const api of listEdgeApiDefinitions()) {
    if (!modelIds.has(api.edgeModelId)) {
      continue;
    }
    try {
      deleteEdgeApiDefinitionById(api.id);
    } catch {
      // Already removed, or unpublish cleaned the functions first.
    }
  }

  for (const modelId of modelIds) {
    for (const policy of listRecordPoliciesForModel(modelId)) {
      deleteRecordPolicy(policy.id);
    }
    deleteRecordPolicyBinding(modelId);
  }
};

export const prunePeerAssociationsForModelIds = (
  focusIds: ReadonlySet<string>,
  dataSourceId: string,
): void => {
  if (focusIds.size === 0) {
    return;
  }

  const now = new Date().toISOString();
  for (const peer of listEdgeModels()) {
    if (peer.dataSourceId !== dataSourceId || focusIds.has(peer.id)) {
      continue;
    }

    const removedIds: string[] = [];
    const nextAssociations = peer.associations.filter((association) => {
      for (const focusId of focusIds) {
        if (associationReferencesModel(association, focusId)) {
          removedIds.push(association.id);
          return false;
        }
      }
      return true;
    });

    if (removedIds.length === 0) {
      continue;
    }

    saveEdgeModel({
      ...peer,
      associations: nextAssociations,
      updated_at: now,
    });

    const studioMeta = getEdgeModelStudioMeta(peer.id);
    const removedKeySet = new Set(removedIds);
    const nextAssociationMeta = studioMeta.associationMeta.filter(
      (entry) => !removedKeySet.has(entry.relationKey),
    );
    if (nextAssociationMeta.length !== studioMeta.associationMeta.length) {
      upsertEdgeModelStudioMeta(peer.id, {
        associationMeta: nextAssociationMeta,
      });
    }
  }
};

export const retargetPeerAssociationsForModelIds = (
  fromIds: ReadonlySet<string>,
  toId: string,
  dataSourceId: string,
): void => {
  if (fromIds.size === 0 || fromIds.has(toId)) {
    return;
  }

  const now = new Date().toISOString();
  for (const peer of listEdgeModels()) {
    if (peer.dataSourceId !== dataSourceId || fromIds.has(peer.id)) {
      continue;
    }

    let changed = false;
    const nextAssociations = peer.associations.map((association) => {
      let next = association;
      if (fromIds.has(association.targetModelId)) {
        next = { ...next, targetModelId: toId };
        changed = true;
      }
      if (association.kind === 'belongsToMany' && association.throughModelId && fromIds.has(association.throughModelId)) {
        next = { ...next, throughModelId: toId };
        changed = true;
      }
      return next;
    });

    if (!changed) {
      continue;
    }

    saveEdgeModel({
      ...peer,
      associations: nextAssociations,
      updated_at: now,
    });
  }
};

/**
 * After DROP TABLE/VIEW: remove matching Edge models, owned APIs/policies, prune peer
 * associations that pointed at them (target/through), prune peer associationMeta, park studio-meta.
 */
export const cleanupEdgeModelsForDeletedSchemaObject = (args: {
  dataSourceId: string;
  objectName: string;
  objectType: 'TABLE' | 'VIEW';
}): EdgeModelDeleteRelationImpact => {
  const impact = collectEdgeModelDeleteRelationImpact(args);
  const focusModels = findEdgeModelsForSchemaObject(args);
  if (focusModels.length === 0) {
    return impact;
  }

  const focusIds = new Set(focusModels.map((model) => model.id));
  deleteOwnedEdgeApisAndPolicies(focusIds);
  prunePeerAssociationsForModelIds(focusIds, args.dataSourceId);

  for (const model of focusModels) {
    parkEdgeModelStudioMeta(model);
    deleteEdgeModel(model.id);
  }

  return {
    ...impact,
    edgeModelId: getEdgeModelById(impact.edgeModelId ?? '') ? impact.edgeModelId : null,
  };
};
