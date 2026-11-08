import React from 'react';
import { Pencil } from 'lucide-react';
import { useCultureT } from '../../../core/culture/CultureContext';
import { useDashboardLayout } from '../../../contexts/DashboardLayoutContext';
import { cn } from '../../../lib/utils';
import { NativeButton } from '../../../shared/ui/NativeButton';
import { pageGuideLocalProps } from '../../../shared/ui/shell/pageGuide/pageGuideChrome';
import { DASHBOARD_HEADER_CHIP_CLASS } from '../dashboardDensity';

export const DashboardDesignModeButton: React.FC = () => {
  const t = useCultureT();
  const { isDesigning, toggleDesigning } = useDashboardLayout();
  const label = isDesigning ? t('dashboard.layout.exitDesign') : t('dashboard.layout.design');

  return (
    <NativeButton
      type="button"
      className={cn(
        DASHBOARD_HEADER_CHIP_CLASS,
        'w-8 px-0',
        isDesigning
          ? 'bg-indigo-100 text-indigo-900 ring-2 ring-indigo-400/45 hover:bg-indigo-100'
          : 'text-slate-700 hover:bg-white hover:text-slate-900',
      )}
      aria-label={label}
      aria-pressed={isDesigning}
      onClick={toggleDesigning}
      {...pageGuideLocalProps(
        t('dashboard.layout.design'),
        t('dashboard.layout.designHint'),
      )}
    >
      <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
    </NativeButton>
  );
};
