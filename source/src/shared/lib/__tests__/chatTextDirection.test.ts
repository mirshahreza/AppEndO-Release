import { describe, expect, it } from 'vitest';

import { getChatTextDirection } from '../chatTextDirection';

describe('getChatTextDirection', () => {
  it('returns ltr for English-only text', () => {
    expect(getChatTextDirection('Hello world')).toBe('ltr');
  });

  it('returns rtl for Arabic-only text', () => {
    expect(getChatTextDirection('مرحبا بالعالم')).toBe('rtl');
  });

  it('returns auto for mixed RTL and LTR text', () => {
    expect(getChatTextDirection('Hello مرحبا')).toBe('auto');
  });
});
