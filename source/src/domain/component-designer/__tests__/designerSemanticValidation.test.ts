import { describe, expect, it } from 'vitest';
import {
  nodeHasSemanticValidation,
  renderDesignerSemanticValidationJsxAttrs,
  resolveDesignerSemanticValidationPolicy,
} from '../designerSemanticValidation';
import type { DesignerNode } from '../types';

const textareaNode = (props: Record<string, unknown>): DesignerNode => ({
  id: 'ta-1',
  type: 'component',
  props,
  children: [],
});

describe('designerSemanticValidation', () => {
  it('builds static rubric policy from inspector props', () => {
    const node = textareaNode({
      semanticRubricKind: 'static',
      semanticRubricStatic: 'Must mention impact',
    });
    expect(resolveDesignerSemanticValidationPolicy(node)).toEqual({
      rubric: { kind: 'static', text: 'Must mention impact' },
      triggers: ['blur', 'submit'],
    });
    expect(nodeHasSemanticValidation(node)).toBe(true);
  });

  it('builds culture key policy', () => {
    const node = textareaNode({
      semanticRubricKind: 'cultureKey',
      semanticRubricCultureKey: 'hwy.targhin.note.rubric',
    });
    expect(resolveDesignerSemanticValidationPolicy(node)?.rubric).toEqual({
      kind: 'cultureKey',
      key: 'hwy.targhin.note.rubric',
    });
  });

  it('emits semantic JSX attrs for export', () => {
    const node = textareaNode({
      semanticRubricKind: 'static',
      semanticRubricStatic: 'Rule',
      semanticUserGuidance: 'Help',
    });
    const attrs = renderDesignerSemanticValidationJsxAttrs(node);
    expect(attrs).toContain('semanticValidation=');
    expect(attrs).toContain('userGuidance=');
  });
});
