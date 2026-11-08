import React, { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { AppRouteLoading } from '../../components/AppRouteLoading';
import { ErrorBoundary } from '../../components/ui/ErrorBoundary';
import { ShellRouteEnter } from '../../shared/ui/shell/ShellRouteEnter';

/**
 * Route outlet clips to the content host; pages own scroll (grids default to overlay gutter).
 * Avoid `overflow-auto` here — a native gutter on the shell outlet caused horizontal jump on load.
 */
export const ShellRouteOutlet: React.FC = () => (
  <div
    className="flex h-full min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden"
    data-testid="shell-route-outlet"
  >
    <ErrorBoundary
      context="ShellRouteOutlet"
      title="Page failed to load"
      fallbackClassName="flex min-h-[240px] w-full items-center justify-center p-6"
    >
      <Suspense fallback={<AppRouteLoading variant="embedded" />}>
        <ShellRouteEnter>
          <Outlet />
        </ShellRouteEnter>
      </Suspense>
    </ErrorBoundary>
  </div>
);
