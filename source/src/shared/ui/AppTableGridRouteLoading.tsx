import React from 'react';

import { AppRouteLoading } from '../../components/AppRouteLoading';

type AppTableGridRouteLoadingProps = {
  /** Screen-reader status only — never shown in the grid body. */
  label?: string;
  className?: string;
};

/** In-shell list/grid loading — same portal logo + orbital ring as platform route loading. */
export const AppTableGridRouteLoading: React.FC<AppTableGridRouteLoadingProps> = ({
  label = 'Loading…',
  className,
}) => (
  <AppRouteLoading
    variant="embedded"
    label={label}
    className={className ?? 'h-full min-h-[10rem] w-full'}
  />
);