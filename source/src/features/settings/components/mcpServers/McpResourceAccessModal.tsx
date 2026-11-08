import React, { useEffect, useState } from 'react';
import type { FunctionAccessControl } from '../../../../shared/api/contracts/server-functions/accessControl';
import { parseFunctionAccessControl } from '../../../../shared/api/contracts/server-functions/accessControl';
import type { McpGrantResourceKind } from '../../../../shared/api/contracts/ai/mcpAccess';
import { AccessControlModal } from '../../../../shared/ui/AccessControlModal';

export type McpResourceAccessTarget = {
  resourceId: string;
  resourceKind: McpGrantResourceKind;
  label: string;
  accessControl: FunctionAccessControl;
};

export type McpResourceAccessModalProps = {
  open: boolean;
  target: McpResourceAccessTarget | null;
  isSaving?: boolean;
  onClose: () => void;
  onSave: (accessControl: FunctionAccessControl) => void | Promise<void>;
};

export const McpResourceAccessModal: React.FC<McpResourceAccessModalProps> = ({
  open,
  target,
  isSaving = false,
  onClose,
  onSave,
}) => {
  const [draftAccess, setDraftAccess] = useState<FunctionAccessControl>(() => (
    parseFunctionAccessControl(null)
  ));

  useEffect(() => {
    if (!open || !target) {
      return;
    }
    setDraftAccess(parseFunctionAccessControl(target.accessControl));
  }, [open, target]);

  if (!open || !target) {
    return null;
  }

  return (
    <AccessControlModal
      open
      titlePath={target.label}
      accessControl={draftAccess}
      disabled={isSaving}
      onChange={setDraftAccess}
      onClose={onClose}
      onSave={async () => {
        await onSave(draftAccess);
      }}
    />
  );
};
