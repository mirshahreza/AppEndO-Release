import { describe, expect, it } from 'vitest';
import {
  DEFAULT_COLUMN_FORM_WIDGET_ROWS,
  applyColumnFormWidgetPropDefaults,
  pruneColumnFormWidgetProps,
} from '../columnFormWidgetProps';

describe('applyColumnFormWidgetPropDefaults', () => {
  it('defaults rows to 3 for multiline-style widgets when unset', () => {
    for (const widget of ['multiline', 'html', 'code', 'markdown', 'json'] as const) {
      expect(applyColumnFormWidgetPropDefaults(widget, {})).toEqual({
        rows: DEFAULT_COLUMN_FORM_WIDGET_ROWS,
      });
    }
  });

  it('keeps an explicit rows value', () => {
    expect(applyColumnFormWidgetPropDefaults('code', { rows: 8, language: 'sql' })).toEqual({
      language: 'sql',
      rows: 8,
    });
  });

  it('does not add rows for single-line widgets', () => {
    expect(applyColumnFormWidgetPropDefaults('text', { maxLength: 40 })).toEqual({
      maxLength: 40,
    });
    expect(applyColumnFormWidgetPropDefaults('', { placeholder: 'x' })).toEqual({
      placeholder: 'x',
    });
  });

  it('drops rows when switching away from a multiline widget', () => {
    const pruned = pruneColumnFormWidgetProps('text', { rows: 3, maxLength: 10 });
    expect(pruned).toEqual({ maxLength: 10 });
    expect(applyColumnFormWidgetPropDefaults('text', { rows: 3, maxLength: 10 })).toEqual({
      maxLength: 10,
    });
  });
});
