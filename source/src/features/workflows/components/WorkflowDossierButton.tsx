import React from 'react';
import { cn } from '../../../lib/utils';
import { AppButton } from '../../../shared/ui';
import { ICON_ACTION_BUTTON_SM_CLASS, ICON_ACTION_VIEW_CLASS } from '../../../shared/ui/surfaceClasses';
import { UiTooltip } from '../../../shared/ui/UiTooltip';
import { WORKFLOW_DOSSIER_VIEW_TITLE, WorkflowDossierIcon } from './workflowDossierPresentation';

export const WorkflowDossierButton: React.FC<{
  definitionId: number;
  workflowKey: string;
  variant: 'header' | 'card';
  disabled?: boolean;
  onOpen: () => void;
}> = ({ workflowKey, variant, disabled = false, onOpen }) => (
  variant === 'header' ? (
    <AppButton intent="toggle-off" size="sm" disabled={disabled} onClick={onOpen}>
      <WorkflowDossierIcon /> 360
    </AppButton>
  ) : (
    <UiTooltip
      className={cn(
        ICON_ACTION_BUTTON_SM_CLASS,
        ICON_ACTION_VIEW_CLASS,
        'shrink-0 outline-none',
        disabled && 'pointer-events-none opacity-40',
      )}
      aria-label={`${WORKFLOW_DOSSIER_VIEW_TITLE} — ${workflowKey}`}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onOpen();
      }}
      contentClassName="z-[9999] px-3 py-1.5 text-xs"
      content={WORKFLOW_DOSSIER_VIEW_TITLE}
    >
      <WorkflowDossierIcon />
    </UiTooltip>
  )
);
