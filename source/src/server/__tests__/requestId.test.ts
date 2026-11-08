import { describe, expect, it } from 'vitest';
import { resolveRequestId } from '../requestId';

describe('resolveRequestId', () => {
  it('accepts a bounded alphanumeric request id', () => {
    expect(resolveRequestId('req_abc-123')).toBe('req_abc-123');
  });

  it('rejects log-injection payloads and mints a UUID', () => {
    const minted = resolveRequestId('ok\nINFO injected');
    expect(minted).toMatch(/^[0-9a-f-]{36}$/i);
    expect(minted).not.toContain('\n');
  });

  it('rejects oversized ids', () => {
    const minted = resolveRequestId('a'.repeat(65));
    expect(minted).toHaveLength(36);
  });
});
