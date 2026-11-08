import React from 'react';
import { LogOut } from 'lucide-react';
import { ConfirmDialogShell } from '../../../shared/ui';

type GitDisconnectConfirmModalProps = {
  targetLabel: string;
  isDisconnecting?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export const GitDisconnectConfirmModal: React.FC<GitDisconnectConfirmModalProps> = ({
  targetLabel,
  isDisconnecting = false,
  onCancel,
  onConfirm,
}) => (
  <ConfirmDialogShell
    size="md"
    title={`Disconnect from ${targetLabel}`}
    icon={<LogOut className="h-4 w-4" />}
    onClose={onCancel}
    onConfirm={onConfirm}
    confirmLabel={isDisconnecting ? 'Disconnecting…' : 'Disconnect'}
    isConfirming={isDisconnecting}
    confirmingLabel="Disconnecting…"
    cancelDisabled={isDisconnecting}
    confirmDisabled={isDisconnecting}
  >
    This removes your GitHub account link, stored credentials, and remote repository settings
    from AppEndO. Git integration is turned off and you will need to connect again from scratch.
    Your local repository files are not deleted.
  </ConfirmDialogShell>
);
