import { describe, expect, it } from 'vitest';
import type { Terminal } from '@xterm/xterm';
import { readXtermSnapshot } from '../readXtermSnapshot';

describe('readXtermSnapshot', () => {
  it('joins trimmed buffer lines and caps length', () => {
    const term = {
      buffer: {
        active: {
          length: 2,
          getLine: (index: number) => ({
            translateToString: () => (index === 0 ? 'hello   ' : 'world   '),
          }),
        },
      },
    } as unknown as Terminal;

    expect(readXtermSnapshot(term)).toBe('hello\nworld');
    expect(readXtermSnapshot(term, 5)).toBe('world');
  });
});
