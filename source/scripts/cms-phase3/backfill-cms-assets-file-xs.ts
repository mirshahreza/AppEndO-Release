/**
 * Backfill missing `file_xs` thumbnails for image CMS content assets.
 * Run after the xs-only list preview change when legacy rows still have full `file` bytes only.
 *
 * Usage: npx tsx scripts/cms-phase3/backfill-cms-assets-file-xs.ts
 */

import sharp from 'sharp';
import { Pool } from 'pg';
import { toPgPoolConfig } from '../../src/server/config/env';

const BATCH_SIZE = 25;

const isImageMime = (mime: unknown): boolean =>
  typeof mime === 'string' && mime.toLowerCase().startsWith('image/');

const toBuffer = (value: unknown): Buffer | null => {
  if (Buffer.isBuffer(value)) {
    return value.length ? value : null;
  }
  if (value instanceof Uint8Array) {
    return value.length ? Buffer.from(value) : null;
  }
  return null;
};

const buildImageThumbnail = async (file: Buffer): Promise<Buffer | null> => {
  try {
    return await sharp(file, { failOn: 'error' })
      .resize({ height: 100, withoutEnlargement: true })
      .jpeg({ quality: 72 })
      .toBuffer();
  } catch {
    return null;
  }
};

async function main(): Promise<void> {
  const pool = new Pool(toPgPoolConfig());
  let offset = 0;
  let updated = 0;
  let skipped = 0;

  try {
    for (;;) {
      const result = await pool.query<{
        id: string;
        file: Buffer | null;
        file_xs: Buffer | null;
        file_mime: string | null;
      }>(
        `SELECT id, file, file_xs, file_mime
         FROM cms_content_assets
         ORDER BY id
         LIMIT $1 OFFSET $2`,
        [BATCH_SIZE, offset],
      );
      if (result.rows.length === 0) {
        break;
      }

      for (const row of result.rows) {
        if (!isImageMime(row.file_mime)) {
          skipped += 1;
          continue;
        }
        if (toBuffer(row.file_xs)) {
          skipped += 1;
          continue;
        }
        const full = toBuffer(row.file);
        if (!full) {
          skipped += 1;
          continue;
        }
        const thumb = await buildImageThumbnail(full);
        if (!thumb) {
          skipped += 1;
          continue;
        }
        await pool.query(
          'UPDATE cms_content_assets SET file_xs = $1 WHERE id = $2',
          [thumb, row.id],
        );
        updated += 1;
        console.log(`[backfill] updated asset id=${row.id}`);
      }

      offset += result.rows.length;
    }
  } finally {
    await pool.end();
  }

  console.log(`[backfill] done — updated=${updated} skipped=${skipped}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
