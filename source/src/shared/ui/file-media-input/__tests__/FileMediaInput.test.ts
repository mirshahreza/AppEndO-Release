import { describe, expect, it } from 'vitest';
import { normalizeFileMediaSelection } from '../FileMediaInput';

const file = (name: string, type: string, size: number) => ({ name, type, size }) as File;

describe('FileMediaInput selection normalization', () => {
  it('accepts MIME wildcards and extension lists', () => {
    const image = file('photo.png', 'image/png', 1024);
    const pdf = file('report.PDF', 'application/octet-stream', 1024);

    expect(normalizeFileMediaSelection([image], {
      multiple: true,
      accept: 'image/*',
      maxCount: 5,
      maxSizeMb: 2,
    })).toEqual({ files: [image], rejected: false });
    expect(normalizeFileMediaSelection([pdf], {
      multiple: true,
      accept: '.pdf,.docx',
      maxCount: 5,
      maxSizeMb: 2,
    })).toEqual({ files: [pdf], rejected: false });
  });

  it('rejects mismatched, oversized, and excess files', () => {
    const image = file('photo.png', 'image/png', 1024);
    const second = file('second.png', 'image/png', 1024);
    const document = file('report.pdf', 'application/pdf', 1024);
    const oversized = file('large.png', 'image/png', 3 * 1024 * 1024);

    expect(normalizeFileMediaSelection([image, second, document, oversized], {
      multiple: true,
      accept: 'image/*',
      maxCount: 1,
      maxSizeMb: 2,
    })).toEqual({ files: [image], rejected: true });
  });

  it('enforces single-file mode even with a larger count limit', () => {
    const first = file('first.txt', 'text/plain', 10);
    const second = file('second.txt', 'text/plain', 10);

    expect(normalizeFileMediaSelection([first, second], {
      multiple: false,
      accept: '*/*',
      maxCount: 10,
      maxSizeMb: 2,
    })).toEqual({ files: [first], rejected: true });
  });
});
