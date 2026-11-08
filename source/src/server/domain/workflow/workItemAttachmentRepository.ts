import { prisma, toId, fromId, toIsoString } from './prismaHelpers';

/** HWF-1.7 — bytes stored in-DB (per user decision 2026-08-30: deliberately not the disk-based `file-manager`/`file-hub` pattern). Caps enforced here in the service layer, not the schema, so limits can be tuned without a migration. */
export const MAX_ATTACHMENT_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_ATTACHMENTS_PER_WORK_ITEM = 10;

export type WorkItemAttachmentMeta = {
  id: number;
  workItemId: number;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  uploadedByUserId: number;
  createdAt: string;
};

export type WorkItemAttachmentWithData = WorkItemAttachmentMeta & { data: Buffer };

const mapMetaRow = (row: { id: bigint; workItemId: bigint; filename: string; mimeType: string; sizeBytes: number; uploadedByUserId: bigint; createdAt: Date }): WorkItemAttachmentMeta => ({
  id: fromId(row.id),
  workItemId: fromId(row.workItemId),
  filename: row.filename,
  mimeType: row.mimeType,
  sizeBytes: row.sizeBytes,
  uploadedByUserId: fromId(row.uploadedByUserId),
  createdAt: toIsoString(row.createdAt)!,
});

export class AttachmentTooLargeError extends Error {}
export class TooManyAttachmentsError extends Error {}

export async function createWorkItemAttachment(input: { workItemId: number; filename: string; mimeType: string; data: Buffer; uploadedByUserId: number }): Promise<WorkItemAttachmentMeta> {
  if (input.data.byteLength > MAX_ATTACHMENT_SIZE_BYTES) {
    throw new AttachmentTooLargeError(`Attachment exceeds the ${MAX_ATTACHMENT_SIZE_BYTES} byte limit.`);
  }
  const existingCount = await prisma().workItemAttachment.count({ where: { workItemId: toId(input.workItemId) } });
  if (existingCount >= MAX_ATTACHMENTS_PER_WORK_ITEM) {
    throw new TooManyAttachmentsError(`Work Item already has the maximum of ${MAX_ATTACHMENTS_PER_WORK_ITEM} attachments.`);
  }
  const row = await prisma().workItemAttachment.create({
    data: {
      workItemId: toId(input.workItemId),
      filename: input.filename,
      mimeType: input.mimeType,
      sizeBytes: input.data.byteLength,
      data: Uint8Array.from(input.data),
      uploadedByUserId: toId(input.uploadedByUserId),
    },
  });
  return mapMetaRow(row);
}

export async function listWorkItemAttachments(workItemId: number): Promise<WorkItemAttachmentMeta[]> {
  const rows = await prisma().workItemAttachment.findMany({
    where: { workItemId: toId(workItemId) },
    select: { id: true, workItemId: true, filename: true, mimeType: true, sizeBytes: true, uploadedByUserId: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });
  return rows.map(mapMetaRow);
}

export async function getWorkItemAttachmentWithData(id: number): Promise<WorkItemAttachmentWithData | null> {
  const row = await prisma().workItemAttachment.findUnique({ where: { id: toId(id) } });
  if (!row) return null;
  return { ...mapMetaRow(row), data: Buffer.from(row.data) };
}

export async function deleteWorkItemAttachment(id: number, workItemId: number): Promise<boolean> {
  const result = await prisma().workItemAttachment.deleteMany({ where: { id: toId(id), workItemId: toId(workItemId) } });
  return result.count > 0;
}
