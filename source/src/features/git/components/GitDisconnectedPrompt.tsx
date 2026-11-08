import React from 'react';
import { GitConnectionActionButtons } from './GitConnectionActionButtons';

type GitDisconnectedPromptProps = {
  onConnect: () => void;
  showDisconnect?: boolean;
  disconnectLabel?: string;
  onDisconnect?: () => void;
  isDisconnecting?: boolean;
};

export const GitDisconnectedPrompt: React.FC<GitDisconnectedPromptProps> = ({
  onConnect,
  showDisconnect = false,
  disconnectLabel,
  onDisconnect,
  isDisconnecting,
}) => (
  <div className="flex flex-1 min-h-0 items-center justify-center p-8">
    <GitConnectionActionButtons
      onConnect={onConnect}
      showDisconnect={showDisconnect}
      disconnectLabel={disconnectLabel}
      onDisconnect={onDisconnect}
      isDisconnecting={isDisconnecting}
    />
  </div>
);
