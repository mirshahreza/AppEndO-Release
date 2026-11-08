import { describe, expect, it } from 'vitest';
import { normalizeAskMessagesForModel } from '../ai.service';

describe('normalizeAskMessagesForModel', () => {
  it('enriches attachments only at the model boundary', () => {
    const previewUrl = 'data:image/png;base64,abc123';
    const uiMessage = {
      role: 'user',
      content: 'describe this',
      attachments: [{
        id: 'att-1',
        name: 'photo.png',
        mimeType: 'image/png',
        kind: 'image',
        previewUrl,
        size: 6,
      }],
    };

    const modelMessages = normalizeAskMessagesForModel([uiMessage]);

    expect(uiMessage.content).toBe('describe this');
    expect(modelMessages).toEqual([{
      role: 'user',
      content: `describe this\n\n![photo.png](${previewUrl})`,
    }]);
  });

  it('rejects tool messages in ask chat payloads', () => {
    expect(() => normalizeAskMessagesForModel([{
      role: 'tool',
      content: 'not allowed',
      toolCallId: 'call-1',
    }])).toThrow(/invalid role "tool"/i);
  });
});
