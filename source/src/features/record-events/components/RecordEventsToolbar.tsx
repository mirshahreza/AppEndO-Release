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
import type { RecordEventsPageModel } from '../hooks/useRecordEventsPage';
import { ListPageToolbarScrollRoot } from '../../../shared/ui/list-page/listPageToolbarChrome';
import { cn } from '../../../lib/utils';

type RecordEventsToolbarProps = {
  page: RecordEventsPageModel;
};

export const RecordEventsToolbar: React.FC<RecordEventsToolbarProps> = ({ page }) => {
  const t = useCultureT();
  const controlLabel = t(operationsKey('recordEvents.control'));

  return (
    <ListPageToolbarFrame>

      <div className={PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS}>
        {page.includeArchivedAllowed ? (
          <ToolbarFilterCheckbox
            id="record-events-include-archived"
            checked={page.includeArchived}
            onChange={page.setIncludeArchived}
            hint={PAGE_GUIDE_EN['pageGuide.page.recordEvents.includeArchived.hint']}
          >
            {t(operationsKey('recordEvents.includeArchived'))}
          </ToolbarFilterCheckbox>
        ) : null}
        <ListFilterToolbarControl
          filterButtonProps={page.filterButtonProps}
          separatorBefore={page.includeArchivedAllowed}
        />
      </div>

      <div className={PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS}>
        <ToolbarActionGroupWithRefresh
          onRefresh={() => { void page.loadEvents(); }}
          isRefreshing={page.isLoading}
          actions={[
            {
              id: 'record-events-control',
              label: controlLabel,
              icon: <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />,
              intent: 'utility',
              primary: true,
              onClick: () => page.setShowControlDialog(true),
              guideHint: PAGE_GUIDE_EN['pageGuide.page.recordEvents.control.hint'],
            },
          ]}
        />
      </div>
    </ListPageToolbarFrame>
  );
};
