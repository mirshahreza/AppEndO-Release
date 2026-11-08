/**
 * @vitest-environment jsdom
 */
import * as React from 'react';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { resolveUiAccordionExpandedKeys, UiAccordion } from '../UiAccordion';

describe('resolveUiAccordionExpandedKeys', () => {
  it('keeps one item open for persistent-one even when the current item is clicked closed', () => {
    expect(resolveUiAccordionExpandedKeys(new Set(), new Set(['shell']), 'persistent-one', false, 'shell')).toEqual(new Set(['shell']));
  });

  it('switches to the newly opened item in persistent-one', () => {
    expect(resolveUiAccordionExpandedKeys(new Set(['shell', 'bands']), new Set(['shell']), 'persistent-one', false, 'shell')).toEqual(new Set(['bands']));
  });

  it('allows an empty set in single collapsible mode', () => {
    expect(resolveUiAccordionExpandedKeys(new Set(), new Set(['shell']), 'single', true, 'shell')).toEqual(new Set());
  });
});

describe('UiAccordion fill layout', () => {
  afterEach(cleanup);

  const Harness: React.FC = () => {
    const [expandedKeys, setExpandedKeys] = React.useState(new Set(['shell']));
    return (
      <div style={{ height: 240 }}>
        <UiAccordion
          layout="fill"
          expansion="persistent-one"
          items={[
            { id: 'shell', heading: 'Shell', panel: <p>Shell fields</p> },
            { id: 'bands', heading: 'Bands', panel: <p>Band fields</p> },
          ]}
          expandedKeys={expandedKeys}
          onExpandedChange={setExpandedKeys}
        />
      </div>
    );
  };

  it('fills the host and scrolls inside the open panel while keeping one section expanded', () => {
    const { container } = render(<Harness />);

    const root = container.querySelector('[data-layout="fill"]');
    expect(root).toHaveAttribute('data-expansion', 'persistent-one');
    expect(screen.getByRole('button', { name: 'Shell' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Shell fields').parentElement).toHaveClass('overflow-y-auto');

    fireEvent.click(screen.getByRole('button', { name: 'Shell' }));
    expect(screen.getByRole('button', { name: 'Shell' })).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Bands' }));
    expect(screen.getByRole('button', { name: 'Bands' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Shell' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('Band fields')).toBeVisible();
  });
});

describe('UiAccordion chrome and item gap', () => {
  afterEach(cleanup);

  it('applies border-shadow chrome and named item gap on the root', () => {
    const { container } = render(
      <UiAccordion
        chrome="border-shadow"
        itemGap="md"
        items={[
          { id: 'shell', heading: 'Shell', panel: <p>Shell fields</p> },
          { id: 'bands', heading: 'Bands', panel: <p>Band fields</p> },
        ]}
        expandedKeys={new Set(['shell'])}
        onExpandedChange={() => {}}
      />,
    );

    const root = container.querySelector('[data-chrome="border-shadow"]');
    expect(root).toHaveAttribute('data-item-gap', 'md');
    expect(root).toHaveClass('gap-3');
    expect(container.querySelector('.border-slate-200')).toBeTruthy();
    expect(container.querySelector('.shadow-sm')).toBeTruthy();
  });

  it('tints only the expanded item header when openHeaderTone is set', () => {
    const { container } = render(
      <UiAccordion
        chrome="border-shadow"
        openHeaderTone="indigo"
        items={[
          { id: 'shell', heading: 'Shell', panel: <p>Shell fields</p> },
          { id: 'bands', heading: 'Bands', panel: <p>Band fields</p> },
        ]}
        expandedKeys={new Set(['shell'])}
        onExpandedChange={() => {}}
      />,
    );

    const root = container.querySelector('[data-open-header-tone="indigo"]');
    expect(root).toBeTruthy();
    const openTrigger = screen.getByRole('button', { name: 'Shell' });
    const closedTrigger = screen.getByRole('button', { name: 'Bands' });
    expect(openTrigger).toHaveClass('bg-indigo-50/70');
    expect(closedTrigger).not.toHaveClass('bg-indigo-50/70');
  });

  it('keeps panel padding on the inner content so collapsed items have no leftover strip', () => {
    const { container } = render(
      <UiAccordion
        chrome="border-shadow"
        items={[
          { id: 'shell', heading: 'Shell', panel: <p>Shell fields</p>, panelClassName: 'px-4 pb-3' },
          { id: 'bands', heading: 'Bands', panel: <p>Band fields</p>, panelClassName: 'px-4 pb-3' },
        ]}
        expandedKeys={new Set(['shell'])}
        onExpandedChange={() => {}}
      />,
    );

    const panels = [...container.querySelectorAll('[data-slot="accordion-panel"]')];
    expect(panels).toHaveLength(2);
    for (const panel of panels) {
      expect(panel).not.toHaveClass('pb-3');
      expect(panel.firstElementChild).toHaveClass('pb-3');
    }
  });
});
