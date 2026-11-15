import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ReleaseCutServerDeployTargetId } from './releaseCutServerDeployTargets';

const RELEASE_CUT_DIR = path.dirname(fileURLToPath(import.meta.url));

const DEPLOY_README = `# Server deploy config (RCUT-9)

Copy **deploy.target.example.json** to **deploy.target.local.json** in **this publish repo** (AppEndO-Release or AppEndO-Vertical).

- \`deployRoot\` — production filesystem root (UNC or local path on the server)
- \`publicUrl\` — optional public URL for smoke checks

\`deploy.target.local.json\` is preserved across release pushes and must not be committed.
`;

/** Ship example + operator notes on each export into the publish clone. */
export function materializeDeployTargetArtifacts(
  stagingDir: string,
  targetId: ReleaseCutServerDeployTargetId,
): void {
  const template =
    targetId === 'oss' ? 'deploy.target.example.oss.json' : 'deploy.target.example.vertical.json';
  const templatePath = path.join(RELEASE_CUT_DIR, 'templates', template);
  fs.copyFileSync(templatePath, path.join(stagingDir, 'deploy.target.example.json'));
  fs.writeFileSync(path.join(stagingDir, 'DEPLOY.md'), DEPLOY_README, 'utf8');
}

export const PUBLISH_CLONE_PRESERVE_ON_PUSH = ['deploy.target.local.json'] as const;