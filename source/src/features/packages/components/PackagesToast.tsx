import React from 'react';
import { AppToast } from '../../../shared/ui/AppToast';
import type { PackagesToastState } from '../types';

export type PluginsToastProps = {
  toast: PackagesToastState;
  onDismiss?: () => void;
};

export const PackagesToast: React.FC<PluginsToastProps> = ({ toast, onDismiss }) => {
  if (!toast) return null;

  return <AppToast type={toast.type} text={toast.text} onDismiss={onDismiss} />;
};
