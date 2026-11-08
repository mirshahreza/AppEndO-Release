/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TrustedHtmlVisualPane } from '../TrustedHtmlVisualPane';

describe('TrustedHtmlVisualPane', () => {
  it('renders lucide icon preview for uiHtml snippet', () => {
    const { container } = render(
      <TrustedHtmlVisualPane html={'<i data-lucide="User"></i>'} />,
    );
    expect(container.querySelector('svg')).toBeTruthy();
    expect(screen.getByText('<i data-lucide="User"></i>')).toBeTruthy();
  });

  it('shows empty placeholder when html is blank', () => {
    render(<TrustedHtmlVisualPane html="" />);
    expect(screen.getByText('Nothing to preview yet')).toBeTruthy();
  });
});
