import React from 'react';
import type { EuaAssistSurface, EuaExtractedFieldValue, EuaFieldMapEntry } from '../../api/contracts/ai/euaFieldAssist';
import {
  AiStructuredExtractLauncher,
  AiTextToFormLauncher,
  AiVoiceFormFillLauncher,
} from './AiFormFillDialog';
import {
  useIsEuaCapabilityEnabled,
  useEuaDefaultModelId,
  useEuaFieldAssistReady,
} from './useEuaCapability';

export type AiPublishedFormAssistToolbarProps = {
  fields: EuaFieldMapEntry[];
  sectionId?: string;
  formId?: string;
  sectionTitle?: string;
  sectionDescription?: string;
  surface?: EuaAssistSurface;
  modelId?: string;
  disabled?: boolean;
  actionsEnabled?: boolean;
  onApply: (updates: EuaExtractedFieldValue[]) => void;
  className?: string;
};

export const AiPublishedFormAssistToolbar: React.FC<AiPublishedFormAssistToolbarProps> = ({
  fields,
  sectionId,
  formId,
  sectionTitle,
  sectionDescription,
  surface = 'published',
  modelId: modelIdProp,
  disabled = false,
  actionsEnabled: actionsEnabledProp,
  onApply,
  className,
}) => {
  const ready = useEuaFieldAssistReady();
  const defaultModelId = useEuaDefaultModelId();
  const modelId = modelIdProp ?? defaultModelId;
  const structuredEnabled = useIsEuaCapabilityEnabled('eua.structuredExtract');
  const voiceEnabled = useIsEuaCapabilityEnabled('eua.voiceFormFill');
  const textToFormEnabled = useIsEuaCapabilityEnabled('eua.textToForm');
  const sectionScoped = useIsEuaCapabilityEnabled('eua.sectionScopedFill');
  const actionsEnabled = (actionsEnabledProp ?? ready) && !disabled;

  if (surface !== 'published' || fields.length === 0) {
    return null;
  }

  const shared = {
    fields,
    sectionId: sectionScoped ? sectionId : undefined,
    formId,
    sectionTitle,
    sectionDescription,
    surface,
    modelId,
    disabled,
    actionsEnabled,
    onApply,
  };

  return (
    <div className={className ?? 'flex flex-wrap justify-end gap-2 pb-1'}>
      {structuredEnabled ? (
        <AiStructuredExtractLauncher {...shared} />
      ) : null}
      {textToFormEnabled ? (
        <AiTextToFormLauncher {...shared} />
      ) : null}
      {voiceEnabled ? (
        <AiVoiceFormFillLauncher {...shared} />
      ) : null}
    </div>
  );
};
