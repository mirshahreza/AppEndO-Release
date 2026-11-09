import React from 'react';

import { useOptionalCulture, useOptionalCultureT } from '../../../core/culture/CultureContext';
import { readDocumentReadingDirection, resolveCultureShellIsRtl } from '../../../core/culture/cultureShellDirection';
import type { DesignerGridRichCellFields } from '../../../domain/component-designer/designerGridRichCellColumns';
import {
  formatHwyMemberDirectoryFaceMetaLine,
  formatHwyMemberListMembershipOnIsoDate,
  HWY_MEMBER_FACE_META_BIRTH_LABEL_KEY,
  HWY_MEMBER_FACE_META_MEMBERSHIP_LABEL_KEY,
} from '../../../domain/hwy/hwyMemberDirectoryFaceMetaLine';
import { resolveMemberDirectoryFaceImageUrl } from '../../../domain/hwy/hwyMemberImageFixCatalog';
import { isHwyMemberDirectoryFacePhoneUnderNameLayout } from '../../../domain/hwy/hwyCandidatePipelineListParity';
import { isHwyMemberRejectionListCompactMemberColumnLayout } from '../../../domain/hwy/hwyMemberRejectionListParity';
import { cn } from '../../../lib/utils';
import { PhoneNumberDisplay } from '../PhoneNumberDisplay';
import { HwyMemberAvatarWithMembershipCode } from './HwyMemberAvatarWithMembershipCode';

/** Rejection-list face row: «تاريخ التسجيل» → «التسجيل» (labels only; dates stay bold). */
const stripRejectionListDateLabelPrefix = (label: string): string => (
  label.replace(/^تاريخ\s+/u, '').replace(/^Date\s+/i, '').trim()
);

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

export type HwyMemberDirectoryListFaceCardProps = {
  row: Record<string, unknown>;
  fields: DesignerGridRichCellFields | undefined;
  allowRegistrationPersonalPhotoFallback?: boolean;
  shellIsRtl?: boolean;
  listScopeLegacy?: string | null;
};

/**
 * Column-1 card for Hawiety member-directory lists: avatar + membership code, name, birth/membership meta.
 */
export const HwyMemberDirectoryListFaceCard: React.FC<HwyMemberDirectoryListFaceCardProps> = ({
  row,
  fields,
  allowRegistrationPersonalPhotoFallback = true,
  shellIsRtl: shellIsRtlOverride,
  listScopeLegacy,
}) => {
  const culture = useOptionalCulture();
  const t = useOptionalCultureT();
  const shellIsRtl = shellIsRtlOverride ?? (
    culture
      ? resolveCultureShellIsRtl(culture)
      : readDocumentReadingDirection() === 'rtl'
  );
  const imageUrl = resolveMemberDirectoryFaceImageUrl(
    row,
    fields?.imageUrlField ?? 'avatarUrl',
    { allowRegistrationPersonalPhotoFallback },
  );
  const displayName = readRowString(row, fields?.primaryField)
    || readRowString(row, fields?.fallbackTextField);
  const faceMetaLine = formatHwyMemberDirectoryFaceMetaLine({
    birthYear: readRowString(row, fields?.secondaryField ?? 'birthYear'),
    membershipOn: row.membershipOn,
    birthLabel: t(HWY_MEMBER_FACE_META_BIRTH_LABEL_KEY),
    membershipLabel: t(HWY_MEMBER_FACE_META_MEMBERSHIP_LABEL_KEY),
  });

  const isCompactRejectionMemberColumn = isHwyMemberRejectionListCompactMemberColumnLayout(listScopeLegacy);
  const showPhoneUnderName = isHwyMemberDirectoryFacePhoneUnderNameLayout(listScopeLegacy);
  const primaryPhone = showPhoneUnderName ? readRowString(row, 'phone1') : '';
  const registeredOnIso = isCompactRejectionMemberColumn
    ? formatHwyMemberListMembershipOnIsoDate(row.createdAt ?? row.created_at)
    : '';
  const statusUpdatedOnIso = isCompactRejectionMemberColumn
    ? formatHwyMemberListMembershipOnIsoDate(
      row.membershipStatusUpdatedOn ?? row.membership_status_updated_on,
    )
    : '';
  const registeredOnLabel = t('hwy.memberDossier.similar.columnRegisteredOn')
    || t('hwy.members.column.createdAt');
  const statusUpdatedOnLabel = t('hwy.members.column.membershipStatusUpdatedOn')
    || t('hwy.memberDossier.field.statusUpdatedOn');

  const nameAndMeta = (
    <>
      <span
        className="block min-w-0 truncate text-xs font-bold leading-snug text-slate-800"
        title={displayName}
      >
        {displayName || <span className="text-slate-300">—</span>}
      </span>
      {faceMetaLine ? (
        <span className="block text-[10px] leading-snug tabular-nums text-slate-500 whitespace-normal break-words">
          {faceMetaLine}
        </span>
      ) : null}
    </>
  );

  const primaryPhoneInline = primaryPhone ? (
    <div className="flex w-full min-w-0 justify-start pt-0.5">
      <PhoneNumberDisplay
        phone={primaryPhone}
        badgeSize="compact"
        className="max-w-full"
        textClassName="text-[10px] font-semibold tabular-nums text-slate-800"
      />
    </div>
  ) : null;

  const rejectionListDateMetaLine = (() => {
    if (!isCompactRejectionMemberColumn) {
      return null;
    }
    const items: Array<{ label: string; iso: string }> = [];
    if (registeredOnIso && registeredOnLabel) {
      items.push({
        label: stripRejectionListDateLabelPrefix(registeredOnLabel),
        iso: registeredOnIso,
      });
    }
    if (statusUpdatedOnIso && statusUpdatedOnLabel) {
      items.push({
        label: stripRejectionListDateLabelPrefix(statusUpdatedOnLabel),
        iso: statusUpdatedOnIso,
      });
    }
    if (items.length === 0) {
      return null;
    }
    return (
      <div className="col-span-2 flex min-w-0 w-full flex-wrap items-baseline gap-x-1.5 gap-y-0.5 pt-0.5 text-start text-[10px] leading-snug tabular-nums text-slate-500">
        {items.map((item, index) => (
          <span key={`${item.label}-${item.iso}`} className="min-w-0 whitespace-normal break-words">
            {index > 0 ? <span className="pe-1.5 text-slate-400" aria-hidden>|</span> : null}
            <span className="font-normal">{item.label} : </span>
            <span className="font-bold text-slate-800">{item.iso}</span>
          </span>
        ))}
      </div>
    );
  })();

  if (isCompactRejectionMemberColumn) {
    return (
      <div
        dir={shellIsRtl ? 'rtl' : 'ltr'}
        className="grid min-w-0 w-full grid-cols-[auto_minmax(0,1fr)] items-start gap-x-1.5 gap-y-0.5"
      >
        <HwyMemberAvatarWithMembershipCode
          row={row}
          fields={fields}
          imageUrl={imageUrl}
          listScopeLegacy={listScopeLegacy}
        />
        <div className="flex min-w-0 flex-col justify-center gap-0.5 text-start">
          {nameAndMeta}
          {primaryPhoneInline}
        </div>
        {rejectionListDateMetaLine}
      </div>
    );
  }

  return (
    <div
      dir={shellIsRtl ? 'rtl' : 'ltr'}
      className="flex min-w-0 w-full flex-row items-center gap-1.5"
    >
      <HwyMemberAvatarWithMembershipCode
        row={row}
        fields={fields}
        imageUrl={imageUrl}
        listScopeLegacy={listScopeLegacy}
      />
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 text-start">
        {nameAndMeta}
        {primaryPhoneInline}
      </div>
    </div>
  );
};

export const HWY_MEMBER_DIRECTORY_LIST_FACE_CARD_BUTTON_CLASS = cn(
  'flex w-full min-w-0 items-stretch gap-1.5 text-start',
  'rounded-md border border-transparent px-1.5 py-1 transition-[background-color,box-shadow,border-color] duration-150 ease-out',
  'hover:border-slate-200/90 hover:bg-white hover:shadow-[0_2px_8px_rgba(15,23,42,0.08)]',
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-sky-500',
);
