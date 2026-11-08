/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import {
  resolveHeroUiFieldInputClass,
  resolveHeroUiFieldTextareaClass,
  resolveHeroUiFieldSelectTriggerClass,
} from '../heroFieldChrome';
import { UiInput, UiSelect, UiTextareaCore } from '../HeroFieldControls';

const sharedChromeTokens = [
  '!h-8',
  '!min-h-8',
  '!max-h-8',
  '!rounded-[6px]',
  '!box-border',
  '!px-2',
  '!py-0',
  '!border',
  '!border-[#e2e8f0]',
];

describe('hero field chrome parity', () => {
  it('uses the same canonical chrome classes for input and select triggers', () => {
    const inputClass = resolveHeroUiFieldInputClass({ size: 'sm' });
    const selectClass = resolveHeroUiFieldSelectTriggerClass({ size: 'sm' });

    sharedChromeTokens.forEach((token) => {
      expect(inputClass).toContain(token);
      expect(selectClass).toContain(token);
    });
  });

  it('renders input and select triggers with matching height and radius classes', () => {
    const { container: inputContainer } = render(
      <UiInput size="sm" ariaLabel="Name" defaultValue="test" />,
    );
    const { container: selectContainer } = render(
      <UiSelect size="sm" ariaLabel="Env" value="prod">
        <option value="prod">Production</option>
      </UiSelect>,
    );

    const inputEl = inputContainer.querySelector('[data-slot="input"]');
    const selectTrigger = selectContainer.querySelector('[data-slot="select-trigger"]');

    sharedChromeTokens.forEach((token) => {
      expect(inputEl?.className).toContain(token);
      expect(selectTrigger?.className).toContain(token);
    });
  });

  it('keeps textarea multiline — no single-line height cap from input chrome', () => {
    const textareaClass = resolveHeroUiFieldTextareaClass({ size: 'sm' });
    const inputClass = resolveHeroUiFieldInputClass({ size: 'sm' });

    expect(textareaClass).toContain('resize-y');
    expect(textareaClass).toContain('!py-1.5');
    expect(textareaClass).not.toContain('!h-8');
    expect(textareaClass).not.toContain('!max-h-8');
    expect(inputClass).toContain('!h-8');
    expect(inputClass).toContain('!max-h-8');

    const { container } = render(
      <UiTextareaCore size="sm" ariaLabel="Notes" rows={3} defaultValue="Line one\nLine two\nLine three" />,
    );

    const textareaEl = container.querySelector('textarea');
    expect(textareaEl?.getAttribute('rows')).toBe('3');
    expect(textareaEl?.className).not.toContain('!max-h-8');
    expect(textareaEl?.className).not.toContain('!h-8');
    expect(textareaEl?.className).toContain('resize-y');
  });
});
