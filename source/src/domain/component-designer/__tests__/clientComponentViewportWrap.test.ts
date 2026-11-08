import { describe, expect, it } from 'vitest';
import { wrapNodeJsxWithClientComponent } from '../tsxLogicRenderer';
import type { DesignerNode } from '../types';

const node = (props: Record<string, unknown>): DesignerNode => ({
  id: 'n1',
  type: 'container',
  parentId: null,
  order: 0,
  props,
  children: [],
  layout: { visible: true },
  binding: {},
});

describe('wrapNodeJsxWithClientComponent', () => {
  it('does not wrap adaptive components', () => {
    const jsx = '<div>Body</div>';
    expect(wrapNodeJsxWithClientComponent(node({}), jsx, 0)).toBe(jsx);
    expect(wrapNodeJsxWithClientComponent(node({ minViewport: 'desktop', belowMin: 'continue' }), jsx, 0)).toBe(jsx);
  });

  it('wraps hide and placeholder policies with UiClientComponent', () => {
    const jsx = '<div>Body</div>';
    expect(wrapNodeJsxWithClientComponent(node({ minViewport: 'desktop', belowMin: 'placeholder' }), jsx, 0))
      .toContain('<UiClientComponent minViewport="desktop" belowMin="placeholder">');
    expect(wrapNodeJsxWithClientComponent(node({ minViewport: 'tablet', belowMin: 'hide' }), jsx, 0))
      .toContain('belowMin="hide"');
  });
});
