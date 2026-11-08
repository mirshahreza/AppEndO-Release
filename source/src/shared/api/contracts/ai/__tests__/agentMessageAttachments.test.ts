import { describe, expect, it } from 'vitest';
import {
  enrichAgentMessageContent,
  extractEmbeddedDataImageUrls,
  extractUserTextBeforeAttachmentPayload,
  resolveChatMessageDisplayContent,
  sanitizeUserMessageForUi,
  stripEmbeddedAttachmentMarkdown,
} from '../agentMessageAttachments';

describe('agentMessageAttachments', () => {
  it('strips large embedded image markdown without regex on the full payload', () => {
    const base64 = 'A'.repeat(120_000);
    const previewUrl = `data:image/png;base64,${base64}`;
    const enriched = enrichAgentMessageContent('', [{
      id: '1',
      name: 'photo.png',
      mimeType: 'image/png',
      kind: 'image',
      previewUrl,
      size: base64.length,
    }]);

    expect(stripEmbeddedAttachmentMarkdown(enriched)).toBe('');
    expect(resolveChatMessageDisplayContent(enriched, [{
      id: '1',
      name: 'photo.png',
      mimeType: 'image/png',
      kind: 'image',
      previewUrl,
      size: base64.length,
    }])).toBe('');
  });

  it('keeps user text while stripping image enrichment', () => {
    const previewUrl = 'data:image/png;base64,abc';
    const enriched = enrichAgentMessageContent('hello world', [{
      id: '1',
      name: 'photo.png',
      mimeType: 'image/png',
      kind: 'image',
      previewUrl,
      size: 3,
    }]);

    expect(resolveChatMessageDisplayContent(enriched, [{
      id: '1',
      name: 'photo.png',
      mimeType: 'image/png',
      kind: 'image',
      previewUrl,
      size: 3,
    }])).toBe('hello world');
  });

  it('strips raw data image urls from display content', () => {
    const content = `data:image/png;base64,${'A'.repeat(120_000)}`;

    expect(resolveChatMessageDisplayContent(content)).toBe('');
  });

  it('strips incomplete image markdown from display content', () => {
    const content = `![photo.png](data:image/png;base64,${'A'.repeat(120_000)}`;

    expect(resolveChatMessageDisplayContent(content)).toBe('');
  });

  it('strips and extracts wrapped base64 image payloads', () => {
    const wrappedPayload = `${'A'.repeat(76)}\n${'B'.repeat(76)}\n${'C'.repeat(76)}`;
    const content = `![photo.png](data:image/png;base64,${wrappedPayload})`;

    expect(resolveChatMessageDisplayContent(content)).toBe('');
    expect(extractEmbeddedDataImageUrls(content)).toEqual([
      `data:image/png;base64,${'A'.repeat(76)}${'B'.repeat(76)}${'C'.repeat(76)}`,
    ]);
  });

  it('does not strip ordinary text after a short data image url', () => {
    const content = 'data:image/png;base64,abc\nhello world';

    expect(resolveChatMessageDisplayContent(content)).toBe('hello world');
  });

  it('fast-path sanitizes polluted user content when image attachments exist', () => {
    const base64 = 'A'.repeat(120_000);
    const previewUrl = `data:image/png;base64,${base64}`;
    const enriched = enrichAgentMessageContent('note', [{
      id: '1',
      name: 'photo.png',
      mimeType: 'image/png',
      kind: 'image',
      previewUrl,
      size: base64.length,
    }]);

    expect(extractUserTextBeforeAttachmentPayload(enriched)).toBe('note');
    expect(sanitizeUserMessageForUi({
      role: 'user',
      content: enriched,
      attachments: [{
        id: '1',
        name: 'photo.png',
        mimeType: 'image/png',
        kind: 'image',
        previewUrl,
        size: base64.length,
      }],
    })).toEqual({
      role: 'user',
      content: 'note',
      attachments: [{
        id: '1',
        name: 'photo.png',
        mimeType: 'image/png',
        kind: 'image',
        previewUrl,
        size: base64.length,
      }],
    });
  });
});
