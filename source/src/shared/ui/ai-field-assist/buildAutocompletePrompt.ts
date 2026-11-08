export const EUA_AUTOCOMPLETE_DEBOUNCE_MS = 500;
export const EUA_AUTOCOMPLETE_MIN_CHARS = 2;
export const EUA_AUTOCOMPLETE_MAX_COMPLETION_CHARS = 240;

export const EUA_AUTOCOMPLETE_SYSTEM_PROMPT =
  'You are an inline writing assistant for form fields. Suggest a short, natural continuation for the user text. Return ONLY the new characters to append after the cursor. Do not repeat existing text. No quotes, labels, markdown fences, or explanation.';

export function buildAutocompleteUserPrompt(textBeforeCursor: string, fieldLabel?: string): string {
  const labelHint = fieldLabel?.trim()
    ? `Field label: "${fieldLabel.trim()}".\n`
    : '';

  return `${labelHint}Text so far:\n${textBeforeCursor}\n\nContinuation:`;
}

export function normalizeAutocompleteCompletion(
  textBeforeCursor: string,
  rawCompletion: string,
): string {
  const trimmed = rawCompletion.trim();
  if (!trimmed) {
    return '';
  }

  if (textBeforeCursor && trimmed.startsWith(textBeforeCursor)) {
    return trimmed.slice(textBeforeCursor.length).trimStart();
  }

  if (textBeforeCursor && textBeforeCursor.endsWith(trimmed)) {
    return '';
  }

  return trimmed.slice(0, EUA_AUTOCOMPLETE_MAX_COMPLETION_CHARS);
}
