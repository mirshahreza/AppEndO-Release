import React from 'react';
import type { ServerFunctionItem } from '../types';
import {
  formatServerFunctionAuditActor,
  formatServerFunctionAuditDateTime,
} from '../lib/serverFunctionAuditMetadata';

export type ServerFunctionWorkspaceMetadataFooterProps = {
  fn: Pick<
    ServerFunctionItem,
    'created_at' | 'created_by' | 'updated_at' | 'updated_by'
  >;
};

const MetadataItem: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <span className="inline-flex min-w-0 items-baseline gap-1">
    <span className="shrink-0 font-semibold text-slate-500">{label}</span>
    <span className="min-w-0 truncate font-bold text-slate-900" title={value}>{value}</span>
  </span>
);

export const ServerFunctionWorkspaceMetadataFooter: React.FC<ServerFunctionWorkspaceMetadataFooterProps> = ({
  fn,
}) => (
  <footer
    className="flex h-7 shrink-0 items-center border-t border-slate-200 bg-slate-50/90 px-3 text-[10px] leading-none select-none"
    aria-label="Server function metadata"
  >
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
      <MetadataItem
        label="Created by"
        value={formatServerFunctionAuditActor(fn.created_by)}
      />
      <MetadataItem
        label="Created at"
        value={formatServerFunctionAuditDateTime(fn.created_at)}
      />
      <MetadataItem
        label="Updated by"
        value={formatServerFunctionAuditActor(fn.updated_by)}
      />
      <MetadataItem
        label="Updated at"
        value={formatServerFunctionAuditDateTime(fn.updated_at)}
      />
    </div>
  </footer>
);
