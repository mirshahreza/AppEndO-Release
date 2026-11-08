import type {
  EuaContextSuggestMode,
  EuaFieldAssistContextSuggestRequest,
  EuaFieldKind,
} from '../../api/contracts/ai/euaFieldAssist';

export const EUA_CONTEXT_PLACEHOLDER_MAX_CHARS = 120;
export const EUA_CONTEXT_CONTENT_MAX_CHARS = 600;

export const EUA_CONTEXT_SUGGEST_SYSTEM_PROMPT =
  'You help users complete form fields. Use the field label, section context, and neighboring field values. Return ONLY the requested text with no quotes, labels, or explanation.';

export function buildContextSuggestUserPrompt(
  request: EuaFieldAssistContextSuggestRequest,
): string {
  const lines: string[] = [];

  if (request.sectionTitle?.trim()) {
    lines.push(`Section: ${request.sectionTitle.trim()}`);
  }
  if (request.sectionDescription?.trim()) {
    lines.push(`Section description: ${request.sectionDescription.trim()}`);
  }
  if (request.fieldLabel?.trim()) {
    lines.push(`Field label: ${request.fieldLabel.trim()}`);
  }
  if (request.fieldKind === 'singleLine') {
    lines.push('Field type: single-line text input.');
  } else if (request.fieldKind === 'multiline') {
    lines.push('Field type: multiline textarea.');
  }

  const neighbors = (request.neighborFields ?? [])
    .filter((entry) => entry.label.trim())
    .slice(0, 8);
  if (neighbors.length > 0) {
    lines.push('Nearby fields:');
    neighbors.forEach((entry) => {
      const value = entry.value?.trim();
      lines.push(value ? `- ${entry.label}: ${value}` : `- ${entry.label}: (empty)`);
    });
  }

  const currentValue = request.currentValue?.trim();
  if (currentValue) {
    lines.push(`Current value: ${currentValue}`);
  }

  if (request.mode === 'placeholder') {
    lines.push('Task: Write a short, helpful placeholder hint (one line) for this empty field.');
  } else {
    lines.push('Task: Suggest a realistic starter value the user can edit and apply.');
  }

  return lines.join('\n');
}

export function normalizeContextSuggestion(
  raw: string,
  mode: EuaContextSuggestMode,
  fieldKind?: EuaFieldKind,
): string {
  const trimmed = raw.trim().replace(/^["'`]+|["'`]+$/g, '');
  if (!trimmed) {
    return '';
  }

  const maxChars = mode === 'placeholder'
    ? EUA_CONTEXT_PLACEHOLDER_MAX_CHARS
    : EUA_CONTEXT_CONTENT_MAX_CHARS;

  let normalized = trimmed.slice(0, maxChars);

  if (fieldKind === 'singleLine' || mode === 'placeholder') {
    normalized = normalized.replace(/\s*[\r\n]+\s*/g, ' ').trim();
  }

  return normalized;
}
