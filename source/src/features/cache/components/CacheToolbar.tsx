import React from 'react';
import {
  PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS,
  ToolbarSearchInput,
  ListPageToolbarFrame,
} from '../../../shared/ui';
import { ListPageToolbarScrollRoot } from '../../../shared/ui/list-page/listPageToolbarChrome';
import { cn } from '../../../lib/utils';
import { useCultureT } from '../../../core/culture/CultureContext';
import { operationsKey } from '../../../core/culture/translations/cultureKeyHelpers';
import type { CachePageModel } from '../hooks/useCachePage';
import { CacheActionsPanel } from './CacheActionsPanel';

type CacheToolbarProps = {
  page: CachePageModel;
};

export const CacheToolbar: React.FC<CacheToolbarProps> = ({ page }) => {
  const t = useCultureT();

  return (
    <ListPageToolbarFrame>

      <div className={PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS}>
        <ToolbarSearchInput
          value={page.filterQuery}
          onChange={page.setFilterQuery}
          placeholder={t(operationsKey('cache.searchPlaceholder'))}
          ariaLabel={t(operationsKey('cache.searchAria'))}
        />
      </div>

      <CacheActionsPanel page={page} />
    </ListPageToolbarFrame>
  );
};
