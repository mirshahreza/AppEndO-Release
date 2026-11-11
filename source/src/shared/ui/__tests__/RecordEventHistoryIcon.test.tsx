/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { recordEventHistoryFieldChromeToggle } from '../RecordEventHistoryIcon';

vi.mock('../../../core/culture/CultureContext', () => ({
  useCultureT: () => (key: string, fallback?: string) => fallback ?? key,
  useOptionalCulture: () => null,
  useOptionalCultureT: () => undefined,
}));

describe('recordEventHistoryFieldChromeToggle', () => {
  it('opens history for the sole tracked field instead of toggling field chrome', () => {
    const openHistory = vi.fn();
    const toggleFieldIcons = vi.fn();

    render(<>{recordEventHistoryFieldChromeToggle({
      available: true,
      fieldIconsVisible: false,
      toggleFieldIcons,
      openHistory,
      soleTrackedField: 'roles',
    })}</>);

    fireEvent.click(screen.getByRole('button', { name: 'Record timeline' }));

    expect(openHistory).toHaveBeenCalledWith('roles');
    expect(toggleFieldIcons).not.toHaveBeenCalled();
  });

  it('toggles field chrome when multiple history targets exist', () => {
    const openHistory = vi.fn();
    const toggleFieldIcons = vi.fn();

    render(<>{recordEventHistoryFieldChromeToggle({
      available: true,
      fieldIconsVisible: false,
      toggleFieldIcons,
      openHistory,
      soleTrackedField: null,
    })}</>);

    fireEvent.click(screen.getByRole('button', { name: 'Show field timeline' }));

    expect(toggleFieldIcons).toHaveBeenCalled();
    expect(openHistory).not.toHaveBeenCalled();
  });
});
