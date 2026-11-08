import { describe, expect, it } from 'vitest';
import { tokenizeCommandCode } from '../highlightCommandCode';

describe('tokenizeCommandCode', () => {
  it('colors the command, flags, and paths', () => {
    expect(tokenizeCommandCode('ls -la /var/www')).toEqual([
      { type: 'command', value: 'ls' },
      { type: 'text', value: ' ' },
      { type: 'flag', value: '-la' },
      { type: 'text', value: ' ' },
      { type: 'path', value: '/var/www' },
    ]);
  });

  it('keeps quoted strings together', () => {
    expect(tokenizeCommandCode('echo "hello world"')).toEqual([
      { type: 'command', value: 'echo' },
      { type: 'text', value: ' ' },
      { type: 'string', value: '"hello world"' },
    ]);
  });
});
