import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TEMPLATE_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'templates',
  'AppEndO-Release-README.md',
);

export function renderPublicReleaseReadme(platformVersion: string, bundledPackageIds: string[]): string {
  const template = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  return template
    .replaceAll('{{PLATFORM_VERSION}}', platformVersion)
    .replaceAll('{{BUNDLED_PACKAGES}}', bundledPackageIds.map((id) => `\`${id}\``).join(', '));
}
