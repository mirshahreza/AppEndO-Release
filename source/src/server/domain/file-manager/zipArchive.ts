import type AdmZip from 'adm-zip';
import type { FileManagerZipEntry, FileManagerZipEntryKind } from '../../../shared/api/contracts/file-manager/types';

export const normalizeZipInternalEntryPath = (entryPath: string): string => (
  entryPath.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '')
);

export const validateZipInternalEntryPath = (
  entryPath: string,
): { ok: true; normalized: string } | { ok: false; error: string } => {
  const raw = entryPath.replace(/\\/g, '/');
  if (!raw.trim()) {
    return { ok: false, error: 'Zip entry path is required.' };
  }

  const segments = raw.replace(/^\/+/, '').replace(/\/+$/, '').split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) {
    return { ok: false, error: 'Invalid zip entry path.' };
  }

  return { ok: true, normalized: segments.join('/') };
};

export const getZipInternalParentPath = (entryPath: string): string => {
  const normalized = normalizeZipInternalEntryPath(entryPath);
  const index = normalized.lastIndexOf('/');
  return index >= 0 ? normalized.slice(0, index) : '';
};

export const getZipInternalEntryName = (entryPath: string): string => {
  const normalized = normalizeZipInternalEntryPath(entryPath);
  const index = normalized.lastIndexOf('/');
  return index >= 0 ? normalized.slice(index + 1) : normalized;
};

export const joinZipInternalPath = (parentPath: string, entryName: string): string => {
  const parent = normalizeZipInternalEntryPath(parentPath);
  const name = entryName.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
  if (!parent) {
    return name;
  }
  return `${parent}/${name}`;
};

export const isZipInternalDescendantPath = (ancestorPath: string, candidatePath: string): boolean => {
  const ancestor = normalizeZipInternalEntryPath(ancestorPath);
  const candidate = normalizeZipInternalEntryPath(candidatePath);
  if (!ancestor) {
    return false;
  }
  if (candidate === ancestor) {
    return true;
  }
  return candidate.startsWith(`${ancestor}/`);
};

type ZipTreeNode = FileManagerZipEntry & { children: Map<string, ZipTreeNode> };

const toZipEntryKind = (isDirectory: boolean): FileManagerZipEntryKind => (
  isDirectory ? 'directory' : 'file'
);

const finalizeZipTree = (node: ZipTreeNode): FileManagerZipEntry => ({
  name: node.name,
  path: node.path,
  kind: node.kind,
  sizeBytes: node.sizeBytes,
  compressedSizeBytes: node.compressedSizeBytes,
  children: [...node.children.values()]
    .sort((left, right) => {
      if (left.kind !== right.kind) {
        return left.kind === 'directory' ? -1 : 1;
      }
      return left.name.localeCompare(right.name, undefined, { sensitivity: 'base' });
    })
    .map((child) => finalizeZipTree(child)),
});

export const buildZipEntryTree = (zip: AdmZip): FileManagerZipEntry[] => {
  const root = new Map<string, ZipTreeNode>();

  for (const entry of zip.getEntries()) {
    const normalized = normalizeZipInternalEntryPath(entry.entryName);
    if (!normalized) {
      continue;
    }

    const segments = normalized.split('/');
    const isDirectory = entry.isDirectory || entry.entryName.endsWith('/');
    let currentMap = root;
    let currentPath = '';

    for (let index = 0; index < segments.length; index += 1) {
      const segment = segments[index]!;
      const isLast = index === segments.length - 1;
      const kind = isLast && !isDirectory ? 'file' : 'directory';
      currentPath = currentPath ? `${currentPath}/${segment}` : segment;

      let node = currentMap.get(segment);
      if (!node) {
        node = {
          name: segment,
          path: currentPath,
          kind,
          sizeBytes: kind === 'file' ? entry.header.size : 0,
          compressedSizeBytes: kind === 'file' ? entry.header.compressedSize : 0,
          children: new Map(),
        };
        currentMap.set(segment, node);
      } else if (isLast && !isDirectory) {
        node.kind = 'file';
        node.sizeBytes = entry.header.size;
        node.compressedSizeBytes = entry.header.compressedSize;
      }

      currentMap = node.children;
    }
  }

  return [...root.values()]
    .sort((left, right) => {
      if (left.kind !== right.kind) {
        return left.kind === 'directory' ? -1 : 1;
      }
      return left.name.localeCompare(right.name, undefined, { sensitivity: 'base' });
    })
    .map((node) => finalizeZipTree(node));
};

export const listZipEntryPaths = (zip: AdmZip): string[] => (
  zip.getEntries()
    .map((entry) => normalizeZipInternalEntryPath(entry.entryName))
    .filter((entryPath) => Boolean(entryPath))
);

export const zipEntryExists = (zip: AdmZip, entryPath: string): boolean => {
  const normalized = normalizeZipInternalEntryPath(entryPath);
  return listZipEntryPaths(zip).some((candidate) => (
    candidate === normalized || candidate.startsWith(`${normalized}/`)
  ));
};

export const findZipEntry = (zip: AdmZip, entryPath: string) => {
  const normalized = normalizeZipInternalEntryPath(entryPath);
  return zip.getEntries().find((entry) => (
    normalizeZipInternalEntryPath(entry.entryName) === normalized
  )) ?? null;
};

export const collectZipEntriesWithPrefix = (zip: AdmZip, prefixPath: string): string[] => {
  const prefix = normalizeZipInternalEntryPath(prefixPath);
  return listZipEntryPaths(zip).filter((entryPath) => (
    entryPath === prefix || entryPath.startsWith(`${prefix}/`)
  ));
};

export const remapZipEntryPathPrefix = (
  entryPath: string,
  oldPrefix: string,
  newPrefix: string,
): string => {
  const normalized = normalizeZipInternalEntryPath(entryPath);
  const oldNormalized = normalizeZipInternalEntryPath(oldPrefix);
  const newNormalized = normalizeZipInternalEntryPath(newPrefix);

  if (normalized === oldNormalized) {
    return newNormalized;
  }
  if (normalized.startsWith(`${oldNormalized}/`)) {
    return `${newNormalized}${normalized.slice(oldNormalized.length)}`;
  }
  return normalized;
};

export const deleteZipEntryTree = (zip: AdmZip, entryPath: string): number => {
  const targets = collectZipEntriesWithPrefix(zip, entryPath)
    .sort((left, right) => right.length - left.length);

  for (const target of targets) {
    const entry = findZipEntry(zip, target);
    if (entry) {
      zip.deleteFile(entry);
    }
  }

  return targets.length;
};

export const moveZipEntryTree = (
  zip: AdmZip,
  sourcePath: string,
  destinationParentPath: string,
  overwrite = false,
): { ok: true; movedPath: string; movedEntries: number } | { ok: false; error: string } => {
  const source = normalizeZipInternalEntryPath(sourcePath);
  const destinationParent = normalizeZipInternalEntryPath(destinationParentPath);
  const entryName = getZipInternalEntryName(source);
  const destinationPath = destinationParent
    ? joinZipInternalPath(destinationParent, entryName)
    : entryName;

  return moveZipEntryToPath(zip, source, destinationPath, overwrite);
};

export const moveZipEntryToPath = (
  zip: AdmZip,
  sourcePath: string,
  destinationPath: string,
  overwrite = false,
): { ok: true; movedPath: string; movedEntries: number } | { ok: false; error: string } => {
  const source = normalizeZipInternalEntryPath(sourcePath);
  const destination = normalizeZipInternalEntryPath(destinationPath);

  if (!source) {
    return { ok: false, error: 'Source entry path is required.' };
  }

  if (
    destination === source
    || isZipInternalDescendantPath(source, destination)
    || (destination && isZipInternalDescendantPath(source, destination))
  ) {
    return { ok: false, error: 'Cannot move an entry into itself or its descendant.' };
  }

  const sourceEntries = collectZipEntriesWithPrefix(zip, source)
    .sort((left, right) => left.length - right.length);

  if (sourceEntries.length === 0) {
    return { ok: false, error: 'Zip entry not found.' };
  }

  const destinationExists = zipEntryExists(zip, destination);
  if (destinationExists && !overwrite) {
    return { ok: false, error: 'An entry with that name already exists in the destination folder.' };
  }

  if (destinationExists && overwrite) {
    deleteZipEntryTree(zip, destination);
  }

  const staged: Array<{ newPath: string; buffer: Buffer; isDirectory: boolean }> = [];

  for (const currentPath of sourceEntries) {
    const entry = findZipEntry(zip, currentPath);
    if (!entry) {
      continue;
    }

    const newPath = remapZipEntryPathPrefix(currentPath, source, destination);
    staged.push({
      newPath,
      buffer: entry.getData(),
      isDirectory: entry.isDirectory || entry.entryName.endsWith('/'),
    });
  }

  deleteZipEntryTree(zip, source);

  for (const item of staged) {
    const zipPath = item.isDirectory ? `${item.newPath}/` : item.newPath;
    zip.addFile(zipPath, item.buffer);
  }

  return { ok: true, movedPath: destination, movedEntries: staged.length };
};

export const renameZipEntryInArchive = (
  zip: AdmZip,
  entryPath: string,
  newName: string,
): { ok: true; renamedPath: string; renamedEntries: number } | { ok: false; error: string } => {
  const source = normalizeZipInternalEntryPath(entryPath);
  const parent = getZipInternalParentPath(source);
  const destination = parent ? joinZipInternalPath(parent, newName) : newName;
  const moved = moveZipEntryToPath(zip, source, destination, false);
  if (!moved.ok) {
    return moved;
  }
  return { ok: true, renamedPath: moved.movedPath, renamedEntries: moved.movedEntries };
};
