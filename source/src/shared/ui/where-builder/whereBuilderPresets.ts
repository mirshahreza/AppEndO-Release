import type { UiWhereBuilderProps } from './UiWhereBuilder';

/** Shared query-builder chrome from Base Components → where-builder. */
export const WHERE_BUILDER_QUERY_CHROME: Pick<
  UiWhereBuilderProps,
  | 'density'
  | 'allowNestedGroups'
  | 'showPreview'
  | 'allowManualNodes'
  | 'showTreeLines'
  | 'showGroupBoxes'
  | 'allowReorder'
> = {
  density: 'default',
  allowNestedGroups: true,
  showPreview: true,
  allowManualNodes: true,
  showTreeLines: false,
  showGroupBoxes: false,
  allowReorder: true,
};

/** Record-policy predicates use the same chrome with a closed AST (no manual nodes). */
export const WHERE_BUILDER_RECORD_POLICY_CHROME: typeof WHERE_BUILDER_QUERY_CHROME = {
  ...WHERE_BUILDER_QUERY_CHROME,
  allowManualNodes: false,
};

/** List Filter dialog — nested AND/OR, no manual SQL, preview lives on header 2. */
export const WHERE_BUILDER_LIST_FILTER_CHROME: typeof WHERE_BUILDER_QUERY_CHROME = {
  density: 'default',
  allowNestedGroups: true,
  showPreview: false,
  allowManualNodes: false,
  showTreeLines: true,
  showGroupBoxes: false,
  allowReorder: true,
};
