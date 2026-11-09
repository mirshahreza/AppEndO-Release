/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { ToolbarFilterSelect } from '../ToolbarFilterSelect';
import { ToolbarSearchInput } from '../ToolbarSearchInput';

vi.mock('../../../core/culture/CultureContext', () => ({
  useCultureT: () => (key: string) => key,
  useOptionalCulture: () => ({ direction: 'ltr' as const }),
  useOptionalCultureT: () => (key: string) => key,
}));

const sharedChromeTokens = [
  '!h-8',
  '!min-h-8',
  '!max-h-8',
  '!rounded-[6px]',
];

describe('toolbar field chrome parity', () => {
  it('renders ToolbarSearchInput and ToolbarFilterSelect with matching height and radius', () => {
    const { container: searchContainer } = render(
      <ToolbarSearchInput value="draft" onChange={() => {}} ariaLabel="Search" />,
    );
    const { container: selectContainer } = render(
      <ToolbarFilterSelect
        value=""
        ariaLabel="Status"
        options={[{ value: 'draft', label: 'Draft' }]}
        onChange={() => {}}
      />,
    );

    const searchShell = searchContainer.querySelector('.flex.w-full.items-stretch.overflow-hidden');
    const searchInput = searchContainer.querySelector('[data-slot="input"]');
    const selectTrigger = selectContainer.querySelector('[data-slot="select-trigger"]');

    sharedChromeTokens.forEach((token) => {
      expect(searchShell?.className ?? searchInput?.className).toContain(token);
      expect(selectTrigger?.className).toContain(token);
    });
  });

  it('does not overlay the placeholder with an absolute search icon', () => {
    const { container } = render(
      <ToolbarSearchInput value="" onChange={() => {}} placeholder="Search contents…" ariaLabel="Search" />,
    );

    expect(container.querySelector('svg.lucide-search')).toBeNull();
    expect(container.querySelector('.pointer-events-none.absolute')).toBeNull();
  });
});
