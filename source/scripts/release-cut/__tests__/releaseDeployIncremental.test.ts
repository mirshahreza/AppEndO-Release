import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { sha256File } from '../artifacts';
import { incrementalDeployToTarget } from '../releaseDeployIncremental';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  tempDirs.length = 0;
});

function makeStaging(version: string, distBody: string): string {
  const staging = fs.mkdtempSync(path.join(os.tmpdir(), 'appendo-staging-'));
  tempDirs.push(staging);
  const distDir = path.join(staging, 'dist');
  fs.mkdirSync(distDir, { recursive: true });
  fs.writeFileSync(path.join(distDir, 'server.cjs'), distBody);
  const packagesDir = path.join(staging, 'packages');
  fs.mkdirSync(packagesDir, { recursive: true });
  const cms = path.join(packagesDir, 'cms-1.0.0.zip');
  fs.writeFileSync(cms, 'cms');
  fs.writeFileSync(
    path.join(staging, 'MANIFEST.json'),
    `${JSON.stringify(
      {
        platformVersion: version,
        packageArtifacts: [
          {
            packageId: 'cms',
            fileName: 'cms-1.0.0.zip',
            sha256: sha256File(cms),
          },
        ],
      },
      null,
      2,
    )}\n`,
  );
  return staging;
}

describe('incrementalDeployToTarget', () => {
  it('copies only changed dist files on second run', () => {
    const staging = makeStaging('0.0.1', 'v1');
    const targetRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'appendo-target-'));
    tempDirs.push(targetRoot);

    const first = incrementalDeployToTarget({
      targetId: 'oss',
      stagingDir: staging,
      targetRoot,
      platformVersion: '0.0.1',
    });
    expect(first.copied).toBeGreaterThan(0);
    expect(first.skipped).toBe(0);
    expect(fs.existsSync(path.join(targetRoot, 'dist', 'server.cjs'))).toBe(true);

    const second = incrementalDeployToTarget({
      targetId: 'oss',
      stagingDir: staging,
      targetRoot,
      platformVersion: '0.0.1',
    });
    expect(second.copied).toBe(0);
    expect(second.skipped).toBeGreaterThan(0);

    fs.writeFileSync(path.join(staging, 'dist', 'server.cjs'), 'v2');
    const third = incrementalDeployToTarget({
      targetId: 'oss',
      stagingDir: staging,
      targetRoot,
      platformVersion: '0.0.1',
    });
    expect(third.copied).toBe(1);
    expect(fs.readFileSync(path.join(targetRoot, 'dist', 'server.cjs'), 'utf8')).toBe('v2');
  });
});