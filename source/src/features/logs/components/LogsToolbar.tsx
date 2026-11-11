import React from 'react';
import { SlidersHorizontal } from 'lucide-react';
import {
  ListFilterToolbarControl,
  PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS,
  PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS,
  ToolbarActionGroupWithRefresh,
  ToolbarFilterCheckbox,
  ListPageToolbarFrame,
} from '../../../shared/ui';
import { useCultureT } from '../../../core/culture/CultureContext';
import { PAGE_GUIDE_EN } from '../../../core/culture/translations/pageGuideEn';
import { operationsKey } from '../../../core/culture/translations/cultureKeyHelpers';
import type { LogsPageModel } from '../hooks/useLogsPage';
import { ListPageToolbarScrollRoot } from '../../../shared/ui/list-page/listPageToolbarChrome';
import { cn } from '../../../lib/utils';

type LogsToolbarProps = {
  page: LogsPageModel;
};

export const LogsToolbar: React.FC<LogsToolbarProps> = ({ page }) => {
  const t = useCultureT();
  const controlLabel = t(operationsKey('logs.control'));

  return (
    <ListPageToolbarFrame>

      <div className={PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS}>
        {page.includeArchivedAllowed ? (
          <ToolbarFilterCheckbox
            id="logs-include-archived"
            checked={page.includeArchived}
            onChange={page.setIncludeArchived}
            hint={PAGE_GUIDE_EN['pageGuide.page.logs.includeArchived.hint']}
          >
            {t(operationsKey('logs.includeArchived'))}
          </ToolbarFilterCheckbox>
        ) : null}
        <ListFilterToolbarControl
          filterButtonProps={page.filterButtonProps}
          separatorBefore={page.includeArchivedAllowed}
          visibility="always"
        />
      </div>

      <div className={PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS}>
        <ToolbarActionGroupWithRefresh
          onRefresh={() => { void page.loadLogs(); }}
          isRefreshing={page.isLoading}
          actions={[
            {
              id: 'logs-control',
              label: controlLabel,
              icon: <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />,
              intent: 'utility',
              primary: true,
              alwaysLabeled: true,
              onClick: () => page.setShowControlDialog(true),
              guideHint: PAGE_GUIDE_EN['pageGuide.page.logs.control.hint'],
            },
          ]}
        />
      </div>
    </ListPageToolbarFrame>
  );
};
