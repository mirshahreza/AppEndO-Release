import fs from 'node:fs';
import path from 'node:path';
import type { FileManagerScope } from '../../../shared/api/contracts/file-manager/types';

export const FILE_MANAGER_WORKSPACE_DIR = 'workspace';

export const FILE_MANAGER_DENIED_PATTERNS = [
  /^\.env/i,
  /(^|\/)settings\.json$/i,
  /(^|\/)settings\.install\.json$/i,
  /(^|\/)settings\.json\.install-backup$/i,
  /(^|\/)cookies\.txt$/i,
  /(^|\/)logs(\/|$)/i,
  /\.db$/i,
  /credentials/i,
  /\.(pem|key|p12|pfx)$/i,
  /node_modules(\/|$)/i,
  /^\.git(\/|$)/i,
] as const;

export const FILE_MANAGER_TEXT_MAX_BYTES = 2 * 1024 * 1024;
export const FILE_MANAGER_BINARY_MAX_BYTES = 10 * 1024 * 1024;
export const FILE_MANAGER_ZIP_MAX_BYTES = 50 * 1024 * 1024;
export const FILE_MANAGER_UPLOAD_MAX_BYTES = 50 * 1024 * 1024;
export const FILE_MANAGER_UPLOAD_MAX_FILES = 20;

/** Entries omitted from File Manager tree listings. */
export const FILE_MANAGER_HIDDEN_ENTRY_NAMES = new Set([
  '.gitkeep',
]);

export const isFileManagerHiddenEntryName = (name: string): boolean => (
  FILE_MANAGER_HIDDEN_ENTRY_NAMES.has(name)
);

const IMAGE_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico', '.bmp', '.avif',
]);

const TEXT_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.css', '.html', '.sql',
  '.yml', '.yaml', '.txt', '.xml', '.csv', '.env.example', '.gitignore',
  '.mjs', '.cjs', '.scss', '.less', '.sh', '.bat', '.ps1', '.toml', '.ini',
  '.log', '.graphql', '.vue', '.svelte',
]);

/** Dotfiles and extensionless names treated as text even when `path.extname` is empty. */
const TEXT_BASENAMES = new Set([
  '.gitkeep',
  '.gitignore',
  '.dockerignore',
  '.editorconfig',
  '.npmrc',
  '.nvmrc',
  '.prettierrc',
  '.eslintrc',
  '.eslintignore',
  '.babelrc',
  '.browserslistrc',
  '.env.example',
  'dockerfile',
  'makefile',
  'license',
  'codeowners',
]);

export type FileManagerPathResolution =
  | { ok: true; relativePath: string; absolutePath: string; scope: FileManagerScope }
  | { ok: false; error: string };

export const normalizeFileManagerRelativePath = (input: string): string => (
  input.replace(/\\/g, '/').replace(/^\.\/+/, '').replace(/\/+$/, '').trim()
);

export const getFileManagerRepoRoot = (): string => path.resolve(process.cwd());

export const getFileManagerWorkspaceRelativePath = (): string => FILE_MANAGER_WORKSPACE_DIR;

export const isFileManagerDeniedPath = (relativePath: string): boolean => {
  const normalized = normalizeFileManagerRelativePath(relativePath);
  return FILE_MANAGER_DENIED_PATTERNS.some((pattern) => pattern.test(normalized));
};

const isWithinRoot = (absolutePath: string, rootAbsolute: string): boolean => {
  const relative = path.relative(rootAbsolute, absolutePath);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
};

export const validateZipEntryExtractPath = (
  destinationRootAbsolute: string,
  entryName: string,
  scope: FileManagerScope,
): { ok: true } | { ok: false; error: string } => {
  const normalized = entryName.replace(/\\/g, '/');
  if (!normalized || normalized.startsWith('/') || normalized.split('/').some((segment) => segment === '..')) {
    return { ok: false, error: 'Zip archive contains invalid entry paths.' };
  }

  const repoRoot = getFileManagerRepoRoot();
  const destinationRoot = path.resolve(destinationRootAbsolute);
  const absolutePath = path.resolve(destinationRoot, normalized);
  if (!isWithinRoot(absolutePath, destinationRoot)) {
    return { ok: false, error: 'Zip archive contains path traversal entries.' };
  }

  if (!isWithinRoot(absolutePath, repoRoot)) {
    return { ok: false, error: 'Zip entry escapes project root.' };
  }

  const relativePath = path.relative(repoRoot, absolutePath).replace(/\\/g, '/');
  const resolved = resolveFileManagerPath(relativePath, scope);
  if (!resolved.ok) {
    return { ok: false, error: resolved.error };
  }

  return { ok: true };
};

const scopeRootRelativePath = (scope: FileManagerScope): string => (
  scope === 'workspace' ? FILE_MANAGER_WORKSPACE_DIR : ''
);

export const resolveFileManagerPath = (
  input: string,
  scope: FileManagerScope,
): FileManagerPathResolution => {
  const repoRoot = getFileManagerRepoRoot();
  const scopeRootRelative = scopeRootRelativePath(scope);
  const normalizedInput = normalizeFileManagerRelativePath(input);
  const relativePath = normalizedInput || scopeRootRelative;

  if (path.isAbsolute(relativePath) || /^[a-zA-Z]:/.test(relativePath)) {
    return { ok: false, error: 'Absolute paths are not allowed.' };
  }

  if (relativePath.split('/').some((segment) => segment === '..')) {
    return { ok: false, error: 'Parent directory segments are not allowed.' };
  }

  if (scope === 'workspace') {
    const workspacePrefix = `${FILE_MANAGER_WORKSPACE_DIR}/`;
    if (relativePath !== FILE_MANAGER_WORKSPACE_DIR && !relativePath.startsWith(workspacePrefix)) {
      return { ok: false, error: 'Workspace scope is limited to the workspace folder.' };
    }
  }

  if (isFileManagerDeniedPath(relativePath)) {
    return { ok: false, error: `Path "${relativePath}" is not accessible.` };
  }

  const absolutePath = path.resolve(repoRoot, relativePath);
  if (!isWithinRoot(absolutePath, repoRoot)) {
    return { ok: false, error: 'Path escapes the project root.' };
  }

  let realAbsolutePath = absolutePath;
  try {
    realAbsolutePath = fs.realpathSync(absolutePath);
  } catch {
    const parent = path.dirname(absolutePath);
    try {
      const realParent = fs.realpathSync(parent);
      realAbsolutePath = path.join(realParent, path.basename(absolutePath));
    } catch {
      realAbsolutePath = absolutePath;
    }
  }

  if (!isWithinRoot(realAbsolutePath, repoRoot)) {
    return { ok: false, error: 'Path escapes the project root.' };
  }

  const resolvedRelative = path.relative(repoRoot, realAbsolutePath).replace(/\\/g, '/');
  if (isFileManagerDeniedPath(resolvedRelative)) {
    return { ok: false, error: `Path "${resolvedRelative}" is not accessible.` };
  }

  if (scope === 'workspace') {
    const workspacePrefix = `${FILE_MANAGER_WORKSPACE_DIR}/`;
    if (resolvedRelative !== FILE_MANAGER_WORKSPACE_DIR && !resolvedRelative.startsWith(workspacePrefix)) {
      return { ok: false, error: 'Workspace scope is limited to the workspace folder.' };
    }
  }

  return {
    ok: true,
    relativePath: resolvedRelative,
    absolutePath: realAbsolutePath,
    scope,
  };
};

export const ensureFileManagerWorkspaceDirectory = (): void => {
  const workspacePath = path.join(getFileManagerRepoRoot(), FILE_MANAGER_WORKSPACE_DIR);
  fs.mkdirSync(workspacePath, { recursive: true });
};

export const sanitizeFileManagerEntryName = (name: string): string | null => {
  const trimmed = name.trim();
  if (!trimmed || trimmed === '.' || trimmed === '..') {
    return null;
  }

  if (/[<>:"/\\|?*\u0000-\u001f]/.test(trimmed)) {
    return null;
  }

  return trimmed;
};

export const resolveFileManagerParentPath = (
  relativePath: string,
  scope: FileManagerScope,
): string => {
  const normalized = normalizeFileManagerRelativePath(relativePath);
  const parent = normalizeFileManagerRelativePath(path.dirname(normalized));
  if (parent === '.' || parent === '') {
    return scope === 'workspace' ? FILE_MANAGER_WORKSPACE_DIR : '';
  }
  return parent;
};

export const isFileManagerPathInsideDirectory = (
  directoryPath: string,
  candidatePath: string,
): boolean => {
  const directory = normalizeFileManagerRelativePath(directoryPath);
  const candidate = normalizeFileManagerRelativePath(candidatePath);
  if (!directory) {
    return false;
  }
  if (candidate === directory) {
    return true;
  }
  return candidate.startsWith(`${directory}/`);
};

export const getFileManagerExtension = (filePath: string): string | null => {
  const extension = path.extname(filePath).toLowerCase();
  return extension || null;
};

export const getFileManagerBasename = (filePath: string): string => {
  const normalized = normalizeFileManagerRelativePath(filePath);
  return path.basename(normalized).toLowerCase();
};

export const isLikelyUtf8TextBuffer = (buffer: Buffer): boolean => {
  if (buffer.length === 0) {
    return true;
  }

  if (buffer.includes(0)) {
    return false;
  }

  const text = buffer.toString('utf8');
  return !text.includes('\uFFFD');
};

export const isFileManagerImagePath = (filePath: string): boolean => {
  const extension = getFileManagerExtension(filePath);
  return extension ? IMAGE_EXTENSIONS.has(extension) : false;
};

export const isFileManagerZipPath = (filePath: string): boolean => (
  getFileManagerExtension(filePath) === '.zip'
);

export const isFileManagerTextPath = (filePath: string): boolean => {
  const normalized = normalizeFileManagerRelativePath(filePath);
  if (normalized.endsWith('.md') || normalized === 'AGENTS.md') {
    return true;
  }

  const basename = getFileManagerBasename(filePath);
  if (TEXT_BASENAMES.has(basename) || basename.startsWith('dockerfile')) {
    return true;
  }

  const extension = getFileManagerExtension(filePath);
  return extension ? TEXT_EXTENSIONS.has(extension) : false;
};

export const resolveMonacoLanguage = (filePath: string): string => {
  const basename = getFileManagerBasename(filePath);
  if (basename.startsWith('dockerfile')) {
    return 'dockerfile';
  }

  const extension = getFileManagerExtension(filePath);
  switch (extension) {
    case '.ts':
      return 'typescript';
    case '.tsx':
      return 'typescript';
    case '.js':
    case '.jsx':
    case '.mjs':
    case '.cjs':
      return 'javascript';
    case '.json':
      return 'json';
    case '.md':
      return 'markdown';
    case '.css':
    case '.scss':
    case '.less':
      return 'css';
    case '.html':
      return 'html';
    case '.sql':
      return 'sql';
    case '.yml':
    case '.yaml':
      return 'yaml';
    case '.xml':
      return 'xml';
    case '.sh':
    case '.bat':
    case '.ps1':
      return 'shell';
    case '.toml':
    case '.ini':
      return 'ini';
    default:
      if (basename === '.gitignore' || basename === '.gitkeep' || basename === '.dockerignore') {
        return 'plaintext';
      }
      return 'plaintext';
  }
};

export const resolveMimeType = (filePath: string): string | null => {
  const extension = getFileManagerExtension(filePath);
  switch (extension) {
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.gif':
      return 'image/gif';
    case '.webp':
      return 'image/webp';
    case '.svg':
      return 'image/svg+xml';
    case '.ico':
      return 'image/x-icon';
    case '.bmp':
      return 'image/bmp';
    case '.avif':
      return 'image/avif';
    case '.json':
      return 'application/json';
    case '.txt':
      return 'text/plain';
    case '.html':
      return 'text/html';
    case '.css':
      return 'text/css';
    case '.js':
      return 'text/javascript';
    case '.ts':
    case '.tsx':
      return 'text/typescript';
    default:
      return null;
  }
};
