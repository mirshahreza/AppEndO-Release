import React from 'react';
import { Save, X } from 'lucide-react';
import type { AiCapabilityPack } from '../../../../shared/api/contracts/ai/capabilityPacks';
import { FeatureToggleField } from '../../../../shared/ui';
import { AppButton } from '../../../../shared/ui/AppButton';
import { CreateEditModalShell } from '../../../../shared/ui/CreateEditModalShell';
import { SETTINGS_FORM_GROUP_BODY_STACK_CLASS } from '../form/SettingsFormPrimitives';

export type McpBuiltinPackModalProps = {
  open: boolean;
  pack: AiCapabilityPack | null;
  defaultEnabled: boolean;
  formError: string | null;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: () => void;
  onDefaultEnabledChange: (enabled: boolean) => void;
};

export const McpBuiltinPackModal: React.FC<McpBuiltinPackModalProps> = ({
  open,
  pack,
  defaultEnabled,
  formError,
  isSaving,
  onClose,
  onSubmit,
  onDefaultEnabledChange,
}) => {
  if (!open || !pack) return null;

  return (
    <CreateEditModalShell
      size="3xl"
      title={`${pack.label} — ${pack.id}`}
      onClose={onClose}
      footer={(
        <>
          <AppButton intent="cancel" onClick={onClose} disabled={isSaving}>
            <X className="h-3.5 w-3.5" />
            Cancel
          </AppButton>
          <AppButton intent="primary" onClick={onSubmit} disabled={isSaving}>
            <Save className="h-3.5 w-3.5" />
            {isSaving ? 'Saving...' : 'Save'}
          </AppButton>
        </>
      )}
    >
      <div className={SETTINGS_FORM_GROUP_BODY_STACK_CLASS}>
        <p className="text-xs text-slate-500">{pack.description}</p>

        {formError ? <p className="text-xs font-semibold text-rose-600">{formError}</p> : null}

        <FeatureToggleField
          checked={defaultEnabled}
          onChange={onDefaultEnabledChange}
          title="Enabled by default for new Agent sessions"
          description="Users can still toggle this pack per chat in AI Models capabilities."
        />

        <div className="flex flex-col gap-[2px]">
          <span className="text-sm font-semibold text-slate-700 ps-[4px]">Tools</span>
          <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3">
            <ul className="flex flex-col gap-1">
              {pack.toolNames.map((toolName) => (
                <li key={toolName} className="font-mono text-xs text-slate-600">{toolName}</li>
              ))}
            </ul>
          </div>
        </div>

        {pack.hasWriteTools ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            This pack includes write tools that require user confirmation before apply.
          </p>
        ) : null}
      </div>
    </CreateEditModalShell>
  );
};
