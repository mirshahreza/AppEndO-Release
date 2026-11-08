import { afterEach, describe, expect, it, vi } from 'vitest';

import { sendPushNotification } from '../sendPushNotification';

describe('sendPushNotification', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('skips empty title and body', async () => {
    const result = await sendPushNotification({ toOrTopics: '0770', title: '', body: '' });
    expect(result.responseStatus).toBe('skipped');
    expect(result.delivered).toBe(false);
  });

  it('logs when push gateway is disabled', async () => {
    vi.stubEnv('PUSH_ENABLED', '0');
    vi.stubEnv('MESSAGING_FIREBASE_CREDENTIALS_PATH', '');
    const result = await sendPushNotification({
      toOrTopics: '07701234567',
      title: 'Hi',
      body: 'Body',
    });
    expect(result.mode).toBe('log');
    expect(result.delivered).toBe(false);
  });
});
