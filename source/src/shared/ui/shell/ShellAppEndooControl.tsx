import React from 'react';
import { AppToast } from '../AppToast';
import { ShellAppEndOButton, type ShellAppEndOButtonProps } from './ShellAppEndOButton';
import { useAppEndooShell } from './useAppEndooShell';

export type ShellAppEndooControlProps = ShellAppEndOButtonProps & {
  showTrailingDivider?: boolean;
};

export const ShellAppEndooControl: React.FC<ShellAppEndooControlProps> = ({
  showTrailingDivider = true,
  isOpen,
  onOpenChange,
  ...buttonProps
}) => {
  const { aiEnabled, handleOpenChange, toast } = useAppEndooShell(isOpen, onOpenChange);

  if (!aiEnabled) {
    return null;
  }

  return (
    <>
      <ShellAppEndOButton
        {...buttonProps}
        isOpen={isOpen}
        onOpenChange={handleOpenChange}
      />
      {showTrailingDivider ? (
        <div className="mx-1 hidden h-6 w-[2px] rounded-full bg-border-divider sm:block" />
      ) : null}
      {toast ? <AppToast type={toast.type} text={toast.text} /> : null}
    </>
  );
};
