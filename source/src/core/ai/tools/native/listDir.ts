import fs from 'fs';
import path from 'path';
import {
  AGENT_ALLOWLIST_ROOTS,
  getRepoRoot,
  isAllowlistedPath,
  normalizeRelativePath,
  resolveAllowlistedPath,
} from '../pathAllowlist';
import type { NativeToolDefinition } from '../ToolRegistry';

export const LIST_DIR_TOOL_NAME = 'list_dir';

export const executeListDir = async (args: Record<string, unknown>) => {
  const inputPath = typeof args.path === 'string' ? args.path.trim() : '';
  const relativePath = inputPath ? normalizeRelativePath(inputPath) : '';

  if (!relativePath) {
    const entries = AGENT_ALLOWLIST_ROOTS.map((root) => ({
      name: root.endsWith('/') ? root.slice(0, -1) : root,
      type: root.endsWith('/') || root === 'AGENTS.md' ? 'file_or_dir' : 'dir',
    }));

    return {
      ok: true as const,
      summary: `Listed ${entries.length} allowlisted root(s).`,
      data: { path: '.', entries },
    };
  }

  const resolved = resolveAllowlistedPath(relativePath);
  if (resolved.ok === false) {
    return { ok: false as const, summary: resolved.error, error: 'path_not_allowed' };
  }

  let stat: fs.Stats;
  try {
    stat = fs.statSync(resolved.absolutePath);
  } catch {
    return { ok: false as const, summary: `Directory not found: ${resolved.relativePath}`, error: 'not_found' };
  }

  if (!stat.isDirectory()) {
    return { ok: false as const, summary: `Path is not a directory: ${resolved.relativePath}`, error: 'not_a_directory' };
  }

  const repoRoot = path.resolve(getRepoRoot());
  const dirents = fs.readdirSync(resolved.absolutePath, { withFileTypes: true });
  const entries = dirents
    .map((entry) => {
      const childRelative = resolved.relativePath
        ? `${resolved.relativePath}/${entry.name}`
        : entry.name;
      const childAbsolute = path.resolve(repoRoot, childRelative);

      if (!childAbsolute.startsWith(`${repoRoot}${path.sep}`) && childAbsolute !== repoRoot) {
        return null;
      }

      if (!isAllowlistedPath(childRelative) && !isAllowlistedPath(`${childRelative}/`)) {
        return null;
      }

      return {
        name: entry.name,
        type: entry.isDirectory() ? 'directory' : 'file',
        path: childRelative,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    .sort((left, right) => left.name.localeCompare(right.name));

  return {
    ok: true as const,
    summary: `Listed ${entries.length} item(s) in ${resolved.relativePath}.`,
    data: {
      path: resolved.relativePath,
      entries,
    },
  };
};

export const listDirTool: NativeToolDefinition = {
  name: LIST_DIR_TOOL_NAME,
  description: 'Lists files and subdirectories in an allowlisted folder. Use to explore repo structure before read_file or search_codebase. Omit path to list top-level allowlisted roots. Returns path and entries with name/kind. Example: list_dir({ path: "src/server/services" }).',
  group: 'read',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Allowlisted relative directory path.' },
    },
  },
  execute: executeListDir,
};
