/**
 * Builder-level folder RBAC (Phase 54 / gap #22).
 *
 * Studio editor access (who may edit drafts in a folder) — completely separate from
 * consumer page RBAC in designerPageAccess.ts (do not mix the two).
 *
 * Storage: workspace/designer/folder-permissions.json
 * Shape: { folderPermissions: Record<folder, Role[]> }
 *
 * Rules:
 * - ADMIN always has access to every folder.
 * - When a folder has an explicit roles list, the user must hold one of those roles (or ADMIN).
 * - When a folder has no entry, fallback is ["ADMIN"] (preserves pre-Phase-54 behavior).
 */

import fs from 'fs';
import path from 'path';
import { atomicWriteText } from '../../../core/runtime/RuntimeFileStore';
import { runtimeDirs } from '../../../core/runtime/runtimePaths';
import { HttpError } from '../../errors/HttpError';
import { sanitizeDraftFolderName } from './draftFolderPaths';
import { designerStoragePaths, ensureDesignerStoragePaths } from './storage';

export type BuilderFolderPermissions = Record<string, string[]>;

type FolderPermissionsFile = {
  schema: 'designer-builder-folder-permissions';
  schemaVersion: '1.0.0';
  updatedAt: string;
  /** Fallback roles when a folder has no explicit entry (defaults to ADMIN). */
  defaultRoles: string[];
  folderPermissions: BuilderFolderPermissions;
};

export const designerFolderPermissionsPath = path.join(
  designerStoragePaths.root,
  'folder-permissions.json',
);

const DEFAULT_ROLES = ['ADMIN'] as const;

const ensureFolderPermissionsStorage = (): void => {
  ensureDesignerStoragePaths();
};

const normalizeRole = (role: string): string => role.trim().toUpperCase();

const sanitizeRoles = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  const roles: string[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== 'string') {
      continue;
    }
    const role = normalizeRole(entry);
    if (!role || seen.has(role)) {
      continue;
    }
    seen.add(role);
    roles.push(role);
  }
  return roles;
};

const emptyFile = (): FolderPermissionsFile => ({
  schema: 'designer-builder-folder-permissions',
  schemaVersion: '1.0.0',
  updatedAt: new Date().toISOString(),
  defaultRoles: [...DEFAULT_ROLES],
  folderPermissions: {},
});

const readFile = (): FolderPermissionsFile => {
  ensureFolderPermissionsStorage();
  if (!fs.existsSync(designerFolderPermissionsPath)) {
    return emptyFile();
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(designerFolderPermissionsPath, 'utf8')) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return emptyFile();
    }
    const record = parsed as Record<string, unknown>;
    const defaultRoles = sanitizeRoles(record.defaultRoles);
    const folderPermissions: BuilderFolderPermissions = {};
    if (record.folderPermissions && typeof record.folderPermissions === 'object' && !Array.isArray(record.folderPermissions)) {
      for (const [rawFolder, rolesValue] of Object.entries(record.folderPermissions as Record<string, unknown>)) {
        const folder = sanitizeDraftFolderName(rawFolder);
        const roles = sanitizeRoles(rolesValue);
        if (folder && roles.length > 0) {
          folderPermissions[folder] = roles;
        }
      }
    }
    return {
      schema: 'designer-builder-folder-permissions',
      schemaVersion: '1.0.0',
      updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : new Date().toISOString(),
      defaultRoles: defaultRoles.length > 0 ? defaultRoles : [...DEFAULT_ROLES],
      folderPermissions,
    };
  } catch {
    return emptyFile();
  }
};

const writeFile = (file: FolderPermissionsFile): void => {
  ensureFolderPermissionsStorage();
  atomicWriteText(
    designerFolderPermissionsPath,
    JSON.stringify(file, null, 2),
    runtimeDirs.workspaceTemp,
  );
};

export const getBuilderFolderPermissions = (): FolderPermissionsFile => readFile();

export const setBuilderFolderPermissions = (input: {
  folderPermissions?: BuilderFolderPermissions;
  defaultRoles?: string[];
}): FolderPermissionsFile => {
  const current = readFile();
  const next: FolderPermissionsFile = {
    ...current,
    updatedAt: new Date().toISOString(),
  };

  if (input.defaultRoles !== undefined) {
    const roles = sanitizeRoles(input.defaultRoles);
    next.defaultRoles = roles.length > 0 ? roles : [...DEFAULT_ROLES];
  }

  if (input.folderPermissions !== undefined) {
    const folderPermissions: BuilderFolderPermissions = {};
    for (const [rawFolder, rolesValue] of Object.entries(input.folderPermissions)) {
      const folder = sanitizeDraftFolderName(rawFolder);
      const roles = sanitizeRoles(rolesValue);
      if (folder && roles.length > 0) {
        folderPermissions[folder] = roles;
      }
    }
    next.folderPermissions = folderPermissions;
  }

  writeFile(next);
  return next;
};

export const resolveBuilderFolderAllowedRoles = (folder: unknown): string[] => {
  const file = readFile();
  const key = sanitizeDraftFolderName(folder);
  const explicit = file.folderPermissions[key];
  if (explicit && explicit.length > 0) {
    return explicit;
  }
  return file.defaultRoles.length > 0 ? file.defaultRoles : [...DEFAULT_ROLES];
};

export const canAccessBuilderFolder = (
  folder: unknown,
  userRoles: readonly string[],
): boolean => {
  const normalizedUserRoles = userRoles.map(normalizeRole).filter(Boolean);
  if (normalizedUserRoles.includes('ADMIN')) {
    return true;
  }
  const allowed = resolveBuilderFolderAllowedRoles(folder);
  return allowed.some((role) => normalizedUserRoles.includes(role));
};

export const assertBuilderFolderAccess = (
  folder: unknown,
  userRoles: readonly string[],
): void => {
  if (canAccessBuilderFolder(folder, userRoles)) {
    return;
  }
  throw new HttpError(403, `Forbidden: no builder access to folder "${sanitizeDraftFolderName(folder)}".`);
};

export const canAccessAnyBuilderFolder = (userRoles: readonly string[]): boolean => {
  const normalizedUserRoles = userRoles.map(normalizeRole).filter(Boolean);
  if (normalizedUserRoles.includes('ADMIN')) {
    return true;
  }
  const file = readFile();
  if (file.defaultRoles.some((role) => normalizedUserRoles.includes(role))) {
    return true;
  }
  return Object.values(file.folderPermissions).some((roles) =>
    roles.some((role) => normalizedUserRoles.includes(role)));
};

export const resetBuilderFolderPermissionsForTests = (): void => {
  writeFile(emptyFile());
};
