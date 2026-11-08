import type { EuaTransformAction, EuaFieldKind } from '../../api/contracts/ai/euaFieldAssist';

const BASE_RULES =
  'Return ONLY the transformed text. Do not add explanations, quotes, or markdown code fences unless the task is markdown formatting.';

const SINGLE_LINE_RULES =
  'This is a single-line field (title, slug, subject, etc.). Keep the result on one line with no line breaks. ';
const SINGLE_LINE_CONCISE = 'Be concise. ';

export function buildTransformSystemPrompt(action: EuaTransformAction, options?: {
  customPrompt?: string;
  targetLanguage?: string;
  fieldLabel?: string;
  fieldKind?: EuaFieldKind;
}): string {
  const fieldHint = options?.fieldLabel?.trim()
    ? `The text is from a form field labeled "${options.fieldLabel.trim()}". `
    : '';
  const lineHint = options?.fieldKind === 'singleLine'
    ? `${SINGLE_LINE_RULES}${action === 'expand' ? '' : SINGLE_LINE_CONCISE}`
    : '';

  switch (action) {
    case 'expand':
      return `${fieldHint}${lineHint}${BASE_RULES} Expand the text with more useful detail while preserving meaning and tone.`;
    case 'summarize':
      return `${fieldHint}${lineHint}${BASE_RULES} Summarize the text concisely while keeping key facts.`;
    case 'formal':
      return `${fieldHint}${lineHint}${BASE_RULES} Rewrite in a formal, professional tone.`;
    case 'casual':
      return `${fieldHint}${lineHint}${BASE_RULES} Rewrite in a casual, conversational tone.`;
    case 'spell-grammar':
      return `${fieldHint}${lineHint}${BASE_RULES} Fix spelling, grammar, punctuation, and syntax.`;
    case 'markdown-format':
      return `${fieldHint}${lineHint}Format the text as clean, readable markdown. Return only the markdown body.`;
    case 'translate': {
      const language = options?.targetLanguage?.trim() || "the user's language";
      return `${fieldHint}${lineHint}${BASE_RULES} Translate the text to ${language}.`;
    }
    case 'custom': {
      const prompt = options?.customPrompt?.trim();
      if (!prompt) {
        throw new Error('Custom prompt is required.');
      }
      return `${fieldHint}${lineHint}${BASE_RULES} ${prompt}`;
    }
    default:
      return `${fieldHint}${lineHint}${BASE_RULES}`;
  }
}

export function stripAiResponseWrapping(text: string): string {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/^```(?:\w+)?\s*([\s\S]*?)\s*```$/);
  if (fenceMatch?.[1]) {
    return fenceMatch[1].trim();
  }
  return trimmed;
}

export function mergeSelectionTransform(
  fullText: string,
  selectionStart: number,
  selectionEnd: number,
  transformedSelection: string,
): string {
  return `${fullText.slice(0, selectionStart)}${transformedSelection}${fullText.slice(selectionEnd)}`;
}
