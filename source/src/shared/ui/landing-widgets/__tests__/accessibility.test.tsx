/**
 * @vitest-environment jsdom
 */
import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  LANDING_WIDGET_FIXTURES,
  LandingAnnouncement,
  LandingFaq,
  LandingNewsletter,
  LandingWidgetRenderer,
} from '..';

describe('landing widget accessibility', () => {
  it('uses semantic headings, lists, landmarks, and tables', () => {
    const { container } = render(
      <>
        <LandingWidgetRenderer config={LANDING_WIDGET_FIXTURES['landing-feature-grid']} />
        <LandingWidgetRenderer config={LANDING_WIDGET_FIXTURES['landing-process-steps']} />
        <LandingWidgetRenderer config={LANDING_WIDGET_FIXTURES['landing-comparison']} />
      </>,
    );
    expect(container.querySelectorAll('section').length).toBeGreaterThanOrEqual(3);
    expect(screen.getByRole('heading', { name: 'Everything needed for controlled delivery' })).toBeTruthy();
    expect(container.querySelector('ol')).toBeTruthy();
    expect(screen.getByRole('table', { name: 'Choose the right operating model' })).toBeTruthy();
  });

  it('exposes operable disclosure and dismiss controls', () => {
    const dismiss = vi.fn();
    render(
      <>
        <LandingAnnouncement message="Release available." dismissLabel="Dismiss announcement" onDismiss={dismiss} />
        <LandingFaq {...LANDING_WIDGET_FIXTURES['landing-faq'].props} />
      </>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss announcement' }));
    expect(dismiss).toHaveBeenCalledOnce();
    const question = screen.getByRole('button', { name: 'Can assets be hosted remotely?' });
    expect(question.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(question);
    expect(question.getAttribute('aria-expanded')).toBe('true');
    question.focus();
    fireEvent.keyDown(question, { key: 'Enter' });
    fireEvent.click(question);
    expect(document.activeElement).toBe(question);
    expect(question.className).toContain('[@media(pointer:coarse)]:min-h-11');
  });

  it('requires consent before submitting a registered newsletter action', () => {
    const submit = vi.fn();
    render(<LandingNewsletter {...LANDING_WIDGET_FIXTURES['landing-newsletter'].props} onSubmit={submit} />);
    const button = screen.getByRole('button', { name: 'Subscribe' });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByRole('textbox', { name: 'Email address' }), { target: { value: 'reader@example.com' } });
    fireEvent.click(screen.getByRole('checkbox'));
    expect((button as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(button);
    expect(submit).toHaveBeenCalledWith('reader@example.com');
  });

  it('uses logical RTL layout and explicit readable text on dark treatments', () => {
    const { container } = render(
      <div dir="rtl">
        <LandingWidgetRenderer config={LANDING_WIDGET_FIXTURES['landing-timeline']} />
        <LandingWidgetRenderer config={LANDING_WIDGET_FIXTURES['landing-newsletter']} />
        <LandingWidgetRenderer config={LANDING_WIDGET_FIXTURES['landing-cta-band']} />
      </div>,
    );
    expect(container.querySelector('[dir="rtl"] .border-s-2')).toBeTruthy();
    const darkHeadings = Array.from(container.querySelectorAll('.bg-indigo-950 h2, .bg-slate-950 h2'));
    expect(darkHeadings).toHaveLength(2);
    expect(darkHeadings.every((heading) => heading.classList.contains('text-white'))).toBe(true);
    expect(
      Array.from(container.querySelectorAll('button')).every((button) =>
        button.className.includes('[@media(pointer:coarse)]:min-h-11')),
    ).toBe(true);
  });
});
