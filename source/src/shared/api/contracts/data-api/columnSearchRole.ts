import { z } from 'zod';

/**
 * Where this column participates in list search UIs.
 * - basic: initial / primary list search
 * - advanced: expanded “more search” filters
 * - none: excluded from search
 */
export const COLUMN_SEARCH_ROLE_VALUES = ['basic', 'advanced', 'none'] as const;

export type ColumnSearchRole = (typeof COLUMN_SEARCH_ROLE_VALUES)[number];

export const columnSearchRoleSchema = z.enum(COLUMN_SEARCH_ROLE_VALUES);

export const DEFAULT_COLUMN_SEARCH_ROLE: ColumnSearchRole = 'none';

export type ColumnSearchRoleOption = {
  value: ColumnSearchRole;
  label: string;
  description: string;
};

export const COLUMN_SEARCH_ROLE_OPTIONS: readonly ColumnSearchRoleOption[] = [
  {
    value: 'basic',
    label: 'Basic list search',
    description: 'Included in the initial list search.',
  },
  {
    value: 'advanced',
    label: 'Advanced search',
    description: 'Included only in the expanded / more-search filters.',
  },
  {
    value: 'none',
    label: 'Not in search',
    description: 'Excluded from list search filters.',
  },
];
