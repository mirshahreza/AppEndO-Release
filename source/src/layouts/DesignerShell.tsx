import React, { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { usePersistedAppEndooOpen } from '../shared/ui/shell/usePersistedAppEndooOpen';
import { APPENDOO_DOCK_LAYOUT_PADDING_CLASS } from '../shared/ui/appendooDock';
import { AppRouteLoading } from '../components/AppRouteLoading';
import { ErrorBoundary } from '../components/ui/ErrorBoundary';
import { cn } from '../lib/utils';
import { isDashboardChromeStrippedView } from '../shared/lib/dashboardCanvas';
import { ShellAppEndooControl } from '../shared/ui/shell/ShellAppEndooControl';
import { ShellChromeEnter } from '../shared/ui/shell/ShellChromeEnter';
import { ShellRouteEnter } from '../shared/ui/shell/ShellRouteEnter';

export const DesignerShell = () => {
  const [isAiPanelOpen, setIsAiPanelOpen] = usePersistedAppEndooOpen();
  const location = useLocation();
  const chromeStripped = isDashboardChromeStrippedView(location.pathname, location.search);

  if (chromeStripped) {
    return (
      <div className="flex h-screen w-full flex-col overflow-hidden bg-white" data-testid="dashboard-embed-shell">
        <ErrorBoundary
          context="DesignerOutlet"
          title="Component Designer failed to load"
          fallbackClassName="flex min-h-[240px] w-full flex-1 items-center justify-center p-6"
        >
          <Suspense fallback={<AppRouteLoading variant="embedded" />}>
            <ShellRouteEnter>
              <Outlet />
            </ShellRouteEnter>
          </Suspense>
        </ErrorBoundary>
      </div>
    );
  }

  return (
    <div className={cn('designer-shell flex h-screen w-full flex-col overflow-hidden bg-surface-workspace', APPENDOO_DOCK_LAYOUT_PADDING_CLASS)}>
      <ShellChromeEnter className="h-full w-full flex-col overflow-hidden" contentClassName="flex-col">
        <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          <ErrorBoundary
            context="DesignerOutlet"
            title="Component Designer failed to load"
            fallbackClassName="flex min-h-[240px] w-full flex-1 items-center justify-center p-6"
          >
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <Suspense fallback={<AppRouteLoading variant="embedded" />}>
                <ShellRouteEnter>
                  <Outlet />
                </ShellRouteEnter>
              </Suspense>
            </div>
          </ErrorBoundary>

          <div className="pointer-events-none absolute right-3 top-3 z-40">
            <ShellAppEndooControl
              isOpen={isAiPanelOpen}
              onOpenChange={setIsAiPanelOpen}
              openAriaLabel="Open AppEndO"
              closeAriaLabel="Close AppEndO"
              showTrailingDivider={false}
              className={cn(
                'pointer-events-auto border border-slate-200/80 bg-white/90 shadow-sm backdrop-blur-sm',
                isAiPanelOpen
                  ? 'bg-primary-subtle/50 text-primary-700 shadow-cyan-ring-sm hover:bg-primary-subtle/60 hover:text-primary-700'
                  : 'hover:bg-primary-subtle/45',
              )}
              iconClassName="h-4 w-4"
            />
          </div>
        </main>
      </ShellChromeEnter>
    </div>
  );
};
