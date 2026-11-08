import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { WorkflowDomainError } from '../domain/workflow/errors';
import { getWorkflowDefinitionById } from '../domain/workflow/workflowDefinitionRepository';
import { getWorkflowRevisionById } from '../domain/workflow/workflowRevisionRepository';
import { startWorkflowInstance } from '../domain/workflow/engine/startService';
import { listWorkflowInstances } from '../domain/workflow/workflowInstanceRepository';
import type { WorkflowInstanceStatus } from '../domain/workflow/transitions';
import {
  suspendInstance,
  resumeInstance,
  cancelInstance,
  retryEligibleNodeNow,
  forceNewInvocationForNode,
  inspectInstance,
} from '../domain/workflow/engine/operationalCommands';
import type { JsonValue } from '../domain/workflow/awm/types';
import { handleWorkflowError, handleTransportError, paginateArray, resolvePageSize, actorFromRequest } from './workflowTransportSupport';
import { rotateWebhookSecret, getWebhookBindingForDefinition } from '../services/workflow/webhookSecretService';
import { listDeadLetters, getDeadLetterById, resolveDeadLetter, type WorkflowDeadLetterStatus } from '../domain/workflow/workflowDeadLetterRepository';
import { listWorkItemSlaViolations } from '../domain/workflow/engine/workItemSlaService';

const INSTANCE_STATUSES: readonly WorkflowInstanceStatus[] = ['CREATED', 'RUNNING', 'SUSPENDED', 'SUCCEEDED', 'FAILED', 'CANCELLED'];

/**
 * `WorkflowRuntimeService` (doc 02 section 13) — Start, Suspend, Resume, Cancel, RetryFailedNode,
 * ForceNewInvocation, InspectInstance. None of these had a transport before Slice 12; Slice 11 only
 * covered the Designer/authoring surface. This is the platform-internal, admin-authenticated
 * Native/API start surface required by the Engine Independence Gate (doc 11 section 2, "native/API
 * start" MUST work) — not doc 10's external third-party contract, which Slice 12's Repository
 * Reality Audit found has no canonical API-versioning or external-identity primitive to build on
 * (see `docs/standards/workflow-engine-testing.md`). Every handler here is a thin delegate to an
 * already-tested `engine/` authority, matching doc 02 section 13.
 */

export class WorkflowRuntimeController {
  /** Operations Cockpit "Instances" list — new transport, no prior slice had a broad instance list (only single-id Inspect). Cursor-paginated per doc 10 section 3, same shape as `ListDefinitions`/`ListRevisions`/Work Item Inbox. */
  listInstances = asyncHandler(async (req: Request, res: Response) => {
    const status = typeof req.query.status === 'string' && (INSTANCE_STATUSES as readonly string[]).includes(req.query.status)
      ? (req.query.status as WorkflowInstanceStatus)
      : undefined;
    const workflowDefinitionId = req.query.workflowDefinitionId !== undefined ? Number(req.query.workflowDefinitionId) : undefined;
    const pageSize = resolvePageSize(req.query.pageSize);
    const all = await listWorkflowInstances({ status, workflowDefinitionId });
    const page = paginateArray(all, req.query.cursor, pageSize);
    res.json({ success: true, instances: page.items, nextCursor: page.nextCursor });
  }, 'Failed to list Workflow instances.', { onError: handleTransportError });

  /** `Start` (doc 06 section 3) — resolves the definition's current published startable revision; a future caller needing a specific pinned revision uses `POST /revisions/:revisionId/start` instead. */
  start = asyncHandler(async (req: Request, res: Response) => {
    const definitionId = Number(req.params.definitionId);
    const { input, startType } = req.body as { input: JsonValue; startType?: string };
    const definition = await getWorkflowDefinitionById(definitionId);
    if (!definition) {
      res.status(404).json({ success: false, error: 'WorkflowDefinition not found.' });
      return;
    }
    if (definition.currentPublishedRevisionId === null) {
      throw new WorkflowDomainError('WF_DEF_NOT_STARTABLE', 'WorkflowDefinition has no current published revision.', { definitionId });
    }
    const revision = await getWorkflowRevisionById(definition.currentPublishedRevisionId);
    if (!revision) {
      throw new WorkflowDomainError('WF_DEF_NOT_STARTABLE', 'Pinned current published revision not found.', { definitionId });
    }
    // `startWorkflowInstance` itself authoritatively enforces doc 05 section 14 (startable binding
    // state AND an ACTIVE owning definition lifecycle) — no separate pre-check needed here.
    const result = await startWorkflowInstance({
      workflowRevisionId: revision.id,
      input: input ?? null,
      startedByType: 'USER',
      startedById: req.auth?.userId ?? null,
      startType: startType ?? 'MANUAL_API',
    });
    res.json({ success: true, instance: result.instance, nodeInstances: result.nodeInstances });
  }, 'Failed to start Workflow instance.', { onError: handleWorkflowError });

  /** `POST /revisions/:revisionId/start` — starts an exact pinned revision (doc 03 section 3 immutable revision/pinning), bypassing "current published" resolution. */
  startOnRevision = asyncHandler(async (req: Request, res: Response) => {
    const revisionId = Number(req.params.revisionId);
    const { input, startType } = req.body as { input: JsonValue; startType?: string };
    const revision = await getWorkflowRevisionById(revisionId);
    if (!revision) {
      res.status(404).json({ success: false, error: 'WorkflowRevision not found.' });
      return;
    }
    const result = await startWorkflowInstance({
      workflowRevisionId: revision.id,
      input: input ?? null,
      startedByType: 'USER',
      startedById: req.auth?.userId ?? null,
      startType: startType ?? 'MANUAL_API',
    });
    res.json({ success: true, instance: result.instance, nodeInstances: result.nodeInstances });
  }, 'Failed to start Workflow instance on revision.', { onError: handleWorkflowError });

  suspend = asyncHandler(async (req: Request, res: Response) => {
    const { expectedStateVersion } = req.body as { expectedStateVersion: number };
    const instance = await suspendInstance(Number(req.params.instanceId), Number(expectedStateVersion));
    res.json({ success: true, instance });
  }, 'Failed to suspend Workflow instance.', { onError: handleWorkflowError });

  resume = asyncHandler(async (req: Request, res: Response) => {
    const { expectedStateVersion } = req.body as { expectedStateVersion: number };
    const instance = await resumeInstance(Number(req.params.instanceId), Number(expectedStateVersion));
    res.json({ success: true, instance });
  }, 'Failed to resume Workflow instance.', { onError: handleWorkflowError });

  cancel = asyncHandler(async (req: Request, res: Response) => {
    const { expectedStateVersion } = req.body as { expectedStateVersion: number };
    await cancelInstance(Number(req.params.instanceId), Number(expectedStateVersion));
    res.json({ success: true });
  }, 'Failed to cancel Workflow instance.', { onError: handleWorkflowError });

  retryNode = asyncHandler(async (req: Request, res: Response) => {
    const { expectedStateVersion } = req.body as { expectedStateVersion: number };
    const node = await retryEligibleNodeNow(Number(req.params.nodeInstanceId), Number(expectedStateVersion));
    res.json({ success: true, node });
  }, 'Failed to retry Workflow node.', { onError: handleWorkflowError });

  forceNewInvocation = asyncHandler(async (req: Request, res: Response) => {
    const { leaseOwnerId, acknowledgeDuplicateEffectRisk } = req.body as { leaseOwnerId: string; acknowledgeDuplicateEffectRisk: boolean };
    const result = await forceNewInvocationForNode({ nodeInstanceId: Number(req.params.nodeInstanceId), leaseOwnerId, acknowledgeDuplicateEffectRisk: Boolean(acknowledgeDuplicateEffectRisk) });
    res.json({ success: true, result });
  }, 'Failed to force new invocation.', { onError: handleWorkflowError });

  inspect = asyncHandler(async (req: Request, res: Response) => {
    const result = await inspectInstance(Number(req.params.instanceId));
    res.json({ success: true, ...result });
  }, 'Failed to inspect Workflow instance.', { onError: handleWorkflowError });

  /** p-68 WHOOK Part A — admin-only: (re)generate this definition's webhook secret. Always rotates; the raw secret is returned exactly once and never persisted. Requires an existing published revision. */
  rotateWebhookSecret = asyncHandler(async (req: Request, res: Response) => {
    const definitionId = Number(req.params.definitionId);
    const definition = await getWorkflowDefinitionById(definitionId);
    if (!definition) {
      res.status(404).json({ success: false, error: 'WorkflowDefinition not found.' });
      return;
    }
    if (definition.currentPublishedRevisionId === null) {
      throw new WorkflowDomainError('WF_DEF_NOT_STARTABLE', 'WorkflowDefinition has no current published revision — publish it before generating a webhook URL.', { definitionId });
    }
    const rawSecret = await rotateWebhookSecret(definitionId, definition.currentPublishedRevisionId, req.auth?.userId ?? null);
    res.json({ success: true, token: rawSecret });
  }, 'Failed to rotate webhook secret.', { onError: handleWorkflowError });

  /** p-68 WHOOK Part A — admin-only: whether a webhook binding exists/is enabled. Never returns the raw secret (only known once, at rotation time) or the hash. */
  webhookSecretStatus = asyncHandler(async (req: Request, res: Response) => {
    const definitionId = Number(req.params.definitionId);
    const binding = await getWebhookBindingForDefinition(definitionId);
    res.json({
      success: true,
      configured: Boolean(binding),
      enabled: binding?.enabled ?? false,
      rotatedAt: binding?.rotatedAt ?? null,
    });
  }, 'Failed to read webhook secret status.', { onError: handleWorkflowError });

  /** WFV2-12 — operator dead-letter inbox for unhandled instance failures. */
  listDeadLetters = asyncHandler(async (req: Request, res: Response) => {
    const status = typeof req.query.status === 'string' ? (req.query.status as WorkflowDeadLetterStatus) : undefined;
    if (status && !['OPEN', 'RESOLVED', 'DISCARDED'].includes(status)) {
      res.status(400).json({ success: false, error: 'Invalid status. Must be OPEN, RESOLVED, or DISCARDED.' });
      return;
    }
    const items = await listDeadLetters({ status });
    const page = paginateArray(items, req.query.cursor, resolvePageSize(req.query.pageSize));
    res.json({ success: true, items: page.items, nextCursor: page.nextCursor, total: items.length });
  }, 'Failed to list dead letters.', { onError: handleTransportError });

  getDeadLetter = asyncHandler(async (req: Request, res: Response) => {
    const item = await getDeadLetterById(Number(req.params.deadLetterId));
    if (!item) {
      res.status(404).json({ success: false, error: 'Dead letter not found.' });
      return;
    }
    res.json({ success: true, item });
  }, 'Failed to get dead letter.', { onError: handleTransportError });

  resolveDeadLetter = asyncHandler(async (req: Request, res: Response) => {
    const body = req.body as {
      expectedStateVersion?: number;
      resolution?: 'RESOLVED' | 'DISCARDED';
      resolutionNote?: string | null;
    };
    if (body.resolution !== 'RESOLVED' && body.resolution !== 'DISCARDED') {
      res.status(400).json({ success: false, error: 'resolution must be RESOLVED or DISCARDED.' });
      return;
    }
    if (typeof body.expectedStateVersion !== 'number') {
      res.status(400).json({ success: false, error: 'expectedStateVersion is required.' });
      return;
    }
    const actor = actorFromRequest(req);
    const item = await resolveDeadLetter({
      deadLetterId: Number(req.params.deadLetterId),
      expectedStateVersion: body.expectedStateVersion,
      resolution: body.resolution,
      resolvedByUserId: actor.id,
      resolutionNote: body.resolutionNote ?? null,
    });
    res.json({ success: true, item });
  }, 'Failed to resolve dead letter.', { onError: handleWorkflowError });

  /** HWF-4.5 — SLA Violations dashboard: still-open-and-overdue Work Items (unbounded) plus recently-completed-late ones (bounded window, default 30 days). */
  listSlaViolations = asyncHandler(async (req: Request, res: Response) => {
    const recentCompletedWindowMs = req.query.recentCompletedWindowMs !== undefined ? Number(req.query.recentCompletedWindowMs) : undefined;
    const items = await listWorkItemSlaViolations(recentCompletedWindowMs);
    res.json({ success: true, items });
  }, 'Failed to list SLA violations.', { onError: handleTransportError });
}
