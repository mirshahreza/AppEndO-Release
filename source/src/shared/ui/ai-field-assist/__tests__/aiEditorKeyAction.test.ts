import { describe, expect, it } from 'vitest';
import { resolveAiEditorKeyAction } from '../aiEditorKeyAction';

const tab = { key: 'Tab', code: 'Tab', shiftKey: false, ctrlKey: false, metaKey: false };
const escape = { key: 'Escape', code: 'Escape', shiftKey: false, ctrlKey: false, metaKey: false };
const ctrlSpace = { key: ' ', code: 'Space', shiftKey: false, ctrlKey: true, metaKey: false };

describe('resolveAiEditorKeyAction', () => {
  it('accepts Tab and dismisses Escape while a completion is showing', () => {
    const state = { shouldAutocomplete: true, hasCompletion: true };
    expect(resolveAiEditorKeyAction(tab, state)).toBe('accept-completion');
    expect(resolveAiEditorKeyAction(escape, state)).toBe('dismiss-completion');
    expect(resolveAiEditorKeyAction(ctrlSpace, state)).toBe('request-suggestion');
  });

  it('does not steal Tab when autocomplete is off or no ghost is showing', () => {
    expect(resolveAiEditorKeyAction(tab, { shouldAutocomplete: true, hasCompletion: false })).toBeNull();
    expect(resolveAiEditorKeyAction(tab, { shouldAutocomplete: false, hasCompletion: true })).toBeNull();
  });
});
