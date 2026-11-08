import type { FileHubRemoteEntry } from '../../../shared/api/contracts/file-hub/types';
import {
  basenameRemotePath,
  joinRemotePath,
  parentRemotePath,
  sanitizeRemotePath,
} from '../../../shared/api/contracts/file-hub/validation';
import {
  deleteFileHubPath,
  listFileHubFiles,
  mkdirFileHubPath,
  renameFileHubPath,
} from '../../../shared/api/queries/file-hub';

export type FileHubAiCommandOp =
  | { kind: 'list'; path: string }
  | { kind: 'pwd' }
  | { kind: 'cd'; path: string }
  | { kind: 'mkdir'; path: string }
  | { kind: 'delete'; path: string }
  | { kind: 'rename'; from: string; to: string };

export type FileHubAiCommandParseResult =
  | { ok: true; op: FileHubAiCommandOp }
  | { ok: false; error: string };

export function tokenizeFileHubCommandLine(command: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let quote: "'" | '"' | null = null;

  const flush = () => {
    if (current) {
      tokens.push(current);
      current = '';
    }
  };

  for (let index = 0; index < command.length; index += 1) {
    const char = command[index];
    if (quote) {
      if (char === quote) {
        quote = null;
        continue;
      }
      current += char;
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }
    if (/\s/.test(char)) {
      flush();
      continue;
    }
    current += char;
  }
  flush();
  return tokens;
}

export function resolveFileHubCommandPath(cwd: string, raw: string | undefined): string | null {
  const base = sanitizeRemotePath(cwd) ?? '/';
  const trimmed = (raw ?? '').trim();
  if (!trimmed || trimmed === '.') {
    return base;
  }
  if (trimmed.startsWith('/')) {
    return sanitizeRemotePath(trimmed);
  }
  const parts = trimmed.split('/').filter(Boolean);
  let acc = base;
  for (const part of parts) {
    if (part === '.') {
      continue;
    }
    if (part === '..') {
      acc = parentRemotePath(acc);
      continue;
    }
    acc = joinRemotePath(acc, part) ?? acc;
  }
  return sanitizeRemotePath(acc);
}

const pathArgs = (tokens: string[]): string[] => tokens.filter((token) => !token.startsWith('-'));

export function parseFileHubAiCommand(command: string, cwd: string): FileHubAiCommandParseResult {
  const tokens = tokenizeFileHubCommandLine(command);
  const verb = (tokens[0] ?? '').toLowerCase();
  if (!verb) {
    return { ok: false, error: 'Command is empty.' };
  }

  const args = pathArgs(tokens.slice(1));
  if (verb === 'pwd') {
    return { ok: true, op: { kind: 'pwd' } };
  }
  if (verb === 'ls' || verb === 'dir' || verb === 'nlist' || verb === 'mlsd') {
    const path = resolveFileHubCommandPath(cwd, args[0]);
    if (!path) {
      return { ok: false, error: 'Path is invalid.' };
    }
    return { ok: true, op: { kind: 'list', path } };
  }
  if (verb === 'cd') {
    const path = resolveFileHubCommandPath(cwd, args[0] ?? '/');
    if (!path) {
      return { ok: false, error: 'Path is invalid.' };
    }
    return { ok: true, op: { kind: 'cd', path } };
  }
  if (verb === 'mkdir') {
    const path = resolveFileHubCommandPath(cwd, args[0]);
    if (!path || path === '/') {
      return { ok: false, error: 'Folder path is required.' };
    }
    return { ok: true, op: { kind: 'mkdir', path } };
  }
  if (verb === 'rm' || verb === 'rmdir' || verb === 'delete' || verb === 'del') {
    const path = resolveFileHubCommandPath(cwd, args[0]);
    if (!path || path === '/') {
      return { ok: false, error: 'Path to delete is required.' };
    }
    return { ok: true, op: { kind: 'delete', path } };
  }
  if (verb === 'rename' || verb === 'mv') {
    const from = resolveFileHubCommandPath(cwd, args[0]);
    const to = resolveFileHubCommandPath(cwd, args[1]);
    if (!from || !to || from === '/' || to === '/') {
      return { ok: false, error: 'Rename needs a source and destination path.' };
    }
    return { ok: true, op: { kind: 'rename', from, to } };
  }
  if (verb === 'stat' || verb === 'size') {
    const path = resolveFileHubCommandPath(cwd, args[0] ?? '.');
    if (!path) {
      return { ok: false, error: 'Path is invalid.' };
    }
    return { ok: true, op: { kind: 'list', path: parentRemotePath(path) === path ? path : parentRemotePath(path) } };
  }

  return { ok: false, error: `Unsupported File Hub command: ${verb}` };
}

export function formatFileHubSnapshot(params: {
  protocol: string;
  path: string;
  items: FileHubRemoteEntry[];
}): string {
  const lines = [
    `Protocol: ${params.protocol.toUpperCase()}`,
    `Path: ${params.path}`,
    'Entries:',
  ];
  if (params.items.length === 0) {
    lines.push('(empty)');
    return lines.join('\n');
  }
  for (const item of params.items.slice(0, 200)) {
    const mark = item.type === 'directory' ? 'd' : '-';
    lines.push(`${mark}\t${item.name}`);
  }
  return lines.join('\n');
}

const findEntryType = async (
  connectionId: string,
  cwd: string,
  items: FileHubRemoteEntry[],
  path: string,
): Promise<'file' | 'directory'> => {
  const name = basenameRemotePath(path);
  const local = items.find((item) => {
    const itemPath = joinRemotePath(cwd, item.name);
    return item.name === name || itemPath === path;
  });
  if (local) {
    return local.type;
  }
  const parent = parentRemotePath(path);
  const listing = await listFileHubFiles(connectionId, parent);
  const found = listing.items.find((item) => item.name === name);
  if (!found) {
    throw new Error('Remote path not found.');
  }
  return found.type;
};

export async function executeFileHubAiCommand(params: {
  connectionId: string;
  cwd: string;
  items: FileHubRemoteEntry[];
  command: string;
}): Promise<{ cwd: string; items: FileHubRemoteEntry[] }> {
  const parsed = parseFileHubAiCommand(params.command, params.cwd);
  if (!parsed.ok) {
    throw new Error(parsed.error);
  }

  const { op } = parsed;
  if (op.kind === 'pwd') {
    return { cwd: params.cwd, items: params.items };
  }
  if (op.kind === 'list' || op.kind === 'cd') {
    const listing = await listFileHubFiles(params.connectionId, op.path);
    return { cwd: listing.path, items: listing.items };
  }
  if (op.kind === 'mkdir') {
    await mkdirFileHubPath(params.connectionId, op.path);
  } else if (op.kind === 'delete') {
    const type = await findEntryType(params.connectionId, params.cwd, params.items, op.path);
    await deleteFileHubPath(params.connectionId, op.path, type);
  } else if (op.kind === 'rename') {
    await renameFileHubPath(params.connectionId, op.from, op.to);
  }

  const listing = await listFileHubFiles(params.connectionId, params.cwd);
  return { cwd: listing.path, items: listing.items };
}
