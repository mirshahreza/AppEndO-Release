import { useCallback, useRef, useState } from 'react';
import { semanticValidateFieldText } from '../../api/queries/euaFieldAssist';
import { useEuaDefaultModelId, useIsEuaCapabilityEnabled } from './useEuaCapability';

export type UseSemanticFieldValidationOptions = {
  text: string;
  rubric: string | null | undefined;
  fieldLabel?: string;
  enabled?: boolean;
  reasonsLanguage?: string;
  /** Skip LLM when false (e.g. required/min length failed). */
  localRulesPass?: boolean;
};

export type SemanticFieldValidationState = {
  validating: boolean;
  valid: boolean | null;
  reasons: string[];
  validateNow: () => Promise<boolean>;
  resetValidation: () => void;
};

export function useSemanticFieldValidation(
  options: UseSemanticFieldValidationOptions,
): SemanticFieldValidationState {
  const capabilityEnabled = useIsEuaCapabilityEnabled('eua.semanticValidation');
  const defaultModelId = useEuaDefaultModelId();
  const [validating, setValidating] = useState(false);
  const [valid, setValid] = useState<boolean | null>(null);
  const [reasons, setReasons] = useState<string[]>([]);
  const runIdRef = useRef(0);

  const resetValidation = useCallback(() => {
    runIdRef.current += 1;
    setValidating(false);
    setValid(null);
    setReasons([]);
  }, []);

  const validateNow = useCallback(async (): Promise<boolean> => {
    const rubric = options.rubric?.trim() ?? '';
    const text = options.text.trim();
    const enabled = options.enabled !== false;
    const localPass = options.localRulesPass !== false;

    if (!enabled || !capabilityEnabled || !localPass || !rubric || !text) {
      setValid(null);
      setReasons([]);
      return true;
    }

    const runId = runIdRef.current + 1;
    runIdRef.current = runId;
    setValidating(true);

    try {
      const result = await semanticValidateFieldText({
        text,
        rubric,
        fieldLabel: options.fieldLabel,
        modelId: defaultModelId,
        reasonsLanguage: options.reasonsLanguage,
      });

      if (runIdRef.current !== runId) {
        return result.valid;
      }

      setValid(result.valid);
      setReasons(result.valid ? [] : result.reasons);
      return result.valid;
    } catch (error) {
      if (runIdRef.current !== runId) {
        return false;
      }
      const message = error instanceof Error ? error.message : 'Validation failed.';
      setValid(false);
      setReasons([message]);
      return false;
    } finally {
      if (runIdRef.current === runId) {
        setValidating(false);
      }
    }
  }, [
    capabilityEnabled,
    defaultModelId,
    options.enabled,
    options.fieldLabel,
    options.localRulesPass,
    options.reasonsLanguage,
    options.rubric,
    options.text,
  ]);

  return {
    validating,
    valid,
    reasons,
    validateNow,
    resetValidation,
  };
}
