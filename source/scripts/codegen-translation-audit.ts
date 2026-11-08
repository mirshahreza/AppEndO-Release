/**
 * Report translation key coverage: master keys vs t('...') usages in source.
 *
 * Usage: npm run codegen:translation-audit
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listMasterTranslationKeys } from '../src/core/culture/translations/masterEn';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcRoot = path.join(root, 'src');

const SKIP_DIRS = new Set(['node_modules', 'generated', '__tests__', 'test-support']);

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) {
      continue;
    }
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, files);
      continue;
    }
    if (/\.(tsx?|jsx?)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

const keyUsagePattern = /\bt\(\s*['"`]([^'"`]+)['"`]/g;

const helperKeyPatterns: Array<{ regex: RegExp; resolve: (suffix: string) => string }> = [
  { regex: /\bauthPublicKey\(\s*['"`]([^'"`]+)['"`]/g, resolve: (s) => `auth.public.${s}` },
  { regex: /\bcolumnCommonKey\(\s*['"`]([^'"`]+)['"`]/g, resolve: (s) => `columns.common.${s}` },
  { regex: /\bcolumnsRolesKey\(\s*['"`]([^'"`]+)['"`]/g, resolve: (s) => `columns.roles.${s}` },
  { regex: /\bcolumnsPortalsKey\(\s*['"`]([^'"`]+)['"`]/g, resolve: (s) => `columns.portals.${s}` },
  { regex: /\bcolumnsPackagesKey\(\s*['"`]([^'"`]+)['"`]/g, resolve: (s) => `columns.packages.${s}` },
  { regex: /\bcolumnsMcpServersKey\(\s*['"`]([^'"`]+)['"`]/g, resolve: (s) => `columns.mcpServers.${s}` },
  { regex: /\bprofileKey\(\s*['"`]([^'"`]+)['"`]/g, resolve: (s) => `profile.${s}` },
  { regex: /\binstallKey\(\s*['"`]([^'"`]+)['"`]/g, resolve: (s) => `install.${s}` },
  { regex: /\boperationsKey\(\s*['"`]([^'"`]+)['"`]/g, resolve: (s) => `operations.${s}` },
  { regex: /\berrorsKey\(\s*['"`]([^'"`]+)['"`]/g, resolve: (s) => `errors.${s}` },
  { regex: /\bdesignerKey\(\s*['"`]([^'"`]+)['"`]/g, resolve: (s) => `designer.${s}` },
  { regex: /\bnavLabelKey\(\s*['"`]([^'"`]+)['"`]/g, resolve: (s) => `nav.${s}` },
  { regex: /\bnavDescriptionKey\(\s*['"`]([^'"`]+)['"`]/g, resolve: (s) => `nav.${s}.description` },
  { regex: /\bnavGroupKey\(\s*['"`]([^'"`]+)['"`]/g, resolve: (s) => `nav.group.${s.toLowerCase()}` },
  { regex: /\bsettingsSectionLabelKey\(\s*['"`]([^'"`]+)['"`]/g, resolve: (s) => `settings.sections.${s}` },
  { regex: /\bsettingsSectionDescriptionKey\(\s*['"`]([^'"`]+)['"`]/g, resolve: (s) => `settings.sections.${s}.description` },
  { regex: /\bsettingsScopeTitleKey\(\s*['"`]([^'"`]+)['"`]/g, resolve: (s) => `settings.scope.${s}.title` },
  { regex: /\bsettingsScopeBadgeKey\(\s*['"`]([^'"`]+)['"`]/g, resolve: (s) => `settings.scope.${s}.badge` },
  { regex: /\bsettingsScopeHintKey\(\s*['"`]([^'"`]+)['"`]/g, resolve: (s) => `settings.scope.${s}.hint` },
];

const usedKeys = new Set<string>();
const files = walk(srcRoot);

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  keyUsagePattern.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = keyUsagePattern.exec(content)) !== null) {
    usedKeys.add(match[1]);
  }

  for (const { regex, resolve } of helperKeyPatterns) {
    regex.lastIndex = 0;
    while ((match = regex.exec(content)) !== null) {
      usedKeys.add(resolve(match[1]));
    }
  }
}

const masterKeys = new Set(listMasterTranslationKeys());
const missingInMaster = [...usedKeys].filter((key) => !masterKeys.has(key)).sort();
const unusedInSource = [...masterKeys].filter((key) => !usedKeys.has(key));

console.log(`[codegen:translation-audit] master keys: ${masterKeys.size}`);
console.log(`[codegen:translation-audit] referenced keys (approx): ${usedKeys.size}`);
console.log(`[codegen:translation-audit] missing in master: ${missingInMaster.length}`);
if (missingInMaster.length > 0) {
  console.log(missingInMaster.slice(0, 40).map((key) => `  - ${key}`).join('\n'));
  if (missingInMaster.length > 40) {
    console.log(`  ... and ${missingInMaster.length - 40} more`);
  }
}
console.log(`[codegen:translation-audit] unused in source (info): ${unusedInSource.length}`);

if (missingInMaster.length > 0) {
  process.exitCode = 1;
}
