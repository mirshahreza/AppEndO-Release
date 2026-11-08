import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { assertPublicOssReleaseScope, type PublicOssManifest } from '../assertPublicOssReleaseScope';
import { bumpSemver, parseSemver } from '../semver';
import { planVersionBump } from '../versionManifest';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  tempDirs.length = 0;
});

function makeOssDir(manifest: PublicOssManifest, zipNames: string[]): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'release-cut-oss-'));
  tempDirs.push(dir);
  fs.writeFileSync(path.join(dir, 'MANIFEST.json'), JSON.stringify(manifest, null, 2), 'utf8');
  for (const name of zipNames) {
    fs.writeFileSync(path.join(dir, name), 'zip-bytes', 'utf8');
  }
  return dir;
}

describe('semver', () => {
  it('bumps patch minor major', () => {
    expect(bumpSemver('1.2.3', 'patch')).toBe('1.2.4');
    expect(bumpSemver('1.2.3', 'minor')).toBe('1.3.0');
    expect(bumpSemver('1.2.3', 'major')).toBe('2.0.0');
  });

  it('parses valid semver', () => {
    expect(parseSemver('0.3.5')).toEqual({ major: 0, minor: 3, patch: 5 });
  });
});

describe('planVersionBump', () => {
  it('bumps platform and publish packages', () => {
    const plan = planVersionBump({
      bump: 'patch',
      publishPackageIds: ['hawiety'],
    });
    expect(plan.after.platform).not.toBe(plan.before.platform);
    expect(plan.after.packages.hawiety).not.toBe(plan.before.packages.hawiety);
    expect(plan.after.packages.cms).toBe(plan.before.packages.cms);
  });
});

describe('assertPublicOssReleaseScope', () => {
  it('accepts cms and remote-hubs only', () => {
    const manifest: PublicOssManifest = {
      platformVersion: '0.0.1',
      bundledPackageIds: ['cms', 'remote-hubs'],
      packageArtifacts: [
        { packageId: 'cms', fileName: 'cms-1.0.0.zip', sha256: 'a' },
        { packageId: 'remote-hubs', fileName: 'remote-hubs-1.0.0.zip', sha256: 'b' },
      ],
      createdAt: new Date().toISOString(),
    };
    const dir = makeOssDir(manifest, ['cms-1.0.0.zip', 'remote-hubs-1.0.0.zip']);
    expect(() => assertPublicOssReleaseScope(dir)).not.toThrow();
  });

  it('rejects hawiety zip in public-oss', () => {
    const manifest: PublicOssManifest = {
      platformVersion: '0.0.1',
      bundledPackageIds: ['cms', 'remote-hubs'],
      packageArtifacts: [],
      createdAt: new Date().toISOString(),
    };
    const dir = makeOssDir(manifest, ['hawiety-0.3.5.zip']);
    expect(() => assertPublicOssReleaseScope(dir)).toThrow(/forbidden zip/);
  });

  it('rejects wrong bundledPackageIds', () => {
    const manifest: PublicOssManifest = {
      platformVersion: '0.0.1',
      bundledPackageIds: ['cms'],
      packageArtifacts: [],
      createdAt: new Date().toISOString(),
    };
    const dir = makeOssDir(manifest, []);
    expect(() => assertPublicOssReleaseScope(dir)).toThrow(/bundledPackageIds/);
  });
});
