import {
  FEEDBACK_SUBJECT_BUG,
  FEEDBACK_SUBJECT_PRAISE,
  FEEDBACK_SUBJECT_QUESTION,
  FEEDBACK_SUBJECT_SUGGESTION,
} from '../../shared/api/contracts/feedback/constants';

const FEEDBACK_SUBJECT_LABEL_KEYS: Record<string, string> = {
  [FEEDBACK_SUBJECT_BUG]: 'feedback.subject.bug',
  [FEEDBACK_SUBJECT_SUGGESTION]: 'feedback.subject.suggestion',
  [FEEDBACK_SUBJECT_QUESTION]: 'feedback.subject.question',
  [FEEDBACK_SUBJECT_PRAISE]: 'feedback.subject.praise',
};

/** Culture label for a Feedback Subject Base Info code; falls back to API/DB title. */
export function resolveFeedbackSubjectLabel(
  t: (key: string) => string,
  subjectId: string,
  fallbackLabel?: string | null,
): string {
  const key = FEEDBACK_SUBJECT_LABEL_KEYS[subjectId];
  if (key) {
    const translated = t(key);
    if (translated.trim()) {
      return translated;
    }
  }
  const fallback = fallbackLabel?.trim();
  return fallback || subjectId;
}
