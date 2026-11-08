#!/usr/bin/env node
/**
 * One-time dev helper: bulk rename Server Functions → Server Functions in repo source.
 * Run from repo root: node scripts/rename-edge-to-server-functions.mjs
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(import.meta.dirname, '..');

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'trace-out', 'coverage', '.next',
]);

const FILE_RENAME_MAP = [
  [/ServerFunctionsPageView\.tsx$/, 'ServerFunctionsPageView.tsx'],
  [/ServerFunctionsWorkspace\.tsx$/, 'ServerFunctionsWorkspace.tsx'],
  [/ServerFunctionsLayout\.tsx$/, 'ServerFunctionsLayout.tsx'],
  [/ServerFunctionsPage\.tsx$/, 'ServerFunctionsPage.tsx'],
  [/ServerFunctionDeleteModal\.tsx$/, 'ServerFunctionDeleteModal.tsx'],
  [/ServerFunctionEditorPanel\.tsx$/, 'ServerFunctionEditorPanel.tsx'],
  [/ServerFunctionSidebarPanel\.tsx$/, 'ServerFunctionSidebarPanel.tsx'],
  [/ServerFunctionWorkspacePanel\.tsx$/, 'ServerFunctionWorkspacePanel.tsx'],
  [/ServerFunctionDocsToolbarButtons\.tsx$/, 'ServerFunctionDocsToolbarButtons.tsx'],
  [/ServerFunctionPickerDialog\.tsx$/, 'ServerFunctionPickerDialog.tsx'],
  [/ServerFunctions\.test\.tsx$/, 'ServerFunctions.test.tsx'],
  [/ServerFunctions\.cache-ui\.test\.tsx$/, 'ServerFunctions.cache-ui.test.tsx'],
  [/ExperienceHost\.serverFunctions\.test\.tsx$/, 'ExperienceHost.serverFunctions.test.tsx'],
  [/useServerFunctionsPage\.tsx$/, 'useServerFunctionsPage.tsx'],
  [/useServerFunctionActions\.ts$/, 'useServerFunctionActions.ts'],
  [/useServerFunctionCatalog\.ts$/, 'useServerFunctionCatalog.ts'],
  [/useServerFunctionDraft\.ts$/, 'useServerFunctionDraft.ts'],
  [/useServerFunctionEditor\.ts$/, 'useServerFunctionEditor.ts'],
  [/useServerFunctionLogs\.ts$/, 'useServerFunctionLogs.ts'],
  [/useServerFunctionRunner\.ts$/, 'useServerFunctionRunner.ts'],
  [/useServerFunctionSettings\.ts$/, 'useServerFunctionSettings.ts'],
  [/serverFunctionDraftCache\.ts$/, 'serverFunctionDraftCache.ts'],
  [/serverFunctionDocsUrls\.ts$/, 'serverFunctionDocsUrls.ts'],
  [/duplicateServerFunctionIdentity\.ts$/, 'duplicateServerFunctionIdentity.ts'],
  [/duplicateServerFunctionIdentity\.test\.ts$/, 'duplicateServerFunctionIdentity.test.ts'],
  [/useServerFunctionCatalog\.test\.tsx$/, 'useServerFunctionCatalog.test.tsx'],
  [/edge\.functions\.auto-crud\.pipeline\.test\.ts$/, 'server.functions.auto-crud.pipeline.test.ts'],
  [/edge\.functions\.comprehensive\.test\.ts$/, 'server.functions.comprehensive.test.ts'],
  [/edge\.functions\.file-store\.integration\.test\.ts$/, 'server.functions.file-store.integration.test.ts'],
  [/edge\.service\.direct-sql\.test\.ts$/, 'server-function.service.direct-sql.test.ts'],
  [/server-functions\.execute\.test\.ts$/, 'server-functions.execute.test.ts'],
  [/parseServerFunctionScriptDoc\.test\.ts$/, 'parseServerFunctionScriptDoc.test.ts'],
  [/serverFunctionPack\.test\.ts$/, 'serverFunctionPack.test.ts'],
  [/feature-server-functions\.mdc$/, 'feature-server-functions.mdc'],
];

const DIR_RENAMES = [
  ['src/features/server-functions', 'src/features/server-functions'],
  ['src/shared/api/contracts/server-functions', 'src/shared/api/contracts/server-functions'],
  ['src/shared/api/server-functions', 'src/shared/api/server-functions'],
];

/** Ordered replacements — specific patterns before general; preserve EdgeDb* */
const CONTENT_REPLACEMENTS = [
  ['append-server-functions-index', 'append-server-functions-index'],
  ['append-server-function-metadata', 'append-server-function-metadata'],
  ["schema: 'append-server-function'", "schema: 'append-server-function'"],
  ['append-server-function', 'append-server-function'],
  ['/api/data-sources/schema', '/api/data-sources/schema'],
  ['/api/core/server-functions', '/api/core/server-functions'],
  ['core:ServerFunctions', 'core:ServerFunctions'],
  ['mountServerFunctionRoutes', 'mountServerFunctionRoutes'],
  ['ServerFunctionRoutesDeps', 'ServerFunctionRoutesDeps'],
  ['ServerFunctionController', 'ServerFunctionController'],
  ['ServerFunctionService', 'ServerFunctionService'],
  ['serverFunctionDocCatalog', 'serverFunctionDocCatalog'],
  ['jobServerFunctionExecutor', 'jobServerFunctionExecutor'],
  ['parseServerFunctionScriptDoc', 'parseServerFunctionScriptDoc'],
  ['draftServerFunction', 'draftServerFunction'],
  ['DRAFT_SERVER_FUNCTION_TOOL_NAME', 'DRAFT_SERVER_FUNCTION_TOOL_NAME'],
  ['executeDraftServerFunction', 'executeDraftServerFunction'],
  ['createServerFunctionTools', 'createServerFunctionTools'],
  ['registerServerFunctionPackTools', 'registerServerFunctionPackTools'],
  ['LIST_SERVER_FUNCTIONS_TOOL_NAME', 'LIST_SERVER_FUNCTIONS_TOOL_NAME'],
  ['GET_SERVER_FUNCTION_TOOL_NAME', 'GET_SERVER_FUNCTION_TOOL_NAME'],
  ['TEST_SERVER_FUNCTION_TOOL_NAME', 'TEST_SERVER_FUNCTION_TOOL_NAME'],
  ['executeListServerFunctions', 'executeListServerFunctions'],
  ['executeGetServerFunction', 'executeGetServerFunction'],
  ['executeTestServerFunction', 'executeTestServerFunction'],
  ['ServerFunctionSummary', 'ServerFunctionSummary'],
  ['list_server_functions', 'list_server_functions'],
  ['get_server_function', 'get_server_function'],
  ['test_server_function', 'test_server_function'],
  ['draft_server_function', 'draft_server_function'],
  ['appendo-server-functions', 'appendo-server-functions'],
  ['SERVER_FUNCTIONS_INDEX_PATH', 'SERVER_FUNCTIONS_INDEX_PATH'],
  ['SERVER_FUNCTIONS_FIELDS', 'SERVER_FUNCTIONS_FIELDS'],
  ['SERVER_FUNCTION_SANDBOX_TYPE_DEFINITIONS', 'SERVER_FUNCTION_SANDBOX_TYPE_DEFINITIONS'],
  ['DEFAULT_SERVER_FUNCTION_LANGUAGE', 'DEFAULT_SERVER_FUNCTION_LANGUAGE'],
  ['ServerFunctionLanguage', 'ServerFunctionLanguage'],
  ['serverFunctionPortalTags', 'serverFunctionPortalTags'],
  ['duplicateServerFunctionIdentity', 'duplicateServerFunctionIdentity'],
  ['serverFunctionDocsUrls', 'serverFunctionDocsUrls'],
  ['serverFunctionDraftCache', 'serverFunctionDraftCache'],
  ['serverFunctionVmMode', 'serverFunctionVmMode'],
  ['serverFunctionRamAllocation', 'serverFunctionRamAllocation'],
  ['serverFunctionTimeout', 'serverFunctionTimeout'],
  ['serverFunctionAutoLogging', 'serverFunctionAutoLogging'],
  ['serverFunctionsCustom', 'serverFunctionsCustom'],
  ['serverFunctionsLocks', 'serverFunctionsLocks'],
  ['serverFunctionsTmp', 'serverFunctionsTmp'],
  ['serverFunctions:', 'serverFunctions:'],
  ['runtimeDirs.serverFunctions', 'runtimeDirs.serverFunctions'],
  ["LOCK_NAME = 'server-functions'", "LOCK_NAME = 'server-functions'"],
  ['workspace/server-functions', 'workspace/server-functions'],
  ['server-functions/', 'server-functions/'],
  ['server-functions', 'server-functions'],
  ['ServerFunctionsPageView', 'ServerFunctionsPageView'],
  ['ServerFunctionsWorkspace', 'ServerFunctionsWorkspace'],
  ['ServerFunctionsLayout', 'ServerFunctionsLayout'],
  ['ServerFunctionsPage', 'ServerFunctionsPage'],
  ['ServerFunctionDeleteModal', 'ServerFunctionDeleteModal'],
  ['ServerFunctionEditorPanel', 'ServerFunctionEditorPanel'],
  ['ServerFunctionSidebarPanel', 'ServerFunctionSidebarPanel'],
  ['ServerFunctionWorkspacePanel', 'ServerFunctionWorkspacePanel'],
  ['ServerFunctionDocsToolbarButtons', 'ServerFunctionDocsToolbarButtons'],
  ['ServerFunctionPickerDialog', 'ServerFunctionPickerDialog'],
  ['useServerFunctionsPage', 'useServerFunctionsPage'],
  ['useServerFunctionActions', 'useServerFunctionActions'],
  ['useServerFunctionCatalog', 'useServerFunctionCatalog'],
  ['useServerFunctionDraft', 'useServerFunctionDraft'],
  ['useServerFunctionEditor', 'useServerFunctionEditor'],
  ['useServerFunctionLogs', 'useServerFunctionLogs'],
  ['useServerFunctionRunner', 'useServerFunctionRunner'],
  ['useServerFunctionSettings', 'useServerFunctionSettings'],
  ['ServerFunctionDraft', 'ServerFunctionDraft'],
  ["kind: 'server_function'", "kind: 'server_function'"],
  ['Server Functions', 'Server Functions'],
  ['Server Function', 'Server Function'],
  ['server functions', 'server functions'],
  ['server function', 'server function'],
  ['ServerFunctions', 'ServerFunctions'],
  ['ServerFunction', 'ServerFunction'],
  ['serverFunction', 'serverFunction'],
  ['server-functions-openapi.md', 'server-functions-openapi.md'],
  ['smoke-server-functions', 'smoke-server-functions'],
  ['test:server-functions', 'test:server-functions'],
  ['smoke:server-functions', 'smoke:server-functions'],
  ['server.functions.', 'server.functions.'],
  ['server-function.service.', 'server-function.service.'],
  ['server-functions.routes', 'server-functions.routes'],
  ['server-function.controller', 'server-function.controller'],
  ['server-function.service', 'server-function.service'],
  ['serverFunctionTools', 'serverFunctionTools'],
  ['serverFunctionPack', 'serverFunctionPack'],
  ['ServerFunctionsSettingsFields', 'ServerFunctionsSettingsFields'],
  ['nav.server-functions', 'nav.server-functions'],
  ['api.server-functions.', 'api.server-functions.'],
  ['feature-server-functions', 'feature-server-functions'],
];

const TEXT_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.json', '.md', '.mdc', '.mdx',
]);

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const name of fs.readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full, files);
    else files.push(full);
  }
  return files;
}

function renameDir(oldPath, newPath) {
  const absOld = path.join(ROOT, oldPath);
  const absNew = path.join(ROOT, newPath);
  if (!fs.existsSync(absOld)) {
    console.log(`skip dir (missing): ${oldPath}`);
    return;
  }
  if (fs.existsSync(absNew)) {
    console.log(`skip dir (target exists): ${newPath}`);
    return;
  }
  try {
    fs.renameSync(absOld, absNew);
    console.log(`dir: ${oldPath} → ${newPath}`);
  } catch (err) {
    console.warn(`warn dir rename failed ${oldPath}: ${err.message}`);
  }
}

function renameFilesInTree(dirRel) {
  const absDir = path.join(ROOT, dirRel);
  if (!fs.existsSync(absDir)) return;
  const files = walk(absDir);
  for (const file of files) {
    const base = path.basename(file);
    let newBase = base;
    for (const [pattern, replacement] of FILE_RENAME_MAP) {
      if (pattern.test(base)) {
        newBase = base.replace(pattern, replacement);
        break;
      }
    }
    if (newBase !== base) {
      const target = path.join(path.dirname(file), newBase);
      if (!fs.existsSync(target)) {
        fs.renameSync(file, target);
        console.log(`file: ${path.relative(ROOT, file)} → ${path.relative(ROOT, target)}`);
      }
    }
  }
}

function applyContentReplacements(content) {
  let result = content;
  for (const [from, to] of CONTENT_REPLACEMENTS) {
    result = result.split(from).join(to);
  }
  return result;
}

function processFile(filePath) {
  const ext = path.extname(filePath);
  if (!TEXT_EXTENSIONS.has(ext)) return false;
  const rel = path.relative(ROOT, filePath);
  if (rel === 'scripts/rename-edge-to-server-functions.mjs') return false;
  const original = fs.readFileSync(filePath, 'utf8');
  const updated = applyContentReplacements(original);
  if (updated !== original) {
    fs.writeFileSync(filePath, updated, 'utf8');
    return true;
  }
  return false;
}

// 1. Rename directories
for (const [oldP, newP] of DIR_RENAMES) {
  renameDir(oldP, newP);
}

// 2. Rename files inside renamed trees + tests + cursor rules
const renameRoots = [
  'src/features/server-functions',
  'src/shared/api/contracts/server-functions',
  'src/shared/api/server-functions',
  'src/server/services/__tests__',
  'src/shared/api/__tests__',
  'src/shared/api/openapi/__tests__',
  'src/server/services/ai/mcp/builtin/__tests__',
  'src/app/platform/__tests__',
  '.cursor/rules',
];
for (const r of renameRoots) renameFilesInTree(r);

// Single-file renames at root paths
const singleRenames = [
  ['src/shared/api/queries/server-functions.ts', 'src/shared/api/queries/server-functions.ts'],
];
for (const [oldP, newP] of singleRenames) {
  const absOld = path.join(ROOT, oldP);
  const absNew = path.join(ROOT, newP);
  if (fs.existsSync(absOld) && !fs.existsSync(absNew)) {
    fs.renameSync(absOld, absNew);
    console.log(`file: ${oldP} → ${newP}`);
  }
}

// 3. Content replacement across repo
let changed = 0;
for (const file of walk(ROOT)) {
  if (processFile(file)) changed++;
}
console.log(`\nUpdated ${changed} files with content replacements.`);
