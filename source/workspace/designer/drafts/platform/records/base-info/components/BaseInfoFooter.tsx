import React from 'react';
import type { BaseInfoPageModel } from '../hooks/useBaseInfoPage';

type BaseInfoFooterProps = {
  page: BaseInfoPageModel;
};

export const BaseInfoFooter: React.FC<BaseInfoFooterProps> = ({ page }) => (
  <div className="h-9 border-t border-slate-200 bg-slate-50 px-5 flex items-center gap-3 text-[11px] text-slate-500 shrink-0">
    <span className="font-semibold text-slate-600">{page.rootCount}</span> root nodes
    <span className="text-slate-300">·</span>
    <span className="font-semibold text-slate-600">{page.filteredTreeRows.length}</span> visible
    {page.search.trim() ? (
      <>
        <span className="text-slate-300">·</span>
        <span className="font-semibold text-slate-600">{page.totalLoaded}</span> loaded
      </>
    ) : null}
  </div>
);
