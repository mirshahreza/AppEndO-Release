import React, { forwardRef, useCallback, useEffect, useImperativeHandle } from 'react';
import { useCultureT } from '../../../core/culture/CultureContext';
import type { SemanticValidationPolicy } from '../../api/contracts/ai/euaSemanticValidation';
import type { VocabSemanticOptionSnapshot } from '../../api/contracts/ai/euaSemanticValidation';
import { AiAssistTextarea, type AiAssistTextareaProps } from './AiAssistTextarea';
import { SemanticValidationFeedback } from './SemanticValidationFeedback';
import { SemanticValidationGuidanceBanner } from './SemanticValidationGuidanceBanner';
import { useResolvedSemanticValidationContent } from './useResolvedSemanticValidationContent';
import { useSemanticFieldValidation } from './useSemanticFieldValidation';

export type SemanticAssistTextareaHandle = {
  validateSemantic: () => Promise<boolean>;
  resetSemanticValidation: () => void;
};

export type SemanticAssistTextareaProps = Omit<AiAssistTextareaProps, 'isInvalid'> & {
  semanticValidation?: SemanticValidationPolicy | null;
  vocabOptions?: VocabSemanticOptionSnapshot[];
  userGuidance?: string;
  semanticRubric?: string;
  /** When false, skip LLM until local rules pass (default true). */
  localRulesPass?: boolean;
  reasonsLanguage?: string;
  onEditVocabContext?: () => void;
  showGuidanceBanner?: boolean;
  showFeedback?: boolean;
  validateOnBlur?: boolean;
  feedbackClassName?: string;
};

export const SemanticAssistTextarea = forwardRef<SemanticAssistTextareaHandle, SemanticAssistTextareaProps>(
  function SemanticAssistTextarea(props, ref) {
    const {
      semanticValidation,
      vocabOptions,
      userGuidance: guidanceOverride,
      semanticRubric: rubricOverride,
      localRulesPass = true,
      reasonsLanguage,
      onEditVocabContext,
      showGuidanceBanner = true,
      showFeedback = true,
      validateOnBlur = true,
      feedbackClassName,
      value,
      onBlur,
      fieldLabel,
      ariaLabel,
      ...textareaProps
    } = props;

    const textValue = value !== undefined ? String(value) : '';
    const cultureT = useCultureT();

    const { userGuidance, semanticRubric } = useResolvedSemanticValidationContent({
      policy: semanticValidation,
      vocabOptions,
      userGuidance: guidanceOverride,
      semanticRubric: rubricOverride,
      cultureText: cultureT,
    });

    const {
      validating,
      valid,
      reasons,
      validateNow,
      resetValidation,
    } = useSemanticFieldValidation({
      text: textValue,
      rubric: semanticRubric,
      fieldLabel: fieldLabel ?? ariaLabel,
      localRulesPass,
      reasonsLanguage,
      enabled: Boolean(semanticRubric),
    });

    useEffect(() => {
      resetValidation();
    }, [semanticRubric, resetValidation]);

    useImperativeHandle(ref, () => ({
      validateSemantic: validateNow,
      resetSemanticValidation: resetValidation,
    }), [resetValidation, validateNow]);

    const handleBlur = useCallback((event: React.FocusEvent<HTMLTextAreaElement>) => {
      onBlur?.(event);
      if (validateOnBlur && semanticRubric && localRulesPass && textValue.trim()) {
        void validateNow();
      }
    }, [localRulesPass, onBlur, semanticRubric, textValue, validateNow, validateOnBlur]);

    return (
      <div className="flex w-full flex-col gap-0">
        {showGuidanceBanner ? (
          <SemanticValidationGuidanceBanner
            guidance={userGuidance}
            onEditGuidance={onEditVocabContext}
          />
        ) : null}
        <AiAssistTextarea
          {...textareaProps}
          value={value}
          fieldLabel={fieldLabel}
          ariaLabel={ariaLabel}
          onBlur={handleBlur}
          isInvalid={valid === false || textareaProps.isInvalid}
        />
        {showFeedback ? (
          <SemanticValidationFeedback
            reasons={reasons}
            validating={validating}
            className={feedbackClassName ?? 'mt-2'}
          />
        ) : null}
      </div>
    );
  },
);
