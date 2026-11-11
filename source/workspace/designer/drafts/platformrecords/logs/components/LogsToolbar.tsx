import React from 'react';
import { Trash2 } from 'lucide-react';
import {
  AppButton,
  PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS,
  PAGE_TOOLBAR_FILTER_CHECKBOX_GROUP_CLASS,
  PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS,
  PAGE_TOOLBAR_SINGLE_ROW_CLASS,
  ToolbarFilterCheckbox,
  ToolbarFilterCheckboxGroupItem,
  ToolbarRefreshButton,
} from '@/src/shared/ui';
import { useCultureT } from '@/src/core/culture/CultureContext';
import { operationsKey } from '@/src/core/culture/translations/cultureKeyHelpers';
import { interpolateOperationsTemplate } from '@/src/features/operations/operationsI18n';
import { LOG_LEVELS } from '../constants';
import type { LogLevel } from '../types';
import type { LogsPageModel } from '../hooks/useLogsPage';

type LogsToolbarProps = {
  page: LogsPageModel;
};

export const LogsToolbar: React.FC<LogsToolbarProps> = ({ page }) => {
  const t = useCultureT();

  return (
    <div className={`${PAGE_TOOLBAR_SINGLE_ROW_CLASS} justify-between`}>
      <div className={PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS}>
        <div className={PAGE_TOOLBAR_FILTER_CHECKBOX_GROUP_CLASS}>
          {LOG_LEVELS.filter((level) => page.visibleLevels[level]).map((level) => (
            <ToolbarFilterCheckboxGroupItem
              key={level}
              id={`logs-level-${level}`}
              checked={page.levelFilters[level]}
              onChange={(checked) => {
                page.setLevelFilters((prev: Record<LogLevel, boolean>) => ({ ...prev, [level]: checked }));
              }}
            >
              {level}
            </ToolbarFilterCheckboxGroupItem>
          ))}
        </div>
      </div>

      <div className={PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS}>
        <ToolbarFilterCheckbox
          id="logs-auto-refresh"
          checked={page.autoRefreshEnabled}
          onChange={page.setAutoRefreshEnabled}
        >
          {interpolateOperationsTemplate(t(operationsKey('logs.autoRefresh')), {
            seconds: page.autoRefreshSeconds,
          })}
        </ToolbarFilterCheckbox>
        <span className="hidden h-5 w-px bg-slate-200 sm:block" aria-hidden="true" />
        <AppButton intent="destructive-soft" size="sm" onClick={() => page.setShowClearConfirm(true)} className="whitespace-nowrap">
          <Trash2 className="h-3.5 w-3.5" />
          {t(operationsKey('common.clear'))}
        </AppButton>
        <ToolbarRefreshButton
          onClick={() => void page.loadLogs()}
          isRefreshing={page.isLoading}
        />
      </div>
    </div>
  );
};
