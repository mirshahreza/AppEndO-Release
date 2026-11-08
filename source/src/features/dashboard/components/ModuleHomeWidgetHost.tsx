import React, { Suspense } from 'react';
import type { HomeWidgetRegistryEntry } from '../../../shared/api/contracts/home-widgets';
import { resolveHomeWidgetLucideIcon } from '../homeWidgetIcons';
import { resolveCoreHomeWidgetComponent } from './homeWidgetResolvers';
import { PackageHomeWidgetHost } from './PackageHomeWidgetHost';
import { DashboardWidgetShell } from './DashboardWidgetShell';
import { DASHBOARD_HEADER_ICON_CLASS } from '../dashboardDensity';
import { useCultureT } from '../../../core/culture/CultureContext';
import { HomeWidgetErrorBoundary } from './HomeWidgetErrorBoundary';

type ModuleHomeWidgetHostProps = {
  entry: HomeWidgetRegistryEntry;
};

const HomeWidgetFallback: React.FC = () => (
  <div className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">
    Loading…
  </div>
);

export const ModuleHomeWidgetHost: React.FC<ModuleHomeWidgetHostProps> = ({ entry }) => {
  const t = useCultureT();

  if (entry.componentRef.startsWith('package:')) {
    return <PackageHomeWidgetHost entry={entry} />;
  }

  if (entry.componentRef.startsWith('core:legacy-')) {
    return null;
  }

  const LazyComponent = resolveCoreHomeWidgetComponent(entry.componentRef);
  if (!LazyComponent) {
    return (
      <DashboardWidgetShell title={t(entry.catalog.labelKey)}>
        <p className="px-3 py-2 text-sm text-slate-500">{t('homeWidget.loadError')}</p>
      </DashboardWidgetShell>
    );
  }

  const Icon = resolveHomeWidgetLucideIcon(entry.catalog.icon);

  return (
    <HomeWidgetErrorBoundary titleKey={entry.catalog.labelKey}>
      <Suspense fallback={<HomeWidgetFallback />}>
        <LazyComponent entry={entry} headerIcon={<Icon className={DASHBOARD_HEADER_ICON_CLASS} />} />
      </Suspense>
    </HomeWidgetErrorBoundary>
  );
};
