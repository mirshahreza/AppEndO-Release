// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { markdownToSafeHtml } from '../components/CmsSiteBody';
import { SiteScreenshotGallery } from '../components/SiteScreenshotGallery';

vi.mock('../../../shared/ui/ChatImageLightbox', () => ({
  ChatImageLightbox: ({
    images,
    onClose,
  }: {
    images: Array<{ src: string; alt: string }>;
    onClose: () => void;
  }) => (
    <div role="dialog" aria-label="Image">
      <img src={images[0]?.src} alt={images[0]?.alt} />
      <button type="button" onClick={onClose}>Close</button>
    </div>
  ),
}));

describe('markdownToSafeHtml', () => {
  it('turns relative markdown links into anchors and keeps ordered lists', () => {
    const html = markdownToSafeHtml(
      'See [Studio map](/us/studio-map) next.\n\n1. First\n2. Second',
    );
    expect(html).toContain('href="/us/studio-map"');
    expect(html).toContain('Studio map');
    expect(html).toContain('<ol>');
    expect(html).toContain('<li>First</li>');
  });

  it('drops javascript urls in markdown links', () => {
    const html = markdownToSafeHtml('[x](javascript:alert(1))');
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('href=');
  });
});

describe('SiteScreenshotGallery', () => {
  it('opens a full-size viewer when a screenshot is clicked', () => {
    render(
      <SiteScreenshotGallery urls={['/api/cms-site/public/assets/5']} alt="Dashboard" />,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'View larger: Dashboard' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('dialog').querySelector('img')).toHaveAttribute(
      'src',
      '/api/cms-site/public/assets/5',
    );
  });
});
