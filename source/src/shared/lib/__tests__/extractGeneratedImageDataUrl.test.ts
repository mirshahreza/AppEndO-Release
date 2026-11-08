import { describe, expect, it } from 'vitest';
import {
  extractGeneratedImageDataUrl,
  resolveGeneratedImageDataUrl,
  stripGeneratedImageMarkdown,
} from '../extractGeneratedImageDataUrl';

describe('extractGeneratedImageDataUrl', () => {
  it('extracts data URL from generated image markdown', () => {
    const content = 'Generated image:\n\n![edited image](data:image/png;base64,abc123)';
    expect(extractGeneratedImageDataUrl(content)).toBe('data:image/png;base64,abc123');
  });

  it('returns null when no image markdown is present', () => {
    expect(extractGeneratedImageDataUrl('Plain assistant reply.')).toBeNull();
  });

  it('strips generated image markdown from content', () => {
    const content = 'Done.\n\n![edited image](data:image/png;base64,abc123)';
    expect(stripGeneratedImageMarkdown(content)).toBe('Done.');
  });

  it('fetches remote generated image URLs', async () => {
    const content = '![generated image](https://example.com/image.png)';
    const dataUrl = await resolveGeneratedImageDataUrl(content, async () => Buffer.from('png-bytes'));
    expect(dataUrl).toBe(`data:image/png;base64,${Buffer.from('png-bytes').toString('base64')}`);
  });
});
