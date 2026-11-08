import { afterEach, describe, expect, it } from 'vitest';
import { resolvePersonalInboxReadMode } from '../personalInboxProjectionConfig';

describe('personalInboxProjectionConfig', () => {
  const prior = process.env.PERSONAL_INBOX_READ_MODE;

  afterEach(() => {
    if (prior === undefined) {
      delete process.env.PERSONAL_INBOX_READ_MODE;
    } else {
      process.env.PERSONAL_INBOX_READ_MODE = prior;
    }
  });

  it('defaults to projection mode', () => {
    delete process.env.PERSONAL_INBOX_READ_MODE;
    expect(resolvePersonalInboxReadMode()).toBe('projection');
  });

  it('honors PERSONAL_INBOX_READ_MODE=live', () => {
    process.env.PERSONAL_INBOX_READ_MODE = 'live';
    expect(resolvePersonalInboxReadMode()).toBe('live');
  });

  it('treats unknown values as projection', () => {
    process.env.PERSONAL_INBOX_READ_MODE = 'something-else';
    expect(resolvePersonalInboxReadMode()).toBe('projection');
  });
});
