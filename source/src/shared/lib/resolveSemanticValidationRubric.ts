import type { SemanticRubricSource, SemanticValidationPolicy } from '../api/contracts/ai/euaSemanticValidation';
import type { VocabSemanticOptionSnapshot } from '../api/contracts/ai/euaSemanticValidation';

export type ResolveSemanticRubricContext = {
  vocabOptions?: VocabSemanticOptionSnapshot[];
  cultureText?: (key: string) => string | undefined;
};

export const resolveSemanticRubricText = (
  source: SemanticRubricSource | null | undefined,
  context: ResolveSemanticRubricContext,
): string => {
  if (!source) {
    return '';
  }

  if (source.kind === 'static') {
    return source.text.trim();
  }

  if (source.kind === 'cultureKey') {
    const text = context.cultureText?.(source.key)?.trim();
    return text ?? '';
  }

  if (source.kind === 'vocabOption') {
    const id = source.optionId?.trim();
    if (!id) {
      return '';
    }
    const match = context.vocabOptions?.find((row) => row.id === id);
    return match?.semanticRubric?.trim() ?? '';
  }

  return '';
};

export const resolveSemanticUserGuidance = (
  source: SemanticRubricSource | null | undefined,
  context: ResolveSemanticRubricContext,
): string => {
  if (!source || source.kind !== 'vocabOption') {
    return '';
  }
  const id = source.optionId?.trim();
  if (!id) {
    return '';
  }
  const match = context.vocabOptions?.find((row) => row.id === id);
  return match?.userGuidance?.trim() ?? '';
};

export const defaultSemanticValidationTriggers = (
  policy: SemanticValidationPolicy | null | undefined,
): ('blur' | 'submit')[] => {
  if (!policy?.triggers?.length) {
    return ['blur', 'submit'];
  }
  return policy.triggers;
};
