import { describe, expect, it } from 'vitest';
import { buildInboxPresetMetadata, parseInboxPresetMetadata } from '../inboxPresetMetadata';

describe('inboxPresetMetadata', () => {
  it('parses inbox block metadata', () => {
    const raw = JSON.stringify({
      inbox: {
        defaultBody: 'Hello',
        tagIds: ['100.8.1', '100.8.2'],
      },
    });
    expect(parseInboxPresetMetadata(raw)).toEqual({
      defaultBody: 'Hello',
      tagIds: ['100.8.1', '100.8.2'],
    });
  });

  it('round-trips through buildInboxPresetMetadata', () => {
    const raw = buildInboxPresetMetadata({
      defaultBody: 'Follow up tomorrow',
      tagIds: ['100.8.3'],
    });
    expect(parseInboxPresetMetadata(raw)).toEqual({
      defaultBody: 'Follow up tomorrow',
      tagIds: ['100.8.3'],
    });
  });
});
