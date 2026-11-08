import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { isDatabaseReachable, bootstrapWorkflowE2eEnvironment, shutdownWorkflowE2eEnvironment, createTestWorkflowDefinition } from '../../../test/workflowE2eTestHarness';
import { createWorkflowDefinition } from '../workflowDefinitionRepository';
import { publishWorkflowDefinition } from '../publication/workflowPublicationService';
import { startWorkflowInstance } from '../engine/startService';
import { dispatchNode } from '../engine/dispatchService';
import { getWorkItemByNodeInstance } from '../workItemRepository';
import { getNodeInstanceByOccurrence } from '../workflowNodeInstanceRepository';
import { registerCoreActionPack } from '../actions/corePack';
import {
  createWorkItemAttachment,
  listWorkItemAttachments,
  getWorkItemAttachmentWithData,
  deleteWorkItemAttachment,
  AttachmentTooLargeError,
  TooManyAttachmentsError,
  MAX_ATTACHMENT_SIZE_BYTES,
  MAX_ATTACHMENTS_PER_WORK_ITEM,
} from '../workItemAttachmentRepository';
import { baseModel, workItemNode, workItemOutcomeEdge, endNode } from '../engine/__tests__/fixtures';

const dbReady = await isDatabaseReachable();
const uniqueKey = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const leaseOwner = 'attachment-worker';

registerCoreActionPack();

async function createRealWorkItem() {
  const model = baseModel({
    nodes: [
      workItemNode('w1', { assignment: { strategy: 'ROLE', roleId: 'DEVELOPER' }, allowedOutcomes: ['DONE'] }),
      endNode('end-1'),
    ],
    edges: [workItemOutcomeEdge('e-w1-end', 'w1', 'end-1', 'DONE')],
    start: { type: 'MANUAL_API', targetNodeKey: 'w1' },
  });
  const definition = await createTestWorkflowDefinition({ key: uniqueKey('attachment'), draftDefinitionJson: JSON.stringify(model) });
  const { revision } = await publishWorkflowDefinition(definition.id, definition.draftVersion);
  const { instance } = await startWorkflowInstance({ workflowRevisionId: revision.id, input: {}, startedByType: 'USER', startedById: 1 });
  const w1Node = await getNodeInstanceByOccurrence(instance.id, 'w1');
  await dispatchNode({ nodeInstanceId: w1Node!.id, leaseOwnerId: leaseOwner });
  return (await getWorkItemByNodeInstance(w1Node!.id))!;
}

describe.skipIf(!dbReady)('WorkItemAttachment repository (HWF-1.7, real DB, in-DB storage)', () => {
  let pool: Awaited<ReturnType<typeof bootstrapWorkflowE2eEnvironment>>['pool'];

  beforeAll(async () => {
    ({ pool } = await bootstrapWorkflowE2eEnvironment());
  });

  afterAll(async () => {
    await shutdownWorkflowE2eEnvironment(pool);
  });

  it('stores and round-trips real file bytes from the DB, byte-for-byte', async () => {
    const workItem = await createRealWorkItem();
    const bytes = Buffer.from('hello attachment world — real bytes, not a mock');
    const meta = await createWorkItemAttachment({ workItemId: workItem.id, filename: 'note.txt', mimeType: 'text/plain', data: bytes, uploadedByUserId: 42 });

    const list = await listWorkItemAttachments(workItem.id);
    expect(list).toHaveLength(1);
    expect(list[0].filename).toBe('note.txt');
    expect(list[0].sizeBytes).toBe(bytes.byteLength);

    const withData = await getWorkItemAttachmentWithData(meta.id);
    expect(withData!.data.equals(bytes)).toBe(true);
  });

  it('rejects a file larger than the configured size cap', async () => {
    const workItem = await createRealWorkItem();
    const oversized = Buffer.alloc(MAX_ATTACHMENT_SIZE_BYTES + 1);
    await expect(createWorkItemAttachment({ workItemId: workItem.id, filename: 'big.bin', mimeType: 'application/octet-stream', data: oversized, uploadedByUserId: 42 })).rejects.toBeInstanceOf(AttachmentTooLargeError);
  });

  it('rejects a new attachment once the per-Work-Item count cap is reached', async () => {
    const workItem = await createRealWorkItem();
    for (let i = 0; i < MAX_ATTACHMENTS_PER_WORK_ITEM; i += 1) {
      await createWorkItemAttachment({ workItemId: workItem.id, filename: `f${i}.txt`, mimeType: 'text/plain', data: Buffer.from('x'), uploadedByUserId: 42 });
    }
    await expect(createWorkItemAttachment({ workItemId: workItem.id, filename: 'one-too-many.txt', mimeType: 'text/plain', data: Buffer.from('x'), uploadedByUserId: 42 })).rejects.toBeInstanceOf(TooManyAttachmentsError);
  });

  it('deletes only when the attachment actually belongs to the given Work Item', async () => {
    const workItemA = await createRealWorkItem();
    const workItemB = await createRealWorkItem();
    const meta = await createWorkItemAttachment({ workItemId: workItemA.id, filename: 'a.txt', mimeType: 'text/plain', data: Buffer.from('x'), uploadedByUserId: 42 });

    const deletedFromWrongWorkItem = await deleteWorkItemAttachment(meta.id, workItemB.id);
    expect(deletedFromWrongWorkItem).toBe(false);

    const deletedFromRightWorkItem = await deleteWorkItemAttachment(meta.id, workItemA.id);
    expect(deletedFromRightWorkItem).toBe(true);
  });
});
