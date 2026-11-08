import type { CatalogKind, DesignerVersionSummary } from '../../../shared/api/queries/component-designer';
import {
  BUILTIN_FILTER_ALL,
  BUILTIN_FILTER_NO,
  BUILTIN_FILTER_OPTIONS,
  BUILTIN_FILTER_YES,
  matchesBuiltInFilter,
} from '../../../shared/lib/builtInFilter';
import { isLayoutTemplateSummary } from './builtInComponents';
import { isBuiltInShellPresetId } from './types';

export type { CatalogKind };

export const CATALOG_TAG_BUILTIN = 'builtin';
export const CATALOG_TAG_TEMPLATE = 'template';
export const CATALOG_TAG_SHELL = 'shell';
export const CATALOG_TAG_CUSTOM = 'custom';

export const CATALOG_OPERATOR_KINDS = [CATALOG_TAG_CUSTOM, CATALOG_TAG_SHELL, CATALOG_TAG_TEMPLATE] as const;

export const CATALOG_OPERATOR_KIND_OPTIONS = [
  { value: CATALOG_TAG_CUSTOM, label: 'Custom' },
  { value: CATALOG_TAG_SHELL, label: 'Shell' },
  { value: CATALOG_TAG_TEMPLATE, label: 'Template' },
] as const;

/** Type only — BuiltIn is a separate origin filter. */
export const CATALOG_KIND_FILTER_OPTIONS = CATALOG_OPERATOR_KIND_OPTIONS;

export const CATALOG_BUILTIN_FILTER_YES = BUILTIN_FILTER_YES;
export const CATALOG_BUILTIN_FILTER_NO = BUILTIN_FILTER_NO;
export const CATALOG_BUILTIN_FILTER_OPTIONS = BUILTIN_FILTER_OPTIONS;

/** Empty = All (no filter). ToolbarFilterSelect shows All when value is blank. */
export const DEFAULT_CATALOG_KIND_FILTER = '';
export const DEFAULT_CATALOG_BUILTIN_FILTER = BUILTIN_FILTER_ALL;

type CatalogKindFields = Pick<
  DesignerVersionSummary,
  'isBuiltIn' | 'isPackageComponent' | 'folder' | 'name' | 'catalogKind'
>;

export function parseCatalogKind(value: unknown): CatalogKind {
  if (value === CATALOG_TAG_SHELL || value === CATALOG_TAG_TEMPLATE || value === CATALOG_TAG_CUSTOM) {
    return value;
  }
  return CATALOG_TAG_CUSTOM;
}

export function parseCatalogKindFilter(value: string): string[] {
  return value.split(',').map((part) => part.trim()).filter((part) => part.length > 0);
}

/** Type keys used by the catalog kind filter (never includes BuiltIn). */
export function catalogKindFilterKeys(item: CatalogKindFields): string[] {
  const tags = catalogSystemTags(item).filter((key) => key !== CATALOG_TAG_BUILTIN);
  return tags.length > 0 ? tags : [CATALOG_TAG_CUSTOM];
}

export function catalogItemMatchesKindFilter(item: CatalogKindFields, selectedCsv: string): boolean {
  const selected = new Set(parseCatalogKindFilter(selectedCsv).filter((key) => key !== CATALOG_TAG_BUILTIN));
  if (selected.size === 0) {
    return true;
  }

  return catalogKindFilterKeys(item).some((key) => selected.has(key));
}

export function catalogItemMatchesBuiltInFilter(
  item: Pick<CatalogKindFields, 'isBuiltIn'>,
  selected: string,
): boolean {
  return matchesBuiltInFilter(Boolean(item.isBuiltIn), selected);
}

/** Type markers on catalog cards. Built-ins are derived; operator drafts and package UI use Custom. */
export function catalogSystemTags(item: CatalogKindFields): string[] {
  if (item.isPackageComponent) {
    return [CATALOG_TAG_CUSTOM];
  }

  if (item.isBuiltIn) {
    if (isBuiltInShellPresetId(item.name)) {
      return [CATALOG_TAG_BUILTIN, CATALOG_TAG_SHELL];
    }

    if (isLayoutTemplateSummary(item)) {
      return [CATALOG_TAG_BUILTIN, CATALOG_TAG_TEMPLATE];
    }

    return [CATALOG_TAG_BUILTIN];
  }

  return [parseCatalogKind(item.catalogKind)];
}

/** Persistable type for operator drafts (Custom / Shell / Template). Built-ins stay derived. */
export function resolveOperatorCatalogKind(item: CatalogKindFields): CatalogKind {
  if (item.isBuiltIn) {
    const system = catalogSystemTags(item);
    if (system.includes(CATALOG_TAG_SHELL)) {
      return CATALOG_TAG_SHELL;
    }
    if (system.includes(CATALOG_TAG_TEMPLATE)) {
      return CATALOG_TAG_TEMPLATE;
    }
    return CATALOG_TAG_CUSTOM;
  }

  return parseCatalogKind(item.catalogKind);
}

export function catalogSearchTags(item: CatalogKindFields): string[] {
  return catalogSystemTags(item);
}
