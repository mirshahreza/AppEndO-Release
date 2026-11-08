import { describe, expect, it } from 'vitest';
import { resolveStudioLogsHref } from '../studioLogsHref';

describe('resolveStudioLogsHref', () => {
  it('keeps the culture studio prefix', () => {
    expect(resolveStudioLogsHref('/us/studio/record-events', 'req-1')).toBe(
      '/us/studio/logs?requestId=req-1',
    );
  });

  it('falls back to bare studio', () => {
    expect(resolveStudioLogsHref('/studio/record-events', 'a b')).toBe(
      '/studio/logs?requestId=a%20b',
    );
  });
});
