import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readCheckpoint, releaseCutRunRoot, writeCheckpoint, type ReleaseCutCheckpoint } from '../checkpoint';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  tempDirs.length = 0;
});

describe('checkpoint', () => {
  it('round-trips checkpoint json', () => {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'release-cut-cp-'));
    tempDirs.push(repo);
    const runId = 'test-run-1';
    const runRoot = releaseCutRunRoot(repo, runId);
    const checkpoint: ReleaseCutCheckpoint = {
      runId,
      startedAt: new Date().toISOString(),
      gitSha: 'abc',
      dryRun: true,
      bump: 'patch',
      publishPackageIds: ['hawiety'],
      skipOss: false,
      fastMode: false,
      completedPhases: ['P0', 'P1'],
    };
    writeCheckpoint(runRoot, checkpoint);
    const loaded = readCheckpoint(runRoot);
    expect(loaded.completedPhases).toEqual(['P0', 'P1']);
    expect(loaded.dryRun).toBe(true);
  });
});
