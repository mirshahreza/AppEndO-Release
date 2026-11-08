import { describe, expect, it } from 'vitest';
import { resolveSemanticRubricText, resolveSemanticUserGuidance } from '../resolveSemanticValidationRubric';

describe('resolveSemanticValidationRubric', () => {
  it('resolves static rubric', () => {
    expect(resolveSemanticRubricText({ kind: 'static', text: ' Rule ' }, {})).toBe('Rule');
  });

  it('resolves vocab option rubric and guidance', () => {
    const options = [{ id: '1', userGuidance: 'Guide', semanticRubric: 'Rubric' }];
    expect(resolveSemanticRubricText({ kind: 'vocabOption', optionId: '1' }, { vocabOptions: options })).toBe('Rubric');
    expect(resolveSemanticUserGuidance({ kind: 'vocabOption', optionId: '1' }, { vocabOptions: options })).toBe('Guide');
  });

  it('returns empty when vocab option is not selected', () => {
    expect(resolveSemanticRubricText({ kind: 'vocabOption', optionId: null }, { vocabOptions: [] })).toBe('');
  });

  it('resolves culture key rubric', () => {
    const cultureText = (key: string) => (key === 'pkg.note.rubric' ? '  Must be polite  ' : undefined);
    expect(
      resolveSemanticRubricText({ kind: 'cultureKey', key: 'pkg.note.rubric' }, { cultureText }),
    ).toBe('Must be polite');
  });
});
