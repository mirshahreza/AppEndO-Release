import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { resolveLatestArtifact, sha256File } from '../artifacts';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  tempDirs.length = 0;
});

describe('resolveLatestArtifact', () => {
  it('picks newest matching zip under packages-storage/tmp', () => {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'release-cut-repo-'));
    tempDirs.push(repo);
    const tmp = path.join(repo, 'packages-storage', 'tmp');
    fs.mkdirSync(tmp, { recursive: true });
    const older = path.join(tmp, 'cms-1.0.0.zip');
    const newer = path.join(tmp, 'cms-1.0.1.zip');
    fs.writeFileSync(older, 'a');
    fs.writeFileSync(newer, 'b');
    const olderTime = Date.now() - 60_000;
    fs.utimesSync(older, olderTime / 1000, olderTime / 1000);

    const found = resolveLatestArtifact(repo, 'packages-storage/tmp/cms-*.zip');
    expect(found).toBe(newer);
  });
});

describe('sha256File', () => {
  it('is stable for same bytes', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'release-cut-hash-'));
    tempDirs.push(dir);
    const file = path.join(dir, 'x.bin');
    fs.writeFileSync(file, 'hello');
    const a = sha256File(file);
    const b = sha256File(file);
    expect(a).toBe(b);
    expect(a.length).toBe(64);
  });
});
