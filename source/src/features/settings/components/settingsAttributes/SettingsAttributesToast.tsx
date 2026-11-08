import React from 'react';
import { AppToast } from '../../../../shared/ui/AppToast';
import type { ToastState } from './types';

export type SettingsAttributesToastProps = {
  toast: ToastState | null;
};

export const SettingsAttributesToast: React.FC<SettingsAttributesToastProps> = ({ toast }) => {
  if (!toast) return null;
  return <AppToast type={toast.type} text={toast.text} />;
};
