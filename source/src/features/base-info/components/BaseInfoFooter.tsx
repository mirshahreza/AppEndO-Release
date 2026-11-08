import React from 'react';
import { useCultureT } from '../../../core/culture/CultureContext';
import type { BaseInfoPageModel } from '../hooks/useBaseInfoPage';

type BaseInfoFooterProps = {
  page: BaseInfoPageModel;
};

export const BaseInfoFooter: React.FC<BaseInfoFooterProps> = ({ page }) => {
  const t = useCultureT();

  return (
    <div className="h-9 border-t border-slate-200 bg-slate-50 px-5 flex items-center gap-3 text-[11px] text-slate-500 shrink-0">
      <span className="font-semibold text-slate-600">{page.rootCount}</span> {t('baseInfo.footer.rootNodes')}
      <span className="text-slate-300">·</span>
      <span className="font-semibold text-slate-600">{page.filteredTreeRows.length}</span> {t('baseInfo.footer.visible')}
      {page.search.trim() ? (
        <>
          <span className="text-slate-300">·</span>
          <span className="font-semibold text-slate-600">{page.totalLoaded}</span> {t('baseInfo.footer.loaded')}
        </>
      ) : null}
    </div>
  );
};
