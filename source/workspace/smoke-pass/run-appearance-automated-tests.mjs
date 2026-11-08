#!/usr/bin/env node
/**
 * Regression gate for Appearance shell prefs + layout width (no manual browser pass required).
 * Usage: node workspace/smoke-pass/run-appearance-automated-tests.mjs
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const vitest = path.join(root, 'node_modules', 'vitest', 'vitest.mjs');

const patterns = [
  'src/features/appearance/components/__tests__/AppearanceShellPreferencesPanel.test.tsx',
  'src/shared/ui/shell-foundation/__tests__/shellLayoutWidthAppearance.test.ts',
  'src/shared/ui/shell-foundation/__tests__/shellLayoutWidthContext.appearance.test.tsx',
  'src/server/routes/__tests__/appearance.routes.test.ts',
  'src/features/appearance/components/__tests__/ThemeTokenEditor.chromeFinish.test.tsx',
];

const result = spawnSync(process.execPath, [vitest, 'run', ...patterns], {
  cwd: root,
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
