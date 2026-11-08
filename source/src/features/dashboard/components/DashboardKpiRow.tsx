import React from 'react';
import { useCultureT } from '../../../core/culture/CultureContext';
import { useDashboardLayout } from '../../../contexts/DashboardLayoutContext';
import { cn } from '../../../lib/utils';
import {
  DASHBOARD_BODY_PAD_CLASS,
  DASHBOARD_HEADER_ICON_CLASS,
  DASHBOARD_KPI_FEATURED_PAD_CLASS,
  DASHBOARD_KPI_FEATURED_SKELETON_CLASS,
  DASHBOARD_KPI_FEATURED_VALUE_CLASS,
  DASHBOARD_KPI_HINT_CLASS,
  DASHBOARD_KPI_LABEL_CLASS,
  DASHBOARD_KPI_PAD_CLASS,
  DASHBOARD_KPI_SKELETON_HEIGHT_CLASS,
  DASHBOARD_KPI_STATUS_VALUE_CLASS,
  DASHBOARD_KPI_VALUE_CLASS,
  DASHBOARD_SURFACE_CLASS,
} from '../dashboardDensity';
import {
  isDashboardKpiFeaturedCard,
  resolveDashboardKpiCardSpanClass,
  resolveDashboardKpiGridClass,
} from '../dashboardKpiLayout';
import { resolveDashboardWidgetCatalogEntry } from '../dashboardWidgetCatalog';
import { resolveDashboardWidgetChrome } from '../dashboardWidgetChrome';
import { DASHBOARD_TONE_DOT_CLASS, DASHBOARD_KPI_TONE_VALUE_CLASS } from '../dashboardWidgetSemantics';
import type { DashboardKpiCard } from '../types';
import { useDashboardWidgetFit } from './DashboardWidgetFitContext';
import { useOptionalDashboardSortableWidget } from './DashboardSortableWidgetContext';
import { DashboardWidgetShell } from './DashboardWidgetShell';

type DashboardKpiRowProps = {
  cards: DashboardKpiCard[];
  isLoading?: boolean;
};

export const DashboardKpiRow: React.FC<DashboardKpiRowProps> = ({ cards, isLoading }) => {
  const t = useCultureT();
  const fit = useDashboardWidgetFit();
  const sortable = useOptionalDashboardSortableWidget();
  const { widgetChrome } = useDashboardLayout();
  const chrome = resolveDashboardWidgetChrome(sortable?.widgetId ?? 'kpi', widgetChrome);
  const catalog = resolveDashboardWidgetCatalogEntry('kpi');
  const count = isLoading ? 1 : cards.length;
  const gridClass = resolveDashboardKpiGridClass(count, fit);
  const CatalogIcon = catalog?.icon;

  const grid = isLoading ? (
    <div className={gridClass}>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className={cn(
            DASHBOARD_SURFACE_CLASS,
            DASHBOARD_KPI_SKELETON_HEIGHT_CLASS,
            resolveDashboardKpiCardSpanClass(index, count, fit),
            isDashboardKpiFeaturedCard(index, count, fit) ? DASHBOARD_KPI_FEATURED_SKELETON_CLASS : null,
            'animate-pulse',
          )}
        />
      ))}
    </div>
  ) : (
    <div className={cn(gridClass, cards.length === 1 && 'w-full')}>
      {cards.map((card, index) => {
        const featured = isDashboardKpiFeaturedCard(index, cards.length, fit);
        const numericValue = /^\d+$/.test(String(card.value).trim());
        const valueClass = featured
          ? (numericValue ? DASHBOARD_KPI_FEATURED_VALUE_CLASS : DASHBOARD_KPI_STATUS_VALUE_CLASS)
          : (numericValue ? DASHBOARD_KPI_VALUE_CLASS : DASHBOARD_KPI_STATUS_VALUE_CLASS);
        const singlePlatform = cards.length === 1 && card.id === 'platform';

        if (singlePlatform) {
          return (
            <article
              key={card.id}
              className={cn(
                DASHBOARD_SURFACE_CLASS,
                'flex flex-wrap items-center gap-x-2.5 gap-y-1 px-4 py-3',
              )}
            >
              <span
                className={cn('h-2 w-2 shrink-0 rounded-full', DASHBOARD_TONE_DOT_CLASS[card.tone])}
                aria-hidden
              />
              <p className={cn('text-sm font-semibold', DASHBOARD_KPI_TONE_VALUE_CLASS[card.tone])}>
                {card.value}
              </p>
              {card.hint && fit.showDescriptions ? (
                <p className="text-xs text-slate-500">{card.hint}</p>
              ) : null}
            </article>
          );
        }

        return (
          <article
            key={card.id}
            className={cn(
              DASHBOARD_SURFACE_CLASS,
              featured ? DASHBOARD_KPI_FEATURED_PAD_CLASS : DASHBOARD_KPI_PAD_CLASS,
              resolveDashboardKpiCardSpanClass(index, cards.length, fit),
            )}
          >
            <div className="flex items-center gap-1.5">
              {card.tone !== 'neutral' ? (
                <span className={`h-1.5 w-1.5 rounded-full ${DASHBOARD_TONE_DOT_CLASS[card.tone]}`} />
              ) : null}
              <p className={DASHBOARD_KPI_LABEL_CLASS}>{card.label}</p>
            </div>
            <p className={valueClass}>
              {card.value}
            </p>
            {card.hint && fit.showDescriptions ? (
              <p className={DASHBOARD_KPI_HINT_CLASS}>{card.hint}</p>
            ) : null}
          </article>
        );
      })}
    </div>
  );

  if (!chrome.showHeader || !catalog) {
    return grid;
  }

  return (
    <DashboardWidgetShell
      title={t(catalog.labelKey)}
      headerIcon={CatalogIcon ? <CatalogIcon className={DASHBOARD_HEADER_ICON_CLASS} /> : null}
      framed={chrome.headerStyle === 'bar'}
      bodyClassName={chrome.headerStyle === 'bar' ? DASHBOARD_BODY_PAD_CLASS : undefined}
    >
      {grid}
    </DashboardWidgetShell>
  );
};
