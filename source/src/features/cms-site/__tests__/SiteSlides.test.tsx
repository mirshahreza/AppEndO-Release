// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { SiteSlides } from '../components/SiteSlides';

describe('SiteSlides', () => {
  it('shows one flagship screenshot at a time behind a tab switcher', () => {
    const { container } = render(
      <SiteSlides
        slides={[
          { index: '01', title: 'Quiet tools', copy: 'First', imageUrl: '/a.jpg' },
          { index: '02', title: 'Loud results', copy: 'Second', imageUrl: '/b.jpg' },
        ]}
      />,
    );

    expect(screen.getByLabelText('Featured slides')).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(2);
    expect(container.querySelectorAll('.site-window-zoom img')).toHaveLength(1);
    expect(container.querySelector('.site-window-zoom img')).toHaveAttribute('src', '/a.jpg');

    fireEvent.click(screen.getByRole('tab', { name: '02' }));

    expect(container.querySelectorAll('.site-window-zoom img')).toHaveLength(1);
    expect(container.querySelector('.site-window-zoom img')).toHaveAttribute('src', '/b.jpg');
  });

  it('renders a placeholder window when the flagship shot has no image yet', () => {
    const { container } = render(
      <SiteSlides
        slides={[{ index: '01', title: 'Quiet tools', copy: 'First', imageUrl: null }]}
      />,
    );

    expect(container.querySelector('.site-window-placeholder')).toBeTruthy();
    expect(container.querySelector('.site-window-body img')).toBeNull();
  });
});
