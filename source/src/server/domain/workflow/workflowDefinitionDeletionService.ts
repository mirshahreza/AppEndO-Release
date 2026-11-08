import { prisma, fromId, toId } from './prismaHelpers';
import { WorkflowDomainError } from './errors';
import { getWorkflowDefinitionById } from './workflowDefinitionRepository';
import {
  countInstancesByDefinitionId,
  listNonTerminalInstancesByDefinitionId,
} from './workflowInstanceRepository';
import { countWorkflowRevisionsByDefinition } from './workflowRevisionRepository';
import { deleteWorkflowDefinitionOwnedRows } from './workflowCascadeDelete';
import type { WorkflowModel } from './awm/types';

export type WorkflowDeleteImpact = {
  canDelete: boolean;
  isPublished: boolean;
  hasExecutionHistory: boolean;
  instanceCount: number;
  revisionCount: number;
  nonTerminalInstanceCount: number;
  subflowReferencerCount: number;
  subflowReferencers: Array<{ id: number; key: string }>;
  stateVersion: number;
  blockerCode?: string;
  blockerMessage?: string;
};

const modelReferencesDefinition = (
  model: WorkflowModel,
  ownerScopeKey: string,
  targetScopeKey: string,
  targetKey: string,
): boolean => {
  if (!Array.isArray(model.nodes)) {
    return false;
  }
  return model.nodes.some((node) => {
    if (node.kind !== 'SUBFLOW' || !node.workflowDefinitionRef) {
      return false;
    }
    const refScope = node.workflowDefinitionRef.scopeKey ?? ownerScopeKey;
    return refScope === targetScopeKey && node.workflowDefinitionRef.workflowDefinitionKey === targetKey;
  });
};

async function findSubflowReferencers(target: { id: number; scopeKey: string; key: string }): Promise<Array<{ id: number; key: string }>> {
  const definitions = await prisma().workflowDefinition.findMany({
    where: { id: { not: toId(target.id) }, lifecycleStatus: { not: 'ARCHIVED' } },
    select: { id: true, scopeKey: true, key: true, draftDefinitionJson: true },
  });

  const referencers: Array<{ id: number; key: string }> = [];

  for (const definition of definitions) {
    let references = false;

    try {
      const draftModel = JSON.parse(definition.draftDefinitionJson) as WorkflowModel;
      references = modelReferencesDefinition(draftModel, definition.scopeKey, target.scopeKey, target.key);
    } catch {
      references = false;
    }

    if (!references) {
      const revisions = await prisma().workflowRevision.findMany({
        where: { workflowDefinitionId: definition.id },
        select: { definitionJson: true },
        take: 100,
      });
      for (const revision of revisions) {
        try {
          const revisionModel = JSON.parse(revision.definitionJson) as WorkflowModel;
          if (modelReferencesDefinition(revisionModel, definition.scopeKey, target.scopeKey, target.key)) {
            references = true;
            break;
          }
        } catch {
          // Ignore malformed historical JSON — publication validation already guards authoring.
        }
      }
    }

    if (references) {
      referencers.push({ id: fromId(definition.id), key: definition.key });
    }
  }

  return referencers;
}

export async function getWorkflowDeleteImpact(workflowDefinitionId: number): Promise<WorkflowDeleteImpact> {
  const definition = await getWorkflowDefinitionById(workflowDefinitionId);
  if (!definition) {
    throw new WorkflowDomainError('WF_EXEC_STALE_STATE_VERSION', 'WorkflowDefinition not found.', { workflowDefinitionId });
  }

  const isPublished = definition.currentPublishedRevisionId !== null;
  const instanceCount = await countInstancesByDefinitionId(workflowDefinitionId);
  const revisionCount = await countWorkflowRevisionsByDefinition(workflowDefinitionId);
  const nonTerminalInstanceCount = await listNonTerminalInstancesByDefinitionId(workflowDefinitionId).then((rows) => rows.length);
  const subflowReferencers = await findSubflowReferencers(definition);
  const hasExecutionHistory = instanceCount > 0;

  const baseImpact = {
    isPublished,
    hasExecutionHistory,
    instanceCount,
    revisionCount,
    nonTerminalInstanceCount,
    subflowReferencerCount: subflowReferencers.length,
    subflowReferencers,
    stateVersion: definition.stateVersion,
  };

  if (isPublished) {
    return {
      ...baseImpact,
      canDelete: false,
      blockerCode: 'WF_DEF_NOT_STARTABLE',
      blockerMessage: 'Only unpublished workflows can be deleted. Unpublish this workflow first.',
    };
  }

  if (subflowReferencers.length > 0) {
    return {
      ...baseImpact,
      canDelete: false,
      blockerCode: 'WF_DEF_INVALID_REFERENCE',
      blockerMessage: 'Another workflow references this definition in a SUBFLOW node. Remove those references before deleting.',
    };
  }

  return {
    ...baseImpact,
    canDelete: true,
    subflowReferencerCount: 0,
    subflowReferencers: [],
  };
}

async function deleteDefinitionCascade(definitionId: number, expectedDefinitionStateVersion: number): Promise<void> {
  await prisma().$transaction(async (tx) => {
    await deleteWorkflowDefinitionOwnedRows(tx, definitionId, expectedDefinitionStateVersion);
  });
}

export async function deleteWorkflowDefinition(
  workflowDefinitionId: number,
  expectedDefinitionStateVersion: number,
): Promise<void> {
  const impact = await getWorkflowDeleteImpact(workflowDefinitionId);
  if (!impact.canDelete) {
    throw new WorkflowDomainError(
      (impact.blockerCode ?? 'WF_DEF_NOT_STARTABLE') as 'WF_DEF_NOT_STARTABLE',
      impact.blockerMessage ?? 'Workflow cannot be deleted.',
      {
        workflowDefinitionId,
        subflowReferencers: impact.subflowReferencers,
      },
    );
  }

  // Durable cascade delete removes RUNNING/non-terminal rows directly — do not call cancelInstance
  // first (it uses workflowWait.updateMany, which hits SQL Server nullable-UNIQUE limits).
  await deleteDefinitionCascade(workflowDefinitionId, expectedDefinitionStateVersion);
}
