import type { ChangeSet } from '../../api/contracts/ai/agentTypes';
import type { ApplicationScopeRef } from '../../api/contracts/appendoo/applicationScope.types';
import type {
  AppEndooSemanticPlan,
  SemanticPlanArtifact,
} from '../../api/contracts/appendoo/semanticPlan.types';

export type BuildSemanticPlanFromChangeSetsInput = {
  changeSets: ChangeSet[];
  userPrompt?: string;
  applicationScope?: ApplicationScopeRef | null;
  contextPackId?: string;
};

const mapChangeSetToArtifact = (changeSet: ChangeSet): SemanticPlanArtifact | null => {
  switch (changeSet.kind) {
    case 'function_source_patch': {
      const patch = changeSet.patch;
      return {
        artifactId: `artifact:reverse:fn:${changeSet.functionId ?? changeSet.id}`,
        kind: 'server_function',
        title: changeSet.title,
        action: patch?.baseFunctionId ? 'modify' : 'create',
        targetRef: changeSet.functionId,
        evidenceIds: [changeSet.id],
      };
    }
    case 'component_layout_patch': {
      const patch = changeSet.patch;
      return {
        artifactId: `artifact:reverse:layout:${changeSet.layoutId ?? changeSet.id}`,
        kind: 'page',
        title: changeSet.title,
        action: patch?.baseLayoutId ? 'modify' : 'create',
        targetRef: changeSet.layoutId,
        evidenceIds: [changeSet.id],
      };
    }
    case 'file_patch':
      return {
        artifactId: `artifact:reverse:file:${changeSet.id}`,
        kind: 'configuration',
        title: changeSet.title,
        action: changeSet.beforeContent !== undefined ? 'modify' : 'create',
        targetRef: changeSet.path,
        evidenceIds: [changeSet.id],
      };
    default:
      return null;
  }
};

/** V4-PATCH-5 P5.1 — reverse ASP audit plan from agent ChangeSets (post-draft, non-blocking). */
export const buildSemanticPlanFromChangeSets = (
  input: BuildSemanticPlanFromChangeSetsInput,
): AppEndooSemanticPlan | null => {
  const artifacts = input.changeSets
    .map(mapChangeSetToArtifact)
    .filter((artifact): artifact is SemanticPlanArtifact => artifact !== null);

  if (artifacts.length === 0) {
    return null;
  }

  const scopeKey = input.applicationScope?.scopeKey ?? 'reverse-audit';
  const contextPackId = input.contextPackId ?? `cp:reverse:${Date.now()}`;
  const now = new Date().toISOString();

  return {
    planId: `asp:reverse:${Date.now()}`,
    revision: 1,
    applicationScopeRef: scopeKey,
    contextPackId,
    objective: input.userPrompt?.trim() || artifacts.map((artifact) => artifact.title).join(' · '),
    scope: scopeKey,
    resolvedTargets: artifacts
      .map((artifact) => artifact.targetRef)
      .filter((target): target is string => Boolean(target?.trim())),
    requirements: [],
    assumptions: ['Reverse audit plan synthesized from agent ChangeSets (V4-PATCH-5 P5.1)'],
    nonGoals: [],
    proposedArtifacts: artifacts,
    artifactModifications: artifacts.filter((artifact) => artifact.action === 'modify'),
    permissions: [],
    requiredCapabilities: [],
    capabilityGaps: [],
    appliedStandards: [],
    selectedPatterns: [],
    acceptanceCriteria: [],
    risks: [],
    conflicts: [],
    createdAt: now,
    authority: 'SCAFFOLD',
    status: 'DRAFT',
    producer: 'reverse_audit',
    blockingIssues: [],
  };
};
