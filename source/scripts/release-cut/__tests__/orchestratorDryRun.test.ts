import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

describe('run-release-cut dry-run', () => {
  it('exits 0 with --allow-dirty', () => {
    const script = path.join(repoRoot, 'scripts/release-cut/run-release-cut.ts');
    const child = spawnSync(process.execPath, ['--import', 'tsx', script, '--dry-run', '--allow-dirty', '--no-main-guard'], {
      cwd: repoRoot,
      encoding: 'utf8',
      timeout: 120_000,
    });
    if (child.status !== 0) {
      // eslint-disable-next-line no-console
      console.error(child.stdout, child.stderr);
    }
    expect(child.status).toBe(0);
    expect(child.stdout).toContain('Release cut OK');
  }, 120_000);
});
