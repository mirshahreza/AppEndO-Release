import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ReleaseCutCloneProfileId } from './releaseCutCloneProfiles';
import { cloneProfileFor } from './releaseCutCloneProfiles';

const TEMPLATES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'templates');

export function materializeCloneProfileInSourceRoot(
  sourceRoot: string,
  profileId: ReleaseCutCloneProfileId,
): void {
  const profile = cloneProfileFor(profileId);
  const settingsTemplate = path.join(TEMPLATES_DIR, profile.settingsRecommendedTemplate);
  const docTemplate = path.join(TEMPLATES_DIR, profile.cloneProfileDocTemplate);

  if (!fs.existsSync(settingsTemplate)) {
    throw new Error(`Missing clone settings template: ${settingsTemplate}`);
  }
  if (!fs.existsSync(docTemplate)) {
    throw new Error(`Missing clone profile doc template: ${docTemplate}`);
  }

  const settingsBody = fs.readFileSync(settingsTemplate, 'utf8');
  fs.writeFileSync(path.join(sourceRoot, 'settings.recommended.json'), settingsBody, 'utf8');

  const docBody = fs
    .readFileSync(docTemplate, 'utf8')
    .replaceAll('{{RECOMMENDED_DATABASE}}', profile.recommendedControlPlaneDatabase)
    .replaceAll('{{RECOMMENDED_DEV_PORT}}', String(profile.recommendedDevPort));

  fs.writeFileSync(path.join(sourceRoot, 'CLONE_PROFILE.md'), docBody, 'utf8');

  const machine = {
    profileId: profile.id,
    title: profile.title,
    recommendedControlPlaneDatabase: profile.recommendedControlPlaneDatabase,
    recommendedDevPort: profile.recommendedDevPort,
    forbiddenInGit: ['settings.json', '.env', 'settings.json.install-backup', 'settings.json.*.tmp'],
    bootstrap: {
      npmScript: 'clone:bootstrap',
      args: [`--profile`, profile.id],
    },
  };
  fs.writeFileSync(
    path.join(sourceRoot, 'CLONE_PROFILE.json'),
    `${JSON.stringify(machine, null, 2)}\n`,
    'utf8',
  );

  const sourceGitignore = path.join(TEMPLATES_DIR, 'clone-source.gitignore');
  if (fs.existsSync(sourceGitignore)) {
    fs.copyFileSync(sourceGitignore, path.join(sourceRoot, '.gitignore'));
  }

  const sqlBootstrap = path.join(TEMPLATES_DIR, 'ensure-clone-databases.sqlserver.sql');
  if (fs.existsSync(sqlBootstrap)) {
    fs.copyFileSync(sqlBootstrap, path.join(sourceRoot, 'ensure-clone-databases.sqlserver.sql'));
  }
}

export function materializeCloneRepoRootGitignore(deployRoot: string): void {
  const template = path.join(TEMPLATES_DIR, 'clone-repo-root.gitignore');
  if (!fs.existsSync(template)) return;
  fs.copyFileSync(template, path.join(deployRoot, '.gitignore'));
}
