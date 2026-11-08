import React, { useState } from 'react';
import { Braces, RotateCcw } from 'lucide-react';
import { AppButton, CreateEditModalShell } from '../../../shared/ui';
import { getBaseComponentsSectionTheme } from '../baseComponentsSectionTheme';
import type { SectionId } from '../types';
import { BaseComponentsPreviewViewportSelect } from './BaseComponentsPreviewViewport';
import { BaseComponentsConfigJsonPreview } from './BaseComponentsWorkspacePanel';

export const BASE_COMPONENTS_TOOLBAR_SEPARATOR_CLASS = 'h-5 w-px shrink-0 bg-slate-200';

export const BaseComponentsToolbarSeparator: React.FC = () => (
  <span className={BASE_COMPONENTS_TOOLBAR_SEPARATOR_CLASS} aria-hidden />
);

/** Standard Reset control for baseComponents configurators — labeled + Lucide icon. */
export const BaseComponentsResetButton: React.FC<{
  onClick: () => void;
  disabled?: boolean;
}> = ({ onClick, disabled }) => (
  <AppButton intent="utility" size="sm" disabled={disabled} onClick={onClick}>
    <RotateCcw className="h-3.5 w-3.5" />
    Reset
  </AppButton>
);

type BaseComponentsConfigDialogProps = {
  sectionId: SectionId;
  json: string;
  open: boolean;
  onClose: () => void;
};

export const BaseComponentsConfigDialog: React.FC<BaseComponentsConfigDialogProps> = ({
  sectionId,
  json,
  open,
  onClose,
}) => {
  if (!open) {
    return null;
  }

  const theme = getBaseComponentsSectionTheme(sectionId);

  return (
    <CreateEditModalShell
      title="Preview config"
      onClose={onClose}
      onBackdropClick={onClose}
      size="2xl"
      bodyClassName="p-3"
    >
      <BaseComponentsConfigJsonPreview
        json={json}
        tone={theme.jsonTone}
        className="max-h-[min(60vh,28rem)]"
      />
    </CreateEditModalShell>
  );
};

type BaseComponentsConfigToolbarControlsProps = {
  sectionId: SectionId;
  json: string;
  children: React.ReactNode;
};

export const BaseComponentsConfigToolbarControls: React.FC<BaseComponentsConfigToolbarControlsProps> = ({
  sectionId,
  json,
  children,
}) => {
  const [configOpen, setConfigOpen] = useState(false);

  return (
    <>
      {children}
      <BaseComponentsToolbarSeparator />
      <BaseComponentsPreviewViewportSelect />
      <BaseComponentsToolbarSeparator />
      <AppButton intent="utility" size="sm" onClick={() => setConfigOpen(true)}>
        <Braces className="h-3.5 w-3.5" />
        Preview config
      </AppButton>
      <BaseComponentsConfigDialog
        sectionId={sectionId}
        json={json}
        open={configOpen}
        onClose={() => setConfigOpen(false)}
      />
    </>
  );
};
