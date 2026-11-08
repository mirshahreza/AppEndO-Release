import * as React from 'react';

import { cn } from '../../lib/utils';

import {
  SECTION_EMPTY_STATE_CLASS,
  SECTION_EMPTY_STATE_INLINE_CLASS,
} from './surfaceClasses';

export type SectionEmptyStateLayout = 'panel' | 'inline';

export type SectionEmptyStateProps = {
  children: React.ReactNode;
  /** `panel` — dashed inset (default). `inline` — compact text for grids or flush bodies. */
  layout?: SectionEmptyStateLayout;
  className?: string;
};

/** Contextual empty copy for a panel section, list, or grid with no rows. */
export const SectionEmptyState: React.FC<SectionEmptyStateProps> = ({
  children,
  layout = 'panel',
  className,
}) => (
  <p
    role="status"
    className={cn(
      layout === 'panel' ? SECTION_EMPTY_STATE_CLASS : SECTION_EMPTY_STATE_INLINE_CLASS,
      className,
    )}
  >
    {children}
  </p>
);
