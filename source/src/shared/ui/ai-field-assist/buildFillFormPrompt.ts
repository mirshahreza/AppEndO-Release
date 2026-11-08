import type {
  EuaFieldAssistExtractRequest,
  EuaFieldMapEntry,
} from '../../api/contracts/ai/euaFieldAssist';

export const EUA_NARRATIVE_FILL_SYSTEM_PROMPT =
  'You fill form fields from a natural-language description. Return ONLY valid JSON: {"fields":[{"name":"fieldName","value":"value"}]}. Use exact schema names. Omit unknown fields. No markdown.';

export function buildNarrativeFillUserPrompt(request: EuaFieldAssistExtractRequest): string {
  const lines: string[] = [];

  if (request.sectionTitle?.trim()) {
    lines.push(`Section: ${request.sectionTitle.trim()}`);
  }
  if (request.sectionDescription?.trim()) {
    lines.push(`Section description: ${request.sectionDescription.trim()}`);
  }

  lines.push('Field schema (use name exactly in JSON output):');
  request.fields.forEach((field) => {
    const hints = [
      `name="${field.name}"`,
      `label="${field.label}"`,
      `type=${field.type}`,
      field.required ? 'required=true' : null,
      field.validationHint ? `hint=${field.validationHint}` : null,
      field.currentValue?.trim() ? `current=${field.currentValue.trim()}` : null,
    ].filter(Boolean);
    lines.push(`- ${hints.join('; ')}`);
  });

  lines.push('');
  lines.push('User description of what to enter in the form:');
  lines.push(request.text.trim());

  return lines.join('\n');
}

export function filterEuaFieldsBySection(
  fields: EuaFieldMapEntry[],
  sectionId?: string,
): EuaFieldMapEntry[] {
  const normalizedSectionId = sectionId?.trim();
  if (!normalizedSectionId) {
    return fields;
  }

  return fields.filter((field) => !field.sectionId || field.sectionId === normalizedSectionId);
}
