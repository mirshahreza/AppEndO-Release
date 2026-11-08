import { describe, expect, it } from 'vitest';
import {
  FEEDBACK_SUBJECT_BUG,
  FEEDBACK_SUBJECT_SUGGESTION,
} from '../../../shared/api/contracts/feedback/constants';
import { resolveFeedbackSubjectLabel } from '../feedbackSubjectLabel';

describe('resolveFeedbackSubjectLabel', () => {
  it('uses culture keys for seeded subject codes', () => {
    const t = (key: string) => (key === 'feedback.subject.bug' ? 'بلاغ خطأ' : key);
    expect(resolveFeedbackSubjectLabel(t, FEEDBACK_SUBJECT_BUG, 'Bug report')).toBe('بلاغ خطأ');
  });

  it('falls back to API label for unknown codes', () => {
    const t = (key: string) => key;
    expect(resolveFeedbackSubjectLabel(t, '100.3.99', 'Custom subject')).toBe('Custom subject');
  });

  it('falls back to id when no label and no culture key', () => {
    const t = (key: string) => key;
    expect(resolveFeedbackSubjectLabel(t, '100.3.99', null)).toBe('100.3.99');
  });
});
