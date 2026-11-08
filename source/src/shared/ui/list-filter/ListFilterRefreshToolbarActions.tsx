import React from 'react';
import { ToolbarRefreshButton } from '../ToolbarRefreshButton';
import { PAGE_TOOLBAR_ACTION_SEPARATOR_CLASS } from '../surfaceClasses';
import { ListFilterButton, type ListFilterButtonProps } from './ListFilterButton';

export type ListFilterRefreshToolbarActionsProps = {
  filterButtonProps: ListFilterButtonProps;
  onRefresh: () => void;
  isRefreshing?: boolean;
  refreshDisabled?: boolean;
  /** Leading separator when other actions already sit in the cluster. */
  separatorBefore?: boolean;
};

/** List Filter immediately before Refresh — canonical placement for DB-backed list pages. */
export const ListFilterRefreshToolbarActions: React.FC<ListFilterRefreshToolbarActionsProps> = ({
  filterButtonProps,
  onRefresh,
  isRefreshing = false,
  refreshDisabled = false,
  separatorBefore = false,
}) => (
  <>
    {separatorBefore ? (
      <span className={PAGE_TOOLBAR_ACTION_SEPARATOR_CLASS} aria-hidden="true" />
    ) : null}
    <ListFilterButton {...filterButtonProps} />
    <ToolbarRefreshButton
      onClick={onRefresh}
      isRefreshing={isRefreshing}
      disabled={refreshDisabled}
      separatorBefore
    />
  </>
);
