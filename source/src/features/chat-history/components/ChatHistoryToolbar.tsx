import React from 'react';
import {
  PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS,
  PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS,
  ToolbarActionGroupWithRefresh,
  ToolbarSearchInput,
  ListPageToolbarFrame,
} from '../../../shared/ui';
import { ListPageToolbarScrollRoot } from '../../../shared/ui/list-page/listPageToolbarChrome';
import { cn } from '../../../lib/utils';

export type ChatHistoryToolbarProps = {
  searchInput: string;
  onSearchInputChange: (value: string) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  listToolbarCollapsed?: boolean;
};

export const ChatHistoryToolbar: React.FC<ChatHistoryToolbarProps> = ({
  searchInput,
  onSearchInputChange,
  onRefresh,
  isRefreshing,
  listToolbarCollapsed = false,
}) => (
  <ListPageToolbarFrame>

    <div className={PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS}>
      <ToolbarSearchInput
        value={searchInput}
        onChange={onSearchInputChange}
        placeholder="title, user, model, id, message content"
        ariaLabel="Search chat history"
      />
    </div>
    <div className={PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS}>
      <ToolbarActionGroupWithRefresh
        onRefresh={onRefresh}
        isRefreshing={isRefreshing}
        actions={[]}
      />
    </div>
  </ListPageToolbarFrame>
);
