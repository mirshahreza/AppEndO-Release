import React, { useCallback } from 'react';
import type { EuaAssistSurface, EuaContextNeighborField, EuaFieldKind } from '../../api/contracts/ai/euaFieldAssist';
import { FormField, type FormFieldProps } from '../FormSection';
import { AiContextSuggestLabelButton } from './AiContextSuggestLabelButton';
import { useAiFieldAssistSectionContext } from './AiFieldAssistSectionContext';
import {
  useEuaDefaultModelId,
  useEuaFieldAssistReady,
  useEuaStatusSnapshot,
} from './useEuaCapability';

export type AiAssistFormFieldProps = FormFieldProps & {
  contextSuggest?: boolean;
  fieldKind?: EuaFieldKind;
  sectionTitle?: string;
  sectionDescription?: string;
  neighborFields?: EuaContextNeighborField[];
  getValue: () => string;
  onApplyValue: (value: string) => void;
  aiAssistSurface?: EuaAssistSurface;
};

const cloneAssistChild = (
  children: React.ReactNode,
  props: Record<string, unknown>,
): React.ReactNode => {
  if (!React.isValidElement(children)) {
    return children;
  }
  return React.cloneElement(children, props);
};

export const AiAssistFormField: React.FC<AiAssistFormFieldProps> = ({
  contextSuggest = true,
  fieldKind = 'multiline',
  sectionTitle,
  sectionDescription,
  neighborFields,
  getValue,
  onApplyValue,
  aiAssistSurface = 'admin',
  children,
  label,
  ...formFieldProps
}) => {
  const sectionContext = useAiFieldAssistSectionContext();
  const status = useEuaStatusSnapshot();
  const actionsEnabled = useEuaFieldAssistReady();
  const defaultModelId = useEuaDefaultModelId();
  const contextSuggestDisabled = status?.capabilities['eua.contextSuggest'] === false;
  const shouldSuggest = contextSuggest && !contextSuggestDisabled && actionsEnabled;

  const resolvedSectionTitle = sectionTitle ?? sectionContext.sectionTitle;
  const resolvedSectionDescription = sectionDescription ?? sectionContext.sectionDescription;
  const resolvedNeighborFields = neighborFields ?? sectionContext.neighborFields;

  const handleApply = useCallback((nextValue: string) => {
    onApplyValue(nextValue);
  }, [onApplyValue]);

  const labelExtra = shouldSuggest ? (
    <AiContextSuggestLabelButton
      fieldLabel={label}
      fieldKind={fieldKind}
      sectionTitle={resolvedSectionTitle}
      sectionDescription={resolvedSectionDescription}
      neighborFields={resolvedNeighborFields}
      getValue={getValue}
      onApply={(nextValue) => handleApply(nextValue)}
      surface={aiAssistSurface}
      modelId={defaultModelId}
      actionsEnabled={actionsEnabled}
    />
  ) : null;

  const assistedChild = shouldSuggest
    ? cloneAssistChild(children, {
      contextSuggest: true,
      fieldLabel: label,
      aiAssistSurface,
      sectionTitle: resolvedSectionTitle,
      sectionDescription: resolvedSectionDescription,
      neighborFields: resolvedNeighborFields,
    })
    : children;

  return (
    <FormField
      {...formFieldProps}
      label={label}
      labelExtra={labelExtra}
    >
      {assistedChild}
    </FormField>
  );
};
