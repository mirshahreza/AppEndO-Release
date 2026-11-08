import type { Terminal } from '@xterm/xterm';

const MAX_SNAPSHOT_CHARS = 8_000;

export function readXtermSnapshot(term: Terminal, maxChars = MAX_SNAPSHOT_CHARS): string {
  const buffer = term.buffer.active;
  const lines: string[] = [];
  for (let index = 0; index < buffer.length; index += 1) {
    const line = buffer.getLine(index);
    if (!line) {
      continue;
    }
    lines.push(line.translateToString(true));
  }
  const text = lines.join('\n').replace(/[ \t]+$/gm, '').replace(/\n+$/g, '');
  if (text.length <= maxChars) {
    return text;
  }
  return text.slice(text.length - maxChars);
}
