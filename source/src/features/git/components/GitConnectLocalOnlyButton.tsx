import React from 'react';
import { HardDrive } from 'lucide-react';
import { AppButton } from '../../../shared/ui/AppButton';

type GitConnectLocalOnlyButtonProps = {
  onClick: () => void;
};

export const GitConnectLocalOnlyButton: React.FC<GitConnectLocalOnlyButtonProps> = ({ onClick }) => (
  <div className="mt-[100px] flex w-full justify-center">
    <AppButton type="button" intent="utility" size="sm" onClick={onClick}>
      <HardDrive className="size-3.5 shrink-0" aria-hidden />
      Continue with local Git only
    </AppButton>
  </div>
);
