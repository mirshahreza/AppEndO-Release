#!/usr/bin/env tsx
/**
 * RCUT-9 — incremental server deploy from release staging (one root + URL per target).
 */
import {
  RELEASE_CUT_SERVER_DEPLOY_TARGETS,
  type ReleaseCutServerDeployTargetId,
} from './releaseCutServerDeployTargets';
import { deployReleaseCutTargets } from './releaseDeployIncremental';

function main(): void {
  const argv = process.argv.slice(2);
  let target: ReleaseCutServerDeployTargetId | 'all' = 'all';
  let full = false;
  let dryRun = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--target' && argv[i + 1]) {
      const raw = argv[++i] as ReleaseCutServerDeployTargetId | 'all';
      if (raw !== 'oss' && raw !== 'hawiety' && raw !== 'all') {
        throw new Error(`Invalid --target ${raw} (use oss | hawiety | all)`);
      }
      target = raw;
    } else if (arg === '--full') {
      full = true;
    } else if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`Usage: npm run release:deploy -- [--target oss|hawiety|all] [--full] [--dry-run]`);
      console.log('');
      console.log('Configure one deploy root (+ optional URL) per line:');
      for (const row of Object.values(RELEASE_CUT_SERVER_DEPLOY_TARGETS)) {
        console.log(`  ${row.targetId}: ${row.deployRootEnvVar} · ${row.deployUrlEnvVar}`);
      }
      console.log(
        '  publish clone: ../AppEndO-Release or ../AppEndO-Hawiety → deploy.target.example.json → deploy.target.local.json',
      );
      process.exit(0);
    }
  }

  const targetIds: ReleaseCutServerDeployTargetId[] =
    target === 'all' ? ['oss', 'hawiety'] : [target];

  const results = deployReleaseCutTargets({ full, dryRun, targetIds });
  for (const result of results) {
    const mode = dryRun ? 'dry-run' : full ? 'full' : 'incremental';
    console.log(
      `[release:deploy] ${result.targetId} (${mode}): copied=${result.copied} skipped=${result.skipped} → ${result.targetRoot}`,
    );
    console.log(`  staging: ${result.stagingDir}`);
  }
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[release:deploy] failed: ${message}`);
  process.exit(1);
}