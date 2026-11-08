import React from 'react';
import { User } from 'lucide-react';

import type { DesignerGridRichCellFields } from '../../../domain/component-designer/designerGridRichCellColumns';
import {
  hwyMemberFaceCaptionTextClass,
  resolveHwyMemberDirectoryListFaceCaptionForScope,
  resolveHwyMemberFaceCaption,
} from '../../../domain/hwy/hwyMemberFaceCaptionDisplay';
import { cn } from '../../../lib/utils';
import {
  HWY_MEMBER_LIST_AVATAR_IMAGE_CLASS,
  HWY_MEMBER_LIST_AVATAR_PLACEHOLDER_CLASS,
} from './hwyMemberFaceInteraction';

type AvatarGenderFallback = 'male' | 'female' | 'unknown';

const readRowString = (row: Record<string, unknown>, fieldKey?: string): string => {
  const key = fieldKey?.trim();
  if (!key) {
    return '';
  }
  const raw = row[key];
  if (raw === null || raw === undefined) {
    return '';
  }
  return String(raw).trim();
};

const resolveAvatarGenderFallback = (
  row: Record<string, unknown>,
  fields: DesignerGridRichCellFields | undefined,
): AvatarGenderFallback => {
  const code = readRowString(row, fields?.genderCodeField).toLowerCase();
  if (code === 'f' || code === 'female' || code === '2') {
    return 'female';
  }
  if (code === 'm' || code === 'male' || code === '1') {
    return 'male';
  }
  return 'unknown';
};

const AVATAR_GENDER_FALLBACK_CLASS: Record<AvatarGenderFallback, string> = {
  male: 'border-sky-200/90 bg-sky-50 text-sky-600',
  female: 'border-pink-200/90 bg-pink-50 text-pink-600',
  unknown: 'border-slate-200 bg-slate-100 text-slate-400',
};

export type HwyMemberAvatarWithMembershipCodeProps = {
  row: Record<string, unknown>;
  fields?: Pick<
    DesignerGridRichCellFields,
    'captionField' | 'captionFallbackField' | 'genderCodeField' | 'imageUrlField' | 'avatarSizePx'
  >;
  imageUrl?: string | null;
  avatarAlt?: string;
  /** Default 43 — member-directory list column. */
  avatarSizePx?: number;
  captionMaxWidthClass?: string;
  /** When set, Waited / Marfoozeh scopes force tracking-only (red) captions. */
  listScopeLegacy?: string | null;
  trackingOnly?: boolean;
  /** Dossier referrer rail — circular photo without list border ring. */
  avatarBorderless?: boolean;
};

/**
 * Hawiety member avatar + membership number under it (blue six-digit username, else red tracking code).
 * Single UI source for list grids, dossier rails, geo/targhin faces, and Base Components catalog.
 */
export const HwyMemberAvatarWithMembershipCode: React.FC<HwyMemberAvatarWithMembershipCodeProps> = ({
  row,
  fields,
  imageUrl: imageUrlOverride,
  avatarAlt,
  avatarSizePx: avatarSizePxOverride,
  captionMaxWidthClass = 'max-w-[3.75rem]',
  listScopeLegacy,
  trackingOnly = false,
  avatarBorderless = false,
}) => {
  const faceCaption = listScopeLegacy != null && listScopeLegacy !== ''
    ? resolveHwyMemberDirectoryListFaceCaptionForScope(row, listScopeLegacy, fields)
    : resolveHwyMemberFaceCaption(row, fields, { trackingOnly });
  const caption = faceCaption.text;
  const genderKind = resolveAvatarGenderFallback(row, fields);
  const imageUrl = String(imageUrlOverride ?? '').trim()
    || readRowString(row, fields?.imageUrlField ?? 'avatarUrl');
  const displayName = readRowString(row, 'displayFullName');
  /** Hover on membership code — full name when available, never duplicate the visible code. */
  const captionHoverTitle =
    displayName && displayName !== caption ? displayName : undefined;

  const sizePx = (
    typeof avatarSizePxOverride === 'number'
    && Number.isFinite(avatarSizePxOverride)
    && avatarSizePxOverride > 0
  )
    ? Math.round(avatarSizePxOverride)
    : (
      typeof fields?.avatarSizePx === 'number'
      && Number.isFinite(fields.avatarSizePx)
      && fields.avatarSizePx > 0
    )
      ? Math.round(fields.avatarSizePx)
      : 43;
  const iconSizePx = Math.max(14, Math.round(sizePx * 0.55));
  const boxStyle = { width: sizePx, height: sizePx } as const;

  const avatarVisual = imageUrl
    ? (
      <img
        src={imageUrl}
        alt={avatarAlt || displayName || caption || 'Member'}
        loading="lazy"
        decoding="async"
        className={cn(HWY_MEMBER_LIST_AVATAR_IMAGE_CLASS, avatarBorderless && 'border-0')}
        style={boxStyle}
      />
    )
    : (
      <span
        className={cn(
          HWY_MEMBER_LIST_AVATAR_PLACEHOLDER_CLASS,
          AVATAR_GENDER_FALLBACK_CLASS[genderKind],
          avatarBorderless && 'border-0',
        )}
        style={boxStyle}
        aria-hidden="true"
      >
        <User style={{ width: iconSizePx, height: iconSizePx }} strokeWidth={1.75} />
      </span>
    );

  return (
    <div className="flex shrink-0 flex-col items-center gap-0.5">
      {avatarVisual}
      {caption ? (
        <span
          dir="ltr"
          className={cn(
            'truncate font-mono text-xs font-semibold leading-tight',
            captionMaxWidthClass,
            hwyMemberFaceCaptionTextClass(faceCaption.kind),
          )}
          title={captionHoverTitle}
        >
          {caption}
        </span>
      ) : null}
    </div>
  );
};
