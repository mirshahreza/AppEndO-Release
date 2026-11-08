export const PACKAGE_HID_REWRITE_ENTRY = 'db/base-info-hid.json';

export type PackageHidRewriteRow = {
  id: string;
  parentId: string | null;
  title: string;
};

export type PackageHidRewriteIndex = {
  version: 1;
  table: 'base_info';
  rows: PackageHidRewriteRow[];
};

const remapHidWithUnpaddedChildSegments = (oldId: string, oldRoot: string, newRoot: string): string => {
  if (oldId === oldRoot) return newRoot;
  const prefix = `${oldRoot}.`;
  if (!oldId.startsWith(prefix)) {
    throw new Error(`Base Info id ${oldId} is not in subtree ${oldRoot}.`);
  }
  const segments = oldId.slice(prefix.length).split('.').map((part) => {
    if (!/^\d+$/.test(part)) {
      throw new Error(`Invalid HID segment "${part}" in ${oldId}.`);
    }
    return String(Number.parseInt(part, 10));
  });
  return `${newRoot}.${segments.join('.')}`;
};

export function serializePackageHidRewriteIndex(index: PackageHidRewriteIndex): string {
  return `${JSON.stringify(index, null, 2)}\n`;
}

export function parsePackageHidRewriteIndex(raw: string): PackageHidRewriteIndex {
  const parsed = JSON.parse(raw) as PackageHidRewriteIndex;
  if (parsed?.version !== 1 || parsed.table !== 'base_info' || !Array.isArray(parsed.rows)) {
    throw new Error('Package Base Info HID index is invalid.');
  }
  return parsed;
}

export function mergePackageHidRewriteRows(rows: readonly PackageHidRewriteRow[]): PackageHidRewriteRow[] {
  const byId = new Map<string, PackageHidRewriteRow>();
  for (const row of rows) {
    const id = row.id.trim();
    if (!id) continue;
    byId.set(id, {
      id,
      parentId: row.parentId?.trim() ? row.parentId.trim() : null,
      title: String(row.title ?? '').trim(),
    });
  }
  return [...byId.values()];
}

export function buildPackageHidRewriteIndex(rows: readonly PackageHidRewriteRow[]): PackageHidRewriteIndex | null {
  const merged = mergePackageHidRewriteRows(rows);
  if (merged.length === 0) return null;
  return { version: 1, table: 'base_info', rows: merged };
}

export async function planBaseInfoHidRewrite(
  captured: readonly PackageHidRewriteRow[],
  existingById: ReadonlyMap<string, string>,
  allocateId: (parentId: string | null) => Promise<string>,
): Promise<Record<string, string>> {
  const rows = mergePackageHidRewriteRows(captured);
  const capturedIds = new Set(rows.map((row) => row.id));
  const roots = rows.filter((row) => !row.parentId || !capturedIds.has(row.parentId));
  const map: Record<string, string> = {};

  for (const root of roots) {
    const existingTitle = existingById.get(root.id);
    if (existingTitle === undefined || existingTitle === root.title) continue;

    const newRoot = await allocateId(root.parentId);
    if (newRoot === root.id) continue;

    for (const row of rows) {
      if (row.id !== root.id && !row.id.startsWith(`${root.id}.`)) continue;
      map[row.id] = remapHidWithUnpaddedChildSegments(row.id, root.id, newRoot);
    }
  }

  return map;
}

export function applyHidRewriteMap(sql: string, map: Record<string, string>): string {
  const entries = Object.entries(map)
    .filter(([from, to]) => from && to && from !== to)
    .sort((left, right) => right[0].length - left[0].length);
  let rewritten = sql;
  for (const [from, to] of entries) {
    rewritten = rewritten.split(`'${from}'`).join(`'${to}'`);
  }
  return rewritten;
}
