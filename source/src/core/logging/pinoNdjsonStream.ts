import { Writable } from 'stream';

export const createNdjsonLineWritable = (
  onLine: (obj: Record<string, unknown>) => void,
): Writable => {
  let buffer = '';

  const flushLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    try {
      onLine(JSON.parse(trimmed) as Record<string, unknown>);
    } catch {
      // Ignore malformed NDJSON lines from partial writes.
    }
  };

  return new Writable({
    write(chunk, _encoding, callback) {
      buffer += chunk.toString('utf8');
      let newlineIndex = buffer.indexOf('\n');
      while (newlineIndex >= 0) {
        flushLine(buffer.slice(0, newlineIndex));
        buffer = buffer.slice(newlineIndex + 1);
        newlineIndex = buffer.indexOf('\n');
      }
      callback();
    },
    final(callback) {
      flushLine(buffer);
      buffer = '';
      callback();
    },
  });
};
