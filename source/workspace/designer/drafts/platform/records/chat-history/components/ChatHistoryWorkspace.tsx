import React from 'react';
import { useChatHistoryPage } from '../hooks/useChatHistoryPage';
import { ChatHistoryPageView } from './ChatHistoryPageView';

export const ChatHistoryWorkspace: React.FC = () => {
  const page = useChatHistoryPage();
  return <ChatHistoryPageView page={page} />;
};
