#!/usr/bin/env tsx
/**
 * Write deploy.target.example.json + DEPLOY.md into an existing publish clone (no full re-export).
 */
import fs from 'node:fs';
import path from 'node:path';
import { materializeDeployTargetArtifacts } from './materializeDeployTargetArtifacts';
import type { ReleaseCutServerDeployTargetId } from './releaseCutServerDeployTargets';
import { resolvePublishClonePath } from './releaseCutServerDeployTargets';
import { releaseCutRepoRoot } from './versionManifest';

function parseTarget(argv: string[]): ReleaseCutServerDeployTargetId {
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--target' && argv[i + 1]) {
      const raw = argv[++i];
      if (raw === 'oss' || raw === 'vertical') {
        return raw;
      }
      throw new Error('--target must be oss or vertical');
    }
  }
  throw new Error('Usage: npm run release:bootstrap-deploy-config -- --target oss|vertical');
}

const targetId = parseTarget(process.argv.slice(2));
const repoRoot = releaseCutRepoRoot();
const clonePath = resolvePublishClonePath(targetId, repoRoot);

if (!fs.existsSync(path.join(clonePath, '.git'))) {
  throw new Error(`Missing publish clone at ${clonePath}`);
}

materializeDeployTargetArtifacts(clonePath, targetId);
console.log(`Wrote deploy.target.example.json and DEPLOY.md in ${clonePath}`);
console.log(`Next: copy deploy.target.example.json → deploy.target.local.json in that folder.`);