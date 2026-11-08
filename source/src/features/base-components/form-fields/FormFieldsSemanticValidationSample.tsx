import React, { useMemo, useState } from 'react';
import { FormField, FormSection, UiSelectMenu, type UiSelectMenuOption } from '../../../shared/ui';
import { SemanticAssistTextarea } from '../../../shared/ui/ai-field-assist/SemanticAssistTextarea';
import type { HeroUiFieldSize } from '../../../shared/ui/heroFieldSize';

const DEMO_VOCAB = [
  {
    id: 'brief',
    label: 'Brief update',
    userGuidance: 'One or two sentences is enough for a brief update.',
    semanticRubric: 'Accept any clear polite sentence about a deployment or release.',
  },
  {
    id: 'detailed',
    label: 'Detailed incident',
    userGuidance: 'Describe impact, root cause, and the next step.',
    semanticRubric: 'Must mention user impact and at least one concrete next action.',
  },
] as const;

type FormFieldsSemanticValidationSampleProps = {
  size: HeroUiFieldSize;
  disabled?: boolean;
};

export const FormFieldsSemanticValidationSample: React.FC<FormFieldsSemanticValidationSampleProps> = ({
  size,
  disabled = false,
}) => {
  const [scenarioId, setScenarioId] = useState<string>(DEMO_VOCAB[0].id);
  const [note, setNote] = useState('');

  const selectOptions = useMemo((): UiSelectMenuOption[] => (
    DEMO_VOCAB.map((row) => ({
      id: row.id,
      textValue: row.label,
      content: row.label,
    }))
  ), []);

  const vocabSnapshots = useMemo(
    () => DEMO_VOCAB.map((row) => ({
      id: row.id,
      userGuidance: row.userGuidance,
      semanticRubric: row.semanticRubric,
    })),
    [],
  );

  return (
    <FormSection
      title="Semantic validation"
      tone="amber"
      divided
      description="LLM rubric can be static or bound to a LOV row. Blur the note field after local length checks pass to run validation (requires AI + EUA semantic validation enabled)."
    >
      <div id="semantic-validation-fields" className="flex flex-col gap-3">
        <FormField label="Scenario">
          <UiSelectMenu
            size={size}
            ariaLabel="Semantic validation scenario"
            selectedKey={scenarioId}
            options={selectOptions}
            isDisabled={disabled}
            onSelectionChange={setScenarioId}
          />
        </FormField>
        <FormField label="Operator note">
          <SemanticAssistTextarea
            size={size}
            rows={4}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            isDisabled={disabled}
            fieldLabel="Operator note"
            localRulesPass={note.trim().length >= 12}
            semanticValidation={{
              rubric: { kind: 'vocabOption', optionId: scenarioId },
              triggers: ['blur', 'submit'],
            }}
            vocabOptions={vocabSnapshots}
          />
        </FormField>
      </div>
    </FormSection>
  );
};
