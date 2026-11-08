import React from 'react';
import { useCulture } from '../../../core/culture/CultureContext';
import { columnCommonKey } from '../../../core/culture/translations/cultureKeyHelpers';
import { useMountGridDateFormat } from '../../../app/platform/useMountGridDate';
import type { RoleRecord } from '../types';

export type RoleEditAuditFooterProps = {
  role: Pick<
    RoleRecord,
    | 'created_at'
    | 'created_by'
    | 'created_by_username'
    | 'updated_at'
    | 'updated_by'
    | 'updated_by_username'
  >;
};

const formatActor = (username?: string | null, actorId?: number | null): string => {
  const label = username?.trim() || (actorId != null ? `#${actorId}` : null);
  return label ?? '—';
};

const MetadataItem: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <span className="inline-flex min-w-0 items-baseline gap-1">
    <span className="shrink-0 font-semibold text-slate-500">{label}</span>
    <span className="min-w-0 truncate font-bold text-slate-900" title={value}>{value}</span>
  </span>
);

export const RoleEditAuditFooter: React.FC<RoleEditAuditFooterProps> = ({ role }) => {
  const { t } = useCulture();
  const formatGridDate = useMountGridDateFormat();

  const createdAt = formatGridDate(role.created_at);
  const updatedAt = formatGridDate(role.updated_at);

  return (
    <footer
      className="flex min-h-7 w-full shrink-0 flex-wrap items-center gap-x-3 gap-y-1 px-0 py-1 text-[10px] leading-none select-none"
      aria-label="Role metadata"
    >
      <MetadataItem label={t(columnCommonKey('createdBy'))} value={formatActor(role.created_by_username, role.created_by)} />
      <MetadataItem label={t(columnCommonKey('created'))} value={createdAt} />
      <MetadataItem label={t(columnCommonKey('updatedBy'))} value={formatActor(role.updated_by_username, role.updated_by)} />
      <MetadataItem label={t(columnCommonKey('updated'))} value={updatedAt} />
    </footer>
  );
};
