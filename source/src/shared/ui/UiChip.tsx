import React from 'react';
import { Chip } from '@heroui/react';

const HeroChip = Chip as any;

export type UiChipProps = {
  children: React.ReactNode;
  color?: 'default' | 'accent' | 'success' | 'warning' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'secondary' | 'soft' | 'tertiary';
  className?: string;
};

/** Thin wrapper over HeroUI's `Chip` — status/category tags for grids and cards. */
export const UiChip: React.FC<UiChipProps> = ({ children, color, size, variant, className }) => (
  <HeroChip color={color} size={size} variant={variant} className={className}>
    {children}
  </HeroChip>
);
