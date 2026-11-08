import React from 'react';
import { useCultureT } from '../../../core/culture/CultureContext';
import { useDashboardLayout } from '../../../contexts/DashboardLayoutContext';
import { cn } from '../../../lib/utils';
import { isDashboardWidgetAccent } from '../../../shared/lib/userDashboardLayout';
import { ICON_LABEL_ROW_CLASS } from '../../../shared/ui/surfaceClasses';
import {
  DASHBOARD_HEADER_ICON_WELL_CLASS,
  DASHBOARD_SURFACE_CLASS,
  DASHBOARD_WIDGET_HEADER_CLASS,
  DASHBOARD_WIDGET_INLINE_HEADER_CLASS,
  DASHBOARD_WIDGET_SUBTITLE_CLASS,
  DASHBOARD_WIDGET_TITLE_CLASS,
} from '../dashboardDensity';
import { resolveDashboardWidgetAccentTokens, resolveDashboardWidgetChrome } from '../dashboardWidgetChrome';
import { resolveHomeWidgetRegistryEntry } from '../homeWidgetRegistry';
import { useDashboardWidgetFit } from './DashboardWidgetFitContext';
import { useOptionalDashboardSortableWidget } from './DashboardSortableWidgetContext';

export type DashboardWidgetShellProps = {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  headerIcon?: React.ReactNode;
  /** Count or other chrome rendered immediately after the title. */
  titleExtra?: React.ReactNode;
  headerExtra?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  /** When false, the body is not wrapped in a card — used for KPI tiles. */
  framed?: boolean;
  children: React.ReactNode;
};

export const DashboardWidgetShell: React.FC<DashboardWidgetShellProps> = ({
  title,
  subtitle,
  headerIcon,
  titleExtra,
  headerExtra,
  className,
  bodyClassName,
  framed = true,
  children,
}) => {
  const t = useCultureT();
  const fit = useDashboardWidgetFit();
  const sortable = useOptionalDashboardSortableWidget();
  const { widgetChrome, isDesigning, homeWidgetRegistry } = useDashboardLayout();
  const chrome = sortable
    ? resolveDashboardWidgetChrome(sortable.widgetId, widgetChrome)
    : { showHeader: true as const, headerStyle: 'bar' as const, lockSize: false };
  const registryEntry = sortable
    ? resolveHomeWidgetRegistryEntry(homeWidgetRegistry, sortable.widgetId)
    : undefined;
  const catalogAccent = registryEntry && isDashboardWidgetAccent(registryEntry.catalog.tone)
    ? registryEntry.catalog.tone
    : undefined;
  const accent = resolveDashboardWidgetAccentTokens(chrome.accent ?? catalogAccent);
  const showBar = chrome.showHeader && chrome.headerStyle === 'bar';
  const showOutside = chrome.showHeader && chrome.headerStyle === 'inline';
  const isHeaderDrag = Boolean(isDesigning && sortable?.dragSurface === 'header' && chrome.showHeader);
  const headerDragProps = isHeaderDrag
    ? { ...sortable?.attributes, ...sortable?.listeners }
    : {};
  const headerLabel = isHeaderDrag ? t('dashboard.layout.dragWidget') : undefined;
  const titleRow = (
    <div className={ICON_LABEL_ROW_CLASS}>
      {headerIcon ? (
        <span className={cn(DASHBOARD_HEADER_ICON_WELL_CLASS, accent?.title, '[&_svg]:text-current')} aria-hidden>
          {headerIcon}
        </span>
      ) : null}
      <h2 className={DASHBOARD_WIDGET_TITLE_CLASS}>{title}</h2>
      {titleExtra ? <span className="shrink-0">{titleExtra}</span> : null}
    </div>
  );
  const extra = headerExtra ? (
    <div className="flex shrink-0 items-center gap-1.5">
      {headerExtra}
    </div>
  ) : null;
  const outsideHeader = showOutside ? (
    <header
      className={cn(
        DASHBOARD_WIDGET_INLINE_HEADER_CLASS,
        'justify-between',
        isHeaderDrag && 'cursor-grab active:cursor-grabbing',
        sortable?.isDragging && 'cursor-grabbing',
      )}
      aria-label={headerLabel}
      {...headerDragProps}
    >
      <div className="min-w-0 flex-1">
        {titleRow}
        {subtitle && fit.showSubtitle ? (
          <p className={DASHBOARD_WIDGET_SUBTITLE_CLASS}>{subtitle}</p>
        ) : null}
      </div>
      {extra}
    </header>
  ) : null;
  const body = (
    <>
      {showBar ? (
        <header
          className={cn(
            DASHBOARD_WIDGET_HEADER_CLASS,
            'shrink-0 justify-between',
            isHeaderDrag && 'cursor-grab active:cursor-grabbing',
            sortable?.isDragging && 'cursor-grabbing',
          )}
          aria-label={headerLabel}
          {...headerDragProps}
        >
          <div className="min-w-0 flex-1">
            {titleRow}
            {subtitle && fit.showSubtitle ? (
              <p className={DASHBOARD_WIDGET_SUBTITLE_CLASS}>{subtitle}</p>
            ) : null}
          </div>
          {extra}
        </header>
      ) : !chrome.showHeader && accent ? (
        <div className={cn('h-1 shrink-0', accent.strip)} aria-hidden />
      ) : null}
      <div className={cn('min-h-0', bodyClassName)}>{children}</div>
    </>
  );

  return (
    <div className={cn('flex h-auto flex-col', className)}>
      {outsideHeader}
      {framed ? (
        <section className={cn(DASHBOARD_SURFACE_CLASS, 'flex h-auto flex-col')}>
          {body}
        </section>
      ) : (
        body
      )}
    </div>
  );
};
