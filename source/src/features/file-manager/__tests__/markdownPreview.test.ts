import { describe, expect, it } from 'vitest';
import {
  isFileManagerMarkdownLanguage,
  renderFileManagerMarkdownHtml,
} from '../markdownPreview';

describe('file-manager markdownPreview', () => {
  it('detects markdown language', () => {
    expect(isFileManagerMarkdownLanguage('markdown')).toBe(true);
    expect(isFileManagerMarkdownLanguage('plaintext')).toBe(false);
  });

  it('renders headings and inline formatting', () => {
    const html = renderFileManagerMarkdownHtml('# Title\n\nHello **world**');
    expect(html).toContain('<h1>Title</h1>');
    expect(html).toContain('<strong>world</strong>');
  });

  it('sanitizes unsafe html', () => {
    const html = renderFileManagerMarkdownHtml('<script>alert(1)</script>');
    expect(html).not.toContain('<script');
  });
});
