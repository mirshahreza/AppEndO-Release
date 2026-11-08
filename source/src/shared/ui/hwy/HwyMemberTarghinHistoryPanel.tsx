import React from 'react';
import { useQuery } from '@tanstack/react-query';

import { MountGridDateText } from '../../../app/platform/MountGridDateText';
import { useCultureT, useOptionalCulture } from '../../../core/culture/CultureContext';
import type { HwyMemberDossierLabels } from '../../../domain/hwy/hwyMemberDossierLabels';
import { fetchHwyMemberDossierTarghinRequests } from '../../../domain/hwy/hwyMemberDossierSatellites';
import { HWY_MEMBER_TARGHIN_NOTE_BODY_CLASS } from '../../../domain/hwy/hwyMemberTarghinAdminLayout';
import {
  HWY_MEMBER_TARGHIN_REQUEST_STATUS_BADGE_CLASS,
  resolveHwyMemberTarghinRequestStatusPresentation,
} from '../../../domain/hwy/hwyMemberTarghinRequestPresentation';
import { cn } from '../../../lib/utils';
import { APP_TABLE_GRID_STATE_PANEL_CLASS } from '../surfaceClasses';
import {
  resolveHwyListPageGridErrorContent,
  resolveHwyListPageGridLoadingMessage,
} from './hwyListPageGridState';
import { SectionEmptyState } from '../SectionEmptyState';

export type HwyMemberTarghinHistoryPanelProps = {
  memberId: string;
  labels: Pick<
    HwyMemberDossierLabels,
    | 'loading'
    | 'sectionTarghinEmpty'
    | 'emptyValue'
    | 'targhinColumnReason'
    | 'targhinColumnRequestNote'
    | 'targhinColumnFinalReason'
    | 'targhinColumnFinalNote'
    | 'targhinColumnFinalAt'
  >;
  enabled?: boolean;
};

export const HwyMemberTarghinHistoryPanel: React.FC<HwyMemberTarghinHistoryPanelProps> = ({
  memberId,
  labels,
  enabled = true,
}) => {
  const culture = useOptionalCulture();
  const cultureId = culture?.cultureId?.trim() || 'iq';
  const t = useCultureT();

  const query = useQuery({
    queryKey: ['hwy-member-targhin-history', memberId, cultureId],
    queryFn: () => fetchHwyMemberDossierTarghinRequests(memberId, cultureId),
    enabled: enabled && Boolean(memberId.trim()),
  });

  const rows = query.data ?? [];

  if (query.error) {
    return (
      <div className={APP_TABLE_GRID_STATE_PANEL_CLASS}>
        {resolveHwyListPageGridErrorContent(query.error, t)}
      </div>
    );
  }

  if (query.isLoading) {
    return (
      <div className={APP_TABLE_GRID_STATE_PANEL_CLASS}>
        {resolveHwyListPageGridLoadingMessage(t)}
      </div>
    );
  }

  if (rows.length === 0) {
    return <SectionEmptyState>{labels.sectionTarghinEmpty}</SectionEmptyState>;
  }

  return (
    <ul className="flex max-h-[min(28rem,60vh)] flex-col gap-3 overflow-y-auto pe-1">
      {rows.map((row) => {
        const statusPresentation = resolveHwyMemberTarghinRequestStatusPresentation(row.statusCode);
        const statusLabel = t(statusPresentation.labelKey);
        const reasonTitle = row.requestReasonCodeTitle?.trim() || labels.emptyValue;
        const finalReasonTitle = row.finalReasonCodeTitle?.trim();
        return (
          <li
            key={row.id}
            className="rounded-lg border border-slate-200/90 bg-slate-50/40 p-3"
          >
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span
                className={cn(
                  'inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold',
                  HWY_MEMBER_TARGHIN_REQUEST_STATUS_BADGE_CLASS[statusPresentation.tone],
                )}
              >
                {statusLabel}
              </span>
              <span className="text-xs text-slate-500">
                <MountGridDateText value={row.createdAt} align="start" />
              </span>
            </div>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                  {labels.targhinColumnReason}
                </dt>
                <dd className="mt-0.5 text-slate-900">{reasonTitle}</dd>
              </div>
              {row.requestNote?.trim() ? (
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                    {labels.targhinColumnRequestNote}
                  </dt>
                  <dd className={cn('mt-0.5', HWY_MEMBER_TARGHIN_NOTE_BODY_CLASS)}>
                    {row.requestNote.trim()}
                  </dd>
                </div>
              ) : null}
              {finalReasonTitle || row.finalNote?.trim() || row.finalAt ? (
                <div className="border-t border-slate-200/80 pt-2">
                  {finalReasonTitle ? (
                    <div className="mb-2">
                      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                        {labels.targhinColumnFinalReason}
                      </dt>
                      <dd className="mt-0.5 text-slate-900">{finalReasonTitle}</dd>
                    </div>
                  ) : null}
                  {row.finalNote?.trim() ? (
                    <div className="mb-2">
                      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                        {labels.targhinColumnFinalNote}
                      </dt>
                      <dd className={cn('mt-0.5', HWY_MEMBER_TARGHIN_NOTE_BODY_CLASS)}>
                        {row.finalNote.trim()}
                      </dd>
                    </div>
                  ) : null}
                  {row.finalAt ? (
                    <div>
                      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                        {labels.targhinColumnFinalAt}
                      </dt>
                      <dd className="mt-0.5 text-xs text-slate-700">
                        <MountGridDateText value={row.finalAt} align="start" />
                      </dd>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </dl>
          </li>
        );
      })}
    </ul>
  );
};
