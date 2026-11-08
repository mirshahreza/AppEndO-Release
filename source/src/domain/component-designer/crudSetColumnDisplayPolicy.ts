/**
 * Display (cellKind) and transform options per dataset field profile.
 * Canonical types: crudSetSpec.ts
 */

import type { ApiFormField } from './apiFieldSchema';
import {
  crudSetColumnCellKind,
  crudSetColumnTransform,
  isCrudSetCellKind,
  isCrudSetColumnTransform,
  type CrudSetCellKind,
  type CrudSetColumnTransform,
  type CrudSetGridColumn,
} from './crudSetSpec';

export type CrudSetFieldProfile =
  | 'text'
  | 'long-text'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'email'
  | 'url'
  | 'phone'
  | 'enum'
  | 'array'
  | 'image'
  | 'lock';

export type CrudSetFieldMeta = Pick<ApiFormField, 'type' | 'format' | 'enum' | 'itemType'>;

const LINK_NAME_RE = /(url|href|link|website|homepage)/i;
const IMAGE_NAME_RE = /(photo|avatar|image|picture|thumb|logo)/i;
const LOCK_NAME_RE = /(^|_)(locked|lock_status|is_locked)($|_)/i;
const EMAIL_NAME_RE = /(^|_)email($|_)|^email$/i;
const PHONE_NAME_RE = /(phone|mobile|tel)/i;
const DATE_NAME_RE = /(date|time|timestamp|created|updated|at)$/i;
const LONG_TEXT_NAME_RE = /(description|comment|note|body|content|summary|bio)/i;

const PROFILE_DISPLAY_KINDS: Record<CrudSetFieldProfile, readonly CrudSetCellKind[]> = {
  text: ['text', 'badge', 'link'],
  'long-text': ['text'],
  number: ['text', 'badge'],
  integer: ['text', 'badge'],
  boolean: ['boolean-icon', 'badge', 'text'],
  date: ['date', 'text', 'audit'],
  datetime: ['date', 'text', 'audit'],
  email: ['link', 'text'],
  url: ['link', 'text'],
  phone: ['link', 'text'],
  enum: ['badge', 'text', 'chips'],
  array: ['chips', 'text'],
  image: ['image', 'text'],
  lock: ['lock-status', 'boolean-icon', 'text'],
};

const CELL_KIND_TRANSFORMS: Record<CrudSetCellKind, readonly CrudSetColumnTransform[]> = {
  text: [
    'none',
    'uppercase',
    'lowercase',
    'title-case',
    'text-truncate',
    'number-grouped',
    'number-compact',
    'number-percent',
  ],
  link: [
    'link-full',
    'link-domain',
    'link-host',
    'link-path',
    'link-file-name',
    'link-go-to',
    'link-open',
    'link-view',
    'link-external',
    'link-custom-label',
    'link-truncate',
    'link-email',
  ],
  date: ['date', 'date-year', 'date-month-year', 'datetime', 'date-custom'],
  badge: ['none', 'uppercase', 'lowercase', 'title-case'],
  chips: ['none', 'chips-comma', 'chips-count'],
  'boolean-icon': ['boolean-yes-no', 'boolean-on-off', 'boolean-true-false'],
  'lock-status': ['none'],
  image: ['none'],
  audit: ['date', 'date-year', 'date-month-year', 'datetime', 'date-custom'],
};

const PROFILE_TEXT_TRANSFORMS: Partial<Record<CrudSetFieldProfile, readonly CrudSetColumnTransform[]>> = {
  number: ['none', 'number-grouped', 'number-compact', 'number-percent'],
  integer: ['none', 'number-grouped', 'number-compact'],
};

const DEFAULT_TRANSFORM_BY_KIND: Partial<Record<CrudSetCellKind, CrudSetColumnTransform>> = {
  date: 'date',
  audit: 'date',
  link: 'link-domain',
  chips: 'none',
  'boolean-icon': 'boolean-yes-no',
};

export const inferCrudSetFieldProfile = (
  fieldName: string,
  meta?: CrudSetFieldMeta,
): CrudSetFieldProfile => {
  const name = fieldName.trim();
  if (meta?.type === 'boolean') {
    return 'boolean';
  }
  if (meta?.type === 'array') {
    return 'array';
  }
  if (meta?.enum && meta.enum.length > 0) {
    return 'enum';
  }
  if (meta?.format === 'date') {
    return 'date';
  }
  if (meta?.format === 'date-time') {
    return 'datetime';
  }
  if (meta?.format === 'email' || EMAIL_NAME_RE.test(name)) {
    return 'email';
  }
  if (meta?.format === 'uri' || meta?.format === 'url' || LINK_NAME_RE.test(name)) {
    return 'url';
  }
  if (meta?.type === 'integer') {
    return 'integer';
  }
  if (meta?.type === 'number') {
    return 'number';
  }
  if (LOCK_NAME_RE.test(name)) {
    return 'lock';
  }
  if (IMAGE_NAME_RE.test(name)) {
    return 'image';
  }
  if (PHONE_NAME_RE.test(name)) {
    return 'phone';
  }
  if (DATE_NAME_RE.test(name)) {
    return 'datetime';
  }
  if (LONG_TEXT_NAME_RE.test(name)) {
    return 'long-text';
  }
  return 'text';
};

export const crudSetAllowedCellKindsForColumn = (
  column: Pick<CrudSetGridColumn, 'field' | 'cellKind'>,
  meta?: CrudSetFieldMeta,
): CrudSetCellKind[] => {
  const profile = inferCrudSetFieldProfile(column.field, meta);
  const allowed = new Set(PROFILE_DISPLAY_KINDS[profile]);
  const current = crudSetColumnCellKind(column);
  const ordered = PROFILE_DISPLAY_KINDS[profile].filter((kind) => allowed.has(kind));
  if (!ordered.includes(current)) {
    ordered.push(current);
  }
  return ordered;
};

export const crudSetAllowedTransformsForColumn = (
  column: CrudSetGridColumn,
  meta?: CrudSetFieldMeta,
): CrudSetColumnTransform[] => {
  const kind = crudSetColumnCellKind(column);
  const profile = inferCrudSetFieldProfile(column.field, meta);
  const base = [...(CELL_KIND_TRANSFORMS[kind] ?? ['none' as const])];
  if (kind === 'text' && PROFILE_TEXT_TRANSFORMS[profile]) {
    const profileTransforms = new Set(PROFILE_TEXT_TRANSFORMS[profile]);
    const merged = base.filter((item) => (
      profileTransforms.has(item)
      || item === 'uppercase'
      || item === 'lowercase'
      || item === 'title-case'
      || item === 'text-truncate'
      || item === 'none'
    ));
    const current = crudSetColumnTransform(column);
    if (!merged.includes(current)) {
      merged.push(current);
    }
    return merged;
  }
  const current = crudSetColumnTransform(column);
  if (!base.includes(current) && kind === 'text') {
    base.push(current);
  }
  return base;
};

export const crudSetDefaultTransformForCellKind = (
  cellKind: CrudSetCellKind,
  profile: CrudSetFieldProfile,
): CrudSetColumnTransform => (
  DEFAULT_TRANSFORM_BY_KIND[cellKind]
  ?? (profile === 'number' || profile === 'integer' ? 'number-grouped' : 'none')
);

export const crudSetCoerceColumnDisplay = (
  column: CrudSetGridColumn,
  meta?: CrudSetFieldMeta,
): CrudSetGridColumn => {
  const profile = inferCrudSetFieldProfile(column.field, meta);
  const profileKinds = PROFILE_DISPLAY_KINDS[profile];
  const cellKind = crudSetColumnCellKind(column);
  const nextKind = profileKinds.includes(cellKind) ? cellKind : profileKinds[0] ?? 'text';
  const draft: CrudSetGridColumn = { ...column, cellKind: nextKind };
  const allowedTransforms = crudSetAllowedTransformsForColumn(draft, meta);
  const transform = crudSetColumnTransform(draft);
  if (!allowedTransforms.includes(transform)) {
    return {
      ...draft,
      transform: crudSetDefaultTransformForCellKind(nextKind, profile),
      transformFormat: undefined,
    };
  }
  return draft;
};

export const crudSetColumnAfterCellKindChange = (
  column: CrudSetGridColumn,
  cellKind: unknown,
  meta?: CrudSetFieldMeta,
): CrudSetGridColumn => {
  const nextKind = isCrudSetCellKind(cellKind) ? cellKind : crudSetColumnCellKind(column);
  const profile = inferCrudSetFieldProfile(column.field, meta);
  const allowedTransforms = crudSetAllowedTransformsForColumn({ ...column, cellKind: nextKind }, meta);
  const current = crudSetColumnTransform({ ...column, cellKind: nextKind });
  const transform = allowedTransforms.includes(current)
    ? current
    : crudSetDefaultTransformForCellKind(nextKind, profile);
  return {
    ...column,
    cellKind: nextKind,
    transform,
    transformFormat: transform === column.transform ? column.transformFormat : undefined,
  };
};

export const crudSetColumnAfterTransformChange = (
  column: CrudSetGridColumn,
  transform: unknown,
  meta?: CrudSetFieldMeta,
): CrudSetGridColumn => {
  const allowed = crudSetAllowedTransformsForColumn(column, meta);
  const next = isCrudSetColumnTransform(transform) && allowed.includes(transform)
    ? transform
    : crudSetDefaultTransformForCellKind(crudSetColumnCellKind(column), inferCrudSetFieldProfile(column.field, meta));
  return {
    ...column,
    transform: next,
    transformFormat: next === column.transform ? column.transformFormat : undefined,
  };
};

export const crudSetTransformUsesFormat = (transform: CrudSetColumnTransform): boolean => (
  transform === 'date-custom'
  || transform === 'link-custom-label'
  || transform === 'link-truncate'
  || transform === 'text-truncate'
);

export const crudSetTransformFormatLabel = (transform: CrudSetColumnTransform): string | null => {
  switch (transform) {
    case 'date-custom':
      return 'Date format';
    case 'link-custom-label':
      return 'Link text';
    case 'link-truncate':
      return 'Max characters';
    case 'text-truncate':
      return 'Max characters';
    default:
      return null;
  }
};

export const crudSetTransformFormatHint = (transform: CrudSetColumnTransform): string | null => {
  switch (transform) {
    case 'date-custom':
      return 'Tokens: YYYY MM DD HH mm ss.';
    case 'link-custom-label':
      return 'Shown in the cell. The href stays the dataset value.';
    case 'link-truncate':
      return 'Default 40. Truncates the visible link text with an ellipsis.';
    case 'text-truncate':
      return 'Default 60. Truncates visible text with an ellipsis.';
    default:
      return null;
  }
};

export const crudSetTransformFormatPlaceholder = (transform: CrudSetColumnTransform): string => {
  switch (transform) {
    case 'date-custom':
      return 'YYYY-MM-DD';
    case 'link-custom-label':
      return 'Go to site';
    case 'link-truncate':
      return '40';
    case 'text-truncate':
      return '60';
    default:
      return '';
  }
};

export const crudSetTransformFormatValue = (column: CrudSetGridColumn): string => {
  const format = column.transformFormat?.trim();
  if (format) {
    return format;
  }
  if (crudSetColumnTransform(column) === 'date-custom') {
    return 'YYYY-MM-DD';
  }
  return '';
};
