export const normalizeZipInternalEntryPath = (entryPath: string): string => (
  entryPath.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '')
);

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

export const remapZipInternalPathPrefix = (
  value: string,
  oldPrefix: string,
  newPrefix: string,
): string => {
  const normalized = normalizeZipInternalEntryPath(value);
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
