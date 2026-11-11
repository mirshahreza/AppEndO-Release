import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { copyReleaseCutSourceSnapshot, isExcludedLocalRuntimeFile } from '../releaseCutSourceSnapshot';
import { assertReleaseCutSourceSnapshotSanitized } from '../releaseCutSnapshotSanitize';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  tempDirs.length = 0;
});

describe('isExcludedLocalRuntimeFile', () => {
  it('excludes operator-local root files only', () => {
    expect(isExcludedLocalRuntimeFile('settings.json')).toBe(true);
    expect(isExcludedLocalRuntimeFile('settings.json.abc.tmp')).toBe(true);
    expect(isExcludedLocalRuntimeFile('workspace/platform-registry/page-modules/settings.json')).toBe(false);
  });
});

describe('copyReleaseCutSourceSnapshot', () => {
  it('omits settings.json and emits clone profile artifacts', () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'rcut-src-'));
    const destRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'rcut-dest-'));
    tempDirs.push(repoRoot, destRoot);

    fs.writeFileSync(path.join(repoRoot, 'settings.json'), '{"secret":true}', 'utf8');
    fs.writeFileSync(path.join(repoRoot, 'settings.json.deadbeef.tmp'), 'x', 'utf8');
    fs.writeFileSync(path.join(repoRoot, 'marker.txt'), 'ok', 'utf8');
    fs.mkdirSync(path.join(repoRoot, 'src'), { recursive: true });
    fs.writeFileSync(path.join(repoRoot, 'src', 'keep.ts'), 'export {}', 'utf8');

    copyReleaseCutSourceSnapshot({
      repoRoot,
      destRoot,
      mode: 'full',
      cloneProfileId: 'hawiety',
      sourceReadmeLines: ['test readme'],
    });

    const sourceRoot = path.join(destRoot, 'source');
    expect(fs.existsSync(path.join(sourceRoot, 'settings.json'))).toBe(false);
    expect(fs.existsSync(path.join(sourceRoot, 'marker.txt'))).toBe(true);
    expect(fs.existsSync(path.join(sourceRoot, 'settings.recommended.json'))).toBe(true);
    expect(fs.existsSync(path.join(sourceRoot, 'CLONE_PROFILE.md'))).toBe(true);
    expect(fs.existsSync(path.join(sourceRoot, 'CLONE_PROFILE.json'))).toBe(true);
    expect(fs.existsSync(path.join(sourceRoot, '.gitignore'))).toBe(true);
    expect(fs.existsSync(path.join(destRoot, '.gitignore'))).toBe(true);

    const recommended = JSON.parse(fs.readFileSync(path.join(sourceRoot, 'settings.recommended.json'), 'utf8')) as {
      database: { url: string };
      runtime: { port: number };
    };
    expect(recommended.database.url).toContain('AppEndOHawiety');
    expect(recommended.runtime.port).toBe(3001);

    assertReleaseCutSourceSnapshotSanitized(sourceRoot);
  });
});
