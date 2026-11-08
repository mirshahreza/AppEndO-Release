import { resolveHwyMemberFaceCaption } from '../hwy/hwyMemberFaceCaptionDisplay';
import { getHashChipClass } from '../../shared/lib/hashChipPalette';
import {
  readHwyNakhebinVoterNameLine1,
  readHwyNakhebinVoterNameLine2,
} from '../../shared/lib/hwyNakhebinVoterDisplay';
import { APP_TABLE_GRID_AUDIT_COLUMN_WIDTH } from '../../shared/ui/surfaceClasses';
import type { DesignerDataGridColumn, DesignerDataGridColumnCellKind } from './designerDataGridColumns';
import type { DesignerGridRowActionBehavior } from './designerGridActionColumns';

export const DESIGNER_GRID_RICH_CELL_KINDS = [
  'avatar',
  'account',
  'link',
  'lookup',
  'status-badge',
  'icon-from-lookup',
  'chips',
  'audit',
  'lock-status',
  'file-tile',
  'hwy-registered-icon',
  'hwy-member-face',
  'hwy-imagefix-thumbs',
  'hwy-imagefix-member-actions',
  'hwy-member-personal-documents-link',
] as const;

export type DesignerGridRichCellKind = typeof DESIGNER_GRID_RICH_CELL_KINDS[number];

export type DesignerGridChipColorMode = 'fixed-two-tone' | 'hash-palette';

export type DesignerGridLookupEntry = {
  value: string;
  label: string;
  uiHtml?: string;
};

export type DesignerGridRichCellFields = {
  imageUrlField?: string;
  fallbackTextField?: string;
  /** Shown under avatar image (e.g. membership username). */
  captionField?: string;
  /** When `captionField` is empty (e.g. pending activation), show this under the avatar instead. */
  captionFallbackField?: string;
  /** Muted second line under caption (e.g. member id). */
  captionSecondaryField?: string;
  /** When empty, render em dash instead of avatar chrome. */
  visibleWhenField?: string;
  /** Platform base_info gender code for default avatar when image is missing. */
  genderCodeField?: string;
  /** Avatar image box size in px (default 52). */
  avatarSizePx?: number;
  primaryField?: string;
  secondaryField?: string;
  /** Third stacked line (e.g. membership date under member name on HWY segment lists). */
  tertiaryField?: string;
  tertiaryKind?: 'membership-date';
  badgeField?: string;
  labelField?: string;
  labelFallbackField?: string;
  valuesField?: string;
  dateField?: string;
  /** Optional second date under `dateField` (e.g. created + updated stack). */
  secondaryDateField?: string;
  actorUsernameField?: string;
  actorIdField?: string;
  lockedField?: string;
  lockedAtField?: string;
  lockedByUsernameField?: string;
  lockedByField?: string;
  unlockedAtField?: string;
  unlockedByUsernameField?: string;
  unlockedByField?: string;
  /** Optional deep-link template for link cells, e.g. `/studio/cms/contents/edit/{id}` */
  hrefTemplate?: string;
  /** Optional HTML badge payload (e.g. Base Info ui_html enrichment). */
  htmlField?: string;
  /** Optional hex color field for status-badge chrome (e.g. Base Info ui_color enrichment). */
  colorField?: string;
  /** LOV / Base Info registry id for `icon-from-lookup` cells. */
  lookupSource?: string;
  /** Row field whose value maps into the lookup catalog. */
  valueField?: string;
  /** When true, show the lookup label as a tooltip on the icon. */
  showTooltip?: boolean;
  /** Lucide icon name used when the lookup miss has no uiHtml. */
  fallbackIcon?: string;
  /** Static lookup catalog (also used by Export — embedded in column JSON). */
  lookupEntries?: DesignerGridLookupEntry[];
  /** Chips color strategy — default `fixed-two-tone` preserves legacy ADMIN/slate. */
  colorMode?: DesignerGridChipColorMode;
  /** Truncate each chip label to N chars (e.g. 3 → Users role chips). */
  truncateLabelChars?: number;
  /** When truncation shortens a label, show the full value as a tooltip. */
  showTooltipOnTruncate?: boolean;
  /** Overlap chips with negative margin + white border (Users roles style). */
  overlapMode?: boolean;
  /** Preview / data-URL field for `file-tile` image thumbnails. */
  previewUrlField?: string;
  /** File name field for `file-tile` (truncated caption). */
  fileNameField?: string;
  /** MIME type field for `file-tile` icon / image detection. */
  mimeField?: string;
  /** Strip borders/padding from image tiles (gallery strip). */
  bareTile?: boolean;
  /** `stacked-text`: primary + secondary lines without email/username icons; `stacked-text-lg` = text-xs bold primary (Member column). */
  accountLayout?: 'email-username' | 'stacked-text' | 'stacked-text-lg' | 'stacked-text-center';
  /** Member-directory electoral column: show this row field when `electoralDivisionPath` is empty. */
  electoralFallbackField?: string;
};

export const DESIGNER_GRID_RICH_CELL_KIND_OPTIONS: ReadonlyArray<{
  value: DesignerGridRichCellKind;
  label: string;
}> = [
  { value: 'avatar', label: 'Avatar' },
  { value: 'account', label: 'Account (email + username)' },
  { value: 'link', label: 'Clickable link' },
  { value: 'lookup', label: 'Lookup title' },
  { value: 'status-badge', label: 'Status badge (HTML)' },
  { value: 'icon-from-lookup', label: 'Icon from lookup' },
  { value: 'chips', label: 'Chips (roles)' },
  { value: 'audit', label: 'Audit (date + actor / dual date)' },
  { value: 'lock-status', label: 'Lock status' },
  { value: 'file-tile', label: 'File tile (image / icon)' },
];

export const DESIGNER_GRID_CHIP_COLOR_MODE_OPTIONS: ReadonlyArray<{
  value: DesignerGridChipColorMode;
  label: string;
}> = [
  { value: 'fixed-two-tone', label: 'Fixed two-tone (ADMIN / other)' },
  { value: 'hash-palette', label: 'Hash palette (8 colors)' },
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readTrimmedString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const parseLookupEntries = (value: unknown): DesignerGridLookupEntry[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const entries = value
    .map((entry) => {
      if (!isRecord(entry)) {
        return null;
      }
      const entryValue = readTrimmedString(entry.value);
      if (!entryValue) {
        return null;
      }
      const label = readTrimmedString(entry.label) ?? entryValue;
      const uiHtml = readTrimmedString(entry.uiHtml);
      return {
        value: entryValue,
        label,
        ...(uiHtml ? { uiHtml } : {}),
      } satisfies DesignerGridLookupEntry;
    })
    .filter((entry): entry is DesignerGridLookupEntry => entry !== null);

  return entries.length > 0 ? entries : undefined;
};

const parseChipColorMode = (value: unknown): DesignerGridChipColorMode | undefined => {
  if (value === 'fixed-two-tone' || value === 'hash-palette') {
    return value;
  }
  return undefined;
};

const parseOptionalBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === 'boolean') {
    return value;
  }
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  return undefined;
};

const parseOptionalPositiveInt = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.floor(parsed);
    }
  }
  return undefined;
};

export const parseDesignerGridRichCellFields = (value: unknown): DesignerGridRichCellFields | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  const fields: DesignerGridRichCellFields = {};
  const assign = (key: keyof DesignerGridRichCellFields) => {
    const next = readTrimmedString(value[key]);
    if (next) {
      (fields as Record<string, unknown>)[key] = next;
    }
  };

  assign('imageUrlField');
  assign('fallbackTextField');
  assign('captionField');
  assign('captionFallbackField');
  assign('captionSecondaryField');
  assign('visibleWhenField');
  assign('genderCodeField');

  const avatarSizePx = parseOptionalPositiveInt(value.avatarSizePx);
  if (avatarSizePx !== undefined) {
    fields.avatarSizePx = avatarSizePx;
  }


  assign('primaryField');
  assign('secondaryField');
  assign('electoralFallbackField');
  assign('badgeField');
  assign('labelField');
  assign('labelFallbackField');
  assign('valuesField');
  assign('dateField');
  assign('secondaryDateField');
  assign('actorUsernameField');
  assign('actorIdField');
  assign('lockedField');
  assign('lockedAtField');
  assign('lockedByUsernameField');
  assign('lockedByField');
  assign('unlockedAtField');
  assign('unlockedByUsernameField');
  assign('unlockedByField');
  assign('hrefTemplate');
  assign('htmlField');
  assign('colorField');
  assign('lookupSource');
  assign('valueField');
  assign('fallbackIcon');
  assign('previewUrlField');
  assign('fileNameField');
  assign('mimeField');

  const bareTile = parseOptionalBoolean(value.bareTile);
  if (bareTile !== undefined) {
    fields.bareTile = bareTile;
  }

  const showTooltip = parseOptionalBoolean(value.showTooltip);
  if (showTooltip !== undefined) {
    fields.showTooltip = showTooltip;
  }

  const lookupEntries = parseLookupEntries(value.lookupEntries);
  if (lookupEntries) {
    fields.lookupEntries = lookupEntries;
  }

  const colorMode = parseChipColorMode(value.colorMode);
  if (colorMode) {
    fields.colorMode = colorMode;
  }

  const truncateLabelChars = parseOptionalPositiveInt(value.truncateLabelChars);
  if (truncateLabelChars !== undefined) {
    fields.truncateLabelChars = truncateLabelChars;
  }

  const showTooltipOnTruncate = parseOptionalBoolean(value.showTooltipOnTruncate);
  if (showTooltipOnTruncate !== undefined) {
    fields.showTooltipOnTruncate = showTooltipOnTruncate;
  }

  const accountLayout = value.accountLayout;
  if (
    accountLayout === 'email-username'
    || accountLayout === 'stacked-text'
    || accountLayout === 'stacked-text-lg'
    || accountLayout === 'stacked-text-center'
  ) {
    fields.accountLayout = accountLayout;
  }

  const tertiaryField = readTrimmedString(value.tertiaryField);
  if (tertiaryField) {
    fields.tertiaryField = tertiaryField;
  }
  if (value.tertiaryKind === 'membership-date') {
    fields.tertiaryKind = 'membership-date';
  }

  const overlapMode = parseOptionalBoolean(value.overlapMode);
  if (overlapMode !== undefined) {
    fields.overlapMode = overlapMode;
  }

  return Object.keys(fields).length > 0 ? fields : undefined;
};

/** Resolve `{field}` tokens in a link cell href template from the row. */
export const resolveDesignerGridHrefTemplate = (
  template: string,
  row: Record<string, unknown>,
): string => {
  const trimmed = template.trim();
  if (!trimmed) {
    return '';
  }
  return trimmed.replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, fieldKey: string) => {
    const raw = row[fieldKey];
    if (raw == null) {
      return '';
    }
    return encodeURIComponent(String(raw));
  });
};

/** Resolve `{field}` tokens in a rich-cell label template from the row (no URI-encoding). */
export const resolveDesignerGridLabelTemplate = (
  template: string,
  row: Record<string, unknown>,
): string => {
  const trimmed = template.trim();
  if (!trimmed) {
    return '';
  }
  return trimmed.replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, fieldKey: string) => {
    const raw = row[fieldKey];
    return raw == null ? '' : String(raw);
  });
};

/** Small pill badge values read from a comma-separated list of row field keys. */
export const readDesignerGridMetaBadgeValues = (
  row: Record<string, unknown>,
  metaBadgeFields: string | undefined,
): string[] => (metaBadgeFields ?? '')
  .split(',')
  .map((key) => key.trim())
  .filter(Boolean)
  .map((key) => readDesignerGridRowString(row, key))
  .filter((value) => value.length > 0);

export const isRichCellKind = (
  cellKind: DesignerDataGridColumnCellKind | undefined,
): cellKind is DesignerGridRichCellKind =>
  cellKind !== undefined && (DESIGNER_GRID_RICH_CELL_KINDS as readonly string[]).includes(cellKind);

export const richCellKindSupportsClick = (cellKind: DesignerGridRichCellKind | undefined): boolean =>
  cellKind === 'link'
  || cellKind === 'status-badge'
  || cellKind === 'chips'
  || cellKind === 'lock-status';

export const designerGridColumnHasCellClickBehavior = (
  column: DesignerDataGridColumn,
): boolean => Boolean(column.cellClickBehavior) && column.cellClickBehavior?.kind !== 'none';

/** Whether a rich/plain column should wire `onCellClick` (account, avatar, or plain + behavior). */
export const designerGridColumnAllowsCellClickInvoke = (
  column: DesignerDataGridColumn,
  cellKind: DesignerGridRichCellKind | undefined,
): boolean => {
  if (richCellKindSupportsClick(cellKind)) {
    return designerGridColumnHasCellClickBehavior(column)
      || Boolean(column.cellClickActionId?.trim())
      || (cellKind === 'link' && Boolean(column.cellFields?.hrefTemplate?.trim()));
  }
  if (!designerGridColumnHasCellClickBehavior(column)) {
    return false;
  }
  return cellKind === 'avatar'
    || cellKind === 'hwy-member-face'
    || cellKind === 'hwy-imagefix-thumbs'
    || cellKind === 'account'
    || cellKind === undefined;
};

export const readDesignerGridRowField = (
  row: Record<string, unknown>,
  fieldKey?: string,
): unknown => {
  const key = fieldKey?.trim();
  if (!key) {
    return undefined;
  }
  return row[key];
};

export const readDesignerGridRowString = (
  row: Record<string, unknown>,
  fieldKey?: string,
): string => {
  const raw = readDesignerGridRowField(row, fieldKey);
  if (raw == null || raw === '') {
    return '';
  }
  return String(raw).trim();
};

export const readDesignerGridRowBoolean = (
  row: Record<string, unknown>,
  fieldKey?: string,
): boolean => {
  const raw = readDesignerGridRowField(row, fieldKey);
  if (typeof raw === 'boolean') {
    return raw;
  }
  return raw === 'true' || raw === 1 || raw === '1';
};

export const readDesignerGridChipValues = (
  row: Record<string, unknown>,
  fieldKey?: string,
): string[] => {
  const raw = readDesignerGridRowField(row, fieldKey);
  if (Array.isArray(raw)) {
    return raw.map((entry) => String(entry).trim()).filter((entry) => entry.length > 0);
  }
  if (typeof raw === 'string') {
    return raw.split(',').map((entry) => entry.trim()).filter((entry) => entry.length > 0);
  }
  return [];
};

export const readDesignerGridDisplayLabel = (
  row: Record<string, unknown>,
  fields: DesignerGridRichCellFields | undefined,
): string => {
  const template = fields?.labelTemplate?.trim();
  if (template) {
    return resolveDesignerGridLabelTemplate(template, row);
  }
  const primary = readDesignerGridRowString(row, fields?.labelField);
  if (primary) {
    return primary;
  }
  return readDesignerGridRowString(row, fields?.labelFallbackField);
};

const isLookupEntryRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const normalizeLookupCatalog = (raw: unknown): DesignerGridLookupEntry[] => {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map((entry) => {
      if (!isLookupEntryRecord(entry)) {
        return null;
      }
      const value = String(
        entry.value ?? entry.id ?? entry.code ?? '',
      ).trim();
      if (!value) {
        return null;
      }
      const label = String(entry.label ?? entry.title ?? entry.textValue ?? value).trim() || value;
      const uiHtmlRaw = entry.uiHtml ?? entry.ui_html;
      const uiHtml = typeof uiHtmlRaw === 'string' && uiHtmlRaw.trim().length > 0
        ? uiHtmlRaw.trim()
        : undefined;
      return {
        value,
        label,
        ...(uiHtml ? { uiHtml } : {}),
      } satisfies DesignerGridLookupEntry;
    })
    .filter((entry): entry is DesignerGridLookupEntry => entry !== null);
};

/**
 * Resolve an `icon-from-lookup` cell: match row value against embedded catalog,
 * optional designerStore LOV cache, then row enrichment (htmlField / labelField).
 */
export const resolveDesignerGridIconFromLookup = (
  row: Record<string, unknown>,
  fields: DesignerGridRichCellFields | undefined,
  columnKey: string,
  designerStore?: Record<string, unknown>,
): DesignerGridLookupEntry | null => {
  const valueKey = fields?.valueField?.trim() || columnKey;
  const value = readDesignerGridRowString(row, valueKey);
  if (!value) {
    return null;
  }

  const embedded = fields?.lookupEntries ?? [];
  const fromEmbedded = embedded.find((entry) => entry.value === value);
  if (fromEmbedded) {
    return fromEmbedded;
  }

  if (designerStore) {
    const lookupSource = fields?.lookupSource?.trim();
    if (lookupSource) {
      const candidates: unknown[] = [
        designerStore[`lovCache.${lookupSource}`],
        (designerStore.lovCache as Record<string, unknown> | undefined)?.[lookupSource],
        designerStore[lookupSource],
      ];
      // Nested path: lovCache.person-types style keys already covered; also try dotted read.
      if (lookupSource.includes('.')) {
        const segments = lookupSource.split('.').map((segment) => segment.trim()).filter(Boolean);
        let cursor: unknown = designerStore;
        for (const segment of segments) {
          if (cursor && typeof cursor === 'object' && segment in (cursor as Record<string, unknown>)) {
            cursor = (cursor as Record<string, unknown>)[segment];
          } else {
            cursor = undefined;
            break;
          }
        }
        candidates.push(cursor);
      }

      for (const candidate of candidates) {
        const catalog = normalizeLookupCatalog(candidate);
        const match = catalog.find((entry) => entry.value === value);
        if (match) {
          return match;
        }
      }
    }
  }

  const html = readDesignerGridRowString(row, fields?.htmlField);
  const label = readDesignerGridDisplayLabel(row, fields) || value;
  if (html) {
    return { value, label, uiHtml: html };
  }

  if (fields?.fallbackIcon?.trim()) {
    return {
      value,
      label,
      uiHtml: `<i data-lucide="${fields.fallbackIcon.trim()}"></i>`,
    };
  }

  return label && label !== value
    ? { value, label }
    : null;
};

export const resolveDesignerGridChipClass = (
  value: string,
  colorMode: DesignerGridChipColorMode | undefined,
): string => {
  if (colorMode === 'hash-palette') {
    return getHashChipClass(value);
  }
  return value === 'ADMIN' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600';
};

export const resolveDesignerGridChipLabel = (
  value: string,
  truncateLabelChars: number | undefined,
): string => {
  if (truncateLabelChars === undefined || truncateLabelChars <= 0) {
    return value;
  }
  if (value.length <= truncateLabelChars) {
    return value;
  }
  return value.slice(0, truncateLabelChars);
};

export const resolveRichCellSortValue = (
  row: Record<string, unknown>,
  column: DesignerDataGridColumn,
): string | number | boolean | null | undefined => {
  const fields = column.cellFields;
  switch (column.cellKind) {
    case 'account':
      if (fields?.primaryField === 'voterNameLine1') {
        return readHwyNakhebinVoterNameLine1(row).toLowerCase();
      }
      return readDesignerGridRowString(row, fields?.primaryField || column.key).toLowerCase();
    case 'link':
    case 'lookup':
    case 'status-badge':
    case 'icon-from-lookup':
      return (
        readDesignerGridDisplayLabel(row, fields)
        || readDesignerGridRowString(row, fields?.valueField || column.key)
      ).toLowerCase();
    case 'chips':
      return readDesignerGridChipValues(row, fields?.valuesField || column.key).join(' ').toLowerCase();
    case 'audit':
      return readDesignerGridRowString(row, fields?.dateField || column.key);
    case 'lock-status':
      return readDesignerGridRowBoolean(row, fields?.lockedField);
    case 'avatar':
      return (
        readDesignerGridRowString(row, fields?.captionField)
        || readDesignerGridRowString(row, fields?.captionFallbackField)
        || readDesignerGridRowString(row, fields?.fallbackTextField)
      ).toLowerCase();
    case 'hwy-member-face':
      return resolveHwyMemberFaceCaption(row, fields).text.toLowerCase();
    case 'file-tile':
      return readDesignerGridRowString(row, fields?.fileNameField || column.key).toLowerCase();
    default:
      return row[column.key] as string | number | boolean | null | undefined;
  }
};

export const resolveRichCellFilterValue = (
  row: Record<string, unknown>,
  column: DesignerDataGridColumn,
): string | number | boolean | null | undefined => {
  const fields = column.cellFields;
  switch (column.cellKind) {
    case 'account': {
      if (fields?.primaryField === 'voterNameLine1') {
        const primary = readHwyNakhebinVoterNameLine1(row);
        const secondary = readHwyNakhebinVoterNameLine2(row);
        return `${primary} ${secondary}`.trim();
      }
      const primary = readDesignerGridRowString(row, fields?.primaryField || column.key);
      const secondary = readDesignerGridRowString(row, fields?.secondaryField);
      return `${primary} ${secondary}`.trim();
    }
    case 'link':
    case 'lookup':
    case 'status-badge':
    case 'icon-from-lookup':
      return (
        readDesignerGridDisplayLabel(row, fields)
        || readDesignerGridRowString(row, fields?.valueField || column.key)
      );
    case 'chips':
      return readDesignerGridChipValues(row, fields?.valuesField || column.key).join(' ');
    case 'audit':
      return readDesignerGridRowString(row, fields?.dateField || column.key);
    case 'lock-status':
      return readDesignerGridRowBoolean(row, fields?.lockedField) ? 'true' : 'false';
    case 'avatar':
      return readDesignerGridRowString(row, fields?.captionField)
        || readDesignerGridRowString(row, fields?.captionFallbackField)
        || readDesignerGridRowString(row, fields?.fallbackTextField);
    case 'hwy-member-face':
      return resolveHwyMemberFaceCaption(row, fields).text;
    case 'file-tile':
      return readDesignerGridRowString(row, fields?.fileNameField || column.key);
    default:
      return row[column.key] as string | number | boolean | null | undefined;
  }
};

export const defaultRichCellFieldsForKind = (
  cellKind: DesignerGridRichCellKind,
): DesignerGridRichCellFields => {
  switch (cellKind) {
    case 'avatar':
      return { imageUrlField: 'avatar_url', fallbackTextField: 'username' };
    case 'account':
      return { primaryField: 'email', secondaryField: 'username', badgeField: 'is_builtin' };
    case 'link':
      return { labelField: 'full_name', labelFallbackField: 'username' };
    case 'icon-from-lookup':
      return {
        valueField: 'person_type_code',
        lookupSource: '',
        showTooltip: true,
        fallbackIcon: 'CircleHelp',
      };
    case 'chips':
      return {
        valuesField: 'roles',
        colorMode: 'fixed-two-tone',
        showTooltipOnTruncate: false,
        overlapMode: false,
      };
    case 'audit':
      return { dateField: 'created_at', actorUsernameField: 'created_by_username', actorIdField: 'created_by' };
    case 'lock-status':
      return {
        lockedField: 'locked',
        lockedAtField: 'locked_at',
        lockedByUsernameField: 'locked_by_username',
        lockedByField: 'locked_by',
        unlockedAtField: 'unlocked_at',
        unlockedByUsernameField: 'unlocked_by_username',
        unlockedByField: 'unlocked_by',
      };
    case 'file-tile':
      return {
        previewUrlField: 'filePreviewUrl',
        fileNameField: 'fileName',
        mimeField: 'fileMime',
      };
    default:
      return {};
  }
};

export const USERS_AVATAR_COLUMN_PRESET: DesignerDataGridColumn = {
  key: 'image',
  label: '',
  width: '62px',
  cardRole: 'meta',
  cellKind: 'avatar',
  cellFields: defaultRichCellFieldsForKind('avatar'),
  sort: false,
  filter: false,
  layoutHideable: true,
};

export const USERS_ACCOUNT_COLUMN_PRESET: DesignerDataGridColumn = {
  key: 'email',
  label: 'Account',
  cardRole: 'title',
  cellKind: 'account',
  cellFields: defaultRichCellFieldsForKind('account'),
  sort: true,
  filter: true,
  filterType: 'text',
};

export const USERS_PROFILE_LINK_COLUMN_PRESET: DesignerDataGridColumn = {
  key: 'full_name',
  label: 'Profile',
  cardRole: 'subtitle',
  cellKind: 'link',
  cellFields: defaultRichCellFieldsForKind('link'),
  cellClickActionId: 'edit-profile',
  sort: true,
  filter: true,
  filterType: 'text',
};

export const USERS_PERSON_TYPE_ICON_COLUMN_PRESET: DesignerDataGridColumn = {
  key: 'person_type_code',
  label: '',
  width: '34px',
  cardRole: 'hidden',
  cellKind: 'icon-from-lookup',
  cellFields: {
    valueField: 'person_type_code',
    lookupSource: 'person-types',
    showTooltip: true,
    fallbackIcon: 'CircleHelp',
    htmlField: 'person_type_uiHtml',
    labelField: 'person_type_label',
  },
  sort: false,
  filter: false,
};

export const USERS_ROLES_CHIPS_COLUMN_PRESET: DesignerDataGridColumn = {
  key: 'roles',
  label: 'Roles',
  cardRole: 'field',
  cellKind: 'chips',
  cellFields: {
    valuesField: 'roles',
    colorMode: 'hash-palette',
    truncateLabelChars: 3,
    showTooltipOnTruncate: true,
    overlapMode: true,
  },
  cellClickActionId: 'edit-roles',
  filter: true,
  filterType: 'text',
};

export const USERS_LOCK_STATUS_COLUMN_PRESET: DesignerDataGridColumn = {
  key: 'locked',
  label: 'Lock Status',
  cardRole: 'field',
  cellKind: 'lock-status',
  cellFields: defaultRichCellFieldsForKind('lock-status'),
  cellClickActionId: 'toggle-locked',
  filter: true,
  filterType: 'boolean',
};

export const USERS_CREATED_AUDIT_COLUMN_PRESET: DesignerDataGridColumn = {
  key: 'created_at',
  label: 'Created',
  width: `${APP_TABLE_GRID_AUDIT_COLUMN_WIDTH}px`,
  hideBelow: 'lg',
  cardRole: 'meta',
  cellKind: 'audit',
  cellFields: {
    dateField: 'created_at',
    actorUsernameField: 'created_by_username',
    actorIdField: 'created_by',
  },
  sort: true,
  filter: true,
  filterType: 'dateRange',
};

export const USERS_UPDATED_AUDIT_COLUMN_PRESET: DesignerDataGridColumn = {
  key: 'updated_at',
  label: 'Updated',
  width: `${APP_TABLE_GRID_AUDIT_COLUMN_WIDTH}px`,
  hideBelow: 'lg',
  cardRole: 'meta',
  cellKind: 'audit',
  cellFields: {
    dateField: 'updated_at',
    actorUsernameField: 'updated_by_username',
    actorIdField: 'updated_by',
  },
  sort: true,
  filter: true,
  filterType: 'dateRange',
};

export const USERS_RICH_COLUMNS_PRESET: DesignerDataGridColumn[] = [
  USERS_AVATAR_COLUMN_PRESET,
  USERS_PERSON_TYPE_ICON_COLUMN_PRESET,
  USERS_ACCOUNT_COLUMN_PRESET,
  USERS_PROFILE_LINK_COLUMN_PRESET,
  USERS_ROLES_CHIPS_COLUMN_PRESET,
  USERS_LOCK_STATUS_COLUMN_PRESET,
  USERS_CREATED_AUDIT_COLUMN_PRESET,
  USERS_UPDATED_AUDIT_COLUMN_PRESET,
];

export { parseDesignerGridRowActionBehavior as parseDesignerGridCellClickBehavior } from './designerGridActionColumns';

export type DesignerGridCellClickConfig = {
  cellClickBehavior?: DesignerGridRowActionBehavior;
  cellClickActionId?: string;
};
