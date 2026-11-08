import React, { useEffect, useState } from 'react';
import { User } from 'lucide-react';

import { cn } from '../../../lib/utils';
import {
  hwyMemberFaceCaptionTextClass,
  resolveHwyMemberFaceCaptionFromMemberFields,
} from '../../../domain/hwy/hwyMemberFaceCaptionDisplay';
import { HwyGeoResponsibilityElectoralJoinMismatchBadge } from './HwyGeoResponsibilityElectoralJoinMismatchBadge';

export type HwyGeoResponsibilityMemberFaceVariant = 'official' | 'nominee' | 'candidate';

export type HwyGeoResponsibilityMemberFaceProps = {
  displayName: string | null | undefined;
  username?: string | null;
  /** Shown in red under the avatar when `username` is not allocated. */
  membershipFallbackId?: string | null;
  avatarUrl?: string | null;
  badge: string;
  badgeClassName: string;
  nameClassName?: string;
  variant?: HwyGeoResponsibilityMemberFaceVariant;
  density?: 'default' | 'compact';
  genderAccent?: 'male' | 'female';
  plain?: boolean;
  showBadge?: boolean;
  showName?: boolean;
  joinMismatchLabel?: string | null;
  removalPendingLabel?: string | null;
};

const SURFACE_CLASS: Record<HwyGeoResponsibilityMemberFaceVariant, string> = {
  official: 'border-emerald-100/80 bg-gradient-to-l from-emerald-50/55 to-white',
  nominee: 'border-amber-100/75 bg-gradient-to-l from-amber-50/50 to-white',
  candidate: 'border-indigo-100/75 bg-gradient-to-l from-indigo-50/45 to-white',
};

const DEFAULT_NAME_CLASS: Record<HwyGeoResponsibilityMemberFaceVariant, string> = {
  official: 'text-emerald-900',
  nominee: 'text-amber-950/90',
  candidate: 'text-indigo-950/90',
};

const AVATAR_ACCENT_CLASS: Record<'male' | 'female', string> = {
  male: 'bg-sky-50 text-sky-600 ring-sky-200/90',
  female: 'bg-pink-50 text-pink-600 ring-pink-200/90',
};

export const HwyGeoResponsibilityMemberFace: React.FC<HwyGeoResponsibilityMemberFaceProps> = ({
  displayName,
  username,
  membershipFallbackId,
  avatarUrl,
  badge,
  badgeClassName,
  nameClassName,
  variant,
  density = 'default',
  genderAccent,
  plain = false,
  showBadge = true,
  showName = true,
  joinMismatchLabel,
  removalPendingLabel,
}) => {
  const [avatarFailed, setAvatarFailed] = useState(false);
  useEffect(() => {
    setAvatarFailed(false);
  }, [avatarUrl]);
  const name = displayName?.trim() || '—';
  const faceCaption = resolveHwyMemberFaceCaptionFromMemberFields({
    id: membershipFallbackId,
    username,
    trackingCode: membershipFallbackId,
  });
  const membership = faceCaption.text || '—';
  const compact = density === 'compact';
  const placeholderAccent = genderAccent ? AVATAR_ACCENT_CLASS[genderAccent] : 'bg-slate-100 text-slate-400 ring-slate-200/80';
  const showAvatar = Boolean(avatarUrl?.trim()) && !avatarFailed;

  const surfaceClass = plain
    ? undefined
    : variant
      ? SURFACE_CLASS[variant]
      : 'border-slate-200/90 bg-gradient-to-l from-slate-50/90 to-white';

  return (
    <div
      className={cn(
        'flex min-w-0 w-full flex-row items-center',
        !showName && 'justify-center',
        plain ? 'gap-2' : cn(
          'rounded-md border shadow-sm',
          compact ? 'gap-1.5 px-1.5 py-1' : 'gap-2 px-2 py-1.5',
          surfaceClass,
        ),
      )}
    >
      <div className="flex shrink-0 flex-col items-center gap-0.5">
        {showAvatar ? (
          <img
            src={avatarUrl!}
            alt=""
            className={cn(
              'shrink-0 rounded-full border-2 border-white object-cover shadow-sm ring-1',
              compact ? 'h-8 w-8' : 'h-10 w-10',
              genderAccent === 'male' && 'ring-sky-200/90',
              genderAccent === 'female' && 'ring-pink-200/90',
              !genderAccent && 'ring-slate-200/80',
            )}
            onError={() => setAvatarFailed(true)}
          />
        ) : (
          <div
            className={cn(
              'flex shrink-0 items-center justify-center rounded-full border-2 border-white shadow-sm ring-1',
              compact ? 'h-8 w-8' : 'h-10 w-10',
              placeholderAccent,
            )}
            aria-hidden
          >
            <User className={compact ? 'h-4 w-4' : 'h-5 w-5'} />
          </div>
        )}
        <span
          dir="ltr"
          className={cn(
            'max-w-[4.5rem] truncate font-bold tabular-nums',
            compact ? 'text-[10px]' : 'text-[11px]',
            faceCaption.kind === 'none' ? 'text-slate-600' : hwyMemberFaceCaptionTextClass(faceCaption.kind),
          )}
        >
          {membership}
        </span>
      </div>
      {showName ? (
        <div className="min-w-0 flex-1 space-y-1 text-start">
          <div
            className={cn(
              'truncate text-xs font-semibold leading-snug',
              plain ? 'text-slate-900' : variant ? DEFAULT_NAME_CLASS[variant] : 'text-slate-800',
              nameClassName,
            )}
            title={name}
          >
            {name}
          </div>
          {showBadge || joinMismatchLabel || removalPendingLabel ? (
            <div className="flex min-w-0 flex-wrap items-center gap-1">
              {showBadge ? (
                <span
                  className={cn(
                    'inline-flex max-w-full truncate rounded px-1.5 py-0.5 text-[9px] font-semibold leading-none',
                    badgeClassName,
                  )}
                >
                  {badge}
                </span>
              ) : null}
              {removalPendingLabel ? (
                <span
                  className={cn(
                    'inline-flex max-w-full truncate rounded px-1.5 py-0.5',
                    'text-[9px] font-semibold leading-none',
                    'bg-red-100/95 text-red-900 ring-1 ring-red-200/80',
                  )}
                  title={removalPendingLabel}
                >
                  {removalPendingLabel}
                </span>
              ) : null}
              {joinMismatchLabel ? (
                <HwyGeoResponsibilityElectoralJoinMismatchBadge label={joinMismatchLabel} />
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
