import React from 'react';
import { Trash2 } from 'lucide-react';
import { ToolbarActionGroupWithRefresh } from '../../../shared/ui';
import { PAGE_GUIDE_EN } from '../../../core/culture/translations/pageGuideEn';
import { useCultureT } from '../../../core/culture/CultureContext';
import { operationsKey } from '../../../core/culture/translations/cultureKeyHelpers';
import type { CachePageModel } from '../hooks/useCachePage';

type CacheActionsPanelProps = {
  page: CachePageModel;
};

export const CacheActionsPanel: React.FC<CacheActionsPanelProps> = ({ page }) => {
  const t = useCultureT();

  return (
    <ToolbarActionGroupWithRefresh
      onRefresh={() => void page.refresh()}
      isRefreshing={page.isLoading}
      actions={[
        {
          id: 'flush-cache',
          label: t(operationsKey('cache.flushAll')),
          icon: <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />,
          intent: 'destructive-soft',
          onClick: page.openFlushConfirm,
          guideHint: PAGE_GUIDE_EN['pageGuide.page.cache.flush.hint'],
        },
      ]}
    />
  );
};
