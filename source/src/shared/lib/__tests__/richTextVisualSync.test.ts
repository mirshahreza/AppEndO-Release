import { describe, expect, it } from 'vitest';
import {
  isVisuallyEmptyRichTextHtml,
  shouldPreserveExternalHtmlOnVisualUpdate,
} from '../richTextVisualSync';

describe('richTextVisualSync', () => {
  it('preserves lucide markup when visual document is empty', () => {
    expect(shouldPreserveExternalHtmlOnVisualUpdate(
      '<i data-lucide="User"></i>',
      '<p></p>',
    )).toBe(true);
  });

  it('allows clearing real paragraph content in visual mode', () => {
    expect(shouldPreserveExternalHtmlOnVisualUpdate(
      '<p>Hello</p>',
      '<p></p>',
    )).toBe(false);
  });

  it('detects empty tiptap html', () => {
    expect(isVisuallyEmptyRichTextHtml('<p></p>')).toBe(true);
    expect(isVisuallyEmptyRichTextHtml('<p><em></em></p>')).toBe(true);
    expect(isVisuallyEmptyRichTextHtml('<p>Hi</p>')).toBe(false);
  });
});
