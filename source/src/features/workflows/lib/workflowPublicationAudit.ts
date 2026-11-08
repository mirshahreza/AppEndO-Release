import { formatWorkflowAuditActor, formatWorkflowAuditDateTime } from './workflowAuditMetadata';

export type WorkflowPublicationAudit = {
  isPublished: boolean;
  lastPublishedAt: string | null;
  lastPublishedBy: string | null;
  lastUnpublishedAt: string | null;
  lastUnpublishedBy: string | null;
};

export const buildWorkflowPublicationAudit = (input: {
  isPublished: boolean;
  lastPublishedAt: string | null;
  lastPublishedBy: string | null;
  lastUnpublishedAt: string | null;
  lastUnpublishedBy: string | null;
}): WorkflowPublicationAudit => ({
  isPublished: input.isPublished,
  lastPublishedAt: input.lastPublishedAt,
  lastPublishedBy: input.lastPublishedBy,
  lastUnpublishedAt: input.lastUnpublishedAt,
  lastUnpublishedBy: input.lastUnpublishedBy,
});

export const workflowPublicationStatusItems = (
  audit: WorkflowPublicationAudit,
): Array<{ label: string; by: string; at: string }> => {
  if (audit.isPublished) {
    return [{
      label: 'Published',
      by: formatWorkflowAuditActor(audit.lastPublishedBy),
      at: formatWorkflowAuditDateTime(audit.lastPublishedAt),
    }];
  }

  if (audit.lastUnpublishedAt || audit.lastUnpublishedBy) {
    return [{
      label: 'Unpublished',
      by: formatWorkflowAuditActor(audit.lastUnpublishedBy),
      at: formatWorkflowAuditDateTime(audit.lastUnpublishedAt),
    }];
  }

  return [];
};
