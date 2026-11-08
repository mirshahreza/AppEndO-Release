import * as React from 'react';
import {
  Calendar,
  CalendarPlus,
  File,
  FileArchive,
  FileAudio,
  FileCode,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Lock,
  LockOpen,
  Mail,
  PencilLine,
  User,
} from 'lucide-react';
import { MountGridDateText } from '../../app/platform/MountGridDateText';
import { cn } from '../../lib/utils';
import {
  formatHwyPersonListNameSecondLine,
  readHwyNakhebinVoterNameLine1,
  readHwyNakhebinVoterNameLine2,
} from '../../shared/lib/hwyNakhebinVoterDisplay';
import { splitHwyHouseholdMemberNameLines } from '../hwy/hwyFamilyHouseholdDisplayName';
import { HwyImageFixMemberActionsCell } from '../hwy/HwyImageFixMemberActionsCell';
import { HwyMemberPersonalDocumentsLinkCell } from '../hwy/HwyMemberPersonalDocumentsLinkCell';
import { HwyImageFixRegistrationThumbsCell } from '../hwy/HwyImageFixRegistrationThumbsCell';
import { HwyMemberDirectoryGridFaceCell } from '../hwy/HwyMemberDirectoryGridFaceCell';
import { resolveHwyMemberFaceCaption } from '../hwy/hwyMemberFaceCaptionDisplay';
import { HwyMemberAvatarWithMembershipCode } from '../../shared/ui/hwy/HwyMemberAvatarWithMembershipCode';
import { shouldAllowRegistrationPersonalPhotoInListFaceColumn } from '../hwy/hwyMemberImageFixCatalog';
import {
  HWY_MEMBER_LIST_AVATAR_IMAGE_CLASS,
  HWY_MEMBER_LIST_AVATAR_PLACEHOLDER_CLASS,
} from '../../shared/ui/hwy/hwyMemberFaceInteraction';
import { formatHwyMemberListMembershipOnCaption } from '../hwy/hwyMemberListMembershipOnDisplay';
import { resolveHwyMemberJobTypePlaceLines } from '../hwy/hwyMemberJobTypePlaceDisplay';
import { BaseInfoUiIcon } from '../../shared/lib/baseInfoUiIcon';
import {
  getFileExtension,
  resolveFileIconKind,
  type FileIconKind,
} from '../../shared/lib/fileFieldUtils';
import {
  HwyNewlineStackedLinesCell,
  resolveHwyStackedLinesTextAlignFromGridColumn,
  HwyElectoralProvinceFallbackCell,
} from '../../shared/lib/hwyMemberDirectoryPathDisplay';
import { HwyMemberDirectoryElectoralDivisionGridCell } from '../../shared/ui/hwy/HwyMemberDirectoryElectoralDivisionGridCell';
import {
  isHwyLegacyProvinceFamilyComposite,
  resolveHwyMemberDirectoryFamilyCode,
} from '../../shared/lib/hwyMemberDirectoryFamilyCode';
import {
  gridColumnHasHwyFamilyHouseholdCellClick,
  hwyMemberDirectoryRowShowsFamilyHouseholdLink,
  rowShowsHwyFamilyHouseholdCellClick,
} from '../hwy/hwyFamilyHousehold';
import { rowShowsHwyMemberListScopedEditCellClick } from '../hwy/hwyMemberListScopedEditRuntime';
import { HwyFamilyHouseholdLinkTrigger } from '../hwy/HwyFamilyHouseholdLinkTrigger';
import { HwyHouseholdRegisteredIconCell } from '../hwy/HwyHouseholdRegisteredIconCell';
import { normalizeHexColor, readRowUiColor } from '../../shared/lib/uiColorUtils';
import { designerFetch } from './bindingMutationRuntime';
import { BuiltInBadge } from '../../shared/ui';
import { ActionTooltip } from '../../shared/ui/ActionTooltip';
import { NativeButton } from '../../shared/ui/NativeButton';
import { PhoneNumberDisplay } from '../../shared/ui/PhoneNumberDisplay';
import {
  HWY_PHONE_TEXT_GRID_PRIMARY_CLASS,
  HWY_PHONE_TEXT_GRID_SECONDARY_CLASS,
  HWY_PHONE_TEXT_SM_CLASS,
} from '../../shared/ui/hwy/hwyPhoneTypography';
import {
  isDesignerGridRowDisabled,
} from './designerGridRowDisableRules';
import type { DesignerDataGridColumn } from './designerDataGridColumns';
import type { RuntimeRenderMode } from './runtimeTypes';
import {
  buildContentStatusColoredAppearance,
} from './designerContentStatusTrigger';
import {
  readDesignerGridChipValues,
  readDesignerGridDisplayLabel,
  readDesignerGridMetaBadgeValues,
  readDesignerGridRowBoolean,
  readDesignerGridRowField,
  readDesignerGridRowString,
  resolveDesignerGridChipClass,
  resolveDesignerGridChipLabel,
  resolveDesignerGridHrefTemplate,
  resolveDesignerGridIconFromLookup,
  designerGridColumnAllowsCellClickInvoke,
  type DesignerGridRichCellFields,
  type DesignerGridRichCellKind,
} from './designerGridRichCellColumns';

const isDesignerGridPhoneColumnKey = (key: string): boolean => key === 'phone1' || key === 'phone2';

const renderDesignerGridPhoneLine = (
  text: string,
  textClassName: string,
  alignCenter: boolean,
): React.ReactNode => {
  if (!text.trim()) {
    return null;
  }
  return (
    <PhoneNumberDisplay
      phone={text}
      badgeSize="compact"
      className={cn('max-w-full', alignCenter && 'mx-auto')}
      textClassName={textClassName}
    />
  );
};

const STATUS_BADGE_BASE_CLASS =
  'inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px] font-medium';

const STATUS_BADGE_FALLBACK_CLASS =
  `${STATUS_BADGE_BASE_CLASS} border-slate-200 bg-slate-50 text-slate-700`;


type GridCellClickContext = {
  mode: RuntimeRenderMode;
  canInvoke: boolean;
  isRowDisabled?: boolean;
  onInvoke: () => void;
  navigate?: (to: string, options?: { replace?: boolean }) => void;
  onBeforeNavigate?: (row: Record<string, unknown>) => void;
};

const CHIP_OVERLAP_CLASS =
  'inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full border-2 border-white px-1 text-[9px] font-bold uppercase leading-none';

const CHIP_DEFAULT_CLASS = 'rounded-full px-2 py-0.5 text-[10px] font-bold';

/** Full-width stack; logical `text-start` + column `dir` — no `items-start` (cross-axis start ignores cell bidi). */
const DESIGNER_GRID_DATA_CELL_INNER_CLASS = 'flex min-w-0 w-full flex-col text-start';

const renderActorLabel = (username: string, actorId: string): React.ReactNode => {
  const label = username || (actorId ? `#${actorId}` : '');
  if (!label) {
    return <span className="text-slate-300">-</span>;
  }
  return <span className="text-[10px] text-start text-slate-600">{label}</span>;
};

type AvatarGenderFallback = 'male' | 'female' | 'neutral';

const resolveAvatarGenderFallback = (
  row: Record<string, unknown>,
  fields: DesignerGridRichCellFields | undefined,
): AvatarGenderFallback => {
  const code = readDesignerGridRowString(row, fields?.genderCodeField);
  if (code === '100.1.2') return 'female';
  if (code === '100.1.1') return 'male';
  const title = readDesignerGridRowString(row, 'genderCodeTitle').toLowerCase();
  if (title.includes('female')) return 'female';
  if (title.includes('male')) return 'male';
  return 'neutral';
};

const AVATAR_GENDER_FALLBACK_CLASS: Record<AvatarGenderFallback, string> = {
  male: 'border-sky-200 bg-sky-50 text-sky-600',
  female: 'border-rose-200 bg-rose-50 text-rose-600',
  neutral: 'border-slate-200 bg-slate-100 text-slate-500',
};

const DesignerGridAvatarCell: React.FC<{
  row: Record<string, unknown>;
  column: DesignerDataGridColumn;
  context?: GridCellClickContext;
}> = ({ row, column, context }) => {
  const fields = column.cellFields;
  const visibleWhenField = fields?.visibleWhenField?.trim();
  if (visibleWhenField && !readDesignerGridRowString(row, visibleWhenField)) {
    return <span className="text-slate-300">—</span>;
  }
  const imageUrl = readDesignerGridRowString(row, fields?.imageUrlField);
  const fallbackText = readDesignerGridRowString(row, fields?.fallbackTextField)
    || readDesignerGridRowString(row, column.key)
    || '?';
  const captionSecondary = readDesignerGridRowString(row, fields?.captionSecondaryField);

  const sizePx = (
    typeof fields?.avatarSizePx === 'number'
    && Number.isFinite(fields.avatarSizePx)
    && fields.avatarSizePx > 0
  )
    ? Math.round(fields.avatarSizePx)
    : 52;
  const isCompact = sizePx <= 44;

  const canClick = Boolean(context?.canInvoke)
    && context?.mode !== 'design'
    && !context?.isRowDisabled;

  const content = (
    <div className="flex min-w-0 flex-col items-center gap-0.5 text-center">
      <HwyMemberAvatarWithMembershipCode
        row={row}
        fields={fields}
        imageUrl={imageUrl}
        avatarAlt={fallbackText}
        avatarSizePx={sizePx}
        captionMaxWidthClass={isCompact ? 'max-w-[3.75rem]' : 'max-w-[7rem]'}
      />
      {captionSecondary ? (
        <span
          className={cn(
            'max-w-[7rem] truncate tabular-nums leading-tight text-slate-400',
            isCompact ? 'text-[10px] max-w-[3.75rem]' : 'text-xs',
          )}
          title={captionSecondary}
        >
          {captionSecondary}
        </span>
      ) : null}
    </div>
  );

  if (!canClick) {
    return content;
  }

  return (
    <NativeButton
      type="button"
      onClick={() => context?.onInvoke()}
      className="min-w-0 rounded-md text-start hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
    >
      {content}
    </NativeButton>
  );
};

const FILE_TILE_ICON: Record<FileIconKind, React.ComponentType<{ className?: string }>> = {
  image: FileImage,
  pdf: FileText,
  archive: FileArchive,
  audio: FileAudio,
  video: FileVideo,
  spreadsheet: FileSpreadsheet,
  document: FileText,
  code: FileCode,
  generic: File,
};

const FILE_TILE_ICON_CLASS: Record<FileIconKind, string> = {
  image: 'text-sky-600',
  pdf: 'text-rose-600',
  archive: 'text-amber-600',
  audio: 'text-violet-600',
  video: 'text-fuchsia-600',
  spreadsheet: 'text-emerald-600',
  document: 'text-indigo-600',
  code: 'text-slate-600',
  generic: 'text-slate-500',
};

const truncateFileTileName = (fileName: string, maxChars = 12): string => {
  const trimmed = fileName.trim();
  if (!trimmed) return 'file';
  if (trimmed.length <= maxChars) return trimmed;
  const extDot = trimmed.lastIndexOf('.');
  if (extDot > 0 && trimmed.length - extDot <= 5) {
    const ext = trimmed.slice(extDot);
    const baseBudget = Math.max(3, maxChars - ext.length - 1);
    return `${trimmed.slice(0, baseBudget)}…${ext}`;
  }
  return `${trimmed.slice(0, maxChars - 1)}…`;
};

const MIME_BY_EXTENSION: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  avif: 'image/avif',
  bmp: 'image/bmp',
};

const inferImageMime = (mime: string, fileName: string): string | null => {
  if (mime.trim().toLowerCase().startsWith('image/')) {
    return mime.trim().toLowerCase();
  }
  const ext = getFileExtension(fileName);
  return MIME_BY_EXTENSION[ext] ?? null;
};

const bytesToBase64 = (bytes: Uint8Array): string => {
  const chunkSize = 0x8000;
  let binary = '';
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const slice = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
};

const toClientPreviewUrl = (value: unknown, mime: string): string | null => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('data:')) return trimmed;
    const encoded = trimmed.includes(',') ? (trimmed.split(',').pop() ?? '') : trimmed;
    return encoded ? `data:${mime};base64,${encoded}` : null;
  }
  if (value && typeof value === 'object' && 'type' in value) {
    const record = value as { type?: unknown; data?: unknown };
    if (record.type === 'Buffer' && Array.isArray(record.data)) {
      const bytes = Uint8Array.from(record.data as number[]);
      return bytes.length ? `data:${mime};base64,${bytesToBase64(bytes)}` : null;
    }
  }
  return null;
};

const buildClientPreviewFromAssetRow = (data: Record<string, unknown>): string | null => {
  const fileName = typeof data.fileName === 'string' ? data.fileName : '';
  const mime = inferImageMime(
    typeof data.fileMime === 'string' ? data.fileMime : '',
    fileName,
  );
  if (!mime) return null;
  const xsUrl = toClientPreviewUrl(data.fileXs, 'image/jpeg');
  if (xsUrl) return xsUrl;
  return toClientPreviewUrl(data.file, mime);
};

const fetchClientAssetPreview = async (assetId: string): Promise<string | null> => {
  const response = await designerFetch(`/api/cms/assets/${encodeURIComponent(assetId)}`);
  if (!response.ok) return null;
  const json = await response.json() as { data?: Record<string, unknown> };
  if (!json.data) return null;
  return buildClientPreviewFromAssetRow(json.data);
};

const DesignerGridFileTileCell: React.FC<{
  row: Record<string, unknown>;
  column: DesignerDataGridColumn;
}> = ({ row, column }) => {
  const fields = column.cellFields;
  const previewUrl = readDesignerGridRowString(row, fields?.previewUrlField || 'filePreviewUrl');
  const fileName = readDesignerGridRowString(row, fields?.fileNameField || column.key)
    || readDesignerGridRowString(row, 'fileName')
    || 'file';
  const mime = readDesignerGridRowString(row, fields?.mimeField || 'fileMime');
  const kind = resolveFileIconKind(fileName, mime || null);
  const shortName = truncateFileTileName(fileName);
  const title = fileName;
  const assetId = readDesignerGridRowString(row, 'id');
  const bareTile = fields?.bareTile === true;
  const imageTileClass = bareTile
    ? 'h-[100px] w-[100px] rounded-md object-cover'
    : 'h-[100px] w-[100px] rounded-md border border-slate-200 bg-slate-50 object-cover';
  const imagePlaceholderClass = bareTile
    ? 'h-[100px] w-[100px] rounded-md bg-slate-100 motion-safe:animate-pulse'
    : 'h-[100px] w-[100px] rounded-md border border-slate-200 bg-slate-100 motion-safe:animate-pulse';
  const [resolvedPreview, setResolvedPreview] = React.useState(previewUrl);

  React.useEffect(() => {
    setResolvedPreview(previewUrl);
  }, [previewUrl]);

  React.useEffect(() => {
    if (previewUrl || kind !== 'image' || !assetId) {
      return;
    }
    let cancelled = false;
    void fetchClientAssetPreview(assetId)
      .then((url) => {
        if (url && !cancelled) setResolvedPreview(url);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [previewUrl, kind, assetId]);

  const handlePreviewError = () => {
    if (kind !== 'image' || !assetId) {
      setResolvedPreview('');
      return;
    }
    void fetchClientAssetPreview(assetId)
      .then((url) => setResolvedPreview(url ?? ''))
      .catch(() => setResolvedPreview(''));
  };

  if (kind === 'image' && resolvedPreview) {
    return (
      <img
        src={resolvedPreview}
        alt=""
        loading="lazy"
        decoding="async"
        className={imageTileClass}
        onError={handlePreviewError}
      />
    );
  }

  if (kind === 'image') {
    return (
      <div
        className={imagePlaceholderClass}
        aria-label={fileName}
      />
    );
  }

  const Icon = FILE_TILE_ICON[kind];
  return (
    <div
      className="inline-flex w-[4.5rem] flex-col items-center gap-1 rounded-md border border-slate-200 bg-white px-1.5 py-2"
      title={title}
    >
      <Icon className={cn('h-8 w-8 shrink-0', FILE_TILE_ICON_CLASS[kind])} aria-hidden="true" />
      <span className="w-full truncate text-center text-[10px] leading-tight text-slate-600">{shortName}</span>
    </div>
  );
};

const readHwyMemberDirectoryNakhebinLinkTypeLabel = (row: Record<string, unknown>): string => {
  const title = readDesignerGridRowString(row, 'nakhebinLinkTypeCodeTitle');
  if (title) {
    return title;
  }
  const nested = row.nakhebinLinkType ?? row.nakhebin_link_type;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    const fromJoin = readDesignerGridRowString(nested as Record<string, unknown>, 'title');
    if (fromJoin) {
      return fromJoin;
    }
  }
  return '';
};

const renderHwyMemberDirectoryNakhebinLinkTypeFooter = (
  columnKey: string,
  centered: boolean,
  row: Record<string, unknown>,
): React.ReactNode => {
  if (columnKey !== 'nakhebinId') {
    return undefined;
  }
  const linkType = readHwyMemberDirectoryNakhebinLinkTypeLabel(row);
  if (!linkType) {
    return undefined;
  }
  return (
    <span
      className={cn(
        'max-w-full whitespace-normal break-words text-[10px] leading-tight text-slate-500',
        centered && 'text-center',
      )}
      title={linkType}
    >
      {linkType}
    </span>
  );
};

const DesignerGridAccountCell: React.FC<{
  row: Record<string, unknown>;
  column: DesignerDataGridColumn;
  context?: GridCellClickContext;
}> = ({ row, column, context }) => {
  const fields = column.cellFields;
  const useNakhebinVoterLines = fields?.primaryField === 'voterNameLine1';
  const useMemberDirectoryNameLines = fields?.primaryField === 'displayFullName'
    && fields?.secondaryField === 'birthYear';
  let primary = useNakhebinVoterLines
    ? readHwyNakhebinVoterNameLine1(row)
    : readDesignerGridRowString(row, fields?.primaryField || column.key);
  let secondary = useNakhebinVoterLines
    ? readHwyNakhebinVoterNameLine2(row)
    : readDesignerGridRowString(row, fields?.secondaryField);
  if (useMemberDirectoryNameLines) {
    const displayFullName = readDesignerGridRowString(row, 'displayFullName');
    const { line1, line2: familyName } = splitHwyHouseholdMemberNameLines(displayFullName);
    primary = line1;
    secondary = formatHwyPersonListNameSecondLine(
      familyName,
      readDesignerGridRowString(row, 'birthYear'),
    );
  }
  if (column.key === 'nakhebinId') {
    const familyCode = resolveHwyMemberDirectoryFamilyCode(row);
    secondary = familyCode
      || (secondary && !isHwyLegacyProvinceFamilyComposite(secondary) ? secondary : '');
  }
  if (
    column.key === 'jobTypeAndPlace'
    && fields?.primaryField === 'jobTypeCodeTitle'
    && fields?.secondaryField === 'jobPlace'
  ) {
    const jobLines = resolveHwyMemberJobTypePlaceLines(
      row.jobTypeCodeTitle,
      row.jobPlace,
    );
    primary = jobLines.primary;
    secondary = jobLines.secondary;
  }
  const accountLayout = fields?.accountLayout;
  const stackedCenter = accountLayout === 'stacked-text-center';
  const stackedPlain = accountLayout === 'stacked-text'
    || accountLayout === 'stacked-text-lg'
    || stackedCenter;
  if (column.key === 'electoralDivisionPath' && stackedPlain) {
    return (
      <HwyMemberDirectoryElectoralDivisionGridCell
        row={row}
        electoralFallbackField={fields?.electoralFallbackField}
      />
    );
  }
  if (column.key === 'residenceSummary' && stackedPlain) {
    return (
      <HwyElectoralProvinceFallbackCell
        value={readDesignerGridRowString(row, 'addrProvinceTitle')}
      />
    );
  }
  if (column.key === 'memberInstitutesSummary') {
    return (
      <HwyNewlineStackedLinesCell
        value={row.memberInstitutesSummary}
        textAlign={resolveHwyStackedLinesTextAlignFromGridColumn(column)}
      />
    );
  }
  const showBadge = fields?.badgeField
    ? readDesignerGridRowBoolean(row, fields.badgeField)
    : false;
  const useMemberDirectoryPhonePrimaryStyle = column.key === 'phone1'
    && fields?.primaryField === 'phone1'
    && stackedCenter;
  const useMemberDirectoryStatusPrimaryStyle = column.key === 'membershipStatusCodeTitle'
    && fields?.primaryField === 'membershipStatusCodeTitle'
    && stackedCenter;
  const membershipStatusInk = useMemberDirectoryStatusPrimaryStyle
    ? normalizeHexColor(readDesignerGridRowString(row, 'membershipStatusCodeTitleUiColor'))
    : null;
  const primaryClass = useMemberDirectoryPhonePrimaryStyle
    ? 'text-xs font-bold'
    : useMemberDirectoryStatusPrimaryStyle
      ? 'text-[11px] font-bold leading-snug'
      : accountLayout === 'stacked-text-lg'
        ? 'text-xs font-bold'
        : 'text-sm font-medium';
  const stackedInnerClass = stackedCenter
    ? 'flex min-w-0 w-full flex-col items-center gap-0.5 text-center'
    : DESIGNER_GRID_DATA_CELL_INNER_CLASS;
  const stackedLineAlignClass = stackedCenter ? 'text-center' : 'text-start';

  const canClick = Boolean(context?.canInvoke)
    && context?.mode !== 'design'
    && !context?.isRowDisabled;

  if (
    column.key === 'nakhebinId'
    && gridColumnHasHwyFamilyHouseholdCellClick(column)
    && !hwyMemberDirectoryRowShowsFamilyHouseholdLink(row)
  ) {
    return null;
  }

  const phoneStackedColumn = isDesignerGridPhoneColumnKey(column.key);
  const stackedMetaMultiLineColumn = column.key === 'jobTypeAndPlace'
    || column.key === 'educationLevelAndDetails';
  const stackedLineBreakClass = stackedMetaMultiLineColumn
    ? 'whitespace-normal break-words'
    : undefined;
  /** Omit the primary line when only secondary is set — avoid a stray em dash above real data. */
  const showStackedPrimaryLine = Boolean(primary) || !secondary;
  const stackedContent = stackedPlain ? (
    <div className={stackedInnerClass}>
      {showStackedPrimaryLine ? (
        phoneStackedColumn ? (
          primary
            ? renderDesignerGridPhoneLine(primary, HWY_PHONE_TEXT_GRID_PRIMARY_CLASS, stackedCenter)
            : <span className={cn('text-slate-300', stackedLineAlignClass, primaryClass)}>—</span>
        ) : (
          <span
            className={cn(
              'min-w-0 max-w-full leading-snug',
              membershipStatusInk ? null : 'text-slate-800',
              stackedLineAlignClass,
              stackedLineBreakClass,
              stackedMetaMultiLineColumn ? 'text-xs font-medium' : primaryClass,
            )}
            style={membershipStatusInk ? { color: membershipStatusInk } : undefined}
          >
            {primary || <span className="text-slate-300">—</span>}
          </span>
        )
      ) : null}
      {secondary ? (
        phoneStackedColumn
          ? (
            <span className={cn('mt-0.5', stackedLineAlignClass)}>
              {renderDesignerGridPhoneLine(secondary, HWY_PHONE_TEXT_GRID_SECONDARY_CLASS, stackedCenter)}
            </span>
          )
          : (
            <span
              className={cn(
                'mt-0.5 text-xs text-slate-500',
                stackedLineAlignClass,
                stackedLineBreakClass,
              )}
            >
              {secondary}
            </span>
          )
      ) : null}
      {fields?.tertiaryField ? (() => {
        const tertiaryRaw = readDesignerGridRowString(row, fields.tertiaryField);
        const tertiaryText = fields.tertiaryKind === 'membership-date'
          ? formatHwyMemberListMembershipOnCaption(tertiaryRaw)
          : tertiaryRaw;
        if (!tertiaryText) {
          return null;
        }
        return (
          <span
            className={cn(
              'mt-0.5 inline-flex max-w-full items-center gap-0.5 text-[10px] leading-tight text-slate-400',
              stackedCenter && 'justify-center',
            )}
          >
            {fields.tertiaryKind === 'membership-date' ? (
              <Calendar className="size-3 shrink-0 opacity-70" aria-hidden />
            ) : null}
            <span className="tabular-nums">{tertiaryText}</span>
          </span>
        );
      })() : null}
    </div>
  ) : null;

  const nakhebinLinkTypeFooter = renderHwyMemberDirectoryNakhebinLinkTypeFooter(
    column.key,
    stackedCenter,
    row,
  );

  if (stackedPlain) {
    if (!canClick) {
      if (nakhebinLinkTypeFooter) {
        return (
          <div className={cn('flex min-w-0 w-full flex-col gap-0.5', stackedCenter && 'items-center')}>
            {stackedContent}
            {nakhebinLinkTypeFooter}
          </div>
        );
      }
      return stackedContent;
    }
    if (rowShowsHwyFamilyHouseholdCellClick(row, column)) {
      return (
        <HwyFamilyHouseholdLinkTrigger
          align={stackedCenter ? 'center' : 'start'}
          primary={primary || '—'}
          secondary={secondary || undefined}
          footer={nakhebinLinkTypeFooter}
          onClick={() => context?.onInvoke()}
        />
      );
    }
    if (nakhebinLinkTypeFooter) {
      return (
        <div className={cn('flex min-w-0 w-full flex-col gap-0.5', stackedCenter && 'items-center')}>
          <NativeButton
            type="button"
            onClick={() => context?.onInvoke()}
            className={`w-full min-w-0 text-slate-800 underline-offset-2 hover:text-sky-700 hover:underline ${stackedCenter ? 'text-center' : 'text-start'}`}
          >
            {stackedContent}
          </NativeButton>
          {nakhebinLinkTypeFooter}
        </div>
      );
    }
    return (
      <NativeButton
        type="button"
        onClick={() => context?.onInvoke()}
        className={`w-full min-w-0 text-slate-800 underline-offset-2 hover:text-sky-700 hover:underline ${stackedCenter ? 'text-center' : 'text-start'}`}
      >
        {stackedContent}
      </NativeButton>
    );
  }

  return (
    <>
      <div className="flex items-center gap-1.5 font-medium text-slate-800">
        <Mail className="h-3 w-3 text-slate-400" aria-hidden="true" />
        <span>{primary || <span className="text-slate-300">—</span>}</span>
      </div>
      <div className="mt-0.5 flex items-center gap-1.5 text-slate-500">
        <User className="h-3 w-3 text-slate-400" aria-hidden="true" />
        <span>{secondary || <span className="text-slate-300">—</span>}</span>
        {showBadge ? (
          <BuiltInBadge
            title="Built-in user"
            aria-label="Built-in user"
          />
        ) : null}
      </div>
    </>
  );
};

const DesignerGridMetaBadges: React.FC<{
  row: Record<string, unknown>;
  metaBadgeFields: string | undefined;
}> = ({ row, metaBadgeFields }) => {
  const values = readDesignerGridMetaBadgeValues(row, metaBadgeFields);
  if (values.length === 0) {
    return null;
  }
  return (
    <div className="mt-0.5 flex flex-wrap gap-1">
      {values.map((value, index) => (
        <span
          key={`${value}-${index}`}
          className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-600"
        >
          {value}
        </span>
      ))}
    </div>
  );
};

const DesignerGridLinkCell: React.FC<{
  row: Record<string, unknown>;
  column: DesignerDataGridColumn;
  context: GridCellClickContext;
}> = ({ row, column, context }) => {
  const label = readDesignerGridDisplayLabel(row, column.cellFields);
  const hrefTemplate = column.cellFields?.hrefTemplate?.trim() ?? '';
  const href = hrefTemplate
    ? resolveDesignerGridHrefTemplate(hrefTemplate, row)
    : '';
  const badges = <DesignerGridMetaBadges row={row} metaBadgeFields={column.cellFields?.metaBadgeFields} />;

  const handleNavigate = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (!href || context.mode === 'design') {
      return;
    }
    if (context.navigate) {
      event.preventDefault();
      context.onBeforeNavigate?.(row);
      context.navigate(href);
    }
  };

  if (href && context.mode !== 'design') {
    return (
      <div className={DESIGNER_GRID_DATA_CELL_INNER_CLASS}>
        <a
          href={href}
          onClick={handleNavigate}
          className="block min-w-0 max-w-full truncate text-start text-sky-700 underline-offset-2 hover:underline"
          title={label || undefined}
        >
          {label || <span className="text-slate-300">-</span>}
        </a>
        {badges}
      </div>
    );
  }

  const canClick = context.canInvoke && context.mode !== 'design' && !context.isRowDisabled;

  return (
    <div className={DESIGNER_GRID_DATA_CELL_INNER_CLASS}>
      <NativeButton
        type="button"
        onClick={() => context.onInvoke()}
        disabled={!canClick}
        className={`text-start text-slate-600 underline-offset-2 ${canClick ? 'hover:underline' : 'cursor-default'}`}
      >
        {label || <span className="text-slate-300">-</span>}
      </NativeButton>
      {badges}
    </div>
  );
};

const DesignerGridLookupCell: React.FC<{
  row: Record<string, unknown>;
  column: DesignerDataGridColumn;
}> = ({ row, column }) => {
  const label = readDesignerGridDisplayLabel(row, column.cellFields);
  const fallback = readDesignerGridRowString(row, column.key);
  const text = label || fallback;
  return text
    ? <span className="block min-w-0 w-full truncate text-start text-slate-700">{text}</span>
    : <span className="text-slate-300">—</span>;
};

const resolveStatusBadgeColor = (
  row: Record<string, unknown>,
  column: DesignerDataGridColumn,
): string | null => {
  const fields = column.cellFields;
  const colorField = fields?.colorField?.trim() || `${column.key}UiColor`;
  return normalizeHexColor(readDesignerGridRowField(row, colorField))
    ?? readRowUiColor(row);
};

const designerGridColumnIsCenterAligned = (column: DesignerDataGridColumn): boolean => (
  column.cellClassName?.includes('text-center') === true
  || column.headerClassName?.includes('text-center') === true
);

const resolveDesignerGridStatusBadgeCellInnerClass = (column: DesignerDataGridColumn): string => (
  designerGridColumnIsCenterAligned(column)
    ? 'flex min-w-0 w-full flex-col items-center text-center'
    : DESIGNER_GRID_DATA_CELL_INNER_CLASS
);

const DesignerGridStatusBadgeCell: React.FC<{
  row: Record<string, unknown>;
  column: DesignerDataGridColumn;
  context: GridCellClickContext;
}> = ({ row, column, context }) => {
  const fields = column.cellFields;
  const innerClassName = resolveDesignerGridStatusBadgeCellInnerClass(column);
  const html = readDesignerGridRowString(row, fields?.htmlField);
  const label = readDesignerGridDisplayLabel(row, fields)
    || readDesignerGridRowString(row, fields?.valueField)
    || readDesignerGridRowString(row, column.key);
  if (!label || label === '—') {
    if (!designerGridColumnIsCenterAligned(column)) {
      return <span className="text-slate-300">—</span>;
    }
    return (
      <div className={innerClassName}>
        <span className="text-slate-300">—</span>
      </div>
    );
  }

  const color = resolveStatusBadgeColor(row, column);
  const appearance = color
    ? buildContentStatusColoredAppearance(color, STATUS_BADGE_BASE_CLASS)
    : { className: STATUS_BADGE_FALLBACK_CLASS };
  const canClick = context.canInvoke && context.mode !== 'design' && !context.isRowDisabled;
  const statusDate = fields?.dateField
    ? readDesignerGridRowString(row, fields.dateField)
    : '';
  const badge = (
    <span className={appearance.className} style={appearance.style}>
      {html ? <BaseInfoUiIcon uiHtml={html} className="h-3 w-3" /> : null}
      {label}
    </span>
  );

  const badgeNode = canClick ? (
    <NativeButton
      type="button"
      onClick={() => context.onInvoke()}
      className="inline-flex rounded-full transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1"
      aria-label={label}
    >
      {badge}
    </NativeButton>
  ) : badge;

  if (!statusDate) {
    return (
      <div className={innerClassName}>
        {badgeNode}
      </div>
    );
  }

  return (
    <div className={cn(innerClassName, 'gap-0.5 leading-tight')}>
      {badgeNode}
      <MountGridDateText value={statusDate} className="font-mono text-[10px] text-slate-400" />
    </div>
  );
};

const DesignerGridIconFromLookupCell: React.FC<{
  row: Record<string, unknown>;
  column: DesignerDataGridColumn;
  designerStore?: Record<string, unknown>;
}> = ({ row, column, designerStore }) => {
  const fields = column.cellFields;
  const resolved = resolveDesignerGridIconFromLookup(row, fields, column.key, designerStore);

  if (!resolved) {
    return <span className="text-slate-300">—</span>;
  }

  const icon = resolved.uiHtml
    ? <BaseInfoUiIcon uiHtml={resolved.uiHtml} label={resolved.label} className="h-3.5 w-3.5" />
    : null;

  const content = (
    <span className="inline-flex items-center justify-center text-slate-500">
      {icon ?? (
        <span className="text-[10px] font-medium text-slate-500">{resolved.label || '—'}</span>
      )}
    </span>
  );

  const showTooltip = fields?.showTooltip !== false && Boolean(resolved.label);
  if (!showTooltip) {
    return content;
  }

  return (
    <ActionTooltip content={resolved.label}>
      {content}
    </ActionTooltip>
  );
};

const DesignerGridChipsCell: React.FC<{
  row: Record<string, unknown>;
  column: DesignerDataGridColumn;
  context: GridCellClickContext;
}> = ({ row, column, context }) => {
  const fields = column.cellFields;
  const values = readDesignerGridChipValues(row, fields?.valuesField || column.key);
  const canClick = context.canInvoke && context.mode !== 'design' && !context.isRowDisabled;
  const colorMode = fields?.colorMode;
  const truncateChars = fields?.truncateLabelChars;
  const showTooltipOnTruncate = fields?.showTooltipOnTruncate === true;
  const overlapMode = fields?.overlapMode === true;

  if (values.length === 0) {
    return <span className="text-slate-300">—</span>;
  }

  const renderChip = (value: string, index: number) => {
    const colorClass = resolveDesignerGridChipClass(value, colorMode);
    const displayLabel = resolveDesignerGridChipLabel(value, truncateChars);
    const truncated = displayLabel !== value;
    const chipClass = cn(
      overlapMode ? CHIP_OVERLAP_CLASS : CHIP_DEFAULT_CLASS,
      colorClass,
      canClick ? 'hover:opacity-85' : '',
      !canClick && 'disabled:cursor-default',
    );

    const chip = canClick ? (
      <NativeButton
        type="button"
        onClick={() => context.onInvoke()}
        disabled={!canClick}
        className={chipClass}
        aria-label={value}
      >
        {displayLabel}
      </NativeButton>
    ) : (
      <span className={chipClass} aria-label={value}>
        {displayLabel}
      </span>
    );

    const wrapped = showTooltipOnTruncate && truncated ? (
      <ActionTooltip content={value}>{chip}</ActionTooltip>
    ) : chip;

    if (!overlapMode) {
      return <React.Fragment key={value}>{wrapped}</React.Fragment>;
    }

    return (
      <span
        key={value}
        className={cn('inline-flex', index > 0 && '-ms-2')}
        style={{ zIndex: index + 1 }}
      >
        {wrapped}
      </span>
    );
  };

  return (
    <div className={cn(overlapMode ? 'flex items-center' : 'flex flex-wrap gap-1')}>
      {values.map((value, index) => renderChip(value, index))}
    </div>
  );
};

const DesignerGridAuditDateRow: React.FC<{
  value: string;
  icon: 'created' | 'updated';
}> = ({ value, icon }) => {
  const Icon = icon === 'created' ? CalendarPlus : PencilLine;
  const iconClass = icon === 'created'
    ? 'h-3 w-3 shrink-0 text-emerald-600'
    : 'h-3 w-3 shrink-0 text-indigo-600';
  const tooltip = icon === 'created' ? 'Created' : 'Updated';

  return (
    <div className="inline-flex items-center gap-1">
      <ActionTooltip content={tooltip}>
        <span className="inline-flex" aria-label={tooltip}>
          <Icon className={iconClass} aria-hidden="true" />
        </span>
      </ActionTooltip>
      <MountGridDateText value={value} className="font-mono text-slate-400" />
    </div>
  );
};

const DesignerGridAuditCell: React.FC<{
  row: Record<string, unknown>;
  column: DesignerDataGridColumn;
}> = ({ row, column }) => {
  const fields = column.cellFields;
  const dateValue = readDesignerGridRowString(row, fields?.dateField || column.key);
  const secondaryDate = fields?.secondaryDateField
    ? readDesignerGridRowString(row, fields.secondaryDateField)
    : '';
  const actorUsername = readDesignerGridRowString(row, fields?.actorUsernameField);
  const actorId = readDesignerGridRowString(row, fields?.actorIdField);

  if (fields?.secondaryDateField) {
    return (
      <div className={`${DESIGNER_GRID_DATA_CELL_INNER_CLASS} gap-0.5 leading-tight`}>
        {dateValue ? <DesignerGridAuditDateRow value={dateValue} icon="created" /> : (
          <span className="text-slate-300">—</span>
        )}
        {secondaryDate ? <DesignerGridAuditDateRow value={secondaryDate} icon="updated" /> : (
          <span className="text-slate-300">—</span>
        )}
      </div>
    );
  }

  return (
    <div className={`${DESIGNER_GRID_DATA_CELL_INNER_CLASS} leading-tight`}>
      <MountGridDateText value={dateValue || undefined} className="font-mono text-slate-400" />
      {renderActorLabel(actorUsername, actorId)}
    </div>
  );
};

const DesignerGridLockStatusCell: React.FC<{
  row: Record<string, unknown>;
  column: DesignerDataGridColumn;
  context: GridCellClickContext;
}> = ({ row, column, context }) => {
  const fields = column.cellFields;
  const locked = readDesignerGridRowBoolean(row, fields?.lockedField || column.key);
  const stateDate = locked
    ? readDesignerGridRowString(row, fields?.lockedAtField)
    : readDesignerGridRowString(row, fields?.unlockedAtField);
  const actorUsername = locked
    ? readDesignerGridRowString(row, fields?.lockedByUsernameField)
    : readDesignerGridRowString(row, fields?.unlockedByUsernameField);
  const actorId = locked
    ? readDesignerGridRowString(row, fields?.lockedByField)
    : readDesignerGridRowString(row, fields?.unlockedByField);
  const canClick = context.canInvoke && context.mode !== 'design' && !context.isRowDisabled;

  if (!canClick) {
    return (
      <div className="flex items-start gap-1.5 text-start leading-tight text-slate-600">
        {locked ? (
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-600" aria-hidden="true" />
        ) : (
          <LockOpen className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
        )}
        <div className="flex flex-col items-start leading-tight">
          <MountGridDateText value={stateDate || undefined} className="font-mono text-slate-400" />
          {renderActorLabel(actorUsername, actorId)}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-1.5 text-start leading-tight">
      <ActionTooltip content={locked ? 'Click to unlock' : 'Click to lock'}>
        <NativeButton
          type="button"
          onClick={() => context.onInvoke()}
          disabled={!canClick}
          className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded transition-colors ${
            locked
              ? 'text-rose-600 hover:bg-rose-50'
              : 'text-emerald-600 hover:bg-emerald-50'
          } ${canClick ? 'cursor-pointer' : 'cursor-default opacity-60'}`}
          aria-label={locked ? 'Unlock' : 'Lock'}
        >
          {locked ? <Lock className="h-4 w-4" aria-hidden="true" /> : <LockOpen className="h-4 w-4" aria-hidden="true" />}
        </NativeButton>
      </ActionTooltip>
      <div className="flex min-w-0 flex-col items-start gap-0.5">
        <MountGridDateText value={stateDate || undefined} className="font-mono text-slate-400" />
        {renderActorLabel(actorUsername, actorId)}
      </div>
    </div>
  );
};

export const DesignerGridRichCell: React.FC<{
  row: Record<string, unknown>;
  column: DesignerDataGridColumn;
  mode: RuntimeRenderMode;
  canInvokeCellClick: boolean;
  onCellClick: () => void;
  designerStore?: Record<string, unknown>;
  navigate?: (to: string, options?: { replace?: boolean }) => void;
  onBeforeNavigate?: (row: Record<string, unknown>) => void;
  hwyMemberDirectoryListScopeLegacy?: string | null;
}> = ({
  row,
  column,
  mode,
  canInvokeCellClick,
  onCellClick,
  designerStore,
  navigate,
  onBeforeNavigate,
  hwyMemberDirectoryListScopeLegacy,
}) => {
  const allowRegistrationPersonalPhotoFallback = shouldAllowRegistrationPersonalPhotoInListFaceColumn(
    hwyMemberDirectoryListScopeLegacy,
  );
  const cellKind = column.cellKind as DesignerGridRichCellKind | undefined;
  const isRowDisabled = isDesignerGridRowDisabled(row, column.cellDisabledWhen, designerStore);
  const behaviorAllowsCellClick = designerGridColumnAllowsCellClickInvoke(column, cellKind);
  const scopedEditCellClick = rowShowsHwyMemberListScopedEditCellClick(
    column,
    hwyMemberDirectoryListScopeLegacy,
  );
  const clickContext: GridCellClickContext = {
    mode,
    canInvoke: canInvokeCellClick && (behaviorAllowsCellClick || scopedEditCellClick),
    isRowDisabled,
    onInvoke: onCellClick,
    navigate,
    onBeforeNavigate,
  };

  switch (cellKind) {
    case 'avatar':
      return <DesignerGridAvatarCell row={row} column={column} context={clickContext} />;
    case 'hwy-member-face':
      return (
        <HwyMemberDirectoryGridFaceCell
          row={row}
          fields={column.cellFields}
          listScopeLegacy={hwyMemberDirectoryListScopeLegacy}
          allowRegistrationPersonalPhotoFallback={allowRegistrationPersonalPhotoFallback}
          canClick={Boolean(clickContext.canInvoke)
            && clickContext.mode !== 'design'
            && !clickContext.isRowDisabled}
          onInvoke={() => clickContext.onInvoke?.()}
        />
      );
    case 'hwy-imagefix-thumbs':
      return (
        <HwyImageFixRegistrationThumbsCell
          row={row}
          fields={column.cellFields}
        />
      );
    case 'hwy-imagefix-member-actions':
      return <HwyImageFixMemberActionsCell row={row} />;
    case 'hwy-member-personal-documents-link':
      return <HwyMemberPersonalDocumentsLinkCell row={row} />;
    case 'file-tile':
      return <DesignerGridFileTileCell row={row} column={column} />;
    case 'account':
      return <DesignerGridAccountCell row={row} column={column} context={clickContext} />;
    case 'link':
      return <DesignerGridLinkCell row={row} column={column} context={clickContext} />;
    case 'lookup':
      return <DesignerGridLookupCell row={row} column={column} />;
    case 'status-badge':
      return <DesignerGridStatusBadgeCell row={row} column={column} context={clickContext} />;
    case 'hwy-registered-icon': {
      const registeredFields = column.cellFields;
      return (
        <HwyHouseholdRegisteredIconCell
          title={readDesignerGridRowString(row, registeredFields?.primaryField || 'nakhebinJoinTasjilStateCodeTitle')}
          code={readDesignerGridRowString(row, registeredFields?.secondaryField || 'nakhebinJoinTasjilStateCode')}
        />
      );
    }
    case 'icon-from-lookup':
      return (
        <DesignerGridIconFromLookupCell
          row={row}
          column={column}
          designerStore={designerStore}
        />
      );
    case 'chips':
      return <DesignerGridChipsCell row={row} column={column} context={clickContext} />;
    case 'audit':
      return <DesignerGridAuditCell row={row} column={column} />;
    case 'lock-status':
      return <DesignerGridLockStatusCell row={row} column={column} context={clickContext} />;
    default: {
      const raw = readDesignerGridRowField(row, column.key);
      if (isDesignerGridPhoneColumnKey(column.key) && raw != null && String(raw).trim()) {
        return (
          <PhoneNumberDisplay
            phone={String(raw)}
            badgeSize="compact"
            className="max-w-full"
            textClassName={cn(HWY_PHONE_TEXT_GRID_PRIMARY_CLASS)}
          />
        );
      }
      return <>{raw ?? ''}</>;
    }
  }
};
