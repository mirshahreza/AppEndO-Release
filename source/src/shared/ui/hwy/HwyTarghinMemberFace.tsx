import React, { useState } from 'react';
import { User } from 'lucide-react';

import { useCulture } from '../../../core/culture/CultureContext';
import { cn } from '../../../lib/utils';
import { formatHwyGeoResponsibilityMemberDisplayName } from '../../../domain/hwy/hwyGeoResponsibilityMemberDisplay';
import { formatHwyGeoResponsibilityNominationPatchLines } from '../../../domain/hwy/hwyGeoResponsibilityNominationDisplay';
import { resolveHwyGeoResponsibilityGenderSlot } from '../../../domain/hwy/hwyGeoResponsibilityNomination';
import type { HwyMemberTarghinAdminMemberFace } from '../../../domain/hwy/hwyMemberTarghinAdmin';
import {
  hwyMemberFaceCaptionTextClass,
  resolveHwyMemberFaceCaptionFromMemberFields,
} from '../../../domain/hwy/hwyMemberFaceCaptionDisplay';
import { PhoneNumberDisplay } from '../PhoneNumberDisplay';
import { HWY_PHONE_TEXT_XS_CLASS } from './hwyPhoneTypography';

export type HwyTarghinMemberFaceElectoralPathLayout = 'inline' | 'belowFullWidth';

export type HwyTarghinMemberFaceProps = {
  face: HwyMemberTarghinAdminMemberFace;
  /** Show electoral path under the name (requester column in legacy). */
  showElectoralPath?: boolean;
  /** `belowFullWidth`: region / district lines span the full cell under the avatar row. */
  electoralPathLayout?: HwyTarghinMemberFaceElectoralPathLayout;
  /** Rendered inside the name/phone column (e.g. full-width meta badges). */
  textColumnFooter?: React.ReactNode;
  /** Rendered under the membership no. in the avatar column (targhin list date badges). */
  avatarColumnFooter?: React.ReactNode;
  /** Last block in the full-width row under the avatar (after electoral path). */
  belowFullWidthRowFooter?: React.ReactNode;
  /** Platform role display labels (executor column). */
  roleTitles?: readonly string[];
  /** `belowAvatarRow`: role list spans under the avatar row (targhined list المنفّذ). */
  roleTitlesPlacement?: 'textColumn' | 'belowAvatarRow';
  /** Override display-name typography (default: `text-sm font-semibold`). */
  displayNameClassName?: string;
  rootClassName?: string;
};

/**
 * Hawiety targhin list member cell — geo-responsibility geometry:
 * photo or user icon, full membership no. under avatar (not inside the circle).
 */
const DEFAULT_DISPLAY_NAME_CLASS = 'truncate text-sm font-semibold leading-snug text-slate-900';

export const HwyTarghinMemberFace: React.FC<HwyTarghinMemberFaceProps> = ({
  face,
  showElectoralPath = false,
  electoralPathLayout = 'inline',
  textColumnFooter,
  avatarColumnFooter,
  belowFullWidthRowFooter,
  roleTitles,
  roleTitlesPlacement = 'textColumn',
  displayNameClassName,
  rootClassName,
}) => {
  const { direction } = useCulture();
  const [avatarFailed, setAvatarFailed] = useState(false);
  const displayName = formatHwyGeoResponsibilityMemberDisplayName(face.displayFullName);
  const faceCaption = resolveHwyMemberFaceCaptionFromMemberFields({
    id: face.id,
    username: face.username,
  });
  const membership = faceCaption.text;
  const genderSlot = resolveHwyGeoResponsibilityGenderSlot(face.genderCode);
  const placeholderAccent = genderSlot === 'female'
    ? 'bg-pink-50 text-pink-600'
    : genderSlot === 'male'
      ? 'bg-sky-50 text-sky-600'
      : 'bg-slate-100 text-slate-400';
  const showAvatar = Boolean(face.avatarUrl?.trim()) && !avatarFailed;
  const patchLines = showElectoralPath
    ? formatHwyGeoResponsibilityNominationPatchLines(face.electoralDivisionPath)
    : null;

  const avatarFrameClass = cn(
    'box-border h-10 w-10 shrink-0 rounded-full border-2 border-white object-cover',
    genderSlot === 'male' && 'border-sky-200/90',
    genderSlot === 'female' && 'border-pink-200/90',
    genderSlot === 'unknown' && 'border-slate-200/80',
  );

  const electoralPathBlock = patchLines ? (
    <div className="w-full min-w-0 space-y-0.5 text-start">
      {patchLines.ancestors ? (
        <div className="line-clamp-2 text-[11px] leading-snug text-slate-500">{patchLines.ancestors}</div>
      ) : null}
      {patchLines.leaf ? (
        <div className="text-xs font-semibold leading-snug text-slate-800">{patchLines.leaf}</div>
      ) : null}
    </div>
  ) : null;

  const avatarColumn = (
    <div className="flex shrink-0 flex-col items-center gap-0.5 px-0.5 pb-0.5 pt-0">
      {showAvatar ? (
        <img
          src={face.avatarUrl!}
          alt=""
          className={avatarFrameClass}
          onError={() => setAvatarFailed(true)}
        />
      ) : (
        <div
          className={cn('flex items-center justify-center', avatarFrameClass, placeholderAccent)}
          aria-hidden
        >
          <User className="h-5 w-5" />
        </div>
      )}
      {membership ? (
        <span
          dir="ltr"
          className={cn(
            'max-w-[4.5rem] truncate text-[11px] font-bold tabular-nums',
            hwyMemberFaceCaptionTextClass(faceCaption.kind),
          )}
        >
          {membership}
        </span>
      ) : null}
    </div>
  );

  const roleTitlesBelowAvatar = roleTitlesPlacement === 'belowAvatarRow' && roleTitles?.length;
  const roleTitlesBlock = roleTitles?.length ? (
    <ul className="m-0 w-full min-w-0 list-none space-y-1 p-0">
      {roleTitles.map((title, index) => (
        <li
          key={`${title}-${index}`}
          className="grid w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2 text-[11px] font-semibold leading-normal text-indigo-800"
          title={title}
        >
          <span
            className="size-1 shrink-0 justify-self-center rounded-full bg-indigo-500"
            aria-hidden
          />
          <span className="min-w-0 text-start">{title}</span>
        </li>
      ))}
    </ul>
  ) : null;

  const textColumn = (
    <div className="mt-[2px] min-w-0 space-y-0.5 text-start">
      <div className="flex min-w-0 w-full flex-row items-baseline">
        <span className="w-[3px] shrink-0" aria-hidden />
        <span
          className={cn(
            'min-w-0 flex-1 truncate text-start',
            displayNameClassName ?? DEFAULT_DISPLAY_NAME_CLASS,
          )}
          title={displayName}
        >
          {displayName}
        </span>
      </div>
      {face.phone?.trim() ? (
        <PhoneNumberDisplay
          phone={face.phone}
          className="max-w-full self-start"
          textClassName={cn(HWY_PHONE_TEXT_XS_CLASS, 'text-slate-600')}
        />
      ) : null}
      {!roleTitlesBelowAvatar ? roleTitlesBlock : null}
      {electoralPathLayout === 'inline' ? electoralPathBlock : null}
      {textColumnFooter ? (
        <div className="mt-1 flex w-full min-w-0 flex-row flex-wrap items-stretch gap-1.5">{textColumnFooter}</div>
      ) : null}
    </div>
  );

  const belowAvatarRowBlock = avatarColumnFooter || roleTitlesBelowAvatar || electoralPathBlock
    || belowFullWidthRowFooter ? (
    <div className="col-span-2 row-start-2 min-w-0 space-y-1 text-start">
      {avatarColumnFooter ? (
        <div className="flex w-full min-w-0 flex-row flex-nowrap items-stretch gap-1.5">
          {avatarColumnFooter}
        </div>
      ) : null}
      {roleTitlesBelowAvatar ? roleTitlesBlock : null}
      {electoralPathBlock}
      {belowFullWidthRowFooter ? (
        <div className="flex w-full min-w-0 flex-row flex-wrap items-stretch gap-1.5 pt-0.5">
          {belowFullWidthRowFooter}
        </div>
      ) : null}
    </div>
  ) : null;

  if (electoralPathLayout === 'belowFullWidth' || roleTitlesBelowAvatar) {
    return (
      <div
        dir={direction}
        className={cn(
          'grid w-full min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-0 gap-y-1 py-0.5',
          rootClassName,
        )}
      >
        <div className="col-start-1 row-start-1">{avatarColumn}</div>
        <div className="col-start-2 row-start-1 min-w-0">{textColumn}</div>
        {belowAvatarRowBlock}
      </div>
    );
  }

  return (
    <div
      dir={direction}
      className={cn('flex min-w-0 w-full flex-row items-start gap-0 py-0.5', rootClassName)}
    >
      {avatarColumn}
      <div className="min-w-0 flex-1">{textColumn}</div>
    </div>
  );
};
