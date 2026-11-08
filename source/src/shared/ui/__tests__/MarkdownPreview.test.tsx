/** @vitest-environment jsdom */
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MarkdownPreview } from '../MarkdownPreview';
import { markdownDirComment } from '../designerRichTextMarkdownDir';

describe('MarkdownPreview', () => {
  it('applies per-block dir from markdown comments under a document LTR shell', () => {
    const content = [
      '## Purpose',
      '',
      'Describe what this model represents.',
      '',
      `${markdownDirComment('rtl')}`,
      'این متن باید راست باشه',
    ].join('\n');

    const { container } = render(
      <MarkdownPreview content={content} dir="ltr" />,
    );

    const paragraphs = container.querySelectorAll('p');
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0].getAttribute('dir')).toBeNull();
    expect(paragraphs[0].textContent).toContain('Describe what this model represents.');
    expect(paragraphs[1].getAttribute('dir')).toBe('rtl');
    expect(paragraphs[1].textContent).toBe('این متن باید راست باشه');
  });

  it('does not surface dir comment markers as visible text', () => {
    const content = `${markdownDirComment('rtl')}\nسلام`;
    const { container } = render(<MarkdownPreview content={content} />);
    expect(container.textContent).not.toContain('@dir');
    expect(container.textContent).not.toContain('<!--');
    expect(container.querySelector('p')?.getAttribute('dir')).toBe('rtl');
  });

  it('sets document dir from the first meaningful character when dir is auto', () => {
    const { container } = render(
      <MarkdownPreview content="سلام دنیا" dir="auto" />,
    );
    expect(container.querySelector('[dir="rtl"]')).toBeTruthy();
  });
});
