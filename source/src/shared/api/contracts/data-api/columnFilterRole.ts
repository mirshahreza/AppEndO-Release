import { z } from 'zod';

/**
 * Whether a column appears in List Where (`UiWhereBuilder`) for this model.
 * - public: visible to every principal that may list (default)
 * - restricted: only roles/users granted in query-surface bindings
 * - none: excluded from list where builder and server `where` param
 */
export const COLUMN_FILTER_ROLE_VALUES = ['public', 'restricted', 'none'] as const;

export type ColumnFilterRole = (typeof COLUMN_FILTER_ROLE_VALUES)[number];

export const columnFilterRoleSchema = z.enum(COLUMN_FILTER_ROLE_VALUES);

export const DEFAULT_COLUMN_FILTER_ROLE: ColumnFilterRole = 'public';

export type ColumnFilterRoleOption = {
  value: ColumnFilterRole;
  label: string;
  description: string;
};

export const COLUMN_FILTER_ROLE_OPTIONS: readonly ColumnFilterRoleOption[] = [
  {
    value: 'public',
    label: 'Public list filter',
    description: 'Everyone who can list may filter on this column.',
  },
  {
    value: 'restricted',
    label: 'Role-restricted filter',
    description: 'Only assigned roles see this field in List Filter.',
  },
  {
    value: 'none',
    label: 'Not in list filter',
    description: 'Excluded from List Where and the server where tree.',
  },
];
