import React from 'react';
import { Trash2 } from 'lucide-react';
import { ConfirmDialogShell, DestructiveConfirmBody } from '../../../../shared/ui';
import type { AiMcpServerPublicConfig } from '../../../../shared/api/contracts/ai/types';

export type McpServerDeleteModalProps = {
  server: AiMcpServerPublicConfig | null;
  deleteError: string | null;
  onCancel: () => void;
  onConfirm: () => void;
};

export const McpServerDeleteModal: React.FC<McpServerDeleteModalProps> = ({
  server,
  deleteError,
  onCancel,
  onConfirm,
}) => {
  if (!server) return null;

  return (
    <ConfirmDialogShell
      size="md"
      title="Delete MCP Server"
      icon={<Trash2 className="h-4 w-4" />}
      onClose={onCancel}
      onConfirm={onConfirm}
      confirmLabel="Delete"
      error={deleteError}
    >
      <DestructiveConfirmBody
        question="Are you sure you want to delete this MCP server?"
        entityName={server.label}
      />
    </ConfirmDialogShell>
  );
};
