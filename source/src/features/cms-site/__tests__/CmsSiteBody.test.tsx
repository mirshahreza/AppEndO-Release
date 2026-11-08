// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { CmsSiteBody } from '../components/CmsSiteBody';

describe('CmsSiteBody HTML sanitization', () => {
  it('strips script tags from stored HTML before render', () => {
    const { container } = render(
      <CmsSiteBody content={{ body: '<p>Hello</p><script>alert(1)</script>', bodyFormat: 'html' }} />,
    );
    const html = container.innerHTML;
    expect(html).toContain('Hello');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('alert(1)');
  });

  it('strips inline event handlers from stored HTML', () => {
    const { container } = render(
      <CmsSiteBody content={{ body: '<img src="x" onerror="alert(1)" />', bodyFormat: 'html' }} />,
    );
    const html = container.innerHTML;
    expect(html).not.toContain('onerror');
    expect(html).not.toContain('alert(1)');
  });
});
