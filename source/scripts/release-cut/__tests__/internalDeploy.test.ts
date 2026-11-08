import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { assertInternalDeployScope } from '../assertInternalDeployScope';

describe('assertInternalDeployScope', () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const dir of dirs) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('accepts deploy tree with hawiety zip', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'deploy-gate-'));
    dirs.push(dir);
    fs.writeFileSync(
      path.join(dir, 'MANIFEST.json'),
      JSON.stringify({
        platformVersion: '0.0.1',
        bundledPackageIds: ['cms', 'remote-hubs', 'hawiety'],
        hawietyPromoteMode: 'reuse-zip',
        packageArtifacts: [{ packageId: 'hawiety', fileName: 'hawiety-0.3.6.zip' }],
      }),
    );
    fs.writeFileSync(path.join(dir, 'hawiety-0.3.6.zip'), 'zip');
    expect(() => assertInternalDeployScope(dir)).not.toThrow();
  });
});
