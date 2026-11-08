/**
 * @vitest-environment jsdom
 */
import * as React from 'react';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UiDisclosure } from '../UiDisclosure';

describe('UiDisclosure', () => {
  afterEach(cleanup);

  it('connects one trigger to one stable region', () => {
    const { rerender } = render(
      <UiDisclosure trigger="Deployment details">Region content</UiDisclosure>,
    );
    const trigger = screen.getByRole('button', { name: 'Deployment details' });
    const region = screen.getByRole('region', { hidden: true });
    const panelId = region.id;

    expect(trigger).toHaveAttribute('aria-controls', panelId);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(region).not.toBeVisible();

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(region).toBeVisible();

    rerender(<UiDisclosure trigger="Deployment details">Updated content</UiDisclosure>);
    expect(screen.getByRole('region').id).toBe(panelId);
  });

  it('supports controlled expansion without mutating local state', () => {
    const onExpandedChange = vi.fn();
    const { rerender } = render(
      <UiDisclosure
        trigger="Audit details"
        isExpanded={false}
        onExpandedChange={onExpandedChange}
      >
        Audit content
      </UiDisclosure>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Audit details' }));
    expect(onExpandedChange).toHaveBeenCalledWith(true);
    expect(screen.getByRole('region', { hidden: true })).not.toBeVisible();

    rerender(
      <UiDisclosure
        trigger="Audit details"
        isExpanded
        onExpandedChange={onExpandedChange}
      >
        Audit content
      </UiDisclosure>,
    );
    expect(screen.getByRole('region')).toBeVisible();
  });

  it('does not toggle while disabled', () => {
    const onExpandedChange = vi.fn();
    render(
      <UiDisclosure trigger="Locked details" isDisabled onExpandedChange={onExpandedChange}>
        Locked content
      </UiDisclosure>,
    );

    const trigger = screen.getByRole('button', { name: 'Locked details' });
    expect(trigger).toBeDisabled();
    fireEvent.click(trigger);
    expect(onExpandedChange).not.toHaveBeenCalled();
  });
});
