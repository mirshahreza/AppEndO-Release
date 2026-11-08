// @vitest-environment jsdom
import React from 'react';

vi.mock('../../../../core/culture/CultureContext', () => ({
  useCultureT: () => (key: string) => key,
}));
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SemanticAssistTextarea } from '../SemanticAssistTextarea';

vi.mock('../useEuaCapability', () => ({
  useIsEuaCapabilityEnabled: () => true,
  useEuaDefaultModelId: () => 'gpt-test',
  useEuaFieldAssistReady: () => false,
  useEuaStatusSnapshot: () => ({ capabilities: {} }),
}));

vi.mock('../euaStatusCache', () => ({
  ensureEuaStatusLoaded: vi.fn(),
}));

vi.mock('../useAiFieldAutocomplete', () => ({
  useAiFieldAutocomplete: () => ({
    completion: '',
    handleInputChange: vi.fn(),
    requestSuggestion: vi.fn(),
    dismiss: vi.fn(),
    acceptCompletion: vi.fn(() => null),
  }),
}));

vi.mock('../../../lib/useCanEditVocabContext', () => ({
  useCanEditVocabContext: () => false,
}));

vi.mock('../useSemanticFieldValidation', () => ({
  useSemanticFieldValidation: () => ({
    validating: false,
    valid: null,
    reasons: [],
    validateNow: vi.fn(async () => true),
    resetValidation: vi.fn(),
  }),
}));

describe('SemanticAssistTextarea', () => {
  it('renders guidance banner and textarea', () => {
    render(
      <SemanticAssistTextarea
        value="Hello"
        onChange={() => {}}
        userGuidance="Include two reasons."
        semanticValidation={{
          rubric: { kind: 'static', text: 'Must be detailed' },
        }}
        ariaLabel="Note"
      />,
    );

    expect(screen.getByText('Include two reasons.')).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'Note' })).toBeTruthy();
  });
});
