import React from 'react';
import { slotRegistry } from '../../../core/slots/SlotRegistry';
import { DASHBOARD_WIDGETS_SLOT_ID } from '../../../domain/component-designer/DesignerRuntimeRegisteredSlotFill';
import type { HomeWidgetRegistryEntry } from '../../../shared/api/contracts/home-widgets';
import { parsePackageHomeWidgetLayoutId } from '../../../shared/api/contracts/home-widgets';
import { useCultureT } from '../../../core/culture/CultureContext';
import { resolveHomeWidgetLucideIcon } from '../homeWidgetIcons';
import { DashboardWidgetShell } from './DashboardWidgetShell';
import { DASHBOARD_HEADER_ICON_CLASS } from '../dashboardDensity';

type PackageHomeWidgetHostProps = {
  entry: HomeWidgetRegistryEntry;
};

export const PackageHomeWidgetHost: React.FC<PackageHomeWidgetHostProps> = ({ entry }) => {
  const t = useCultureT();
  const parsed = parsePackageHomeWidgetLayoutId(entry.layoutId);
  const slotEntry = parsed
    ? slotRegistry.getComponents(DASHBOARD_WIDGETS_SLOT_ID).find(
      (item) => item.packageId === parsed.packageId && item.id.endsWith(`:${parsed.componentKey}`),
    )
    : undefined;
  const Icon = resolveHomeWidgetLucideIcon(entry.catalog.icon);
  const PackageComponent = slotEntry?.component;

  return (
    <DashboardWidgetShell
      title={t(entry.catalog.labelKey)}
      subtitle={t(entry.catalog.descriptionKey)}
      headerIcon={<Icon className={DASHBOARD_HEADER_ICON_CLASS} />}
    >
      {PackageComponent ? <PackageComponent /> : (
        <p className="px-3 py-2 text-sm text-slate-500">{t('homeWidget.packageUnavailable')}</p>
      )}
    </DashboardWidgetShell>
  );
};
