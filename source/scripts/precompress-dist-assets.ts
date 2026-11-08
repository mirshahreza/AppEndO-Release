import { promises as fs } from 'fs';
import path from 'path';
import zlib from 'zlib';

/**
 * Pre-generates .br/.gz siblings for the content-hashed, immutable files under dist/assets.
 * Without this, the server's `compression` middleware re-gzips these (up to multi-MB) chunks on
 * every cache-miss request even though the bytes never change for a given hashed filename — see
 * `createPrecompressedAssetsMiddleware` in src/server/app.ts, which serves these siblings directly.
 */
const COMPRESSIBLE_EXTENSIONS = new Set(['.js', '.css', '.svg', '.json']);
const MIN_SIZE_BYTES = 1024; // matches the `compression` middleware's threshold

const walk = async (dir: string): Promise<string[]> => {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walk(fullPath));
    } else if (COMPRESSIBLE_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }
  return files;
};

const main = async (): Promise<void> => {
  const assetsDir = path.join(process.cwd(), 'dist', 'assets');
  try {
    await fs.access(assetsDir);
  } catch {
    console.log('[precompress] dist/assets not found, skipping (did `vite build` run?).');
    return;
  }

  const files = await walk(assetsDir);
  let compressedCount = 0;
  let totalRawBytes = 0;
  let totalBrBytes = 0;

  await Promise.all(files.map(async (filePath) => {
    const raw = await fs.readFile(filePath);
    if (raw.byteLength < MIN_SIZE_BYTES) {
      return;
    }

    const gz = zlib.gzipSync(raw, { level: 9 });
    const br = zlib.brotliCompressSync(raw, {
      params: {
        [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
        [zlib.constants.BROTLI_PARAM_SIZE_HINT]: raw.byteLength,
      },
    });

    await Promise.all([
      fs.writeFile(`${filePath}.gz`, gz),
      fs.writeFile(`${filePath}.br`, br),
    ]);

    compressedCount += 1;
    totalRawBytes += raw.byteLength;
    totalBrBytes += br.byteLength;
  }));

  const savedPct = totalRawBytes > 0 ? (100 * (1 - totalBrBytes / totalRawBytes)).toFixed(1) : '0';
  console.log(`[precompress] ${compressedCount} file(s) precompressed (.gz + .br). ${(totalRawBytes / 1e6).toFixed(2)}MB -> ${(totalBrBytes / 1e6).toFixed(2)}MB brotli (~${savedPct}% smaller).`);
};

main().catch((error: unknown) => {
  console.error('[precompress] Failed:', error);
  process.exit(1);
});
