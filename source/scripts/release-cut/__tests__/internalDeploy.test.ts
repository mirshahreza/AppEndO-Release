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

  it('accepts deploy tree with vertical zip', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'deploy-gate-'));
    dirs.push(dir);
    fs.writeFileSync(
      path.join(dir, 'MANIFEST.json'),
      JSON.stringify({
        platformVersion: '0.0.1',
        bundledPackageIds: ['cms', 'remote-hubs', 'vertical'],
        verticalPromoteMode: 'reuse-zip',
        packageArtifacts: [{ packageId: 'vertical', fileName: 'vertical-0.3.6.zip' }],
      }),
    );
    fs.mkdirSync(path.join(dir, 'packages'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'packages', 'vertical-0.3.6.zip'), 'zip');
    expect(() => assertInternalDeployScope(dir)).not.toThrow();
  });
});
