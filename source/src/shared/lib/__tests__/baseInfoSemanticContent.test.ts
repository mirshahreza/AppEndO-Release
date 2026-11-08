import { describe, expect, it } from 'vitest';
import { mergeBaseInfoSemanticContent, parseBaseInfoSemanticContent } from '../baseInfoSemanticContent';

describe('parseBaseInfoSemanticContent', () => {
  it('reads metadata fields when present', () => {
    expect(parseBaseInfoSemanticContent('note ignored', JSON.stringify({
      userGuidance: 'Show two reasons',
      semanticRubric: 'Must mention role and date',
    }))).toEqual({
      userGuidance: 'Show two reasons',
      semanticRubric: 'Must mention role and date',
    });
  });

  it('falls back to legacy note delimiter', () => {
    expect(parseBaseInfoSemanticContent('Banner:::Rubric line', null)).toEqual({
      userGuidance: 'Banner',
      semanticRubric: 'Rubric line',
    });
  });
});

describe('mergeBaseInfoSemanticContent', () => {
  it('writes guidance and rubric into metadata JSON', () => {
    const merged = mergeBaseInfoSemanticContent('{}', {
      userGuidance: 'Help text',
      semanticRubric: 'Check criteria',
    });
    expect(merged.note).toBe('Help text');
    const meta = JSON.parse(merged.metadata) as { userGuidance?: string; semanticRubric?: string };
    expect(meta.userGuidance).toBe('Help text');
    expect(meta.semanticRubric).toBe('Check criteria');
  });
});
