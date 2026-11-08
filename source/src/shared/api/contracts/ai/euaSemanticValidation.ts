/** Semantic (LLM) field validation — shared client/server contracts. */

export type SemanticValidationTrigger = 'blur' | 'submit';

export type SemanticRubricSource =
  | { kind: 'static'; text: string }
  | { kind: 'cultureKey'; key: string }
  | {
    kind: 'vocabOption';
    /** Selected Base Info row id (from a LOV on the same form). */
    optionId: string | null;
  };

export type SemanticValidationPolicy = {
  rubric: SemanticRubricSource | null;
  triggers?: SemanticValidationTrigger[];
  /** Run LLM check only after local rules pass (default true). */
  runAfterLocalRules?: boolean;
};

export type EuaFieldAssistSemanticValidateRequest = {
  text: string;
  rubric: string;
  fieldLabel?: string;
  culture?: string;
  modelId?: string;
  /** BCP-47 or short lang hint for reason strings (default ar). */
  reasonsLanguage?: string;
};

export type EuaFieldAssistSemanticValidateResponse = {
  success: boolean;
  valid: boolean;
  reasons: string[];
  modelId?: string;
  error?: string;
};

export type EuaVocabSemanticContextRecord = {
  id: string;
  parentId: string | null;
  title: string;
  userGuidance: string;
  semanticRubric: string;
};

export type EuaVocabSemanticContextGetResponse = {
  success: boolean;
  record: EuaVocabSemanticContextRecord;
};

export type EuaVocabSemanticContextPatchRequest = {
  userGuidance: string;
  semanticRubric: string;
  /** When set, record must belong to this parent (guardrail). */
  expectedParentId?: string;
};

export type EuaVocabSemanticContextPatchResponse = {
  success: boolean;
  record: EuaVocabSemanticContextRecord;
};

export type VocabSemanticOptionSnapshot = {
  id: string;
  userGuidance?: string;
  semanticRubric?: string;
};
