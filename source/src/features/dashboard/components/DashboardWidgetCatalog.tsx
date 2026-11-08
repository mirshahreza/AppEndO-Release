import React, { useCallback, useMemo, useState } from 'react';
import { Check, LayoutGrid, Plus } from 'lucide-react';
import { useCultureT } from '../../../core/culture/CultureContext';
import { cn } from '../../../lib/utils';
import { useDashboardLayout } from '../../../contexts/DashboardLayoutContext';
import { AppButton } from '../../../shared/ui/AppButton';
import { FloatingPanelShell } from '../../../shared/ui/FloatingPanelShell';
import { NativeButton } from '../../../shared/ui/NativeButton';
import { APP_SURFACE_BOX_TONE_CLASS } from '../../../shared/ui/surfaceClasses';
import { DASHBOARD_HEADER_CHIP_CLASS } from '../dashboardDensity';
import { buildGroupedDashboardWidgetCatalog, type DashboardWidgetCatalogGroup } from '../homeWidgetRegistry';
import { resolveHomeWidgetLucideIcon } from '../homeWidgetIcons';
import type { DashboardWidgetId } from '../../../shared/lib/userDashboardLayout';

const CATALOG_GROUP_ORDER: DashboardWidgetCatalogGroup[] = ['platform', 'modules', 'package', 'collections'];

const CATALOG_GROUP_LABEL_KEYS: Record<DashboardWidgetCatalogGroup, string> = {
  platform: 'dashboard.layout.widgetCatalog.group.platform',
  modules: 'dashboard.layout.widgetCatalog.group.modules',
  package: 'dashboard.layout.widgetCatalog.group.package',
  collections: 'dashboard.layout.widgetCatalog.group.collections',
};

const CATALOG_PANEL_BOUNDS = {
  minWidth: 320,
  maxWidth: 420,
  minHeight: 320,
  maximizeInset: 24,
};

export const DashboardWidgetCatalog: React.FC = () => {
  const t = useCultureT();
  const {
    homeWidgetRegistry,
    hiddenWidgets,
    widgetOrder,
    showWidget,
  } = useDashboardLayout();
  const [isOpen, setIsOpen] = useState(false);

  const groupedEntries = useMemo(
    () => buildGroupedDashboardWidgetCatalog(homeWidgetRegistry),
    [homeWidgetRegistry],
  );

  const entriesByGroup = useMemo(() => {
    const map = new Map<DashboardWidgetCatalogGroup, typeof groupedEntries>();
    for (const group of CATALOG_GROUP_ORDER) {
      map.set(group, groupedEntries.filter((entry) => entry.catalogGroup === group));
    }
    return map;
  }, [groupedEntries]);

  const hiddenSet = useMemo(() => new Set(hiddenWidgets), [hiddenWidgets]);
  const visibleSet = useMemo(() => new Set(widgetOrder), [widgetOrder]);

  const handleAdd = useCallback((widgetId: DashboardWidgetId) => {
    showWidget(widgetId);
  }, [showWidget]);

  return (
    <>
      <NativeButton
        type="button"
        className={cn(
          DASHBOARD_HEADER_CHIP_CLASS,
          'text-primary-700 hover:bg-white hover:text-primary-700',
          isOpen && 'bg-white ring-1 ring-primary-200',
        )}
        aria-label={t('dashboard.layout.widgetCatalog.open')}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(true)}
      >
        <LayoutGrid className="h-3 w-3" />
        <span>{t('dashboard.layout.widgetCatalog.title')}</span>
        {hiddenWidgets.length > 0 ? (
          <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary-100 px-1 text-[10px] font-bold leading-none text-primary-700">
            {hiddenWidgets.length}
          </span>
        ) : null}
      </NativeButton>

      <FloatingPanelShell
        open={isOpen}
        onClose={() => setIsOpen(false)}
        title={t('dashboard.layout.widgetCatalog.title')}
        titleIcon={<LayoutGrid className="h-4 w-4 text-primary-600" />}
        bounds={CATALOG_PANEL_BOUNDS}
        defaultWidth={360}
        defaultHeight={520}
        initialPosition="center"
        zIndexClassName="z-[93]"
        shellMarker="dashboard-widget-catalog"
        headerBand={
          <p className="border-b border-slate-200 px-3 py-2 text-[11px] leading-snug text-slate-500">
            {t('dashboard.layout.widgetCatalog.subtitle')}
          </p>
        }
        bodyClassName="overflow-y-auto p-3"
      >
        <div className="space-y-3">
          {CATALOG_GROUP_ORDER.map((group) => {
            const entries = entriesByGroup.get(group) ?? [];
            if (entries.length === 0 && group !== 'collections') {
              return null;
            }
            return (
              <div key={group} className="space-y-1">
                <p className="px-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  {t(CATALOG_GROUP_LABEL_KEYS[group])}
                </p>
                {entries.length === 0 && group === 'collections' ? (
                  <p className="px-0.5 text-[11px] leading-snug text-slate-500">
                    {t('dashboard.layout.widgetCatalog.group.collectionsComingSoon')}
                  </p>
                ) : null}
                {entries.map((entry) => {
                  const Icon = resolveHomeWidgetLucideIcon(entry.catalog.icon);
                  const tokens = APP_SURFACE_BOX_TONE_CLASS[entry.catalog.tone];
                  const isVisible = visibleSet.has(entry.layoutId);
                  const isHidden = hiddenSet.has(entry.layoutId);

                  return (
                    <div
                      key={entry.layoutId}
                      className={cn(
                        'flex min-w-0 flex-col gap-0.5 overflow-hidden rounded-md border px-2 py-2',
                        isVisible ? 'border-slate-100 bg-slate-50/60' : 'border-transparent hover:bg-slate-50',
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className={cn(
                            'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md',
                            tokens.header,
                          )}
                        >
                          <Icon className={cn('h-3.5 w-3.5', tokens.title)} />
                        </span>

                        <p className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-800">
                          {t(entry.catalog.labelKey)}
                        </p>

                        {isVisible ? (
                          <span className="inline-flex shrink-0 items-center gap-0.5 text-[10px] font-medium text-emerald-600">
                            <Check className="h-3 w-3" aria-hidden="true" />
                            {t('dashboard.layout.widgetCatalog.onDashboard')}
                          </span>
                        ) : isHidden ? (
                          <AppButton
                            type="button"
                            intent="primary"
                            className="h-6 shrink-0 px-1.5 text-[10px]"
                            onClick={() => handleAdd(entry.layoutId)}
                          >
                            <Plus className="h-3 w-3" aria-hidden="true" />
                            {t('dashboard.layout.widgetCatalog.addWidget')}
                          </AppButton>
                        ) : null}
                      </div>

                      <p className="min-w-0 text-[11px] leading-snug text-slate-500">
                        {t(entry.catalog.descriptionKey)}
                      </p>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </FloatingPanelShell>
    </>
  );
};
