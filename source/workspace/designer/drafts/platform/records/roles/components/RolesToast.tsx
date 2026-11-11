import React from 'react';
import { AppToast } from '@/shared/ui/AppToast';
import type { ToastState } from '../types';

export type RolesToastProps = {
  toast: ToastState | null;
};

export const RolesToast: React.FC<RolesToastProps> = ({ toast }) => {
  if (!toast) return null;
  return <AppToast type={toast.type} text={toast.text} />;
};
