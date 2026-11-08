import { WorkflowDomainError } from '../errors';
import { getWorkflowDefinitionById } from '../workflowDefinitionRepository';
import { listWorkflowRevisionSummariesByDefinition } from '../workflowRevisionRepository';
import { listWorkflowInstances } from '../workflowInstanceRepository';
import type { WorkflowModel } from '../awm/types';
import { prisma, toId, fromId, toIsoString } from '../prismaHelpers';

const INSTANCE_STATUSES = ['CREATED', 'RUNNING', 'SUSPENDED', 'SUCCEEDED', 'FAILED', 'CANCELLED'] as const;

const resolveAuditUsername = async (userId: number | null): Promise<string | null> => {
  if (userId === null) {
    return null;
  }
  const row = await prisma().baseUser.findUnique({ where: { id: toId(userId) }, select: { username: true } });
  return row?.username ?? null;
};

export type WorkflowDefinitionDossier = {
  definition: {
    id: number;
    scopeKey: string;
    key: string;
    lifecycleStatus: string;
    draftVersion: number;
    isPublished: boolean;
    currentPublishedRevisionId: number | null;
    creationMode: string;
    createdFromDefinitionId: number | null;
    createdFromRevisionId: number | null;
    nodeCount: number;
    edgeCount: number;
    createdAt: string | null;
    createdBy: string | null;
    updatedAt: string | null;
    updatedBy: string | null;
  };
  publicationStatus: {
    isPublished: boolean;
    lastPublishedAt: string | null;
    lastPublishedBy: string | null;
    lastUnpublishedAt: string | null;
    lastUnpublishedBy: string | null;
  };
  publication: {
    revisionNumber: number;
    publishedAt: string | null;
    publishedBy: string | null;
    sourceDraftVersion: number;
  } | null;
  instanceSummary: {
    total: number;
    byStatus: Record<string, number>;
    nonTerminal: number;
  };
  revisions: Array<{
    id: number;
    revisionNumber: number;
    publicationStatus: string;
    bindingStatus: string;
    sourceDraftVersion: number;
    publishedAt: string | null;
    publishedBy: string | null;
    isCurrent: boolean;
    instanceCount: number;
  }>;
  instances: Array<{
    id: number;
    status: string;
    revisionNumber: number;
    workflowRevisionId: number;
    startType: string | null;
    startedByType: string;
    createdAt: string | null;
    updatedAt: string | null;
    nodeCount: number;
    activeNodeCount: number;
    nodes: Array<{ semanticNodeKey: string; status: string }>;
    activeWaitCount: number;
    openWorkItemCount: number;
    traceCount: number;
  }>;
  simulations: Array<{
    id: number;
    status: string;
    mode: string;
    sourceDraftVersion: number | null;
    sourceRevisionId: number | null;
    createdAt: string | null;
    completedAt: string | null;
  }>;
  validationReports: Array<{
    id: number;
    status: string;
    draftVersion: number;
    revisionId: number | null;
    validatorVersion: string;
    issueCount: number;
    createdAt: string | null;
  }>;
};

const countIssues = (issuesJson: string): number => {
  try {
    const parsed = JSON.parse(issuesJson) as unknown;
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
};

const NON_TERMINAL_INSTANCE_STATUSES = new Set(['CREATED', 'RUNNING', 'SUSPENDED']);
const ACTIVE_NODE_STATUSES = new Set(['PENDING', 'READY', 'RUNNING', 'WAITING', 'WAITING_HUMAN', 'RETRYING', 'COMPENSATING']);

/** Read-only 360° dossier for a WorkflowDefinition — every durable fact the Designer needs in one projection. */
export async function loadWorkflowDefinitionDossier(workflowDefinitionId: number): Promise<WorkflowDefinitionDossier> {
  const definition = await getWorkflowDefinitionById(workflowDefinitionId);
  if (!definition) {
    throw new WorkflowDomainError('WF_DEF_STALE_DRAFT_VERSION', 'WorkflowDefinition not found.', { workflowDefinitionId });
  }

  let model: WorkflowModel;
  try {
    const parsed = JSON.parse(definition.draftDefinitionJson) as Partial<WorkflowModel>;
    model = {
      schemaVersion: parsed.schemaVersion ?? '1',
      key: parsed.key ?? definition.key,
      name: parsed.name ?? definition.key,
      description: parsed.description,
      start: parsed.start ?? { type: 'MANUAL_API', targetNodeKey: '' },
      nodes: Array.isArray(parsed.nodes) ? parsed.nodes : [],
      edges: Array.isArray(parsed.edges) ? parsed.edges : [],
      variables: Array.isArray(parsed.variables) ? parsed.variables : [],
      policies: parsed.policies ?? {},
      inputSchema: parsed.inputSchema ?? {},
      outputSchema: parsed.outputSchema ?? {},
    };
  } catch {
    model = {
      schemaVersion: '1',
      key: definition.key,
      name: definition.key,
      start: { type: 'MANUAL_API', targetNodeKey: '' },
      nodes: [],
      edges: [],
      variables: [],
      policies: {},
      inputSchema: {},
      outputSchema: {},
    };
  }

  const [revisions, instances, simulations, validationRows, createdByUsername, updatedByUsername, lastPublishedByUsername, lastUnpublishedByUsername] = await Promise.all([
    listWorkflowRevisionSummariesByDefinition(workflowDefinitionId),
    listWorkflowInstances({ workflowDefinitionId }),
    prisma().workflowSimulationRun.findMany({
      where: { workflowDefinitionId: toId(workflowDefinitionId) },
      orderBy: { createdAt: 'desc' },
      take: 25,
    }),
    prisma().workflowValidationReport.findMany({
      where: { workflowDefinitionId: toId(workflowDefinitionId) },
      orderBy: { createdAt: 'desc' },
      take: 25,
    }),
    resolveAuditUsername(definition.createdBy),
    resolveAuditUsername(definition.updatedBy),
    resolveAuditUsername(definition.lastPublishedBy),
    resolveAuditUsername(definition.lastUnpublishedBy),
  ]);

  const instanceIds = instances.map((instance) => instance.id);
  const revisionInstanceCounts = new Map<number, number>();
  for (const instance of instances) {
    revisionInstanceCounts.set(instance.workflowRevisionId, (revisionInstanceCounts.get(instance.workflowRevisionId) ?? 0) + 1);
  }

  const byStatus: Record<string, number> = Object.fromEntries(INSTANCE_STATUSES.map((status) => [status, 0]));
  for (const instance of instances) {
    byStatus[instance.status] = (byStatus[instance.status] ?? 0) + 1;
  }
  const nonTerminal = instances.filter((instance) => NON_TERMINAL_INSTANCE_STATUSES.has(instance.status)).length;

  const [nodeRows, waitGroups, workItemGroups, traceGroups] = instanceIds.length === 0
    ? [[], [], [], []] as const
    : await Promise.all([
      prisma().workflowNodeInstance.findMany({
        where: { workflowInstanceId: { in: instanceIds.map(toId) } },
        select: { workflowInstanceId: true, semanticNodeKey: true, status: true },
        orderBy: [{ workflowInstanceId: 'desc' }, { semanticNodeKey: 'asc' }],
      }),
      prisma().workflowWait.groupBy({
        by: ['workflowInstanceId'],
        where: { workflowInstanceId: { in: instanceIds.map(toId) }, status: 'ACTIVE' },
        _count: { _all: true },
      }),
      prisma().workItem.groupBy({
        by: ['workflowInstanceId'],
        where: { workflowInstanceId: { in: instanceIds.map(toId) }, status: { in: ['OPEN', 'CLAIMED'] } },
        _count: { _all: true },
      }),
      prisma().workflowTrace.groupBy({
        by: ['workflowInstanceId'],
        where: { workflowInstanceId: { in: instanceIds.map(toId) } },
        _count: { _all: true },
      }),
    ]);

  const nodesByInstanceId = new Map<number, Array<{ semanticNodeKey: string; status: string }>>();
  for (const row of nodeRows) {
    const instanceId = fromId(row.workflowInstanceId);
    const bucket = nodesByInstanceId.get(instanceId) ?? [];
    bucket.push({ semanticNodeKey: row.semanticNodeKey, status: row.status });
    nodesByInstanceId.set(instanceId, bucket);
  }

  const activeWaitsByInstanceId = new Map(waitGroups.map((group) => [fromId(group.workflowInstanceId), group._count._all]));
  const openWorkItemsByInstanceId = new Map(workItemGroups.map((group) => [fromId(group.workflowInstanceId), group._count._all]));
  const tracesByInstanceId = new Map(traceGroups.map((group) => [fromId(group.workflowInstanceId), group._count._all]));

  const currentRevision = definition.currentPublishedRevisionId
    ? revisions.find((revision) => revision.id === definition.currentPublishedRevisionId)
    : undefined;

  const publisherIds = [...new Set(
    revisions
      .map((revision) => revision.createdBy)
      .filter((userId): userId is number => userId !== null),
  )];
  const publisherNames = await Promise.all(
    publisherIds.map(async (userId) => [userId, await resolveAuditUsername(userId)] as const),
  );
  const publisherNameById = new Map(publisherNames);

  const resolvePublisherName = (userId: number | null): string | null =>
    userId === null ? null : publisherNameById.get(userId) ?? null;

  const resolvedLastPublishedBy = lastPublishedByUsername
    ?? (currentRevision?.createdBy != null ? resolvePublisherName(currentRevision.createdBy) : null);

  return {
    definition: {
      id: definition.id,
      scopeKey: definition.scopeKey,
      key: definition.key,
      lifecycleStatus: definition.lifecycleStatus,
      draftVersion: definition.draftVersion,
      isPublished: definition.currentPublishedRevisionId !== null,
      currentPublishedRevisionId: definition.currentPublishedRevisionId,
      creationMode: definition.creationMode,
      createdFromDefinitionId: definition.createdFromDefinitionId,
      createdFromRevisionId: definition.createdFromRevisionId,
      nodeCount: model.nodes.length,
      edgeCount: model.edges.length,
      createdAt: definition.createdAt,
      createdBy: createdByUsername,
      updatedAt: definition.updatedAt,
      updatedBy: updatedByUsername,
    },
    publicationStatus: {
      isPublished: definition.currentPublishedRevisionId !== null,
      lastPublishedAt: definition.lastPublishedAt ?? currentRevision?.publishedAt ?? null,
      lastPublishedBy: resolvedLastPublishedBy,
      lastUnpublishedAt: definition.lastUnpublishedAt,
      lastUnpublishedBy: lastUnpublishedByUsername,
    },
    publication: currentRevision
      ? {
          revisionNumber: currentRevision.revisionNumber,
          publishedAt: currentRevision.publishedAt,
          publishedBy: resolvedLastPublishedBy,
          sourceDraftVersion: currentRevision.sourceDraftVersion,
        }
      : null,
    instanceSummary: {
      total: instances.length,
      byStatus,
      nonTerminal,
    },
    revisions: revisions.map((revision) => ({
      id: revision.id,
      revisionNumber: revision.revisionNumber,
      publicationStatus: revision.publicationStatus,
      bindingStatus: revision.bindingStatus,
      sourceDraftVersion: revision.sourceDraftVersion,
      publishedAt: revision.publishedAt,
      publishedBy: resolvePublisherName(revision.createdBy),
      isCurrent: definition.currentPublishedRevisionId === revision.id,
      instanceCount: revisionInstanceCounts.get(revision.id) ?? 0,
    })),
    instances: instances.map((instance) => {
      const nodes = nodesByInstanceId.get(instance.id) ?? [];
      const activeNodeCount = nodes.filter((node) => ACTIVE_NODE_STATUSES.has(node.status)).length;
      return {
        id: instance.id,
        status: instance.status,
        revisionNumber: instance.revisionNumber,
        workflowRevisionId: instance.workflowRevisionId,
        startType: instance.startType,
        startedByType: instance.startedByType,
        createdAt: instance.createdAt,
        updatedAt: instance.updatedAt,
        nodeCount: nodes.length,
        activeNodeCount,
        nodes,
        activeWaitCount: activeWaitsByInstanceId.get(instance.id) ?? 0,
        openWorkItemCount: openWorkItemsByInstanceId.get(instance.id) ?? 0,
        traceCount: tracesByInstanceId.get(instance.id) ?? 0,
      };
    }),
    simulations: simulations.map((run) => ({
      id: fromId(run.id),
      status: run.status,
      mode: run.mode,
      sourceDraftVersion: run.sourceDraftVersion,
      sourceRevisionId: run.sourceRevisionId !== null ? fromId(run.sourceRevisionId) : null,
      createdAt: toIsoString(run.createdAt),
      completedAt: toIsoString(run.completedAt),
    })),
    validationReports: validationRows.map((report) => ({
      id: fromId(report.id),
      status: report.status,
      draftVersion: report.draftVersion,
      revisionId: report.revisionId !== null ? fromId(report.revisionId) : null,
      validatorVersion: report.validatorVersion,
      issueCount: countIssues(report.issuesJson),
      createdAt: toIsoString(report.createdAt),
    })),
  };
}
