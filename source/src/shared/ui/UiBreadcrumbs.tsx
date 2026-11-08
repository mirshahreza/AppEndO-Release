import React from 'react';
import { Breadcrumbs } from '@heroui/react';

const HeroBreadcrumbs = Breadcrumbs as any;

export type UiBreadcrumbItem = {
  key: string;
  label: React.ReactNode;
  href?: string;
  onPress?: () => void;
};

/** Named separators for base-components / public API; pass a ReactNode for fully custom. */
export type UiBreadcrumbSeparator = 'chevron' | 'slash' | 'dot';

export type UiBreadcrumbsProps = {
  items: UiBreadcrumbItem[];
  className?: string;
  /** Visual separator between items. Defaults to chevron (HeroUI default). */
  separator?: UiBreadcrumbSeparator | React.ReactNode;
};

const resolveSeparator = (separator?: UiBreadcrumbSeparator | React.ReactNode): React.ReactNode | undefined => {
  // Omit prop for chevron so HeroUI keeps its default chevron-right icon + separator slot styles.
  if (separator === undefined || separator === 'chevron') return undefined;
  if (separator === 'slash') return '/';
  if (separator === 'dot') return '·';
  return separator;
};

/** Thin wrapper over HeroUI's `Breadcrumbs` — path navigation for deep pages. */
export const UiBreadcrumbs: React.FC<UiBreadcrumbsProps> = ({ items, className, separator }) => (
  <HeroBreadcrumbs className={className} separator={resolveSeparator(separator)}>
    {items.map((item) => (
      <HeroBreadcrumbs.Item key={item.key} href={item.href} onPress={item.onPress}>
        {item.label}
      </HeroBreadcrumbs.Item>
    ))}
  </HeroBreadcrumbs>
);
