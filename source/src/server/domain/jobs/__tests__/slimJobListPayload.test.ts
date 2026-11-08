import { describe, expect, it } from 'vitest';
import { slimJobListPayloadJson } from '../jobRepository';

describe('slimJobListPayloadJson', () => {
  it('keeps function identity and drops userPayload blobs', () => {
    const raw = JSON.stringify({
      functionId: 'custom.hello',
      title: 'Hello',
      userPayload: { body: 'x'.repeat(5000) },
      metadata: { source: 'manual' },
    });
    const slim = JSON.parse(slimJobListPayloadJson(raw) ?? '{}') as Record<string, unknown>;
    expect(slim).toEqual({
      functionId: 'custom.hello',
      title: 'Hello',
      metadata: { source: 'manual' },
    });
  });

  it('drops agent chat messages while keeping taskId and title', () => {
    const raw = JSON.stringify({
      taskId: 'task-1',
      title: 'Implement export',
      messages: [{ role: 'user', content: 'very large transcript' }],
    });
    const slim = JSON.parse(slimJobListPayloadJson(raw) ?? '{}') as Record<string, unknown>;
    expect(slim).toEqual({ taskId: 'task-1', title: 'Implement export' });
  });
});
