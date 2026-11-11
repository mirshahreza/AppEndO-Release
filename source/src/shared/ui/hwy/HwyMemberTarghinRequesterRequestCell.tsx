import React, { useLayoutEffect, useRef, useState } from 'react';
import { Maximize2 } from 'lucide-react';

import { MountGridDateText } from '../../../app/platform/MountGridDateText';
import { useCulture } from '../../../core/culture/CultureContext';
import type { HwyMemberTarghinAdminMemberFace } from '../../../domain/hwy/hwyMemberTarghinAdmin';
import { resolveTarghinRowFaceDossierMemberId } from '../../../domain/hwy/hwyMemberTarghinAdmin';
import {
  HWY_MEMBER_TARGHIN_ADMIN_REQUEST_PREVIEW_MAX_CLASS,
  HWY_MEMBER_TARGHIN_NOTE_BODY_CLASS,
  HWY_MEMBER_TARGHIN_NOTE_GRID_CLAMP_CLASS,
  hwyMemberTarghinAdminRequesterRequestGridTemplateColumns,
} from '../../../domain/hwy/hwyMemberTarghinAdminLayout';
import { cn } from '../../../lib/utils';
import { catalogTextLinkSkyAppliedStateClass } from '../catalog/catalogInteractionApplied';
import type { CatalogInteractionPreviewProps } from '../catalog/catalogInteractionState';
import { CATALOG_INTERACTION_MARKER_TEXT_LINK } from '../catalog/catalogInteractionState';
import { HwyMemberTarghinRequestDetailDialog } from './HwyMemberTarghinRequestDetailDialog';
import { HwyTarghinDossierFaceLink } from './HwyTarghinDossierFaceLink';
import { HwyTarghinMemberFace } from './HwyTarghinMemberFace';

const INNER_GRID_CLASS = 'grid w-full min-w-0 gap-3';

const TARGHIN_REQUEST_VIEW_FULL_LINK_CLASS = cn(
  'inline-flex max-w-full items-center gap-1 self-start border-0 bg-transparent p-0 text-start text-[11px] font-medium leading-none text-sky-700 underline-offset-2',
  'hover:text-sky-800 hover:underline active:text-sky-900 active:underline',
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-sky-500',
  CATALOG_INTERACTION_MARKER_TEXT_LINK,
);

export { HWY_TARGHIN_DOSSIER_FACE_LINK_CLASS } from './HwyTarghinDossierFaceLink';

const requesterRequestGridStyle: React.CSSProperties = {
  gridTemplateColumns: hwyMemberTarghinAdminRequesterRequestGridTemplateColumns,
};

export type HwyMemberTarghinRequesterRequestHeaderProps = {
  requesterLabel: React.ReactNode;
  requestLabel: React.ReactNode;
  className?: string;
};

/** Table header: two stacked titles (legacy HWY_Members_TarghinHistory_List parity). */
export const HwyMemberTarghinRequesterRequestHeader: React.FC<HwyMemberTarghinRequesterRequestHeaderProps> = ({
  requesterLabel,
  requestLabel,
  className,
}) => {
  const { direction } = useCulture();
  return (
  <div
    className={cn('flex min-w-0 flex-col gap-1 text-start leading-snug', className)}
    dir={direction}
  >
    <span className="min-w-0 font-semibold">{requesterLabel}</span>
    <span className="min-w-0 border-t border-slate-200/90 pt-1 font-semibold">{requestLabel}</span>
  </div>
  );
};

export type HwyMemberTarghinAdminRequestPreviewProps = {
  createdAt: string;
  requestReasonCodeTitle?: string | null;
  requestNote?: string | null;
};

export const HwyMemberTarghinAdminRequestPreview: React.FC<HwyMemberTarghinAdminRequestPreviewProps> = ({
  createdAt,
  requestReasonCodeTitle,
  requestNote,
}) => {
  const culture = useCulture();
  const t = (key: string, fallback: string) => {
    const value = culture.t(key, { missing: 'silent' });
    return value && value !== key ? value : fallback;
  };
  const previewRef = useRef<HTMLDivElement>(null);
  const [truncated, setTruncated] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const reason = requestReasonCodeTitle?.trim();
  const note = requestNote?.trim();

  useLayoutEffect(() => {
    const el = previewRef.current;
    if (!el) {
      return undefined;
    }
    const measure = () => {
      setTruncated(el.scrollHeight > el.clientHeight + 1);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [createdAt, reason, note]);

  return (
    <>
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="relative min-w-0">
          <div
            ref={previewRef}
            className={cn('min-w-0 space-y-0.5', HWY_MEMBER_TARGHIN_ADMIN_REQUEST_PREVIEW_MAX_CLASS)}
          >
            <div className="text-xs font-semibold leading-tight text-slate-800">
              <MountGridDateText value={createdAt} align="start" />
            </div>
            <div
              className={cn(
                'text-xs font-semibold leading-[1.15] text-rose-700',
                HWY_MEMBER_TARGHIN_NOTE_GRID_CLAMP_CLASS,
              )}
            >
              {reason || '—'}
            </div>
            {note ? (
              <p
                className={cn(
                  HWY_MEMBER_TARGHIN_NOTE_BODY_CLASS,
                  'leading-[1.15]',
                  HWY_MEMBER_TARGHIN_NOTE_GRID_CLAMP_CLASS,
                )}
              >
                {note}
              </p>
            ) : null}
          </div>
          {truncated ? (
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-white to-transparent"
              aria-hidden
            />
          ) : null}
        </div>
        {truncated ? (
          <>
            <button
              type="button"
              className={TARGHIN_REQUEST_VIEW_FULL_LINK_CLASS}
              onClick={() => setDialogOpen(true)}
            >
              <Maximize2 className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
              <span className="truncate">{t('hwy.targhinAdmin.request.viewFull', 'View full request')}</span>
            </button>
            <div
              className="h-1.5 w-full bg-gradient-to-b from-white to-transparent"
              aria-hidden
            />
          </>
        ) : null}
      </div>
      <HwyMemberTarghinRequestDetailDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        createdAt={createdAt}
        requestReasonCodeTitle={requestReasonCodeTitle}
        requestNote={requestNote}
      />
    </>
  );
};

export type HwyMemberTarghinRequesterRequestCellProps = CatalogInteractionPreviewProps & {
  requester: HwyMemberTarghinAdminMemberFace | null;
  createdAt: string;
  requestReasonCodeTitle?: string | null;
  requestNote?: string | null;
  emptyRequester?: React.ReactNode;
  /** CP `hwy_members.id` — when set, requester face is a dossier link. */
  requesterDossierMemberId?: string | null;
  onOpenDossier?: (memberId: string) => void;
  className?: string;
};

/**
 * Legacy targhin admin: requester face + request reason/date as one column with two inner fields.
 */
export const HwyMemberTarghinRequesterRequestCell: React.FC<HwyMemberTarghinRequesterRequestCellProps> = ({
  requester,
  createdAt,
  requestReasonCodeTitle,
  requestNote,
  emptyRequester,
  requesterDossierMemberId,
  onOpenDossier,
  className,
  catalogPreviewState,
}) => {
  const { direction } = useCulture();
  const requesterDossierId = resolveTarghinRowFaceDossierMemberId(requesterDossierMemberId, requester);
  const requesterFace = requester && (requester.id || requester.displayFullName || requester.username) ? (
    <HwyTarghinDossierFaceLink
      dossierMemberId={requesterDossierId}
      onOpenDossier={onOpenDossier}
      dir={direction}
      catalogPreviewState={catalogPreviewState}
    >
      <HwyTarghinMemberFace face={requester} showElectoralPath />
    </HwyTarghinDossierFaceLink>
  ) : (
    emptyRequester
  );
  return (
  <div
    className={cn(INNER_GRID_CLASS, 'items-start text-sm', className)}
    style={requesterRequestGridStyle}
    dir={direction}
  >
    <div className="min-w-0">
      {requesterFace}
    </div>
    <div className="min-w-0 border-s border-slate-200/90 ps-3">
      <HwyMemberTarghinAdminRequestPreview
        createdAt={createdAt}
        requestReasonCodeTitle={requestReasonCodeTitle}
        requestNote={requestNote}
      />
    </div>
  </div>
  );
};
