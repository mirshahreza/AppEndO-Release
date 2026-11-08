import { useMemo } from 'react';
import type { SemanticValidationPolicy } from '../../api/contracts/ai/euaSemanticValidation';
import type { VocabSemanticOptionSnapshot } from '../../api/contracts/ai/euaSemanticValidation';
import {
  resolveSemanticRubricText,
  resolveSemanticUserGuidance,
} from '../../lib/resolveSemanticValidationRubric';

export type UseResolvedSemanticValidationContentOptions = {
  policy?: SemanticValidationPolicy | null;
  vocabOptions?: VocabSemanticOptionSnapshot[];
  /** Direct overrides (e.g. already resolved server-side). */
  userGuidance?: string;
  semanticRubric?: string;
  cultureText?: (key: string) => string | undefined;
};

export function useResolvedSemanticValidationContent(
  options: UseResolvedSemanticValidationContentOptions,
): { userGuidance: string; semanticRubric: string } {
  const {
    policy,
    vocabOptions,
    userGuidance: guidanceOverride,
    semanticRubric: rubricOverride,
    cultureText,
  } = options;

  return useMemo(() => {
    const context = { vocabOptions, cultureText };
    const rubricFromPolicy = resolveSemanticRubricText(policy?.rubric ?? null, context);
    const guidanceFromPolicy = resolveSemanticUserGuidance(policy?.rubric ?? null, context);

    return {
      userGuidance: (guidanceOverride ?? guidanceFromPolicy).trim(),
      semanticRubric: (rubricOverride ?? rubricFromPolicy).trim(),
    };
  }, [cultureText, guidanceOverride, policy?.rubric, rubricOverride, vocabOptions]);
}
