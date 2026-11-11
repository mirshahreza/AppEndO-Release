import fs from 'node:fs';
import path from 'node:path';
import { isExcludedLocalRuntimeFile } from './releaseCutSourceSnapshot';

export function assertReleaseCutSourceSnapshotSanitized(sourceRoot: string): void {
  const offenders: string[] = [];

  const walk = (absDir: string): void => {
    for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
      const full = path.join(absDir, entry.name);
      const rel = path.relative(sourceRoot, full).replace(/\\/g, '/');
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (isExcludedLocalRuntimeFile(rel)) {
        offenders.push(rel);
      }
    }
  };

  walk(sourceRoot);

  if (offenders.length > 0) {
    throw new Error(
      `Release-cut snapshot sanitize: forbidden operator-local files in source/: ${offenders.join(', ')}`,
    );
  }

  const recommended = path.join(sourceRoot, 'settings.recommended.json');
  const profileDoc = path.join(sourceRoot, 'CLONE_PROFILE.md');
  if (!fs.existsSync(recommended)) {
    throw new Error('Release-cut snapshot sanitize: missing source/settings.recommended.json');
  }
  if (!fs.existsSync(profileDoc)) {
    throw new Error('Release-cut snapshot sanitize: missing source/CLONE_PROFILE.md');
  }
}
