import { describe, expect, it } from 'vitest';
import {
  extractEmbeddedDataImageUrls,
  resolveChatMessageDisplayContent,
} from '../agentMessageAttachments';

describe('reported user-bubble image markdown', () => {
  const realisticBase64 = `iVBORw0KGgoAAAANSUhEUgAAApUAAAHFCAYAAACjNwLN${'AbC0/9+z'.repeat(2000)}==`;
  const content = `![image.png](data:image/png;base64,${realisticBase64})`;

  it('strips the reported markdown to empty display content', () => {
    expect(resolveChatMessageDisplayContent(content)).toBe('');
  });

  it('extracts the data url as an image', () => {
    const urls = extractEmbeddedDataImageUrls(content);
    expect(urls.length).toBe(1);
    expect(urls[0].startsWith('data:image/png;base64,')).toBe(true);
  });

  it('handles content with leading user text then image', () => {
    const withText = `This image\n\n${content}`;
    expect(resolveChatMessageDisplayContent(withText)).toBe('This image');
  });
});
