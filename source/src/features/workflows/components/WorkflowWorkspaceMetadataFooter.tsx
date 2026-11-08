import React from 'react';
import {
  formatWorkflowAuditActor,
  formatWorkflowAuditDateTime,
} from '../lib/workflowAuditMetadata';
import type { WorkflowPublicationAudit } from '../lib/workflowPublicationAudit';
import { workflowPublicationStatusItems } from '../lib/workflowPublicationAudit';

export type WorkflowWorkspaceMetadataFooterProps = {
  createdAt: string | null;
  createdBy: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
  publicationStatus: WorkflowPublicationAudit;
};

const MetadataItem: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <span className="inline-flex min-w-0 items-baseline gap-1">
    <span className="shrink-0 font-semibold text-slate-500">{label}</span>
    <span className="min-w-0 truncate font-bold text-slate-900" title={value}>{value}</span>
  </span>
);

export const WorkflowWorkspaceMetadataFooter: React.FC<WorkflowWorkspaceMetadataFooterProps> = ({
  createdAt,
  createdBy,
  updatedAt,
  updatedBy,
  publicationStatus,
}) => {
  const publicationItems = workflowPublicationStatusItems(publicationStatus);

  return (
    <footer
      className="flex min-h-7 shrink-0 items-center border-t border-slate-200 bg-slate-50/90 px-3 py-1 text-[10px] leading-none select-none"
      aria-label="Workflow metadata"
    >
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
        <MetadataItem label="Created by" value={formatWorkflowAuditActor(createdBy)} />
        <MetadataItem label="Created at" value={formatWorkflowAuditDateTime(createdAt)} />
        <MetadataItem label="Updated by" value={formatWorkflowAuditActor(updatedBy)} />
        <MetadataItem label="Updated at" value={formatWorkflowAuditDateTime(updatedAt)} />
        {publicationItems.map((item) => (
          <React.Fragment key={item.label}>
            <MetadataItem label={`${item.label} by`} value={item.by} />
            <MetadataItem label={`${item.label} at`} value={item.at} />
          </React.Fragment>
        ))}
      </div>
    </footer>
  );
};
