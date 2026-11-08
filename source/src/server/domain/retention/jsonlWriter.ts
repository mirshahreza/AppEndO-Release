import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { finished } from 'node:stream/promises';
import type { Writable } from 'node:stream';
import { createGzip, type Gzip } from 'node:zlib';
import type { RetentionFamily } from '../../../shared/api/contracts/settings/retention';

export type JsonlBatchFile = {
  family: RetentionFamily;
  rowCount: number;
  byteLength: number;
};

const sanitizeJobToken = (jobId: number): string => String(jobId).replace(/[^0-9]/g, '') || '0';

export class GzipJsonlWriter {
  private gzip: Gzip | null = null;
  private dest: Writable | null = null;
  private closed = false;
  rowCount = 0;
  byteLength = 0;

  constructor(
    private readonly directory: string,
    private readonly family: RetentionFamily,
    private readonly jobId: number,
  ) {}

  private async ensureOpen(): Promise<void> {
    if (this.gzip) return;
    if (!this.directory.trim()) {
      throw new Error('Archive destination is not configured.');
    }
    await mkdir(this.directory, { recursive: true });
    const fileName = `${this.family}-${sanitizeJobToken(this.jobId)}.jsonl.gz`;
    const filePath = path.join(this.directory, fileName);
    this.gzip = createGzip();
    this.dest = createWriteStream(filePath);
    this.gzip.pipe(this.dest);
  }

  async append(rows: unknown[]): Promise<void> {
    if (this.closed) {
      throw new Error('Archive writer is closed.');
    }
    if (rows.length === 0) return;
    await this.ensureOpen();
    const body = `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`;
    this.byteLength += Buffer.byteLength(body, 'utf8');
    this.rowCount += rows.length;
    await new Promise<void>((resolve, reject) => {
      this.gzip!.write(body, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }

  async close(): Promise<JsonlBatchFile> {
    if (this.closed) {
      return { family: this.family, rowCount: this.rowCount, byteLength: this.byteLength };
    }
    this.closed = true;
    if (!this.gzip || !this.dest) {
      return { family: this.family, rowCount: 0, byteLength: 0 };
    }
    this.gzip.end();
    await finished(this.dest);
    return { family: this.family, rowCount: this.rowCount, byteLength: this.byteLength };
  }
}
