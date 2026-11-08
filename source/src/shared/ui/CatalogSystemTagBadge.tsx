import * as React from 'react';
import { cn } from '../../lib/utils';
import { ActionTooltip } from './ActionTooltip';
import { DevelopmentCatalogCardBadge } from './DevelopmentCatalogCards';

export const CATALOG_SYSTEM_TAG_KEYS = ['builtin', 'template', 'shell', 'custom'] as const;
export type CatalogSystemTagKey = (typeof CATALOG_SYSTEM_TAG_KEYS)[number];

/** Living sample: Client Components catalog derived system tags. */
export const CATALOG_SYSTEM_TAG_CLASS: Record<CatalogSystemTagKey, string> = {
  builtin: 'border-amber-200 bg-amber-50 text-amber-800',
  template: 'border-cyan-200 bg-cyan-50 text-cyan-800',
  shell: 'border-indigo-200 bg-indigo-50 text-indigo-800',
  custom: 'border-emerald-200 bg-emerald-50 text-emerald-800',
};

export const CATALOG_SYSTEM_TAG_DOT_CLASS: Record<CatalogSystemTagKey, string> = {
  builtin: 'bg-amber-500',
  template: 'bg-cyan-500',
  shell: 'bg-indigo-500',
  custom: 'bg-emerald-500',
};

export const CATALOG_SYSTEM_TAG_LABEL: Record<CatalogSystemTagKey, string> = {
  builtin: 'BuiltIn',
  template: 'Template',
  shell: 'Shell',
  custom: 'Custom',
};

export function isCatalogSystemTagKey(value: string): value is CatalogSystemTagKey {
  return (CATALOG_SYSTEM_TAG_KEYS as readonly string[]).includes(value);
}

export type CatalogSystemTagBadgeProps = {
  tag: string;
  children?: React.ReactNode;
  className?: string;
} & Omit<React.ComponentPropsWithoutRef<'span'>, 'children' | 'className'>;

export const CatalogSystemTagBadge: React.FC<CatalogSystemTagBadgeProps> = ({
  tag,
  children,
  className,
  ...spanProps
}) => {
  const key: CatalogSystemTagKey = isCatalogSystemTagKey(tag) ? tag : 'custom';
  return (
    <DevelopmentCatalogCardBadge
      {...spanProps}
      className={cn(CATALOG_SYSTEM_TAG_CLASS[key], className)}
    >
      {children ?? tag}
    </DevelopmentCatalogCardBadge>
  );
};

export type BuiltInBadgeProps = Omit<CatalogSystemTagBadgeProps, 'tag'>;

export const BuiltInBadge: React.FC<BuiltInBadgeProps> = (props) => (
  <CatalogSystemTagBadge tag="builtin" {...props} />
);

export type CatalogSystemTagDotProps = {
  tag: string;
  className?: string;
};

/** Compact type marker for catalog card title rows. Hover shows the type title. */
export const CatalogSystemTagDot: React.FC<CatalogSystemTagDotProps> = ({
  tag,
  className,
}) => {
  const key: CatalogSystemTagKey = isCatalogSystemTagKey(tag) ? tag : 'custom';
  const label = CATALOG_SYSTEM_TAG_LABEL[key];
  return (
    <ActionTooltip content={label}>
      <span
        role="img"
        aria-label={label}
        data-testid={`catalog-type-dot-${key}`}
        className={cn(
          'inline-block h-2.5 w-2.5 shrink-0 rounded-full',
          CATALOG_SYSTEM_TAG_DOT_CLASS[key],
          className,
        )}
      />
    </ActionTooltip>
  );
};
