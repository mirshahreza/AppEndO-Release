import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildSmsGatewayRequestUrl, sendSms } from '../sendSms';
import { resolveSmsGatewayPort } from '../smsPort';

describe('sendSms', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('resolveSmsGatewayPort matches legacy prefix rules', () => {
    expect(resolveSmsGatewayPort('07501234567')).toBe('4');
    expect(resolveSmsGatewayPort('07701234567')).toBe('1');
    expect(resolveSmsGatewayPort('')).toBeNull();
  });

  it('buildSmsGatewayRequestUrl encodes message content', () => {
    const url = buildSmsGatewayRequestUrl('http://gw?x=1', '1', '0770', 'hello world');
    expect(url).toContain('content=hello%20world');
    expect(url).toContain('destination=0770');
  });

  it('logs instead of calling gateway when SMS is disabled', async () => {
    vi.stubEnv('SMS_GATEWAY_URL', '');
    vi.stubEnv('SMS_ENABLED', '0');
    const result = await sendSms({ to: '07701234567', messageToSend: 'test' });
    expect(result.mode).toBe('log');
    expect(result.delivered).toBe(false);
  });
});
