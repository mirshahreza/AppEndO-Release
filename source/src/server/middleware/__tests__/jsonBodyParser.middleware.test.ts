import { describe, expect, it } from 'vitest';
import {
  DEFAULT_JSON_BODY_LIMIT,
  LARGE_JSON_BODY_LIMIT,
  MEDIUM_JSON_BODY_LIMIT,
} from '../jsonBodyParser.middleware';

describe('jsonBodyParser.middleware limits', () => {
  it('exports conservative default, medium, and large route limits', () => {
    expect(DEFAULT_JSON_BODY_LIMIT).toBe('5mb');
    expect(MEDIUM_JSON_BODY_LIMIT).toBe('20mb');
    expect(LARGE_JSON_BODY_LIMIT).toBe('100mb');
  });
});
