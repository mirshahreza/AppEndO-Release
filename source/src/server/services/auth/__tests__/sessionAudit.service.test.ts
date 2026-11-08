import { describe, expect, it, vi, beforeEach } from 'vitest';
import { logAuthEvent } from '../sessionAudit.service';

const info = vi.fn();

vi.mock('../../../../core/logging/PinoRuntime', () => ({
  getAuthAuditPinoLogger: () => ({
    info,
  }),
}));

describe('sessionAudit.service', () => {
  beforeEach(() => {
    info.mockClear();
  });

  it('writes auth audit events through the pino logger', async () => {
    await logAuthEvent(
      { ipAddress: '127.0.0.1', userAgent: 'vitest' },
      'LOGIN_SUCCESS',
      {
        userId: 42,
        email: 'user@example.com',
        success: true,
        metadata: { source: 'test' },
      },
    );

    expect(info).toHaveBeenCalledTimes(1);
    expect(info.mock.calls[0]?.[0]).toMatchObject({
      userId: 42,
      email: 'user@example.com',
      eventType: 'LOGIN_SUCCESS',
      success: true,
      ipAddress: '127.0.0.1',
      userAgent: 'vitest',
      metadataJson: JSON.stringify({ source: 'test' }),
    });
    expect(info.mock.calls[0]?.[1]).toBe('LOGIN_SUCCESS');
  });
});
