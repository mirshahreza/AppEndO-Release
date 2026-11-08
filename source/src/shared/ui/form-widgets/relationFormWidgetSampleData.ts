import type {
  RelationFormWidgetOptionItem,
  RelationFormWidgetRow,
  RelationLookupColumn,
  RelationLookupRecord,
} from './relationFormWidgetTypes';

/** Shared sample related records for relation form widget demos and sandbox. */
export const RELATION_FORM_WIDGET_SAMPLE_OPTIONS: readonly RelationFormWidgetOptionItem[] = [
  { id: 'opt-news', label: 'News' },
  { id: 'opt-product', label: 'Product' },
  { id: 'opt-guide', label: 'Guide' },
  { id: 'opt-release', label: 'Release' },
  { id: 'opt-internal', label: 'Internal' },
];

/** Default columns for the flexible lookup dialog grid. */
export const RELATION_LOOKUP_SAMPLE_COLUMNS: readonly RelationLookupColumn[] = [
  { id: 'title', label: 'Title', isRowHeader: true },
  { id: 'code', label: 'Code', width: 96 },
  { id: 'category', label: 'Category', width: 112 },
  { id: 'status', label: 'Status', width: 100 },
  { id: 'updatedAt', label: 'Updated', width: 108 },
];

const LOOKUP_SEED: readonly RelationLookupRecord[] = [
  {
    id: 'opt-news',
    label: 'News',
    values: {
      title: 'News',
      code: 'NEWS',
      category: 'Editorial',
      status: 'Published',
      updatedAt: '2026-07-12',
    },
  },
  {
    id: 'opt-product',
    label: 'Product',
    values: {
      title: 'Product',
      code: 'PRD',
      category: 'Catalog',
      status: 'Published',
      updatedAt: '2026-07-18',
    },
  },
  {
    id: 'opt-guide',
    label: 'Guide',
    values: {
      title: 'Guide',
      code: 'GDE',
      category: 'Help',
      status: 'Draft',
      updatedAt: '2026-07-20',
    },
  },
  {
    id: 'opt-release',
    label: 'Release',
    values: {
      title: 'Release',
      code: 'REL',
      category: 'Ops',
      status: 'Published',
      updatedAt: '2026-07-22',
    },
  },
  {
    id: 'opt-internal',
    label: 'Internal',
    values: {
      title: 'Internal',
      code: 'INT',
      category: 'Private',
      status: 'Archived',
      updatedAt: '2026-06-30',
    },
  },
  {
    id: 'opt-faq',
    label: 'Operator FAQ',
    values: {
      title: 'Operator FAQ',
      code: 'FAQ',
      category: 'Help',
      status: 'Published',
      updatedAt: '2026-07-24',
    },
  },
];

const LOOKUP_CATEGORIES = ['Editorial', 'Catalog', 'Help', 'Ops', 'Private'] as const;
const LOOKUP_STATUSES = ['Published', 'Draft', 'Archived'] as const;

/** Rich sample rows for lookup grid demos (enough rows to exercise paging). */
export const RELATION_LOOKUP_SAMPLE_RECORDS: readonly RelationLookupRecord[] = (() => {
  const rows: RelationLookupRecord[] = [...LOOKUP_SEED];
  for (let index = 1; index <= 72; index += 1) {
    const category = LOOKUP_CATEGORIES[index % LOOKUP_CATEGORIES.length];
    const status = LOOKUP_STATUSES[index % LOOKUP_STATUSES.length];
    const day = String((index % 28) + 1).padStart(2, '0');
    const code = `R${String(index).padStart(3, '0')}`;
    const title = `Related record ${index}`;
    rows.push({
      id: `opt-extra-${index}`,
      label: title,
      values: {
        title,
        code,
        category,
        status,
        updatedAt: `2026-07-${day}`,
      },
    });
  }
  return rows;
})();

/** Shared sample child rows for has-many / has-one nested editor demos. */
export const RELATION_FORM_WIDGET_SAMPLE_ROWS: readonly RelationFormWidgetRow[] = [
  { id: 'row-1', title: 'Getting started', status: 'Published' },
  { id: 'row-2', title: 'Release notes', status: 'Draft' },
  { id: 'row-3', title: 'Operator FAQ', status: 'Published' },
];

export const RELATION_FORM_WIDGET_DEFAULT_SINGLE_VALUE = RELATION_FORM_WIDGET_SAMPLE_OPTIONS[0]?.id ?? '';

export const RELATION_FORM_WIDGET_DEFAULT_MULTI_VALUES: readonly string[] = [
  RELATION_FORM_WIDGET_SAMPLE_OPTIONS[0]?.id ?? '',
  RELATION_FORM_WIDGET_SAMPLE_OPTIONS[2]?.id ?? '',
].filter(Boolean);
