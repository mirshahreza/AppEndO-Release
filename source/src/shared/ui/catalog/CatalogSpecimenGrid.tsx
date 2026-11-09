import React from 'react';
import { cn } from '../../../lib/utils';

type CatalogSpecimenGridProps = {
  children: React.ReactNode;
  className?: string;
};

/** Living-catalog preview grid — at least two specimens per row from `md` breakpoint. */
export const CatalogSpecimenGrid: React.FC<CatalogSpecimenGridProps> = ({ children, className }) => (
  <div className={cn('grid grid-cols-1 gap-4 md:grid-cols-2 md:items-stretch', className)}>{children}</div>
);
