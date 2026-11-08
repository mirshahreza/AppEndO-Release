import { describe, expect, it } from 'vitest';
import { resolveAiAssistGate } from '../resolveAiAssistGate';

describe('resolveAiAssistGate', () => {
  const base = {
    aiAssist: true,
    isControlDisabled: false,
    actionsEnabled: true,
    contextMenuDisabled: false,
    autocompleteDisabled: false,
  };

  it('enables autocomplete only when an active model is ready', () => {
    expect(resolveAiAssistGate(base).shouldAutocomplete).toBe(true);
    expect(resolveAiAssistGate({ ...base, actionsEnabled: false }).shouldAutocomplete).toBe(false);
  });

  it('keeps autocomplete off when the capability is disabled', () => {
    expect(resolveAiAssistGate({ ...base, autocompleteDisabled: true }).shouldAutocomplete).toBe(false);
  });

  it('keeps autocomplete off on disabled or opted-out controls', () => {
    expect(resolveAiAssistGate({ ...base, isControlDisabled: true }).shouldAutocomplete).toBe(false);
    expect(resolveAiAssistGate({ ...base, aiAssist: false }).shouldAutocomplete).toBe(false);
  });
});
