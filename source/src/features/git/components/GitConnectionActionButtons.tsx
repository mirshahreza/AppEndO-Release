import React from 'react';
import { GitBranch, LogOut, Pencil } from 'lucide-react';
import { AppButton } from '../../../shared/ui';

type GitConnectionActionButtonsProps = {
  onConnect: () => void;
  connectLabel?: string;
  connectIcon?: 'branch' | 'pencil';
  showDisconnect?: boolean;
  disconnectLabel?: string;
  onDisconnect?: () => void;
  isDisconnecting?: boolean;
};

export const GitConnectionActionButtons: React.FC<GitConnectionActionButtonsProps> = ({
  onConnect,
  connectLabel = 'Git Config',
  connectIcon = 'branch',
  showDisconnect = false,
  disconnectLabel = 'GitHub',
  onDisconnect,
  isDisconnecting = false,
}) => {
  const ConnectIcon = connectIcon === 'pencil' ? Pencil : GitBranch;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <AppButton intent={connectIcon === 'pencil' ? 'secondary' : 'primary'} size="sm" onClick={onConnect}>
        <ConnectIcon className="w-3.5 h-3.5" />
        {connectLabel}
      </AppButton>
      {showDisconnect && onDisconnect ? (
        <AppButton
          intent="cancel"
          size="sm"
          onClick={onDisconnect}
          disabled={isDisconnecting}
        >
          <LogOut className="w-3.5 h-3.5" />
          {isDisconnecting ? 'Disconnecting…' : `Disconnect from ${disconnectLabel}`}
        </AppButton>
      ) : null}
    </div>
  );
};
