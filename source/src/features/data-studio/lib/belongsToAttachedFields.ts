/** Locale suffixes used by base_info (and similar) localized columns. */
export const BASE_INFO_LOCALE_CODES = ['en', 'fa', 'ar'] as const;

export type BaseInfoLocaleCode = (typeof BASE_INFO_LOCALE_CODES)[number];

/** Culture-aware base_info title — resolves title_en/fa/ar from request culture. */
export const BASE_INFO_CULTURE_TITLE_COLUMN = 'title';

/** Attached target field with output alias (`as`). */
export type RelationAttachedField = {
  sourceColumn: string;
  as: string;
};

/** Default output name: `{foreignKey}_{selectedField}` (e.g. content_type_code_title). */
export const suggestAttachedFieldAsName = (
  foreignKey: string,
  sourceColumn: string,
): string => {
  const field = foreignKey.trim().replace(/[^a-zA-Z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
  const selected = sourceColumn.trim().replace(/[^a-zA-Z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
  if (!field) {
    return selected || 'field';
  }
  if (!selected) {
    return field;
  }
  return `${field}_${selected}`;
};

export const validateRelationAttachedFields = (
  fields: ReadonlyArray<RelationAttachedField>,
  foreignKey = '',
): string | null => {
  const normalized = normalizeRelationAttachedFields(fields, foreignKey);
  if (normalized.some((item) => !item.as.trim())) {
    return 'Each selected field needs an as name.';
  }
  const asNames = normalized.map((item) => item.as.trim().toLowerCase());
  if (new Set(asNames).size !== asNames.length) {
    return 'As names must be unique.';
  }
  if (normalized.some((item) => !/^[A-Za-z_][A-Za-z0-9_]*$/.test(item.as.trim()))) {
    return 'As names must start with a letter or underscore and use only letters, digits, and underscores.';
  }
  return null;
};

export const normalizeRelationAttachedFields = (
  fields: ReadonlyArray<RelationAttachedField | string>,
  foreignKey = '',
): RelationAttachedField[] => {
  const seenSources = new Set<string>();
  const result: RelationAttachedField[] = [];
  for (const item of fields) {
    const sourceColumn = (typeof item === 'string' ? item : item.sourceColumn).trim();
    if (!sourceColumn || seenSources.has(sourceColumn)) {
      continue;
    }
    seenSources.add(sourceColumn);
    const asRaw = typeof item === 'string' ? '' : item.as.trim();
    const suggested = suggestAttachedFieldAsName(foreignKey, sourceColumn);
    // Upgrade legacy rows where `as` was backfilled to the bare source column.
    const asName = !asRaw || (foreignKey && asRaw === sourceColumn)
      ? suggested
      : asRaw;
    result.push({
      sourceColumn,
      as: asName,
    });
  }
  return result;
};

export type LocalizedFieldFamily = {
  stem: string;
  label: string;
  /** Bare stem column (`title`, `note`) when present — means “by culture”. */
  cultureColumn: string | null;
  /** Fixed locale columns in en → fa → ar order. */
  fixedColumns: string[];
  /** All columns belonging to this family (excluded from “Other columns”). */
  allColumns: string[];
};

const LOCALE_CODE_SET = new Set<string>(BASE_INFO_LOCALE_CODES);

const PREFERRED_FAMILY_ORDER = ['title', 'note'];

export const isBaseInfoObject = (objectName: string | null | undefined): boolean => (
  (objectName ?? '').trim().toLowerCase() === 'base_info'
);

export const parseLocalizedColumn = (
  columnName: string,
): { stem: string; locale: BaseInfoLocaleCode } | null => {
  const name = columnName.trim().toLowerCase();
  const match = name.match(/^(.*)_([a-z]{2})$/);
  if (!match) {
    return null;
  }
  const stem = match[1]?.trim() ?? '';
  const locale = match[2] as BaseInfoLocaleCode;
  if (!stem || !LOCALE_CODE_SET.has(locale)) {
    return null;
  }
  return { stem, locale };
};

export const localeCodeLabel = (locale: string): string => locale.trim().toUpperCase();

/** Compact label for attached-field chips on the modeler column box. */
export const formatAttachedFieldChipLabel = (sourceColumn: string): string => {
  const name = sourceColumn.trim();
  if (!name) {
    return '';
  }
  const parsed = parseLocalizedColumn(name);
  if (parsed) {
    return `${parsed.stem}·${localeCodeLabel(parsed.locale)}`;
  }
  // Bare preferred culture stems (`title`, `note`) selected via “by culture”.
  if (PREFERRED_FAMILY_ORDER.includes(name.toLowerCase())) {
    return `${name}·culture`;
  }
  return name;
};

export const humanizeFieldStem = (stem: string): string => {
  const parts = stem.trim().split(/_+/).filter(Boolean);
  if (parts.length === 0) {
    return 'Field';
  }
  return parts
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
};

/**
 * Group columns like title/title_en/title_fa and note/note_ar into families.
 * A family is created only when at least one `stem_xx` locale column exists.
 */
export const buildLocalizedFieldFamilies = (
  columnNames: ReadonlyArray<string>,
): LocalizedFieldFamily[] => {
  const names = columnNames
    .map((name) => name.trim())
    .filter(Boolean);
  const nameSet = new Set(names.map((name) => name.toLowerCase()));
  const originalByLower = new Map(names.map((name) => [name.toLowerCase(), name]));

  const stems = new Set<string>();
  for (const name of nameSet) {
    const parsed = parseLocalizedColumn(name);
    if (parsed) {
      stems.add(parsed.stem);
    }
  }

  const families: LocalizedFieldFamily[] = [];
  for (const stem of stems) {
    const fixedColumns = BASE_INFO_LOCALE_CODES
      .map((code) => `${stem}_${code}`)
      .filter((name) => nameSet.has(name))
      .map((name) => originalByLower.get(name) ?? name);
    if (fixedColumns.length === 0) {
      continue;
    }
    const cultureColumn = nameSet.has(stem)
      ? (originalByLower.get(stem) ?? stem)
      : null;
    families.push({
      stem,
      label: humanizeFieldStem(stem),
      cultureColumn,
      fixedColumns,
      allColumns: [
        ...(cultureColumn ? [cultureColumn] : []),
        ...fixedColumns,
      ],
    });
  }

  return families.sort((left, right) => {
    const leftPreferred = PREFERRED_FAMILY_ORDER.indexOf(left.stem);
    const rightPreferred = PREFERRED_FAMILY_ORDER.indexOf(right.stem);
    if (leftPreferred !== -1 || rightPreferred !== -1) {
      if (leftPreferred === -1) {
        return 1;
      }
      if (rightPreferred === -1) {
        return -1;
      }
      return leftPreferred - rightPreferred;
    }
    return left.stem.localeCompare(right.stem);
  });
};

export const columnBelongsToLocalizedFamily = (
  columnName: string,
  families: ReadonlyArray<LocalizedFieldFamily>,
): boolean => {
  const lower = columnName.trim().toLowerCase();
  return families.some((family) => (
    family.allColumns.some((item) => item.toLowerCase() === lower)
  ));
};

export const findLocalizedFieldFamily = (
  columnName: string,
  families: ReadonlyArray<LocalizedFieldFamily>,
): LocalizedFieldFamily | null => {
  const lower = columnName.trim().toLowerCase();
  return families.find((family) => (
    family.allColumns.some((item) => item.toLowerCase() === lower)
  )) ?? null;
};

/**
 * Toggle an attached column. Within a localized family, the culture stem and
 * fixed `stem_xx` locales are mutually exclusive.
 */
export const toggleAttachedColumnSelection = (
  current: ReadonlyArray<string>,
  columnName: string,
  checked: boolean,
  options?: { families?: ReadonlyArray<LocalizedFieldFamily> },
): string[] => {
  const name = columnName.trim();
  if (!name) {
    return [...current];
  }

  if (!checked) {
    return current.filter((item) => item !== name);
  }

  let next = current.includes(name) ? [...current] : [...current, name];
  const family = findLocalizedFieldFamily(name, options?.families ?? []);
  if (!family) {
    return next;
  }

  const lower = name.toLowerCase();
  if (family.cultureColumn && lower === family.cultureColumn.toLowerCase()) {
    const fixed = new Set(family.fixedColumns.map((item) => item.toLowerCase()));
    next = next.filter((item) => !fixed.has(item.toLowerCase()));
  } else if (family.fixedColumns.some((item) => item.toLowerCase() === lower)) {
    if (family.cultureColumn) {
      next = next.filter((item) => item.toLowerCase() !== family.cultureColumn!.toLowerCase());
    }
  }

  return next;
};
