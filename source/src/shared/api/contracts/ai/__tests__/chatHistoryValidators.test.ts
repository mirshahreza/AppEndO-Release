import { describe, expect, it } from 'vitest';
import { normalizeStoredMessages } from '../chatHistoryValidators';

describe('chatHistoryValidators', () => {
  it('sanitizes enriched user message content while keeping attachments', () => {
    const previewUrl = 'data:image/png;base64,abc123';
    const messages = normalizeStoredMessages([{
      role: 'user',
      content: `hello\n\n![photo.png](${previewUrl})`,
      attachments: [{
        id: 'att-1',
        name: 'photo.png',
        mimeType: 'image/png',
        kind: 'image',
        previewUrl,
        size: 6,
      }],
    }]);

    expect(messages).toEqual([{
      role: 'user',
      content: 'hello',
      attachments: [{
        id: 'att-1',
        name: 'photo.png',
        mimeType: 'image/png',
        kind: 'image',
        previewUrl,
        size: 6,
      }],
    }]);
  });

  it('does not sanitize assistant generated image content', () => {
    const previewUrl = 'data:image/png;base64,abc123';
    const content = `generated\n\n![image](${previewUrl})`;

    expect(normalizeStoredMessages([{ role: 'assistant', content }])[0]?.content).toBe(content);
  });

  it('preserves assistant token usage on stored messages', () => {
    const messages = normalizeStoredMessages([
      { role: 'user', content: 'Hi' },
      {
        role: 'assistant',
        content: 'Hello',
        tokenUsage: { inputTokens: 12, outputTokens: 8 },
      },
    ]);

    expect(messages[1]?.tokenUsage).toEqual({ inputTokens: 12, outputTokens: 8 });
  });
});
