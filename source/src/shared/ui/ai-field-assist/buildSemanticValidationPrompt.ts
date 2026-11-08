export const EUA_SEMANTIC_VALIDATION_MAX_OUTPUT_TOKENS = 512;

export const buildSemanticValidationSystemPrompt = (reasonsLanguage?: string): string => {
  const lang = reasonsLanguage?.trim() || 'ar';
  return `Validate the user text against the validation rubric.
Return only a JSON object with this shape:
{
  "ValidationResult": "Valid" or "Not Valid",
  "Reasons": ["reason1", "reason2"]
}
Rules:
- Apply the rubric strictly but fairly.
- If Valid, Reasons must be an empty array.
- If Not Valid, Reasons must explain what is missing or wrong in plain language for the user.
- Write every string in Reasons in language tag "${lang}".`;
};

export type ParsedSemanticValidationResult = {
  valid: boolean;
  reasons: string[];
};

export const parseSemanticValidationModelJson = (raw: string): ParsedSemanticValidationResult => {
  const trimmed = raw.trim();
  const jsonStart = trimmed.indexOf('{');
  const jsonEnd = trimmed.lastIndexOf('}');
  const slice = jsonStart >= 0 && jsonEnd > jsonStart
    ? trimmed.slice(jsonStart, jsonEnd + 1)
    : trimmed;

  let parsed: unknown;
  try {
    parsed = JSON.parse(slice);
  } catch {
    return { valid: false, reasons: ['Could not interpret the validation response. Try again.'] };
  }

  if (!parsed || typeof parsed !== 'object') {
    return { valid: false, reasons: ['Validation response was empty. Try again.'] };
  }

  const record = parsed as Record<string, unknown>;
  const result = String(record.ValidationResult ?? record.validationResult ?? '').trim();
  const reasonsRaw = record.Reasons ?? record.reasons;
  const reasons = Array.isArray(reasonsRaw)
    ? reasonsRaw.map((item) => String(item ?? '').trim()).filter(Boolean)
    : [];

  if (/^valid$/i.test(result)) {
    return { valid: true, reasons: [] };
  }
  if (/^not\s*valid$/i.test(result) || /^invalid$/i.test(result)) {
    return {
      valid: false,
      reasons: reasons.length > 0 ? reasons : ['The text does not meet the required criteria.'],
    };
  }

  return { valid: false, reasons: ['Unexpected validation response. Try again.'] };
};

export const buildSemanticValidationUserPrompt = (rubric: string, text: string, fieldLabel?: string): string => {
  const labelLine = fieldLabel?.trim() ? `Field: ${fieldLabel.trim()}\n` : '';
  return `${labelLine}Validation rubric:
${rubric.trim()}

User text to validate:
${text.trim()}`;
};
