import { describe, expect, it } from 'vitest';
import crypto from 'crypto';
import {
  buildPackageArtifactHashPayload,
  computePackageArtifactHashAsync,
  type PackageArtifactFile,
} from '../packageArtifactHash';

const toBytes = (value: string): Uint8Array => new TextEncoder().encode(value);

const computeNodeHash = (files: PackageArtifactFile[]): string => (
  crypto.createHash('sha256').update(buildPackageArtifactHashPayload(files)).digest('hex')
);

describe('packageArtifactHash', () => {
  it('matches Node SHA-256 for sorted non-manifest entries', async () => {
    const files: PackageArtifactFile[] = [
      { entryName: 'edge/orders.ts', data: toBytes("export default async () => ({ ok: true });\n") },
      { entryName: 'ui/summary.tsx', data: toBytes('export default function Summary() { return null; }\n') },
    ];

    await expect(computePackageArtifactHashAsync(files)).resolves.toBe(computeNodeHash(files));
  });

  it('excludes package.json from the payload', async () => {
    const files: PackageArtifactFile[] = [
      { entryName: 'package.json', data: toBytes('{"id":"demo"}\n') },
      { entryName: 'edge/ping.ts', data: toBytes('export default async () => ({ ok: true });\n') },
    ];

    const hashWithoutManifest = await computePackageArtifactHashAsync([files[1]]);
    await expect(computePackageArtifactHashAsync(files)).resolves.toBe(hashWithoutManifest);
  });
});
