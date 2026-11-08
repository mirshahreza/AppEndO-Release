// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EUA_AUTOCOMPLETE_DEBOUNCE_MS } from '../buildAutocompletePrompt';
import { useAiFieldAutocomplete } from '../useAiFieldAutocomplete';

const autocompleteFieldText = vi.fn();

vi.mock('../../../api/queries/euaFieldAssist', () => ({
  autocompleteFieldText: (...args: unknown[]) => autocompleteFieldText(...args),
}));

describe('useAiFieldAutocomplete', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    autocompleteFieldText.mockReset();
    autocompleteFieldText.mockResolvedValue({ success: true, completion: ' world' });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('debounces autocomplete requests while typing', async () => {
    const text = 'Hel';
    const getText = () => text;
    const getCursorPosition = () => text.length;

    const { result } = renderHook(() => useAiFieldAutocomplete({
      enabled: true,
      getText,
      getCursorPosition,
    }));

    await act(async () => {
      result.current.handleInputChange();
      await vi.advanceTimersByTimeAsync(EUA_AUTOCOMPLETE_DEBOUNCE_MS);
    });

    expect(autocompleteFieldText).toHaveBeenCalledTimes(1);
  });

  it('accepts completion at end of text', async () => {
    const text = 'Hello';
    const { result } = renderHook(() => useAiFieldAutocomplete({
      enabled: true,
      getText: () => text,
      getCursorPosition: () => text.length,
    }));

    await act(async () => {
      result.current.requestSuggestion(true);
      await Promise.resolve();
    });

    expect(result.current.completion).toBe(' world');

    await act(async () => {
      const accepted = result.current.acceptCompletion();
      expect(accepted).toBe('Hello world');
    });
    expect(result.current.completion).toBe('');
  });

  it('skips autocomplete when cursor is not at end', async () => {
    const text = 'Hello world';
    const { result } = renderHook(() => useAiFieldAutocomplete({
      enabled: true,
      getText: () => text,
      getCursorPosition: () => 5,
    }));

    await act(async () => {
      result.current.requestSuggestion(true);
      await Promise.resolve();
    });

    expect(autocompleteFieldText).not.toHaveBeenCalled();
    expect(result.current.completion).toBe('');
  });
});
