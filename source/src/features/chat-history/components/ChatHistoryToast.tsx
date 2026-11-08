import React from 'react';
import { AppToast } from '../../../shared/ui/AppToast';
import type { ToastState } from '../types';

export type ChatHistoryToastProps = {
  toast: ToastState | null;
};

export const ChatHistoryToast: React.FC<ChatHistoryToastProps> = ({ toast }) => {
  if (!toast) return null;
  return <AppToast type={toast.type} text={toast.text} />;
};
