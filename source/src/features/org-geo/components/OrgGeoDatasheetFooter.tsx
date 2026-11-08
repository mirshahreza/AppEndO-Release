import React from 'react';
import type { ScopedBaseInfoTreeModel } from '../hooks/useScopedBaseInfoTree';

type OrgGeoDatasheetFooterProps = {
  page: ScopedBaseInfoTreeModel;
};

export const OrgGeoDatasheetFooter: React.FC<OrgGeoDatasheetFooterProps> = ({ page }) => (
  <div className="flex h-9 shrink-0 items-center gap-3 border-t border-slate-200 bg-slate-50 px-5 text-[11px] text-slate-500">
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
