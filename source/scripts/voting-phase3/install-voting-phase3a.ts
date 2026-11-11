/**
 * Voting Phase 3a — Studio nav + page-module stubs (elections catalog + settings).
 *
 *   npm run voting:phase3a
 *   npm run voting:phase3a:rollback
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  buildVotingStudioNavGroup,
  removeVotingStudioNavGroup,
  upsertVotingStudioNavGroup,
  VOTING_ROUTE_PREFIX,
} from './votingStudioNav';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const pageModulesDir = path.join(repoRoot, 'workspace', 'platform-registry', 'page-modules');
const isRollback = process.argv.includes('--rollback');

const PAGE_STUBS: Array<{ fileName: string; pageKey: string; title: string }> = [
  { fileName: 'voting-votings.json', pageKey: 'voting-votings', title: 'Voting' },
  { fileName: 'voting-settings.json', pageKey: 'voting-settings', title: 'Voting settings' },
];

const writePageStub = (fileName: string, pageKey: string, title: string): void => {
  const target = path.join(pageModulesDir, fileName);
  if (fs.existsSync(target)) {
    console.log(`  page-module exists: ${fileName}`);
    return;
  }
  const payload = {
    pageKey,
    title,
    loaderKind: 'package',
    loaderRef: `voting:${pageKey}`,
    defaultRoles: null,
    enabled: true,
    ownerPackageId: 'voting',
    ownerPluginVersion: null,
    source: 'manual',
    createdAt: new Date().toISOString(),
    createdBy: null,
    createdByUsername: 'voting-phase3a',
    updatedAt: new Date().toISOString(),
    updatedBy: null,
    updatedByUsername: 'voting-phase3a',
  };
  fs.writeFileSync(target, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`  wrote page-module stub: ${fileName}`);
};

const install = (): void => {
  console.log('[Voting Phase 3a] Studio nav + page stubs…');
  const group = buildVotingStudioNavGroup([
    {
      pageKey: 'voting-votings',
      routePattern: `${VOTING_ROUTE_PREFIX}/votings`,
      label: 'Voting',
      icon: 'Vote',
      description: 'Voting scopes and ballots',
      iconColor: 'violet',
      order: 1,
    },
    {
      pageKey: 'voting-settings',
      routePattern: `${VOTING_ROUTE_PREFIX}/settings/*`,
      label: 'Settings',
      icon: 'Settings',
      description: 'Voting vocabulary (Base Info)',
      iconColor: 'slate',
      order: 2,
      separatorBefore: true,
    },
  ]);
  upsertVotingStudioNavGroup(group);

  for (const stub of PAGE_STUBS) {
    writePageStub(stub.fileName, stub.pageKey, stub.title);
  }

  console.log('[Voting Phase 3a] Done. Next: Phase 3b golden elections UI (package-ui.md).');
};

const rollback = (): void => {
  console.log('[Voting Phase 3a rollback] Removing nav group…');
  removeVotingStudioNavGroup();
  for (const stub of PAGE_STUBS) {
    const target = path.join(pageModulesDir, stub.fileName);
    if (fs.existsSync(target)) {
      const raw = fs.readFileSync(target, 'utf8');
      if (raw.includes('placeholder')) {
        fs.unlinkSync(target);
        console.log(`  removed stub: ${stub.fileName}`);
      }
    }
  }
  console.log('[Voting Phase 3a rollback] Done.');
};

if (isRollback) {
  rollback();
} else {
  install();
}
