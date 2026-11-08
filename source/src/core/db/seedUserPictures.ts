import fs from 'node:fs';
import path from 'node:path';
import { crc32, deflateSync } from 'node:zlib';

export const SEED_PICTURES_DIR = path.join(process.cwd(), 'personal-pictures');

export type SeedPicturePayload = {
  body: Buffer;
  bodyXs: Buffer;
  mime: string;
  size: number;
};

const MIME_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

const AVATAR_COLORS: ReadonlyArray<readonly [number, number, number]> = [
  [79, 70, 229],
  [8, 145, 178],
  [5, 150, 105],
  [217, 119, 6],
  [225, 29, 72],
  [124, 58, 237],
];

const resolveMime = (filePath: string): string => MIME_BY_EXT[path.extname(filePath).toLowerCase()] ?? 'image/jpeg';

const resolveXsPath = (filePath: string): string => {
  const ext = path.extname(filePath);
  const base = filePath.slice(0, -ext.length);
  return `${base}-xs${ext}`;
};

const hashString = (value: string): number => {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const pngChunk = (type: string, data: Buffer): Buffer => {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
};

const encodeSolidPng = (width: number, height: number, rgb: readonly [number, number, number]): Buffer => {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (width * 3 + 1);
    raw[rowStart] = 0;
    for (let x = 0; x < width; x += 1) {
      const pixel = rowStart + 1 + x * 3;
      raw[pixel] = rgb[0];
      raw[pixel + 1] = rgb[1];
      raw[pixel + 2] = rgb[2];
    }
  }
  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
};

export const buildPlaceholderSeedPicture = (relativePath: string): SeedPicturePayload => {
  const rgb = AVATAR_COLORS[hashString(relativePath) % AVATAR_COLORS.length] ?? AVATAR_COLORS[0];
  const body = encodeSolidPng(64, 64, rgb);
  const bodyXs = encodeSolidPng(32, 32, rgb);
  return {
    body,
    bodyXs,
    mime: 'image/png',
    size: body.length,
  };
};

const readPictureFile = (fullPath: string): SeedPicturePayload | null => {
  if (!fs.existsSync(fullPath)) return null;

  const body = fs.readFileSync(fullPath);
  const xsPath = resolveXsPath(fullPath);
  const bodyXs = fs.existsSync(xsPath) ? fs.readFileSync(xsPath) : body;

  return {
    body,
    bodyXs,
    mime: resolveMime(fullPath),
    size: body.length,
  };
};

export const loadSeedPicture = (relativePath: string): SeedPicturePayload => {
  const fromDisk = readPictureFile(path.join(SEED_PICTURES_DIR, relativePath));
  return fromDisk ?? buildPlaceholderSeedPicture(relativePath);
};
