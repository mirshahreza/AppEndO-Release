import React from 'react';
import { ChevronsDownUp, ChevronsUpDown, Plus } from 'lucide-react';
import {
  PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS,
  PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS,
  ToolbarActionGroupWithRefresh,
  ToolbarSearchInput,
  ListPageToolbarFrame,
} from '../../../shared/ui';
import { useCultureT } from '../../../core/culture/CultureContext';
import type { BaseInfoPageModel } from '../hooks/useBaseInfoPage';
import { ListPageToolbarScrollRoot } from '../../../shared/ui/list-page/listPageToolbarChrome';
import { cn } from '../../../lib/utils';

type BaseInfoToolbarProps = {
  page: BaseInfoPageModel;
};

export const BaseInfoToolbar: React.FC<BaseInfoToolbarProps> = ({ page }) => {
  const t = useCultureT();
  const expandTitle = t('pageGuide.page.baseInfo.expand.title');
  const expandHint = t('pageGuide.page.baseInfo.expand.hint');
  const collapseTitle = t('pageGuide.page.baseInfo.collapse.title');
  const collapseHint = t('pageGuide.page.baseInfo.collapse.hint');

  return (
    <ListPageToolbarFrame>

      <div className={PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS}>
        <ToolbarSearchInput
          value={page.search}
          onChange={page.setSearch}
          placeholder={t('baseInfo.searchPlaceholder')}
          ariaLabel={t('baseInfo.searchAriaLabel')}
        />
      </div>

      <div className={PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS}>
        <ToolbarActionGroupWithRefresh
          onRefresh={() => void page.load()}
          isRefreshing={page.isLoading}
          actions={[
            {
              id: 'create-base-info',
              label: t('actions.create'),
              icon: <Plus className="h-3.5 w-3.5" aria-hidden="true" />,
              intent: 'create',
              primary: true,
              onClick: page.openCreateModal,
            },
            {
              id: 'expand-all',
              label: expandTitle,
              icon: <ChevronsUpDown className="h-3.5 w-3.5" aria-hidden="true" />,
              intent: 'utility',
              onClick: page.expandAll,
              guideHint: expandHint,
            },
            {
              id: 'collapse-all',
              label: collapseTitle,
              icon: <ChevronsDownUp className="h-3.5 w-3.5" aria-hidden="true" />,
              intent: 'utility',
              onClick: page.collapseAll,
              guideHint: collapseHint,
            },
          ]}
        />
      </div>
    </ListPageToolbarFrame>
  );
};
