import React from 'react';
import { PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS, PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS, PAGE_TOOLBAR_SINGLE_ROW_CLASS, ToolbarRefreshButton, ToolbarSearchInput } from '@/src/shared/ui';

export type ChatHistoryToolbarProps = {
  searchInput: string;
  onSearchInputChange: (value: string) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
};

export const ChatHistoryToolbar: React.FC<ChatHistoryToolbarProps> = ({
  searchInput,
  onSearchInputChange,
  onRefresh,
  isRefreshing,
}) => (
  <div className={`${PAGE_TOOLBAR_SINGLE_ROW_CLASS} justify-between`}>
    <div className={PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS}>
      <ToolbarSearchInput
        value={searchInput}
        onChange={onSearchInputChange}
        placeholder="title, user, model, id, message content"
        ariaLabel="Search chat history"
      />
    </div>
    <div className={PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS}>
      <ToolbarRefreshButton onClick={onRefresh} isRefreshing={isRefreshing} separatorBefore={false} />
    </div>
  </div>
);
