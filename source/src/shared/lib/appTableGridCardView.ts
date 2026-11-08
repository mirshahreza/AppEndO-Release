import type { GridCardActionsPlacement } from './gridRowActions';

/** Single built-in card presentation for AppTableGrid. */
export const APP_TABLE_GRID_STANDARD_CARD_VARIANT = 'standard' as const;

export type AppTableGridCardVariant = typeof APP_TABLE_GRID_STANDARD_CARD_VARIANT;

export const APP_TABLE_GRID_CARD_VARIANTS = [APP_TABLE_GRID_STANDARD_CARD_VARIANT] as const;

export const APP_TABLE_GRID_CARD_VARIANT_LABELS: Record<AppTableGridCardVariant, string> = {
  standard: 'Standard',
};

export const isAppTableGridCardVariant = (value: unknown): value is AppTableGridCardVariant => (
  value === APP_TABLE_GRID_STANDARD_CARD_VARIANT
);

export const resolveAppTableGridDefaultCardActionsPlacement = (
  _variant?: AppTableGridCardVariant,
): GridCardActionsPlacement => 'footer';

export const APP_TABLE_GRID_COLUMN_CARD_ROLES = [
  'title',
  'subtitle',
  'meta',
  'field',
  'media',
  'actions',
  'hidden',
] as const;

export type AppTableGridColumnCardRole = (typeof APP_TABLE_GRID_COLUMN_CARD_ROLES)[number];

export const APP_TABLE_GRID_COLUMN_CARD_ROLE_LABELS: Record<AppTableGridColumnCardRole, string> = {
  title: 'Title',
  subtitle: 'Subtitle',
  meta: 'Meta',
  field: 'Field',
  media: 'Media',
  actions: 'Actions',
  hidden: 'Hidden on cards',
};

export const isAppTableGridColumnCardRole = (
  value: unknown,
): value is AppTableGridColumnCardRole => (
  typeof value === 'string' && (APP_TABLE_GRID_COLUMN_CARD_ROLES as readonly string[]).includes(value)
);
