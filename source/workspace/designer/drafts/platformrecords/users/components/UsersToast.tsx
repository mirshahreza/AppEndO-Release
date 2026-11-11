import React from 'react';
import { AppToast } from '@/src/shared/ui/AppToast';
import type { ToastState } from '../types';

export type UsersToastProps = {
  toast: ToastState | null;
};

export const UsersToast: React.FC<UsersToastProps> = ({ toast }) => {
  if (!toast) return null;
  return <AppToast type={toast.type} text={toast.text} />;
};
