import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { WorkflowDomainError } from '../domain/workflow/errors';
import { getWorkItemById } from '../domain/workflow/workItemRepository';
import { listWorkItemTransitions } from '../domain/workflow/workItemTransitionRepository';
import { createWorkItemComment, listWorkItemComments, hasUserCommentedOnWorkItem } from '../domain/workflow/workItemCommentRepository';
import { dispatchNotification } from '../services/notifications/notificationDispatch';
import {
  createWorkItemAttachment,
  listWorkItemAttachments,
  getWorkItemAttachmentWithData,
  deleteWorkItemAttachment,
  AttachmentTooLargeError,
  TooManyAttachmentsError,
} from '../domain/workflow/workItemAttachmentRepository';
import { listWorkItemInbox, type WorkItemInboxBucket } from '../domain/workflow/engine/workItemInboxService';
import { isActorEligibleForWorkItem, claimWorkItem, completeWorkItem, reassignWorkItem, resolveWorkItemFormConfig, forwardWorkItem, attachAdHocWorkItem } from '../domain/workflow/engine/workItemService';
import { loadUserRoles } from '../domain/users/prismaHelpers';
import type { JsonValue } from '../domain/workflow/awm/types';
import { handleWorkflowError, handleTransportError, paginateArray, resolvePageSize } from './workflowTransportSupport';

const INBOX_BUCKETS: readonly WorkItemInboxBucket[] = ['MINE_ASSIGNED', 'MINE_CLAIMED', 'AVAILABLE_TO_CLAIM', 'MINE_RECENT'];

type UploadedFile = { originalname: string; mimetype: string; buffer: Buffer };

/**
 * `WorkflowWorkItemService` (doc 02 section 13) — List/Get authorized Work Items (doc 07 section 10
 * Inbox contract), Claim, Complete, Reassign. Any authenticated platform user (`requireAuth`, not
 * `requireRole('ADMIN')`) — Work Item assignment/claim eligibility is a real, already-tested,
 * per-item authorization check (`isActorEligibleForWorkItem` in `workItemService.ts`, doc 07
 * section 2), not a coarse admin gate; Reassign remains an elevated/operator action pending doc 09
 * authorization (documented in `reassignWorkItem`'s own module comment).
 */
export class WorkflowWorkItemsController {
  /** Doc 07 section 10 — four canonical buckets, deterministic default ordering (already applied by the repository), cursor-paginated per doc 10 section 3. `titleText`/`summaryText` only — `inputJson`/`outputJson` are never exposed by `listWorkItemInbox`'s projection. */
  listInbox = asyncHandler(async (req: Request, res: Response) => {
    const bucket = req.query.bucket as WorkItemInboxBucket;
    if (!INBOX_BUCKETS.includes(bucket)) {
      res.status(400).json({ success: false, error: `Invalid bucket. Must be one of: ${INBOX_BUCKETS.join(', ')}.` });
      return;
    }
    const userId = req.auth!.userId;
    const roles = req.auth?.roles && req.auth.roles.length > 0 ? req.auth.roles : await loadUserRoles(userId);
    const pageSize = resolvePageSize(req.query.pageSize);
    const filters = {
      workItemType: typeof req.query.workItemType === 'string' ? req.query.workItemType : undefined,
      priorityMin: req.query.priorityMin !== undefined ? Number(req.query.priorityMin) : undefined,
      priorityMax: req.query.priorityMax !== undefined ? Number(req.query.priorityMax) : undefined,
      overdueOnly: req.query.overdueOnly === 'true',
    };
    const all = await listWorkItemInbox(bucket, { userId, roles }, filters);
    const page = paginateArray(all, req.query.cursor, pageSize);
    res.json({ success: true, items: page.items, nextCursor: page.nextCursor, total: all.length });
  }, 'Failed to list Work Item Inbox.', { onError: handleTransportError });

  /** Doc 07 section 2 — "candidate membership and actor eligibility are revalidated at query" — a caller outside the item's authorized candidates/claimant gets 403, not the raw record. */
  getWorkItem = asyncHandler(async (req: Request, res: Response) => {
    // Note: 404 when the Work Item does not exist; 403 (WF_AUTH_FORBIDDEN) when the caller is
    // authenticated but not a member of this Work Item's candidate/claimant set.
    const workItem = await getWorkItemById(Number(req.params.workItemId));
    if (!workItem) {
      res.status(404).json({ success: false, error: 'WorkItem not found.' });
      return;
    }
    const userId = req.auth!.userId;
    const eligible = await isActorEligibleForWorkItem(workItem, { type: 'USER', id: userId });
    if (!eligible) {
      throw new WorkflowDomainError('WF_AUTH_FORBIDDEN', 'Actor is not authorized to view this Work Item.', { workItemId: workItem.id });
    }
    const formConfig = await resolveWorkItemFormConfig(workItem);
    res.json({ success: true, workItem, formConfig });
  }, 'Failed to load Work Item.', { onError: handleWorkflowError });

  /** HWF-0.3 — surfaces the already-recorded `WorkItemTransition` audit trail (claim/complete/reassign/escalation evidence) to a participant. Same eligibility gate as `getWorkItem`, since transition history reveals the same actor/evidence data as the work item itself. */
  getTransitions = asyncHandler(async (req: Request, res: Response) => {
    const workItem = await getWorkItemById(Number(req.params.workItemId));
    if (!workItem) {
      res.status(404).json({ success: false, error: 'WorkItem not found.' });
      return;
    }
    const userId = req.auth!.userId;
    const eligible = await isActorEligibleForWorkItem(workItem, { type: 'USER', id: userId });
    if (!eligible) {
      throw new WorkflowDomainError('WF_AUTH_FORBIDDEN', 'Actor is not authorized to view this Work Item.', { workItemId: workItem.id });
    }
    const transitions = await listWorkItemTransitions(workItem.id);
    res.json({ success: true, transitions });
  }, 'Failed to load Work Item transitions.', { onError: handleWorkflowError });

  claim = asyncHandler(async (req: Request, res: Response) => {
    // Note: claims the Work Item for the caller. Fails (via WorkflowDomainError) when the caller is
    // not an eligible candidate, or the Work Item is not in an unclaimed OPEN state.
    const workItem = await claimWorkItem({ workItemId: Number(req.params.workItemId), actorUserId: req.auth!.userId });
    res.json({ success: true, workItem });
  }, 'Failed to claim Work Item.', { onError: handleWorkflowError });

  complete = asyncHandler(async (req: Request, res: Response) => {
    // Note: fails when the caller is not the Work Item's current claimant.
    // `outcome` is a required free-form label defined by the workflow's own step config (not a
    // fixed enum, e.g. "APPROVED"/"REJECTED"); `output` is an optional JSON payload, validated
    // against the node's `outputSchema` when one is configured.
    const { outcome, output } = req.body as { outcome: string; output: JsonValue };
    const workItem = await completeWorkItem({ workItemId: Number(req.params.workItemId), actorUserId: req.auth!.userId, outcome, output: output ?? null });
    res.json({ success: true, workItem });
  }, 'Failed to complete Work Item.', { onError: handleWorkflowError });

  /** HWF-2.5 — self-service, any authenticated user; `forwardWorkItem` itself enforces "only the current claimant" — not an ADMIN gate at the route layer. */
  forward = asyncHandler(async (req: Request, res: Response) => {
    const { newAssignment, reasonCode } = req.body as { newAssignment: Parameters<typeof forwardWorkItem>[0]['newAssignment']; reasonCode?: string };
    const workItem = await forwardWorkItem({
      workItemId: Number(req.params.workItemId),
      actorUserId: req.auth!.userId,
      newAssignment,
      reasonCode,
    });
    res.json({ success: true, workItem });
  }, 'Failed to forward Work Item.', { onError: handleWorkflowError });

  /** HWF-3.2 — self-service, any authenticated user; `attachAdHocWorkItem` itself enforces "ADMIN or existing participant on this instance", not a route-level admin gate (see that function's own module comment for why — a route-level admin gate would defeat the whole case-management flexibility this item exists for). */
  attachAdHoc = asyncHandler(async (req: Request, res: Response) => {
    const { workItemType, titleText, summaryText, assignment, allowedOutcomes, input, outputSchema } = req.body as {
      workItemType: string;
      titleText: string;
      summaryText?: string;
      assignment: Parameters<typeof attachAdHocWorkItem>[0]['assignment'];
      allowedOutcomes: string[];
      input?: JsonValue;
      outputSchema?: JsonValue;
    };
    const actorUserId = req.auth!.userId;
    const actorRoles = req.auth?.roles && req.auth.roles.length > 0 ? req.auth.roles : await loadUserRoles(actorUserId);
    const workItem = await attachAdHocWorkItem({
      workflowInstanceId: Number(req.params.instanceId),
      actorUserId,
      actorRoles,
      workItemType,
      titleText,
      summaryText,
      assignment,
      allowedOutcomes,
      input,
      outputSchema,
    });
    res.json({ success: true, workItem });
  }, 'Failed to attach ad-hoc Work Item.', { onError: handleWorkflowError });

  /** HWF-4.1 — access = current `isActorEligibleForWorkItem` eligibility OR "has already commented here" (per user decision 2026-08-30: avoids the circle shrinking to just the claimant the moment someone claims). */
  listComments = asyncHandler(async (req: Request, res: Response) => {
    const workItem = await getWorkItemById(Number(req.params.workItemId));
    if (!workItem) {
      res.status(404).json({ success: false, error: 'WorkItem not found.' });
      return;
    }
    const userId = req.auth!.userId;
    const allowed = (await isActorEligibleForWorkItem(workItem, { type: 'USER', id: userId })) || (await hasUserCommentedOnWorkItem(workItem.id, userId));
    if (!allowed) {
      throw new WorkflowDomainError('WF_AUTH_FORBIDDEN', 'Actor is not authorized to view comments on this Work Item.', { workItemId: workItem.id });
    }
    const comments = await listWorkItemComments(workItem.id);
    res.json({ success: true, comments });
  }, 'Failed to load Work Item comments.', { onError: handleWorkflowError });

  createComment = asyncHandler(async (req: Request, res: Response) => {
    const workItem = await getWorkItemById(Number(req.params.workItemId));
    if (!workItem) {
      res.status(404).json({ success: false, error: 'WorkItem not found.' });
      return;
    }
    const userId = req.auth!.userId;
    const allowed = (await isActorEligibleForWorkItem(workItem, { type: 'USER', id: userId })) || (await hasUserCommentedOnWorkItem(workItem.id, userId));
    if (!allowed) {
      throw new WorkflowDomainError('WF_AUTH_FORBIDDEN', 'Actor is not authorized to comment on this Work Item.', { workItemId: workItem.id });
    }
    const { text, mentionedUserIds } = req.body as { text: string; mentionedUserIds?: number[] };
    if (!text?.trim()) {
      res.status(400).json({ success: false, error: 'text is required.' });
      return;
    }
    const comment = await createWorkItemComment({ workItemId: workItem.id, authorUserId: userId, text: text.trim(), mentionedUserIds });
    for (const mentionedUserId of mentionedUserIds ?? []) {
      if (mentionedUserId === userId) continue;
      await dispatchNotification({
        userId: mentionedUserId,
        title: `Mentioned on "${workItem.titleText}"`,
        body: text.trim(),
        eventType: 'workflow.comment',
        metadata: { workItemId: workItem.id, commentId: comment.id },
      });
    }
    res.json({ success: true, comment });
  }, 'Failed to post Work Item comment.', { onError: handleWorkflowError });

  /** HWF-1.7 — access = same `isActorEligibleForWorkItem` gate as the Work Item itself (per user decision 2026-08-30: stored in-DB, size/count-capped in the repository layer). */
  listAttachments = asyncHandler(async (req: Request, res: Response) => {
    const workItem = await getWorkItemById(Number(req.params.workItemId));
    if (!workItem) {
      res.status(404).json({ success: false, error: 'WorkItem not found.' });
      return;
    }
    const eligible = await isActorEligibleForWorkItem(workItem, { type: 'USER', id: req.auth!.userId });
    if (!eligible) {
      throw new WorkflowDomainError('WF_AUTH_FORBIDDEN', 'Actor is not authorized to view attachments on this Work Item.', { workItemId: workItem.id });
    }
    const attachments = await listWorkItemAttachments(workItem.id);
    res.json({ success: true, attachments });
  }, 'Failed to list Work Item attachments.', { onError: handleWorkflowError });

  uploadAttachment = asyncHandler(async (req: Request, res: Response) => {
    const workItem = await getWorkItemById(Number(req.params.workItemId));
    if (!workItem) {
      res.status(404).json({ success: false, error: 'WorkItem not found.' });
      return;
    }
    const userId = req.auth!.userId;
    const eligible = await isActorEligibleForWorkItem(workItem, { type: 'USER', id: userId });
    if (!eligible) {
      throw new WorkflowDomainError('WF_AUTH_FORBIDDEN', 'Actor is not authorized to attach files to this Work Item.', { workItemId: workItem.id });
    }
    const uploaded = req.file as UploadedFile | undefined;
    if (!uploaded) {
      res.status(400).json({ success: false, error: 'A file is required.' });
      return;
    }
    try {
      const attachment = await createWorkItemAttachment({
        workItemId: workItem.id,
        filename: uploaded.originalname,
        mimeType: uploaded.mimetype,
        data: uploaded.buffer,
        uploadedByUserId: userId,
      });
      res.json({ success: true, attachment });
    } catch (error) {
      if (error instanceof AttachmentTooLargeError || error instanceof TooManyAttachmentsError) {
        res.status(400).json({ success: false, error: error.message });
        return;
      }
      throw error;
    }
  }, 'Failed to upload attachment.', { onError: handleWorkflowError });

  downloadAttachment = asyncHandler(async (req: Request, res: Response) => {
    const workItem = await getWorkItemById(Number(req.params.workItemId));
    if (!workItem) {
      res.status(404).json({ success: false, error: 'WorkItem not found.' });
      return;
    }
    const eligible = await isActorEligibleForWorkItem(workItem, { type: 'USER', id: req.auth!.userId });
    if (!eligible) {
      throw new WorkflowDomainError('WF_AUTH_FORBIDDEN', 'Actor is not authorized to download attachments on this Work Item.', { workItemId: workItem.id });
    }
    const attachment = await getWorkItemAttachmentWithData(Number(req.params.attachmentId));
    if (!attachment || attachment.workItemId !== workItem.id) {
      res.status(404).json({ success: false, error: 'Attachment not found.' });
      return;
    }
    res.setHeader('Content-Type', attachment.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(attachment.filename)}"`);
    res.send(attachment.data);
  }, 'Failed to download attachment.', { onError: handleWorkflowError });

  deleteAttachment = asyncHandler(async (req: Request, res: Response) => {
    const workItem = await getWorkItemById(Number(req.params.workItemId));
    if (!workItem) {
      res.status(404).json({ success: false, error: 'WorkItem not found.' });
      return;
    }
    const eligible = await isActorEligibleForWorkItem(workItem, { type: 'USER', id: req.auth!.userId });
    if (!eligible) {
      throw new WorkflowDomainError('WF_AUTH_FORBIDDEN', 'Actor is not authorized to remove attachments on this Work Item.', { workItemId: workItem.id });
    }
    const deleted = await deleteWorkItemAttachment(Number(req.params.attachmentId), workItem.id);
    res.json({ success: true, deleted });
  }, 'Failed to delete attachment.', { onError: handleWorkflowError });

  /** Elevated/operator action (doc 07 section 6) — same admin-only gate as the runtime operational surface, applied at the route layer (`workflow-work-items.routes.ts`). */
  reassign = asyncHandler(async (req: Request, res: Response) => {
    const { newAssignment, reasonCode } = req.body as { newAssignment: Parameters<typeof reassignWorkItem>[0]['newAssignment']; reasonCode?: string };
    const workItem = await reassignWorkItem({
      workItemId: Number(req.params.workItemId),
      newAssignment,
      actorType: 'USER',
      actorId: req.auth?.userId ?? null,
      reasonCode,
    });
    res.json({ success: true, workItem });
  }, 'Failed to reassign Work Item.', { onError: handleWorkflowError });
}
